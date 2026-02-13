
import React, { useState, useEffect, useRef } from 'react';
import { SyncMessage, IPTVItem } from '../types';
import VideoPlayer from './VideoPlayer';

const PlayoutView: React.FC = () => {
  const [pin, setPin] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentContent, setCurrentContent] = useState<IPTVItem | null>(null);
  const [lastSignal, setLastSignal] = useState<string>('');
  const [needsInteraction, setNeedsInteraction] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uiTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const savedPin = localStorage.getItem('playout_active_pin');
    if (savedPin) {
      setPin(savedPin);
      setIsAuthorized(true);
    }
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const resetUITimer = () => {
    setShowUI(true);
    if (uiTimerRef.current) window.clearTimeout(uiTimerRef.current);
    uiTimerRef.current = window.setTimeout(() => {
      setShowUI(false);
    }, 4000); // 4 segundos de visibilidade
  };

  useEffect(() => {
    window.addEventListener('mousemove', resetUITimer);
    window.addEventListener('touchstart', resetUITimer);
    window.addEventListener('keydown', resetUITimer);
    return () => {
      window.removeEventListener('mousemove', resetUITimer);
      window.removeEventListener('touchstart', resetUITimer);
      window.removeEventListener('keydown', resetUITimer);
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length >= 4) {
      localStorage.setItem('playout_active_pin', pin);
      setIsAuthorized(true);
    }
  };

  const handleLogout = () => {
    if (!confirm("Deseja desconectar este playout?")) return;
    localStorage.removeItem('playout_active_pin');
    setIsAuthorized(false);
    setPin('');
    setCurrentContent(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (!isAuthorized || !pin) return;
    const connectCloud = () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      const es = new EventSource(`https://ntfy.sh/skysync_remote_${pin}/sse`);
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message) {
            const syncMsg = JSON.parse(data.message) as SyncMessage;
            if (syncMsg.pin === pin && syncMsg.type === 'PLAY_CONTENT') {
              setLastSignal(syncMsg.payload.name);
              setCurrentContent(null); 
              setTimeout(() => setCurrentContent(syncMsg.payload), 100);
              setTimeout(() => setLastSignal(''), 5000);
            }
          }
        } catch (e) {}
      };
      es.onerror = () => setTimeout(connectCloud, 5000);
    };
    connectCloud();
    return () => { if (eventSourceRef.current) eventSourceRef.current.close(); };
  }, [isAuthorized, pin]);

  if (!isAuthorized) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-xs w-full animate-in zoom-in-95 duration-500">
          <h1 className="text-6xl font-black text-red-600 italic tracking-tighter mb-2">SV PLAY</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="text" maxLength={4} placeholder="0000"
              className="w-full bg-zinc-900 border-2 border-white/5 rounded-3xl px-6 py-8 text-4xl font-mono font-black text-center text-white outline-none"
              value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" className="w-full bg-red-600 py-6 rounded-3xl font-black text-xs uppercase text-white">ATIVAR RECEPTOR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`h-screen w-screen bg-black overflow-hidden flex flex-col items-center justify-center relative select-none transition-all duration-500 ${!showUI ? 'cursor-none' : ''}`}
    >
      {needsInteraction && (
        <div onClick={() => setNeedsInteraction(false)} className="absolute inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center cursor-pointer">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center animate-pulse mb-6">
             <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" /></svg>
          </div>
          <p className="text-zinc-500 font-black text-[9px] uppercase tracking-[0.4em]">Toque para Iniciar</p>
        </div>
      )}

      {/* Interface de Overlay */}
      <div className={`absolute top-0 inset-x-0 p-8 z-[60] flex justify-between items-start transition-opacity duration-700 pointer-events-none ${showUI ? 'opacity-100' : 'opacity-0'}`}>
         {lastSignal ? (
            <div className="bg-black/80 backdrop-blur-md text-white px-6 py-4 rounded-2xl border border-white/5">
               <span className="text-red-600 font-black text-[10px] mr-3">AO VIVO</span>
               <span className="text-[10px] font-black uppercase tracking-tight">{lastSignal}</span>
            </div>
         ) : <div />}
         <div className="flex gap-4 pointer-events-auto">
            <button onClick={toggleFullscreen} className="bg-white/5 text-white/50 p-3 rounded-full border border-white/5">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
            <button onClick={handleLogout} className="bg-white/5 px-6 py-3 rounded-full text-[8px] font-black uppercase text-white/50 border border-white/5">Desconectar</button>
         </div>
      </div>

      {currentContent ? (
        <VideoPlayer 
          url={currentContent.url} 
          onClose={() => setCurrentContent(null)}
          showUI={showUI}
        />
      ) : (
        <div className="text-center opacity-[0.03] pointer-events-none">
          <h1 className="text-[15vw] font-black text-white italic tracking-tighter leading-none">SV PLAY</h1>
        </div>
      )}
    </div>
  );
};

export default PlayoutView;
