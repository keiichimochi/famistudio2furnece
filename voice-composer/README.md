# GB Voice Composer

Browser-based Game Boy sketch composer for iPhone microphone input.

## Features

- Four GB-style channels: Square 1, Square 2, Wave, Noise
- Record the selected channel while other channels play as guide
- Metronome click on every beat while recording
- Hum or whistle pitched channels; the browser converts pitch to quantized MIDI note events
- Tap/beatbox the Noise channel; amplitude peaks become noise hits
- Play back with Web Audio GB-style synthesis
- Export channel data as JSON for later conversion into the shared converter IR

This is intentionally separate from `converter/`. The browser app must run on HTTPS for iPhone microphone access, while the existing converter uses local CLI tools such as FamiStudio and Furnace.

## Development

```sh
npm install
npm run dev -- --port 51743
```

## Deploy

Deploy this directory as a Vercel static app.

```sh
npm run build
vercel --prod
```

On iPhone, open the HTTPS Vercel URL, tap `Record Channel`, allow microphone access, and record one channel at a time.
