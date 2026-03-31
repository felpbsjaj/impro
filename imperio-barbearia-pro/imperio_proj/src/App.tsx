import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  createUserWithEmailAndPassword,
  getAuth as getAuthClient
} from 'firebase/auth';
import { 
  collection, 
  query, 
  getDoc, 
  doc, 
  addDoc, 
  setDoc,
  deleteDoc, 
  orderBy, 
  Timestamp,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Scissors, 
  BarChart3, 
  Users, 
  Tags, 
  LogOut, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  QrCode,
  Banknote,
  CreditCard,
  Percent,
  Mail,         // Ícone novo
  Lock,         // Ícone novo
  ArrowRight    // Ícone novo
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

import { auth, db } from './lib/firebase';
import { cn, formatCurrency } from './lib/utils';
import { UserData, Servico, Registro } from './types';

// --- Secondary Firebase App for Admin Tasks ---
const secondaryConfig = {
  apiKey: "AIzaSyA7ISbwf_RCg_3IRTOboeV1Y9W4_wf8HY4",
  authDomain: "barb-imperio.firebaseapp.com",
  projectId: "barb-imperio",
  storageBucket: "barb-imperio.firebasestorage.app",
  messagingSenderId: "1011188015253",
  appId: "1:1011188015253:web:bc824812e8ac6628017b9c"
};

const getSecondaryAuth = () => {
  const app = getApps().find(a => a.name === 'secondary') || initializeApp(secondaryConfig, 'secondary');
  return getAuthClient(app);
};

// --- Helpers ---
const hoje = () => format(new Date(), 'yyyy-MM-dd');

// --- Components ---

const StatCard = ({ title, value, subValue, icon: Icon, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl backdrop-blur-xl"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</div>
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon size={20} />
      </div>
    </div>
    <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
    <div className="text-xs text-zinc-400 mt-2 flex items-center gap-1">
      {subValue}
    </div>
  </motion.div>
);

const Modal = ({ isOpen, onClose, title, children }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
        >
          <div className="text-xl font-bold text-white mb-6 text-center">{title}</div>
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Data State
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [barbeiros, setBarbeiros] = useState<UserData[]>([]);
  const [dateRange, setDateRange] = useState({ 
    start: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  // Modals State
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [isBarbeiroModalOpen, setIsBarbeiroModalOpen] = useState(false);
  const [isServicoModalOpen, setIsServicoModalOpen] = useState(false);
  
  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [discount, setDiscount] = useState(0);
  
  const [editingBarbeiro, setEditingBarbeiro] = useState<UserData | null>(null);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);

  // Form States
  const [barbForm, setBarbForm] = useState({ nome: '', email: '', password: '', sede: 'Matriz', porcentagem: 60 });
  const [srvForm, setSrvForm] = useState({ nome: '', valor: 0 });
  const isMounted = React.useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const docSnap = await getDoc(doc(db, 'usuarios', user.uid));
          if (isMounted.current) {
            if (docSnap.exists()) {
              setUserData({ uid: user.uid, ...docSnap.data() } as UserData);
              setUser(user);
            } else {
              await signOut(auth);
            }
          }
        } else {
          if (isMounted.current) {
            setUser(null);
            setUserData(null);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && isMounted.current) {
          console.error("Auth change error:", err);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubServicos = onSnapshot(collection(db, 'servicos'), (snap) => {
      if (isMounted.current) {
        setServicos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Servico)));
      }
    }, (err) => {
      if (err.name !== 'AbortError') console.error("Servicos snapshot error:", err);
    });

    const unsubRegistros = onSnapshot(
      query(collection(db, 'registros'), orderBy('timestamp', 'desc')), 
      (snap) => {
        if (isMounted.current) {
          setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() } as Registro)));
        }
      },
      (err) => {
        if (err.name !== 'AbortError') console.error("Registros snapshot error:", err);
      }
    );

    const unsubBarbeiros = onSnapshot(collection(db, 'usuarios'), (snap) => {
      if (isMounted.current) {
        setBarbeiros(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserData)).filter(u => u.role !== 'admin'));
      }
    }, (err) => {
      if (err.name !== 'AbortError') console.error("Barbeiros snapshot error:", err);
    });

    return () => {
      unsubServicos();
      unsubRegistros();
      unsubBarbeiros();
    };
  }, [user]);

  // --- Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError('E-mail ou senha inválidos.');
    }
  };

  const handleRegister = async () => {
    if (!selectedServico || !paymentMethod || !userData) return;

    const baseValue = selectedServico.valor;
    const finalValue = baseValue - discount;

    try {
      await addDoc(collection(db, 'registros'), {
        barbeiroId: userData.uid,
        barbeiroNome: userData.nome,
        sede: userData.sede || 'Matriz',
        servicoId: selectedServico.id,
        servicoNome: selectedServico.nome,
        valorTabela: baseValue,
        desconto: discount,
        valorFinal: finalValue,
        pagamento: paymentMethod,
        porcentagem: userData.porcentagem || 100,
        isOwnerCut: userData.role === 'admin',
        timestamp: Timestamp.now(),
        data: hoje()
      });

      setIsRegModalOpen(false);
      setSelectedServico(null);
      setPaymentMethod('');
      setDiscount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBarbeiro = async () => {
    if (!barbForm.nome || (!editingBarbeiro && !barbForm.email)) return;

    try {
      if (editingBarbeiro) {
        await updateDoc(doc(db, 'usuarios', editingBarbeiro.uid), {
          nome: barbForm.nome,
          sede: barbForm.sede,
          porcentagem: barbForm.porcentagem
        });
      } else {
        const secondaryAuth = getSecondaryAuth();
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, barbForm.email, barbForm.password);
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          nome: barbForm.nome,
          email: barbForm.email,
          role: 'barbeiro',
          sede: barbForm.sede,
          porcentagem: barbForm.porcentagem
        });
        await signOut(secondaryAuth);
      }
      setIsBarbeiroModalOpen(false);
      setEditingBarbeiro(null);
      setBarbForm({ nome: '', email: '', password: '', sede: 'Matriz', porcentagem: 60 });
    } catch (err: any) {
      alert('Erro ao salvar barbeiro: ' + err.message);
    }
  };

  const handleSaveServico = async () => {
    if (!srvForm.nome || srvForm.valor <= 0) return;

    try {
      if (editingServico) {
        await updateDoc(doc(db, 'servicos', editingServico.id), {
          nome: srvForm.nome,
          valor: srvForm.valor
        });
      } else {
        await addDoc(collection(db, 'servicos'), {
          nome: srvForm.nome,
          valor: srvForm.valor
        });
      }
      setIsServicoModalOpen(false);
      setEditingServico(null);
      setSrvForm({ nome: '', valor: 0 });
    } catch (err: any) {
      alert('Erro ao salvar serviço: ' + err.message);
    }
  };

  // --- Memoized Data ---

  const filteredRegistros = useMemo(() => {
    return registros.filter(r => {
      return r.data >= dateRange.start && r.data <= dateRange.end;
    });
  }, [registros, dateRange]);

  const stats = useMemo(() => {
    const totalFat = filteredRegistros.reduce((acc, r) => acc + r.valorFinal, 0);
    let bolso = 0;
    filteredRegistros.forEach(r => {
      if (r.barbeiroId === userData?.uid || r.isOwnerCut) {
        bolso += r.valorFinal;
      } else {
        const commissionRate = r.porcentagem || 0;
        bolso += r.valorFinal * ((100 - commissionRate) / 100);
      }
    });
    const totalDesc = filteredRegistros.reduce((acc, r) => acc + (r.desconto || 0), 0);
    
    return { totalFat, bolso, totalDesc, count: filteredRegistros.length };
  }, [filteredRegistros, userData]);

  const chartData = useMemo(() => {
    const days: any = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'dd/MM');
      days[d] = 0;
    }
    
    filteredRegistros.forEach(r => {
      const d = format(parseISO(r.data), 'dd/MM');
      if (days[d] !== undefined) days[d] += r.valorFinal;
    });

    return Object.entries(days).map(([name, value]) => ({ name, value }));
  }, [filteredRegistros]);


  // ==========================================
  // TELA DE CARREGAMENTO ATUALIZADA
  // ==========================================
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0e] flex flex-col items-center justify-center gap-6">
        <motion.img 
          src="/LOGO/barber_logo.png" 
          alt="Império" 
          className="w-28 h-28 object-contain mix-blend-screen drop-shadow-[0_0_30px_rgba(200,168,75,0.5)]"
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="w-10 h-10 border-2 border-[#c8a84b]/20 border-t-[#c8a84b] rounded-full animate-spin" />
        <div className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-bold">Carregando...</div>
      </div>
    );
  }


  // ==========================================
  // NOVA TELA DE LOGIN PREMIUM
  // ==========================================
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0c0c0e] font-sans">
        
        {/* Fundos e Texturas */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#15151a_0%,_#050508_100%)] z-0"></div>
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
        ></div>

        {/* Cartão de Login (Glassmorphism) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-4xl mx-4 flex flex-col md:flex-row bg-[#121216]/70 backdrop-blur-xl border border-[#c8a84b]/15 rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          {/* Lado Esquerdo: Logo e Branding */}
          <div className="flex-1 p-10 md:p-14 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-[#c8a84b]/10 bg-gradient-to-br from-[#c8a84b]/5 to-transparent">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-[#c8a84b] blur-[40px] opacity-20 rounded-full animate-pulse"></div>
              <motion.img 
                src="/LOGO/barber_logo.png" 
                alt="Império Barbearia" 
                className="w-36 h-36 md:w-44 md:h-44 object-contain relative z-10 mix-blend-screen drop-shadow-[0_0_20px_rgba(200,168,75,0.4)]"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            
            {/* O Título usa fonte sans normal com peso alto para ficar elegante com a Inter */}
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-[0.25em] text-[#c8a84b] uppercase drop-shadow-[0_0_20px_rgba(200,168,75,0.2)]">
              Império
            </h1>
            <p className="mt-3 text-[#9b9690] text-[10px] md:text-xs tracking-[0.3em] uppercase font-bold">
              Gestão Profissional
            </p>
          </div>

          {/* Lado Direito: Formulário */}
          <div className="flex-1 p-8 md:p-14 flex flex-col justify-center">
            <h2 className="text-xl md:text-2xl font-bold text-[#eeeae0] mb-8 tracking-wide">
              Acesso ao Sistema
            </h2>

            <form onSubmit={handleLogin} className="space-y-5">
              
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#9b9690] uppercase tracking-widest block ml-1">E-mail</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4e4c48] group-focus-within:text-[#c8a84b] transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-[#0c0c0e]/80 border border-[#c8a84b]/10 rounded-xl text-[#eeeae0] placeholder-[#4e4c48] focus:outline-none focus:ring-1 focus:ring-[#c8a84b] focus:border-[#c8a84b] transition-all"
                    placeholder="admin@imperio.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#9b9690] uppercase tracking-widest block ml-1">Senha</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#4e4c48] group-focus-within:text-[#c8a84b] transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-[#0c0c0e]/80 border border-[#c8a84b]/10 rounded-xl text-[#eeeae0] placeholder-[#4e4c48] focus:outline-none focus:ring-1 focus:ring-[#c8a84b] focus:border-[#c8a84b] transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs flex items-center gap-2"
                >
                  <AlertCircle size={16} />
                  {authError}
                </motion.div>
              )}

              <button
                type="submit"
                className="w-full mt-4 bg-[#c8a84b] hover:bg-[#dfc06e] text-[#0c0c0e] font-bold py-4 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-[#c8a84b]/20 flex justify-center items-center gap-2 group"
              >
                <span>ENTRAR NO PAINEL</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD PRINCIPAL
  // ==========================================
  return (
    <div className="min-h-screen bg-black text-zinc-300 flex font-sans">
      
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 flex flex-col sticky top-0 h-screen bg-zinc-950/50 backdrop-blur-xl">
        <div className="p-6 mb-2 flex items-center gap-3">
          {/* Logo transparente no menu */}
          <img 
            src="/LOGO/barber_logo.png" 
            alt="Império" 
            className="w-12 h-12 object-contain mix-blend-screen drop-shadow-[0_0_10px_rgba(200,168,75,0.4)] flex-shrink-0"
          />
          <div>
            <div className="text-lg font-black text-amber-500 tracking-widest leading-tight">IMPÉRIO</div>
            <div className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] font-bold">Barbearia</div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <div className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold px-4 mb-4 mt-8">Principal</div>
          
          <button 
            onClick={() => setActivePage('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all group",
              activePage === 'dashboard' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5"
            )}
          >
            <LayoutDashboard size={20} />
            <span className="font-semibold text-sm">Dashboard</span>
          </button>

          <button 
            onClick={() => setActivePage('meus-cortes')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all group",
              activePage === 'meus-cortes' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5"
            )}
          >
            <Scissors size={20} />
            <span className="font-semibold text-sm">Meus Cortes</span>
          </button>

          {userData?.role === 'admin' && (
            <>
              <button 
                onClick={() => setActivePage('relatorios')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all group",
                  activePage === 'relatorios' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5"
                )}
              >
                <BarChart3 size={20} />
                <span className="font-semibold text-sm">Relatórios</span>
              </button>

              <div className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold px-4 mb-4 mt-8">Gestão</div>

              <button 
                onClick={() => setActivePage('barbeiros')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all group",
                  activePage === 'barbeiros' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5"
                )}
              >
                <Users size={20} />
                <span className="font-semibold text-sm">Barbeiros</span>
              </button>

              <button 
                onClick={() => setActivePage('servicos')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all group",
                  activePage === 'servicos' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "text-zinc-500 hover:text-white hover:bg-white/5"
                )}
              >
                <Tags size={20} />
                <span className="font-semibold text-sm">Serviços</span>
              </button>
            </>
          )}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="bg-white/5 p-4 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-black font-bold">
              {userData?.nome?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{userData?.nome}</div>
              <div className="text-[10px] text-amber-500 uppercase font-bold">{userData?.role}</div>
            </div>
            <button onClick={() => signOut(auth)} className="text-zinc-500 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <header className="h-24 border-b border-white/5 flex items-center justify-between px-12 sticky top-0 z-40 bg-black/80 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-white capitalize">{activePage.replace('-', ' ')}</h2>
            <div className="text-xs text-zinc-500 mt-1">Bem-vindo de volta, {userData?.nome}</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5">
              <button 
                onClick={() => setDateRange({ start: hoje(), end: hoje() })}
                className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", dateRange.start === hoje() ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-white")}
              >
                Hoje
              </button>
              <button 
                onClick={() => setDateRange({ start: format(subDays(new Date(), 6), 'yyyy-MM-dd'), end: hoje() })}
                className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", dateRange.start === format(subDays(new Date(), 6), 'yyyy-MM-dd') ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-white")}
              >
                7 dias
              </button>
              <button 
                onClick={() => setDateRange({ start: format(subDays(new Date(), 29), 'yyyy-MM-dd'), end: hoje() })}
                className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", dateRange.start === format(subDays(new Date(), 29), 'yyyy-MM-dd') ? "bg-amber-500 text-black" : "text-zinc-500 hover:text-white")}
              >
                30 dias
              </button>
            </div>

            {userData?.role === 'admin' && (activePage === 'barbeiros' || activePage === 'servicos') ? (
              <button 
                onClick={() => {
                  if (activePage === 'barbeiros') setIsBarbeiroModalOpen(true);
                  else if (activePage === 'servicos') setIsServicoModalOpen(true);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-500/10"
              >
                <Plus size={18} />
                {activePage === 'barbeiros' ? 'NOVO BARBEIRO' : 'NOVO SERVIÇO'}
              </button>
            ) : (
              <button 
                onClick={() => setIsRegModalOpen(true)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-500/10"
              >
                <Plus size={18} />
                REGISTRAR
              </button>
            )}
          </div>
        </header>

        <div className="p-12 overflow-y-auto">
          {activePage === 'dashboard' && (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title={userData?.role === 'admin' ? "Faturamento Total" : "Seu Faturamento"} 
                  value={formatCurrency(userData?.role === 'admin' ? stats.totalFat : filteredRegistros.filter(r => r.barbeiroId === userData?.uid).reduce((acc, r) => acc + r.valorFinal, 0))} 
                  subValue={`${userData?.role === 'admin' ? stats.count : filteredRegistros.filter(r => r.barbeiroId === userData?.uid).length} serviços realizados`}
                  icon={TrendingUp}
                  color="bg-amber-500/10 text-amber-500"
                />
                <StatCard 
                  title={userData?.role === 'admin' ? "No seu bolso" : "Sua Comissão"} 
                  value={formatCurrency(userData?.role === 'admin' ? stats.bolso : filteredRegistros.filter(r => r.barbeiroId === userData?.uid).reduce((acc, r) => acc + (r.valorFinal * ((r.porcentagem || 100) / 100)), 0))} 
                  subValue={userData?.role === 'admin' ? "Líquido após comissões" : "Valor líquido a receber"}
                  icon={Wallet}
                  color="bg-emerald-500/10 text-emerald-500"
                />
                <StatCard 
                  title="Descontos" 
                  value={formatCurrency(filteredRegistros.filter(r => userData?.role === 'admin' || r.barbeiroId === userData?.uid).reduce((acc, r) => acc + (r.desconto || 0), 0))} 
                  subValue="Total de abatimentos"
                  icon={Tags}
                  color="bg-rose-500/10 text-rose-500"
                />
                <StatCard 
                  title={userData?.role === 'admin' ? "Comissão Equipe" : "Média por Serviço"} 
                  value={userData?.role === 'admin' ? formatCurrency(stats.totalFat - stats.bolso) : formatCurrency((filteredRegistros.filter(r => r.barbeiroId === userData?.uid).reduce((acc, r) => acc + r.valorFinal, 0) / (filteredRegistros.filter(r => r.barbeiroId === userData?.uid).length || 1)))} 
                  subValue={userData?.role === 'admin' ? "A pagar aos barbeiros" : "Valor médio dos cortes"}
                  icon={Percent}
                  color="bg-blue-500/10 text-blue-500"
                />
              </div>

              {userData?.role === 'admin' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-bold text-white">Desempenho de Faturamento</h3>
                      <div className="text-xs text-zinc-500">Período Selecionado</div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#71717a', fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '12px' }}
                            itemStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#f59e0b" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorValue)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2rem] backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white mb-8">Ranking Barbeiros</h3>
                    <div className="space-y-6">
                      {barbeiros.slice(0, 5).map((b, i) => {
                        const bFat = filteredRegistros.filter(r => r.barbeiroId === b.uid).reduce((acc, r) => acc + r.valorFinal, 0);
                        return (
                          <div key={b.uid} className="flex items-center gap-4">
                            <div className="text-xs font-bold text-zinc-600 w-4">#{i+1}</div>
                            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-white font-bold">
                              {b.nome[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-white truncate">{b.nome}</div>
                              <div className="text-[10px] text-zinc-500 uppercase">{b.sede}</div>
                            </div>
                            <div className="text-sm font-bold text-amber-500">{formatCurrency(bFat)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-zinc-900/30 border border-white/5 rounded-[2rem] overflow-hidden">
                <div className="p-8 border-b border-white/5 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">{userData?.role === 'admin' ? 'Últimos Serviços' : 'Seus Últimos Serviços'}</h3>
                  {userData?.role === 'admin' && (
                    <button onClick={() => setActivePage('relatorios')} className="text-xs font-bold text-amber-500 hover:underline">Ver todos</button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        {userData?.role === 'admin' && <th className="px-8 py-6">Barbeiro</th>}
                        <th className="px-8 py-6">Serviço</th>
                        <th className="px-8 py-6">Sede</th>
                        <th className="px-8 py-6">Pagamento</th>
                        <th className="px-8 py-6 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredRegistros.filter(r => userData?.role === 'admin' || r.barbeiroId === userData?.uid).slice(0, 8).map((r) => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors group">
                          {userData?.role === 'admin' && (
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                                  {r.barbeiroNome[0]}
                                </div>
                                <span className="text-sm font-medium text-white">{r.barbeiroNome}</span>
                              </div>
                            </td>
                          )}
                          <td className="px-8 py-5 text-sm text-zinc-400">{r.servicoNome}</td>
                          <td className="px-8 py-5">
                            <span className="text-[10px] font-bold bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md uppercase">{r.sede}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2 text-xs">
                              {r.pagamento === 'Pix' && <QrCode size={14} className="text-emerald-500" />}
                              {r.pagamento === 'Dinheiro' && <Banknote size={14} className="text-amber-500" />}
                              {r.pagamento.includes('Cartão') && <CreditCard size={14} className="text-blue-500" />}
                              {r.pagamento}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right font-bold text-white">{formatCurrency(r.valorFinal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activePage === 'meus-cortes' && (
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-10 rounded-[2.5rem] text-black shadow-2xl shadow-amber-500/20">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] opacity-60 mb-2">Seus ganhos hoje</div>
                    <div className="text-6xl font-black tracking-tighter">
                      {formatCurrency(registros.filter(r => r.barbeiroId === userData?.uid && r.data === hoje()).reduce((acc, r) => acc + r.valorFinal, 0))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black uppercase tracking-[0.2em] opacity-60 mb-2">Data</div>
                    <div className="text-xl font-bold">{format(new Date(), 'dd MMM, yyyy', { locale: ptBR })}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {servicos.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => {
                      setSelectedServico(s);
                      setIsRegModalOpen(true);
                    }}
                    className="bg-zinc-900 border border-white/5 p-6 rounded-3xl hover:border-amber-500/50 transition-all group text-left"
                  >
                    <div className="text-zinc-500 text-xs font-bold uppercase mb-1 group-hover:text-amber-500 transition-colors">{s.nome}</div>
                    <div className="text-2xl font-black text-white">{formatCurrency(s.valor)}</div>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white px-2">Histórico de Hoje</h3>
                <div className="space-y-3">
                  {registros.filter(r => r.barbeiroId === userData?.uid && r.data === hoje()).map(r => (
                    <div key={r.id} className="bg-zinc-900/50 border border-white/5 p-5 rounded-2xl flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-amber-500">
                          <Scissors size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-white">{r.servicoNome}</div>
                          <div className="text-xs text-zinc-500 flex items-center gap-2">
                            {format(r.timestamp.toDate(), 'HH:mm')} • {r.pagamento}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-lg font-black text-emerald-500">{formatCurrency(r.valorFinal)}</div>
                        <button 
                          onClick={async () => {
                            if (confirm('Deseja excluir este registro?')) {
                              await deleteDoc(doc(db, 'registros', r.id));
                            }
                          }}
                          className="text-zinc-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activePage === 'relatorios' && (
            <div className="space-y-8">
               <div className="flex flex-col md:flex-row items-end gap-6 bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-md">
                <div className="flex-1 space-y-3 w-full">
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Início do Período</label>
                  <div className="relative group">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-amber-500 transition-all appearance-none"
                    />
                  </div>
                </div>
                <div className="flex-1 space-y-3 w-full">
                  <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Fim do Período</label>
                  <div className="relative group">
                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-500 transition-colors" size={18} />
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-amber-500 transition-all appearance-none"
                    />
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 px-8 py-4 rounded-2xl flex flex-col justify-center min-w-[200px]">
                  <div className="text-[10px] uppercase font-black text-amber-500/60 mb-1">Total no Período</div>
                  <div className="text-2xl font-black text-amber-500">{formatCurrency(filteredRegistros.reduce((acc, r) => acc + r.valorFinal, 0))}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {barbeiros.map(b => {
                  const bRegs = filteredRegistros.filter(r => r.barbeiroId === b.uid);
                  const bTotal = bRegs.reduce((acc, r) => acc + r.valorFinal, 0);
                  const bComissao = bTotal * (b.porcentagem / 100);
                  const bLucro = bTotal - bComissao;

                  return (
                    <div key={b.uid} className="bg-zinc-900/30 border border-white/5 p-8 rounded-[2.5rem]">
                      <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center text-black text-xl font-black">
                            {b.nome[0]}
                          </div>
                          <div>
                            <h4 className="text-xl font-bold text-white">{b.nome}</h4>
                            <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">{b.sede} • {b.porcentagem}% Comissão</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Total Gerado</div>
                          <div className="text-2xl font-black text-white">{formatCurrency(bTotal)}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                          <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Serviços</div>
                          <div className="text-lg font-bold text-white">{bRegs.length}</div>
                        </div>
                        <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                          <div className="text-[10px] text-emerald-500 uppercase font-bold mb-1">Barbeiro</div>
                          <div className="text-lg font-bold text-emerald-500">{formatCurrency(bComissao)}</div>
                        </div>
                        <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10">
                          <div className="text-[10px] text-amber-500 uppercase font-bold mb-1">William</div>
                          <div className="text-lg font-bold text-amber-500">{formatCurrency(bLucro)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activePage === 'barbeiros' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {barbeiros.map(b => (
                <div key={b.uid} className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
                      {b.nome[0]}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">{b.nome}</h4>
                      <div className="text-xs text-zinc-500">{b.email}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-8">
                    <span className="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">{b.sede}</span>
                    <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">{b.porcentagem}% Comissão</span>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setEditingBarbeiro(b);
                        setBarbForm({ nome: b.nome, email: b.email, password: '', sede: b.sede, porcentagem: b.porcentagem });
                        setIsBarbeiroModalOpen(true);
                      }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-3 rounded-xl transition-colors"
                    >
                      EDITAR
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm('Remover este barbeiro?')) {
                          await deleteDoc(doc(db, 'usuarios', b.uid));
                        }
                      }}
                      className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {barbeiros.length === 0 && (
                <div className="col-span-full text-center py-20 bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-white/10">
                  <Users size={48} className="mx-auto text-zinc-800 mb-4" />
                  <div className="text-zinc-500">Nenhum barbeiro cadastrado</div>
                  <button onClick={() => setIsBarbeiroModalOpen(true)} className="text-amber-500 font-bold mt-2 hover:underline">Adicionar agora</button>
                </div>
              )}
            </div>
          )}

          {activePage === 'servicos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {servicos.map(s => (
                <div key={s.id} className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem] group">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Scissors size={24} />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-1">{s.nome}</h4>
                  <div className="text-3xl font-black text-amber-500 mb-8">{formatCurrency(s.valor)}</div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setEditingServico(s);
                        setSrvForm({ nome: s.nome, valor: s.valor });
                        setIsServicoModalOpen(true);
                      }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-3 rounded-xl transition-colors"
                    >
                      EDITAR
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm('Excluir este serviço?')) {
                          await deleteDoc(doc(db, 'servicos', s.id));
                        }
                      }}
                      className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {servicos.length === 0 && (
                <div className="col-span-full text-center py-20 bg-zinc-900/30 rounded-[2.5rem] border border-dashed border-white/10">
                  <Tags size={48} className="mx-auto text-zinc-800 mb-4" />
                  <div className="text-zinc-500">Nenhum serviço cadastrado</div>
                  <button onClick={() => setIsServicoModalOpen(true)} className="text-amber-500 font-bold mt-2 hover:underline">Adicionar agora</button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <Modal 
        isOpen={isRegModalOpen} 
        onClose={() => {
          setIsRegModalOpen(false);
          setSelectedServico(null);
          setDiscount(0);
          setPaymentMethod('');
        }}
        title="Registrar Atendimento"
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Selecione o Serviço</label>
            <div className="grid grid-cols-2 gap-3">
              {servicos.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedServico(s)}
                  className={cn(
                    "p-4 rounded-2xl border transition-all text-left group relative overflow-hidden",
                    selectedServico?.id === s.id 
                      ? "bg-amber-500 border-amber-500 text-black" 
                      : "bg-black/40 border-white/10 text-zinc-400 hover:border-white/20"
                  )}
                >
                  <div className={cn("text-[10px] font-black uppercase mb-1", selectedServico?.id === s.id ? "text-black/60" : "text-zinc-600")}>{s.nome}</div>
                  <div className="text-lg font-black">{formatCurrency(s.valor)}</div>
                  {selectedServico?.id === s.id && (
                    <CheckCircle2 size={16} className="absolute top-3 right-3 text-black" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Forma de Pagamento</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'Pix', icon: QrCode, label: 'Pix' },
                { id: 'Dinheiro', icon: Banknote, label: 'Dinheiro' },
                { id: 'Cartão Crédito', icon: CreditCard, label: 'Cartão Crédito' },
                { id: 'Cartão Débito', icon: CreditCard, label: 'Cartão Débito' }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                    paymentMethod === method.id 
                      ? "bg-amber-500 border-amber-500 text-black" 
                      : "bg-black/40 border-white/10 text-zinc-500 hover:border-white/20"
                  )}
                >
                  <method.icon size={20} />
                  <span className="text-[10px] font-black uppercase">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Desconto (R$)</label>
              <div className="relative group">
                <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-500 transition-colors" size={16} />
                <input 
                  type="number" 
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-amber-500 transition-all"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-500 ml-1">Valor Final</label>
              <div className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl py-4 px-6 text-xl font-black text-emerald-500">
                {formatCurrency((selectedServico?.valor || 0) - discount)}
              </div>
            </div>
          </div>

          <button 
            onClick={handleRegister}
            disabled={!selectedServico || !paymentMethod}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-5 rounded-2xl transition-all active:scale-95 shadow-xl shadow-amber-500/20 mt-4"
          >
            CONFIRMAR REGISTRO
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isBarbeiroModalOpen} 
        onClose={() => {
          setIsBarbeiroModalOpen(false);
          setEditingBarbeiro(null);
          setBarbForm({ nome: '', email: '', password: '', sede: 'Matriz', porcentagem: 60 });
        }}
        title={editingBarbeiro ? "Editar Barbeiro" : "Novo Barbeiro"}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Nome Completo</label>
            <input 
              type="text" 
              value={barbForm.nome}
              onChange={(e) => setBarbForm(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
              placeholder="Nome do barbeiro"
            />
          </div>
          {!editingBarbeiro && (
            <>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">E-mail de Acesso</label>
                <input 
                  type="email" 
                  value={barbForm.email}
                  onChange={(e) => setBarbForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
                  placeholder="barbeiro@imperio.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Senha Inicial</label>
                <input 
                  type="password" 
                  value={barbForm.password}
                  onChange={(e) => setBarbForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Sede</label>
              <select 
                value={barbForm.sede}
                onChange={(e) => setBarbForm(prev => ({ ...prev, sede: e.target.value }))}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
              >
                <option value="Matriz">Matriz</option>
                <option value="Sede 2">Sede 2</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">% Comissão</label>
              <input 
                type="number" 
                value={barbForm.porcentagem}
                onChange={(e) => setBarbForm(prev => ({ ...prev, porcentagem: Number(e.target.value) }))}
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
                placeholder="60"
              />
            </div>
          </div>
          <button 
            onClick={handleSaveBarbeiro}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-5 rounded-2xl transition-all shadow-lg shadow-amber-500/20"
          >
            {editingBarbeiro ? "SALVAR ALTERAÇÕES" : "CADASTRAR BARBEIRO"}
          </button>
        </div>
      </Modal>

      <Modal 
        isOpen={isServicoModalOpen} 
        onClose={() => {
          setIsServicoModalOpen(false);
          setEditingServico(null);
          setSrvForm({ nome: '', valor: 0 });
        }}
        title={editingServico ? "Editar Serviço" : "Novo Serviço"}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Nome do Serviço</label>
            <input 
              type="text" 
              value={srvForm.nome}
              onChange={(e) => setSrvForm(prev => ({ ...prev, nome: e.target.value }))}
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
              placeholder="Ex: Corte + Barba"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Valor (R$)</label>
            <input 
              type="number" 
              value={srvForm.valor}
              onChange={(e) => setSrvForm(prev => ({ ...prev, valor: Number(e.target.value) }))}
              className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500"
              placeholder="50,00"
            />
          </div>
          <button 
            onClick={handleSaveServico}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-5 rounded-2xl transition-all shadow-lg shadow-amber-500/20"
          >
            {editingServico ? "SALVAR ALTERAÇÕES" : "ADICIONAR SERVIÇO"}
          </button>
        </div>
      </Modal>

    </div>
  );
}
