# FixTrax - VinylRevive AI Studio Mastering Rack

FixTrax (VinylRevive AI) is a professional-grade React + TypeScript audio restoration suite designed specifically for vinyl-derived recordings. Features AI-driven restoration parameter suggestions, high-fidelity hiss suppression, click/pop filtering, transient energy recovery, and Gemini-powered spectral synthesis for a modern studio finish.

## Build, Test, and Development Commands

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Architecture

### Application Overview

FixTrax is a browser-based audio mastering suite that combines traditional DSP (Digital Signal Processing) with AI-driven restoration. The app analyzes vinyl track metadata to suggest optimal restoration parameters, then applies real-time processing through Web Audio API.

**Core capabilities:**
1. **AI Analysis** - Track name/metadata → restoration parameters
2. **Real-time Processing** - Web Audio API signal chain
3. **Preset Management** - Factory presets + user-saved profiles
4. **Export** - WAV/MP3 with applied processing

### Project Structure

```
components/
├── ControlPanel.tsx          # Main parameter controls interface
├── Visualizer.tsx            # Audio waveform/spectrum visualization
└── TrackList.tsx             # Track management and export

services/
├── AudioEngine.ts            # Web Audio API signal chain
├── geminiService.ts          # AI analysis via proxy
├── proxyService.ts           # Secure proxy communication
└── geminiCachingService.ts   # Context caching for Gemini

App.tsx                       # Main application shell
types.ts                      # TypeScript interfaces
vite.config.ts                # Vite configuration with proxy URL
```

### Audio Processing Pipeline

**AudioEngine.ts implements a 3-module signal chain:**

**Module 01: Restoration**
1. Noise Expander (downward expander for noise floor)
2. Hiss Filter (peaking @ 11.5kHz, Q=1.6)
3. Crackle Filter (peaking @ 3.2kHz, Q=4.0)
4. Click Filtering (transient detection - not yet implemented)
5. Hum Notch (50/60Hz, Q=15)
6. Transient Recovery (dynamic compression)
7. Spectral Synth (high-frequency excitation @ 15.5kHz)
8. DeReverb Gate (dynamics compression for sustain reduction)

**Module 02: Tone & Color**
1. Bass Filter (low shelf @ 150Hz)
2. Mid Filter (peaking @ 1.2kHz)
3. Air Filter (high shelf @ 12kHz)
4. Saturator (WaveShaper for harmonic warmth)

**Module 03: Stereo & Spatial**
1. M/S Processing (Mid-Side stereo widening)
2. Splitter → Mid/Side gain → Merger
3. Mono toggle for phase checking

**Master Section:**
1. Limiter (dynamics compression, -0.5dB default threshold)
2. Master Gain (-20 to +6 dB)
3. Analyzer (for visualization)

### AI Integration

**analyzeTrackWithAI(trackName: string): Promise<Partial<AudioSettings>>**

Uses Gemini 3 Flash (preview) to analyze track metadata and suggest restoration parameters:

**Input:** Track name (e.g., "Miles Davis - So What (1959)")

**Output:** JSON with restoration settings:
```typescript
{
  hissSuppression: number;      // 0-100
  crackleSuppression: number;   // 0-100
  clickSensitivity: number;     // 0-100
  transientRecovery: number;    // 0-100
  bassBoost: number;            // -5 to +8 dB
  midGain: number;              // -2 to +2 dB
  airGain: number;              // 0 to +12 dB
  warmth: number;               // 0-45 (saturation)
  deReverb: number;             // 0-60 (sustain reduction)
  stereoWidth: number;          // 50-180%
  aiInsight: string;            // Technical diagnosis
}
```

**Analysis focus:**
- Rhythmic surface crackle (1-4kHz transient noise)
- Wideband groove hiss (8-16kHz friction noise)
- Inner groove distortion (high-end clarity loss)
- Warping/wow/flutter (low-end mud)

### Preset System

