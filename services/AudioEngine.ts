
import { AudioSettings } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private nodes: {
    input: GainNode;
    dryGain: GainNode;
    wetGain: GainNode;
    hissFilter: BiquadFilterNode;
    crackleFilter: BiquadFilterNode;
    humNotch: BiquadFilterNode;
    bassFilter: BiquadFilterNode;
    midFilter: BiquadFilterNode;
    airFilter: BiquadFilterNode;
    spectralExciter: BiquadFilterNode;
    saturator: WaveShaperNode;
    deReverbGate: DynamicsCompressorNode;
    dynamics: DynamicsCompressorNode;
    // Stereo Width Processor
    splitter: ChannelSplitterNode;
    midGainNode: GainNode;
    sideGainNode: GainNode;
    merger: ChannelMergerNode;
    limiter: DynamicsCompressorNode;
    masterGain: GainNode;
    analyzer: AnalyserNode;
  } | null = null;

  private monitorMode: 'dry' | 'wet' = 'wet';

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
    this.setupSignalChain();
  }

  private setupSignalChain() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const input = ctx.createGain();
    input.gain.value = 0.7; // Pre-gain reduction to prevent internal clipping

    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    
    dryGain.gain.value = 0;
    wetGain.gain.value = 1;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highshelf';
    hissFilter.frequency.value = 8000;
    
    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'peaking';

    const humNotch = ctx.createBiquadFilter();
    humNotch.type = 'notch';
    humNotch.Q.value = 10;

    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 150;

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1200;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'highshelf';
    airFilter.frequency.value = 12000;

    const spectralExciter = ctx.createBiquadFilter();
    spectralExciter.type = 'peaking';
    spectralExciter.frequency.value = 15000;

    const saturator = ctx.createWaveShaper();
    saturator.curve = this.makeWarmthCurve(0);

    // De-Reverb (Sustain reduction via fast-release compression)
    const deReverbGate = ctx.createDynamicsCompressor();
    deReverbGate.threshold.value = -30;
    deReverbGate.ratio.value = 1; 
    deReverbGate.attack.value = 0.003;
    deReverbGate.release.value = 0.05;

    const dynamics = ctx.createDynamicsCompressor();
    dynamics.threshold.value = -18;
    dynamics.ratio.value = 2;

    // Stereo Width M/S Processing simulation
    const splitter = ctx.createChannelSplitter(2);
    const midGainNode = ctx.createGain();
    const sideGainNode = ctx.createGain();
    const merger = ctx.createChannelMerger(2);

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -0.5;
    limiter.ratio.value = 20;
    limiter.knee.value = 0;

    const masterGain = ctx.createGain();
    const analyzer = ctx.createAnalyser();

    // Signal Routing
    input.connect(dryGain);
    dryGain.connect(masterGain);

    input.connect(hissFilter);
    hissFilter.connect(crackleFilter);
    crackleFilter.connect(humNotch);
    humNotch.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(airFilter);
    airFilter.connect(spectralExciter);
    spectralExciter.connect(saturator);
    saturator.connect(deReverbGate);
    deReverbGate.connect(dynamics);
    dynamics.connect(wetGain);

    // Stereo Processing
    wetGain.connect(splitter);
    splitter.connect(midGainNode, 0); 
    splitter.connect(sideGainNode, 1); 
    
    // M/S Routing (Simplified for Web Audio Stereo expansion)
    midGainNode.connect(merger, 0, 0);
    midGainNode.connect(merger, 0, 1);
    sideGainNode.connect(merger, 0, 0);
    sideGainNode.connect(merger, 0, 1); 

    merger.connect(limiter);
    limiter.connect(masterGain);

    masterGain.connect(analyzer);
    analyzer.connect(ctx.destination);

    this.nodes = {
      input, dryGain, wetGain, hissFilter, crackleFilter, humNotch, bassFilter, 
      midFilter, airFilter, spectralExciter, saturator, deReverbGate, dynamics,
      splitter, midGainNode, sideGainNode, merger, limiter, masterGain, analyzer
    };
  }

  private makeWarmthCurve(amount: number) {
    const k = amount * 0.25; // Adjusted down to prevent distortion
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Soft sigmoid for warmth
      curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public setMonitorMode(mode: 'dry' | 'wet') {
    if (!this.nodes || !this.ctx) return;
    this.monitorMode = mode;
    const now = this.ctx.currentTime;
    if (mode === 'dry') {
      this.nodes.dryGain.gain.setTargetAtTime(1, now, 0.02);
      this.nodes.wetGain.gain.setTargetAtTime(0, now, 0.02);
    } else {
      this.nodes.dryGain.gain.setTargetAtTime(0, now, 0.02);
      this.nodes.wetGain.gain.setTargetAtTime(1, now, 0.02);
    }
  }

  public async loadAudio(blob: Blob): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return await this.ctx!.decodeAudioData(arrayBuffer);
  }

  public play(buffer: AudioBuffer, startTime: number = 0) {
    if (!this.ctx || !this.nodes) return;
    this.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.connect(this.nodes.input);
    this.source.start(0, startTime);
  }

  public stop() {
    if (this.source) {
      try { this.source.stop(); } catch(e) {}
      this.source = null;
    }
  }

  public updateSettings(settings: AudioSettings) {
    if (!this.nodes || !this.ctx) return;
    const n = this.nodes;
    const now = this.ctx.currentTime;
    
    n.hissFilter.gain.setTargetAtTime(-settings.hissSuppression * 0.15, now, 0.02);
    n.crackleFilter.frequency.setTargetAtTime(2000 + (settings.clickSensitivity * 50), now, 0.02);
    n.crackleFilter.gain.setTargetAtTime(-(settings.crackleSuppression * (settings.clickIntensity / 100) * 0.3), now, 0.02);
    
    n.humNotch.frequency.setTargetAtTime(settings.humRemoval ? settings.humFrequency : 0.01, now, 0.02);
    
    n.bassFilter.gain.setTargetAtTime(settings.bassBoost, now, 0.02);
    n.midFilter.gain.setTargetAtTime(settings.midGain, now, 0.02);
    n.airFilter.gain.setTargetAtTime(settings.airGain, now, 0.02);
    n.spectralExciter.gain.setTargetAtTime(settings.spectralSynth * 0.1, now, 0.02);
    
    // De-Reverb intensity (increase compression ratio for tails)
    n.deReverbGate.ratio.setTargetAtTime(1 + (settings.deReverb * 0.15), now, 0.02);
    
    // Stereo Width logic
    const width = settings.stereoWidth / 100;
    n.midGainNode.gain.setTargetAtTime(settings.monoToggle ? 0.5 : 1.0, now, 0.02);
    n.sideGainNode.gain.setTargetAtTime(settings.monoToggle ? 0.5 : width, now, 0.02);
    
    n.saturator.curve = this.makeWarmthCurve(settings.warmth);
    n.masterGain.gain.setTargetAtTime(Math.pow(10, settings.masterGain / 20), now, 0.02);
  }

  public getAnalyzer() { return this.nodes?.analyzer; }
  
  public getLimiterReduction(): number {
    return this.nodes?.limiter.reduction || 0;
  }

  public async exportMaster(buffer: AudioBuffer, settings: AudioSettings): Promise<Blob> {
    const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // Replication of the live path for bit-accurate export
    const hiss = offlineCtx.createBiquadFilter();
    hiss.type = 'highshelf'; hiss.frequency.value = 8000;
    hiss.gain.value = -settings.hissSuppression * 0.15;

    const crackle = offlineCtx.createBiquadFilter();
    crackle.type = 'peaking';
    crackle.frequency.value = 2000 + (settings.clickSensitivity * 50);
    crackle.gain.value = -(settings.crackleSuppression * (settings.clickIntensity / 100) * 0.3);

    const bass = offlineCtx.createBiquadFilter();
    bass.type = 'lowshelf'; bass.frequency.value = 150;
    bass.gain.value = settings.bassBoost;

    const mid = offlineCtx.createBiquadFilter();
    mid.type = 'peaking'; mid.frequency.value = 1200;
    mid.gain.value = settings.midGain;

    const air = offlineCtx.createBiquadFilter();
    air.type = 'highshelf'; air.frequency.value = 12000;
    air.gain.value = settings.airGain;

    const spectral = offlineCtx.createBiquadFilter();
    spectral.type = 'peaking'; spectral.frequency.value = 15000;
    spectral.gain.value = settings.spectralSynth * 0.1;

    const sat = offlineCtx.createWaveShaper();
    sat.curve = this.makeWarmthCurve(settings.warmth);

    const rev = offlineCtx.createDynamicsCompressor();
    rev.threshold.value = -30;
    rev.ratio.value = 1 + (settings.deReverb * 0.15);

    const lim = offlineCtx.createDynamicsCompressor();
    lim.threshold.value = -0.5;

    const master = offlineCtx.createGain();
    master.gain.value = Math.pow(10, settings.masterGain / 20) * 0.8; // Headroom safety

    source.connect(hiss);
    hiss.connect(crackle);
    crackle.connect(bass);
    bass.connect(mid);
    mid.connect(air);
    air.connect(spectral);
    spectral.connect(sat);
    sat.connect(rev);
    rev.connect(lim);
    lim.connect(master);
    master.connect(offlineCtx.destination);

    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * blockAlign;
    const fileSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(fileSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, fileSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}
