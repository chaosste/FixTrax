
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
    dynamics: DynamicsCompressorNode;
    limiter: DynamicsCompressorNode;
    masterGain: GainNode;
    analyzer: AnalyserNode;
  } | null = null;

  private monitorMode: 'dry' | 'wet' = 'wet';

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.setupSignalChain();
  }

  private setupSignalChain() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const input = ctx.createGain();
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    
    // Initial monitoring state
    dryGain.gain.value = 0;
    wetGain.gain.value = 1;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highshelf';
    
    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'peaking';

    const humNotch = ctx.createBiquadFilter();
    humNotch.type = 'notch';

    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowshelf';

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'highshelf';

    const spectralExciter = ctx.createBiquadFilter();
    spectralExciter.type = 'peaking';
    spectralExciter.frequency.value = 15000;
    spectralExciter.gain.value = 0;

    const saturator = ctx.createWaveShaper();
    saturator.curve = this.makeWarmthCurve(0);

    const dynamics = ctx.createDynamicsCompressor();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -0.5;

    const masterGain = ctx.createGain();
    const analyzer = ctx.createAnalyser();

    // DUAL PATH ARCHITECTURE
    // Dry Path
    input.connect(dryGain);
    dryGain.connect(masterGain);

    // Wet Path (Restoration Chain)
    input.connect(hissFilter);
    hissFilter.connect(crackleFilter);
    crackleFilter.connect(humNotch);
    humNotch.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(airFilter);
    airFilter.connect(spectralExciter);
    spectralExciter.connect(saturator);
    saturator.connect(dynamics);
    dynamics.connect(wetGain);
    wetGain.connect(limiter);
    limiter.connect(masterGain);

    masterGain.connect(analyzer);
    analyzer.connect(ctx.destination);

    this.nodes = {
      input, dryGain, wetGain, hissFilter, crackleFilter, humNotch, bassFilter, 
      midFilter, airFilter, spectralExciter, saturator, dynamics, limiter, masterGain, analyzer
    };
  }

  private makeWarmthCurve(amount: number) {
    const k = amount * 0.4;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public setMonitorMode(mode: 'dry' | 'wet') {
    if (!this.nodes || !this.ctx) return;
    this.monitorMode = mode;
    const now = this.ctx.currentTime;
    // Crossfade for smooth comparison
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
    if (!this.nodes) return;
    const n = this.nodes;
    n.hissFilter.gain.setTargetAtTime(-settings.hissSuppression * 0.18, this.ctx!.currentTime, 0.01);
    n.crackleFilter.frequency.setTargetAtTime(2000 + (settings.clickSensitivity * 50), this.ctx!.currentTime, 0.01);
    n.crackleFilter.gain.setTargetAtTime(-(settings.crackleSuppression * (settings.clickIntensity / 100) * 0.3), this.ctx!.currentTime, 0.01);
    n.humNotch.frequency.setTargetAtTime(settings.humRemoval ? settings.humFrequency : 0.1, this.ctx!.currentTime, 0.01);
    n.bassFilter.gain.setTargetAtTime(settings.bassBoost, this.ctx!.currentTime, 0.01);
    n.midFilter.gain.setTargetAtTime(settings.midGain, this.ctx!.currentTime, 0.01);
    n.airFilter.gain.setTargetAtTime(settings.airGain, this.ctx!.currentTime, 0.01);
    n.spectralExciter.gain.setTargetAtTime(settings.spectralSynth * 0.15, this.ctx!.currentTime, 0.01);
    n.saturator.curve = this.makeWarmthCurve(settings.warmth);
    n.masterGain.gain.setTargetAtTime(Math.pow(10, settings.masterGain / 20), this.ctx!.currentTime, 0.01);
  }

  public getAnalyzer() { return this.nodes?.analyzer; }
  
  public getLimiterReduction(): number {
    return this.nodes?.limiter.reduction || 0;
  }

  public async exportMaster(buffer: AudioBuffer, settings: AudioSettings): Promise<Blob> {
    const offlineCtx = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // Replication of the Wet Signal Path
    const hiss = offlineCtx.createBiquadFilter();
    hiss.type = 'highshelf';
    hiss.frequency.value = 8000;
    hiss.gain.value = -settings.hissSuppression * 0.18;

    const crackle = offlineCtx.createBiquadFilter();
    crackle.type = 'peaking';
    crackle.frequency.value = 2000 + (settings.clickSensitivity * 50);
    crackle.gain.value = -(settings.crackleSuppression * (settings.clickIntensity / 100) * 0.3);

    const hum = offlineCtx.createBiquadFilter();
    hum.type = 'notch';
    hum.frequency.value = settings.humRemoval ? settings.humFrequency : 0.1;
    hum.Q.value = settings.humQ;

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
    spectral.gain.value = settings.spectralSynth * 0.15;

    const sat = offlineCtx.createWaveShaper();
    sat.curve = this.makeWarmthCurve(settings.warmth);

    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = -12 - (settings.transientRecovery * 0.15);

    const lim = offlineCtx.createDynamicsCompressor();
    lim.threshold.value = -0.1;

    const master = offlineCtx.createGain();
    master.gain.value = Math.pow(10, settings.masterGain / 20);

    source.connect(hiss);
    hiss.connect(crackle);
    crackle.connect(hum);
    hum.connect(bass);
    bass.connect(mid);
    mid.connect(air);
    air.connect(spectral);
    spectral.connect(sat);
    sat.connect(comp);
    comp.connect(lim);
    lim.connect(master);
    master.connect(offlineCtx.destination);

    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    
    // Safety Gain Staging
    let maxVal = 0;
    for (let c = 0; c < renderedBuffer.numberOfChannels; c++) {
      const data = renderedBuffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxVal) maxVal = abs;
      }
    }
    if (maxVal > 0.98) {
      const factor = 0.98 / maxVal;
      for (let c = 0; c < renderedBuffer.numberOfChannels; c++) {
        const data = renderedBuffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) data[i] *= factor;
      }
    }

    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
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
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), intSample, true);
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}
