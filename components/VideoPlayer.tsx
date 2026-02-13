
import React, { useEffect, useRef, useState } from 'react';

declare const Hls: any;
declare const mpegts: any;

interface VideoPlayerProps {
  url: string;
  onClose?: () => void;
  showUI?: boolean; // Recebe o estado de visibilidade da UI pai
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, onClose, showUI = true }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const tsPlayerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInsecureWarning, setShowInsecureWarning] = useState(false);
  
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('audio_globally_unlocked') !== 'true';
  });

  const getProcessedUrl = (inputUrl: string) => {
    let finalUrl = inputUrl.trim();
    const lowerUrl = finalUrl.toLowerCase();
    
    // Se for um arquivo de vídeo conhecido, retorna direto
    if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mkv') || lowerUrl.includes('.avi') || lowerUrl.includes('.ts')) {
      return finalUrl;
    }

    // Se a URL já for um m3u8 explícito, retorna
    if (lowerUrl.includes('.m3u8')) {
        return finalUrl;
    }

    // Lógica para links sem extensão: muitos links IPTV m3u8 não terminam em .m3u8
    // Se a URL contém /live/ ou /m3u8/ ou parece um link de painel, e não tem extensão, 
    // tentamos anexar .m3u8 apenas se não houver parâmetros de busca (?)
    const urlObj = new URL(finalUrl);
    if (!urlObj.pathname.includes('.') && !urlObj.search) {
        // Se for um link limpo de painel, anexamos .m3u8 para forçar o HLS.js a tentar
        return `${finalUrl}.m3u8`;
    }

    return finalUrl;
  };

  const processedUrl = getProcessedUrl(url);
  const lowerProcessed = processedUrl.toLowerCase();
  const isMP4 = lowerProcessed.includes('.mp4') || lowerProcessed.includes('.mkv') || lowerProcessed.includes('.mov');
  const isHLS = lowerProcessed.includes('.m3u8') || lowerProcessed.includes('output=hls') || lowerProcessed.includes('stream') || lowerProcessed.includes('chunklist');

  const cleanUp = () => {
    if (hlsRef.current) { 
      hlsRef.current.destroy(); 
      hlsRef.current = null; 
    }
    if (tsPlayerRef.current) {
      try {
        tsPlayerRef.current.unload();
        tsPlayerRef.current.detachMediaElement();
        tsPlayerRef.current.destroy();
      } catch (e) {}
      tsPlayerRef.current = null;
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
      if (videoRef.current) {
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!processedUrl || !videoRef.current) return;
    setError(null);
    setLoading(true);
    setShowInsecureWarning(false);
    cleanUp();

    const insecureTimer = setTimeout(() => {
      if (loading && !isMP4) setShowInsecureWarning(true);
    }, 8000);

    try {
      if (isMP4) {
        videoRef.current.src = processedUrl;
        videoRef.current.oncanplay = attemptPlay;
      } 
      else if (isHLS && Hls.isSupported()) {
        const hls = new Hls({ 
          enableWorker: true, 
          maxBufferLength: 10,
          maxMaxBufferLength: 15,
          maxBufferSize: 30 * 1000 * 1000,
          lowLatencyMode: true
        });
        hlsRef.current = hls;
        hls.loadSource(processedUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, attemptPlay);
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setShowInsecureWarning(true);
          }
        });
      }
      else if (mpegts.getFeatureList().mseLivePlayback) {
        const player = mpegts.createPlayer({ type: 'mse', isLive: true, url: processedUrl });
        tsPlayerRef.current = player;
        player.attachMediaElement(videoRef.current);
        player.load();
        setTimeout(attemptPlay, 1000);
      } else {
        videoRef.current.src = processedUrl;
        attemptPlay();
      }
    } catch (e) {
      setError("Falha ao iniciar player.");
    }

    return () => {
      clearTimeout(insecureTimer);
      cleanUp();
    };
  }, [processedUrl]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {loading && (
         <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black">
            <div className="w-8 h-8 border-4 border-white/5 border-t-red-600 rounded-full animate-spin"></div>
         </div>
      )}

      {showInsecureWarning && showUI && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-6 animate-in fade-in zoom-in duration-300">
          <div className="bg-black/90 backdrop-blur-xl p-6 rounded-[2rem] border border-white/10 text-center shadow-2xl">
            <p className="text-amber-500 text-[8px] font-black uppercase tracking-widest leading-relaxed mb-4">
              Sinal Lento ou Bloqueio Detectado
            </p>
            <button 
              onClick={() => window.open(processedUrl, '_blank')}
              className="bg-white text-black px-6 py-4 rounded-2xl text-[9px] font-black uppercase w-full active:scale-95 transition-all"
            >
              ABRIR LINK EXTERNO
            </button>
          </div>
        </div>
      )}

      {error && showUI && (
        <div className="text-center p-8 z-40 bg-zinc-950 border border-white/5 rounded-[2.5rem] max-w-sm mx-auto shadow-2xl">
          <p className="text-zinc-600 text-[8px] font-bold uppercase mb-6 leading-relaxed">{error}</p>
          <button onClick={onClose} className="w-full py-4 bg-red-600 rounded-2xl font-black text-[9px] text-white uppercase">FECHAR</button>
        </div>
      )}

      <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted={isMuted} />

      <div className={`transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {isMuted && !loading && (
          <button onClick={() => { setIsMuted(false); localStorage.setItem('audio_globally_unlocked', 'true'); }} className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 bg-white text-black px-8 py-4 rounded-full text-[9px] font-black uppercase shadow-2xl animate-bounce">
            ATIVAR ÁUDIO
          </button>
        )}
        
        <button onClick={onClose} className="absolute top-8 right-8 z-50 p-4 bg-black/40 backdrop-blur-xl rounded-full text-white/40 hover:text-white hover:bg-red-600 transition-all border border-white/5">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer;
