import React, { useState, useEffect, useMemo, useRef } from "react";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  runTransaction,
  limit,
  serverTimestamp,
  where
} from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Clock, 
  Settings, 
  ChevronRight, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  Printer, 
  AlertCircle,
  TrendingUp,
  Users,
  Package,
  MapPin,
  Phone,
  User,
  LogOut,
  Play,
  Pause,
  RefreshCw,
  Search,
  Filter,
  Scissors
} from "lucide-react";

/**
 * 🛠️ CONFIGURATION & FIREBASE SETUP
 */
const localConfig = {
  apiKey: "AIzaSyBi9O20ep4sQEfAQSvQAexHzzT1wjj8cHc",
  authDomain: "karbala-burger-app.firebaseapp.com",
  projectId: "karbala-burger-app",
  storageBucket: "karbala-burger-app.firebasestorage.app",
  messagingSenderId: "112064338237",
  appId: "1:112064338237:web:93b7154a4504704d82cd54",
  measurementId: "G-XRPEGJZRHG"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : localConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'karbala-burger-pro-v3';

// Firebase Helpers
const getMenuColl = () => collection(db, 'artifacts', appId, 'public', 'data', 'menu');
const getOrdersColl = () => collection(db, 'artifacts', appId, 'public', 'data', 'orders');
const getSettingsDoc = () => doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
const getStatsColl = () => collection(db, 'artifacts', appId, 'public', 'data', 'stats');

const OWNER_PASSWORD = "12345";
const PING_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

/**
 * 🎨 STYLES & ANIMATIONS (UPDATED FOR BARBER THEME)
 */
const customStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-shimmer {
    animation: shimmer 2s infinite;
  }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .perspective-1000 { perspective: 1000px; }
  .rotate-y-12 { transform: rotateY(12deg); }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .animate-float { animation: float 3s ease-in-out infinite; }

  @keyframes pulse-border {
    0%, 100% { border-color: rgba(212, 175, 55, 0.2); }
    50% { border-color: rgba(212, 175, 55, 0.6); }
  }
  .deal-card {
    animation: pulse-border 2s infinite;
  }
`;

/**
 * 🛒 COMPONENTS
 */

const WhatsappIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a]/50">
          <h2 className="text-2xl font-black italic tracking-tighter text-white">{title}</h2>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white transition-colors">✕</button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto no-scrollbar text-white">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // State
  const [view, setView] = useState("customer"); // customer, owner
  const [user, setUser] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({
    restaurantNameAr: "صالون المنصور",
    restaurantNameEn: "AL-MANSOUR GROOMING",
    primaryColor: "#d4af37",
    whatsapp: "964780000000",
    headerImage: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200",
    isStoreOpen: true,
    currency: "د.ع"
  });

  // POS State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(false);
  const [activeOrderTab, setActiveOrderTab] = useState('pending');
  
  // Customer State
  const [cart, setCart] = useState({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "", address: "" });
  const [orderSuccess, setOrderSuccess] = useState(null);

  const audioRef = useRef(new Audio(PING_SOUND_URL));
  const printedIds = useRef(new Set());

  // Init Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth init failed", err); }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  // Sync Data
  useEffect(() => {
    if (!user) return;

    const unsubMenu = onSnapshot(getMenuColl(), snap => {
      setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSettings = onSnapshot(getSettingsDoc(), snap => {
      if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.data() }));
    });

    const q = query(getOrdersColl(), orderBy('timestamp', 'desc'), limit(50));
    const unsubOrders = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(list);

      // Sound & Auto-print logic
      if (isSystemActive) {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            const id = change.doc.id;
            const isNew = (Date.now() - (data.timestamp?.toMillis() || 0)) < 20000;
            if (isNew && !printedIds.current.has(id)) {
              audioRef.current.play().catch(e => console.log("Audio blocked"));
              if (isAutoPrintEnabled) handlePrint(id, data);
            }
          }
        });
      }
    });

    return () => { unsubMenu(); unsubSettings(); unsubOrders(); };
  }, [user, isSystemActive, isAutoPrintEnabled]);

  // Pricing Helpers
  const formatPrice = (val) => (val || 0).toLocaleString() + " " + settings.currency;
  
  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((acc, [id, qty]) => {
      const item = menuItems.find(m => m.id === id);
      return acc + (item ? item.price * qty : 0);
    }, 0);
  }, [cart, menuItems]);

  // Actions
  const updateCart = (id, delta) => {
    setCart(prev => {
      const next = { ...prev };
      const val = (next[id] || 0) + delta;
      if (val <= 0) delete next[id];
      else next[id] = val;
      return next;
    });
  };

  const submitOrder = async (target = 'both') => {
    if (!customerInfo.name || !customerInfo.phone) return;

    const orderData = {
      customer: customerInfo,
      items: Object.entries(cart).map(([id, qty]) => {
        const item = menuItems.find(m => m.id === id);
        return { id, name: item.name, price: item.price, quantity: qty };
      }),
      totalPrice: cartTotal,
      status: 'pending',
      timestamp: serverTimestamp(),
      platform: 'web_v3'
    };

    try {
      const docRef = await addDoc(getOrdersColl(), orderData);
      
      if (target === 'whatsapp' || target === 'both') {
        const itemsList = orderData.items.map(i => `• ${i.name} (${i.quantity}x)`).join('\n');
        const waMsg = `حجز جديد ✂️\n---\nالاسم: ${customerInfo.name}\nالهاتف: ${customerInfo.phone}\nملاحظات: ${customerInfo.address}\n---\nالخدمات:\n${itemsList}\n---\nالمجموع: ${formatPrice(cartTotal)}`;
        window.open(`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(waMsg)}`, '_blank');
      }

      setOrderSuccess(docRef.id);
      setCart({});
      setIsCheckoutOpen(false);
      setCustomerInfo({ name: "", phone: "", address: "" });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = (id, data) => {
    printedIds.current.add(id);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const content = `
      <html dir="rtl">
        <style>
          body { font-family: sans-serif; width: 80mm; padding: 4mm; margin: 0; }
          .center { text-align: center; }
          .header { border-bottom: 2px dashed #000; padding-bottom: 4mm; margin-bottom: 4mm; }
          .item { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 14px; }
          .total { border-top: 2px solid #000; padding-top: 2mm; font-weight: bold; font-size: 18px; }
        </style>
        <body>
          <div class="header center">
            <h1 style="margin:0; font-size: 24px;">${settings.restaurantNameAr}</h1>
            <p>رقم الحجز: #${id.slice(-5).toUpperCase()}</p>
            <p>${new Date().toLocaleString('ar-IQ')}</p>
          </div>
          <div>
            <p>الزبون: ${data.customer.name}</p>
            <p>الهاتف: ${data.customer.phone}</p>
          </div>
          <div style="margin: 5mm 0;">
            ${data.items.map(i => `<div class="item"><span>${i.quantity}x ${i.name}</span><span>${(i.price * i.quantity).toLocaleString()}</span></div>`).join('')}
          </div>
          <div class="total item">
            <span>المجموع</span>
            <span>${data.totalPrice.toLocaleString()} د.ع</span>
          </div>
          <p class="center" style="margin-top: 5mm;">شكراً لزيارتكم!</p>
        </body>
      </html>
    `;
    iframe.contentWindow.document.write(content);
    iframe.contentWindow.document.close();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  };

  const categories = useMemo(() => {
    const cats = ['all', ...new Set(menuItems.map(i => i.category))];
    return cats.filter(c => c);
  }, [menuItems]);

  const filteredMenu = menuItems.filter(i => activeCategory === 'all' || i.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans selection:bg-[#d4af37]/30 text-white overflow-x-hidden">
      <style>{customStyles}</style>

      {/* 🚀 NAVBAR */}
      <nav className="fixed top-0 inset-x-0 h-20 bg-[#0a0a0a]/80 backdrop-blur-xl z-[150] border-b border-white/10 px-6">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#d4af37] rounded-2xl flex items-center justify-center text-black rotate-3 shadow-lg shadow-[#d4af37]/20">
              <Scissors size={24} />
            </div>
            <div>
              <h1 className="font-black italic tracking-tighter text-xl leading-none text-white">{settings.restaurantNameEn}</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d4af37]">{settings.restaurantNameAr}</p>
            </div>
          </div>

          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
            <button 
              onClick={() => setView('customer')}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'customer' ? 'bg-[#d4af37] shadow-sm text-black' : 'text-white/50 hover:text-white'}`}
            >
              SERVICES
            </button>
            <button 
              onClick={() => setView('owner')}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${view === 'owner' ? 'bg-[#d4af37] shadow-sm text-black' : 'text-white/50 hover:text-white'}`}
            >
              POS DASHBOARD
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-32">
        {view === 'customer' ? (
          <div className="max-w-6xl mx-auto px-6" dir="rtl">
            {/* HERO */}
            <header className="relative h-[400px] rounded-[3rem] overflow-hidden mb-12 shadow-2xl group border-[8px] border-[#141414]">
              <img 
                src={settings.headerImage} 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-70" 
                alt="Karbala Barber" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-12">
                <div className="bg-[#d4af37] text-black px-5 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase mb-4 w-fit animate-bounce">
                  الحلاقة الفاخرة في كربلاء ✨
                </div>
                <h2 className="text-6xl md:text-8xl font-black text-white italic tracking-tighter mb-2 leading-none">
                  {settings.restaurantNameAr}
                </h2>
                <p className="text-white/70 font-bold text-lg max-w-xl">أرقى خدمات الحلاقة والعناية بالرجل. احجز موعدك الآن واستمتع بتجربة فاخرة!</p>
              </div>
            </header>

            {/* CATEGORY BAR */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 sticky top-20 z-[140] bg-[#0a0a0a]/95 backdrop-blur-sm py-4">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-8 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-wider whitespace-nowrap transition-all border-2 ${activeCategory === cat ? 'bg-[#d4af37] border-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 scale-105' : 'bg-[#141414] border-white/5 text-white/50 hover:border-[#d4af37]/50 hover:text-white'}`}
                >
                  {cat === 'all' ? 'الكل' : cat}
                </button>
              ))}
            </div>

            {/* PRODUCT GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredMenu.map(item => (
                <div 
                  key={item.id}
                  className={`group relative bg-[#141414] p-6 rounded-[2.5rem] border border-white/5 hover:border-[#d4af37]/30 shadow-sm transition-all hover:shadow-2xl hover:-translate-y-2 ${item.isSpecial ? 'deal-card' : ''}`}
                >
                  {item.isSpecial && (
                    <div className="absolute -top-3 -left-3 bg-[#d4af37] text-black text-[10px] font-black px-4 py-2 rounded-2xl shadow-xl z-10 animate-pulse">
                      عرض خاص ✨
                    </div>
                  )}
                  
                  <div className="aspect-square rounded-[2rem] overflow-hidden mb-6 bg-black relative">
                    <img 
                      src={item.image || "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600"} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80"
                    />
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-2xl font-black text-white leading-tight">{item.name}</h3>
                      <span className="text-lg font-black text-[#d4af37] italic">{formatPrice(item.price)}</span>
                    </div>
                    <p className="text-white/40 text-sm font-medium leading-relaxed line-clamp-2">
                      {item.description || "خدمة احترافية على أيدي أمهر الحلاقين لضمان أفضل مظهر لك."}
                    </p>
                    
                    <div className="pt-4 flex items-center gap-3">
                      {cart[item.id] ? (
                        <div className="flex-1 flex items-center justify-between bg-black border border-white/10 p-2 rounded-2xl shadow-lg">
                          <button onClick={() => updateCart(item.id, -1)} className="w-10 h-10 flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-xl transition-colors"><Minus size={18} /></button>
                          <span className="text-white font-black">{cart[item.id]}</span>
                          <button onClick={() => updateCart(item.id, 1)} className="w-10 h-10 flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-xl transition-colors"><Plus size={18} /></button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => updateCart(item.id, 1)}
                          className="flex-1 bg-white/5 text-[#d4af37] border border-[#d4af37]/20 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-[#d4af37] hover:text-black transition-all flex items-center justify-center gap-2 group/btn"
                        >
                          إضافة للحجز
                          <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* EMPTY STATE */}
            {filteredMenu.length === 0 && (
              <div className="py-32 text-center">
                <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-white/20">
                  <Scissors size={48} />
                </div>
                <h3 className="text-2xl font-black text-white/40">لا توجد خدمات في هذا القسم حالياً</h3>
              </div>
            )}
          </div>
        ) : (
          /* 🏰 POS VIEW */
          <div className="max-w-7xl mx-auto px-6" dir="rtl">
            {!isUnlocked ? (
              <div className="flex items-center justify-center py-32">
                <div className="bg-[#141414] p-12 rounded-[3.5rem] shadow-2xl border border-white/5 text-center w-full max-w-md animate-in zoom-in-95">
                  <div className="w-24 h-24 bg-[#d4af37]/10 text-[#d4af37] rounded-[2rem] flex items-center justify-center mx-auto mb-8 animate-float border border-[#d4af37]/20">
                    <Settings size={48} />
                  </div>
                  <h2 className="text-4xl font-black mb-8 italic tracking-tighter text-white">إدارة الصالون</h2>
                  <div className="space-y-4">
                    <input 
                      type="password" 
                      placeholder="كلمة المرور"
                      className="w-full p-6 bg-black border border-white/10 rounded-3xl text-center text-3xl font-black focus:border-[#d4af37]/50 focus:ring-0 text-white transition-colors"
                      onChange={e => e.target.value === OWNER_PASSWORD && setIsUnlocked(true)}
                    />
                    <p className="text-[#d4af37]/50 font-black text-[10px] uppercase tracking-widest">Authorized Access Only</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* STATUS BAR */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-1 bg-[#141414] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl border border-[#d4af37]/20">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d4af37]/70 mb-4">Print System</h3>
                        <div className="flex items-center gap-4 mb-2">
                          <div className={`w-3 h-3 rounded-full animate-pulse ${isSystemActive ? 'bg-[#d4af37]' : 'bg-red-500'}`} />
                          <span className="text-3xl font-black italic">{isSystemActive ? 'ACTIVE' : 'IDLE'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isSystemActive ? (
                          <button onClick={() => { setIsSystemActive(true); setIsAutoPrintEnabled(true); }} className="flex-1 bg-[#d4af37] text-black p-4 rounded-2xl flex items-center justify-center hover:bg-[#f1d592] transition-all">
                            <Play fill="black" size={20} />
                          </button>
                        ) : (
                          <button onClick={() => setIsSystemActive(false)} className="flex-1 bg-white/10 p-4 rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all">
                            <Pause fill="white" size={20} />
                          </button>
                        )}
                        <button 
                          onClick={() => setIsAutoPrintEnabled(!isAutoPrintEnabled)}
                          className={`flex-1 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${isAutoPrintEnabled ? 'bg-green-600/20 text-green-500 border border-green-500/30' : 'bg-white/5 text-white/50'}`}
                        >
                          AUTO: {isAutoPrintEnabled ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-[#d4af37]"><Printer size={80} /></div>
                  </div>

                  <div className="md:col-span-3 bg-[#141414] rounded-[2.5rem] p-8 border border-white/5 shadow-xl grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Pending Bookings</p>
                      <p className="text-4xl font-black italic text-[#d4af37]">{orders.filter(o => o.status === 'pending').length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Today's Revenue</p>
                      <p className="text-4xl font-black italic text-white">
                        {orders.reduce((acc, o) => acc + (o.totalPrice || 0), 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Total Clients</p>
                      <p className="text-4xl font-black italic text-white">{new Set(orders.map(o => o.customer?.phone)).size}</p>
                    </div>
                    <div className="flex flex-col justify-center gap-2">
                      <button className="bg-white/5 p-3 rounded-xl text-[10px] font-black text-white hover:bg-white/10 transition-colors">DAILY REPORT</button>
                      <button onClick={() => setIsUnlocked(false)} className="bg-red-500/10 text-red-400 p-3 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-colors">LOGOUT</button>
                    </div>
                  </div>
                </div>

                {/* ORDERS MANAGEMENT */}
                <div className="bg-[#141414] rounded-[3rem] p-10 shadow-xl border border-white/5 min-h-[600px]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                      <h2 className="text-4xl font-black italic tracking-tighter text-white">حجوزات الصالون</h2>
                      <div className="bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 px-4 py-1.5 rounded-full text-[10px] font-black">LIVE UPDATE</div>
                    </div>
                    <div className="flex bg-black border border-white/10 p-1.5 rounded-2xl">
                      {['pending', 'completed', 'all'].map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveOrderTab(tab)}
                          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeOrderTab === tab ? 'bg-white shadow-sm text-black' : 'text-white/50 hover:text-white'}`}
                        >
                          {tab === 'pending' ? 'في الانتظار' : tab === 'completed' ? 'تم الانتهاء' : 'الكل'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {orders
                      .filter(o => activeOrderTab === 'all' || o.status === activeOrderTab)
                      .map(order => (
                      <div 
                        key={order.id} 
                        className={`group bg-black p-8 rounded-[3rem] border border-white/5 transition-all relative ${order.status === 'completed' ? 'opacity-50' : 'hover:border-[#d4af37]/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)]'}`}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="bg-white/10 px-4 py-1.5 rounded-xl text-white">
                            <span className="text-[10px] font-black italic">#{order.id.slice(-5).toUpperCase()}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-[#d4af37]/50 uppercase tracking-widest">Amount</span>
                            <span className="text-xl font-black italic text-[#d4af37]">{formatPrice(order.totalPrice)}</span>
                          </div>
                        </div>

                        <div className="mb-8 p-5 bg-[#141414] rounded-[2rem] border border-white/5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-[#d4af37]/10 rounded-xl flex items-center justify-center text-[#d4af37]"><User size={20} /></div>
                            <div>
                              <p className="font-black text-lg leading-none text-white">{order.customer?.name}</p>
                              <p className="text-xs font-bold text-[#d4af37]">{order.customer?.phone}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <MapPin size={16} className="text-white/30 mt-1 flex-shrink-0" />
                            <p className="text-xs font-medium text-white/50 leading-relaxed">{order.customer?.address || 'بدون ملاحظات'}</p>
                          </div>
                        </div>

                        <div className="space-y-3 mb-10 min-h-[100px]">
                          {order.items?.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm text-white/80">
                              <span className="font-bold"><span className="text-[#d4af37] font-black ml-1">{it.quantity}x</span> {it.name}</span>
                              <span className="text-[10px] font-black text-white/30 italic">{(it.price * it.quantity).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => handlePrint(order.id, order)}
                            className="w-14 h-14 rounded-2xl bg-white/5 text-white/50 flex items-center justify-center hover:bg-[#d4af37] hover:text-black transition-all"
                          >
                            <Printer size={20} />
                          </button>
                          {order.status === 'pending' ? (
                            <button 
                              onClick={() => updateDoc(doc(getOrdersColl(), order.id), { status: 'completed' })}
                              className="flex-1 h-14 rounded-2xl bg-[#d4af37] text-black font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#f1d592] transition-all shadow-lg"
                            >
                              <CheckCircle2 size={18} /> تم الانتهاء
                            </button>
                          ) : (
                            <div className="flex-1 h-14 rounded-2xl bg-white/5 text-white/30 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3">
                              <CheckCircle2 size={18} /> مكتمل
                            </div>
                          )}
                          <button 
                            onClick={() => { if(window.confirm('إلغاء الحجز نهائياً؟')) deleteDoc(doc(getOrdersColl(), order.id)) }}
                            className="w-14 h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>

                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#141414] px-4 py-1 rounded-full border border-white/10 text-[8px] font-black text-white/40 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          Received {order.timestamp ? new Date(order.timestamp.toMillis()).toLocaleTimeString('ar-IQ') : '---'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {orders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-32 opacity-20 text-white">
                      <LayoutDashboard size={80} className="mb-6" />
                      <p className="text-2xl font-black italic">لا توجد حجوزات واردة حالياً</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 🛒 FLOATING CART BUTTON */}
      {view === 'customer' && cartTotal > 0 && (
        <div className="fixed bottom-10 inset-x-0 z-[180] flex justify-center px-6 animate-in slide-in-from-bottom-10">
          <button 
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full max-w-lg bg-[#d4af37] text-black p-6 rounded-[2.5rem] shadow-[0_20px_60px_rgba(212,175,55,0.3)] flex justify-between items-center transition-all hover:scale-105 active:scale-95 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
            <div className="relative flex items-center gap-6">
              <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center">
                <span className="font-black text-xl">{Object.keys(cart).length}</span>
              </div>
              <span className="text-xl font-black italic uppercase tracking-tighter">مراجعة الحجز</span>
            </div>
            <span className="relative text-2xl font-black italic">{formatPrice(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* 🛍️ CHECKOUT MODAL */}
      <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="إكمال تفاصيل الحجز">
        <div className="space-y-6" dir="rtl">
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-white/50 mr-2">الاسم الكامل</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="مثلاً: علي الكربلائي"
                  className="w-full p-5 bg-black border border-white/10 rounded-3xl focus:border-[#d4af37]/50 focus:ring-0 font-bold text-white transition-all placeholder:text-white/20 outline-none"
                  value={customerInfo.name}
                  onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})}
                />
                <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-white/50 mr-2">رقم الهاتف</label>
              <div className="relative">
                <input 
                  type="tel" 
                  placeholder="07XXXXXXXX"
                  className="w-full p-5 bg-black border border-white/10 rounded-3xl focus:border-[#d4af37]/50 focus:ring-0 font-bold text-white transition-all placeholder:text-white/20 outline-none"
                  value={customerInfo.phone}
                  onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})}
                />
                <Phone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-white/50 mr-2">ملاحظات / موعد الحجز</label>
              <div className="relative">
                <textarea 
                  placeholder="اي ملاحظات خاصة للحلاق..."
                  className="w-full p-5 bg-black border border-white/10 rounded-3xl focus:border-[#d4af37]/50 focus:ring-0 font-bold text-white h-32 resize-none transition-all placeholder:text-white/20 outline-none"
                  value={customerInfo.address}
                  onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})}
                />
                <MapPin size={18} className="absolute left-5 top-8 text-white/20" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-6">
            <button 
              onClick={() => submitOrder('whatsapp')}
              className="w-full bg-[#25D366] text-white p-6 rounded-3xl font-black italic text-xl flex items-center justify-center gap-4 hover:brightness-95 transition-all shadow-xl shadow-[#25D366]/20 border border-transparent"
            >
              <WhatsappIcon />
              تأكيد عبر واتساب
            </button>
            <button 
              onClick={() => submitOrder('both')}
              className="w-full bg-white text-black p-6 rounded-3xl font-black italic text-xl flex items-center justify-center gap-4 hover:bg-gray-200 transition-all shadow-xl"
            >
              <LayoutDashboard size={22} />
              إرسال للصالون مباشرة
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-widest text-white/40 italic">Total Amount</span>
            <span className="text-3xl font-black italic text-[#d4af37]">{formatPrice(cartTotal)}</span>
          </div>
        </div>
      </Modal>

      {/* 🎉 SUCCESS MODAL */}
      <Modal isOpen={!!orderSuccess} onClose={() => setOrderSuccess(null)} title="تم استلام حجزك!">
        <div className="text-center py-8" dir="rtl">
          <div className="w-24 h-24 bg-[#d4af37]/20 text-[#d4af37] rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 animate-bounce border border-[#d4af37]/30">
            <CheckCircle2 size={60} />
          </div>
          <h3 className="text-3xl font-black mb-4 italic tracking-tighter text-white">شكراً لثقتكم بنا!</h3>
          <p className="text-white/60 font-medium mb-10 leading-relaxed">
            تم إرسال حجزك بنجاح للصالون. ننتظر زيارتك لتجربة خدماتنا الفاخرة، يرجى التواجد في الوقت المحدد.
          </p>
          <button 
            onClick={() => setOrderSuccess(null)}
            className="w-full bg-[#d4af37] text-black py-6 rounded-3xl font-black uppercase tracking-widest shadow-xl hover:bg-[#f1d592] transition-colors"
          >
            حسناً، فهمت
          </button>
        </div>
      </Modal>

    </div>
  );
}