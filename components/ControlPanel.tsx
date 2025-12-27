
import React, { useEffect, useRef, useState } from 'react';
import { AudioSettings } from '../types';
import { AudioEngine } from '../services/AudioEngine';

interface ControlPanelProps {
  settings: AudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  onReset: () => void;
  engine: AudioEngine | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ settings, setSettings, onReset, engine }) => {
  const [limiterActivity, setLimiterActivity] = useState(0);
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [localClickSens, setLocalClickSens] = useState(settings.clickSensitivity);
  const [localClickIntensity, setLocalClickIntensity] = useState(settings.clickIntensity);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalClickSens(settings.clickSensitivity);
    setLocalClickIntensity(settings.clickIntensity);
  }, [settings.clickSensitivity, settings.clickIntensity]);

  const debouncedUpdate = (key: 'clickSensitivity' | 'clickIntensity', val: number) => {
    if (key === 'clickSensitivity') setLocalClickSens(val);
    else setLocalClickIntensity(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSettings(prev => ({ ...prev, [key]: val, isAiMode: false }));
    }, 120);
  };

  useEffect(() => {
    let frame: number;
    const checkLimiter = () => {
      if (engine) {
        const reduction = Math.abs(engine.getLimiterReduction());
        setLimiterActivity(prev => Math.max(reduction, prev * 0.7)); // Fast attack, slow release mimic
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
      // Logarithmic Frequency Mapping
      const freq = fmin * Math.pow(fmax / fmin, x / canvas.width);
      
      const bass = settings.bassBoost * (1 / (1 + Math.pow(freq / 150, 2)));
      const mid = settings.midGain * Math.exp(-Math.pow(Math.log(freq / 1200), 2));
      const air = settings.airGain * (1 - (1 / (1 + Math.pow(freq / 12000, 2))));
      
      // Hiss Suppression (simplified visualization)
      const hiss = (freq > 8000) ? (-settings.hissSuppression * 0.1) * (1 - Math.exp(-(freq-8000)/2000)) : 0;
      
      // Hum Notch
      let hum = 0;
      if (settings.humRemoval && Math.abs(freq - settings.humFrequency) < 15) {
         hum = -20 * Math.exp(-Math.pow(freq - settings.humFrequency, 2) / 10);
      }

      // Spectral Synth bump
      const synth = (freq > 14000) ? (settings.spectralSynth * 0.1) : 0;
      
      const totalGain = bass + mid + air + hiss + hum + synth;
      const y = (canvas.height / 2) - (totalGain * 2); // Scale gain to height
      
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Zero-gain axis
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2); ctx.stroke();
    ctx.setLineDash([]);
  };

  const update = (key: keyof AudioSettings, val: any) => {
    setSettings(prev => ({ ...prev, [key]: val, isAiMode: false }));
  };

  return (
    <div className="space-y-6">
      <div className="rack-panel rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 font-black rounded-sm shadow-sm">01</span>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Signal Restoration</h4>
          </div>
          <div className="flex items-center space-x-3 bg-black/40 px-3 py-1 rounded-full border border-white/5">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Master Limit</span>
            <div 
              className={`w-2.5 h-2.5 rounded-full transition-all duration-100 shadow-lg`} 
              style={{ 
                backgroundColor: limiterActivity > 0.5 ? '#f59e0b' : '#1e293b',
                boxShadow: limiterActivity > 0.5 ? `0 0 12px rgba(245,158,11,${limiterActivity/10})` : 'none',
                opacity: 0.2 + (limiterActivity / 10)
              }}
            ></div>
          </div>
        </div>
        
        <div className="p-6 space-y-8">
          <div className="grid grid-cols-2 gap-x-10 gap-y-6">
            <Slider label="Hiss Removal" value={settings.hissSuppression} onChange={v => update('hissSuppression', v)} />
            <Slider label="Attack Recov" value={settings.transientRecovery} onChange={v => update('transientRecovery', v)} hint="Transient Energy" />
            
            <div className="col-span-2 flex items-center space-x-4 py-1">
               <span className="text-[8px] font-black uppercase text-slate-700 tracking-[0.4em] flex-1">Click / Pop Engine</span>
               <div className="h-[1px] bg-slate-800 flex-1"></div>
            </div>
            
            <Slider 
              label="Sensitivity" 
              value={localClickSens} 
              onChange={v => debouncedUpdate('clickSensitivity', v)} 
              hint="Profile Match"
            />
            <Slider 
              label="Filtering Depth" 
              value={localClickIntensity} 
              onChange={v => debouncedUpdate('clickIntensity', v)} 
              hint="Notch Intensity"
            />
          </div>

          <div className="pt-6 border-t border-slate-800/60 grid grid-cols-2 gap-x-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-500 block tracking-widest">Line Hum Notch</span>
                  <p className="text-[7px] text-slate-600 uppercase font-bold">Narrow 50/60Hz Target</p>
                </div>
                <button 
                  onClick={() => update('humRemoval', !settings.humRemoval)}
                  className={`w-10 h-5 rounded-full transition-all relative ${settings.humRemoval ? 'bg-amber-600' : 'bg-slate-800'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings.humRemoval ? 'right-0.5' : 'left-0.5'}`}></div>
                </button>
              </div>
              {settings.humRemoval && (
                <div className="space-y-4 pt-2">
                  <Slider label="Frequency" value={settings.humFrequency} min={45} max={75} onChange={v => update('humFrequency', v)} hint="Hz" isDiscrete />
                  <Slider label="Q-Factor" value={settings.humQ} min={5} max={50} onChange={v => update('humQ', v)} hint="Width" isDiscrete />
                </div>
              )}
            </div>
            <div className="space-y-4 border-l border-slate-800/40 pl-8">
               <span className="text-[9px] font-black uppercase text-slate-500 block tracking-widest">Generative Synth</span>
               <Slider 
                label="Spectral Reconstruction" 
                value={settings.spectralSynth} 
                onChange={v => update('spectralSynth', v)} 
                hint="AI Harmonics"
               />
               <p className="text-[7px] text-slate-600 italic uppercase">Interpolates lost high frequencies from vinyl wear.</p>
            </div>
          </div>
        </div>
      </div>

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
            <VerticalFader label="Sub/Bass" value={settings.bassBoost} min={-10} max={10} onChange={v => update('bassBoost', v)} />
            <VerticalFader label="Presence" value={settings.midGain} min={-10} max={10} onChange={v => update('midGain', v)} />
            <VerticalFader label="Brilliance" value={settings.airGain} min={-10} max={10} onChange={v => update('airGain', v)} />
          </div>
          <Slider label="Analog Warmth" value={settings.warmth} onChange={v => update('warmth', v)} hint="Saturation Knee" />
        </div>
      </div>
    </div>
  );
};

const Slider: React.FC<{ label: string, value: number, min?: number, max?: number, onChange: (v: number) => void, hint?: string, isDiscrete?: boolean }> = ({ label, value, min = 0, max = 100, onChange, hint, isDiscrete }) => (
  <div className="space-y-2.5 group">
    <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-wider">
      <div className="flex flex-col">
        <span>{label}</span>
        {hint && <span className="text-[7px] font-black text-slate-600 -mt-0.5 tracking-widest">{hint}</span>}
      </div>
      <span className="text-amber-500 font-mono tracking-tighter">{isDiscrete ? Math.round(value) : Math.round(value) + '%'}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max}
      step={isDiscrete ? 1 : 0.1}
      value={value} 
      onChange={e => onChange(parseFloat(e.target.value))} 
      className="w-full transition-all group-hover:brightness-125" 
    />
  </div>
);

const VerticalFader: React.FC<{ label: string, value: number, min: number, max: number, onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => (
  <div className="flex flex-col items-center space-y-4">
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
      <span className="text-[8px] font-black text-slate-500 uppercase block tracking-[0.2em] mb-1">{label}</span>
      <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${value > 0 ? 'text-sky-400 bg-sky-950/40' : value < 0 ? 'text-red-400 bg-red-950/40' : 'text-slate-600 bg-slate-900'}`}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}
      </span>
    </div>
  </div>
);

export default ControlPanel;
