
import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { parseM3U } from './services/m3uParser';
import { savePlaylist } from './services/db';
import { PlaylistData } from './types';
import ControllerView from './components/ControllerView';
import PlayoutView from './components/PlayoutView';

// Configuração Supabase
declare const supabase: any;
const supabaseUrl = 'https://vbupelljsazvttvjjzes.supabase.co';
const supabaseKey = 'sb_publishable_af0saJoNcvOhaZIr8WvFAg_EfuLdRfX';
const client = supabase.createClient(supabaseUrl, supabaseKey);

// Contexto de Autenticação
const AuthContext = createContext<{
  user: any;
  loading: boolean;
  blockReason: 'expired' | 'inactive' | 'none';
  refreshStatus: () => Promise<void>;
} | null>(null);

const getDeviceId = () => {
  let id = localStorage.getItem('svplay_device_id');
  if (!id) {
    id = 'sv_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('svplay_device_id', id);
  }
  return id;
};

// Componente de Bloqueio de Pagamento
const PaymentBlock: React.FC<{ user: any; reason: string }> = ({ user, reason }) => {
  const waLink = `https://wa.me/5547999970313?text=Olá. Quero assinar o SVPLAY controle iptv por 1 mês. Meu email é ${user?.email}`;
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black backdrop-blur-3xl">
      <div className="max-w-md w-full glass rounded-[3rem] p-10 text-center space-y-8 animate-in zoom-in-95 shadow-2xl border-red-600/30">
        <div className="w-20 h-20 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-2">
           <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">ACESSO BLOQUEADO</h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wide leading-relaxed">
            {reason === 'expired' 
              ? 'Seu período de 15 dias de teste grátis acabou.' 
              : 'Sua assinatura está inativa ou foi suspensa.'}
            <br/>Assine agora por apenas <span className="text-white">R$ 19,90 por mês</span>.
          </p>
        </div>
        <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5">
           <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-1">PLANO MENSAL</p>
           <h3 className="text-4xl font-black text-white">R$ 19,90<span className="text-xs text-zinc-600 font-bold ml-2">/mês</span></h3>
        </div>
        <a 
          href={waLink} 
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-white shadow-xl shadow-red-900/40 active:scale-95 transition-all"
        >
          ASSINAR AGORA NO WHATSAPP
        </a>
        <button 
          onClick={() => { localStorage.removeItem('svplay_session'); window.location.reload(); }}
          className="text-[8px] font-black text-zinc-700 uppercase tracking-widest hover:text-white transition-colors"
        >
          Trocar de conta
        </button>
      </div>
    </div>
  );
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [blockReason, setBlockReason] = useState<'expired' | 'inactive' | 'none'>('none');

  const verify = useCallback(async () => {
    const session = localStorage.getItem('svplay_session');
    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(session);
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('email', parsed.email)
        .eq('password', parsed.password)
        .single();

      if (error || !data) {
        localStorage.removeItem('svplay_session');
        setUser(null);
      } else {
        const created = new Date(data.created_at).getTime();
        const diffDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
        
        if (data.active === false) {
          setBlockReason('inactive');
        } else if (diffDays > 15 && data.active === true) {
          setBlockReason('expired');
        } else {
          setBlockReason('none');
        }
        setUser(data);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { verify(); }, [verify]);

  return (
    <AuthContext.Provider value={{ user, loading, blockReason, refreshStatus: verify }}>
      {blockReason !== 'none' && <PaymentBlock user={user} reason={blockReason} />}
      {children}
    </AuthContext.Provider>
  );
};

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const location = useLocation();

  if (auth?.loading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin mb-6"></div>
        <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">Segurança SV PLAY...</p>
      </div>
    );
  }

  if (!auth?.user && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AuthModal: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const auth = useContext(AuthContext);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const deviceId = getDeviceId();

    try {
      if (isLogin) {
        const { data, error: authError } = await client
          .from('profiles')
          .select('*')
          .eq('email', email)
          .eq('password', password)
          .single();

        if (authError || !data) throw new Error("E-mail ou senha incorretos.");
        localStorage.setItem('svplay_session', JSON.stringify(data));
        await auth?.refreshStatus();
      } else {
        const { data: existingDevice } = await client
          .from('profiles')
          .select('email').eq('device_id', deviceId).maybeSingle();

        if (existingDevice) throw new Error("Este dispositivo já possui uma conta.");

        const { data, error: regError } = await client
          .from('profiles')
          .insert([{ username, email, password, device_id: deviceId, active: true }])
          .select().single();

        if (regError) throw new Error("E-mail já cadastrado.");
        localStorage.setItem('svplay_session', JSON.stringify(data));
        setShowWelcome(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (showWelcome) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black">
        <div className="max-w-md w-full glass rounded-[3.5rem] p-12 text-center space-y-8 animate-in zoom-in-95 shadow-2xl">
          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
             <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">BEM-VINDO AO SV PLAY</h2>
            <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-tight leading-relaxed">
              Parabéns por se cadastrar no SV Play. Seu controle remoto de IPTV que pode ser enviado o sinal para vários dispositivos.
            </p>
            <div className="mt-6 bg-red-600/10 p-5 rounded-2xl border border-red-600/20">
               <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">
                 Essa versão de avaliação expira em 15 dias. Após isso, entre em contato com Administrador para contratação.
               </p>
            </div>
          </div>
          <button 
            onClick={() => auth?.refreshStatus()} 
            className="w-full bg-white text-black py-6 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
          >
            ACESSAR CONTROLE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black">
      <div className="max-w-md w-full glass rounded-[3.5rem] p-12 space-y-10 animate-in zoom-in-95 shadow-2xl">
        <div className="text-center">
          <h2 className="text-6xl font-black text-red-600 italic tracking-tighter mb-2">SV PLAY</h2>
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.3em]">
            {isLogin ? 'BEM-VINDO AO CONTROLE' : 'CADASTRE-SE E GANHE 15 DIAS'}
          </p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <input type="text" placeholder="NOME DE USUÁRIO" className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl px-6 py-5 text-[10px] font-black uppercase text-white" value={username} onChange={(e) => setUsername(e.target.value)} required />
          )}
          <input type="email" placeholder="E-MAIL" className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl px-6 py-5 text-[10px] font-black uppercase text-white" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="SENHA" className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl px-6 py-5 text-[10px] font-black uppercase text-white" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-red-500 text-[9px] font-black text-center uppercase">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-red-600 py-6 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white">{loading ? '...' : isLogin ? 'ENTRAR' : 'CRIAR CONTA'}</button>
        </form>
        <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="w-full text-[9px] font-black text-zinc-600 uppercase tracking-widest">{isLogin ? 'Criar nova conta' : 'Já tenho conta'}</button>
      </div>
    </div>
  );
};