**Factory Presets:**
1. **Factory Standard** - Default balanced settings
2. **Clean Groove** - Low wear, minimal processing
3. **Shellac 78 Collector** - Heavy restoration for 78 RPM records
4. **Modern House 12"** - Punchy club vinyl with enhanced bass/air

**User Presets:**
- Save current settings with custom name
- Stored in localStorage: `fixtrax_user_presets`
- Load/delete via preset dropdown

**AI Mode:**
- Auto-applies AI suggestions on track load
- `autoReviveMode: true` enables automatic AI analysis
- AI-derived profiles marked with `isAiMode: true`

### State Management

**LocalStorage persistence:**
- User presets: `fixtrax_user_presets`
- Current settings: `fixtrax_current_settings`
- Tracks: Not persisted (session-only)

**Track states:**
- `idle` - Newly loaded, not processed
- `analyzing` - AI analysis in progress
- `processing` - Audio processing active
- `done` - Processed, ready for playback/export
- `error` - Processing/analysis failed

### Audio Settings Interface

```typescript
interface AudioSettings {
  // Restoration (Module 01)
  hissSuppression: number;       // 0-100
  crackleSuppression: number;    // 0-100
  clickFiltering: number;        // 0-100 (not yet active)
  clickSensitivity: number;      // 0-100
  clickIntensity: number;        // 0-100
  humRemoval: boolean;
  humFrequency: number;          // 45-75 Hz
  humQ: number;                  // 5-50
  transientRecovery: number;     // 0-100
  spectralSynth: number;         // 0-100 (high-freq reconstruction)
  deReverb: number;              // 0-100 (sustain reduction)
  
  // Tone & Color (Module 02)
  bassBoost: number;             // -10 to +10 dB
  midGain: number;               // -10 to +10 dB
  airGain: number;               // -10 to +10 dB
  warmth: number;                // 0-100 (saturation)
  
  // Stereo & Spatial (Module 03)
  stereoWidth: number;           // 0-200% (100% neutral)
  monoToggle: boolean;           // Phase/mono check
  
  // Master
  masterGain: number;            // -20 to +6 dB
  limiterThreshold: number;      // -20 to 0 dB
  
  // Control Logic
  isAiMode: boolean;             // AI-derived profile
  autoReviveMode: boolean;       // Auto-apply AI on load
  aiInsight?: string;            // AI diagnostic text
}
```

## Key Conventions

### Environment Variables

**Development (.env.local):**
```bash
VITE_PROXY_URL=https://gemini-proxy-572556903588.us-central1.run.app
```

**Security:**
- NO API keys in client code
- All Gemini calls routed through proxy server
- Proxy handles authentication server-side
- See DEPLOYMENT_GUIDE.md for security migration details

### TypeScript Configuration

- Target: `ES2022`
- Experimental decorators enabled
- `useDefineForClassFields: false`
- Path alias: `@/*` maps to project root
- Module resolution: `bundler`
- JSX: `react-jsx`

### Web Audio API Patterns

**Signal chain setup:**
1. Create AudioContext (44.1kHz sample rate)
2. Create all nodes at initialization
3. Connect nodes in series/parallel
4. Update parameters on settings change
5. No reconnection - only parameter updates

**Key nodes:**
- `BiquadFilterNode` - All EQ and filtering
- `WaveShaperNode` - Saturation/harmonic generation
- `DynamicsCompressorNode` - Limiting, gating, recovery
- `GainNode` - Volume, mixing, M/S processing
- `AnalyserNode` - Visualization data

**M/S Processing:**
```typescript
// Split stereo → Process Mid/Side separately → Merge back
splitter → midGainNode → merger
        → sideGainNode →
```

**Dry/Wet Monitoring:**
- `dryGain` - Original signal
- `wetGain` - Processed signal
- Toggle between for A/B comparison

### Export Workflow

**Export formats:**
- WAV (lossless, large files)
- MP3 (lossy, smaller files - not yet implemented)

**Export process:**
1. User clicks "Export Processed"
2. AudioEngine renders track with current settings
3. `processAndExport(buffer, settings)` creates offline context
4. Applies all processing offline (faster than real-time)
5. Converts to WAV using `audioBufferToWav()`
6. Downloads via blob URL

