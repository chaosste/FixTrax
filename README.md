<div align="center">

# 🎛️ FixTrax

**VinylRevive AI — Studio Mastering Rack**

*Professional AI audio restoration for vinyl-derived recordings*

*"Put a Buckhurst Hill on it"*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## About

FixTrax is a professional AI-powered audio restoration suite for vinyl-derived recordings. Using Gemini-driven spectral synthesis, it brings studio-quality restoration to recordings that deserve better than they got — suppressing hiss, filtering clicks and pops, and recovering the transient energy that the vinyl medium ate.

Load a track. Let the AI analyse the spectral profile. Dial in your restoration. A/B it against the original. Export.

## Features

- 🔇 **High-Fidelity Hiss Suppression** — Intelligent noise reduction that preserves musical detail
- 💥 **Click & Pop Filtering** — Automatic detection and removal of vinyl surface artefacts
- ⚡ **Transient Energy Recovery** — Restore punch and presence lost in the transfer chain
- 🧠 **Gemini Spectral Synthesis** — AI-driven spectral analysis and reconstruction
- 💾 **Preset System** — Save and recall restoration configurations
- 📋 **Track List Management** — Batch processing workflow for albums and collections
- 📤 **Multi-Format Export** — Output in multiple audio formats
- 🔄 **A/B Comparison** — Instant switching between original and processed audio

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript, Vite |
| AI | Google Gemini API (spectral synthesis) |
| Audio | Web Audio API |
| Deployment | Docker / Google Cloud |

## Installation

```bash
# Clone the repository
git clone https://github.com/chaosste/FixTrax.git
cd FixTrax

# Install dependencies
npm install

# Configure your Gemini API key

# Run development server
npm run dev
```

## Disclaimer

FixTrax is an audio processing tool. Results depend on source material quality. The developers make no guarantees regarding output fidelity for any specific recording.

## Related Projects

> ⚡ Fancy something visual? Try [Strobe Core](https://github.com/chaosste/strobe) — AI-powered strobe light. Good on a big telly.

---

<div align="center">

**Built by [Steve Beale](https://newpsychonaut.com)**

[newpsychonaut.com](https://newpsychonaut.com)

© 2026 Stephen Beale. MIT License.

</div>
