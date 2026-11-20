export type Station = "focus" | "calm" | "flow";

export function createAdaptiveSynthRadio(ctx: AudioContext, station: Station) {
  const master = ctx.createGain();
  master.gain.value = 0.0001;

  const compressor = ctx.createDynamicsCompressor();
  const reverb = ctx.createConvolver();
  reverb.buffer = makeReverbImpulse(ctx, 2.8, 2.5);

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.35;

  master.connect(compressor);
  compressor.connect(ctx.destination);

  master.connect(reverbSend);
  reverbSend.connect(reverb);
  reverb.connect(compressor);

  const scale = [0, 2, 3, 5, 7, 8, 10]; // natural minor
  const root = 57; // A
  let degree = 0;
  let tension = station === "calm" ? 0.12 : 0.22;
  let brightness = station === "calm" ? 0.2 : 0.32;

  const active = new Map<OscillatorNode, number>();

  function makeReverbImpulse(ctx: AudioContext, seconds: number, decay: number) {
    const rate = ctx.sampleRate;
    const length = Math.round(rate * seconds);
    const impulse = ctx.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    return impulse;
  }

  function midiToFrequency(midi: number) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playPad(time: number, pitches: number[], duration: number) {
    const voiceGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 300 + brightness * 2200;

    const endTime = time + duration;
    voiceGain.gain.setValueAtTime(0, time);
    voiceGain.gain.linearRampToValueAtTime(0.07, time + duration * 0.45);
    voiceGain.gain.linearRampToValueAtTime(0, endTime);

    filter.connect(voiceGain);
    voiceGain.connect(master);

    let remaining = pitches.length;
    pitches.forEach((pitch, index) => {
      const osc = ctx.createOscillator();
      osc.type = index % 2 === 0 ? "sawtooth" : "triangle";
      osc.frequency.value = midiToFrequency(pitch);
      osc.detune.value = (index - 1) * 6;

      osc.connect(filter);
      osc.start(time);
      osc.stop(endTime);
      active.set(osc, endTime);

      osc.onended = () => {
        active.delete(osc);
        osc.disconnect();
        remaining--;
        if (remaining === 0) {
          filter.disconnect();
          voiceGain.disconnect();
        }
      };
    });
  }

  function playPulse(time: number, pitch: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.value = midiToFrequency(pitch);

    filter.type = "bandpass";
    filter.frequency.value = 500 + brightness * 1800;
    filter.Q.value = 4;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.09, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start(time);
    const endTime = time + 0.6;
    osc.stop(endTime);
    active.set(osc, endTime);

    osc.onended = () => {
      active.delete(osc);
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  function chordPitches(degreeIndex: number) {
    const indices = [degreeIndex, degreeIndex + 2, degreeIndex + 4];

    return indices.map(index => {
      const octave = Math.floor(index / scale.length) * 12;
      const scaleIndex = index % scale.length;
      return root + scale[scaleIndex] + octave;
    });
  }

  const progression: Record<number, number[]> = {
    0: [0, 5, 3, 4],
    3: [0, 5, 4],
    4: [0, 3, 5],
    5: [3, 0, 4],
  };

  function nextDegree(current: number) {
    const options = progression[current] ?? [0];
    return options[Math.floor(Math.random() * options.length)];
  }

  const barDuration = 60 / 72 * 4; // 72 BPM, 4/4

  function scheduleBar(startTime: number) {
    degree = nextDegree(degree);
    tension += (Math.random() - 0.45) * 0.06;
    tension = Math.min(0.75, Math.max(0.08, tension));
    brightness = 0.2 + tension * 0.5;

    playPad(startTime, chordPitches(degree), barDuration * 1.25);

    if (tension > 0.28) {
      const pulseCount = Math.round(2 + tension * 5);

      for (let i = 0; i < pulseCount; i++) {
        const step = Math.floor(Math.random() * 16);
        const time = startTime + (step / 16) * barDuration;
        const pitch = root + scale[Math.floor(Math.random() * scale.length)] + 12;
        playPulse(time, pitch);
      }
    }
  }

  let nextBarTime = 0;
  let interval: ReturnType<typeof setInterval> | undefined;

  function schedule() {
    const now = ctx.currentTime;
    // Skip missed bars after timer throttling to avoid a burst of overlapping notes.
    if (nextBarTime < now) {
      nextBarTime += Math.ceil((now - nextBarTime) / barDuration) * barDuration;
    }

    while (nextBarTime < now + 0.25) {
      scheduleBar(nextBarTime);
      nextBarTime += barDuration;
    }
  }

  function start() {
    if (interval !== undefined) return;

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0.8, now, 2);
    nextBarTime = now + 0.05;
    schedule();
    interval = setInterval(schedule, 50);
  }

  function stop() {
    if (interval === undefined) return;

    clearInterval(interval);
    interval = undefined;
    const now = ctx.currentTime;
    const endTime = now + 0.1;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0.0001, now, 0.02);

    for (const [osc, stopTime] of active) {
      if (stopTime > endTime) {
        osc.stop(endTime);
        active.set(osc, endTime);
      }
    }
  }

  return { start, stop };
}
