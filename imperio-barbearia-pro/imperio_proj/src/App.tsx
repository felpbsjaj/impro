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
  where, 
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
  Percent
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
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
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


  // Rain animation on auth screen
  useEffect(() => {
    if (user) return;
    const canvas = document.getElementById('rain-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const drops = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 3 + Math.random() * 5,
      len: 10 + Math.random() * 30,
      op: 0.03 + Math.random() * 0.12
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drops.forEach(d => {
        ctx.save(); ctx.globalAlpha = d.op;
        ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.2, d.y + d.len); ctx.stroke(); ctx.restore();
        d.y += d.speed;
        if (d.y > canvas.height + 50) { d.y = -50; d.x = Math.random() * canvas.width; }
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [user]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAABvd0lEQVR42u2ddZxU9frH3yemZ2ebDZZalk4REARRsVFUQq9d165rt1679eq1uxUTu0BpkJLuWGq7p+fU9/fHmRnA9v70hs7zeu1LZJeZ2e/5nOc88Xk+jwQIMpaxP4jJmSPIWAbQGctYBtAZy1gG0BnLWAbQGcsAOmMZywA6YxnLADpjGcsAOmMZywA6YxlAZyxjGUBnLGMZQGcsYxlAZyxjGUBnLAPojGUsA+iMZSwD6IxlLAPojGUsA+iMZQCdsYxlAJ2xjGUAnbGUSZKUOYQMoP8AF0KWURQFITIyKf8fUzNH8MNeUpIkLMv6XQEsyzJCCIQQ6ffyer1IkkQ0Gs2AO+OhfxtLAUxRlN8NzJZlYRgGpmliWRZ9+/bhrbfeYubMmRQWFmbCj4yH/m08sxCCbt264fP5WLp0afrvfsv3sCyL4uJixo0bR2trK1u3buOtt16nffuO3HjDjWzZsgVFUTBNM3NR/hWHlPmyv1RVFYC4+uprRSQSFVdddZUAhKIov8nry7IsJAkxcuQ+IhqLCCGEsPSYiMfDwrISYuOm9SIrKyAkSRKSJGWuyb9yxpn7+fum6zr19Y1cfsVV3HjTjZimiaIo6S9VVf/lcECSZCoqKvjnw4+wfNm3JPQ4bW2NSBJ8+OGHhELBTHKY8dC/zVfKEx922OFi8+ZtYuasuaKhqVkcethhv9l77Op5S0pKxKpVK0S4rUFoiaA4bMyhQpKk3+yJ8Cf9yhzCd8EWCATE7DnzxOJvl4pVq9eKadNmCIfDKc4446/iueeeE3/728XC7XZ/D6C/5n1cLpcAxIQJE4SwEqK2ZrvoUt4lHZpkrkcG0L+pl77oootFTW2D+Gb+QrF6zTox+f0PRXVNraiprRNCCPHW2+8ISZJ+FHyyLAtVVX/0+6k4uaAgX1TX7BBr164WXq83+b0MoDMx9G9klmWBBI888k9mzJhGbm4eiUSCgQMH0traxiOPPMrEicfSt09fBg0ahGVZyLL8g69jGAaWZf1ovC2EoLW1jebWEK3BENFoFJAy8XOmbPcblu0An8/Peeedh8/nw8aWhKZpbN68iTvvuA0Ap1PF4/H8aI35sMMOY/z48Tz99NMsWrQo/fffuwCqiqqoJOLx5GcgA+gMoH87QCPg4Ycf5aijjiYWi2OaBvF4FEVRcLncOBwOhBBMmzaNUCi006vvUmN2OBw89dRTdOjQgfLyrhx44AHf89KpbmRJSXtyArls2rhht1p4xv7FplXmCHb3rN2792D//Q9g+7YqXnnlJT78YDJ5eXkEg23069eHQw89FMMwqK+vJxKJfC+EkGUZwzB4/PHHqW+o5/3330MIkS71pb5UVcWyLA4/YizICsLKgDhTtvstKxyyXa3o0KGj2La9Rrz77kfp7z32+JNiW9V2sWbdGrFkyRKRm5v7kwlhKrGcMHG8WLhwgejcqeMP/lyfPr3FwiUrxIKlq8TMWbMy1+HflRSmvMof+q62bO+6ffs2Xn75RQbtOYhu3bsjSRK3334bsWgMXdcpLi7m6aefTocGP5QQpjx+NBxl8OAhzJk9k/PPP5+SkhKcTie5ubkcffTRvPjiy8TjBuFolKxAFg5V3Rn6ZOxfPot/qSnwR69FH3/8ieKCCy8QgUBAAOL+++8XTc2NYsWK5aKtrVU899yzaQ+tqupuZ+N0OoUkSeKSSy4VpmkJLdEmhDDEhg3rxLx534hvlywTW7dVicXfLhdfTpsrPps2R2ys3CLy8vP+NOf8e+FN/iV3R0lJCQ8//DBCiD++p04mZG+88RqPPfoY0WgUSZKYNGkSpmHh83mpr6/l2GOP5f33J9O+fXsMw0ifjaIoaJqGEIKJEycgSSaGaRAMNuN0OSkuLsXl9FBTW09c11EcKtFwBJ/XT0lJScZD71pxEoJHHvkn7du3/8Xn8pOATtEnjz76aC6++GIOPPBAhBC/G63yv8kURUkneABLlixhzZo1+Hw+HA4ndXW1jBw5ghkzpnHhhRdQXFyMEALTNMnJyeHBB//BiBF7k9CCqKoDt9uDIsvE43FMy8TpdCBLMrIkEY3FkGWZDh06ZACdPHshBIcffjgXXngREyZM2A2P/zKgU+WocePGI4TggQfux+v1/CkOPcVTTh2kaZosXLgQr9eHJSxcbgdtwVZ8fg/33XcP8+bN5euvv+LTzz5l2bIlXHrpJWhaGEVOxsVIOF0OFEVGkRU7L0mS/HXdIKFp9O/bN3m2f97iU8ozZ2Vlcf/992FZFhMmjEtfk38Z0KmaanZ2Nv369sEydfr3H8Btt92WZp/92Wz58uXIskzqVnY4VLuE11CHx+tiz8F7MGqfvSkuLiShtWKHgMmflgQup4os2QmjDdqdJby6xmYGDxm6W9jzZzRVUbAsi3vuuZuePXthGgn6D+hPaWnpLwp55Z+Ln8vK2pNfkIcQJvF4lMsuu4zDDz8cwzBQ1T9OX0aWZVRV/cGqRQpgTU1NIASSvLOenPp3pqkTDLbS2tJKJBxFVhw7wWw/73A6HagOBaTUCJb9771eL1U1dXTr0Qun04lpGn9OMKsqumFw7LHHcN5556PFI0gIsrNz6dK5c/o6/b8A3b59exwOF5YQKBKYpsELL7xA586dMAwDWf5jgHpX7sWPnYfL5cLpUpEBeRdPkZoLlCQZWZGwLBNM0oCWxc4L5nI50vOEsiwjS/YcYXNLG/6cPAYMGJiO3/9scbNhGPTt24ennnoK00ggy2AJCwmJgnYFv8wx/dwPZAUC6YsmKxKGnqCwsJA33ngDr9cLWP/Th5/67OXl5dx1113ss88+ac+7688IIehWUYGqupMtcvEdL54CuIRpmui6vjPakNJ/wOV2IkkgyxKSZGPe7XYjyU5aQ1H2H70/pmn+qQAtyzKmaVJQkM/bb79FTk42pqkj7XIGfn/WL8rdfvzUpB97LCgk4mGGDRvOiy++mH6T/9UkMfW57777bq655hr++c9/JmNcO7ZVVRVd15FlmYnHHINparjdLptFtNvrpJGNZVloug5i92MUQuBwOECykGUbyE6ni0QiRjjYyLSvvyQnrx3H/uX4P0Uza1dn4XQ6mTTpdXr27I0WjyDLyg+f77/soZMOSNP0nX+R9Eo2qEMcc8wxPPXkk+kk8b/1AqTA+UOfLxUff/3112yu3EzC0CkpKcE0TQzDwDAM/H4/Tz31JIMHDyIei+B2e+ySG5L9JclpAApkLCGj6QaWAGQZK9kfEKaF1+MhJzuAaVjUVFWzeuVy6mu3k5+XQ3FJRzr36s/Djz1Jz+49/vAl0l25La+//hoHHHAw8VgQWVHs80qGcgBaIrE7MH8sDv+5N00xylLUSpKZpqqqJOJhzjzrLJpbWrj66qtRkhnqf1OWnioDperJ32WzpWLmJ598krfeeovrrr+OFSuW89VXU6is3EJeXh77jhpF14puRKOtKIqcrHAoJBIGkmR7YZG+OQRSssRke3YHsgSq6sEyBbW19WzYuAnDMCkrK2PPPfvSFkqwcvU6vpk3jyWL5/PGc4/j8eeSm5tHS0vzH5KBlwKyaZq88MLzTJgwkXgs9P1Cg2SfbnNzS+oB+NOv+2OQ38k+687y5ctQVQlhmbu/jyQTjSbw+rK57bZbuOXmm5OgFghh/deAubCwkGuvvYZ4PM6NN970gzedqtoluBEjRjD96y9Rnd5dq9LEY2FkScLCJuzrukEkHNt5Y0iAZWEJCQkJS5h4vG7yc/MxDY3tO6qp2lGF0+WmZ89eZGUFCIWDTH7/A15++RWWLFpEc0sL2Tk59O43kLIuvehZ0YkH776NWDy2m7f6nwezLCMJsITg8See4NxzzyEUbMXnde32Owph5xqWgAEDBrFmzdof5ZX/bMiReuGtW7eybes2FMW1292R+rMQClVVdVxz7Q3ckqxRI/3nmwOpclpeXh6ffPIRl156GUJYP1pDT02WNDU10djURGtrLYlEG4lEG7oWQ1FUSIYWKTqow6HubJAk/2vjWuByujENiw0bNjFn7nwi0SgjRo5iyJC92LhxIxdeeAHdu/Xg1JNP4aspU2huaaGgqD17Dt2LpYsXYMRD9OwzkCuvui45FfPHCD3smNkCGZ559hnOOvscdtQ02Of7/auCorrYsaOaysotv6hG/5OAVhSFRCLB7Dmzd5Or2jWZsiwTENTV1HHGGedw0y23IksSQvznqh+pu1jXdQ4YPZohQ/bCMAwU9edBkZIpiMViabK+lATydx9tLpfrO3GdndyoqsL27dtZuWI1QsCoUfvTp3d/3n77bQ488AD23HMwjz32OLW1tbhcHvzZhXSoGMDAPYcyf94c4tEoX3w8mdamWo454STGjR+PaRr/8/F06rp4XG5uu/NuDjv8KKq31yBLMqYpfsDJCEBm5syZxOPxXyTv8IsQN2nSm2lPtDP5sa+qJQSGKZBklW3ba6jouQc33nwbPr/vd5XT+qkww7IsSkvb89e/nsGZZ/6VRDyCIhscOfYIVFX5wc+lqipCCAYOHIjP50fTDEKhMIZufucm3pkEqqqCqirpMpvD4aShsYF169bhdrsZPfoAysvLefbZZxk4cCDHHvsXvvrqa4QQeHwB8tuVkVXQgQ7d+9Cndze+mfU1kVAYRVGJRiM8/dg/0PUEl115Nfn5+T85n/i/UGe2LIuC/DwuuuxaSjp0p7qmAVm1Q1TT/E4YIVnJsp3g+edf/OXvA9z8U15almW2bt3KgQceSOfO5Rh6Ymf7V5KIxTRiCQNLCOKaxtLlqwiFdUbusw/r160iFAyhKOq/JaZOKXhedNHFvP/++0ycOJGuFRWoqoUWj9GuqJScnGw+++yLdBs19RQxTZPs7GyeePwxXC4nlmVimRaWBW6Pe2cig8Su7WyEhCwrBEMhNm3ajNOpMnTo3uTkBnjmmac59dTTeOGFF6irq0OWZBwuN4G8EgIFJTh8OXTs1Im8LCdzZ3xJJBxO35CKolBTU0Onzp048JDDiMeizJk9639ShMbupJp06tiRv557MZurm/H7s+jRrQsupxOBhKpIeD2O9Dmbpo7LFeDjjz/i7rvv+dnY+RcBOgUSwzBYtmwZp516ajo2tp2VRDSmEU8YCMsiEovS2NzKihVrqW5o4thjJ7Jj62YaGurTI0e/pwkhcLlcZGUFeOON13n33XdZ/O0igsEwBQVFBAI5DBu2N926d2X16tU0Njam4+ERI0byzDNP07WiC+FQMBmzSui6jiLLOJ3O3UItISycLicCmXXr1tHW1sbew0dQXNSeSW++zvHHncCLL75MY2NTmozk9GWRXVCCy5eN0+OjrKyUaEsNC2ZPR9f13aoZqRutubmZQw4dQ7du3Zj83jtEIpH/KS+dSrb79u3L6WdfwJwFK0gkdLp360rH9sV43W4E4FAkvB5nOp9RFCehUJDx4yfQ2tr6iys9P1u2SyVRixYt4sorr+Lhfz5MIhFGVVN1Z4EQYCEQgGkJ3D4vG1Ztpqgwn/c//IRTTj6eBfMXpH+539NisRifffbp9/6+pKSUww8/jFNOOZkTTziZicf8hRkzZhAOhSguake3bt0wTZNgWxBVVrHMVFdE0NYWxO12o6oKItmKdbh91FRXUbllC106l1NSWsaCBfO4/vobmTr1q908k6w48OcU4PRmITvdZOfk4HcpbFi+gIbaqmTpb/cLlmKWLV+2lPVr1zBq330ZP2EiTz/1ZLpN/F9el0NJOsN9Ro7k8aee5sHHXqAtFKF9++KkxxVYyVKnkOwnnhAmlrBwqD7OO+80Nm3a/KuEK39RDG2aJqqq8s9H/smTTz6Oy+VH1w3syyDv1iETwvaUToeDWCyKrKq8MWkSx59wPIZhfK+t/PvEa/JuOnSyLFNTU82zzz7HqFH7MXbskXz77bcccOABjBw5ktL2ZbS2BQmFwsiSgmkJDEtgmCaWBbph0tLaiiUEsqIiySorV66kuqaGvfcehT8rwFln/5Vhw0YydepXu3Gp3d4AgXZlOLNy8Ph85AV8xFpq+Xbe9CSYpfSZ/VDcaRgGmzZuwDBNDj3ksN1q5//NyR9JbvhJJ5/MM88+azeqdCPZKbUxYAkLy7JsUCedo2lYuFwBbrzxWt54400cDsevUmH9xchKeerzz7+QV155Fbc7C9MwEUi7aUlISSaZABRVJR6PEwy28cCDD3Lr7belQ4/fM1k0Tbs8l+r2pZKpVDfz448/Yt9Ro7jissuJRmM4HG4SmomFjG5aaIaJbhjohv1n04LWthBxTScYivLN/Pnk5Oax5557MenNSfQdMIjV67ZQ2K4ofQEsy8KdlUNWQREefxY+rwczHmbzmiVs2bgG0zR+9jGaCi2qq2uIx+N0rehKQUHhf3VyqCj29XW5XNx99z3cfvudNDe3kUjo6fh/Z9hmg14Iy74BLAuXO8D9993L7bffnaYd/Kqb6dfEp6kPc8opJ/P444/jcHjSHkMgg6ygKioOhxMlFcRLMgndpLq2nu59B3HjrXfSuVOn5A3y72Pq7Tw8uxypazoP/eMhDjv0ML755hvaFRQSj8WJRmPomk4iYSS/TKJxE0n1sHT5alauWMleew0nO5DL0UcdxbXX38wVV17F1C8+5dxzz0bXdbz+ANl5ReQVluByOjGiQWor17B981pi0chuF/SXWDweQ9cMsnPz6d27124x9n9PiGE7MNM0qOhWwcWXX0v7Lt2orW/EsD8wlmmiqvaQgyRLCCHZFQ5NQ0LgcPi5++47uPKqq9M3xq9+OvyaH055BlmWueCCC7jp7zeRn5drPxrNneGEI0nqsUwLwzARAtxuD/PmLuSrGYu44tpbOOCA0ena6r/b26QeYaqqsnbtGiZOGMcNN16Py+lAllVaQ1HiukksoaMlVfY3bdpMQ0Mzw/feh2/mL2DvESPxBvL47OMPOfWEv9DS3MjFF13ACSecTEKzsCyJ1vo6qjevo3b7JuKxSBqEv7ZKoSgKhm4gyzKdk7xg/os8tCzLKJKCaRgcOuYwLr70OqbNWMiiRctsIlcKO7KM2+2yE+ykg9Q023NnBwJcfvllXHvtDckSqvUvPYl+FaCzs7PTYFAUhdtuvY2TTjoJl9uJz+uz+dGKhNPptGWyJLsagGTH14HsXBrqW5j07qccOeEkzjv/gt285r/bbD63zUt+5umnOP6442hsbCArJ5fm1jZMIUhoGuvXr7U5Hfvuz9VXX8NZZ57Dvffew+uvvIA/y0VrWxMIC8PQeebpx3nj1ec5YL+9KMjz43Y5002CXxtqpXBfUFCAadqhU3ZOTrqx899UXzYtk4svuYTDjzyBt979nFBEw+ly23zmZClSlmU8Xg9ut10Gjcdi+HweHKrCcccdx4MP/iP9epZlkZub+/t46NRFuO6669hnn33Sd46qqkx64zXGHXkYdXXVFBW1wxQWLq+LQCBgVzVMEzlZTLGwyM7Jxu/L4pU3PuCAQ4/inbffJT8/P514/ru9derwVFVl6bKlTJwwjmVLFlNaUkp1VRVLliymfVlHSkvbc97ZZzH1q2m88967HHboIcTiQRRZQXU4kVWbv9HS2syECUczefL7rFq9nNVrVzFz5nTuuON2Onbo8Ku4zqnafZdOnYnFE/w3pYKp62+aJsUlJXz44YccNf44Jr31Pl6/D1+WG8PQAIEk2eGe6nCQlZVFli8LyzLJy8umtnob444+gvffn5y+/pZlMXLkSG6++eaf1D75lwGdAllRURGvv/46+fn56bKRoigsXrSII8cczJzpX9OlUxdQZLICWaipkX7syQOXw4nL5cTr89CuXSFV1XUcPvZI5syZw9ixY9NyAP+J+NAw7PCntbWV008+kddeep5tW7fQubw7kVico48cS319Pa+9/jqSJNEabLT5zC5XuvUtSRKyItPY1IimR/B5XXTs0J599tmX6667ngWL5jN6//1+VLH0u2duE6sK6NajJ8FQGBBEY9H/jipG8szGjBnDnNmzOeSQw6iqqiY3Pwefx4nH5cShyOm8yzBNHE4nWX4/breL8q6dmTlzOkeOPYKlS5emnaZhGJSVlfH222+Tn5//q/OFX4WcrVu3UlZWxieffEJpaWn6ka0oCk2NDZx5+klMfvNFunboQE4gF2SZRCKBkOxHrs/rweNx4nI6cLudeH1eamrryStox+T33+eBBx7A7XanPea/21JPCRC89+6bHHnkWFpag5x/5hkoqpt7H36UUDhMOBwmGo0jIdtxN/LODmKSbSdJEpYpMDQNPREmFg/i83l59bVX6fSz83FSuhV/9LgJ+LKyiMUTCCFobmr6l+Lw37JRYlkWTqeLe++9lw8+/JCcnFzq6hvw+Xz4fW68Pi8+rxe3y2UPOUgShmGiKiq5uXn06l7O5Dde45ILzqWlpSWdRxmGQZ/evfnqq68oLi6mvr7+900Ka+tqsSyLvfYawpw5s9hnn33QdT0dA8uyxHNPPc6zj9xHWXEOZZ060haOJOmk4PW58XjduD1u3B4XMhZOp0o4EiMStQdwp82YxpChQ/5tNesfCkEAXG4327Zt5aZrryKnqCOjD5vItm3bsSwTSVYIhxJoho7T6UCRFRvIQrIppsKyuQmSZA/UyjIup5NQMIg/K8Cll11q37QONT0dk/pdFUXB4XCg6zrdunfn9LPOpaqmDkWRMQ2TbVu3/kcAnfqchmEwaNCeTJs2jSuvvJJoJEIsruFwOlFlmdxANv4sH/6AD4/Pg8Cus8fiCbp07kh+QOWhe2/hxeeeRJaldMxsGAaHHzaGadOm0a2iHMuyaG5p/n0AnTq8qh07kGWZSDhIx04dmDLlS6699lo7KTBNZMmmbC5cMIe7br6GcEMtxUVFyIqCrmn4fD58Hg8etwOf15Puz8uyhKrYNevevXszZcpUrrvhekjGU/9Ob50KB9asXsPZfz2dG264jmNPOIWq2iq2ba8CZEzDIhaLE43EUB0KiirvQq21JXkty9yZuEkgsNvyNdU1HHPMMfTu2wctoaW52Sk2oz0YoNGvf3+eeOo52oJx4gkNSZZpbGxk/fr1/3ZAp7yyEIJrrrmWKVO/om+//sTicWRZQVHk9LllZWXh83jI8vsI+P3oug320pJitm1eza03XMG3ixehKCqSJKdzittuu40PP/6QvLxsotEQsiyzedOm3xfQq9esIR6P4PZ4iMdiGIbGnXfeyeeff055eXmysyZQVQeNjQ3cf9fN3H/nrWixKDm5ubhdLnxZbrxeD36/F0VVkkAQmKaB2+1GliRCkRC33nIrU6dOpVfvXv92b53ymIFAgDPPOJURg/vgUCTq6psJhSMIBIZuEmyzSf8Oh4IkJ1vlskBgU1cty8IyTUSyySOSN0wiofHcc88xZswYenTvTllZGcXFxZSXl7Pvfvtx3Q038egTzxOKmjQ2N6MZ9rDAmlXL7W7mv4mgtKtX7tG9B59+9hm33nYbCS2BLIHH7cKyDAQCYdmcmOzsADmBALmBLDwet51vaRq3//0m/nHf3bS2tqGqrnTjq2+//nz11VfccMMNxKIRDF3D7XZjmgarV6/91Z1R9Zd6LUmS2Lx5M2vWrGWPPQahyCaapqFrcQ455BBefu01Hnn4Ed5+cxKGodvcYwGT332HeXPncNU117PPvvtRmN8OQ7fwe1RUxQa0QCR51RY+r4dILEZrWxsjRoxg5qxZ3HnHHTz00ENpb50q9f2esbQsyyxfvpxZs2YydNgwvvhqNi1tIWrrG8nydUA3DZpbWikoyEZxqMgJO1yQk/Gg2+VCdXh3L3sGHGgJi3jCoLiojKeffZ5gMEQ4FiOR0GzmnqoSicXZvK0WzdBxuRwkwjECfh+fffLRv6Vkl+qqphzJJZdcwnXXX4cvK4tILIos2xsMhDAQmEnag0B1KOTkBghHYhS729GpvDOffPwR99x5J7W1NcnET8IwEjgdDk776zn89ZxzGDqwL4aRACxkxYmiuqisrGTdurX82hUdP8u22/WxY5omPXv2Ytiw4Ri6liTAqwhg7Yat9NtjKEOGDmX71i3U1dWlp5yDbW188fmnbN9ayfC9hpGX3w7N0MnOzqJ9STGSBC6naicRSMTiCWbOmElBYSGBQBZjxozhwAMOZOXKlezYsSNdXfk9QZ0Kh2pqajn1lFNpbW1l5Zp1eLx+Oncuw+/34/Z6KSjIxeX0YZqCcChMc3MrtTV1VFVVU12zncrKTWzbWsn2HVvZuHEz27btIBgK0draQnNzC7oFiuJEcbjRTUFbOEZdYxsNzSGiiTixaByPy4lsadxx260/qR3yW9aVLcuiX7/+vPnmm5x99tkIRSYei7Ls26Xk5ubh9/uRZUhoGrpuYVoWzS0taLpBUUkReizCY/98kKefeIJwOIzT4UhWsSz69R/AVdffzNBh+6HrcTqVFSPLUro5p6ou3nvvXd57bzKK4kg6u1/csET8sgusYFkme+01jLlz52BZBol4HFlR8Hh8zJi9gJXrt5KTHcDQE0yb8hkfvf8Wzc3NKIotgaUbBjm5ORx/4mkccMjhFOTnUlyQj9OhEAj4yc3JRggDFAcTx09k+7atvPDiC/To2RME6JrGo48+wh133EEoSYS3rN/PW6cINLNmz2Hk3ntz+/1PEYtrVJSX0NZUy8b1G9ixYys7duyguqqGtmAbiXg8HU+mHtmp4VmbgyNjWaYt2Ohw4nLZ7Lui4hJK23egQ4fOuPy5CNWN25dFVNMYPXwPJr3wBJNef/V3W5mcCulM08TtdnPNNddw6aWX2JohksyWLZWcfvoZdO/ekyeefAxZEqiKQigcIhROkNANQuEIW7Zu5aPJ7/H6a68Si0Vth5ckeuXm5rL/QWMYdeAYnJ4sIsFW9uhXwQH7DEdPxNGNBE6nC1V1sd/++zNjxoxf/fv+4mzLsuzH8IIF85k9ezajRo0iISXS9Wif143AIhgO09YaIq+knPMuvpoFc75mypQvMAGn00lrSytPPPoQ06dN5dLLrqDXkUciCdB0LamSY1t5eVfen/weI0fYBfazzjoLl8vJ1VdfwxFjj+CqK6/m008/TT89fg86pSzLYElcecWV/O3iC/nyw0ksW7GMaDiMosjk5ubRsVMHevboweFjDqNz584UFhaSn59LVlYAr9eT5lEnEgkSCQ1dN+3NV81NtLS0UlVTzY4dO9hSuZX1a1cxY9oUYtEoiuogkJtPp669cCUamfzee2nv+XskfUayxb///vtz7733MnjwYGKxKELAiy++wHXXXUtTUzP7jNoPWZaAVAJrEAgESOg6H334AQ/cfz/bt21FkuzrrWkaACNHjabvoCEEIwa1DW0U5MsILPw+OywzTLsHoTpczJk9m1mzZqVvsF9JKUH8mseRaZqMHj2ar776ing8RiIRIzs7jw2bKvl02lwU1YWhw8IFi2huaWavIX0Z0LMTt996K99++y0ADocTXbd/0YMOPphrrr2efffdB0WS0LUYksPFPXffy003XG9LAlgWo0aN4r777mPo0CGATVN97dXXufa669ixY0fSw0jfH+X5f4Qbu1pWIJuuFRX07T+Qvv0GUNG1G6UlBfTp0ZVA9q4tWgEY2FpgO7VMYrE4sWgCS4BuWJimgWGBboJlmmi6TlswREN9I1XVVaxdu5YNa9eydcsmtm2rJBaNfy8s+P8+mVJPENM0ycvL4/bb7+Dss89KikzChg0bueqqq/nwww8B+3zvuuseLr38b5hGArfLD1h8/fVMbr/jNqZ9/fX3rm+PHj247sYbWb2+mm++XYrf72fvvUfgUFUsU2PC4ftT0aUToXALqizj8WZz6CEH88WXU/6lp9EvjqFT1Q5FUdi8eTMVFV0ZNGhPwuEIHo8LWVVZt2EbhiEQkkRLSzOhUJjqqmrOPONUTjvtJIqLi1mxYiVtba3JX9zBhg0beO3VV6muqqJPnz4UFLRDliQ2bFzPB+9/kK7NVlZW8sorr2AYJnsO2hOX20P/AQM47rhjicXiLFq0CMsSuzD4/vWLnQJK9x49GDZyXwbvPYqBw/ajzx7D6NC1Jx5fANXhwNR1/B6FnGxXcv5NSfoIJfnwc4BkfzkcbhxOFYfTiaw6kGQZgYSmG8TjMdqCIZqaWwmGdQxLRnJ48eeVUlbRj74Dh9C7bz/y8vIIBVu/t6zo/9O2FkJwzDHHMGnSJA455GBkWWAYJk8++RQnn3wyS5cuS3LLbW953HHHMnjPIaiqk3Xr1nLFFVdy+eWXUVlZaW8Is8C0DPJyc7n8iit48MH76di5ghdffRMkiYL8fEpKirEEeJ0Ohg/ph9vtIhwKE8jO4403XuXee+//l0Mr6dde+V1LWrNmzaJv3760BVvw+wO8/cFUaupbkVSFDRs2snnLFrRoiCsuPpvePbvg83iprNzKvfc/wBeffpJe1J6qLOTk5PC3Sy7h4osvoqq6mj0GDEzKItjTD6lfsH//ftx1192MGXNY8uPLzJ49g2uuvY45s+fu9jTZtY38s3e3LKM6HAwbPoKKnr2JG7Btex3NbWFyCoooaVdA9x4VdC4rpUNpO/w+J3kBLw4F6mrrqK2tpba2llAoSDyeQCBhWTYnQ2BhmXZbX1FVFMUeqvV6fAQCWXj9ARwuL5LiwLAkquoaWbthC9t2VBOPx/B6PRQX5tOxKJvm2m289+7bVFdVkVIY+iXUhZRDSp1Lr149ueOOOxg37qgkFGTmL5jHtddcx7Rp03/wHBctWkhxcTEPPvgPnnzySSKRSHqgQdd1PF4Phxx2GBddeBE9uncjHo+zqbKa+x95GklRKS8vp6JbBYmEQWlBgJOPPZxYLIrfn8XatWsYMWIkra1t/7IOifSvuLLUI7lDhw689dbbDBu2FwBfTpvL8rWVqA4n1XV1rFy9hlBLI2ecMIED9tubcChMfUMTL70xmU6l7Vi+ZD6TJ78H7B5vdejYgdNOP51nn36GmpqaNCDtcpKMYdgHfOLJJ3PzTTdRUVFhs7fiUZ577nnuuOMOampqdwPzrjfOT/1OZ517Ps6sQr6eNptgWxtZWVkUl5bStaKc/IAbTI3mxgZqa6qoqtrBhvXrCYdCFLYrpHOnzvTo0Z3yrl0oLi6muF0hWUmRQTPZPWxrC9PU1EI4EqaxsYn6ujrq6utpbW0hGo1gmgK/309RSXsKi9vjD+ShCYm2cIyWliBlHdpz/PjDyPaoHHrgaJqaGn/0hk0lpjtVo2xNDL/fz9/+djFXXHEpOTk2X6KhsYG777qXRx75pz1HqTjsGnPy3IUQZGfncNJJJ/Dmm2/R2NiIBDh2uW77jz6AAw4ZSyiicciBI8kOuMjJyWfOvG955qVJ+LOy6Nu3LyXFJUQiUQb26cIRB+8HwNKlS5g4cSKbNm3+xQOxvxmgdwWA1+vl73//O5dffjl1jS28+OZHON1e4vEY3y5eQlNzMyOHDuSsUyYSjSVoam7lptvvxev2s+ce/ejSsYgXn3+GmTNnfg/YP3WhUvXxnJxcrrzySi688HwCgWy7o1m1nbvuupunn34G0zTx+XxpSbMfJQIB5V3KOeXMC3j3w8/JyvJRlJeFLENN1Q5qqrZTX1tFJLI7OWjs2LHcdded9OnT9ydOSwdhYQHxeJxoRMMSYJgQ1zQSCY1QNEpTUzNVVTWsWbuWpYsXsm7VckLBNtoVF9GxcwXtO3Wjc0UPBvXvTf9e3bj17zfwyisv/WDz4bsDt16fl3AozNixR3D3XXfTu08fwJ6seeed97juuuvZlOzM/ZLHvcvlIpHUmxs2bBgnnnwahnCxZl0ljc31XHLe6QQCHnJy8njpjXf58uvZFBS0Y8iQwTidbqKxMGefMp7i/FyeeOIJrrvuOtra2v5fYP7VMfR340xZltE0jalTp/L5Z5/RrXs38gqKaA3bIi2tLa1EIxESWoK9Bg9ElgSWgMXfLgdkNmzczAGj9+OmG6+jvLycyspKampq0sD+scdO6u8VRSEWi9qrID79lJKSYioqysnJyWXMmMPp1q0rqupg+vTp7LfffkQiEdauXZtWvPxua/fAgw7i2BOOx6EqjB41jJodW3jz1RfZvrWS1pbmtArprv82EolSXV3NkiXfsn7DWurrqgm2tSJJBi6Xgq7H0LQYsWiCaDxGKBQi2BYmEo0QDkdoC4WprauluqaOYCiMqjopKu1Ar34D6DdwMKtXLmfzxvVUbtrA8m/ns2nNckzDokOnzow/+kge+efD3yPCp8DcuXNnbrnlFl5++WUG7zkEn8/DpElvUtguD4AlS5Zy3nkXcMcdd9DS0pImRP0YoOTk9Huqy9evXz/uvPNO7rnnbgxTZeq0uQhJwulSGD50DxQFBAoffT6FYDhGTk4OpaWlONxOunZpT82WDZx+2qk8/fQzJBKJ/zeYfzU56cc6iIqisGDhQo484nCefOheZC1Ex7JScnJzMS2LhsYWauobUGQFj8tFICsLIQT5hflU1dbQ1NLMscf+hTlz5vDMM8/Qr39/NE1LE+J/rOVtmmb6/ZcvX864ceMZN34iCxcuSKeFJ5xwAt98M48vvviCu++5m0cfe+x7FNUUQIuKiqitaWTL9ga+mLmQgSPHcNDhR33vd84KBOjVpw9jx45lzJhDKCsrpaiokOxANh6325YIQ0LY1Bx7OiMp4piOaSUFSZZxKAqyJBFsaWTdqmVM/fxjXnzqH9x905Xcfv2lbNm0brf371zRDU9uPk8//wJfzZhNx46ddouTU6HVqFH7Mm/ePIqLi3nooYcYPGQwxcUlICy2bdvOZZdexvDhI/jwww+R5Z1DvT/2REzd9IlEgopu3Xj44YeZNWsWxx57LKFQmB3VVXh8biwMsrJ8uF1OHA6FhsYm6uoaMEyT/Pw8OnUqw4g08vj9tzH+6KOZP39Bmm33W5Qk/9+sn9SsXmrFwpQvP2XWrGmMOXIce43Yj2i4A2vXbWbF6g10LivF4ZAoKW5HU0sIj9dHIm5gGoK6+gbal5Zw5plncviRR/P5px/x0EMPsXzZ8u+VmH7s/QE+/uhjvvziSy666CISCY1rrrmK8eMnsGDBApavWMHYI45IdzBToY0QNtg03WTF6nVEYxpOh4NF38xm3eoVBAI5FJV2oHPXbvTp158+fXrTt3cPOncoobiw8Kdu+dStB5aFsARupxtFDqFpFtGEgWEJ8vPyycnJo2fvAUSiMaLxOLW1tWzaVEnVjm1Ubd1MzY6tbN9aidPppqC4Pd369ENxiLS+3u4JoEQsFmfa9BmccPxxAEycOJ6CgkLOPOscPv/ic6p26bj+VF6ROnPLsujRowcXXHARR48bR4eyUkKhEHV19Xi8PuKJhF2ftgza5ZfiVB1IMqzfsIJwJEqvnj2p6FzKmy8+zicfTrbppKqKlfT2v1lN/bcs0BuGidPhIB6L8d6brzP1048YNnJfelb0JBqOgerESsRoX1rK6vWVeDyedEjidDjs2qypokiCI48ez9ixR/Lhhx/yzDNP8828b36yDrvrxirDMHjggQc45JBDaN++jEcfeZg3Jr3JIQcfwi233oYkq2kw291AO/F5+snHGbzX3gzYazTbtlURatlB+8496TmoBJcvQGFRMSVdOlNYVEZudl5SMakVXYtjmHbdORZLEI8nSMTj6HGNhKHZtWjFiZwkvJvJ/3e6XLgdDjwuF5aQcDoNe8BYddDgCqPLfuSsEjr0LqDHHiPI9si0NtTS1lCLEWvl+jtvSQvP7LpnHGDVypXU19dz/Q3XU1RYwMCBA9mxfQeXXXbpblSGHwJTilaQOtO+ffty7rnnMm7CRLxeH7FYGF3XME0D1aFiGDqxeDwtUdCuyF4f4XR5aQ4G6dKxhO0blvPm8/8kFArZG8GSuZKqqojfkJvz/wZ06g4/8sgjCQQCvPzyy3bS4HQRDIX48rOP8funM3jwMNoX5zB6//3pN6A/M+YuQkYioWnEYwl7Otq08CkKuTnZrN9Uicft5ozTT+cvfzmOzz79hKeeepqvvpq625BrKuxIPbJM08ThsPeYjNpnH4SAgQN7MWToP3j33bcZMWo/Hn7sKa666gqmT/1ilxtBxbQs9ESUvPw8appbyPN2RyDh8PjI9rvJ9snEW6pYWL2Br78I0djUTGm7HDp3LGX5suV8/PFnBENhm7SV5IkDlDoU9s3zoBs2RxpVwVQcKA4XssfNGsuJ4vNRWFBAQWE72hWXEAjkku9x4pb9RDWTtqhGfURi4KBhjNxrII01O5BkJT0dLYR9g3fr3pO77rqb/MI8br3lFr6eOhXQsfQYew4aSF5eHi0tLekadMoLp9r1qTMEGDhwIOeedx7jJ0wgPz+fjZu3UlNXR7/ePXA41KQUgy3unkjYy0ZVWWFA394UFBYwffoMPnznDRYvWEAsOWnjdLrQdA1N0zj88CMoLS3hmWee+c1a+r+Zh66pqWHy5MkMHDiQe+65h7q6unTXKBwOM336VKZPn8peew1j/DHHMqBXN0zZXs8QDEXIyvKjabqtmuNwEouEOeO00xk3bhxHH300EyZO5Ohx45n/zTc8+ugjvP/++8Tj8e9xg2VZxkzq0vUf0BdJMolEIvhlDy+99DJV1bWM3n9fJr31NjNnzubxRx9j7syv0TRb6/no8RPRPQGK8gvJyfIQj7RSva2SFUs2Ur1tC03BGKavI4qnAJffz9N3j+HEcQdz95330NDQgG7svChy8vF/TImPnopORLdDG0kyMCwNORZiRQhWNGk/eKYOh4PCwkI6dO5K54rudKnoRcDnw+32MPaIwxkxfBhffPklAD379OeUM87kpBOPJ9LWwgMP3s+cWbN4881JjDnsIAxDo11xMT169GTevLnpdveucWsKUKNHj+acc85hzOFH4Pd52bqjiq/eepvHH3+M884/nz0H9McwNDsUEYJQOIoloF1RPmVlBWxYu4pbbriWzz7/LN0pTQ0taFoCn8/LBRdcwO2338mxxx67Ww7wW9hvspNZVVWxfPlyIYQQ27ZtE9dee60oKipK/4yiKEJRlPT/d+zYWZxw8uningcfF98sWCqam4Oitq5BxBNxYZqmqNy6VeTl5Sd/tqO46KKLxYyZc4Smm0IIIVauWimuuuoq0b59e9GjRw9x7LHHivbt26df3+12izWrVwoj0SYS8VaxYcP69N5uQPTq3VvceMvt4vV3PxZ/v/thMfqwCcLjDYgbbrxZfPTVXHHqmWeLIcNHCq/Pl97pDQgCFcI14BRRPO4m0eNvj4t3Vm0UpqWJ66+/QnTs1EF07NhROBwOISf3VB/dtUDUn9pLbJrQQWw4pqNYM76DWDG2RCw6pJ1YcFiZGF6YLSRJFqqips/IoahCUd0CEIGcgt12iPfp01/cdMttIhKNiEPHjBEVvfYQF155o3jipTfFfQ8/Jg446ODdrs1fjj9OtAVbxY6qSiGEKc4///yde7FlWey7777igAMOEIFAQEycOFFMmTJVmPYRixWr14rbbr9TDBq0Z/rffDl1ijAMQ0SjYVFXVytag0Gxcs0G8eCjT4mTTz9TdOvWfbfX3/Wa+/1+ceaZZ4o1a1aLeDwmNm+uFIFA9m+93/z//yKqqgpA3HTTTaK1rU20BVuFbhhi6YpV4sabbhG9e/fZ5ecl4XQ6dwPeyJGjxD8feVSsXbdOpKyhqUn069d/twPxen3i6KPHiZdefllU19YJIYSY+vVX4qOPPxZfTf1KvPXWW+L6668XsiyLbt17iJaWRtHaXCuElRBPPPG4AITD4RDKLgB1u91i4JBh4ujjzhJ9Bu0j7rz7fnHyySeLzuW9xLADjxUeb7bo0qVcqA6ncDhcQi7ZTzgPvFt0eWa+GPzZevFKU1TEzIS48/YbRI+e3UXvPn1EfkE7IYFwKqqY/Zc+QlxQIdrO6SpC51SI0FldRMsZXUTkzAqx4NieIsvpEJIkCQl5tzN15HQQOPNERc++Ije/UJSWtReSpIghow4VqjtLXHvddeKE084V+485VowYfajIzs3b7YwdyWtSUFAoli1fKbZt3yI0PSYeffQRoSiKGDRosJg8+QPxyiuviLXr1ol777tPCCFEOBITn372hfjrmWeLdkXFO52WLAmf3y+WLV+WvkaVlZvFs889Jw486BDh8/t3fnaHYzcnUFpWJv569jli9ty5QgghdEMTO6q2iyeefCrt7H4jMIvfJORIPaqeefZZzjjrTLxuJwndwOXy8JcTTiJQ0J7KTWtZuXQxixcvJBIOpztXiUSC2bNnMnv2TIpLihk/bjwnnHgCQ4buRd9+/VixYjkOhwPLsohGI7z//mTef38y3bp1Z+IxEykozKd/334ccOABFOTnc98DD2BZFu1L25OdHaC2thpXXOPLKVOSyZPN3U3FjvF4nKULv2Hpwm9QVZXnQ/VUVHTjokuvYMnarSyb+yk+vx+HDNl5Haj190IqLsOVF8BUBJYexYoJZDm5y8Wy8LkUmpCY2DOf4e0ErRELIcuYSQ07Q7fwuGSeWt5MSNNxyDJ6Wm5YQnF4ILcnGNtw+nJxBdtQVXuRzqj9D6RTh1Jmz5nLkm+XEA617d5wkiQs05Yyk2WZxsYGFixYyGGHHkQkHKG8vNyWHiguYeXKldx44/U88cTj5Oblcu99D/DRhx8w75u5mMZO/RVZktANg/IuXejSpZxvvvmGV155hY8++ojt27enP3eKYqzrOqqqssegwXTr3Z9OXbtx4H77UdCugHA4SCQSRkgSzz777G8+TvabADrV5KipruaF55/nmmuuQktoYBmEQnHqGltoDFoM2edg7r3/Pj7/9GM+eP8D1qxZk46DZVmhtqaWxx9/nMcff5yhe+2FqqjpEaBd9ZyFEGzYsJ677ryTkpJS1q9byScfv4/D6WHVqrXc/8BDOFSVeDyGBNTVNbDk26XJEp+1W1Vk5/o0gWkYbNywjo0b1nP0MX/B6bAB4nF5cLrc5HQcQG24CCUvG8XlwOVVCG/ZhN4lF1mVQRJISCRQCDidXDwwF0NPIMkqEgZCkjCFhF+VWBl28PbmFhRZxRTJuFuSQVg42/fGyC2BtlZcheX4Q03Ikp34DRsykFy3xQ2vPY8sySiSnBae/6FuoSRJLF60iMMOPZBoNEp+fj5PP/0M2Tk5ZGcHePfddxgz5nBuvPF67r//we9VkkzTxErGt5FIhIMPPmi3itNO6q6tv9GzZy8OOvhATvjL8Uz7ZgXzl66iucVuLumahsPhxO3x8P6bb7N40UI7Gf8NN+f+ZklhKkv+xwMPcvRRR9G/Xz88niBt4Sgd2peypbKaxUtXMvbQ0Vx55dWMPngMr7z6JpG2ZlatXMLyZUt3e70F8+d/j8qZqjmnDtJuwToRCMYkGyAPPfww4XCUU089GRDIssL2qu3U1FT/6M2400MkwS0sFMke3FUkxdYu9nvJKu0DlX7cedmobhW3plM5fzpK14kIZJsDLAkMHU4bUMTQAgetERMVy26rCMCS8LidvLSolaBm4HaoxA1hyzeYBg5fLr4BB9JcG4W8zvhKOkHzBrSwzVDMCXhxJWvPiqrYutLix/kLQgjWrV9HQhdgxe1qxcaNfPbZpzz88MMcMn4CAB6PN63WqmnabhWHlDPZvHkzmzdv3q2tbhgG3bt3Z8Aegylp34mjjjqSwYP60tbSxpJn30LTDQrzswn4fXg9XiTJ3qx23733/S7bvX6zqdPUBwsGg5x15lmEw2GK2hUSjUZpV5iP1+uypz/mLqC1LYxAoikYR/YWcMmV1zNt+kxuvPEmhg8fnpaKSncjk52qVEdp185S6u81LYiWCFNbU83MGdOp3LwJh8Mm11dXV5NIJH7BASYnS4DuFV3oUdEFXddwqgqFRSU4AiXg8qL43LiyszE2Lye+aRmq04ewLGRJQhNQ7Jb520A/uqGjyNJO0owFbgXWhmTeWN+MJMt2TVqA15OFw6HQce+D8ffcE8Plg9wiFE8W/ixfmnIjpUlGO29E8TPXpKmpidgukzRPPPEkK1asoKamJglcgcPhTIN419XNqfPdfTuVoEePHpx3/nl8/PFHPPH0S5R2HUBbzEISFqFQkCUr1tAWDOJ0KpS1L0aWJLIDfpxON1ddeTWbNm5MOivzvxPQKfClxNEnTpyIaZp07NABWbIoKipAlhWWrVxNMBymqF0B7UvbsXXrdpYtX0+HsnLOPe8Cvpwylfnz5/PUU08xccIEiouKEEndhlTtNLUDMP1ITNaeUxPVsizj8XjsUAVoa2v71aWhgN/HXkMG4HCoqEBOfhEJNRucHnA6cTsgOOMjZE1DlySEJVBkiVjC4ITuLspznCRMYW/HSmpTmAh8DhfPro7QmNBQJJFsyNjdRH92EUWjj8RSfChZWaC6kBwufB5XunGuqiqy8usuWzQSQdMSSZVYaFdYiCzLRKORXQZXjfRkTaozaO1y7h6Ph+HDhnHDDTfwxZdfsmjRQu64/U72GjaC9ZVbWLtmHT6Pm4LCXISQmP/tUizLJMvrpV1BPrm5AfLz8rj88st5441Jv9so2W8ueJHSkZ4yZSr77LMPDz30T7p2Kae5LcqyFSvZXlXLkqUrGDVqbyrKO7Ny1QZaQ21srdqB2+WkU4cOdOvZk/yiYs46+2yamppZvnw5c2bPYu7cOaxYuZJxR4+jqKiIF198kerqajRNxy/5sdDSFyKR0LCEiW5YxLVfH6MZpoFDcaA6HIh4HE9RRxqFB1QD1e/F2rqJ0NyZOMaMBMteZaebgjK34KReAZvIpAiEKbAkA2HJeBTB+qjMpLWNtpc1bY4HkgS6RsGgQXgrBmIt3ojqzcJsDaEoTnt7QHJwQVGVZH371zgaIyn2aE/i64aWDON2et3aulpUReXGv98AyLzxxiTcLhf7778/I0aMYMDAAZSVdaSpLYjb5cDhcLBx42YcHi91dQ0IyaJ9STvycnLZVlXDitUbkGSVbhXl9O7dg0S4hWOOOYZ33nnndwPz7wLoXUG9ZMkS9ttvXyYecywHjRnLgAH9WLJ8OV98PZOB/fvTs6Icv99DY3Mr1XUN9OjamWAoSGlJAS0tLXz99XQ6depMzz79GL2/zZt97fU32LxpI5988gknnXwyjz7yCK3BIHn5BUnVU3dy5CmGZUoYhkCSfr2yqb3KTQVJRZIlHIFCgroLXFGcPi8tX76CFGrEdLkwhYyEIBbTmTjAT8cciLQayb2GdjyuIfC4vbz4bQvVsTiqLGHsEisYqkzxYRMRDg9ut9NOxBwOuym0C5vOJhL9ut9HlhX7DISEYehpEXFvcp5PCEF9YxN7j9gHyxLMmDGdM888mwnHTqRzWXsaWlrZuGETU76eSUX3bozaeyjhYAhTSMRCIapr6nA4HHSr6ISkqMz8ZhGGJRjQuyflZYU89vCDvPLSCwSDwd8VzL8boFOgTiV0b781iffefYv+AwfRu/dAZGFSU1/LHgP60bt3d2bPXczGzdvo2qkjbcEgiYROt/Jyzj/vXObPm0dpSSkl7dtT3rUrLS0tXHnZpRx88MGsX7+eI448kpqaOsq7VKAqLgqSZKGGhkZM09ZUczpdv7g8lI5LhUCSZGRJBlVFzSoiUqOAz48UbKRp6nsEfFlIuoQkmcQNQXunxnF9AxhGzBZ8N5LiMih4FZONQcHTa5qQJJIbZy2QFYRlUtB/L7IG7EUsmkBWHbbyqFMlumM9uhlJ0pykZIjw6xIpp8ttR5eSREtLKy0t9prh0tJSu3oRbaW8vCsVXbtz5JGHM3bsWF555WUuv/QS6usa2L59G3W1NVgCpk2fgcvhZGtzK7plUrl1O9uqaynv3IFhw4cS0zSqtlWR61VYOPsznvzHAsLJMu3vDebfFdC70ktT07tLFi9iyeJF5BcUsmndCo4+eiy9KjrS1hK0p35lFYRONBYlJzvAkMF7Mmv6dLZsqWTLlkrmzZkNwCUXXch+++3HjBlf89ILLzBs6BBG7D0SkCjv0hWYwo4dVSQ0Hc208GX5kRUF6xccZipxFMJKDota6KaFcOcQi8WRS/OIfPMl2rYN5HbphCEMhCwTj8Y4pruXkmwn0caoHRZIqXMwcXlcPLaojeZYAkWWMC0rKeoIMhLdx52M5XChKDEUSQJZQZYN2rZ8S7siP0qSTSjJSjJt/WXjcgC5eXl2tiRJVNfUEY/HycoK0LVrOQAtLS089MD99O3bj/vuuROAU04+hdWrV+/2er1796WstATDNInGY7hdTmoaWulQVsoe/boxfdrXvPv2O8ybPYv6+rofLAH+3va7i8btWmpL7V5pamxg5rSpzJw2Fb/PR6cuXelS0Q3FCNGte0/yc7PIzcnmhBNP5KknniQWiyFLEmqS8vnZ559xwIEHMnzv4QDMnDmLc845B4AePboDUFm5mWAwiGmYZGUFyPIHaGtr+dlKh9hFGjelUYfDDf52JCxwoRP8ehIuy07TZFlCNwXtXSbjegcQCT290F4StuqqV5VY1azwwqp6e8uuRRqclmlQ1H9PAkNH2QR/xZ43lBwuHLFWIrWbsIoGoqhOuwwpkZQR+OVWUlqKQEZRVCorK21edZdOZGcHAFi2dCWWZTF8+FCEECxbtoQNGzemCf8pFt+RRx1lL1hqbaa6upoNGzYxe+YsdmzdzPuvPUlDfcP3auC7Xv9/h/1bNWvtnSv2xXa73cTiccKRCKtWLmfVyuV8/P67OBwuStuX0qVzJ8o6dMDr9RCLxWxxgGQmPuWLKRh3aQzaYxDtigr5+uuvqKurw+/Ppk+f/nbteft2aqqryc4rJCuQS0n7sl8E6O99ZtNC9gWwXDkI1UJpXEN06zJcAa9dr5Zl4okEB3bPomSrHyOhJ+fa7CYLwsLh8PKPZY0Ev9MVFNjxdfGE44ijoloCIQksVeBQnZhNG0lEwhhC2bmBIllR+TVWXl5hr6lTVFavXo0kSfTt2w+wJ45mz7IHi/feeziSJPHll19iGsZueh2yLDNv7hwOPGA0VdVV1NbWEQ4Fv/debo+bRFL69z8h+fvvVxYX9kXxZwW48urrGLb3SIpL2qe/resJtm6pZPr06bz6yis0NDSmH1cpdtjKVSuZN2cOPl+Agw85lLq6epavXEUwHKG0rBPlXSvQNI2ly5ahqg4cLjc9evf5VaW71E9ZwkRyuBE47bby1nkIYeJU3alNZDgV6FLow8JCyCnyg8BC4HHKLGkSvLW23t5pnQSzJMsIy6Jo0FA8e44iHmxBSDKmZSEUJygWVsNaYgmdtpZme/IFCfErbsjUYqZevW2l00RCY/HihQghGDJ0GK1tMWpq6vniyy9xOp3su+/+CGHy1ltvYVlWemoodf4zZkxnxozpbNywYTcw5+cXMGDgIM4453w6du6czj/+E6b+J95UkiQaGupZsHAhf7vmJnJ8bqp37ODradMIB1vQtSgN9Q0kEgni8Ti6btgxqRBk5+RQU1PDCy+9wr77j+aoI4/m1Zdf4dNPP6d7z74ISWKvvYazccM6pk+fzqGHj8UyDfr1G8AH70z6eTCInZ4wNUIcMwWqUCGyHWvbNzuTR0lgYdm6JJIdDljJfyRJEqYwkF1+7l1WS8gwccoK+nemjDoedwYoHhTTvhmwLBSXBzm4HalhG7oQVFdV0blzx+TrgvQLQo5UQl7etStlHTuDEFRt28KqlSvx+f307N2PUDhK9Y5tLFu+jP33G02njp2YPmMGmzdVMmTIEIJtbRiGQULTABmf34fH7aagIJ+8giIsZIYMHcrAAXsQs2Q+//AdNq7b8JvMBv5PATrVsZrx9RR8Pj+33n47vpwi6lsSNNZXc/P1l+DxuJk5ZwFlpSW0L2lHU1MLefn5uD0u5i9axMRxE1i1eh1Dh+5NUXEpb785iZNOOR1TSOw3+kBef/UlZs2cQWtLE5Yl6Nt/INk5ubS1tqTH+X/kbktvaFJku6JgOd3Iqgp1qzBbttiAliwkIfA4VHwep13nlRTAREZgCIHX6WR2lca7axuSXcRkLqGoWKZB8cC9KBgxmtrqBoQvgLDsjWE4ZMTWZeiWkayJaxi6bs8h/sISZOpJNHz4CCTZgdfr5fNP30PXdQ48+BBy8grRDcH0GTMQlsURY4/EFPDkU09x3kUXc9utt9AWChMMhpAxCccNlq9cx9BBvenSoQMvvP4RK1dtYPTBY/H4HLz83LM88/gj/5ad7v9dIceuoFYUPv1oMldeciEbVy9hYP8+bN5Wx7vvf4EiyWgJi2UrN+BwuaiqqeHa62/grLPP4ZFHHiHY1sKzzz5LcVkxp5xxFtXVVSz8Zh6mJajo2Zc9hwyjoaGeuXNnk+XzUdCuiL2G75P0XtLPhhrCEklPI6G4fJjCAdvnIpJEGlVREKbEkGIXimxXUOyo2UJKDsdaqpPb59WhW2Y6PAEJSQhkJHr99XwMpzP5eZIeX5ZxmhH0TfN31jJMgaZrdkKJvdvvl5yvqqqM2Hd0MqY1eS+pgXLwoWOJJeJoWpy333qTktIyjhg3kcXLVzNlyhQ+//wzxk08lnPOOZfPp36N4vSwcdM2mpvbyM/NZfnaDcxesJiBg/sjrAj33noT9995M1byBvxPrcv4jwLaTrjsZGPatGmc+9dTeOyhuwl4JeYvWkg0nuCQA/bGAFav38qwIXuyeuUyXnjmaSa9/DKRUIhXX32JJ598Bo/Hi8vl4tVXX0RRZTRDMG68PQkx6fXX8XlcmLrOYUccaSeFP/k43MmPMJM8g4TiRmutgrZv04hPmFCRZbF/Ry9CjyIJC0kYIJLe2aXw2bYEU7Y1o0hyGoSSYk/UFI/ch6y99kcLhZBVsCR7sZLk9iDXrEZv2p4e/NWFTicn+GUZw7J+tgytJGcX9xw8lE5duuHxuFm2fBFrVq2md5+BdKnoiZ4wWLx4PhvWr2XEiH2YNWsW1199Fc1NTXy7cCEfvvs2H7z7Lr179yUU1dm2o5YRw/Yk4PezcMkqLD3GvGmfMG7Mwbz8wnOkjvQ/Ceb/WMjxfU9tZ9sff/gekiRRVFJKsHEHJ51wAh6HwoqVa8jOcnPb7bezdPESgsFWDNOksKCQPj26snL1GvIL2jF3zhzWrFhGYVl3eg0YSvcevflm3jxWLF1Ep2596NarH3377cGK5d/+RJxne0vLsmwBckkGtx+9aQMQQsgqkmmh6wZjuueQ45YxTQs5KXCIUJAFaHh48JvNydb2LisrhEBVVDqeeBbhRAJHkrRkSDaxx6nKNM7/Opk7y/ZnMQz6F3uYs9J2AuJn4tPUe409+lgM3aKonZ+bn38egAnHnYBmgt+p8MpLLwCQlxegINvLyL2H8tWUz9Lrnf926aV06tiROfMW4lQVmhvruPOut3nl1TfYWrkxPSeYapj8h7H83wHoVGnM7oLZDZja6ipee+UVXnvlFdwuNw6XC0mRcKoOQuEQZpKHoCgyo0fvzwGjR6OoLq6+4jIeefhBHnzsWRpicMIpZ3Lz9Zfxjwfv5813P6ClLcixJ5zEiuXf/nwMKmNXFhQ3kuJDr03KKUg2yaiTX+bIilyMRBxZcSSXjIKOidfl4+11MWZsa0KWd+pNSIqMMC06jBmLu9cQtEgQh9tthyGWQLgdJBo3UzNriv0gsGz2n1sSdAy4MRA2+n9Cwz91o+4xaAgD9hhKlt/DymULmTljBv33GEyv/oNQZJnVyxYzb84cTv3rudx0y620Lyqkasf2dN3YNE2ee+Zpnn/uWQzTRJgWwWDrd54E/76Gyf9EyPHdR/2uooApxct4Ik4o2EawpZXGhoY0awwkVq5cyeDBQ3j3/cn06tuHa266mRXLlvLN7K9xuZx07zuI4SP2Y9433/Dhe29T0aU9A/cczPDhI3/RVldJGAjVhaSF0ao3pD24QDChh5/ibIO4aSeBKe+kIoigcNfsHbaXFVIydLYR73B76HL8mUTjcVSSoYgQWELg8Plo/fpzYq0NSLKKLckLxU6FfIeFniq+/FjpUdoJ6nPOvxhZVShql8cdt96GJKkcc/zpxDUI+F089vADHDLmKE469XQ2bljPTX+/iQsvvHC3J1dzcxNNjQ20tTQTDLYikWT7yTIg/e6rQf5nPfRPdRe/e/F251pIfLt4MRPHjaddUTFlHcrIzcnlgXvv5pGnXiMet5h4/OmsXLGEK6+6kgMPOohO7Us4+YyzWb58GbFYxF6i/gNJlmlhk/YVN2q0hbaQzX8wLJN8p4MT+xViJqK7NWoEAqfXw9vfNLKkptnWq07JJMj2Y7nr0ccilXfHamzE8niwhIUlC0yHAokYWz6fnKx/W0lvI9PNo+B1qVjImKZAN/UfiZ1VTMNg/DEnUFTWmX69y3nw3jtZu3YtR088ibzizvi8Hj7+4B3Wb9hITl4BF559GlU7tqf5Fj9UKUmFYUKI30VY/g/qoX8c3Lt+ffd7qdnA+rpavl20iPqGehrq6nj2sX+Qne1FdTu55IqrKSgs5NRTT6G8cxnDhg7mlNP/anvpH2Gu2aU3CUmR0Oo2E4uEUkE/o7vk0jPLQosZyQO042RFUYhqTv7xTVL5NOkyJclebZFVUETnk88iFongSJKMLCwsIVCy/DR+M4XmzettrWlhpTeEdfckxW4VOb0i7odCDdMwKO/ag6MnnsAe/XryzezpPPSPf3DcCScwaPBgkCwaa7fyzBOPARLzv5nHurVrCIfDP/i02nnu1n+dJ/6fBfQvSSp3nTe0R5NUpk75hC3rl/DuK09RX7ODCROOYf78+Zx5xmn079ODk087g333PzC9EnlXYKSqHEIIpHgTkaZqEomUZ1IY28UNegzJSg1Z23Gy4vUxaXUr39ZGdnt0p54CPU45HbOgCHQdWVHsf4fAkiVUS6PqjZfTHjFV5ctWFcpVi4SwkCU5vaV25yyktFMJ1ufn3Iv+xqiRQ6mvquSM00/D7w+w/4EH8cQ/7yXesp2nH3uQaDRik6J22QPz3xQH/+FCjv+PJ7dryDbL77033+DgQw5l3jfz+eLLz+wy3qQ3cblcPPf8C1x70y3U19ezZtXy5BSIlF4gqqgqpqmj6zEkrHSNtdTnYHBAENc0JNVu0FiAKkMkJvPcwnoUBUzDng6RkmNGheXdKTxqAq1trclFnTs7jUogQHTRPOpXLLWbPpYdbgigi1vB7xDJGQK7/a3ISZVQ037CWJY9Yf+3y6/lxOOPp2rbRo444gjCYVvp/+YbrmP0gQdTV72d5UsW/2bCiBkP/W/02gBz5s7llltuZuCAfrz26qvsvffeALz00suMO/ooenYv584HHqZH74FYpr0ks/8egzn4iPFYpsDapetlJRsqewUUchQNw5TSiaCwDFSXm0mLq1nToiUntO3QU06y9ipOP5uQN9e+MSS77gxgqApeyaDyxWdsZp+k2EmmZHvqLi7JrrhIdtvbskx8/gB9B+6F6nRjWgZef4DzL7uGCy66gOVLF3LoIYdQX19PUVExN970d+65+27WrFzBvXff9T054Ayg/0cs9UguKyvjrrvu4vjjjueOu+5mzJHjkSSFjz76mNEj96a1qYnLrruFdsUdOHrCBI49/XyaIwaGaYNSUWyFTM20veagbBm7fyLserBplw9b2hK8vqwZh8eT1rSQk4lgfq8++Pc/EK2tCVlVMO0d9xiYOAM5RBZOp+bbuUiKjGSZdiVFQK6q0FkVYAk7bEmGL4mEjq+wE6eddxllHTow5qi/sP8BB/PkYw9xxOGH0dzcTHm3Xtxx931ccOGFnHzyKfztbxfvEqaQAfT/opeWJInt27dz6623YlkWPXv15NLLr+Kiv11Cbm4umysrOf3EibzwxIPc8PebOPGMc6lvakFoEQwthiTLKLKEYQk03aCz20mFU0U3kjsHLQvLMJBUB5+taWZjEHyqEymVaAr7gHuffT4JpwvZspKNFhvQpqLgsky2vfxiWsPKwrKL4Mj0z1YpUO0byxQShgWmaWCaOtFgC85AIdfdej+SMLn0/DO4/eabsUyLESNH8ffb72TEqH1oV1jA2rVruPfe+3Z7ev1RTf0j/3IpUP/973/n008/ZdS+o2hrbmPp8uU7pVyFxfF/Gc+gwXuxbmMljVvXsmzBTGTpxt0aP6Yl6OWVcFsaJs5kFcIOA9Atpq1tQDhcWIaell6wLJMOe++Nf9/RNDeHUNIK+WAaBq7cHIKzP6dx+VIkRUEkEzMLC5essn+OEzUcQlZVYoaEYZqoSMQiYTYsn0u/fn1pbVfM8SefxPbNq9mELY5ZVbWDd19/mSXzZ1FdtYMvPv+Ctra2P3Ts/KcA9K6lvfnz5zM/KV6za932pVdeY8je+7Bq5Vo+mfwW7731WvLZpUCSCyyEiUeR6O1R0NGxJJBNgRASsiITjho0Rg0cMhhCQkbGwESRFLqdei4R00DBQmAPqgosTFnCEQ+z7tlnkg0YGTCRJQlLCHrluegXUFkVAocs06bpCNNKk6bisQgfTXoepyJRmDeaR558kRuvu5TPPv2MLZWb2VK5+XtlvT86mP/QIcd3PXVKNEVVVVuYG3jxxRc58KCDqa+p5ZUXnk6D2e322C3rJG8iIaCTW6WDU2BaAgUJS0jIQgPDJBgzbY6drQIDDhksi477j8Y7dDhaW9TumSdXUwjTQA34af3icxpX2HsAsVJlQTubPLTMi1ex5w5lSaE1roFlYVomjuTQbzjcxusvPMqqpfNpaGnjmWdf4pBDDgZsHWZlF3GePwOY/zSAToHaMOzl6Lquc9999zFu/Hga6up5+olHmPzuWwAMHb4/ewwehaHrSWhJSLJEH7eEW2iYQrZBKQSqpPDt1iBNUbv9nWSA2oBVVbqfdhZtpoGMhSV2lhZNVcUdCbLtpeftyoUkp3ewWAKK3A4OLlCIGRYqoEgKLcEE9gZdgao66TNwOAVFpWiaxhMP3cf6NcuJxg1eef0N+vbri6YlEEmexR+5qvGnBbQdYthacGeccQZXXHEFTc1NvP32W7zy8kvIssyIffbjhDMvoi0Wsz2lMBESuCyLcpeFmay1CUugAo1RwYfrosgSSa0LgeRQUYWg6yGH4xk4GEIRJEUhWYVDWDpqdhYNn3xI87aNdlcw2U5WkzztMZ3yKHaDJuzynizJNIVsZpssQUJL4M4t5uJrbyY7O4dEIs4tN1zD5k3rMHR4c9Jb5OXlpas9fyb70wA6JaXQt29fHn30EcLRMKtWreKuO29Pb3iqqOhGSfv2xBJasnRmYUpQIJu0U21lJAQYQuBzKHy8WWNNVOCS7bgXSYCp4cnKo+Lss4kmDBRZ3mW+Ljn90ljDjldfTHYY7TBElsAU4HaoHNPZj2bYQwGKaRFHoSac+kwCSVHQTcHAQYPIyc1FkiSam5u4/tqrCLUF6dKlK0888UQ61MoA+g9al7aFCp/A4XASCoW48sor0rtQJEni9Vdf5JN3XyfHn5WuYJjIFKs6ubKEmaxsKAo0mgqvrUsgVKftnS2BJCtEW4KUHT4GZ/c+GNFwcgd4skxnmbiyPDS9+SrhhjobbKnlmJKCJQQHlQTYI1siblpIskCRZNokmR0Ju5NpT6I4KCnI5cHbb2LrFluWQFVVFi9ayPPPP0NLsI1jjz2W448/Pq1ilQH0HyzUME2TU047lREjRxKLx3jhuedZtWLlbkvcdV3n5WceZtPqRXi9HhASlmHhtxLISkoSV5DldDBlu8nS5gSKMIklEghJxtANPPkFdDvldBLRmK0Zbd9NNgnJ40Zs2cyOd96zBdJ3YflZwi4xntIjG4SGUCQsSUGRJaqiBjWRBLIi2eKPls7sL99l2pefJlmpO1fbPfzwg6xfu5a6hmZuue0W/Fn+9A2bAfQfxDOnVjhfc/W1NDQ0smNHFf/4x0PpMOS7oUkw2IKiqkiygipBHoBkLzhCsohbDh5f1kQsSd63NB1kQTzURulhh+Lo3A09YQ+1CsluWyMsvD4fNS8/RyzcBrJMasglVarbuzibUcUyEc1Ic45VWWFTXEYXdoKqKArRSJhIOJjctruzPJnaSPDUk08SjcYpLi7jzDPP/EXc7wyg/4e8sxCCY445hvZlHUgkdN5++10aGxt/kNeQAoaFwJLAgcDvVBAeD8ICn0vl6waDOdUhclxuWwARC5FIIOXmUzp+AtFYDElN8jGSsbHsDyCWfcv2Tz+xNTlMy+4K7rJu/exeeXiEjiHZVFFZVTCdDrbEBU5VsbuTuzDkvluKsywTSZL54IP32bZtK3W1TZx26mm43e4/DJvuTw/o1EU/4cQTqa1vJhKN8vZbk36yNiuEzZ+whIWKhUNWkbxuTBOE5OC1dSG7YSOJ9EhtNBSi45FH4exUAfEYMhJIAiGDJYNLkdn49JMYhp5O7gDU5Lxhv/xsDmjvIhS3QJaQJBmH00EbMpWRBA5J2im9m4wepO99bntANhaL8uGH7xGMhskrKGH0AQel14ZkAP0/XtmwLIuyDmV06dqdUCjMihUrWLVq1W5g/76HllEdTrBsApIkyzg8WTgkWBwymFUTRZLAsGyAGYkojqJiSo86Ci0c3aWyYCFMA1e2n8is6dTNnYmiqLsMudp7WQRwWp98spU4OiCbdm1aVh1UatCg6bhdrrTmhcfrTd8Q0g/cwJIk8eUXXxCOxGhoDXLoIYemQvkMoP/X42eAPn37IoSKaQlWr1qxy/J6KakDbUvNShL4fH6OHH+MzZSzbB0kBVD8WUjAoqBAE6Y95Z1aphOMUHDoYSiFxVh6ApHW/RAIVcIdT7D52Sd2LtIj5Z0FprDomu1jXGcn0TggyViy3dIxVZU1kQTCkpBUeyAgGokwcI9BHDLmSPRko8j+XXdWQYQQbFi/nqqqalqDETp26Zwk8Wda338IQJe1LyMaj6NbFlVVO9LfS615E8KyxV4EJBJx5s2dnRaOUSQJRcg4c3JoNWFl2D42SQCyihaPY3n8FO49Cj1hJMek7NcyLRNXIJu6zz6kedVKJEVO86pTpTwhJM7vU0ipohG3DOx5dnuVRavqYV1Iw6E4ccgKCAtZVamprmLZkkXIsoJIJpVCWKmBLyRJIpFIUFtVTSwWx+Xx4ff/Oaodf4qyndvtRtd14vH4zmFQAUJYeLxefP4sLNNKrpAzqa+pQtfi9vQIYFoGWdkFbNagWrO9sykEwjBImDpmWQc0lwfFtAFqhwMWksONo6mBTU89boN8FwcpJ1exdQ14Oa6Lg1BM2xkSWHZduc6RTZsAj9teAYEQOB1OKjdtpLamOi0oYwlBTk5ectYwCVpJIhKJ2C18IdKbDf7o9odm26UKGC0tLSiqHULIDrf9+LVMevcbzDEn/ZWC/ABffvQOH30wOa01kdpdKMkykjBw5+SwIYG9T0W2gasn4jjbFaK2L0XbUG2DNIlKYUq4cv1UvfQ0oeqa3eihqZlBSwjO7ldIsQNqLIEkZCSwFUrdXta12t7c4ZDTS4NAICcJR8ISuFxuzrnwUgrad2H9mpW89/rzxGKRpGSCEwt7EVA0GstUOf73AW27xDWrV6M6FBRFpWv33unEb/CQofQfNIic/ALuuPMucrKz000WuzymIMkyTmEgZfnZZNqTfqkbJZHQ6HLAYShOFxgmlpyMmyXA50LesY0Nr71mE/Z3SUCVpHcuD/g4pquHVl1DTtasBRIOSSJmCJZurUmWHh1phqCUapcLgWEajB17BKedeRahhMWQfQ5KKo1CXl4BZR07oagyDXV1hMN21/KPTlT6QwM6RbRfvnw5Wzeux+/2MHz4CAYOGoxlmbz6wpO88PiDVHQpo1OnMnx+/y4HY9NHJSSchk7Y6aZZcZIuF0iQ3bWCgr32JRbWUGUZWdjCMqZl4vU62fLcc8RamnYDks3es9PCc/oW0sGhoSX9r5SMq12ywuK6OFtbEgC4XK7kauR0qpn+c+fOnejaqZRYawP/vON61q9ZiRCC40/9K76sbArzcpg2bUoyzMmU7f73E8PkJPftt95MIMtFlt/DNTfczFHHHEfvAXvQoayEwf16sX7tWmpra3eW3JItZaek4NBNDEsGdaeXRAi6HH4MmupB1zSsFNdZmDh8HqKrVrPu3TeTwubmLt7Z5lT3yM3ihO5e2hIGiiQnh2DtSoWBzFd1BkKxZcLcbg9ScnOuLMu7tcy//OJLAh4Xo0fuSXbAy6Ahw7n48us46NAjKC0qZPO6Vbz3ztvJrqjxhwf0H35ixbJsjsOCBfO55MLzuO3Ouxg6eE8GDxmMEFDRoYhgMMjfLr54NyKPJEn2TCECTANDyHg8TkJRWzAxq7g9eSMOJ9YUwsr1IEQqIbQJ+KseexwzHkdSlN3CDZEcgL1ij0KK5ARNpkCRBAIZsAgoEoubYGFDgiyvSisCd3EXRCy5PHQX9pzT6WT5ihXcfPMt3Hzz3xk6fCT1jS04HU4cksGyJQu47G8XkIgn0jlBBtB/kNBDlmU+//wzvv12Maedfiqj9hmF1+fl8w/e4vEnnmTN6tW7cTtSEl+KDE0mZAkPudnZhJqaAMgbeSRxVwArqmHqNj3fMi2U7Bwis6azZern9saqXVrOsiRhCsEehQEmlLlojYaQkiw7IUkI00TxBnhnSx3NwkGxrIKzmOzOexFZ+eEu5cadv5eiKNxyy80sX76ME044nkAgwPZtO5g6dSpvvvmmPTjwO+zUzgD6vwDUiqJQX1/Pvffcx7333Ld77PWdmTvLtH/e5XBQHzfIk1UK8vLYtnkzLm8ORqehxFuCmG4nmm7aXUVknGgsfvJRLGGhSCq71zVsu6h/IW4RoVkknwZCssVqFJWNQYlPa6PklA9AL+oJXYpQnB60RCT5uXafQEmx7CZPnszkyZO/H3D9icD8p6lD73rxJUlKK2im5gx3k+1KNlwsy0JSwOtw0BCX0HSd7OwcO0nrfRBhEcBoCSF0gWZZWIaJmpVN69dfsW3+PGRFxhRGGlhKklE3tDiHMUUOmmKmrbpk2cKQpmXgUhVeXN9Gc2F3ivadSPnZV0Pnfrjdir2SAjDN7+vMpW7W1Pxg6s8pgcU/k/25xhkgraC563L274JZJGWPTMvELUlsMyTaYlHysgM2OLuNQmuLEQtGQTcxdQNNklFjbSx/6smdRyt2Rs4WdtJ3SZ9cnEbc1tiwhC12bglcksqCJnhzSxSKezPyxDGMOKAnKIIcn4qW0JJPkp0ed9dplJSm8676zn9GU8nYbmAXQpCXl58MBQRhAS2yTCQUpCDLB3l9MAOdMYM1RFqd6IkE4Vgch9vP+refpWbpIluTY9fYWbYXcB7asYADCiSa4rGkJp0AC0x0LEeAJ1bW0xTXyU0Eef/Nr/APaAUthIqRVMtXMC2By+XB47H3N+5KP81YBtDpurIE+P1ZnHX2OcyaNROnQ0WP6eyIxrGcXqItrXiy86FkKHoigWQYxFraiEfjJISK1VrHmheeS8rdshvIhACn7OD87l60RBzNkpGFXdcwMMlWJWbUJ/h0exhFstAbNtEw9Qu2L1kHCR1vx27E47pNXJIkkCUOOvgQgsEg06dNS24JyID6Txly/OAhJMOMfv37cfzxx7FwwXymzp7L+sodCElGcbmor60hv2NPkLKRgq1Y8QTRljZCbREkt4cdk98ltH2LrTedCmEARbbLdAd1zKKfV9Acs3XzdEOQSC4TjeLh0TVN6EIHLBIN2zEbV+PcsRS2LcZhtKHpBg6XA9M0WLhwEU2NTVx9zTWkdDwylgH09ywYbKVHz558/PkU5s6ayTuvPkMw2ILP40Z2uehaUQFaAssASTdItEWJxQzi9dWseu+N71UUpKR39qoqJ3bw0xJLEDYhnjCIJUyicYFHwGfVcebVhO34GAlTjyKaqhE1q3G2bCDgctAWCqHHozzxjwcpLCjk6Wefx+f1ppPCjGVCjl0iDtvDnXbqGUiKQsKAgw+bwMYN6+lc1oGu3cppaGigZtsGXNHVxNfGwekAAeFgd6q/mUu0ZhtJ/VwUWUl7Z92EsR1zqXBqtCQEqgwGNsVUFYJtUZlHVrXaXUZrZ6hiWXHQ43SrqCAUbGH43sPp2q0XRR260rNnL3bU1jNq+GD22mso8+cvSA8CZwCdsXTFYMWKldTW1qEbBguXrWbJ0mVk5wRQ6loIeLNoDYW59tyDqa2tp6E5RG1TCGPx+ywN1oHsQAgNsUt3OfXHgVKI1dsSGJKte2ciowuBqgq+apTYGNJxOlQC2TkUFBZSXFxMUUl7Sss6EAjkEDNg0KjD2byllsbN9Ti8OfTqUc78BQvYtm37n0rq62edUyZF3tlUKSkt5ZkXX2PNuo00NjSyYUMljcEIbdEECCgoKGCvIf0ZPLAX3ToWkR8I4FRlYokErW1BWlpbaG5qpqmpyd5RriXwyA6KVdCNKEgykqwiZBmhOFAdXnS3B3eWH39WNp6sAEgykXicqpomvl22lnWbtlDX0EhCMyguzKd31zKyXJCVnUU02MLtN9+UQXHGQ+8ebkiSRO/evbnvgQexZAfNwSgJTWPz+iVoukFxaRd82blk5QQAhWAoQmswhkN20blLe/IdLso6/PT7GJhomoFpmMQTCXTdIqEZmHoMXdMJxUyCkQjBUJhQJEZtYysJE/LyCwl47W214bZa5k5ZjI6TYaP25+jDD+Gvf93OW29NIhKJ/OBipT+bKcDNf2YwCyFwu91MnfoVyApffj0LU8h0KO+OrkX5+vOPqdy4hi0bVlGzbSP11VtprqshEgxi6Dq6FgcsdMPAsAwsU8MyNUxDxzI1DEtD6DqRYJBIOEw8FiMSChMOhYiE7RsjFEsQi0YJtoVoamxi65ZKKtevYvPapWxYNo/1y+axZP4M1q1aTiQaZ8+RB6EnNFQJLr/0Yurra1i8eHFa0izjoTNGdk4uTo+Xrp3bM2PaDBbP+pIF38xJf1/TNOpqq6mrrWbrpvXU1exg3brVtC8tpajIjnvt2LcIp8tpDwkIBTmpLBpLaBimhWEKYokEWkJHS2jEE3E03aS2ro6qHTtobGigob6WUDCEJey2eE111c5KTFsTc754l/0OOIC9hvYjPz8HWVYyFzAD6J2iMrqu8+WXX3Dk0ePo1KULe4SiqA4VgcT2rRupr6kilNwoBbD/6NE89tjjtCvM/84rmlimgUjuCjctMz2FHQzGCEViaLqBooDhUDE8bjTdS0Iz8GZl0bFzF3uuEQfhcIyqHVv58pP3WL9qKaoiU1hUTM8+A+m/xxAGD9mTjh3KWLduLYsXL84khpmkcPeSnRCC4088kdPOuoD1ldUs/HYZDfUNuBwqqkMgGQmibU3s2L6NLZs3oaoqe+65J3uP2JshQ/akZ48KCgrb4fN4kLBFaiyL9DastrYg4UgMXTeJaxqabiTjaJ14QqctHKGhsZHqqio2b1jLhrVraGlqwOf3U9alHH9OAS5vAIfHT2FBO4bu0ZeA0+TUk46jrrbuT8eqywD65w5CtvcDti8rY/jI/Sgq7UQ0YdEUjBONJ/B6XRQX5NOhtB3FBQEciiARjRCJBJEkQSArQGFhIR06lNG9WzccThXLtJJ7vqG1JUQkGkXTTWIJDd0wMQwTLaFR39jE9h07aGpuRosnsEwD1e3DlJy0RjWaW9tIJDS8bicl+dlkuSWqtmzgs48/TEuaZbxzBtDfz5AVFdM0yM7JRpIknE43nbqUU1LWhdz8YrJy82jXrh0l7Qqp6NKRXj06U5Sfu8sr6CQSiaRbFskpFntOMBKKEYnFMQyLuL4T0KZpYloQ1w1icY141CAUi9LY3Mb2qjqa25qRTA2hRamv3sKKJYtpbW4gHrfnDVNCjxnLAPoHAG1LGJx9ztmcffa5XP/32/nys8+wTA2XQyG/XTu6lFfQuXNXKiq60bt3D/r27k5xUSFenxeX04kk/XhaohkWmm4Q1zViUTshTOg6kWiCppZWGhsbaWlsprqmmqptW6jZsZWqHVtpqKsm2BbE6XJzyqmnMGrUSM479wKCwbZ0uJSxTFL4o4nixg0bGbTHQC68+EIaIjKqrNDWXEe0rZE5M6cxZ+a09M/7/H7y8nIpLGhHVlYWLpebrKwsAoFssrKzcDqdOBxOVIdN/dQ1nXg8RmtLG+FIhGg0SktTEy0tTbQ0NxMKBW0vD0iqC58/m+y8EorK+3HoQQfw4J03MX36V7S1tWZCjQygf9pS4Fi0aDGNDY2MGDqILp1LiRsqffr3p8AHD965BmR7/s+yLCLhMJFwmO3btuPzZTFwYH8aG+tpaWlC1wxisTi6YRCLx9E1nTQ7TlLTz0bF5cHhdOJwufEVtqPA68frdWPoCdweDzk5hWQHPBxywCgAPvzoEzvcyAA6A+if886qqtLW1spzLzzP1VddxZD+ffhs+gIKC/Lo2KkDsiKj67otJ8DOTqOtNW1PjX/wwWTKyjqSiLcRi+uEI3E2b6+lpq6RcDhGPKGxbnMV69ZXEk3EicVsyS5dWFiWiRGPUle5imBjNUgKex84jm5dyxk+ZA8aG+t45eVX7SJhhoz0PcvQR3/AS0uSxH333kttXS0n/uUosnwutIROXmF7/n7rnekxp13n+OzRLp2ZM2dy1llnY1kmCS2BYWiAvSfc43LhcbtwOl3E4zF7LEuRsSRBPBokVLuVxk3LqFn/LVo0iC+QS4/+g3H7shgydACBQDY33ngzjY0NaSH3jGUA/bOAlmWZpqYmzjj9DNoXt2P8kYcQDDZTV1fH8BGjeOLp5+jVqxdmkqCfmuHTNHuQNT8/H1lWcDl9+HwBNM0iFo2TiOtomkkwFCQYDCLL9qSM0+HC58smN7+YdqWdycsrwJ+VQ79hB9Chx570qOjCSROP5L3J7/Dkk09mqKI/ldjzJ+Zy/FTooSgK69evJ9jWxtWXX8zy1RsIh6O4HE66du3KKaeczP777UtxcTE5uTkUFbdjwMABnHbaqdx6661MnTqFv555Nhs2bGDgoD1paGomqmnolkXl1h00NLXaSaJlIoSMqevEI220tdTQWFOFy+2mXVk3SooKuP/Wq1i1YgkTJxyb3tqVsUzZ7tcnGKqKYRice85Z3Hb3g7z29gcIIehQWkyO30enTmV07dwhKfxiJB949t6Ugw86lClTpwLw/gefgtNNMBxhR3U9q9ZsJBSLE49raIaOZhjE2lqo3bQKXU/QY8BQLMlNu4IcnvjHLaxbuYTx4yfQ0pKpbGQ89P8z/FAUhYULF7FowTecdsqJ+LOyaG1pQyATjUZoamwgGo2QSCQIh0O0trYSi2v07jOAWDzG2KPG07PXQFqCIarrGlm/sZJoTEczdCzLllQINlbTsHUthqahur1IziwG7zmQW647n4/fe5sTTzyJaDSaAXPGQ/9Gd30yZg0EAlxy2RXsO/pAkFRisTiyJHC7nHa92akiIaFpBorDgdPpJBiOsWnzNiq3bWNHVQ2xuIammximia7Hqdm2kepN6zAlmS69h1Ba2pGD9x9K146F/POBe/jiiym78U0ylgH0bwpqgI6dOnHMX/7CqH1Hk52Th2aYRGMJYlG75qxZFsFQmLa2EC2tbbSFwsRicYRpomsGCcNENwwSmoaWiJOd5aV7eVe6dC7FIcWZM+0r3nzzrfT7phh7GcsA+rc9LMkegDWSsrRer5fBQ4YwZOgwunbrgceXRTiusXZjJeGollwDZ69aS8YwSMJClhRcTge5OT7cLhUjHmbH1k0sXjif5ctW/OBNlLEMoH9XYH93C60sQWG7Yrp268aJJ55ETV0joUiURDyBQEKSJSQBkqzgz/IhtCiffDSZurp6mpKKpj/22hnLAPrfBmz7S05SRe2E7Z133mHsUUdSuWkzrW1BahtbqGpooS0cQ5JUunYq5alH7uWrL75Ivo6c7DRamaQvU+X4z5o9mGqDMCWeOPn996msrKRL1674s3OIxE2iuokpZOq2b+bVpx9l7uxZaXF1kdzIlYmTMx76v9ry8nJ56bVX2FHbwpr1laxbsYQvPp6c9u4ZAP/2lml9/06hiMPhoLm5hcpNWxl94MF06daDHdu2pPWpM2DOeOj/SWALIejZqxfhUIgdO3ZkPHMG0H8MUGfCjAyg/zhxXXJPYQbMGUBnLGOZpDBjGUBnLGMZQGcsYxlAZyxjGUBnLGMZQGcsA+iMZSwD6IxlLAPojGUsA+iMZexn7P8AAkEaccjz/CIAAAAASUVORK5CYII=" alt="Império" className="w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(245,158,11,0.5)] animate-pulse" />
        <div className="w-10 h-10 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
        <div className="text-zinc-600 text-[10px] uppercase tracking-[0.3em]">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
        <canvas id="rain-canvas" className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,_rgba(245,158,11,0.08)_0%,_transparent_70%)]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md z-10"
        >
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <img 
                src="data:image/png;base64,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" 
                alt="Império Barbearia" 
                className="w-28 h-28 object-contain drop-shadow-[0_0_40px_rgba(245,158,11,0.6)]"
                style={{animation: 'float 4s ease-in-out infinite'}}
              />
            </div>
            <h1 className="text-5xl font-black text-amber-500 tracking-tighter mb-2">IMPÉRIO</h1>
            <p className="text-zinc-500 uppercase tracking-[0.3em] text-xs">Gestão Profissional</p>
          </div>

          <form onSubmit={handleLogin} className="bg-zinc-900/50 border border-white/10 p-10 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-8">Acesso Restrito</h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">E-mail</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500 transition-colors"
                  placeholder="admin@imperio.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Senha</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500 transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm flex items-center gap-3">
                  <AlertCircle size={18} />
                  {authError}
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-5 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-amber-500/20"
              >
                ENTRAR NO PAINEL
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-300 flex font-sans">
      
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 flex flex-col sticky top-0 h-screen bg-zinc-950/50 backdrop-blur-xl">
        <div className="p-6 mb-2 flex items-center gap-3">
          <img 
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAABvd0lEQVR42u2ddZxU9frH3yemZ2ebDZZalk4REARRsVFUQq9d165rt1679eq1uxUTu0BpkJLuWGq7p+fU9/fHmRnA9v70hs7zeu1LZJeZ2e/5nOc88Xk+jwQIMpaxP4jJmSPIWAbQGctYBtAZy1gG0BnLWAbQGcsAOmMZywA6YxnLADpjGcsAOmMZywA6YxlAZyxjGUBnLGMZQGcsYxlAZyxjGUBnLAPojGUsA+iMZSwD6IxlLAPojGUsA+iMZQCdsYxlAJ2xjGUAnbGUSZKUOYQMoP8AF0KWURQFITIyKf8fUzNH8MNeUpIkLMv6XQEsyzJCCIQQ6ffyer1IkkQ0Gs2AO+OhfxtLAUxRlN8NzJZlYRgGpmliWRZ9+/bhrbfeYubMmRQWFmbCj4yH/m08sxCCbt264fP5WLp0afrvfsv3sCyL4uJixo0bR2trK1u3buOtt16nffuO3HjDjWzZsgVFUTBNM3NR/hWHlPmyv1RVFYC4+uprRSQSFVdddZUAhKIov8nry7IsJAkxcuQ+IhqLCCGEsPSYiMfDwrISYuOm9SIrKyAkSRKSJGWuyb9yxpn7+fum6zr19Y1cfsVV3HjTjZimiaIo6S9VVf/lcECSZCoqKvjnw4+wfNm3JPQ4bW2NSBJ8+OGHhELBTHKY8dC/zVfKEx922OFi8+ZtYuasuaKhqVkcethhv9l77Op5S0pKxKpVK0S4rUFoiaA4bMyhQpKk3+yJ8Cf9yhzCd8EWCATE7DnzxOJvl4pVq9eKadNmCIfDKc4446/iueeeE3/728XC7XZ/D6C/5n1cLpcAxIQJE4SwEqK2ZrvoUt4lHZpkrkcG0L+pl77oootFTW2D+Gb+QrF6zTox+f0PRXVNraiprRNCCPHW2+8ISZJ+FHyyLAtVVX/0+6k4uaAgX1TX7BBr164WXq83+b0MoDMx9G9klmWBBI888k9mzJhGbm4eiUSCgQMH0traxiOPPMrEicfSt09fBg0ahGVZyLL8g69jGAaWZf1ovC2EoLW1jebWEK3BENFoFJAy8XOmbPcblu0An8/Peeedh8/nw8aWhKZpbN68iTvvuA0Ap1PF4/H8aI35sMMOY/z48Tz99NMsWrQo/fffuwCqiqqoJOLx5GcgA+gMoH87QCPg4Ycf5aijjiYWi2OaBvF4FEVRcLncOBwOhBBMmzaNUCi006vvUmN2OBw89dRTdOjQgfLyrhx44AHf89KpbmRJSXtyArls2rhht1p4xv7FplXmCHb3rN2792D//Q9g+7YqXnnlJT78YDJ5eXkEg23069eHQw89FMMwqK+vJxKJfC+EkGUZwzB4/PHHqW+o5/3330MIkS71pb5UVcWyLA4/YizICsLKgDhTtvstKxyyXa3o0KGj2La9Rrz77kfp7z32+JNiW9V2sWbdGrFkyRKRm5v7kwlhKrGcMHG8WLhwgejcqeMP/lyfPr3FwiUrxIKlq8TMWbMy1+HflRSmvMof+q62bO+6ffs2Xn75RQbtOYhu3bsjSRK3334bsWgMXdcpLi7m6aefTocGP5QQpjx+NBxl8OAhzJk9k/PPP5+SkhKcTie5ubkcffTRvPjiy8TjBuFolKxAFg5V3Rn6ZOxfPot/qSnwR69FH3/8ieKCCy8QgUBAAOL+++8XTc2NYsWK5aKtrVU899yzaQ+tqupuZ+N0OoUkSeKSSy4VpmkJLdEmhDDEhg3rxLx534hvlywTW7dVicXfLhdfTpsrPps2R2ys3CLy8vP+NOf8e+FN/iV3R0lJCQ8//DBCiD++p04mZG+88RqPPfoY0WgUSZKYNGkSpmHh83mpr6/l2GOP5f33J9O+fXsMw0ifjaIoaJqGEIKJEycgSSaGaRAMNuN0OSkuLsXl9FBTW09c11EcKtFwBJ/XT0lJScZD71pxEoJHHvkn7du3/8Xn8pOATtEnjz76aC6++GIOPPBAhBC/G63yv8kURUkneABLlixhzZo1+Hw+HA4ndXW1jBw5ghkzpnHhhRdQXFyMEALTNMnJyeHBB//BiBF7k9CCqKoDt9uDIsvE43FMy8TpdCBLMrIkEY3FkGWZDh06ZACdPHshBIcffjgXXngREyZM2A2P/zKgU+WocePGI4TggQfux+v1/CkOPcVTTh2kaZosXLgQr9eHJSxcbgdtwVZ8fg/33XcP8+bN5euvv+LTzz5l2bIlXHrpJWhaGEVOxsVIOF0OFEVGkRU7L0mS/HXdIKFp9O/bN3m2f97iU8ozZ2Vlcf/992FZFhMmjEtfk38Z0KmaanZ2Nv369sEydfr3H8Btt92WZp/92Wz58uXIskzqVnY4VLuE11CHx+tiz8F7MGqfvSkuLiShtWKHgMmflgQup4os2QmjDdqdJby6xmYGDxm6W9jzZzRVUbAsi3vuuZuePXthGgn6D+hPaWnpLwp55Z+Ln8vK2pNfkIcQJvF4lMsuu4zDDz8cwzBQ1T9OX0aWZVRV/cGqRQpgTU1NIASSvLOenPp3pqkTDLbS2tJKJBxFVhw7wWw/73A6HagOBaTUCJb9771eL1U1dXTr0Qun04lpGn9OMKsqumFw7LHHcN5556PFI0gIsrNz6dK5c/o6/b8A3b59exwOF5YQKBKYpsELL7xA586dMAwDWf5jgHpX7sWPnYfL5cLpUpEBeRdPkZoLlCQZWZGwLBNM0oCWxc4L5nI50vOEsiwjS/YcYXNLG/6cPAYMGJiO3/9scbNhGPTt24ennnoK00ggy2AJCwmJgnYFv8wx/dwPZAUC6YsmKxKGnqCwsJA33ngDr9cLWP/Th5/67OXl5dx1113ss88+ac+7688IIehWUYGqupMtcvEdL54CuIRpmui6vjPakNJ/wOV2IkkgyxKSZGPe7XYjyU5aQ1H2H70/pmn+qQAtyzKmaVJQkM/bb79FTk42pqkj7XIGfn/WL8rdfvzUpB97LCgk4mGGDRvOiy++mH6T/9UkMfW57777bq655hr++c9/JmNcO7ZVVRVd15FlmYnHHINparjdLptFtNvrpJGNZVloug5i92MUQuBwOECykGUbyE6ni0QiRjjYyLSvvyQnrx3H/uX4P0Uza1dn4XQ6mTTpdXr27I0WjyDLyg+f77/soZMOSNP0nX+R9Eo2qEMcc8wxPPXkk+kk8b/1AqTA+UOfLxUff/3112yu3EzC0CkpKcE0TQzDwDAM/H4/Tz31JIMHDyIei+B2e+ySG5L9JclpAApkLCGj6QaWAGQZK9kfEKaF1+MhJzuAaVjUVFWzeuVy6mu3k5+XQ3FJRzr36s/Djz1Jz+49/vAl0l25La+//hoHHHAw8VgQWVHs80qGcgBaIrE7MH8sDv+5N00xylLUSpKZpqqqJOJhzjzrLJpbWrj66qtRkhnqf1OWnioDperJ32WzpWLmJ598krfeeovrrr+OFSuW89VXU6is3EJeXh77jhpF14puRKOtKIqcrHAoJBIGkmR7YZG+OQRSssRke3YHsgSq6sEyBbW19WzYuAnDMCkrK2PPPfvSFkqwcvU6vpk3jyWL5/PGc4/j8eeSm5tHS0vzH5KBlwKyaZq88MLzTJgwkXgs9P1Cg2SfbnNzS+oB+NOv+2OQ38k+687y5ctQVQlhmbu/jyQTjSbw+rK57bZbuOXmm5OgFghh/deAubCwkGuvvYZ4PM6NN970gzedqtoluBEjRjD96y9Rnd5dq9LEY2FkScLCJuzrukEkHNt5Y0iAZWEJCQkJS5h4vG7yc/MxDY3tO6qp2lGF0+WmZ89eZGUFCIWDTH7/A15++RWWLFpEc0sL2Tk59O43kLIuvehZ0YkH776NWDy2m7f6nwezLCMJsITg8See4NxzzyEUbMXnde32Owph5xqWgAEDBrFmzdof5ZX/bMiReuGtW7eybes2FMW1292R+rMQClVVdVxz7Q3ckqxRI/3nmwOpclpeXh6ffPIRl156GUJYP1pDT02WNDU10djURGtrLYlEG4lEG7oWQ1FUSIYWKTqow6HubJAk/2vjWuByujENiw0bNjFn7nwi0SgjRo5iyJC92LhxIxdeeAHdu/Xg1JNP4aspU2huaaGgqD17Dt2LpYsXYMRD9OwzkCuvui45FfPHCD3smNkCGZ559hnOOvscdtQ02Of7/auCorrYsaOaysotv6hG/5OAVhSFRCLB7Dmzd5Or2jWZsiwTENTV1HHGGedw0y23IksSQvznqh+pu1jXdQ4YPZohQ/bCMAwU9edBkZIpiMViabK+lATydx9tLpfrO3GdndyoqsL27dtZuWI1QsCoUfvTp3d/3n77bQ488AD23HMwjz32OLW1tbhcHvzZhXSoGMDAPYcyf94c4tEoX3w8mdamWo454STGjR+PaRr/8/F06rp4XG5uu/NuDjv8KKq31yBLMqYpfsDJCEBm5syZxOPxXyTv8IsQN2nSm2lPtDP5sa+qJQSGKZBklW3ba6jouQc33nwbPr/vd5XT+qkww7IsSkvb89e/nsGZZ/6VRDyCIhscOfYIVFX5wc+lqipCCAYOHIjP50fTDEKhMIZufucm3pkEqqqCqirpMpvD4aShsYF169bhdrsZPfoAysvLefbZZxk4cCDHHvsXvvrqa4QQeHwB8tuVkVXQgQ7d+9Cndze+mfU1kVAYRVGJRiM8/dg/0PUEl115Nfn5+T85n/i/UGe2LIuC/DwuuuxaSjp0p7qmAVm1Q1TT/E4YIVnJsp3g+edf/OXvA9z8U15almW2bt3KgQceSOfO5Rh6Ymf7V5KIxTRiCQNLCOKaxtLlqwiFdUbusw/r160iFAyhKOq/JaZOKXhedNHFvP/++0ycOJGuFRWoqoUWj9GuqJScnGw+++yLdBs19RQxTZPs7GyeePwxXC4nlmVimRaWBW6Pe2cig8Su7WyEhCwrBEMhNm3ajNOpMnTo3uTkBnjmmac59dTTeOGFF6irq0OWZBwuN4G8EgIFJTh8OXTs1Im8LCdzZ3xJJBxO35CKolBTU0Onzp048JDDiMeizJk9639ShMbupJp06tiRv557MZurm/H7s+jRrQsupxOBhKpIeD2O9Dmbpo7LFeDjjz/i7rvv+dnY+RcBOgUSwzBYtmwZp516ajo2tp2VRDSmEU8YCMsiEovS2NzKihVrqW5o4thjJ7Jj62YaGurTI0e/pwkhcLlcZGUFeOON13n33XdZ/O0igsEwBQVFBAI5DBu2N926d2X16tU0Njam4+ERI0byzDNP07WiC+FQMBmzSui6jiLLOJ3O3UItISycLicCmXXr1tHW1sbew0dQXNSeSW++zvHHncCLL75MY2NTmozk9GWRXVCCy5eN0+OjrKyUaEsNC2ZPR9f13aoZqRutubmZQw4dQ7du3Zj83jtEIpH/KS+dSrb79u3L6WdfwJwFK0gkdLp360rH9sV43W4E4FAkvB5nOp9RFCehUJDx4yfQ2tr6iys9P1u2SyVRixYt4sorr+Lhfz5MIhFGVVN1Z4EQYCEQgGkJ3D4vG1Ztpqgwn/c//IRTTj6eBfMXpH+539NisRifffbp9/6+pKSUww8/jFNOOZkTTziZicf8hRkzZhAOhSguake3bt0wTZNgWxBVVrHMVFdE0NYWxO12o6oKItmKdbh91FRXUbllC106l1NSWsaCBfO4/vobmTr1q908k6w48OcU4PRmITvdZOfk4HcpbFi+gIbaqmTpb/cLlmKWLV+2lPVr1zBq330ZP2EiTz/1ZLpN/F9el0NJOsN9Ro7k8aee5sHHXqAtFKF9++KkxxVYyVKnkOwnnhAmlrBwqD7OO+80Nm3a/KuEK39RDG2aJqqq8s9H/smTTz6Oy+VH1w3syyDv1iETwvaUToeDWCyKrKq8MWkSx59wPIZhfK+t/PvEa/JuOnSyLFNTU82zzz7HqFH7MXbskXz77bcccOABjBw5ktL2ZbS2BQmFwsiSgmkJDEtgmCaWBbph0tLaiiUEsqIiySorV66kuqaGvfcehT8rwFln/5Vhw0YydepXu3Gp3d4AgXZlOLNy8Ph85AV8xFpq+Xbe9CSYpfSZ/VDcaRgGmzZuwDBNDj3ksN1q5//NyR9JbvhJJ5/MM88+azeqdCPZKbUxYAkLy7JsUCedo2lYuFwBbrzxWt54400cDsevUmH9xchKeerzz7+QV155Fbc7C9MwEUi7aUlISSaZABRVJR6PEwy28cCDD3Lr7belQ4/fM1k0Tbs8l+r2pZKpVDfz448/Yt9Ro7jissuJRmM4HG4SmomFjG5aaIaJbhjohv1n04LWthBxTScYivLN/Pnk5Oax5557MenNSfQdMIjV67ZQ2K4ofQEsy8KdlUNWQREefxY+rwczHmbzmiVs2bgG0zR+9jGaCi2qq2uIx+N0rehKQUHhf3VyqCj29XW5XNx99z3cfvudNDe3kUjo6fh/Z9hmg14Iy74BLAuXO8D9993L7bffnaYd/Kqb6dfEp6kPc8opJ/P444/jcHjSHkMgg6ygKioOhxMlFcRLMgndpLq2nu59B3HjrXfSuVOn5A3y72Pq7Tw8uxypazoP/eMhDjv0ML755hvaFRQSj8WJRmPomk4iYSS/TKJxE0n1sHT5alauWMleew0nO5DL0UcdxbXX38wVV17F1C8+5dxzz0bXdbz+ANl5ReQVluByOjGiQWor17B981pi0chuF/SXWDweQ9cMsnPz6d27124x9n9PiGE7MNM0qOhWwcWXX0v7Lt2orW/EsD8wlmmiqvaQgyRLCCHZFQ5NQ0LgcPi5++47uPKqq9M3xq9+OvyaH055BlmWueCCC7jp7zeRn5drPxrNneGEI0nqsUwLwzARAtxuD/PmLuSrGYu44tpbOOCA0ena6r/b26QeYaqqsnbtGiZOGMcNN16Py+lAllVaQ1HiukksoaMlVfY3bdpMQ0Mzw/feh2/mL2DvESPxBvL47OMPOfWEv9DS3MjFF13ACSecTEKzsCyJ1vo6qjevo3b7JuKxSBqEv7ZKoSgKhm4gyzKdk7xg/os8tCzLKJKCaRgcOuYwLr70OqbNWMiiRctsIlcKO7KM2+2yE+ykg9Q023NnBwJcfvllXHvtDckSqvUvPYl+FaCzs7PTYFAUhdtuvY2TTjoJl9uJz+uz+dGKhNPptGWyJLsagGTH14HsXBrqW5j07qccOeEkzjv/gt285r/bbD63zUt+5umnOP6442hsbCArJ5fm1jZMIUhoGuvXr7U5Hfvuz9VXX8NZZ57Dvffew+uvvIA/y0VrWxMIC8PQeebpx3nj1ec5YL+9KMjz43Y5002CXxtqpXBfUFCAadqhU3ZOTrqx899UXzYtk4svuYTDjzyBt979nFBEw+ly23zmZClSlmU8Xg9ut10Gjcdi+HweHKrCcccdx4MP/iP9epZlkZub+/t46NRFuO6669hnn33Sd46qqkx64zXGHXkYdXXVFBW1wxQWLq+LQCBgVzVMEzlZTLGwyM7Jxu/L4pU3PuCAQ4/inbffJT8/P514/ru9derwVFVl6bKlTJwwjmVLFlNaUkp1VRVLliymfVlHSkvbc97ZZzH1q2m88967HHboIcTiQRRZQXU4kVWbv9HS2syECUczefL7rFq9nNVrVzFz5nTuuON2Onbo8Ku4zqnafZdOnYnFE/w3pYKp62+aJsUlJXz44YccNf44Jr31Pl6/D1+WG8PQAIEk2eGe6nCQlZVFli8LyzLJy8umtnob444+gvffn5y+/pZlMXLkSG6++eaf1D75lwGdAllRURGvv/46+fn56bKRoigsXrSII8cczJzpX9OlUxdQZLICWaipkX7syQOXw4nL5cTr89CuXSFV1XUcPvZI5syZw9ixY9NyAP+J+NAw7PCntbWV008+kddeep5tW7fQubw7kVico48cS319Pa+9/jqSJNEabLT5zC5XuvUtSRKyItPY1IimR/B5XXTs0J599tmX6667ngWL5jN6//1+VLH0u2duE6sK6NajJ8FQGBBEY9H/jipG8szGjBnDnNmzOeSQw6iqqiY3Pwefx4nH5cShyOm8yzBNHE4nWX4/breL8q6dmTlzOkeOPYKlS5emnaZhGJSVlfH222+Tn5//q/OFX4WcrVu3UlZWxieffEJpaWn6ka0oCk2NDZx5+klMfvNFunboQE4gF2SZRCKBkOxHrs/rweNx4nI6cLudeH1eamrryStox+T33+eBBx7A7XanPea/21JPCRC89+6bHHnkWFpag5x/5hkoqpt7H36UUDhMOBwmGo0jIdtxN/LODmKSbSdJEpYpMDQNPREmFg/i83l59bVX6fSz83FSuhV/9LgJ+LKyiMUTCCFobmr6l+Lw37JRYlkWTqeLe++9lw8+/JCcnFzq6hvw+Xz4fW68Pi8+rxe3y2UPOUgShmGiKiq5uXn06l7O5Dde45ILzqWlpSWdRxmGQZ/evfnqq68oLi6mvr7+900Ka+tqsSyLvfYawpw5s9hnn33QdT0dA8uyxHNPPc6zj9xHWXEOZZ060haOJOmk4PW58XjduD1u3B4XMhZOp0o4EiMStQdwp82YxpChQ/5tNesfCkEAXG4327Zt5aZrryKnqCOjD5vItm3bsSwTSVYIhxJoho7T6UCRFRvIQrIppsKyuQmSZA/UyjIup5NQMIg/K8Cll11q37QONT0dk/pdFUXB4XCg6zrdunfn9LPOpaqmDkWRMQ2TbVu3/kcAnfqchmEwaNCeTJs2jSuvvJJoJEIsruFwOlFlmdxANv4sH/6AD4/Pg8Cus8fiCbp07kh+QOWhe2/hxeeeRJaldMxsGAaHHzaGadOm0a2iHMuyaG5p/n0AnTq8qh07kGWZSDhIx04dmDLlS6699lo7KTBNZMmmbC5cMIe7br6GcEMtxUVFyIqCrmn4fD58Hg8etwOf15Puz8uyhKrYNevevXszZcpUrrvhekjGU/9Ob50KB9asXsPZfz2dG264jmNPOIWq2iq2ba8CZEzDIhaLE43EUB0KiirvQq21JXkty9yZuEkgsNvyNdU1HHPMMfTu2wctoaW52Sk2oz0YoNGvf3+eeOo52oJx4gkNSZZpbGxk/fr1/3ZAp7yyEIJrrrmWKVO/om+//sTicWRZQVHk9LllZWXh83jI8vsI+P3oug320pJitm1eza03XMG3ixehKCqSJKdzittuu40PP/6QvLxsotEQsiyzedOm3xfQq9esIR6P4PZ4iMdiGIbGnXfeyeeff055eXmysyZQVQeNjQ3cf9fN3H/nrWixKDm5ubhdLnxZbrxeD36/F0VVkkAQmKaB2+1GliRCkRC33nIrU6dOpVfvXv92b53ymIFAgDPPOJURg/vgUCTq6psJhSMIBIZuEmyzSf8Oh4IkJ1vlskBgU1cty8IyTUSyySOSN0wiofHcc88xZswYenTvTllZGcXFxZSXl7Pvfvtx3Q038egTzxOKmjQ2N6MZ9rDAmlXL7W7mv4mgtKtX7tG9B59+9hm33nYbCS2BLIHH7cKyDAQCYdmcmOzsADmBALmBLDwet51vaRq3//0m/nHf3bS2tqGqrnTjq2+//nz11VfccMMNxKIRDF3D7XZjmgarV6/91Z1R9Zd6LUmS2Lx5M2vWrGWPPQahyCaapqFrcQ455BBefu01Hnn4Ed5+cxKGodvcYwGT332HeXPncNU117PPvvtRmN8OQ7fwe1RUxQa0QCR51RY+r4dILEZrWxsjRoxg5qxZ3HnHHTz00ENpb50q9f2esbQsyyxfvpxZs2YydNgwvvhqNi1tIWrrG8nydUA3DZpbWikoyEZxqMgJO1yQk/Gg2+VCdXh3L3sGHGgJi3jCoLiojKeffZ5gMEQ4FiOR0GzmnqoSicXZvK0WzdBxuRwkwjECfh+fffLRv6Vkl+qqphzJJZdcwnXXX4cvK4tILIos2xsMhDAQmEnag0B1KOTkBghHYhS729GpvDOffPwR99x5J7W1NcnET8IwEjgdDk776zn89ZxzGDqwL4aRACxkxYmiuqisrGTdurX82hUdP8u22/WxY5omPXv2Ytiw4Ri6liTAqwhg7Yat9NtjKEOGDmX71i3U1dWlp5yDbW188fmnbN9ayfC9hpGX3w7N0MnOzqJ9STGSBC6naicRSMTiCWbOmElBYSGBQBZjxozhwAMOZOXKlezYsSNdXfk9QZ0Kh2pqajn1lFNpbW1l5Zp1eLx+Oncuw+/34/Z6KSjIxeX0YZqCcChMc3MrtTV1VFVVU12zncrKTWzbWsn2HVvZuHEz27btIBgK0draQnNzC7oFiuJEcbjRTUFbOEZdYxsNzSGiiTixaByPy4lsadxx260/qR3yW9aVLcuiX7/+vPnmm5x99tkIRSYei7Ls26Xk5ubh9/uRZUhoGrpuYVoWzS0taLpBUUkReizCY/98kKefeIJwOIzT4UhWsSz69R/AVdffzNBh+6HrcTqVFSPLUro5p6ou3nvvXd57bzKK4kg6u1/csET8sgusYFkme+01jLlz52BZBol4HFlR8Hh8zJi9gJXrt5KTHcDQE0yb8hkfvf8Wzc3NKIotgaUbBjm5ORx/4mkccMjhFOTnUlyQj9OhEAj4yc3JRggDFAcTx09k+7atvPDiC/To2RME6JrGo48+wh133EEoSYS3rN/PW6cINLNmz2Hk3ntz+/1PEYtrVJSX0NZUy8b1G9ixYys7duyguqqGtmAbiXg8HU+mHtmp4VmbgyNjWaYt2Ohw4nLZ7Lui4hJK23egQ4fOuPy5CNWN25dFVNMYPXwPJr3wBJNef/V3W5mcCulM08TtdnPNNddw6aWX2JohksyWLZWcfvoZdO/ekyeefAxZEqiKQigcIhROkNANQuEIW7Zu5aPJ7/H6a68Si0Vth5ckeuXm5rL/QWMYdeAYnJ4sIsFW9uhXwQH7DEdPxNGNBE6nC1V1sd/++zNjxoxf/fv+4mzLsuzH8IIF85k9ezajRo0iISXS9Wif143AIhgO09YaIq+knPMuvpoFc75mypQvMAGn00lrSytPPPoQ06dN5dLLrqDXkUciCdB0LamSY1t5eVfen/weI0fYBfazzjoLl8vJ1VdfwxFjj+CqK6/m008/TT89fg86pSzLYElcecWV/O3iC/nyw0ksW7GMaDiMosjk5ubRsVMHevboweFjDqNz584UFhaSn59LVlYAr9eT5lEnEgkSCQ1dN+3NV81NtLS0UlVTzY4dO9hSuZX1a1cxY9oUYtEoiuogkJtPp669cCUamfzee2nv+XskfUayxb///vtz7733MnjwYGKxKELAiy++wHXXXUtTUzP7jNoPWZaAVAJrEAgESOg6H334AQ/cfz/bt21FkuzrrWkaACNHjabvoCEEIwa1DW0U5MsILPw+OywzTLsHoTpczJk9m1mzZqVvsF9JKUH8mseRaZqMHj2ar776ing8RiIRIzs7jw2bKvl02lwU1YWhw8IFi2huaWavIX0Z0LMTt996K99++y0ADocTXbd/0YMOPphrrr2efffdB0WS0LUYksPFPXffy003XG9LAlgWo0aN4r777mPo0CGATVN97dXXufa669ixY0fSw0jfH+X5f4Qbu1pWIJuuFRX07T+Qvv0GUNG1G6UlBfTp0ZVA9q4tWgEY2FpgO7VMYrE4sWgCS4BuWJimgWGBboJlmmi6TlswREN9I1XVVaxdu5YNa9eydcsmtm2rJBaNfy8s+P8+mVJPENM0ycvL4/bb7+Dss89KikzChg0bueqqq/nwww8B+3zvuuseLr38b5hGArfLD1h8/fVMbr/jNqZ9/fX3rm+PHj247sYbWb2+mm++XYrf72fvvUfgUFUsU2PC4ftT0aUToXALqizj8WZz6CEH88WXU/6lp9EvjqFT1Q5FUdi8eTMVFV0ZNGhPwuEIHo8LWVVZt2EbhiEQkkRLSzOhUJjqqmrOPONUTjvtJIqLi1mxYiVtba3JX9zBhg0beO3VV6muqqJPnz4UFLRDliQ2bFzPB+9/kK7NVlZW8sorr2AYJnsO2hOX20P/AQM47rhjicXiLFq0CMsSuzD4/vWLnQJK9x49GDZyXwbvPYqBw/ajzx7D6NC1Jx5fANXhwNR1/B6FnGxXcv5NSfoIJfnwc4BkfzkcbhxOFYfTiaw6kGQZgYSmG8TjMdqCIZqaWwmGdQxLRnJ48eeVUlbRj74Dh9C7bz/y8vIIBVu/t6zo/9O2FkJwzDHHMGnSJA455GBkWWAYJk8++RQnn3wyS5cuS3LLbW953HHHMnjPIaiqk3Xr1nLFFVdy+eWXUVlZaW8Is8C0DPJyc7n8iit48MH76di5ghdffRMkiYL8fEpKirEEeJ0Ohg/ph9vtIhwKE8jO4403XuXee+//l0Mr6dde+V1LWrNmzaJv3760BVvw+wO8/cFUaupbkVSFDRs2snnLFrRoiCsuPpvePbvg83iprNzKvfc/wBeffpJe1J6qLOTk5PC3Sy7h4osvoqq6mj0GDEzKItjTD6lfsH//ftx1192MGXNY8uPLzJ49g2uuvY45s+fu9jTZtY38s3e3LKM6HAwbPoKKnr2JG7Btex3NbWFyCoooaVdA9x4VdC4rpUNpO/w+J3kBLw4F6mrrqK2tpba2llAoSDyeQCBhWTYnQ2BhmXZbX1FVFMUeqvV6fAQCWXj9ARwuL5LiwLAkquoaWbthC9t2VBOPx/B6PRQX5tOxKJvm2m289+7bVFdVkVIY+iXUhZRDSp1Lr149ueOOOxg37qgkFGTmL5jHtddcx7Rp03/wHBctWkhxcTEPPvgPnnzySSKRSHqgQdd1PF4Phxx2GBddeBE9uncjHo+zqbKa+x95GklRKS8vp6JbBYmEQWlBgJOPPZxYLIrfn8XatWsYMWIkra1t/7IOifSvuLLUI7lDhw689dbbDBu2FwBfTpvL8rWVqA4n1XV1rFy9hlBLI2ecMIED9tubcChMfUMTL70xmU6l7Vi+ZD6TJ78H7B5vdejYgdNOP51nn36GmpqaNCDtcpKMYdgHfOLJJ3PzTTdRUVFhs7fiUZ577nnuuOMOampqdwPzrjfOT/1OZ517Ps6sQr6eNptgWxtZWVkUl5bStaKc/IAbTI3mxgZqa6qoqtrBhvXrCYdCFLYrpHOnzvTo0Z3yrl0oLi6muF0hWUmRQTPZPWxrC9PU1EI4EqaxsYn6ujrq6utpbW0hGo1gmgK/309RSXsKi9vjD+ShCYm2cIyWliBlHdpz/PjDyPaoHHrgaJqaGn/0hk0lpjtVo2xNDL/fz9/+djFXXHEpOTk2X6KhsYG777qXRx75pz1HqTjsGnPy3IUQZGfncNJJJ/Dmm2/R2NiIBDh2uW77jz6AAw4ZSyiicciBI8kOuMjJyWfOvG955qVJ+LOy6Nu3LyXFJUQiUQb26cIRB+8HwNKlS5g4cSKbNm3+xQOxvxmgdwWA1+vl73//O5dffjl1jS28+OZHON1e4vEY3y5eQlNzMyOHDuSsUyYSjSVoam7lptvvxev2s+ce/ejSsYgXn3+GmTNnfg/YP3WhUvXxnJxcrrzySi688HwCgWy7o1m1nbvuupunn34G0zTx+XxpSbMfJQIB5V3KOeXMC3j3w8/JyvJRlJeFLENN1Q5qqrZTX1tFJLI7OWjs2LHcdded9OnT9ydOSwdhYQHxeJxoRMMSYJgQ1zQSCY1QNEpTUzNVVTWsWbuWpYsXsm7VckLBNtoVF9GxcwXtO3Wjc0UPBvXvTf9e3bj17zfwyisv/WDz4bsDt16fl3AozNixR3D3XXfTu08fwJ6seeed97juuuvZlOzM/ZLHvcvlIpHUmxs2bBgnnnwahnCxZl0ljc31XHLe6QQCHnJy8njpjXf58uvZFBS0Y8iQwTidbqKxMGefMp7i/FyeeOIJrrvuOtra2v5fYP7VMfR340xZltE0jalTp/L5Z5/RrXs38gqKaA3bIi2tLa1EIxESWoK9Bg9ElgSWgMXfLgdkNmzczAGj9+OmG6+jvLycyspKampq0sD+scdO6u8VRSEWi9qrID79lJKSYioqysnJyWXMmMPp1q0rqupg+vTp7LfffkQiEdauXZtWvPxua/fAgw7i2BOOx6EqjB41jJodW3jz1RfZvrWS1pbmtArprv82EolSXV3NkiXfsn7DWurrqgm2tSJJBi6Xgq7H0LQYsWiCaDxGKBQi2BYmEo0QDkdoC4WprauluqaOYCiMqjopKu1Ar34D6DdwMKtXLmfzxvVUbtrA8m/ns2nNckzDokOnzow/+kge+efD3yPCp8DcuXNnbrnlFl5++WUG7zkEn8/DpElvUtguD4AlS5Zy3nkXcMcdd9DS0pImRP0YoOTk9Huqy9evXz/uvPNO7rnnbgxTZeq0uQhJwulSGD50DxQFBAoffT6FYDhGTk4OpaWlONxOunZpT82WDZx+2qk8/fQzJBKJ/zeYfzU56cc6iIqisGDhQo484nCefOheZC1Ex7JScnJzMS2LhsYWauobUGQFj8tFICsLIQT5hflU1dbQ1NLMscf+hTlz5vDMM8/Qr39/NE1LE+J/rOVtmmb6/ZcvX864ceMZN34iCxcuSKeFJ5xwAt98M48vvviCu++5m0cfe+x7FNUUQIuKiqitaWTL9ga+mLmQgSPHcNDhR33vd84KBOjVpw9jx45lzJhDKCsrpaiokOxANh6325YIQ0LY1Bx7OiMp4piOaSUFSZZxKAqyJBFsaWTdqmVM/fxjXnzqH9x905Xcfv2lbNm0brf371zRDU9uPk8//wJfzZhNx46ddouTU6HVqFH7Mm/ePIqLi3nooYcYPGQwxcUlICy2bdvOZZdexvDhI/jwww+R5Z1DvT/2REzd9IlEgopu3Xj44YeZNWsWxx57LKFQmB3VVXh8biwMsrJ8uF1OHA6FhsYm6uoaMEyT/Pw8OnUqw4g08vj9tzH+6KOZP39Bmm33W5Qk/9+sn9SsXmrFwpQvP2XWrGmMOXIce43Yj2i4A2vXbWbF6g10LivF4ZAoKW5HU0sIj9dHIm5gGoK6+gbal5Zw5plncviRR/P5px/x0EMPsXzZ8u+VmH7s/QE+/uhjvvziSy666CISCY1rrrmK8eMnsGDBApavWMHYI45IdzBToY0QNtg03WTF6nVEYxpOh4NF38xm3eoVBAI5FJV2oHPXbvTp158+fXrTt3cPOncoobiw8Kdu+dStB5aFsARupxtFDqFpFtGEgWEJ8vPyycnJo2fvAUSiMaLxOLW1tWzaVEnVjm1Ubd1MzY6tbN9aidPppqC4Pd369ENxiLS+3u4JoEQsFmfa9BmccPxxAEycOJ6CgkLOPOscPv/ic6p26bj+VF6ROnPLsujRowcXXHARR48bR4eyUkKhEHV19Xi8PuKJhF2ftgza5ZfiVB1IMqzfsIJwJEqvnj2p6FzKmy8+zicfTrbppKqKlfT2v1lN/bcs0BuGidPhIB6L8d6brzP1048YNnJfelb0JBqOgerESsRoX1rK6vWVeDyedEjidDjs2qypokiCI48ez9ixR/Lhhx/yzDNP8828b36yDrvrxirDMHjggQc45JBDaN++jEcfeZg3Jr3JIQcfwi233oYkq2kw291AO/F5+snHGbzX3gzYazTbtlURatlB+8496TmoBJcvQGFRMSVdOlNYVEZudl5SMakVXYtjmHbdORZLEI8nSMTj6HGNhKHZtWjFiZwkvJvJ/3e6XLgdDjwuF5aQcDoNe8BYddDgCqPLfuSsEjr0LqDHHiPI9si0NtTS1lCLEWvl+jtvSQvP7LpnHGDVypXU19dz/Q3XU1RYwMCBA9mxfQeXXXbpblSGHwJTilaQOtO+ffty7rnnMm7CRLxeH7FYGF3XME0D1aFiGDqxeDwtUdCuyF4f4XR5aQ4G6dKxhO0blvPm8/8kFArZG8GSuZKqqojfkJvz/wZ06g4/8sgjCQQCvPzyy3bS4HQRDIX48rOP8funM3jwMNoX5zB6//3pN6A/M+YuQkYioWnEYwl7Otq08CkKuTnZrN9Uicft5ozTT+cvfzmOzz79hKeeepqvvpq625BrKuxIPbJM08ThsPeYjNpnH4SAgQN7MWToP3j33bcZMWo/Hn7sKa666gqmT/1ilxtBxbQs9ESUvPw8appbyPN2RyDh8PjI9rvJ9snEW6pYWL2Br78I0djUTGm7HDp3LGX5suV8/PFnBENhm7SV5IkDlDoU9s3zoBs2RxpVwVQcKA4XssfNGsuJ4vNRWFBAQWE72hWXEAjkku9x4pb9RDWTtqhGfURi4KBhjNxrII01O5BkJT0dLYR9g3fr3pO77rqb/MI8br3lFr6eOhXQsfQYew4aSF5eHi0tLekadMoLp9r1qTMEGDhwIOeedx7jJ0wgPz+fjZu3UlNXR7/ePXA41KQUgy3unkjYy0ZVWWFA394UFBYwffoMPnznDRYvWEAsOWnjdLrQdA1N0zj88CMoLS3hmWee+c1a+r+Zh66pqWHy5MkMHDiQe+65h7q6unTXKBwOM336VKZPn8peew1j/DHHMqBXN0zZXs8QDEXIyvKjabqtmuNwEouEOeO00xk3bhxHH300EyZO5Ohx45n/zTc8+ugjvP/++8Tj8e9xg2VZxkzq0vUf0BdJMolEIvhlDy+99DJV1bWM3n9fJr31NjNnzubxRx9j7syv0TRb6/no8RPRPQGK8gvJyfIQj7RSva2SFUs2Ur1tC03BGKavI4qnAJffz9N3j+HEcQdz95330NDQgG7svChy8vF/TImPnopORLdDG0kyMCwNORZiRQhWNGk/eKYOh4PCwkI6dO5K54rudKnoRcDnw+32MPaIwxkxfBhffPklAD379OeUM87kpBOPJ9LWwgMP3s+cWbN4881JjDnsIAxDo11xMT169GTevLnpdveucWsKUKNHj+acc85hzOFH4Pd52bqjiq/eepvHH3+M884/nz0H9McwNDsUEYJQOIoloF1RPmVlBWxYu4pbbriWzz7/LN0pTQ0taFoCn8/LBRdcwO2338mxxx67Ww7wW9hvspNZVVWxfPlyIYQQ27ZtE9dee60oKipK/4yiKEJRlPT/d+zYWZxw8uningcfF98sWCqam4Oitq5BxBNxYZqmqNy6VeTl5Sd/tqO46KKLxYyZc4Smm0IIIVauWimuuuoq0b59e9GjRw9x7LHHivbt26df3+12izWrVwoj0SYS8VaxYcP69N5uQPTq3VvceMvt4vV3PxZ/v/thMfqwCcLjDYgbbrxZfPTVXHHqmWeLIcNHCq/Pl97pDQgCFcI14BRRPO4m0eNvj4t3Vm0UpqWJ66+/QnTs1EF07NhROBwOISf3VB/dtUDUn9pLbJrQQWw4pqNYM76DWDG2RCw6pJ1YcFiZGF6YLSRJFqqips/IoahCUd0CEIGcgt12iPfp01/cdMttIhKNiEPHjBEVvfYQF155o3jipTfFfQ8/Jg446ODdrs1fjj9OtAVbxY6qSiGEKc4///yde7FlWey7777igAMOEIFAQEycOFFMmTJVmPYRixWr14rbbr9TDBq0Z/rffDl1ijAMQ0SjYVFXVytag0Gxcs0G8eCjT4mTTz9TdOvWfbfX3/Wa+/1+ceaZZ4o1a1aLeDwmNm+uFIFA9m+93/z//yKqqgpA3HTTTaK1rU20BVuFbhhi6YpV4sabbhG9e/fZ5ecl4XQ6dwPeyJGjxD8feVSsXbdOpKyhqUn069d/twPxen3i6KPHiZdefllU19YJIYSY+vVX4qOPPxZfTf1KvPXWW+L6668XsiyLbt17iJaWRtHaXCuElRBPPPG4AITD4RDKLgB1u91i4JBh4ujjzhJ9Bu0j7rz7fnHyySeLzuW9xLADjxUeb7bo0qVcqA6ncDhcQi7ZTzgPvFt0eWa+GPzZevFKU1TEzIS48/YbRI+e3UXvPn1EfkE7IYFwKqqY/Zc+QlxQIdrO6SpC51SI0FldRMsZXUTkzAqx4NieIsvpEJIkCQl5tzN15HQQOPNERc++Ije/UJSWtReSpIghow4VqjtLXHvddeKE084V+485VowYfajIzs3b7YwdyWtSUFAoli1fKbZt3yI0PSYeffQRoSiKGDRosJg8+QPxyiuviLXr1ol777tPCCFEOBITn372hfjrmWeLdkXFO52WLAmf3y+WLV+WvkaVlZvFs889Jw486BDh8/t3fnaHYzcnUFpWJv569jli9ty5QgghdEMTO6q2iyeefCrt7H4jMIvfJORIPaqeefZZzjjrTLxuJwndwOXy8JcTTiJQ0J7KTWtZuXQxixcvJBIOpztXiUSC2bNnMnv2TIpLihk/bjwnnHgCQ4buRd9+/VixYjkOhwPLsohGI7z//mTef38y3bp1Z+IxEykozKd/334ccOABFOTnc98DD2BZFu1L25OdHaC2thpXXOPLKVOSyZPN3U3FjvF4nKULv2Hpwm9QVZXnQ/VUVHTjokuvYMnarSyb+yk+vx+HDNl5Haj190IqLsOVF8BUBJYexYoJZDm5y8Wy8LkUmpCY2DOf4e0ErRELIcuYSQ07Q7fwuGSeWt5MSNNxyDJ6Wm5YQnF4ILcnGNtw+nJxBdtQVXuRzqj9D6RTh1Jmz5nLkm+XEA617d5wkiQs05Yyk2WZxsYGFixYyGGHHkQkHKG8vNyWHiguYeXKldx44/U88cTj5Oblcu99D/DRhx8w75u5mMZO/RVZktANg/IuXejSpZxvvvmGV155hY8++ojt27enP3eKYqzrOqqqssegwXTr3Z9OXbtx4H77UdCugHA4SCQSRkgSzz777G8+TvabADrV5KipruaF55/nmmuuQktoYBmEQnHqGltoDFoM2edg7r3/Pj7/9GM+eP8D1qxZk46DZVmhtqaWxx9/nMcff5yhe+2FqqjpEaBd9ZyFEGzYsJ677ryTkpJS1q9byScfv4/D6WHVqrXc/8BDOFSVeDyGBNTVNbDk26XJEp+1W1Vk5/o0gWkYbNywjo0b1nP0MX/B6bAB4nF5cLrc5HQcQG24CCUvG8XlwOVVCG/ZhN4lF1mVQRJISCRQCDidXDwwF0NPIMkqEgZCkjCFhF+VWBl28PbmFhRZxRTJuFuSQVg42/fGyC2BtlZcheX4Q03Ikp34DRsykFy3xQ2vPY8sySiSnBae/6FuoSRJLF60iMMOPZBoNEp+fj5PP/0M2Tk5ZGcHePfddxgz5nBuvPF67r//we9VkkzTxErGt5FIhIMPPmi3itNO6q6tv9GzZy8OOvhATvjL8Uz7ZgXzl66iucVuLumahsPhxO3x8P6bb7N40UI7Gf8NN+f+ZklhKkv+xwMPcvRRR9G/Xz88niBt4Sgd2peypbKaxUtXMvbQ0Vx55dWMPngMr7z6JpG2ZlatXMLyZUt3e70F8+d/j8qZqjmnDtJuwToRCMYkGyAPPfww4XCUU089GRDIssL2qu3U1FT/6M2400MkwS0sFMke3FUkxdYu9nvJKu0DlX7cedmobhW3plM5fzpK14kIZJsDLAkMHU4bUMTQAgetERMVy26rCMCS8LidvLSolaBm4HaoxA1hyzeYBg5fLr4BB9JcG4W8zvhKOkHzBrSwzVDMCXhxJWvPiqrYutLix/kLQgjWrV9HQhdgxe1qxcaNfPbZpzz88MMcMn4CAB6PN63WqmnabhWHlDPZvHkzmzdv3q2tbhgG3bt3Z8Aegylp34mjjjqSwYP60tbSxpJn30LTDQrzswn4fXg9XiTJ3qx23733/S7bvX6zqdPUBwsGg5x15lmEw2GK2hUSjUZpV5iP1+uypz/mLqC1LYxAoikYR/YWcMmV1zNt+kxuvPEmhg8fnpaKSncjk52qVEdp185S6u81LYiWCFNbU83MGdOp3LwJh8Mm11dXV5NIJH7BASYnS4DuFV3oUdEFXddwqgqFRSU4AiXg8qL43LiyszE2Lye+aRmq04ewLGRJQhNQ7Jb520A/uqGjyNJO0owFbgXWhmTeWN+MJMt2TVqA15OFw6HQce+D8ffcE8Plg9wiFE8W/ixfmnIjpUlGO29E8TPXpKmpidgukzRPPPEkK1asoKamJglcgcPhTIN419XNqfPdfTuVoEePHpx3/nl8/PFHPPH0S5R2HUBbzEISFqFQkCUr1tAWDOJ0KpS1L0aWJLIDfpxON1ddeTWbNm5MOivzvxPQKfClxNEnTpyIaZp07NABWbIoKipAlhWWrVxNMBymqF0B7UvbsXXrdpYtX0+HsnLOPe8Cvpwylfnz5/PUU08xccIEiouKEEndhlTtNLUDMP1ITNaeUxPVsizj8XjsUAVoa2v71aWhgN/HXkMG4HCoqEBOfhEJNRucHnA6cTsgOOMjZE1DlySEJVBkiVjC4ITuLspznCRMYW/HSmpTmAh8DhfPro7QmNBQJJFsyNjdRH92EUWjj8RSfChZWaC6kBwufB5XunGuqiqy8usuWzQSQdMSSZVYaFdYiCzLRKORXQZXjfRkTaozaO1y7h6Ph+HDhnHDDTfwxZdfsmjRQu64/U72GjaC9ZVbWLtmHT6Pm4LCXISQmP/tUizLJMvrpV1BPrm5AfLz8rj88st5441Jv9so2W8ueJHSkZ4yZSr77LMPDz30T7p2Kae5LcqyFSvZXlXLkqUrGDVqbyrKO7Ny1QZaQ21srdqB2+WkU4cOdOvZk/yiYs46+2yamppZvnw5c2bPYu7cOaxYuZJxR4+jqKiIF198kerqajRNxy/5sdDSFyKR0LCEiW5YxLVfH6MZpoFDcaA6HIh4HE9RRxqFB1QD1e/F2rqJ0NyZOMaMBMteZaebgjK34KReAZvIpAiEKbAkA2HJeBTB+qjMpLWNtpc1bY4HkgS6RsGgQXgrBmIt3ojqzcJsDaEoTnt7QHJwQVGVZH371zgaIyn2aE/i64aWDON2et3aulpUReXGv98AyLzxxiTcLhf7778/I0aMYMDAAZSVdaSpLYjb5cDhcLBx42YcHi91dQ0IyaJ9STvycnLZVlXDitUbkGSVbhXl9O7dg0S4hWOOOYZ33nnndwPz7wLoXUG9ZMkS9ttvXyYecywHjRnLgAH9WLJ8OV98PZOB/fvTs6Icv99DY3Mr1XUN9OjamWAoSGlJAS0tLXz99XQ6depMzz79GL2/zZt97fU32LxpI5988gknnXwyjz7yCK3BIHn5BUnVU3dy5CmGZUoYhkCSfr2yqb3KTQVJRZIlHIFCgroLXFGcPi8tX76CFGrEdLkwhYyEIBbTmTjAT8cciLQayb2GdjyuIfC4vbz4bQvVsTiqLGHsEisYqkzxYRMRDg9ut9NOxBwOuym0C5vOJhL9ut9HlhX7DISEYehpEXFvcp5PCEF9YxN7j9gHyxLMmDGdM888mwnHTqRzWXsaWlrZuGETU76eSUX3bozaeyjhYAhTSMRCIapr6nA4HHSr6ISkqMz8ZhGGJRjQuyflZYU89vCDvPLSCwSDwd8VzL8boFOgTiV0b781iffefYv+AwfRu/dAZGFSU1/LHgP60bt3d2bPXczGzdvo2qkjbcEgiYROt/Jyzj/vXObPm0dpSSkl7dtT3rUrLS0tXHnZpRx88MGsX7+eI448kpqaOsq7VKAqLgqSZKGGhkZM09ZUczpdv7g8lI5LhUCSZGRJBlVFzSoiUqOAz48UbKRp6nsEfFlIuoQkmcQNQXunxnF9AxhGzBZ8N5LiMih4FZONQcHTa5qQJJIbZy2QFYRlUtB/L7IG7EUsmkBWHbbyqFMlumM9uhlJ0pykZIjw6xIpp8ttR5eSREtLKy0t9prh0tJSu3oRbaW8vCsVXbtz5JGHM3bsWF555WUuv/QS6usa2L59G3W1NVgCpk2fgcvhZGtzK7plUrl1O9uqaynv3IFhw4cS0zSqtlWR61VYOPsznvzHAsLJMu3vDebfFdC70ktT07tLFi9iyeJF5BcUsmndCo4+eiy9KjrS1hK0p35lFYRONBYlJzvAkMF7Mmv6dLZsqWTLlkrmzZkNwCUXXch+++3HjBlf89ILLzBs6BBG7D0SkCjv0hWYwo4dVSQ0Hc208GX5kRUF6xccZipxFMJKDota6KaFcOcQi8WRS/OIfPMl2rYN5HbphCEMhCwTj8Y4pruXkmwn0caoHRZIqXMwcXlcPLaojeZYAkWWMC0rKeoIMhLdx52M5XChKDEUSQJZQZYN2rZ8S7siP0qSTSjJSjJt/WXjcgC5eXl2tiRJVNfUEY/HycoK0LVrOQAtLS089MD99O3bj/vuuROAU04+hdWrV+/2er1796WstATDNInGY7hdTmoaWulQVsoe/boxfdrXvPv2O8ybPYv6+rofLAH+3va7i8btWmpL7V5pamxg5rSpzJw2Fb/PR6cuXelS0Q3FCNGte0/yc7PIzcnmhBNP5KknniQWiyFLEmqS8vnZ559xwIEHMnzv4QDMnDmLc845B4AePboDUFm5mWAwiGmYZGUFyPIHaGtr+dlKh9hFGjelUYfDDf52JCxwoRP8ehIuy07TZFlCNwXtXSbjegcQCT290F4StuqqV5VY1azwwqp6e8uuRRqclmlQ1H9PAkNH2QR/xZ43lBwuHLFWIrWbsIoGoqhOuwwpkZQR+OVWUlqKQEZRVCorK21edZdOZGcHAFi2dCWWZTF8+FCEECxbtoQNGzemCf8pFt+RRx1lL1hqbaa6upoNGzYxe+YsdmzdzPuvPUlDfcP3auC7Xv9/h/1bNWvtnSv2xXa73cTiccKRCKtWLmfVyuV8/P67OBwuStuX0qVzJ8o6dMDr9RCLxWxxgGQmPuWLKRh3aQzaYxDtigr5+uuvqKurw+/Ppk+f/nbteft2aqqryc4rJCuQS0n7sl8E6O99ZtNC9gWwXDkI1UJpXEN06zJcAa9dr5Zl4okEB3bPomSrHyOhJ+fa7CYLwsLh8PKPZY0Ev9MVFNjxdfGE44ijoloCIQksVeBQnZhNG0lEwhhC2bmBIllR+TVWXl5hr6lTVFavXo0kSfTt2w+wJ45mz7IHi/feeziSJPHll19iGsZueh2yLDNv7hwOPGA0VdVV1NbWEQ4Fv/debo+bRFL69z8h+fvvVxYX9kXxZwW48urrGLb3SIpL2qe/resJtm6pZPr06bz6yis0NDSmH1cpdtjKVSuZN2cOPl+Agw85lLq6epavXEUwHKG0rBPlXSvQNI2ly5ahqg4cLjc9evf5VaW71E9ZwkRyuBE47bby1nkIYeJU3alNZDgV6FLow8JCyCnyg8BC4HHKLGkSvLW23t5pnQSzJMsIy6Jo0FA8e44iHmxBSDKmZSEUJygWVsNaYgmdtpZme/IFCfErbsjUYqZevW2l00RCY/HihQghGDJ0GK1tMWpq6vniyy9xOp3su+/+CGHy1ltvYVlWemoodf4zZkxnxozpbNywYTcw5+cXMGDgIM4453w6du6czj/+E6b+J95UkiQaGupZsHAhf7vmJnJ8bqp37ODradMIB1vQtSgN9Q0kEgni8Ti6btgxqRBk5+RQU1PDCy+9wr77j+aoI4/m1Zdf4dNPP6d7z74ISWKvvYazccM6pk+fzqGHj8UyDfr1G8AH70z6eTCInZ4wNUIcMwWqUCGyHWvbNzuTR0lgYdm6JJIdDljJfyRJEqYwkF1+7l1WS8gwccoK+nemjDoedwYoHhTTvhmwLBSXBzm4HalhG7oQVFdV0blzx+TrgvQLQo5UQl7etStlHTuDEFRt28KqlSvx+f307N2PUDhK9Y5tLFu+jP33G02njp2YPmMGmzdVMmTIEIJtbRiGQULTABmf34fH7aagIJ+8giIsZIYMHcrAAXsQs2Q+//AdNq7b8JvMBv5PATrVsZrx9RR8Pj+33n47vpwi6lsSNNZXc/P1l+DxuJk5ZwFlpSW0L2lHU1MLefn5uD0u5i9axMRxE1i1eh1Dh+5NUXEpb785iZNOOR1TSOw3+kBef/UlZs2cQWtLE5Yl6Nt/INk5ubS1tqTH+X/kbktvaFJku6JgOd3Iqgp1qzBbttiAliwkIfA4VHwep13nlRTAREZgCIHX6WR2lca7axuSXcRkLqGoWKZB8cC9KBgxmtrqBoQvgLDsjWE4ZMTWZeiWkayJaxi6bs8h/sISZOpJNHz4CCTZgdfr5fNP30PXdQ48+BBy8grRDcH0GTMQlsURY4/EFPDkU09x3kUXc9utt9AWChMMhpAxCccNlq9cx9BBvenSoQMvvP4RK1dtYPTBY/H4HLz83LM88/gj/5ad7v9dIceuoFYUPv1oMldeciEbVy9hYP8+bN5Wx7vvf4EiyWgJi2UrN+BwuaiqqeHa62/grLPP4ZFHHiHY1sKzzz5LcVkxp5xxFtXVVSz8Zh6mJajo2Zc9hwyjoaGeuXNnk+XzUdCuiL2G75P0XtLPhhrCEklPI6G4fJjCAdvnIpJEGlVREKbEkGIXimxXUOyo2UJKDsdaqpPb59WhW2Y6PAEJSQhkJHr99XwMpzP5eZIeX5ZxmhH0TfN31jJMgaZrdkKJvdvvl5yvqqqM2Hd0MqY1eS+pgXLwoWOJJeJoWpy333qTktIyjhg3kcXLVzNlyhQ+//wzxk08lnPOOZfPp36N4vSwcdM2mpvbyM/NZfnaDcxesJiBg/sjrAj33noT9995M1byBvxPrcv4jwLaTrjsZGPatGmc+9dTeOyhuwl4JeYvWkg0nuCQA/bGAFav38qwIXuyeuUyXnjmaSa9/DKRUIhXX32JJ598Bo/Hi8vl4tVXX0RRZTRDMG68PQkx6fXX8XlcmLrOYUccaSeFP/k43MmPMJM8g4TiRmutgrZv04hPmFCRZbF/Ry9CjyIJC0kYIJLe2aXw2bYEU7Y1o0hyGoSSYk/UFI/ch6y99kcLhZBVsCR7sZLk9iDXrEZv2p4e/NWFTicn+GUZw7J+tgytJGcX9xw8lE5duuHxuFm2fBFrVq2md5+BdKnoiZ4wWLx4PhvWr2XEiH2YNWsW1199Fc1NTXy7cCEfvvs2H7z7Lr179yUU1dm2o5YRw/Yk4PezcMkqLD3GvGmfMG7Mwbz8wnOkjvQ/Ceb/WMjxfU9tZ9sff/gekiRRVFJKsHEHJ51wAh6HwoqVa8jOcnPb7bezdPESgsFWDNOksKCQPj26snL1GvIL2jF3zhzWrFhGYVl3eg0YSvcevflm3jxWLF1Ep2596NarH3377cGK5d/+RJxne0vLsmwBckkGtx+9aQMQQsgqkmmh6wZjuueQ45YxTQs5KXCIUJAFaHh48JvNydb2LisrhEBVVDqeeBbhRAJHkrRkSDaxx6nKNM7/Opk7y/ZnMQz6F3uYs9J2AuJn4tPUe409+lgM3aKonZ+bn38egAnHnYBmgt+p8MpLLwCQlxegINvLyL2H8tWUz9Lrnf926aV06tiROfMW4lQVmhvruPOut3nl1TfYWrkxPSeYapj8h7H83wHoVGnM7oLZDZja6ipee+UVXnvlFdwuNw6XC0mRcKoOQuEQZpKHoCgyo0fvzwGjR6OoLq6+4jIeefhBHnzsWRpicMIpZ3Lz9Zfxjwfv5813P6ClLcixJ5zEiuXf/nwMKmNXFhQ3kuJDr03KKUg2yaiTX+bIilyMRBxZcSSXjIKOidfl4+11MWZsa0KWd+pNSIqMMC06jBmLu9cQtEgQh9tthyGWQLgdJBo3UzNriv0gsGz2n1sSdAy4MRA2+n9Cwz91o+4xaAgD9hhKlt/DymULmTljBv33GEyv/oNQZJnVyxYzb84cTv3rudx0y620Lyqkasf2dN3YNE2ee+Zpnn/uWQzTRJgWwWDrd54E/76Gyf9EyPHdR/2uooApxct4Ik4o2EawpZXGhoY0awwkVq5cyeDBQ3j3/cn06tuHa266mRXLlvLN7K9xuZx07zuI4SP2Y9433/Dhe29T0aU9A/cczPDhI3/RVldJGAjVhaSF0ao3pD24QDChh5/ibIO4aSeBKe+kIoigcNfsHbaXFVIydLYR73B76HL8mUTjcVSSoYgQWELg8Plo/fpzYq0NSLKKLckLxU6FfIeFniq+/FjpUdoJ6nPOvxhZVShql8cdt96GJKkcc/zpxDUI+F089vADHDLmKE469XQ2bljPTX+/iQsvvHC3J1dzcxNNjQ20tTQTDLYikWT7yTIg/e6rQf5nPfRPdRe/e/F251pIfLt4MRPHjaddUTFlHcrIzcnlgXvv5pGnXiMet5h4/OmsXLGEK6+6kgMPOohO7Us4+YyzWb58GbFYxF6i/gNJlmlhk/YVN2q0hbaQzX8wLJN8p4MT+xViJqK7NWoEAqfXw9vfNLKkptnWq07JJMj2Y7nr0ccilXfHamzE8niwhIUlC0yHAokYWz6fnKx/W0lvI9PNo+B1qVjImKZAN/UfiZ1VTMNg/DEnUFTWmX69y3nw3jtZu3YtR088ibzizvi8Hj7+4B3Wb9hITl4BF559GlU7tqf5Fj9UKUmFYUKI30VY/g/qoX8c3Lt+ffd7qdnA+rpavl20iPqGehrq6nj2sX+Qne1FdTu55IqrKSgs5NRTT6G8cxnDhg7mlNP/anvpH2Gu2aU3CUmR0Oo2E4uEUkE/o7vk0jPLQosZyQO042RFUYhqTv7xTVL5NOkyJclebZFVUETnk88iFongSJKMLCwsIVCy/DR+M4XmzettrWlhpTeEdfckxW4VOb0i7odCDdMwKO/ag6MnnsAe/XryzezpPPSPf3DcCScwaPBgkCwaa7fyzBOPARLzv5nHurVrCIfDP/i02nnu1n+dJ/6fBfQvSSp3nTe0R5NUpk75hC3rl/DuK09RX7ODCROOYf78+Zx5xmn079ODk087g333PzC9EnlXYKSqHEIIpHgTkaZqEomUZ1IY28UNegzJSg1Z23Gy4vUxaXUr39ZGdnt0p54CPU45HbOgCHQdWVHsf4fAkiVUS6PqjZfTHjFV5ctWFcpVi4SwkCU5vaV25yyktFMJ1ufn3Iv+xqiRQ6mvquSM00/D7w+w/4EH8cQ/7yXesp2nH3uQaDRik6J22QPz3xQH/+FCjv+PJ7dryDbL77033+DgQw5l3jfz+eLLz+wy3qQ3cblcPPf8C1x70y3U19ezZtXy5BSIlF4gqqgqpqmj6zEkrHSNtdTnYHBAENc0JNVu0FiAKkMkJvPcwnoUBUzDng6RkmNGheXdKTxqAq1trclFnTs7jUogQHTRPOpXLLWbPpYdbgigi1vB7xDJGQK7/a3ISZVQ037CWJY9Yf+3y6/lxOOPp2rbRo444gjCYVvp/+YbrmP0gQdTV72d5UsW/2bCiBkP/W/02gBz5s7llltuZuCAfrz26qvsvffeALz00suMO/ooenYv584HHqZH74FYpr0ks/8egzn4iPFYpsDapetlJRsqewUUchQNw5TSiaCwDFSXm0mLq1nToiUntO3QU06y9ipOP5uQN9e+MSS77gxgqApeyaDyxWdsZp+k2EmmZHvqLi7JrrhIdtvbskx8/gB9B+6F6nRjWgZef4DzL7uGCy66gOVLF3LoIYdQX19PUVExN970d+65+27WrFzBvXff9T054Ayg/0cs9UguKyvjrrvu4vjjjueOu+5mzJHjkSSFjz76mNEj96a1qYnLrruFdsUdOHrCBI49/XyaIwaGaYNSUWyFTM20veagbBm7fyLserBplw9b2hK8vqwZh8eT1rSQk4lgfq8++Pc/EK2tCVlVMO0d9xiYOAM5RBZOp+bbuUiKjGSZdiVFQK6q0FkVYAk7bEmGL4mEjq+wE6eddxllHTow5qi/sP8BB/PkYw9xxOGH0dzcTHm3Xtxx931ccOGFnHzyKfztbxfvEqaQAfT/opeWJInt27dz6623YlkWPXv15NLLr+Kiv11Cbm4umysrOf3EibzwxIPc8PebOPGMc6lvakFoEQwthiTLKLKEYQk03aCz20mFU0U3kjsHLQvLMJBUB5+taWZjEHyqEymVaAr7gHuffT4JpwvZspKNFhvQpqLgsky2vfxiWsPKwrKL4Mj0z1YpUO0byxQShgWmaWCaOtFgC85AIdfdej+SMLn0/DO4/eabsUyLESNH8ffb72TEqH1oV1jA2rVruPfe+3Z7ev1RTf0j/3IpUP/973/n008/ZdS+o2hrbmPp8uU7pVyFxfF/Gc+gwXuxbmMljVvXsmzBTGTpxt0aP6Yl6OWVcFsaJs5kFcIOA9Atpq1tQDhcWIaell6wLJMOe++Nf9/RNDeHUNIK+WAaBq7cHIKzP6dx+VIkRUEkEzMLC5essn+OEzUcQlZVYoaEYZqoSMQiYTYsn0u/fn1pbVfM8SefxPbNq9mELY5ZVbWDd19/mSXzZ1FdtYMvPv+Ctra2P3Ts/KcA9K6lvfnz5zM/KV6za932pVdeY8je+7Bq5Vo+mfwW7731WvLZpUCSCyyEiUeR6O1R0NGxJJBNgRASsiITjho0Rg0cMhhCQkbGwESRFLqdei4R00DBQmAPqgosTFnCEQ+z7tlnkg0YGTCRJQlLCHrluegXUFkVAocs06bpCNNKk6bisQgfTXoepyJRmDeaR558kRuvu5TPPv2MLZWb2VK5+XtlvT86mP/QIcd3PXVKNEVVVVuYG3jxxRc58KCDqa+p5ZUXnk6D2e322C3rJG8iIaCTW6WDU2BaAgUJS0jIQgPDJBgzbY6drQIDDhksi477j8Y7dDhaW9TumSdXUwjTQA34af3icxpX2HsAsVJlQTubPLTMi1ex5w5lSaE1roFlYVomjuTQbzjcxusvPMqqpfNpaGnjmWdf4pBDDgZsHWZlF3GePwOY/zSAToHaMOzl6Lquc9999zFu/Hga6up5+olHmPzuWwAMHb4/ewwehaHrSWhJSLJEH7eEW2iYQrZBKQSqpPDt1iBNUbv9nWSA2oBVVbqfdhZtpoGMhSV2lhZNVcUdCbLtpeftyoUkp3ewWAKK3A4OLlCIGRYqoEgKLcEE9gZdgao66TNwOAVFpWiaxhMP3cf6NcuJxg1eef0N+vbri6YlEEmexR+5qvGnBbQdYthacGeccQZXXHEFTc1NvP32W7zy8kvIssyIffbjhDMvoi0Wsz2lMBESuCyLcpeFmay1CUugAo1RwYfrosgSSa0LgeRQUYWg6yGH4xk4GEIRJEUhWYVDWDpqdhYNn3xI87aNdlcw2U5WkzztMZ3yKHaDJuzynizJNIVsZpssQUJL4M4t5uJrbyY7O4dEIs4tN1zD5k3rMHR4c9Jb5OXlpas9fyb70wA6JaXQt29fHn30EcLRMKtWreKuO29Pb3iqqOhGSfv2xBJasnRmYUpQIJu0U21lJAQYQuBzKHy8WWNNVOCS7bgXSYCp4cnKo+Lss4kmDBRZ3mW+Ljn90ljDjldfTHYY7TBElsAU4HaoHNPZj2bYQwGKaRFHoSac+kwCSVHQTcHAQYPIyc1FkiSam5u4/tqrCLUF6dKlK0888UQ61MoA+g9al7aFCp/A4XASCoW48sor0rtQJEni9Vdf5JN3XyfHn5WuYJjIFKs6ubKEmaxsKAo0mgqvrUsgVKftnS2BJCtEW4KUHT4GZ/c+GNFwcgd4skxnmbiyPDS9+SrhhjobbKnlmJKCJQQHlQTYI1siblpIskCRZNokmR0Ju5NpT6I4KCnI5cHbb2LrFluWQFVVFi9ayPPPP0NLsI1jjz2W448/Pq1ilQH0HyzUME2TU047lREjRxKLx3jhuedZtWLlbkvcdV3n5WceZtPqRXi9HhASlmHhtxLISkoSV5DldDBlu8nS5gSKMIklEghJxtANPPkFdDvldBLRmK0Zbd9NNgnJ40Zs2cyOd96zBdJ3YflZwi4xntIjG4SGUCQsSUGRJaqiBjWRBLIi2eKPls7sL99l2pefJlmpO1fbPfzwg6xfu5a6hmZuue0W/Fn+9A2bAfQfxDOnVjhfc/W1NDQ0smNHFf/4x0PpMOS7oUkw2IKiqkiygipBHoBkLzhCsohbDh5f1kQsSd63NB1kQTzURulhh+Lo3A09YQ+1CsluWyMsvD4fNS8/RyzcBrJMasglVarbuzibUcUyEc1Ic45VWWFTXEYXdoKqKArRSJhIOJjctruzPJnaSPDUk08SjcYpLi7jzDPP/EXc7wyg/4e8sxCCY445hvZlHUgkdN5++10aGxt/kNeQAoaFwJLAgcDvVBAeD8ICn0vl6waDOdUhclxuWwARC5FIIOXmUzp+AtFYDElN8jGSsbHsDyCWfcv2Tz+xNTlMy+4K7rJu/exeeXiEjiHZVFFZVTCdDrbEBU5VsbuTuzDkvluKsywTSZL54IP32bZtK3W1TZx26mm43e4/DJvuTw/o1EU/4cQTqa1vJhKN8vZbk36yNiuEzZ+whIWKhUNWkbxuTBOE5OC1dSG7YSOJ9EhtNBSi45FH4exUAfEYMhJIAiGDJYNLkdn49JMYhp5O7gDU5Lxhv/xsDmjvIhS3QJaQJBmH00EbMpWRBA5J2im9m4wepO99bntANhaL8uGH7xGMhskrKGH0AQel14ZkAP0/XtmwLIuyDmV06dqdUCjMihUrWLVq1W5g/76HllEdTrBsApIkyzg8WTgkWBwymFUTRZLAsGyAGYkojqJiSo86Ci0c3aWyYCFMA1e2n8is6dTNnYmiqLsMudp7WQRwWp98spU4OiCbdm1aVh1UatCg6bhdrrTmhcfrTd8Q0g/cwJIk8eUXXxCOxGhoDXLoIYemQvkMoP/X42eAPn37IoSKaQlWr1qxy/J6KakDbUvNShL4fH6OHH+MzZSzbB0kBVD8WUjAoqBAE6Y95Z1aphOMUHDoYSiFxVh6ApHW/RAIVcIdT7D52Sd2LtIj5Z0FprDomu1jXGcn0TggyViy3dIxVZU1kQTCkpBUeyAgGokwcI9BHDLmSPRko8j+XXdWQYQQbFi/nqqqalqDETp26Zwk8Wda338IQJe1LyMaj6NbFlVVO9LfS615E8KyxV4EJBJx5s2dnRaOUSQJRcg4c3JoNWFl2D42SQCyihaPY3n8FO49Cj1hJMek7NcyLRNXIJu6zz6kedVKJEVO86pTpTwhJM7vU0ipohG3DOx5dnuVRavqYV1Iw6E4ccgKCAtZVamprmLZkkXIsoJIJpVCWKmBLyRJIpFIUFtVTSwWx+Xx4ff/Oaodf4qyndvtRtd14vH4zmFQAUJYeLxefP4sLNNKrpAzqa+pQtfi9vQIYFoGWdkFbNagWrO9sykEwjBImDpmWQc0lwfFtAFqhwMWksONo6mBTU89boN8FwcpJ1exdQ14Oa6Lg1BM2xkSWHZduc6RTZsAj9teAYEQOB1OKjdtpLamOi0oYwlBTk5ectYwCVpJIhKJ2C18IdKbDf7o9odm26UKGC0tLSiqHULIDrf9+LVMevcbzDEn/ZWC/ABffvQOH30wOa01kdpdKMkykjBw5+SwIYG9T0W2gasn4jjbFaK2L0XbUG2DNIlKYUq4cv1UvfQ0oeqa3eihqZlBSwjO7ldIsQNqLIEkZCSwFUrdXta12t7c4ZDTS4NAICcJR8ISuFxuzrnwUgrad2H9mpW89/rzxGKRpGSCEwt7EVA0GstUOf73AW27xDWrV6M6FBRFpWv33unEb/CQofQfNIic/ALuuPMucrKz000WuzymIMkyTmEgZfnZZNqTfqkbJZHQ6HLAYShOFxgmlpyMmyXA50LesY0Nr71mE/Z3SUCVpHcuD/g4pquHVl1DTtasBRIOSSJmCJZurUmWHh1phqCUapcLgWEajB17BKedeRahhMWQfQ5KKo1CXl4BZR07oagyDXV1hMN21/KPTlT6QwM6RbRfvnw5Wzeux+/2MHz4CAYOGoxlmbz6wpO88PiDVHQpo1OnMnx+/y4HY9NHJSSchk7Y6aZZcZIuF0iQ3bWCgr32JRbWUGUZWdjCMqZl4vU62fLcc8RamnYDks3es9PCc/oW0sGhoSX9r5SMq12ywuK6OFtbEgC4XK7kauR0qpn+c+fOnejaqZRYawP/vON61q9ZiRCC40/9K76sbArzcpg2bUoyzMmU7f73E8PkJPftt95MIMtFlt/DNTfczFHHHEfvAXvQoayEwf16sX7tWmpra3eW3JItZaek4NBNDEsGdaeXRAi6HH4MmupB1zSsFNdZmDh8HqKrVrPu3TeTwubmLt7Z5lT3yM3ihO5e2hIGiiQnh2DtSoWBzFd1BkKxZcLcbg9ScnOuLMu7tcy//OJLAh4Xo0fuSXbAy6Ahw7n48us46NAjKC0qZPO6Vbz3ztvJrqjxhwf0H35ixbJsjsOCBfO55MLzuO3Ouxg6eE8GDxmMEFDRoYhgMMjfLr54NyKPJEn2TCECTANDyHg8TkJRWzAxq7g9eSMOJ9YUwsr1IEQqIbQJ+KseexwzHkdSlN3CDZEcgL1ij0KK5ARNpkCRBAIZsAgoEoubYGFDgiyvSisCd3EXRCy5PHQX9pzT6WT5ihXcfPMt3Hzz3xk6fCT1jS04HU4cksGyJQu47G8XkIgn0jlBBtB/kNBDlmU+//wzvv12Maedfiqj9hmF1+fl8w/e4vEnnmTN6tW7cTtSEl+KDE0mZAkPudnZhJqaAMgbeSRxVwArqmHqNj3fMi2U7Bwis6azZern9saqXVrOsiRhCsEehQEmlLlojYaQkiw7IUkI00TxBnhnSx3NwkGxrIKzmOzOexFZ+eEu5cadv5eiKNxyy80sX76ME044nkAgwPZtO5g6dSpvvvmmPTjwO+zUzgD6vwDUiqJQX1/Pvffcx7333Ld77PWdmTvLtH/e5XBQHzfIk1UK8vLYtnkzLm8ORqehxFuCmG4nmm7aXUVknGgsfvJRLGGhSCq71zVsu6h/IW4RoVkknwZCssVqFJWNQYlPa6PklA9AL+oJXYpQnB60RCT5uXafQEmx7CZPnszkyZO/H3D9icD8p6lD73rxJUlKK2im5gx3k+1KNlwsy0JSwOtw0BCX0HSd7OwcO0nrfRBhEcBoCSF0gWZZWIaJmpVN69dfsW3+PGRFxhRGGlhKklE3tDiHMUUOmmKmrbpk2cKQpmXgUhVeXN9Gc2F3ivadSPnZV0Pnfrjdir2SAjDN7+vMpW7W1Pxg6s8pgcU/k/25xhkgraC563L274JZJGWPTMvELUlsMyTaYlHysgM2OLuNQmuLEQtGQTcxdQNNklFjbSx/6smdRyt2Rs4WdtJ3SZ9cnEbc1tiwhC12bglcksqCJnhzSxSKezPyxDGMOKAnKIIcn4qW0JJPkp0ed9dplJSm8676zn9GU8nYbmAXQpCXl58MBQRhAS2yTCQUpCDLB3l9MAOdMYM1RFqd6IkE4Vgch9vP+refpWbpIluTY9fYWbYXcB7asYADCiSa4rGkJp0AC0x0LEeAJ1bW0xTXyU0Eef/Nr/APaAUthIqRVMtXMC2By+XB47H3N+5KP81YBtDpurIE+P1ZnHX2OcyaNROnQ0WP6eyIxrGcXqItrXiy86FkKHoigWQYxFraiEfjJISK1VrHmheeS8rdshvIhACn7OD87l60RBzNkpGFXdcwMMlWJWbUJ/h0exhFstAbNtEw9Qu2L1kHCR1vx27E47pNXJIkkCUOOvgQgsEg06dNS24JyID6Txly/OAhJMOMfv37cfzxx7FwwXymzp7L+sodCElGcbmor60hv2NPkLKRgq1Y8QTRljZCbREkt4cdk98ltH2LrTedCmEARbbLdAd1zKKfV9Acs3XzdEOQSC4TjeLh0TVN6EIHLBIN2zEbV+PcsRS2LcZhtKHpBg6XA9M0WLhwEU2NTVx9zTWkdDwylgH09ywYbKVHz558/PkU5s6ayTuvPkMw2ILP40Z2uehaUQFaAssASTdItEWJxQzi9dWseu+N71UUpKR39qoqJ3bw0xJLEDYhnjCIJUyicYFHwGfVcebVhO34GAlTjyKaqhE1q3G2bCDgctAWCqHHozzxjwcpLCjk6Wefx+f1ppPCjGVCjl0iDtvDnXbqGUiKQsKAgw+bwMYN6+lc1oGu3cppaGigZtsGXNHVxNfGwekAAeFgd6q/mUu0ZhtJ/VwUWUl7Z92EsR1zqXBqtCQEqgwGNsVUFYJtUZlHVrXaXUZrZ6hiWXHQ43SrqCAUbGH43sPp2q0XRR260rNnL3bU1jNq+GD22mso8+cvSA8CZwCdsXTFYMWKldTW1qEbBguXrWbJ0mVk5wRQ6loIeLNoDYW59tyDqa2tp6E5RG1TCGPx+ywN1oHsQAgNsUt3OfXHgVKI1dsSGJKte2ciowuBqgq+apTYGNJxOlQC2TkUFBZSXFxMUUl7Sss6EAjkEDNg0KjD2byllsbN9Ti8OfTqUc78BQvYtm37n0rq62edUyZF3tlUKSkt5ZkXX2PNuo00NjSyYUMljcEIbdEECCgoKGCvIf0ZPLAX3ToWkR8I4FRlYokErW1BWlpbaG5qpqmpyd5RriXwyA6KVdCNKEgykqwiZBmhOFAdXnS3B3eWH39WNp6sAEgykXicqpomvl22lnWbtlDX0EhCMyguzKd31zKyXJCVnUU02MLtN9+UQXHGQ+8ebkiSRO/evbnvgQexZAfNwSgJTWPz+iVoukFxaRd82blk5QQAhWAoQmswhkN20blLe/IdLso6/PT7GJhomoFpmMQTCXTdIqEZmHoMXdMJxUyCkQjBUJhQJEZtYysJE/LyCwl47W214bZa5k5ZjI6TYaP25+jDD+Gvf93OW29NIhKJ/OBipT+bKcDNf2YwCyFwu91MnfoVyApffj0LU8h0KO+OrkX5+vOPqdy4hi0bVlGzbSP11VtprqshEgxi6Dq6FgcsdMPAsAwsU8MyNUxDxzI1DEtD6DqRYJBIOEw8FiMSChMOhYiE7RsjFEsQi0YJtoVoamxi65ZKKtevYvPapWxYNo/1y+axZP4M1q1aTiQaZ8+RB6EnNFQJLr/0Yurra1i8eHFa0izjoTNGdk4uTo+Xrp3bM2PaDBbP+pIF38xJf1/TNOpqq6mrrWbrpvXU1exg3brVtC8tpajIjnvt2LcIp8tpDwkIBTmpLBpLaBimhWEKYokEWkJHS2jEE3E03aS2ro6qHTtobGigob6WUDCEJey2eE111c5KTFsTc754l/0OOIC9hvYjPz8HWVYyFzAD6J2iMrqu8+WXX3Dk0ePo1KULe4SiqA4VgcT2rRupr6kilNwoBbD/6NE89tjjtCvM/84rmlimgUjuCjctMz2FHQzGCEViaLqBooDhUDE8bjTdS0Iz8GZl0bFzF3uuEQfhcIyqHVv58pP3WL9qKaoiU1hUTM8+A+m/xxAGD9mTjh3KWLduLYsXL84khpmkcPeSnRCC4088kdPOuoD1ldUs/HYZDfUNuBwqqkMgGQmibU3s2L6NLZs3oaoqe+65J3uP2JshQ/akZ48KCgrb4fN4kLBFaiyL9DastrYg4UgMXTeJaxqabiTjaJ14QqctHKGhsZHqqio2b1jLhrVraGlqwOf3U9alHH9OAS5vAIfHT2FBO4bu0ZeA0+TUk46jrrbuT8eqywD65w5CtvcDti8rY/jI/Sgq7UQ0YdEUjBONJ/B6XRQX5NOhtB3FBQEciiARjRCJBJEkQSArQGFhIR06lNG9WzccThXLtJJ7vqG1JUQkGkXTTWIJDd0wMQwTLaFR39jE9h07aGpuRosnsEwD1e3DlJy0RjWaW9tIJDS8bicl+dlkuSWqtmzgs48/TEuaZbxzBtDfz5AVFdM0yM7JRpIknE43nbqUU1LWhdz8YrJy82jXrh0l7Qqp6NKRXj06U5Sfu8sr6CQSiaRbFskpFntOMBKKEYnFMQyLuL4T0KZpYloQ1w1icY141CAUi9LY3Mb2qjqa25qRTA2hRamv3sKKJYtpbW4gHrfnDVNCjxnLAPoHAG1LGJx9ztmcffa5XP/32/nys8+wTA2XQyG/XTu6lFfQuXNXKiq60bt3D/r27k5xUSFenxeX04kk/XhaohkWmm4Q1zViUTshTOg6kWiCppZWGhsbaWlsprqmmqptW6jZsZWqHVtpqKsm2BbE6XJzyqmnMGrUSM479wKCwbZ0uJSxTFL4o4nixg0bGbTHQC68+EIaIjKqrNDWXEe0rZE5M6cxZ+a09M/7/H7y8nIpLGhHVlYWLpebrKwsAoFssrKzcDqdOBxOVIdN/dQ1nXg8RmtLG+FIhGg0SktTEy0tTbQ0NxMKBW0vD0iqC58/m+y8EorK+3HoQQfw4J03MX36V7S1tWZCjQygf9pS4Fi0aDGNDY2MGDqILp1LiRsqffr3p8AHD965BmR7/s+yLCLhMJFwmO3btuPzZTFwYH8aG+tpaWlC1wxisTi6YRCLx9E1nTQ7TlLTz0bF5cHhdOJwufEVtqPA68frdWPoCdweDzk5hWQHPBxywCgAPvzoEzvcyAA6A+if886qqtLW1spzLzzP1VddxZD+ffhs+gIKC/Lo2KkDsiKj67otJ8DOTqOtNW1PjX/wwWTKyjqSiLcRi+uEI3E2b6+lpq6RcDhGPKGxbnMV69ZXEk3EicVsyS5dWFiWiRGPUle5imBjNUgKex84jm5dyxk+ZA8aG+t45eVX7SJhhoz0PcvQR3/AS0uSxH333kttXS0n/uUosnwutIROXmF7/n7rnekxp13n+OzRLp2ZM2dy1llnY1kmCS2BYWiAvSfc43LhcbtwOl3E4zF7LEuRsSRBPBokVLuVxk3LqFn/LVo0iC+QS4/+g3H7shgydACBQDY33ngzjY0NaSH3jGUA/bOAlmWZpqYmzjj9DNoXt2P8kYcQDDZTV1fH8BGjeOLp5+jVqxdmkqCfmuHTNHuQNT8/H1lWcDl9+HwBNM0iFo2TiOtomkkwFCQYDCLL9qSM0+HC58smN7+YdqWdycsrwJ+VQ79hB9Chx570qOjCSROP5L3J7/Dkk09mqKI/ldjzJ+Zy/FTooSgK69evJ9jWxtWXX8zy1RsIh6O4HE66du3KKaeczP777UtxcTE5uTkUFbdjwMABnHbaqdx6661MnTqFv555Nhs2bGDgoD1paGomqmnolkXl1h00NLXaSaJlIoSMqevEI220tdTQWFOFy+2mXVk3SooKuP/Wq1i1YgkTJxyb3tqVsUzZ7tcnGKqKYRice85Z3Hb3g7z29gcIIehQWkyO30enTmV07dwhKfxiJB949t6Ugw86lClTpwLw/gefgtNNMBxhR3U9q9ZsJBSLE49raIaOZhjE2lqo3bQKXU/QY8BQLMlNu4IcnvjHLaxbuYTx4yfQ0pKpbGQ89P8z/FAUhYULF7FowTecdsqJ+LOyaG1pQyATjUZoamwgGo2QSCQIh0O0trYSi2v07jOAWDzG2KPG07PXQFqCIarrGlm/sZJoTEczdCzLllQINlbTsHUthqahur1IziwG7zmQW647n4/fe5sTTzyJaDSaAXPGQ/9Gd30yZg0EAlxy2RXsO/pAkFRisTiyJHC7nHa92akiIaFpBorDgdPpJBiOsWnzNiq3bWNHVQ2xuIammximia7Hqdm2kepN6zAlmS69h1Ba2pGD9x9K146F/POBe/jiiym78U0ylgH0bwpqgI6dOnHMX/7CqH1Hk52Th2aYRGMJYlG75qxZFsFQmLa2EC2tbbSFwsRicYRpomsGCcNENwwSmoaWiJOd5aV7eVe6dC7FIcWZM+0r3nzzrfT7phh7GcsA+rc9LMkegDWSsrRer5fBQ4YwZOgwunbrgceXRTiusXZjJeGollwDZ69aS8YwSMJClhRcTge5OT7cLhUjHmbH1k0sXjif5ctW/OBNlLEMoH9XYH93C60sQWG7Yrp268aJJ55ETV0joUiURDyBQEKSJSQBkqzgz/IhtCiffDSZurp6mpKKpj/22hnLAPrfBmz7S05SRe2E7Z133mHsUUdSuWkzrW1BahtbqGpooS0cQ5JUunYq5alH7uWrL75Ivo6c7DRamaQvU+X4z5o9mGqDMCWeOPn996msrKRL1674s3OIxE2iuokpZOq2b+bVpx9l7uxZaXF1kdzIlYmTMx76v9ry8nJ56bVX2FHbwpr1laxbsYQvPp6c9u4ZAP/2lml9/06hiMPhoLm5hcpNWxl94MF06daDHdu2pPWpM2DOeOj/SWALIejZqxfhUIgdO3ZkPHMG0H8MUGfCjAyg/zhxXXJPYQbMGUBnLGOZpDBjGUBnLGMZQGcsYxlAZyxjGUBnLGMZQGcsA+iMZSwD6IxlLAPojGUsA+iMZexn7P8AAkEaccjz/CIAAAAASUVORK5CYII=" 
            alt="Império" 
            className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(245,158,11,0.4)] flex-shrink-0"
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
