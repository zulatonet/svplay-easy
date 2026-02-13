
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IPTVItem, PlaylistData, SyncMessage } from '../types';
import { getPlaylistByPin } from '../services/db';

const TMDB_API_KEY = 'ec9e8695944e2b358a4ee1836e874084';

interface InfoModalProps {
  item: IPTVItem;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onPlay: (item: IPTVItem) => void;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ item, isFavorite, onToggleFavorite, onPlay, onClose }) => {
  const [details, setDetails] = useState<{ poster?: string, overview?: string, rating?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item.type === 'movie' || item.type === 'series') {
      setLoading(true);
      const searchType = item.type === 'movie' ? 'movie' : 'tv';
      const cleanName = item.name.replace(/\(.*\)|4K|FHD|HD|SD|H264|H265|DUAL|LEG/gi, '').trim();
      
      fetch(`https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}&language=pt-BR`)
        .then(res => res.json())
        .then(data => {
          if (data.results && data.results.length > 0) {
            const res = data.results[0];
            setDetails({
              poster: res.poster_path ? `https://image.tmdb.org/t/p/w500${res.poster_path}` : undefined,
              overview: res.overview,
              rating: res.vote_average
            });
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [item]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md glass rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 border-white/10">
        <div className="relative aspect-[3/4] bg-zinc-900 overflow-hidden">
          {details?.poster || item.logo ? (
            <img src={details?.poster || item.logo} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-800 font-black italic text-4xl">SV</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20"></div>
          
          <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-black/50 rounded-full text-white/70">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="absolute bottom-8 left-8 right-8 space-y-3">
             <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight">{item.name}</h3>
             <div className="flex items-center gap-3">
                <span className="bg-red-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">{item.group}</span>
                {details?.rating && <span className="text-amber-500 font-black text-xs">★ {details.rating.toFixed(1)}</span>}
             </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <p className="text-zinc-400 text-[11px] font-bold uppercase leading-relaxed max-h-24 overflow-y-auto custom-scroll">
            {details?.overview || "Programação e detalhes não disponíveis no momento para este canal."}
          </p>
          <div className="flex gap-4">
            <button onClick={() => { onPlay(item); onClose(); }} className="flex-1 bg-red-600 py-5 rounded-2xl font-black text-[10px] text-white uppercase tracking-widest active:scale-95 transition-all">REPRODUZIR AGORA</button>
            <button onClick={() => onToggleFavorite(item.id)} className={`p-5 rounded-2xl border transition-all ${isFavorite ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 text-white/30'}`}>
               <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ControllerView: React.FC = () => {
  const [playlist, setPlaylist] = useState<PlaylistData | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [pin, setPin] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('svplay_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedItem, setSelectedItem] = useState<IPTVItem | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Refs para controle de clique vs scroll inteligente
  const startPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    const savedPin = localStorage.getItem('skysync_active_pin');
    if (savedPin) {
      setPin(savedPin);
      getPlaylistByPin(savedPin).then(data => setPlaylist(data));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('svplay_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const filteredItems = useMemo(() => {
    if (!playlist) return [];
    let items = playlist.items;
    if (showFavoritesOnly) {
      items = items.filter(i => favorites.includes(i.id));
    } else if (activeCategory !== 'All') {
      items = items.filter(i => i.group === activeCategory);
    }
    if (search) {
      const s = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(s));
    }
    return items;
  }, [playlist, activeCategory, search, favorites, showFavoritesOnly]);

  const displayedItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      setVisibleCount(prev => prev + 50);
    }
  };

  const playOnRemote = async (item: IPTVItem) => {
    const msg: SyncMessage = { type: 'PLAY_CONTENT', payload: item, pin };
    try {
      await fetch(`https://ntfy.sh/skysync_remote_${pin}`, { method: 'POST', body: JSON.stringify(msg) });
      new BroadcastChannel('skysync_sync').postMessage(msg);
    } catch (e) {}
    
    const toast = document.createElement('div');
    toast.className = "fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-4 rounded-full text-[9px] font-black z-[2000] animate-in slide-in-from-bottom-2 shadow-2xl uppercase tracking-widest";
    toast.innerText = `SINAL ENVIADO: ${item.name}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  // Detecção de clique inteligente para abrir modal
  const onTouchStart = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    startPos.current = { x: pos.clientX, y: pos.clientY };
    isDragging.current = false;
  };

  const onTouchMove = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    const dist = Math.sqrt(Math.pow(pos.clientX - startPos.current.x, 2) + Math.pow(pos.clientY - startPos.current.y, 2));
    if (dist > 8) {
      isDragging.current = true;
    }
  };

  const onItemClick = (item: IPTVItem) => {
    // Se não houver arraste significativo, abre o modal
    if (!isDragging.current) {
      setSelectedItem(item);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col fixed inset-0 overflow-hidden select-none">
      {selectedItem && (
        <InfoModal 
          item={selectedItem}
          isFavorite={favorites.includes(selectedItem.id)}
          onToggleFavorite={toggleFavorite}
          onPlay={playOnRemote}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Cabeçalho */}
      <header className="px-5 py-5 bg-black flex flex-col gap-4 border-b border-white/5 shadow-xl">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
             <h1 className="text-2xl font-black text-red-600 italic tracking-tighter uppercase">SV PLAY</h1>
             <button 
                onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setActiveCategory('All'); }}
                className={`p-2 rounded-xl border transition-all ${showFavoritesOnly ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-900/30' : 'bg-white/5 border-white/5 text-zinc-600'}`}
             >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
             </button>
           </div>
           <div className="bg-zinc-900/50 px-3 py-2 rounded-xl border border-white/5 flex gap-2">
              <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">PIN:</span>
              <span className="text-xs font-mono font-black text-white">{pin}</span>
           </div>
        </div>
        <div className="relative">
           <input 
            type="text" 
            placeholder="PESQUISAR" 
            className="w-full bg-zinc-950 border border-white/5 rounded-xl px-6 py-4 text-[9px] font-black uppercase text-white outline-none placeholder:text-zinc-800 focus:border-red-600/30 transition-all select-text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setVisibleCount(50); }}
           />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-32 overflow-y-auto bg-black border-r border-white/5 scrollbar-hide">
          <button 
            onClick={() => { setActiveCategory('All'); setShowFavoritesOnly(false); setVisibleCount(50); }}
            className={`w-full text-left px-5 py-4 text-[9px] font-black uppercase tracking-tight transition-all border-b border-white/5 ${activeCategory === 'All' && !showFavoritesOnly ? 'bg-red-600 text-white' : 'text-zinc-500'}`}
          >
            TODOS
          </button>
          {playlist?.categories.map(cat => (
            <button 
              key={cat}
              onClick={() => { setActiveCategory(cat); setShowFavoritesOnly(false); setVisibleCount(50); }}
              className={`w-full text-left px-5 py-4 text-[8px] font-black uppercase tracking-tight border-b border-white/5 transition-all ${activeCategory === cat && !showFavoritesOnly ? 'bg-red-600 text-white' : 'text-zinc-400'}`}
            >
              {cat}
            </button>
          ))}
        </aside>

        {/* Lista de Canais */}
        <main onScroll={handleScroll} className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-black">
          {displayedItems.map(item => (
            <div 
              key={item.id}
              onMouseDown={onTouchStart}
              onMouseMove={onTouchMove}
              onMouseUp={() => onItemClick(item)}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={() => onItemClick(item)}
              className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-white/5 rounded-xl active:bg-zinc-900 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-1.5">
                   {favorites.includes(item.id) && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_5px_rgba(245,158,11,0.5)]"></div>}
                   <p className="text-[10px] font-black text-white uppercase truncate tracking-tight">{item.name}</p>
                </div>
                <p className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">▶{item.group}</p>
              </div>
              
              {/* Botão de Play Exclusivo */}
              <button 
                onClick={(e) => { e.stopPropagation(); playOnRemote(item); }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="w-10 h-10 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-600 hover:bg-red-600 hover:text-white transition-all shadow-lg active:scale-90"
              >
                 <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </button>
            </div>
          ))}
          {displayedItems.length < filteredItems.length && (
            <div className="py-8 text-center text-[7px] font-black text-zinc-800 uppercase tracking-widest animate-pulse">Sincronizando...</div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ControllerView;
