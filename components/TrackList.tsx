
import React from 'react';
import { Track } from '../types';
import { TrashIcon, CheckCircleIcon, SignalIcon, BeakerIcon } from '@heroicons/react/24/outline';

interface TrackListProps {
  tracks: Track[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  type: 'before' | 'after';
}

const TrackList: React.FC<TrackListProps> = ({ tracks, activeId, onSelect, onRemove, type }) => {
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full opacity-20 py-8">
        <SignalIcon className="w-8 h-8 mb-2" />
        <span className="text-[10px] font-black uppercase">No Data Loaded</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tracks.map(track => {
        const isActive = track.id === activeId;
        const isDone = track.status === 'idle' || track.status === 'done';
        
        return (
          <div 
            key={track.id}
            onClick={() => onSelect(track.id)}
            className={`group flex items-center justify-between p-2 rounded cursor-pointer transition-all border ${
              isActive 
                ? 'bg-slate-800 border-amber-500/50 shadow-inner' 
                : 'border-transparent hover:bg-slate-800/50 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className={`w-1 h-8 rounded-full ${
                isActive ? (type === 'after' ? 'bg-sky-500' : 'bg-amber-500') : 'bg-slate-700'
              }`}></div>
              <div className="overflow-hidden">
                <p className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-400'}`}>
                  {track.name}
                </p>
                <div className="flex items-center space-x-2">
                  <span className="text-[9px] uppercase font-black text-slate-500">
                    {type === 'before' ? 'Original' : 'Revived'}
                  </span>
                  {track.status === 'analyzing' && (
                    <span className="text-[8px] uppercase font-bold text-sky-400 animate-pulse">Scanning...</span>
                  )}
                  {isActive && type === 'after' && track.aiProfile && (
                    <span className="text-[8px] bg-sky-900 text-sky-300 px-1 rounded flex items-center">
                      <BeakerIcon className="w-2 h-2 mr-1" /> AI Applied
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(track.id); }}
                className="p-1 hover:text-red-500 text-slate-500"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            
            {isActive && isDone && (
              <CheckCircleIcon className={`w-4 h-4 ml-2 ${type === 'after' ? 'text-sky-500' : 'text-amber-500'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TrackList;
