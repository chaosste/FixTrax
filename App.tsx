
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AudioEngine } from './services/AudioEngine';
import { analyzeTrackWithAI } from './services/geminiService';
import { AudioSettings, Track, ExportFormat, Preset } from './types';
import ControlPanel from './components/ControlPanel';
import Visualizer from './components/Visualizer';
import TrackList from './components/TrackList';
import { 
  PlusIcon, 
  ArrowPathIcon, 
  PlayIcon, 
  PauseIcon, 
  ArrowDownTrayIcon,
  CpuChipIcon,
  BookmarkSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BoltIcon,
  MusicalNoteIcon,
  SpeakerWaveIcon,
  CheckIcon,
  WrenchScrewdriverIcon,
  ArrowsRightLeftIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/solid';

const DEFAULT_SETTINGS: AudioSettings = {
  hissSuppression: 20,
  crackleSuppression: 15,
  clickFiltering: 0,
  clickSensitivity: 25,
  clickIntensity: 30,
  humRemoval: false,
  humFrequency: 60,
  humQ: 10,
  transientRecovery: 30,
  spectralSynth: 10,
  deReverb: 0,
  bassBoost: 0,
  midGain: 0,
  airGain: 2.0,
  warmth: 15,
  stereoWidth: 105,
  monoToggle: false,
  masterGain: 0,
  limiterThreshold: -0.5,
  isAiMode: false,
  autoReviveMode: false
};

const FACTORY_PRESETS: Preset[] = [
  { id: 'standard', name: 'Factory Standard', settings: DEFAULT_SETTINGS },
  { id: 'clean-groove', name: 'Clean Groove (Low Wear)', settings: { ...DEFAULT_SETTINGS, hissSuppression: 10, crackleSuppression: 10, transientRecovery: 20 } },
  { id: 'vintage-78', name: 'Shellac 78 Collector', settings: { ...DEFAULT_SETTINGS, hissSuppression: 75, crackleSuppression: 60, airGain: 8, midGain: 2 } },
  { id: 'modern-club', name: 'Modern House 12"', settings: { ...DEFAULT_SETTINGS, bassBoost: 4, airGain: 4, transientRecovery: 45, stereoWidth: 125, warmth: 25 } },
];

const BUILD_ID = "360ecd57-f101-4133-bfef-1b220036db94";

const VinylLogo = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 text-sky-500 fill-current" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" className="opacity-20" />
    <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 2" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 1" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
  const [comparisonBase, setComparisonBase] = useState<AudioSettings | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [monitorMode, setMonitorMode] = useState<'dry' | 'wet'>('wet');
  
  const engineRef = useRef<AudioEngine | null>(null);
  const activeTrack = tracks.find(t => t.id === activeTrackId);

  useEffect(() => {
    engineRef.current = new AudioEngine();
    const saved = localStorage.getItem('vrevive_presets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch {
        setPresets(FACTORY_PRESETS);
      }
    } else {
      setPresets(FACTORY_PRESETS);
    }
    return () => engineRef.current?.stop();
  }, []);

  // Effect for reactive updates when settings or monitor mode changes via state
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateSettings(settings);
      engineRef.current.setMonitorMode(monitorMode);
    }
  }, [settings, monitorMode]);

  const activePresetId = useMemo(() => {
    const matched = presets.find(p => {
      // Comparison logic for matching preset to current settings
      return Math.abs(p.settings.hissSuppression - settings.hissSuppression) < 0.1 &&
             Math.abs(p.settings.bassBoost - settings.bassBoost) < 0.1 &&
             Math.abs(p.settings.stereoWidth - settings.stereoWidth) < 0.1 &&
             p.settings.monoToggle === settings.monoToggle;
    });
    return matched ? matched.id : null;
  }, [settings, presets]);

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const track: Track = {
        id: crypto.randomUUID(),
        name: file.name,
        originalBlob: file,
        status: 'idle'
      };
      newTracks.push(track);
    }
    setTracks((prev) => {
      const updated = [...prev, ...newTracks];
      if (!activeTrackId && newTracks.length > 0) {
        const firstNewTrack = newTracks[0];
        setActiveTrackId(firstNewTrack.id);
      }
      return updated;
    });
  };

  const handleSelectTrack = async (id: string) => {
    setActiveTrackId(id);
    const track = tracks.find((t) => t.id === id);
    if (track && !track.originalBuffer) {
      setTracks(prev => prev.map(t => t.id === id ? { ...t, status: 'processing' } : t));
      const buffer = await engineRef.current?.loadAudio(track.originalBlob);
      if (buffer) {
        setTracks(prev => prev.map(t => t.id === id ? { ...t, originalBuffer: buffer, status: 'idle' } : t));
      }
    }
    setIsPlaying(false);
    engineRef.current?.stop();
  };

  useEffect(() => {
    if (!activeTrackId) return;
    const track = tracks.find((candidate) => candidate.id === activeTrackId);
    if (!track || track.originalBuffer) return;

    let cancelled = false;
    setTracks((prev) => prev.map((candidate) => (
      candidate.id === activeTrackId ? { ...candidate, status: 'processing' } : candidate
    )));

    engineRef.current?.loadAudio(track.originalBlob).then((buffer) => {
      if (cancelled || !buffer) return;
      setTracks((prev) => prev.map((candidate) => (
        candidate.id === activeTrackId ? { ...candidate, originalBuffer: buffer, status: 'idle' } : candidate
      )));
    });

    return () => {
      cancelled = true;
    };
  }, [activeTrackId, tracks]);

  const togglePlayback = () => {
    if (!activeTrack?.originalBuffer) return;
    if (isPlaying) {
      engineRef.current?.stop();
      setIsPlaying(false);
    } else {
      engineRef.current?.play(activeTrack.originalBuffer);
      setIsPlaying(true);
    }
  };

  const handleAiRevive = async () => {
    if (!activeTrack) return;
    setTracks(prev => prev.map(t => t.id === activeTrack.id ? { ...t, status: 'analyzing' } : t));
    const aiParams = await analyzeTrackWithAI(activeTrack.name);
    const newSettings = { ...settings, ...aiParams, isAiMode: true };
    setSettings(newSettings);
    // Immediate apply for AI results too
    engineRef.current?.updateSettings(newSettings);
    setTracks(prev => prev.map(t => t.id === activeTrack.id ? { ...t, status: 'idle', aiProfile: aiParams } : t));
    setMonitorMode('wet');
  };

  // Dedicated handler for immediate, gapless preset application
  const handleApplyPreset = (preset: Preset) => {
    const newSettings = { ...preset.settings, isAiMode: false };
    
    // 1. Update state for UI sync
    setSettings(newSettings);
    setMonitorMode('wet');
    
    // 2. Direct engine update for immediate audio thread response (no waiting for next React render)
    if (engineRef.current) {
      engineRef.current.updateSettings(newSettings);
      engineRef.current.setMonitorMode('wet');
    }
  };

  const savePreset = () => {
    const name = prompt("Enter preset name:");
    if (!name) return;
    const newPreset: Preset = { id: Date.now().toString(), name, settings };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('vrevive_presets', JSON.stringify(updated));
  };

  const deletePreset = (id: string) => {
    if (FACTORY_PRESETS.some(fp => fp.id === id)) return;
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('vrevive_presets', JSON.stringify(updated));
  };

  const toggleDiff = () => {
    if (comparisonBase) {
      const target = comparisonBase;
      setSettings(target);
      engineRef.current?.updateSettings(target);
      setComparisonBase(null);
    } else {
      const base = presets.find(p => p.id === activePresetId) || presets[0];
      setComparisonBase(settings);
      setSettings(base.settings);
      engineRef.current?.updateSettings(base.settings);
    }
  };

  const handleExport = async () => {
    if (!activeTrack?.originalBuffer || !engineRef.current) return;
    setExporting(true);
    try {
      const blob = await engineRef.current.exportMaster(activeTrack.originalBuffer, settings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VinylRevive_AI_${activeTrack.name.split('.')[0]}.wav`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="rack-panel h-16 flex items-center justify-between px-8 border-b-4 border-slate-900 z-50">
        <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => window.location.reload()}>
          <VinylLogo />
          <h1 className="text-xl font-black tracking-tighter uppercase italic flex items-center">
            VinylRevive <span className="text-sky-500 ml-2 font-mono text-sm opacity-80">LAB • {BUILD_ID.split('-')[0]}</span>
          </h1>
        </div>
        <div className="flex items-center space-x-6 text-[10px] font-mono font-bold uppercase text-slate-400">
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <ShieldCheckIcon className="w-3 h-3 text-sky-500" />
              <span>Hiss Suppression:</span>
              <span className="text-sky-400">STABLE</span>
            </div>
            <div className="w-[1px] h-4 bg-slate-800"></div>
            <div className="flex items-center space-x-2">
              <span>Mode:</span>
              <span className={settings.isAiMode ? 'text-sky-400' : 'text-amber-500'}>
                {settings.isAiMode ? 'AI-ENHANCED' : 'MANUAL RACK'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
        <div className="flex-1 flex flex-col space-y-6 min-h-0">
          <div 
            className={`rack-panel flex-1 rounded-xl p-6 relative flex flex-col border-2 border-dashed ${!activeTrack ? 'border-slate-700 items-center justify-center' : 'border-transparent'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          >
            {!activeTrack ? (
              <div className="text-center space-y-6">
                <div className="bg-slate-900 w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-slate-700 shadow-2xl relative overflow-hidden group">
                   <div className="absolute inset-0 bg-sky-500/10 group-hover:bg-sky-500/20 transition-colors"></div>
                   <PlusIcon className="w-12 h-12 text-slate-600 group-hover:text-sky-500 transition-colors relative z-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Digital Intake Console</h3>
                  <p className="text-sky-400 text-xs uppercase tracking-[0.4em] font-black animate-pulse">Drag vinyl MP3s to decode</p>
                </div>
                <input type="file" multiple accept="audio/*" className="hidden" id="file-upload" onChange={(e) => handleUpload(e.target.files)} />
                <label htmlFor="file-upload" className="inline-block mt-4 px-10 py-4 bg-sky-600 hover:bg-sky-500 text-white font-black rounded cursor-pointer transition-all uppercase text-xs tracking-widest shadow-lg active:scale-95">LOAD ASSETS</label>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <span className="text-[9px] uppercase font-black text-sky-500 tracking-widest block mb-1">Surface Geometry Analysis</span>
                    <h2 className="text-2xl font-black text-white truncate max-w-xl italic">{activeTrack.name}</h2>
                    
                    <div className="mt-4 flex p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-inner w-fit">
                       <button 
                          onClick={() => setMonitorMode('dry')}
                          className={`flex items-center px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all ${monitorMode === 'dry' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                       >
                         <MusicalNoteIcon className="w-3 h-3 mr-2" /> Original
                       </button>
                       <button 
                          onClick={() => setMonitorMode('wet')}
                          className={`flex items-center px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all ${monitorMode === 'wet' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                       >
                         <SpeakerWaveIcon className="w-3 h-3 mr-2" /> Restored
                       </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col items-end space-y-2">
                       <button 
                          onClick={handleAiRevive}
                          disabled={activeTrack.status === 'analyzing'}
                          className={`flex items-center px-5 py-3 rounded-md font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                            settings.isAiMode ? 'bg-sky-600 text-white border-2 border-sky-400' : 'bg-slate-800 text-slate-400 border-2 border-slate-700'
                          }`}
                       >
                          <CpuChipIcon className={`w-4 h-4 mr-2 ${activeTrack.status === 'analyzing' ? 'animate-spin' : ''}`} />
                          {activeTrack.status === 'analyzing' ? 'ANALYZING...' : 'VINYL AI ANALYSIS'}
                       </button>
                       {settings.aiInsight && <span className="text-[7px] text-sky-400/80 font-bold uppercase tracking-tighter max-w-[180px] text-right leading-none">{settings.aiInsight}</span>}
                    </div>
                    <button onClick={togglePlayback} className="w-16 h-16 rounded-full bg-sky-600 flex items-center justify-center text-white hover:bg-sky-500 transition-all shadow-[0_0_30px_rgba(14,165,233,0.4)] active:scale-90 border-4 border-slate-950">
                      {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-black/60 rounded-xl border border-slate-800 relative overflow-hidden shadow-inner">
                  <Visualizer analyzer={engineRef.current?.getAnalyzer()} isPlaying={isPlaying} />
                </div>
              </div>
            )}
          </div>

          <div className="h-64 rack-panel rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-slate-900/50 border-b border-slate-800">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center">
                <BoltIcon className="w-4 h-4 mr-2 text-sky-500" />
                Asset Registry • Build {BUILD_ID.split('-')[1]}
              </h4>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 border-r border-slate-800/50 p-4 overflow-y-auto">
                <TrackList tracks={tracks} activeId={activeTrackId} onSelect={handleSelectTrack} onRemove={(id) => setTracks(prev => prev.filter(t => t.id !== id))} type="before" monitorMode={monitorMode} />
              </div>
              <div className="flex-1 p-4 overflow-y-auto bg-slate-900/10">
                <TrackList tracks={tracks} activeId={activeTrackId} onSelect={handleSelectTrack} onRemove={(id) => setTracks(prev => prev.filter(t => t.id !== id))} type="after" monitorMode={monitorMode} />
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-[420px] shrink-0 flex flex-col space-y-6 overflow-y-auto pr-2 pb-6">
          <div className="rack-panel rounded-xl p-5 flex flex-col space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center text-slate-500">
                <BookmarkSquareIcon className="w-4 h-4 mr-2 text-sky-500" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Profile Library</h4>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={toggleDiff}
                  title="Compare with Reference"
                  className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${comparisonBase ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'}`}
                >
                  COMPARE
                </button>
                <button onClick={savePreset} className="text-[9px] font-black text-sky-500 hover:text-sky-400 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded border border-slate-800 shadow-sm">
                  SAVE
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button 
                  key={p.id}
                  onContextMenu={(e) => { e.preventDefault(); deletePreset(p.id); }}
                  onClick={() => handleApplyPreset(p)}
                  className={`px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all border ${
                    activePresetId === p.id 
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md' : 'bg-slate-900 text-slate-500 hover:bg-slate-800 border-slate-800'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <ControlPanel 
            settings={settings} 
            setSettings={setSettings} 
            onReset={() => setSettings(DEFAULT_SETTINGS)}
            engine={engineRef.current}
          />

          <div className="rack-panel rounded-xl p-8 shadow-2xl border-t-4 border-sky-600">
            <button 
              onClick={handleExport}
              disabled={!activeTrack || exporting}
              className={`w-full py-5 rounded-md flex items-center justify-center font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-xl active:scale-[0.98] ${!activeTrack ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-slate-700' : 'bg-sky-600 text-white hover:bg-sky-500 border-sky-400 shadow-2xl'} ${exporting ? 'opacity-50' : ''} border-2`}
            >
              {exporting ? <><ArrowPathIcon className="w-5 h-5 mr-3 animate-spin" />MASTERING...</> : <><ArrowDownTrayIcon className="w-5 h-5 mr-3" />EXPORT RESTORED MASTER</>}
            </button>
            <div className="mt-4 text-center">
              <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">Acoustic Reconstruction Engine v2.5.1</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
