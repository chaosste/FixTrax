
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
  BookmarkSquareIcon
} from '@heroicons/react/24/solid';

const DEFAULT_SETTINGS: AudioSettings = {
  hissSuppression: 15,
  crackleSuppression: 10,
  clickFiltering: 0,
  clickSensitivity: 20,
  humRemoval: false,
  transientRecovery: 25,
  bassBoost: 0,
  midGain: 0,
  airGain: 1.5,
  warmth: 12,
  masterGain: 0,
  limiterThreshold: -0.5,
  isAiMode: false
};

const FACTORY_PRESETS: Preset[] = [
  { id: 'standard', name: 'Factory Standard', settings: DEFAULT_SETTINGS },
  { id: '78rpm', name: '78rpm Shellac', settings: { ...DEFAULT_SETTINGS, hissSuppression: 60, crackleSuppression: 50, airGain: 8, bassBoost: 4 } },
  { id: 'club', name: 'Modern Club 12"', settings: { ...DEFAULT_SETTINGS, bassBoost: 6, airGain: 3, transientRecovery: 45, warmth: 20 } },
];

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_SETTINGS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(ExportFormat.WAV);
  const [presets, setPresets] = useState<Preset[]>([]);
  
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
    if (engineRef.current) engineRef.current.updateSettings(settings);
  }, [settings]);

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newTracks.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        originalBlob: file,
        status: 'idle'
      });
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
    const newSettings = { ...settings, ...aiParams, isAiMode: true };
    setSettings(newSettings);
    setTracks(prev => prev.map(t => t.id === activeTrack.id ? { ...t, status: 'idle', aiProfile: aiParams } : t));
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
      a.download = `VinylRevive_${activeTrack.name.split('.')[0]}.${exportFormat.toLowerCase()}`;
      a.click();
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30">
      <header className="rack-panel h-16 flex items-center justify-between px-8 border-b-4 border-slate-900 z-10">
        <div className="flex items-center space-x-4">
          <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse amber-glow"></div>
          <h1 className="text-xl font-black tracking-tighter uppercase italic flex items-center">
            VinylRevive <span className="text-amber-500 ml-2">Studio Master Rack v2.5</span>
          </h1>
        </div>
        <div className="flex items-center space-x-6 text-xs font-mono font-bold uppercase text-slate-400">
          <div className="flex items-center space-x-2">
            <span>GR Meter:</span>
            <div className={`w-3 h-3 rounded-sm ${isPlaying ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-slate-800'}`}></div>
          </div>
          <div className="flex items-center space-x-2">
            <span>Engine:</span>
            <span className="text-sky-400">Gemini-Pro Ultra</span>
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
                <div className="bg-slate-900 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                  <PlusIcon className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-400">Drag & Drop Tracks</h3>
                <input type="file" multiple accept="audio/*" className="hidden" id="file-upload" onChange={(e) => handleUpload(e.target.files)} />
                <label htmlFor="file-upload" className="inline-block mt-4 px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded cursor-pointer transition-all uppercase text-sm tracking-widest">Select Tracks</label>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-500 tracking-widest block mb-1">Active Recording</span>
                    <h2 className="text-2xl font-black text-white truncate max-w-lg">{activeTrack.name}</h2>
                    {settings.aiInsight && (
                      <p className="text-[10px] text-sky-400 font-bold uppercase mt-1 flex items-center">
                        <CpuChipIcon className="w-3 h-3 mr-1" /> {settings.aiInsight}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={handleAiRevive}
                      disabled={activeTrack.status === 'analyzing'}
                      className={`flex items-center px-4 py-2 rounded font-bold text-xs uppercase tracking-widest transition-all ${
                        settings.isAiMode ? 'bg-sky-600 text-white ring-2 ring-sky-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <CpuChipIcon className={`w-4 h-4 mr-2 ${activeTrack.status === 'analyzing' ? 'animate-spin' : ''}`} />
                      AI Revive
                    </button>
                    <button onClick={togglePlayback} className="w-12 h-12 rounded-full bg-amber-600 flex items-center justify-center text-white hover:bg-amber-500 transition-all shadow-lg">
                      {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6 ml-1" />}
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-black/50 rounded-lg border border-slate-800 relative overflow-hidden">
                  <Visualizer analyzer={engineRef.current?.getAnalyzer()} isPlaying={isPlaying} />
                  {activeTrack.status === 'analyzing' && <div className="absolute inset-0 bg-sky-900/20 backdrop-blur-sm scanning"></div>}
                </div>
              </div>
            )}
          </div>

          <div className="h-64 rack-panel rounded-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Recalibrate Tracks</h4>
              <button onClick={() => setTracks([])} className="text-slate-500 hover:text-red-500 transition-colors flex items-center text-[10px] uppercase font-bold">Refresh List</button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 border-r border-slate-800 p-4 overflow-y-auto">
                <span className="text-[9px] uppercase font-black text-slate-600 block mb-2">[L] Original Audio</span>
                <TrackList tracks={tracks} activeId={activeTrackId} onSelect={handleSelectTrack} onRemove={(id) => setTracks(prev => prev.filter(t => t.id !== id))} type="before" />
              </div>
              <div className="flex-1 p-4 overflow-y-auto bg-slate-900/30">
                <span className="text-[9px] uppercase font-black text-sky-600 block mb-2">[R] Mastered Render</span>
                <TrackList tracks={tracks} activeId={activeTrackId} onSelect={handleSelectTrack} onRemove={(id) => setTracks(prev => prev.filter(t => t.id !== id))} type="after" />
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-[400px] shrink-0 flex flex-col space-y-6">
          <div className="rack-panel rounded-xl p-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preset Library</h4>
              <button onClick={savePreset} className="p-1 hover:text-amber-500 transition-colors">
                <BookmarkSquareIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button 
                  key={p.id}
                  onContextMenu={(e) => { e.preventDefault(); deletePreset(p.id); }}
                  onClick={() => setSettings({ ...p.settings, isAiMode: false })}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                    settings.hissSuppression === p.settings.hissSuppression && settings.bassBoost === p.settings.bassBoost 
                    ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
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

          <div className="rack-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Master Export</h4>
              <div className="flex bg-slate-800 rounded p-1">
                {['WAV', 'MP3'].map(f => (
                  <button key={f} onClick={() => setExportFormat(f as ExportFormat)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${exportFormat === f ? 'bg-amber-600 text-white' : 'text-slate-500'}`}>{f}</button>
                ))}
              </div>
            </div>
            <button 
              onClick={handleExport}
              disabled={!activeTrack || exporting}
              className={`w-full py-4 rounded-lg flex items-center justify-center font-black uppercase tracking-widest text-sm transition-all shadow-xl ${!activeTrack ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-amber-600 text-white hover:bg-amber-500 active:scale-[0.98]'} ${exporting ? 'opacity-50' : ''}`}
            >
              {exporting ? <><ArrowPathIcon className="w-5 h-5 mr-3 animate-spin" />Mastering...</> : <><ArrowDownTrayIcon className="w-5 h-5 mr-3" />Export Mastered Audio</>}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
