
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
  ArrowsRightLeftIcon
} from '@heroicons/react/24/solid';

const DEFAULT_SETTINGS: AudioSettings = {
  hissSuppression: 15,
  crackleSuppression: 10,
  clickFiltering: 0,
  clickSensitivity: 20,
  clickIntensity: 30,
  humRemoval: false,
  humFrequency: 60,
  humQ: 10,
  transientRecovery: 25,
  spectralSynth: 5,
  deReverb: 0,
  bassBoost: 0,
  midGain: 0,
  airGain: 1.5,
  warmth: 12,
  stereoWidth: 100,
  monoToggle: false,
  masterGain: 0,
  limiterThreshold: -0.5,
  isAiMode: false,
  autoReviveMode: false
};

const FACTORY_PRESETS: Preset[] = [
  { id: 'standard', name: 'Factory Standard', settings: DEFAULT_SETTINGS },
  { id: 'modern-club', name: 'Modern Club 12"', settings: { ...DEFAULT_SETTINGS, bassBoost: 4, airGain: 3, transientRecovery: 40, stereoWidth: 125, warmth: 20 } },
  { id: '78rpm', name: '78rpm Clean', settings: { ...DEFAULT_SETTINGS, hissSuppression: 65, airGain: 6, crackleSuppression: 50 } },
];

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
  const [comparisonBase, setComparisonBase] = useState<AudioSettings | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [monitorMode, setMonitorMode] = useState<'dry' | 'wet'>('wet');
  const [isManualApplied, setIsManualApplied] = useState(false);
  
  const engineRef = useRef<AudioEngine | null>(null);
  const activeTrack = tracks.find(t => t.id === activeTrackId);

  useEffect(() => {
    engineRef.current = new AudioEngine();
    const saved = localStorage.getItem('vrevive_presets');
    if (saved) setPresets(JSON.parse(saved));
    else setPresets(FACTORY_PRESETS);
    return () => engineRef.current?.stop();
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateSettings(settings);
      engineRef.current.setMonitorMode(monitorMode);
    }
  }, [settings, monitorMode]);

  const activePresetId = useMemo(() => {
    const matched = presets.find(p => {
      return p.settings.hissSuppression === settings.hissSuppression &&
             p.settings.bassBoost === settings.bassBoost &&
             p.settings.stereoWidth === settings.stereoWidth;
    });
    return matched ? matched.id : null;
  }, [settings, presets]);

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const track: Track = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        originalBlob: file,
        status: 'idle'
      };
      newTracks.push(track);
    }
    setTracks(prev => [...prev, ...newTracks]);
    if (!activeTrackId && newTracks.length > 0) handleSelectTrack(newTracks[0].id);
  };

  const handleSelectTrack = async (id: string) => {
    setActiveTrackId(id);
    const track = tracks.find(t => t.id === id);
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
    setSettings(prev => ({ ...prev, ...aiParams, isAiMode: true }));
    setTracks(prev => prev.map(t => t.id === activeTrack.id ? { ...t, status: 'idle', aiProfile: aiParams } : t));
    setMonitorMode('wet');
  };

  const savePreset = () => {
    const name = prompt("Enter preset name:");
    if (!name) return;
    const newPreset: Preset = { id: Date.now().toString(), name, settings };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('vrevive_presets', JSON.stringify(updated));
  };

  // Fix: Added deletePreset to handle manual preset removal while protecting factory presets
  const deletePreset = (id: string) => {
    if (FACTORY_PRESETS.some(fp => fp.id === id)) {
      return;
    }
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('vrevive_presets', JSON.stringify(updated));
  };

  const toggleDiff = () => {
    if (comparisonBase) {
      setSettings(comparisonBase);
      setComparisonBase(null);
    } else {
      // Find the factory or custom preset to compare against
      const base = presets.find(p => p.id === activePresetId) || presets[0];
      setComparisonBase(settings);
      setSettings(base.settings);
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
      a.download = `VinylRevive_MASTER_${activeTrack.name.split('.')[0]}.wav`;
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="rack-panel h-16 flex items-center justify-between px-8 border-b-4 border-slate-900 z-10">
        <div className="flex items-center space-x-4">
          <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse"></div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic flex items-center">
            VinylRevive <span className="text-amber-500 ml-2 font-mono">ULTRA-MASTER RACK</span>
          </h1>
        </div>
        <div className="flex items-center space-x-6 text-[10px] font-mono font-bold uppercase text-slate-400">
          <div className="flex items-center space-x-2">
            <span>Revive Mode:</span>
            <span className="text-amber-500">{settings.isAiMode ? 'AI STEERED' : 'MANUAL CONTROL'}</span>
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
                <div className="bg-slate-900 w-24 h-24 rounded-full flex items-center justify-center mx-auto border border-slate-700 shadow-2xl">
                  <PlusIcon className="w-12 h-12 text-slate-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Signal Entry</h3>
                  <p className="text-amber-400 text-xs uppercase tracking-[0.4em] font-black animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">Drag and drop audio assets here</p>
                </div>
                <input type="file" multiple accept="audio/*" className="hidden" id="file-upload" onChange={(e) => handleUpload(e.target.files)} />
                <label htmlFor="file-upload" className="inline-block mt-4 px-10 py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded cursor-pointer transition-all uppercase text-xs tracking-widest shadow-lg active:scale-95">CHOOSE FILES</label>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <span className="text-[9px] uppercase font-black text-amber-500 tracking-widest block mb-1">Source Path Analysis</span>
                    <h2 className="text-2xl font-black text-white truncate max-w-xl italic">{activeTrack.name}</h2>
                    
                    <div className="mt-4 flex p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-inner w-fit">
                       <button 
                          onClick={() => setMonitorMode('dry')}
                          className={`flex items-center px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all ${monitorMode === 'dry' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                       >
                         <MusicalNoteIcon className="w-3 h-3 mr-2" /> Dry (Before)
                       </button>
                       <button 
                          onClick={() => setMonitorMode('wet')}
                          className={`flex items-center px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all ${monitorMode === 'wet' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                       >
                         <SpeakerWaveIcon className="w-3 h-3 mr-2" /> Revived (After)
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
                          {activeTrack.status === 'analyzing' ? 'SYNTHESIZING...' : 'AI REVIVE'}
                       </button>
                       {settings.aiInsight && <span className="text-[7px] text-sky-400/80 font-bold uppercase tracking-tighter max-w-[140px] text-right leading-none">{settings.aiInsight}</span>}
                    </div>
                    <button onClick={togglePlayback} className="w-16 h-16 rounded-full bg-amber-600 flex items-center justify-center text-white hover:bg-amber-500 transition-all shadow-[0_0_30px_rgba(245,158,11,0.4)] active:scale-90 border-4 border-slate-950">
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
                <BoltIcon className="w-4 h-4 mr-2 text-amber-500" />
                Signal Recalibration Queue
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
                <BookmarkSquareIcon className="w-4 h-4 mr-2" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Preset Library</h4>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={toggleDiff}
                  className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all border ${comparisonBase ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'}`}
                >
                  <ArrowsRightLeftIcon className="w-3 h-3" />
                </button>
                <button onClick={savePreset} className="text-[9px] font-black text-amber-600 hover:text-amber-500 uppercase tracking-widest bg-slate-900 px-3 py-1 rounded border border-slate-800 shadow-sm">
                  SAVE NEW
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button 
                  key={p.id}
                  onContextMenu={(e) => { e.preventDefault(); deletePreset(p.id); }}
                  onClick={() => {
                    setSettings({ ...p.settings, isAiMode: false });
                    setMonitorMode('wet');
                  }}
                  className={`px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all border ${
                    activePresetId === p.id 
                    ? 'bg-amber-600 text-white border-amber-400 shadow-md' : 'bg-slate-900 text-slate-500 hover:bg-slate-800 border-slate-800'
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

          <div className="rack-panel rounded-xl p-8 shadow-2xl border-t-4 border-amber-600">
            <button 
              onClick={handleExport}
              disabled={!activeTrack || exporting}
              className={`w-full py-5 rounded-md flex items-center justify-center font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-xl active:scale-[0.98] ${!activeTrack ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-slate-700' : 'bg-amber-600 text-white hover:bg-amber-500 border-amber-500 shadow-2xl'} ${exporting ? 'opacity-50' : ''} border-2`}
            >
              {exporting ? <><ArrowPathIcon className="w-5 h-5 mr-3 animate-spin" />RENDERING MASTER...</> : <><ArrowDownTrayIcon className="w-5 h-5 mr-3" />EXPORT HI-RES MASTER</>}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
