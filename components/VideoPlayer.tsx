
import React, { useEffect, useRef, useState } from 'react';

declare const Hls: any;
declare const mpegts: any;

interface VideoPlayerProps {
  url: string;
  onClose?: () => void;
  showUI?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, onClose, showUI = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const tsPlayerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInsecureWarning, setShowInsecureWarning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Estados de Tempo
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekIndicator, setSeekIndicator] = useState<{ type: 'forward' | 'backward' | 'play' | 'pause', visible: boolean }>({ type: 'forward', visible: false });
  
  const seekTimerRef = useRef<number | null>(null);
  const tapTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('audio_globally_unlocked') !== 'true';
  });

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getProcessedUrl = (inputUrl: string) => {
    let finalUrl = inputUrl.trim();
    const lowerUrl = finalUrl.toLowerCase();
    if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mkv') || lowerUrl.includes('.avi') || lowerUrl.includes('.ts')) return finalUrl;
    if (lowerUrl.includes('.m3u8')) return finalUrl;
    const urlObj = new URL(finalUrl);
    if (!urlObj.pathname.includes('.') && !urlObj.search) return `${finalUrl}.m3u8`;
    return finalUrl;
  };

  const processedUrl = getProcessedUrl(url);
  const lowerProcessed = processedUrl.toLowerCase();
  const isMP4 = lowerProcessed.includes('.mp4') || lowerProcessed.includes('.mkv') || lowerProcessed.includes('.mov');
  const isHLS = lowerProcessed.includes('.m3u8') || lowerProcessed.includes('output=hls') || lowerProcessed.includes('stream') || lowerProcessed.includes('chunklist');

  const showFeedback = (type: 'forward' | 'backward' | 'play' | 'pause') => {
    setSeekIndicator({ type, visible: true });
    if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
    seekTimerRef.current = window.setTimeout(() => setSeekIndicator(prev => ({ ...prev, visible: false })), 800);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      showFeedback('play');
    } else {
      videoRef.current.pause();
      showFeedback('pause');
    }
  };

  const seek = (seconds: number) => {
    if (!videoRef.current || !isMP4) return;
    const newTime = videoRef.current.currentTime + seconds;
    videoRef.current.currentTime = Math.max(0, Math.min(newTime, videoRef.current.duration));
    showFeedback(seconds > 0 ? 'forward' : 'backward');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'MediaPlayPause') {
        e.preventDefault();
        togglePlay();
      }
      if (!isMP4) return;
      if (e.key === 'ArrowRight') seek(300);
      if (e.key === 'ArrowLeft') seek(-300);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMP4]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isMP4) {
        togglePlay();
        return;
    }
    
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double Tap (Seek)
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const screenWidth = window.innerWidth;
      if (clientX > screenWidth / 2) seek(300); else seek(-300);
      lastTapRef.current = 0; // Reset
    } else {
      // Single Tap (Wait for double tap)
      lastTapRef.current = now;
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      tapTimerRef.current = window.setTimeout(() => {
        togglePlay();
        lastTapRef.current = 0;
      }, DOUBLE_TAP_DELAY);
    }
  };

  const cleanUp = () => {
    if (hlsRef.current) hlsRef.current.destroy();
    if (tsPlayerRef.current) {
      try { tsPlayerRef.current.unload(); tsPlayerRef.current.detachMediaElement(); tsPlayerRef.current.destroy(); } catch (e) {}
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  };

  const attemptPlay = async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.muted = isMuted;
      await videoRef.current.play();
      setLoading(false);
      setShowInsecureWarning(false);
    } catch (err) {
      if (videoRef.current) { videoRef.current.muted = true; videoRef.current.play().catch(() => {}); }
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!processedUrl || !videoRef.current) return;
    setError(null); setLoading(true); setShowInsecureWarning(false);
    cleanUp();
    const insecureTimer = setTimeout(() => { if (loading && !isMP4) setShowInsecureWarning(true); }, 8000);

    try {
      if (isMP4) {
        videoRef.current.src = processedUrl;
        videoRef.current.oncanplay = attemptPlay;
      } else if (isHLS && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, maxBufferLength: 10, lowLatencyMode: true });
        hlsRef.current = hls; hls.loadSource(processedUrl); hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, attemptPlay);
        hls.on(Hls.Events.ERROR, (_: any, data: any) => { if (data.fatal) setShowInsecureWarning(true); });
      } else if (mpegts.getFeatureList().mseLivePlayback) {
        const player = mpegts.createPlayer({ type: 'mse', isLive: true, url: processedUrl });
        tsPlayerRef.current = player; player.attachMediaElement(videoRef.current); player.load(); setTimeout(attemptPlay, 1000);
      } else { videoRef.current.src = processedUrl; attemptPlay(); }
    } catch (e) { setError("Falha ao iniciar player."); }
    return () => { clearTimeout(insecureTimer); cleanUp(); };
  }, [processedUrl]);

  return (
    <div 
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      onClick={handleInteraction}
    >
      {loading && (
         <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black">
            <div className="w-8 h-8 border-4 border-white/5 border-t-red-600 rounded-full animate-spin"></div>
         </div>
      )}

      {/* Indicador Visual Central */}
      <div className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-all duration-300 ${seekIndicator.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
        <div className="bg-black/60 backdrop-blur-3xl px-12 py-8 rounded-[3rem] border border-white/10 flex flex-col items-center gap-4">
           {seekIndicator.type === 'forward' && <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>}
           {seekIndicator.type === 'backward' && <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>}
           {seekIndicator.type === 'play' && <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
           {seekIndicator.type === 'pause' && <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>}
           {(seekIndicator.type === 'forward' || seekIndicator.type === 'backward') && (
              <span className="text-xl font-black text-white italic tracking-tighter">{seekIndicator.type === 'forward' ? '+ 5:00' : '- 5:00'}</span>
           )}
        </div>
      </div>

      <video 
        ref={videoRef} 
        className="w-full h-full object-contain" 
        autoPlay playsInline 
        muted={isMuted}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onPlay={() => setIsPaused(false)}
        onPause={() => setIsPaused(true)}
      />

      {/* Barra de Progresso e Tempo VOD */}
      {isMP4 && (
        <div className={`absolute bottom-0 inset-x-0 p-8 z-[60] bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
           <div className="flex items-center gap-4 mb-2">
              <span className="text-[10px] font-mono font-black text-white bg-red-600 px-2 py-0.5 rounded">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                 <div className="h-full bg-red-600" style={{ width: `${(currentTime/duration)*100}%` }}></div>
              </div>
              <span className="text-[10px] font-mono font-black text-zinc-500">{formatTime(duration)}</span>
           </div>
        </div>
      )}

      <div className={`transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isMuted && !loading && (
          <button onClick={(e) => { e.stopPropagation(); setIsMuted(false); localStorage.setItem('audio_globally_unlocked', 'true'); }} className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 bg-white text-black px-8 py-4 rounded-full text-[9px] font-black uppercase shadow-2xl animate-bounce">ATIVAR ÁUDIO</button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onClose?.(); }} className="absolute top-8 right-8 z-50 p-4 bg-black/40 backdrop-blur-xl rounded-full text-white/40 hover:text-white hover:bg-red-600 transition-all border border-white/5">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer;
