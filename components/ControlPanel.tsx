
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

  useEffect(() => {
    let frame: number;
    const checkLimiter = () => {
      if (engine) {
        const reduction = Math.abs(engine.getLimiterReduction());
        setLimiterActivity(prev => Math.max(reduction, prev * 0.8));
      }
      frame = requestAnimationFrame(checkLimiter);
    };
    frame = requestAnimationFrame(checkLimiter);
    return () => cancelAnimationFrame(frame);
  }, [engine]);

  useEffect(() => {
    drawEQCurve();
  }, [settings.bassBoost, settings.midGain, settings.airGain]);

  const drawEQCurve = () => {
    const canvas = eqCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < canvas.width; x++) {
      const freq = Math.pow(10, (x / canvas.width) * 3) * 20; // 20Hz to 20kHz approx
      
      // Rough simulation of the filters
      const bass = settings.bassBoost * (1 / (1 + Math.pow(freq / 150, 2)));
      const mid = settings.midGain * Math.exp(-Math.pow(Math.log(freq / 1200), 2));
      const air = settings.airGain * (1 - (1 / (1 + Math.pow(freq / 12000, 2))));
      
      const totalGain = bass + mid + air;
      const y = (canvas.height / 2) - (totalGain * 4);
      
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Center line
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const update = (key: keyof AudioSettings, val: any) => {
    setSettings(prev => ({ ...prev, [key]: val, isAiMode: false }));
  };

  return (
    <div className="space-y-6">
      <div className="rack-panel rounded-xl overflow-hidden">
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="bg-amber-600 text-white text-[9px] px-1 font-bold rounded">01</span>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Technical Restoration</h4>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-[8px] font-bold text-slate-600 uppercase">Limit</span>
            <div 
              className="w-2 h-2 rounded-full transition-all duration-75" 
              style={{ 
                backgroundColor: limiterActivity > 0.1 ? '#f59e0b' : '#1e293b',
                boxShadow: limiterActivity > 0.1 ? `0 0 ${limiterActivity * 4}px #f59e0b` : 'none'
              }}
            ></div>
          </div>
        </div>
        <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-4">
          <Slider label="Hiss Suppress" value={settings.hissSuppression} onChange={v => update('hissSuppression', v)} />
          <Slider label="Crackle Reduce" value={settings.crackleSuppression} onChange={v => update('crackleSuppression', v)} />
          <Slider label="Transient Rec." value={settings.transientRecovery} onChange={v => update('transientRecovery', v)} />
          <Slider label="Click Sens." value={settings.clickSensitivity} onChange={v => update('clickSensitivity', v)} />
        </div>
      </div>

      <div className="rack-panel rounded-xl overflow-hidden">
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="bg-amber-600 text-white text-[9px] px-1 font-bold rounded">02</span>
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tone & EQ Profile</h4>
          </div>
          <canvas ref={eqCanvasRef} width={80} height={30} className="bg-black/40 rounded border border-white/5" />
        </div>
        <div className="p-6">
          <div className="flex justify-around items-end h-[140px] pb-4 border-b border-slate-800 mb-6">
            <VerticalFader label="Bass" value={settings.bassBoost} min={-10} max={10} onChange={v => update('bassBoost', v)} />
            <VerticalFader label="Mid" value={settings.midGain} min={-10} max={10} onChange={v => update('midGain', v)} />
            <VerticalFader label="Air" value={settings.airGain} min={-10} max={10} onChange={v => update('airGain', v)} />
          </div>
          <Slider label="Warmth (Saturation)" value={settings.warmth} onChange={v => update('warmth', v)} />
        </div>
      </div>
    </div>
  );
};

const Slider: React.FC<{ label: string, value: number, onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-2">
    <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
      <span>{label}</span>
      <span className="text-amber-500">{Math.round(value)}%</span>
    </div>
    <input type="range" value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-full" />
  </div>
);

const VerticalFader: React.FC<{ label: string, value: number, min: number, max: number, onChange: (v: number) => void }> = ({ label, value, min, max, onChange }) => (
  <div className="flex flex-col items-center space-y-3">
    <div className="relative h-28 w-1 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center">
      <div className="absolute top-1/2 w-4 h-[1px] bg-slate-700 -translate-y-1/2"></div>
      <input 
        type="range" min={min} max={max} step={0.5} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ appearance: 'none', width: '100px', transform: 'rotate(-90deg)', background: 'transparent' }}
        className="absolute cursor-pointer z-10"
      />
      <div 
        className="absolute w-5 h-2.5 bg-slate-200 border border-slate-400 rounded-sm shadow-lg pointer-events-none transition-all duration-75"
        style={{ bottom: `${((value - min) / (max - min)) * 100}%`, transform: 'translateY(50%)' }}
      >
        <div className="w-full h-[1px] bg-red-500 mt-0.5"></div>
      </div>
    </div>
    <div className="text-center">
      <span className="text-[9px] font-black text-slate-500 uppercase block">{label}</span>
      <span className={`text-[10px] font-mono font-bold ${value > 0 ? 'text-green-500' : value < 0 ? 'text-red-500' : 'text-slate-400'}`}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}
      </span>
    </div>
  </div>
);

export default ControlPanel;