### Proxy Architecture

**proxyService.ts:**
- Routes Gemini API calls through secure proxy
- Default URL: `https://gemini-proxy-572556903588.us-central1.run.app`
- Prevents API key exposure in client

**Endpoints:**
- `/v1/generate` - Content generation
- `/health` - Health check

**Request format:**
```typescript
{
  model: "gemini-3-flash-preview",
  prompt: string,
  systemInstruction?: string,
  responseMimeType?: string,
  responseSchema?: object
}
```

### Build System

**Build ID:**
- Unique identifier: `360ecd57-f101-4133-bfef-1b220036db94`
- Included in AI prompts for versioning
- Helps track which build generated AI profiles

## Deployment

### Docker + nginx

**Dockerfile:**
- Multi-stage build (Node builder + nginx)
- Vite build → `/usr/share/nginx/html`
- nginx on port 8080 (Cloud Run standard)

**nginx.conf:**
- SPA routing (all routes → index.html)
- Static file serving
- MIME types for audio files

### Cloud Run

**cloudbuild.yaml:**
- Automated builds on push
- Deploy to Cloud Run
- Environment variables for proxy URL

**Production setup:**
```bash
npm run build
docker build -t fixtrax .
docker run -p 8080:8080 fixtrax
```

### Security Migration

**DEPLOYMENT_GUIDE.md documents:**
- Migration from exposed API keys to proxy pattern
- Step-by-step deployment instructions
- Git history cleanup for leaked secrets
- Verification checklist

**Key security changes:**
- ❌ Removed: `process.env.API_KEY` from vite.config.ts
- ✅ Added: `VITE_PROXY_URL` environment variable
- ✅ Added: `.env` files to .gitignore
- ✅ Updated: All API calls use proxyService

## Audio Processing Details

### Hiss Suppression

**Technique:** Peaking filter with negative gain at hiss frequency
- Frequency: 11.5kHz (typical vinyl hiss spectrum peak)
- Q: 1.6 (moderate bandwidth)
- Gain: Controlled by `hissSuppression` parameter

### Crackle Suppression

**Technique:** Peaking filter targeting surface noise
- Frequency: 3.2kHz (rhythmic dust/crackle artifacts)
- Q: 4.0 (narrow targeting)
- Gain: Controlled by `crackleSuppression` parameter

### Transient Recovery

**Technique:** Dynamics compression with specific ratio/attack/release
- Compensates for dull needles or worn grooves
- Restores "snap" to transients
- Controlled by `transientRecovery` parameter

### Spectral Synthesis

**Technique:** High-frequency excitation (harmonic regeneration)
- Frequency: 15.5kHz (ultra-high harmonics)
- Reconstructs lost high-order harmonics from mechanical transfer
- Controlled by `spectralSynth` parameter

### Stereo Width

**Technique:** M/S (Mid-Side) processing
- Mid = (L+R) / 2
- Side = (L-R) / 2
- Adjust side gain to widen/narrow stereo field
- 100% = neutral, >100% = wider, <100% = narrower

### Warmth (Saturation)

**Technique:** WaveShaper with soft-clipping curve
- Adds harmonic distortion
- Simulates analog warmth
- Controlled by `warmth` parameter

## Important Notes

- **Project root**: `/Users/stephenbeale/Projects/FixTrax/`
- **Build ID**: `360ecd57-f101-4133-bfef-1b220036db94`
- **Proxy dependency**: Requires proxy server for AI features
- **Web Audio API**: All processing client-side, no server upload
- **Sample rate**: 44.1kHz (CD quality)
- **Browser compatibility**: Requires modern browser with Web Audio API support
- **File size**: Large files may cause memory issues (browser limitation)
- **Real-time processing**: Some settings may introduce latency on slower systems
- **Export**: Currently WAV only, MP3 export planned but not implemented
- **Click filtering**: Parameter exists but filtering algorithm not yet implemented
- **Security**: Migrated to proxy pattern - see DEPLOYMENT_GUIDE.md
