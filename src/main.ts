import { createAdaptiveSynthRadio } from "./engine.js";

const play = document.querySelector<HTMLButtonElement>("#play")!;
const stop = document.querySelector<HTMLButtonElement>("#stop")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

let ctx: AudioContext | undefined;
let radio: ReturnType<typeof createAdaptiveSynthRadio> | undefined;

play.addEventListener("click", async () => {
  play.disabled = true;

  try {
    ctx ??= new AudioContext();
    await ctx.resume();
    radio ??= createAdaptiveSynthRadio(ctx, "focus");
    radio.start();
    stop.disabled = false;
    status.textContent = "Playing focus session";
  } catch (error) {
    play.disabled = false;
    status.textContent = "Could not start audio. Try pressing Play again.";
    console.error(error);
  }
});

stop.addEventListener("click", () => {
  radio?.stop();
  stop.disabled = true;
  play.disabled = false;
  status.textContent = "Stopped";
});
