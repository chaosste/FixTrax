
import { AudioSettings } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private nodes: {
    gainStaging: GainNode;
    hissFilter: BiquadFilterNode;
    crackleFilter: BiquadFilterNode;
    bassFilter: BiquadFilterNode;
    midFilter: BiquadFilterNode;
    airFilter: BiquadFilterNode;
    saturator: WaveShaperNode;
    dynamics: DynamicsCompressorNode;
    limiter: DynamicsCompressorNode;
    masterGain: GainNode;
    analyzer: AnalyserNode;
  } | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.setupSignalChain();
  }

  private setupSignalChain() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const gainStaging = ctx.createGain();
    gainStaging.gain.value = 0.707;

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highshelf';
    hissFilter.frequency.value = 8000;

    const crackleFilter = ctx.createBiquadFilter();
    crackleFilter.type = 'peaking';
    crackleFilter.frequency.value = 3500;
    crackleFilter.Q.value = 1.5;

    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 150;

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1200;
    midFilter.Q.value = 0.8;

    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'highshelf';
    airFilter.frequency.value = 12000;

    const saturator = ctx.createWaveShaper();
    saturator.curve = this.makeWarmthCurve(0);

    const dynamics = ctx.createDynamicsCompressor();
    dynamics.threshold.value = -12;
    dynamics.ratio.value = 3;
    dynamics.attack.value = 0.005;
    dynamics.release.value = 0.150;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -0.5;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    const masterGain = ctx.createGain();
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 2048;

    gainStaging.connect(hissFilter);
    hissFilter.connect(crackleFilter);
    crackleFilter.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(airFilter);
    airFilter.connect(saturator);
    saturator.connect(dynamics);
    dynamics.connect(limiter);
    limiter.connect(masterGain);
    masterGain.connect(analyzer);
    analyzer.connect(ctx.destination);

    this.nodes = {
      gainStaging, hissFilter, crackleFilter, bassFilter, midFilter, 
      airFilter, saturator, dynamics, limiter, masterGain, analyzer
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

  public async loadAudio(blob: Blob): Promise<AudioBuffer> {
    const arrayBuffer = await blob.arrayBuffer();
    return await this.ctx!.decodeAudioData(arrayBuffer);
  }

  public play(buffer: AudioBuffer, startTime: number = 0) {
    if (!this.ctx || !this.nodes) return;
    this.stop();
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.connect(this.nodes.gainStaging);
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

    // Adaptive Hiss (Adjusts Q based on intensity to be less muffled at low settings)
    n.hissFilter.gain.value = -settings.hissSuppression * 0.18; 
    n.hissFilter.Q.value = 0.5 + (settings.hissSuppression / 100);

    // Crackle & Sensitivity
    n.crackleFilter.gain.value = -settings.crackleSuppression * 0.12;
    n.crackleFilter.frequency.value = 3500 + (settings.clickSensitivity * 10);
    
    // Tone
    n.bassFilter.gain.value = settings.bassBoost;
    n.midFilter.gain.value = settings.midGain;
    n.airFilter.gain.value = settings.airGain;
    
    // Saturation
    n.saturator.curve = this.makeWarmthCurve(settings.warmth);
    
    // Dynamics
    n.dynamics.threshold.value = -12 - (settings.transientRecovery * 0.15);
    n.dynamics.ratio.value = 2 + (settings.transientRecovery * 0.04);
    
    // Master
    n.masterGain.gain.value = Math.pow(10, settings.masterGain / 20);
  }

  public getAnalyzer() { return this.nodes?.analyzer; }
  
  public getLimiterReduction(): number {
    return this.nodes?.limiter.reduction || 0;
  }

  public async exportMaster(buffer: AudioBuffer, settings: AudioSettings): Promise<Blob> {
    const offlineCtx = new OfflineAudioContext(2, buffer.length, buffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    const gainStaging = offlineCtx.createGain();
    gainStaging.gain.value = 0.707;

    const hiss = offlineCtx.createBiquadFilter();
    hiss.type = 'highshelf';
    hiss.frequency.value = 8000;
    hiss.gain.value = -settings.hissSuppression * 0.18;
    hiss.Q.value = 0.5 + (settings.hissSuppression / 100);

    const bass = offlineCtx.createBiquadFilter();
    bass.type = 'lowshelf'; bass.frequency.value = 150;
    bass.gain.value = settings.bassBoost;

    const mid = offlineCtx.createBiquadFilter();
    mid.type = 'peaking'; mid.frequency.value = 1200;
    mid.gain.value = settings.midGain;

    const air = offlineCtx.createBiquadFilter();
    air.type = 'highshelf'; air.frequency.value = 12000;
    air.gain.value = settings.airGain;

    const sat = offlineCtx.createWaveShaper();
    sat.curve = this.makeWarmthCurve(settings.warmth);

    const comp = offlineCtx.createDynamicsCompressor();
    comp.threshold.value = -12 - (settings.transientRecovery * 0.15);

    const lim = offlineCtx.createDynamicsCompressor();
    lim.threshold.value = -0.1;

    const master = offlineCtx.createGain();
    master.gain.value = Math.pow(10, settings.masterGain / 20);

    source.connect(gainStaging);
    gainStaging.connect(hiss);
    hiss.connect(bass);
    bass.connect(mid);
    mid.connect(air);
    air.connect(sat);
    sat.connect(comp);
    comp.connect(lim);
    lim.connect(master);
    master.connect(offlineCtx.destination);

    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };
    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    
    let p = 0;
    function writeString(s: string) {
      for (let i = 0; i < s.length; i++) {
        view.setUint8(p + i, s.charCodeAt(i));
      }
      p += s.length;
    }

    writeString('RIFF'); p += 0;
    view.setUint32(4, 36 + buffer.length * numOfChan * 2, true); p += 4;
    writeString('WAVE'); p += 4;
    writeString('fmt '); p += 4;
    view.setUint32(16, 16, true); p += 4;
    view.setUint16(20, 1, true); p += 2;
    view.setUint16(22, numOfChan, true); p += 2;
    view.setUint32(24, buffer.sampleRate, true); p += 4;
    view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true); p += 4;
    view.setUint16(32, numOfChan * 2, true); p += 2;
    view.setUint16(34, 16, true); p += 2;
    writeString('data'); p += 4;
    view.setUint32(40, buffer.length * numOfChan * 2, true); p += 4;

    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (p < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
            view.setInt16(p, sample, true);
            p += 2;
        }
        offset++;
    }
    return new Blob([bufferArr], { type: 'audio/wav' });
  }
}
