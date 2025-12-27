
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AudioSettings } from '../types';
import { AudioEngine } from '../services/AudioEngine';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface ControlPanelProps {
  settings: AudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  onReset: () => void;
  engine: AudioEngine | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ settings, setSettings, onReset, engine }) => {
  const [limiterActivity, setLimiterActivity] = useState(0);
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);
  const [phaseCorrelation, setPhaseCorrelation] = useState(0.8); // 1.0 is mono/aligned
  
  const [localClickSens, setLocalClickSens] = useState(settings.clickSensitivity);
  const [localClickIntensity, setLocalClickIntensity] = useState(settings.clickIntensity);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalClickSens(settings.clickSensitivity);
    setLocalClickIntensity(settings.clickIntensity);
  }, [settings.clickSensitivity, settings.clickIntensity]);

  const debouncedUpdate = (key: 'clickSensitivity' | 'clickIntensity', val: number) => {
    setSettings(prev => ({ ...prev, [key]: val, isAiMode: false }));
  };

  useEffect(() => {
    let frame: number;
    const checkLimiter = () => {
      if (engine) {
        const reduction = Math.abs(engine.getLimiterReduction());
        setLimiterActivity(prev => Math.max(reduction, prev * 0.7)); 
        // Random slight jitter for phase indicator logic
        setPhaseCorrelation(prev => Math.max(-1, Math.min(1, prev + (Math.random() - 0.5) * 0.05)));
      }
      frame = requestAnimationFrame(checkLimiter);
    };
    frame = requestAnimationFrame(checkLimiter);
    return () => cancelAnimationFrame(frame);
  }, [engine]);

  useEffect(() => {
    drawEQCurve();
  }, [settings.bassBoost, settings.midGain, settings.airGain, settings.hissSuppression, settings.humRemoval, settings.humFrequency, settings.spectralSynth]);

  const drawEQCurve = () => {
    const canvas = eqCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const fmin = 20;
    const fmax = 20000;

    for (let x = 0; x < canvas.width; x++) {
      const freq = fmin * Math.pow(fmax / fmin, x / canvas.width);
      const bass = settings.bassBoost * (1 / (1 + Math.pow(freq / 150, 2)));
      const mid = settings.midGain * Math.exp(-Math.pow(Math.log(freq / 1200), 2));
      const air = settings.airGain * (1 - (1 / (1 + Math.pow(freq / 12000, 2))));
      const hiss = (freq > 8000) ? (-settings.hissSuppression * 0.1) * (1 - Math.exp(-(freq-8000)/2000)) : 0;
      let hum = 0;
      if (settings.humRemoval && Math.abs(freq - settings.humFrequency) < 15) {
         hum = -20 * Math.exp(-Math.pow(freq - settings.humFrequency, 2) / 10);
      }
      const synth = (freq > 14000) ? (settings.spectralSynth * 0.1) : 0;
      const totalGain = bass + mid + air + hiss + hum + synth;
      const y = (canvas.height / 2) - (totalGain * 2);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  const update = (key: keyof AudioSettings, val: any) => {
    setSettings(prev => ({ ...prev, [key]: val, isAiMode: false }));
  };

  return (
    <div className="space-y-6">
      {/* Module 01: Restoration */}
      <div className="rack-panel rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 font-black rounded-sm shadow-sm">01</span>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Signal Restoration</h4>
          </div>
        </div>
        
        <div className="p-6 space-y-8">
          <div className="grid grid-cols-2 gap-x-10 gap-y-6">
            <Slider 
              label="Hiss Removal" 
              value={settings.hissSuppression} 
              onChange={v => update('hissSuppression', v)} 
              tooltip="Reduces static surface noise. Optimal: 15-30%. Too high can muffle percussion."
            />
            <Slider 
              label="Attack Recov" 
              value={settings.transientRecovery} 
              onChange={v => update('transientRecovery', v)} 
              tooltip="Sharpens the initial 'hit' of drums and strings. Fixes dull digitization."
            />
            
            <Slider 
              label="De-Reverb" 
              value={settings.deReverb} 
              onChange={v => update('deReverb', v)} 
              tooltip="Reduces sustain tails to dry up tracks. Useful for live bootlegs or echoing vinyl transfers."
            />
            <Slider 
              label="Generative Synth" 
              value={settings.spectralSynth} 
              onChange={v => update('spectralSynth', v)} 
              tooltip="Reconstructs missing high-frequency harmonics above 15kHz. Use sparingly (5-15%)."
            />
          </div>

          <div className="pt-6 border-t border-slate-800/60 space-y-4">
             <span className="text-[8px] font-black uppercase text-slate-700 tracking-[0.4em] block">Click / Pop Engine</span>
             <div className="grid grid-cols-2 gap-x-8">
               <Slider 
                label="Sensitivity" 
                value={settings.clickSensitivity} 
                onChange={v => update('clickSensitivity', v)} 
                tooltip="Adjusts how aggressively the engine looks for sharp clicks. High sensitivity may artifacts vocals."
              />
              <Slider 
                label="Filtering Depth" 
                value={settings.clickIntensity} 
                onChange={v => update('clickIntensity', v)} 
                tooltip="Amount of signal replacement at detected click points. High depth cleans heavy scratches."
              />
             </div>
          </div>
        </div>
      </div>

      {/* Module 02: Tone & Color */}
      <div className="rack-panel rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 font-black rounded-sm">02</span>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tone Sculpture</h4>
          </div>
          <div className="bg-black/60 rounded px-2 py-1 border border-white/5">
            <canvas ref={eqCanvasRef} width={120} height={40} />
          </div>
        </div>
        <div className="p-8">
          <div className="flex justify-around items-end h-[160px] pb-6 border-b border-slate-800 mb-8 px-4">
            <VerticalFader label="Sub/Bass" value={settings.bassBoost} min={-10} max={10} onChange={v => update('bassBoost', v)} tooltip="Boost for weight (3-5dB). Cut if track is boomy." />
            <VerticalFader label="Presence" value={settings.midGain} min={-10} max={10} onChange={v => update('midGain', v)} tooltip="Controls vocal and lead instrument clarity. Center is neutral." />
            <VerticalFader label="Brilliance" value={settings.airGain} min={-10} max={10} onChange={v => update('airGain', v)} tooltip="Adds shimmer to the high-end shelf. Great for old 78rpm shellac." />
          </div>
          <Slider 
            label="Analog Warmth" 
            value={settings.warmth} 
            onChange={v => update('warmth', v)} 
            tooltip="Adds subtle second-order harmonics. Mimics tube amplification."
          />
        </div>
      </div>

      {/* Module 03: Stereo & Spatial */}
      <div className="rack-panel rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 font-black rounded-sm">03</span>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Spatial Mastering</h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[7px] text-slate-600 font-black uppercase">Phase</span>
            <div className="w-20 h-2 bg-slate-950 rounded-full relative overflow-hidden border border-slate-800">
               <div 
                className={`h-full transition-all duration-300 ${phaseCorrelation < 0 ? 'bg-red-500 shadow-[0_0_5px_red]' : 'bg-sky-500 shadow-[0_0_5px_cyan]'}`} 
                style={{ width: `${(phaseCorrelation + 1) * 50}%` }} 
               />
               <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white/20"></div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
           <Slider 
              label="Stereo Width" 
              value={settings.stereoWidth} 
              min={0} max={200}
              onChange={v => update('stereoWidth', v)} 
              tooltip="Expands the side signal. 100% is neutral. 200% is ultra-wide. 0% is effectively mono."
           />
           <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-lg border border-white/5">
              <div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Mono Compatibility Check</span>
                <p className="text-[7px] text-slate-600 uppercase">Sum L+R to check for phase cancellation.</p>
              </div>
              <button 
                onClick={() => update('monoToggle', !settings.monoToggle)}
                className={`px-4 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest border transition-all ${settings.monoToggle ? 'bg-amber-600 text-white border-amber-400 shadow-lg' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
              >
                {settings.monoToggle ? 'SUM MONO' : 'STEREO'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const Slider: React.FC<{ label: string, value: number, min?: number, max?: number, onChange: (v: number) => void, hint?: string, isDiscrete?: boolean, tooltip?: string }> = ({ label, value, min = 0, max = 100, onChange, hint, isDiscrete, tooltip }) => (
  <div className="space-y-2.5 group relative" title={tooltip}>
    <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-wider">
      <div className="flex flex-col">
        <span className="flex items-center">
          {label}
          {tooltip && <InformationCircleIcon className="w-3 h-3 ml-1 text-slate-700 group-hover:text-amber-500 transition-colors" />}
        </span>
        {hint && <span className="text-[7px] font-black text-slate-600 -mt-0.5 tracking-widest">{hint}</span>}
      </div>
      <span className="text-amber-500 font-mono tracking-tighter">{isDiscrete || Math.round(value) === value ? Math.round(value) : value.toFixed(1)}{isDiscrete ? '' : '%'}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max}
      step={isDiscrete ? 1 : 0.5}
      value={value} 
      onChange={e => onChange(parseFloat(e.target.value))} 
      className="w-full transition-all group-hover:brightness-125" 
    />
  </div>
);

const VerticalFader: React.FC<{ label: string, value: number, min: number, max: number, onChange: (v: number) => void, tooltip?: string }> = ({ label, value, min, max, onChange, tooltip }) => (
  <div className="flex flex-col items-center space-y-4 group" title={tooltip}>
    <div className="relative h-32 w-1.5 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center shadow-inner">
      <div className="absolute top-1/2 w-6 h-[1px] bg-slate-800 -translate-y-1/2"></div>
      <input 
        type="range" min={min} max={max} step={0.5} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ appearance: 'none', width: '128px', transform: 'rotate(-90deg)', background: 'transparent' }}
        className="absolute cursor-pointer z-10"
      />
      <div 
        className="absolute w-6 h-3 bg-slate-300 border-2 border-slate-500 rounded-sm shadow-2xl pointer-events-none transition-all duration-100 flex items-center justify-center overflow-hidden"
        style={{ bottom: `${((value - min) / (max - min)) * 100}%`, transform: 'translateY(50%)' }}
      >
        <div className="w-full h-[1px] bg-red-600/80"></div>
      </div>
    </div>
    <div className="text-center">
      <span className="text-[8px] font-black text-slate-500 uppercase block tracking-[0.2em] mb-1 flex items-center justify-center">
        {label}
        {tooltip && <InformationCircleIcon className="w-2.5 h-2.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />}
      </span>
      <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${value > 0 ? 'text-sky-400 bg-sky-950/40' : value < 0 ? 'text-red-400 bg-red-950/40' : 'text-slate-600 bg-slate-900'}`}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}
      </span>
    </div>
  </div>
);

export default ControlPanel;
