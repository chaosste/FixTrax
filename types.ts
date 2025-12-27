
export interface AudioSettings {
  // Restoration (Module 01)
  hissSuppression: number;   // 0-100
  crackleSuppression: number; // 0-100
  clickFiltering: number;    // 0-100
  clickSensitivity: number;  // 0-100
  clickIntensity: number;    // 0-100
  humRemoval: boolean;
  humFrequency: number;      // 45-75 Hz
  humQ: number;              // 5-50
  transientRecovery: number; // 0-100
  spectralSynth: number;     // 0-100 (Generative high-frequency reconstruction)
  
  // Tone & Color (Module 02)
  bassBoost: number;         // -10 to +10 dB
  midGain: number;           // -10 to +10 dB
  airGain: number;           // -10 to +10 dB (High shelf)
  warmth: number;            // 0-100 (Saturation)
  
  // Master
  masterGain: number;        // -20 to +6 dB
  limiterThreshold: number;  // -20 to 0 dB
  
  // UI/Control Logic
  isAiMode: boolean;         // Active profile is AI-derived
  autoReviveMode: boolean;   // If true, auto-apply AI suggestions on load
  aiInsight?: string;
}

export interface Preset {
  id: string;
  name: string;
  settings: AudioSettings;
}

export interface Track {
  id: string;
  name: string;
  originalBlob: Blob;
  originalBuffer?: AudioBuffer;
  processedUrl?: string;
  status: 'idle' | 'analyzing' | 'processing' | 'done' | 'error';
  aiProfile?: Partial<AudioSettings>;
}

export enum ExportFormat {
  MP3 = 'MP3',
  WAV = 'WAV'
}
