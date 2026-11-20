# Adaptive Synth Radio

A browser-based Web Audio prototype that generates an ambient focus session in real time. It varies a minor-key chord progression, pad brightness, and pulse density as the session plays.

## Run locally

With Node.js, npm, and Python 3 installed, run these commands from the repository root.

```sh
npm install
npm run build
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://localhost:8000) and select **Play focus session**. Select **Stop** to end playback.