const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
    <div className="max-w-lg w-full glass rounded-[3rem] p-10 space-y-8 animate-in zoom-in-95">
      <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">CONFIGURAÇÃO DO PLAYER</h3>
      <div className="space-y-6 text-zinc-400 text-[11px] font-bold uppercase tracking-tight leading-relaxed">
        <div className="flex gap-5"><div className="w-10 h-10 rounded-2xl bg-red-600 flex-shrink-0 flex items-center justify-center text-white font-black">01</div><p>Acesse o Receptor (TV/PC): <br/><strong className="text-white text-base">svplay.cv/#/p</strong></p></div>
        <div className="flex gap-5 border-t border-white/5 pt-6"><div className="w-10 h-10 rounded-2xl bg-amber-600 flex-shrink-0 flex items-center justify-center text-white font-black">!</div><p className="text-amber-500">DICA: No Receptor, habilite 'Conteúdo Inseguro' para carregar os canais.</p></div>
      </div>
      <button onClick={onClose} className="w-full bg-white text-black py-5 rounded-2xl font-black text-[10px] uppercase">ENTENDI!</button>
    </div>
  </div>
);

const Home: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasLocalList, setHasLocalList] = useState(false);
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  // Verifica se existe uma lista localmente
  useEffect(() => {
    const pin = localStorage.getItem('skysync_active_pin');
    setHasLocalList(!!pin);
  }, []);

  // Função para processar e salvar a playlist
  const processAndSave = async (content: string, name: string, urlToSave?: string) => {
    try {
      const items = await parseM3U(content);
      if (items.length === 0) throw new Error("A lista está vazia ou é inválida.");
      
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      await savePlaylist({ 
        name, 
        items, 
        categories: Array.from(new Set(items.map(i => i.group))).sort(), 
        updatedAt: Date.now(), 
        pin 
      });

      // Se estiver logado e for uma URL, salva/substitui no Supabase
      if (auth?.user && urlToSave) {
        await client
          .from('profiles')
          .update({ playlist_url: urlToSave })
          .eq('id', auth.user.id);
      }

      localStorage.setItem('skysync_active_pin', pin);
      setHasLocalList(true);
      navigate('/controller');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const smartFetch = async (url: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro direto");
      return await response.text();
    } catch (e) {
      // Fallback para Proxy de CORS
      console.log("Tentando via Proxy CORS...");
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (!data || !data.contents) throw new Error("Não foi possível acessar a lista mesmo via proxy.");
      return data.contents;
    }
  };

  const handleUrlLoad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    setLoading(true);
    setStatus('Baixando Lista...');
    
    try {
      const text = await smartFetch(urlInput);
      await processAndSave(text, "Lista Remota", urlInput);
    } catch (e: any) {
      alert(`Erro crítico ao carregar lista. Verifique o link ou tente carregar via arquivo M3U.`);
      setLoading(false);
      setStatus('');
    }
  };

  const handleLoadSavedList = async () => {
    if (!auth?.user?.playlist_url) return;
    setLoading(true);
    setStatus('Recuperando Nuvem...');
    try {
      const text = await smartFetch(auth.user.playlist_url);
      await processAndSave(text, "Minha Lista", auth.user.playlist_url);
    } catch (e: any) {
      alert(`Erro ao recuperar lista da nuvem: ${e.message}`);
      setLoading(false);
      setStatus('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setStatus('Lendo Arquivo...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      await processAndSave(event.target?.result as string, file.name);
    };
    reader.readAsText(file);
  };

  return (
    <>
      {!auth?.user && <AuthModal />}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      
      <div className="min-h-screen bg-black flex flex-col items-center justify-start pt-6 px-6 overflow-y-auto">
        <div className="max-w-md w-full space-y-4 animate-in zoom-in-95 duration-500">
          <div className="text-center">
             <h1 className="text-6xl sm:text-7xl font-black text-red-600 italic tracking-tighter">SV PLAY</h1>
             <p className="text-zinc-700 text-[10px] font-black uppercase tracking-[0.5em]">CONTROLE IPTV</p>
          </div>

          <div className="glass p-6 sm:p-8 rounded-[3rem] space-y-6 border border-white/5 shadow-2xl">
            {/* Atalho para lista existente */}
            {(hasLocalList || (auth?.user?.playlist_url)) && !loading && (
              <button 
                onClick={hasLocalList ? () => navigate('/controller') : handleLoadSavedList}
                className="w-full bg-white text-black py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 border-4 border-white/10"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                {hasLocalList ? 'VOLTAR AO CONTROLE' : 'MINHA LISTA SALVA'}
              </button>
            )}

            <div className="bg-white/5 p-4 rounded-3xl border border-white/5 text-center">
               <p className="text-zinc-600 text-[8px] font-black uppercase mb-1">Endereço do Receptor</p>
               <h2 className="text-xl font-mono font-black text-white">svplay.cv/#/p</h2>
            </div>

            {/* Opção URL */}
            <form onSubmit={handleUrlLoad} className="space-y-4">
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Importar Novo Link (Substituir)</p>
              <div className="relative">
                <input 
                  type="url" 
                  placeholder="COLE A URL .M3U AQUI" 
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl px-6 py-4 text-[10px] font-black text-white outline-none focus:border-red-600 transition-all placeholder:text-zinc-700"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={loading}
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-red-600 text-white p-2 rounded-xl hover:bg-red-700 transition-all active:scale-90"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            </form>

            <div className="flex items-center gap-4">
               <div className="flex-1 h-[1px] bg-white/5"></div>
               <span className="text-[8px] font-black text-zinc-800 uppercase">OU</span>
               <div className="flex-1 h-[1px] bg-white/5"></div>
            </div>

            {/* Opção Arquivo */}
            <label className="block w-full cursor-pointer group">
              <div className="border-2 border-dashed border-red-600/20 rounded-[2.5rem] py-8 text-center bg-red-600/5 group-hover:bg-red-600/10 transition-all">
                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                  {loading ? status : 'ENVIAR ARQUIVO M3U'}
                </span>
              </div>
              <input type="file" className="hidden" accept=".m3u" onChange={handleFileUpload} disabled={loading} />
            </label>

            <button onClick={() => setShowTutorial(true)} className="w-full text-zinc-600 hover:text-white font-black text-[9px] uppercase tracking-[0.3em]">Manual de Instalação</button>
          </div>

          {auth?.user && (
            <div className="flex flex-col items-center gap-2 pb-8">
              <p className="text-zinc-800 text-[8px] font-black uppercase tracking-[0.5em]">CONECTADO COMO: {auth.user.username}</p>
              <button 
                onClick={() => { localStorage.removeItem('svplay_session'); localStorage.removeItem('skysync_active_pin'); window.location.reload(); }} 
                className="text-zinc-600 hover:text-red-600 text-[7px] font-black uppercase tracking-widest border border-white/5 px-6 py-2 rounded-full"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/controller" element={<AuthGuard><ControllerView /></AuthGuard>} />
          <Route path="/p" element={<PlayoutView />} />
          <Route path="/:pin" element={<PlayoutView />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
