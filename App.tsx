
import React, { useState, useEffect, useRef } from 'react';
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
  SpeakerWaveIcon
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
  bassBoost: 0,
  midGain: 0,
  airGain: 1.5,
  warmth: 12,
  masterGain: 0,
  limiterThreshold: -0.5,
  isAiMode: false,
  autoReviveMode: false
};

const FACTORY_PRESETS: Preset[] = [
  { id: 'standard', name: 'Factory Standard', settings: DEFAULT_SETTINGS },
  { id: '78rpm', name: '78rpm Shellac', settings: { ...DEFAULT_SETTINGS, hissSuppression: 60, crackleSuppression: 50, airGain: 8, bassBoost: 4, clickIntensity: 60 } },
  { id: 'club', name: 'Modern Club 12"', settings: { ...DEFAULT_SETTINGS, bassBoost: 6, airGain: 3, transientRecovery: 45, warmth: 20, clickIntensity: 20 } },
];

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [batchExporting, setBatchExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(ExportFormat.WAV);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [monitorMode, setMonitorMode] = useState<'dry' | 'wet'>('wet');
  
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
        if (settings.autoReviveMode) {
           setTimeout(() => handleAiRevive(id), 100);
        }
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

  const handleAiRevive = async (id?: string) => {
    const targetId = id || activeTrackId;
    const track = tracks.find(t => t.id === targetId);
    if (!track) return;

    setTracks(prev => prev.map(t => t.id === track.id ? { ...t, status: 'analyzing' } : t));
    const aiParams = await analyzeTrackWithAI(track.name);
    
    if (track.id === activeTrackId) {
      setSettings(prev => ({ ...prev, ...aiParams, isAiMode: true }));
    }
    
    setTracks(prev => prev.map(t => t.id === track.id ? { 
      ...t, 
      status: 'idle', 
      aiProfile: aiParams 
    } : t));
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
    if (id === 'standard' || id === '78rpm' || id === 'club') return;
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    localStorage.setItem('vrevive_presets', JSON.stringify(updated));
  };

  const handleExport = async () => {
    if (!activeTrack?.originalBuffer || !engineRef.current) return;
    setExporting(true);
    try {
      const blob = await engineRef.current.exportMaster(activeTrack.originalBuffer, settings);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VinylRevive_${activeTrack.name.split('.')[0]}.wav`;
      a.click();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (!engineRef.current || tracks.length === 0) return;
    setBatchExporting(true);
    try {
      for (const track of tracks) {
        if (!track.originalBuffer) {
           const buffer = await engineRef.current.loadAudio(track.originalBlob);
           track.originalBuffer = buffer;
        }
        const effectiveSettings = track.aiProfile ? { ...settings, ...track.aiProfile } : settings;
        const blob = await engineRef.current.exportMaster(track.originalBuffer!, effectiveSettings);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VinylRevive_BATCH_${track.name.split('.')[0]}.wav`;
        a.click();
        await new Promise(r => setTimeout(r, 800));
      }
    } finally {
      setBatchExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30">
      <header className="rack-panel h-16 flex items-center justify-between px-8 border-b-4 border-slate-900 z-10">
        <div className="flex items-center space-x-4">
          <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse amber-glow"></div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic flex items-center">
            VinylRevive <span className="text-amber-500 ml-2 font-mono">ST-MASTER RACK</span>
          </h1>
        </div>
        <div className="flex items-center space-x-6 text-[10px] font-mono font-bold uppercase text-slate-400">
          <div className="flex items-center space-x-3 bg-slate-900 px-3 py-1.5 rounded-sm border border-slate-800">
            <span>Revive Mode:</span>
            <button 
              onClick={() => setSettings(prev => ({ ...prev, autoReviveMode: !prev.autoReviveMode }))}
              className={`px-2 py-0.5 rounded transition-all ${settings.autoReviveMode ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400'}`}
            >
              {settings.autoReviveMode ? 'AUTO' : 'MANUAL'}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <span>Engine Status:</span>
            <span className="text-green-400">READY</span>
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
              <div className="text-center space-y-4">
                <div className="bg-slate-900 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-2xl">
                  <PlusIcon className="w-12 h-12 text-slate-600" />
                </div>
                <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Signal Input Required</h3>
                <p className="text-slate-600 text-xs uppercase tracking-tighter">Drag and drop audio assets here</p>
                <input type="file" multiple accept="audio/*" className="hidden" id="file-upload" onChange={(e) => handleUpload(e.target.files)} />
                <label htmlFor="file-upload" className="inline-block mt-4 px-10 py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded cursor-pointer transition-all uppercase text-xs tracking-[0.2em] shadow-lg">Initialize Link</label>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    <span className="text-[9px] uppercase font-black text-amber-500 tracking-[0.3em] block mb-1">Source Analysis In-Progress</span>
                    <h2 className="text-3xl font-black text-white truncate max-w-xl tracking-tighter italic leading-tight">{activeTrack.name}</h2>
                    
                    {/* Monitor Mode Switcher - A/B Comparison */}
                    <div className="mt-4 flex items-center space-x-2">
                       <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-lg shadow-inner">
                         <button 
                            onClick={() => setMonitorMode('dry')}
                            className={`flex items-center px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all ${monitorMode === 'dry' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                         >
                           <MusicalNoteIcon className="w-3 h-3 mr-2" />
                           Dry Signal (Input)
                         </button>
                         <button 
                            onClick={() => setMonitorMode('wet')}
                            className={`flex items-center px-4 py-2 rounded-md font-black text-[10px] uppercase tracking-widest transition-all ${monitorMode === 'wet' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                         >
                           <SpeakerWaveIcon className="w-3 h-3 mr-2" />
                           Mastered (Output)
                         </button>
                       </div>
                    </div>

                    {settings.aiInsight && (
                      <div className="mt-4 rack-panel rounded-lg border-l-4 border-l-sky-500 overflow-hidden max-w-xl shadow-xl">
                        <button 
                          onClick={() => setShowAiPanel(!showAiPanel)}
                          className="w-full flex items-center justify-between p-3 bg-sky-950/20 hover:bg-sky-950/40 transition-colors"
                        >
                          <div className="flex items-center text-sky-400 text-[10px] font-black uppercase tracking-widest">
                            <CpuChipIcon className="w-4 h-4 mr-2" />
                            AI Restoration Insights
                          </div>
                          {showAiPanel ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                        {showAiPanel && (
                          <div className="p-4 bg-slate-900/50 text-xs text-sky-100 leading-relaxed font-medium">
                            {settings.aiInsight}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={() => handleAiRevive()}
                      disabled={activeTrack.status === 'analyzing'}
                      className={`flex items-center px-6 py-3 rounded-md font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 ${
                        settings.isAiMode ? 'bg-sky-600 text-white ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <CpuChipIcon className={`w-4 h-4 mr-2 ${activeTrack.status === 'analyzing' ? 'animate-spin' : ''}`} />
                      {activeTrack.status === 'analyzing' ? 'Synthesizing...' : 'AI Revive'}
                    </button>
                    <button onClick={togglePlayback} className="w-14 h-14 rounded-full bg-amber-600 flex items-center justify-center text-white hover:bg-amber-500 transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-90">
                      {isPlaying ? <PauseIcon className="w-7 h-7" /> : <PlayIcon className="w-7 h-7 ml-1" />}
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-black/60 rounded-xl border border-slate-800 relative overflow-hidden shadow-inner">
                  <Visualizer analyzer={engineRef.current?.getAnalyzer()} isPlaying={isPlaying} />
                  {activeTrack.status === 'analyzing' && <div className="absolute inset-0 bg-sky-900/10 backdrop-blur-sm scanning"></div>}
                </div>
              </div>
            )}
          </div>

          <div className="h-72 rack-panel rounded-xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 bg-slate-900/50 border-b border-slate-800">
              <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center">
                <BoltIcon className="w-4 h-4 mr-2 text-amber-500" />
                Signal Recalibration Queue
              </h4>
              <div className="flex items-center space-x-4">
                 <button 
                    onClick={handleExportAll}
                    disabled={tracks.length === 0 || batchExporting}
                    className={`flex items-center px-4 py-2 rounded font-black text-[9px] uppercase tracking-widest transition-all ${
                      batchExporting ? 'bg-sky-900 text-sky-300 animate-pulse' : 'bg-slate-800 text-sky-400 hover:bg-sky-600 hover:text-white'
                    }`}
                 >
                   <ArrowDownTrayIcon className="w-3.5 h-3.5 mr-2" />
                   {batchExporting ? 'Processing All...' : 'Batch Export'}
                 </button>
                 <div className="w-[1px] h-6 bg-slate-800"></div>
                 <button onClick={() => setTracks([])} className="text-slate-600 hover:text-red-500 transition-colors text-[9px] font-black uppercase tracking-widest">Flush Buffer</button>
              </div>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 border-r border-slate-800/50 p-5 overflow-y-auto">
                <span className="text-[8px] uppercase font-black text-slate-600 tracking-widest block mb-3">INPUT SIGNAL ANALYSIS</span>
                <TrackList tracks={tracks} activeId={activeTrackId} onSelect={handleSelectTrack} onRemove={(id) => setTracks(prev => prev.filter(t => t.id !== id))} type="before" monitorMode={monitorMode} />
              </div>
              <div className="flex-1 p-5 overflow-y-auto bg-slate-900/20">
                <span className="text-[8px] uppercase font-black text-sky-600 tracking-widest block mb-3">MASTERED RENDER MONITOR</span>
                <TrackList tracks={tracks} activeId={activeTrackId} onSelect={handleSelectTrack} onRemove={(id) => setTracks(prev => prev.filter(t => t.id !== id))} type="after" monitorMode={monitorMode} />
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-[420px] shrink-0 flex flex-col space-y-6 overflow-y-auto pr-2">
          <div className="rack-panel rounded-xl p-5 flex flex-col space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Preset Library</h4>
              <button onClick={savePreset} className="p-1.5 rounded-full hover:bg-amber-600/20 hover:text-amber-500 transition-all">
                <BookmarkSquareIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button 
                  key={p.id}
                  onContextMenu={(e) => { e.preventDefault(); deletePreset(p.id); }}
                  onClick={() => setSettings({ ...p.settings, isAiMode: false })}
                  className={`px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all border ${
                    settings.hissSuppression === p.settings.hissSuppression && settings.bassBoost === p.settings.bassBoost 
                    ? 'bg-amber-600 text-white border-amber-400' : 'bg-slate-900 text-slate-500 hover:bg-slate-800 border-slate-800'
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

          <div className="rack-panel rounded-xl p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
              <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Master Output Format</h4>
              <div className="flex bg-slate-900 p-1.5 rounded-sm border border-slate-800">
                 <button className="px-4 py-1 rounded-sm text-[10px] font-black transition-all tracking-widest bg-amber-600 text-white shadow-lg">WAV (Lossless)</button>
              </div>
            </div>
            <button 
              onClick={handleExport}
              disabled={!activeTrack || exporting}
              className={`w-full py-5 rounded-md flex items-center justify-center font-black uppercase tracking-[0.3em] text-[11px] transition-all shadow-[0_15px_30px_-10px_rgba(245,158,11,0.3)] hover:shadow-amber-500/40 active:scale-[0.98] ${!activeTrack ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-500'} ${exporting ? 'opacity-50' : ''}`}
            >
              {exporting ? <><ArrowPathIcon className="w-5 h-5 mr-3 animate-spin" />Rendering Master...</> : <><ArrowDownTrayIcon className="w-5 h-5 mr-3" />Export Lossless Master</>}
            </button>
            <p className="text-[8px] text-center text-slate-700 uppercase font-black tracking-widest mt-4">Headroom Optimized | High Bitrate 16-bit PCM</p>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
