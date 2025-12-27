
import React, { useEffect, useRef, useState } from 'react';
import { AudioSettings } from '../types';
import { AudioEngine } from '../services/AudioEngine';
import { InformationCircleIcon, SparklesIcon, GlobeAltIcon, SpeakerWaveIcon } from '@heroicons/react/24/outline';

interface ControlPanelProps {
  settings: AudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  onReset: () => void;
  engine: AudioEngine | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ settings, setSettings, onReset, engine }) => {
  const [limiterActivity, setLimiterActivity] = useState(0);
  const eqCanvasRef = useRef<HTMLCanvasElement>(null);
  const [phaseCorrelation, setPhaseCorrelation] = useState(0.85); // High initial correlation
  
  useEffect(() => {
    let frame: number;
    const checkEngine = () => {
      if (engine) {
        const reduction = Math.abs(engine.getLimiterReduction());
        setLimiterActivity(prev => Math.max(reduction, prev * 0.7)); 
        // Simulated phase correlation based on width and slight noise
        const targetPhase = settings.monoToggle ? 1.0 : (1.5 - (settings.stereoWidth / 200));
        setPhaseCorrelation(prev => prev + (targetPhase - prev) * 0.1 + (Math.random() - 0.5) * 0.02);
      }
      frame = requestAnimationFrame(checkEngine);
    };
    frame = requestAnimationFrame(checkEngine);
    return () => cancelAnimationFrame(frame);
  }, [engine, settings.stereoWidth, settings.monoToggle]);

  useEffect(() => {
    drawEQCurve();
  }, [settings]);

  const drawEQCurve = () => {
    const canvas = eqCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const fmin = 20;
    const fmax = 20000;

    for (let x = 0; x < canvas.width; x++) {
      const freq = fmin * Math.pow(fmax / fmin, x / canvas.width);
      const bass = settings.bassBoost * (1 / (1 + Math.pow(freq / 150, 2)));
      const mid = settings.midGain * Math.exp(-Math.pow(Math.log(freq / 1200), 2));
      const air = settings.airGain * (1 - (1 / (1 + Math.pow(freq / 12000, 2))));
      const hiss = (freq > 8000) ? (-settings.hissSuppression * 0.1) : 0;
      
      const totalGain = bass + mid + air + hiss;
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
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Restoration Engine</h4>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <Slider 
              label="Hiss Suppression" 
              value={settings.hissSuppression} 
              onChange={v => update('hissSuppression', v)} 
              tooltip="Reduces continuous static and tape hiss. Recommended: 10-25% for preservation, 40% for heavy restoration."
            />
            <Slider 
              label="Transient Recovery" 
              value={settings.transientRecovery} 
              onChange={v => update('transientRecovery', v)} 
              tooltip="Restores the 'punch' and sharpness of percussion. High values mimic modern commercial compression."
            />
            <Slider 
              label="De-Reverb" 
              value={settings.deReverb} 
              onChange={v => update('deReverb', v)} 
              tooltip="Uses AI to target and reduce room resonance and echoing tails. Essential for muddy vinyl rips."
            />
            <Slider 
              label="Spectral Air" 
              value={settings.spectralSynth} 
              onChange={v => update('spectralSynth', v)} 
              tooltip="Generative high-frequency reconstruction. Rebuilds the harmonics lost above 15kHz."
            />
          </div>
          <div className="pt-4 border-t border-slate-800/50">
            <Slider 
              label="Click Sensitivity" 
              value={settings.clickSensitivity} 
              onChange={v => update('clickSensitivity', v)} 
              tooltip="Controls detection threshold for sharp pops. High values may accidentally catch snare hits."
            />
          </div>
        </div>
      </div>

      {/* Module 02: Tone & Dynamics */}
      <div className="rack-panel rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="bg-slate-900 px-5 py-3 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.5 font-black rounded-sm">02</span>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Tone Sculpture</h4>
          </div>
          <canvas ref={eqCanvasRef} width={100} height={30} className="bg-black/40 rounded border border-white/5" />
        </div>
        <div className="p-8">
          <div className="flex justify-around items-end h-[160px] pb-6 border-b border-slate-800 mb-8 px-4">
            <VerticalFader label="Sub-Bass" value={settings.bassBoost} min={-10} max={10} onChange={v => update('bassBoost', v)} tooltip="Sub-frequency weight. +3dB adds modern club feel." />
            <VerticalFader label="Presence" value={settings.midGain} min={-10} max={10} onChange={v => update('midGain', v)} tooltip="Lead vocal and instrument clarity. Range: -2 to +2dB." />
            <VerticalFader label="Brilliance" value={settings.airGain} min={-10} max={10} onChange={v => update('airGain', v)} tooltip="Ultra-high shelf spark. Vital for bringing old vinyl into the modern era." />
          </div>
          <Slider 
            label="Analog Warmth" 
            value={settings.warmth} 
            onChange={v => update('warmth', v)} 
            tooltip="Subtle harmonic saturation. Keep under 30% for transparency. Above 50% adds visible distortion."
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
            <span className="text-[8px] text-slate-500 font-bold uppercase">Phase</span>
            <div className="w-24 h-2 bg-slate-950 rounded-full relative overflow-hidden border border-slate-800">
               <div 
                className={`h-full transition-all duration-300 ${phaseCorrelation < 0 ? 'bg-red-500 shadow-[0_0_8px_red]' : 'bg-sky-500 shadow-[0_0_8px_cyan]'}`} 
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
              tooltip="Expands the side signal. 100% is neutral. Above 150% risks phase cancellation but creates a huge soundstage."
           />
           <div className="flex items-center justify-between bg-slate-900/40 p-3 rounded-lg border border-white/5">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mono Path Check</span>
                <p className="text-[7px] text-slate-600 uppercase">Check compatibility for club PAs and small speakers.</p>
              </div>
              <button 
                onClick={() => update('monoToggle', !settings.monoToggle)}
                className={`px-4 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest border transition-all ${settings.monoToggle ? 'bg-amber-600 text-white border-amber-400 shadow-lg' : 'bg-slate-800 text-slate-500 border-slate-700'}`}
              >
                {settings.monoToggle ? 'ACTIVE (MONO)' : 'STEREO'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

const Slider: React.FC<{ label: string, value: number, min?: number, max?: number, onChange: (v: number) => void, tooltip: string }> = ({ label, value, min = 0, max = 100, onChange, tooltip }) => (
  <div className="space-y-2 group relative">
    <div className="flex justify-between items-center">
      <div className="flex items-center space-x-1">
        <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{label}</span>
        <div className="relative group/tooltip">
          <InformationCircleIcon className="w-3 h-3 text-slate-700 hover:text-amber-500 transition-colors cursor-help" />
          <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-48 p-2 bg-slate-900 border border-slate-700 rounded text-[8px] font-bold text-slate-300 leading-tight opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
            {tooltip}
          </div>
        </div>
      </div>
      <span className="text-amber-500 font-mono text-[9px] font-bold">{Math.round(value)}%</span>
    </div>
    <input 
      type="range" min={min} max={max} step={1} value={value} 
      onChange={e => onChange(parseFloat(e.target.value))} 
      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
    />
  </div>
);

const VerticalFader: React.FC<{ label: string, value: number, min: number, max: number, onChange: (v: number) => void, tooltip: string }> = ({ label, value, min, max, onChange, tooltip }) => (
  <div className="flex flex-col items-center space-y-3 group relative">
    <div className="relative h-32 w-1 bg-slate-900 rounded-full border border-slate-800 flex items-center justify-center">
      <input 
        type="range" min={min} max={max} step={0.5} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ appearance: 'none', width: '128px', transform: 'rotate(-90deg)', background: 'transparent' }}
        className="absolute cursor-pointer z-10"
      />
      <div 
        className="absolute w-6 h-3 bg-slate-300 border-2 border-slate-500 rounded-sm shadow-xl pointer-events-none transition-all duration-100"
        style={{ bottom: `${((value - min) / (max - min)) * 100}%`, transform: 'translateY(50%)' }}
      >
        <div className="w-full h-[1px] bg-red-600 mt-[4px]"></div>
      </div>
      <div className="absolute left-full ml-4 bottom-0 w-32 p-2 bg-slate-900 border border-slate-700 rounded text-[8px] font-bold text-slate-300 leading-tight opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
        {tooltip}
      </div>
    </div>
    <div className="text-center">
      <span className="text-[8px] font-black text-slate-500 uppercase block tracking-widest">{label}</span>
      <span className={`text-[10px] font-mono font-bold ${value > 0 ? 'text-sky-400' : value < 0 ? 'text-red-400' : 'text-slate-600'}`}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}dB
      </span>
    </div>
  </div>
);

export default ControlPanel;
