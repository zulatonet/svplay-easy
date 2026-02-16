
import React, { useState, useEffect, useRef } from 'react';
import { SyncMessage, IPTVItem } from '../types';
import VideoPlayer from './VideoPlayer';

const ExoPlayerView: React.FC = () => {
  const [pin, setPin] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentContent, setCurrentContent] = useState<IPTVItem | null>(null);
  const [showUI, setShowUI] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);
  const uiTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const savedPin = localStorage.getItem('playout_active_pin');
    if (savedPin) {
      setPin(savedPin);
      setIsAuthorized(true);
    }
  }, []);

  const resetUITimer = () => {
    setShowUI(true);
    if (uiTimerRef.current) window.clearTimeout(uiTimerRef.current);
    uiTimerRef.current = window.setTimeout(() => setShowUI(false), 5000);
  };

  useEffect(() => {
    window.addEventListener('mousemove', resetUITimer);
    window.addEventListener('touchstart', resetUITimer);
    return () => {
      window.removeEventListener('mousemove', resetUITimer);
      window.removeEventListener('touchstart', resetUITimer);
    };
  }, []);

  useEffect(() => {
    if (!isAuthorized || !pin) return;
    const connectSync = () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      const es = new EventSource(`https://ntfy.sh/skysync_remote_${pin}/sse`);
      eventSourceRef.current = es;
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message) {
            const syncMsg = JSON.parse(data.message) as SyncMessage;
            if (syncMsg.pin === pin && syncMsg.type === 'PLAY_CONTENT') {
              setCurrentContent(null);
              setTimeout(() => setCurrentContent(syncMsg.payload), 100);
            }
          }
        } catch (e) {}
      };
      es.onopen = () => console.log("Exo Mode Connected");
      es.onerror = () => setTimeout(connectSync, 5000);
    };
    connectSync();
    return () => eventSourceRef.current?.close();
  }, [isAuthorized, pin]);

  // Função para disparar Intent Android (ExoPlayer/VLC/MX)
  const openExternalPlayer = () => {
    if (!currentContent) return;
    const streamUrl = currentContent.url;
    
    // Tentativa de Intent para VLC (Comum em Android TV)
    const vlcIntent = `intent://${streamUrl.replace(/^https?:\/\//, '')}#Intent;scheme=http;package=org.videolan.vlc;S.title=${encodeURIComponent(currentContent.name)};end`;
    
    // Intent genérico (abre seletor de player ou player padrão do sistema)
    const genericIntent = `intent:${streamUrl}#Intent;action=android.intent.action.VIEW;type=video/*;end`;
    
    window.location.href = vlcIntent;
    
    // Fallback se não abrir em 1 segundo
    setTimeout(() => {
        window.location.href = genericIntent;
    }, 1000);
  };

  if (!isAuthorized) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md w-full glass p-10 rounded-[3rem] space-y-6">
          <h1 className="text-4xl font-black text-red-600 italic tracking-tighter">MODO EXO</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Ative este receptor no seu painel de controle</p>
          <input 
            type="text" maxLength={4} placeholder="PIN"
            className="w-full bg-black border border-white/10 rounded-2xl px-6 py-5 text-3xl font-mono text-center text-white"
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          <button 
            onClick={() => { localStorage.setItem('playout_active_pin', pin); setIsAuthorized(true); }}
            className="w-full bg-white text-black py-5 rounded-2xl font-black text-xs uppercase"
          >
            CONECTAR PLAYER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black relative flex flex-col items-center justify-center">
      {currentContent ? (
        <div className="w-full h-full">
            <VideoPlayer url={currentContent.url} showUI={showUI} />
            
            {/* Controles de Compatibilidade Exo */}
            <div className={`absolute bottom-24 inset-x-0 z-[100] flex flex-col items-center gap-4 transition-all duration-500 ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                <div className="glass p-8 rounded-[2.5rem] border-white/10 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-6">
                    <div className="text-center">
                        <p className="text-red-500 text-[8px] font-black uppercase tracking-[0.3em] mb-1">Problemas com o Sinal?</p>
                        <h2 className="text-white text-xs font-black uppercase tracking-tight truncate w-48">{currentContent.name}</h2>
                    </div>
                    
                    <button 
                        onClick={openExternalPlayer}
                        className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-red-900/20 active:scale-95 transition-all"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                        ABRIR NO PLAYER NATIVO (EXO)
                    </button>
                    
                    <p className="text-zinc-600 text-[7px] font-bold uppercase text-center leading-tight">
                        Use esta opção em Android TV ou Celular para ignorar<br/>bloqueios de segurança do navegador.
                    </p>
                </div>
            </div>
        </div>
      ) : (
        <div className="text-center space-y-6">
          <h1 className="text-8xl font-black text-white/5 italic tracking-tighter">EXO PLAYER</h1>
          <p className="text-zinc-800 text-xs font-black uppercase tracking-[0.5em] animate-pulse">Aguardando Comando do Controle...</p>
        </div>
      )}
      
      {/* Botão de Saída rápido */}
      <button 
        onClick={() => { localStorage.removeItem('playout_active_pin'); window.location.reload(); }}
        className={`absolute top-8 left-8 z-[110] bg-white/5 hover:bg-red-600 p-4 rounded-full border border-white/5 text-white/20 hover:text-white transition-all ${showUI ? 'opacity-100' : 'opacity-0'}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
      </button>
    </div>
  );
};

export default ExoPlayerView;
