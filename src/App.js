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
  where,
  increment
} from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  LayoutDashboard, ShoppingBag, Clock, Settings, ChevronRight, Plus, Minus, Trash2, 
  CheckCircle2, Printer, AlertCircle, TrendingUp, Users, Package, MapPin, Phone, 
  User, LogOut, Play, Pause, RefreshCw, Search, Filter, Scissors, DollarSign, 
  PieChart, Calendar, ChevronLeft, ChevronDown, Edit3, Save, X, Image as ImageIcon,
  Share2, MessageSquare, Bell, ShieldCheck
} from "lucide-react";

/**
 * 🛠️ CORE CONFIGURATION (Restored from your 1.3k file)
 */
const firebaseConfig = {
  apiKey: "AIzaSyBi9O20ep4sQEfAQSvQAexHzzT1wjj8cHc",
  authDomain: "karbala-burger-app.firebaseapp.com",
  projectId: "karbala-burger-app",
  storageBucket: "karbala-burger-app.firebasestorage.app",
  messagingSenderId: "112064338237",
  appId: "1:112064338237:web:93b7154a4504704d82cd54",
  measurementId: "G-XRPEGJZRHG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'karbala-barber-main-v1';

// Shared Constants
const OWNER_PASSWORD = "12345";
const PING_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// Restored Styles
const customStyles = `
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  .animate-shimmer { animation: shimmer 2s infinite; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .barber-card { background: #141414; border: 1px solid rgba(212, 175, 55, 0.1); transition: all 0.3s ease; }
  .barber-card:hover { border-color: rgba(212, 175, 55, 0.4); box-shadow: 0 15px 30px -10px rgba(212, 175, 55, 0.2); }
  .gold-gradient { background: linear-gradient(135deg, #d4af37 0%, #f1d592 100%); }
  .dark-glass { background: rgba(20, 20, 20, 0.8); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.05); }
`;

export default function App() {
  // --- AUTH & VIEW STATE ---
  const [view, setView] = useState("customer");
  const [user, setUser] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(false);
  
  // --- DATABASE DATA ---
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({
    restaurantNameAr: "صالون الحلاقة الملكي",
    restaurantNameEn: "ROYAL BARBER SHOP",
    whatsapp: "964780000000",
    currency: "د.ع",
    headerImage: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=1200",
    isStoreOpen: true,
    autoPrint: false,
    themeColor: "#d4af37",
    address: "كربلاء - شارع السناتر"
  });

  // --- POS / PANEL STATE ---
  const [activeTab, setActiveTab] = useState("dashboard");
  const [orderFilter, setOrderFilter] = useState("pending");
  const [editingItem, setEditingItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // --- CUSTOMER STATE ---
  const [cart, setCart] = useState({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "", address: "" });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const audioRef = useRef(new Audio(PING_SOUND_URL));

  // --- FIREBASE INITIALIZATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Fail:", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // --- DATA SYNC (RESTORED FROM 1.3K FILE) ---
  useEffect(() => {
    if (!user) return;
    
    // Paths
    const menuPath = collection(db, 'artifacts', appId, 'public', 'data', 'menu');
    const settingsPath = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
    const ordersPath = query(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderBy('timestamp', 'desc'), limit(100));

    const unsubMenu = onSnapshot(menuPath, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMenuItems(items);
      const cats = ['all', ...new Set(items.map(i => i.category))].filter(Boolean);
      setCategories(cats);
    });

    const unsubSettings = onSnapshot(settingsPath, snap => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(s => ({ ...s, ...data }));
        setIsAutoPrintEnabled(data.autoPrint || false);
      }
    });

    const unsubOrders = onSnapshot(ordersPath, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      // Auto-logic for incoming orders
      if (isSystemActive) {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const data = change.doc.data();
            const timeDiff = Date.now() - (data.timestamp?.toMillis() || 0);
            if (timeDiff < 15000) { // New within 15s
              audioRef.current.play().catch(() => {});
              if (isAutoPrintEnabled) handlePrint(change.doc.id, data);
            }
          }
        });
      }
    });

    return () => { unsubMenu(); unsubSettings(); unsubOrders(); };
  }, [user, isSystemActive, isAutoPrintEnabled]);

  // --- LOGIC: CART & PRICING ---
  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((acc, [id, qty]) => {
      const item = menuItems.find(m => m.id === id);
      return acc + (item ? (item.price || 0) * qty : 0);
    }, 0);
  }, [cart, menuItems]);

  const updateCart = (id, delta) => {
    setCart(prev => {
      const next = { ...prev };
      const val = (next[id] || 0) + delta;
      if (val <= 0) delete next[id]; else next[id] = val;
      return next;
    });
  };

  // --- LOGIC: PRINTING (COMPLEX RESTORED) ---
  const handlePrint = (id, data) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const content = `
      <html dir="rtl">
        <style>
          @page { margin: 0; }
          body { font-family: 'Arial', sans-serif; width: 80mm; padding: 5mm; margin: 0; color: #000; }
          .center { text-align: center; }
          .header { border-bottom: 1px dashed #000; padding-bottom: 5mm; margin-bottom: 5mm; }
          .title { font-size: 24px; font-weight: bold; margin: 0; }
          .sub { font-size: 14px; margin: 2mm 0; }
          .item { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 2mm; }
          .total { border-top: 2px solid #000; padding-top: 3mm; font-weight: bold; font-size: 18px; margin-top: 5mm; }
          .footer { margin-top: 8mm; font-size: 12px; border-top: 1px solid #eee; padding-top: 2mm; }
        </style>
        <body>
          <div class="header center">
            <h1 class="title">${settings.restaurantNameAr}</h1>
            <p class="sub">${settings.restaurantNameEn}</p>
            <p>ID: #${id.slice(-5).toUpperCase()}</p>
          </div>
          <div class="info">
            <p><b>الزبون:</b> ${data.customer?.name}</p>
            <p><b>الهاتف:</b> ${data.customer?.phone}</p>
            <p><b>التاريخ:</b> ${new Date().toLocaleString('ar-IQ')}</p>
          </div>
          <div style="margin: 10px 0;">
            ${data.items?.map(i => `
              <div class="item">
                <span>${i.quantity}x ${i.name}</span>
                <span>${(i.price * i.quantity).toLocaleString()}</span>
              </div>
            `).join('')}
          </div>
          <div class="total item">
            <span>المجموع النهائي</span>
            <span>${data.totalPrice.toLocaleString()} ${settings.currency}</span>
          </div>
          <div class="footer center">
            <p>${settings.address}</p>
            <p>شكراً لاختياركم صالوننا الملكي</p>
          </div>
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

  // --- LOGIC: ORDER SUBMISSION ---
  const submitOrder = async (target = 'internal') => {
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
      platform: 'web_booking'
    };

    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderData);
      
      if (target === 'whatsapp') {
        const itemsStr = orderData.items.map(i => `• ${i.name} (${i.quantity}x)`).join('\n');
        const text = `حجز صالون جديد ✂️\n---\nالاسم: ${customerInfo.name}\nالهاتف: ${customerInfo.phone}\nالملاحظات: ${customerInfo.address}\n---\nالخدمات:\n${itemsStr}\n---\nالمجموع: ${cartTotal.toLocaleString()} د.ع`;
        window.open(`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(text)}`, '_blank');
      }

      setOrderSuccess(docRef.id);
      setCart({});
      setIsCheckoutOpen(false);
      setCustomerInfo({ name: "", phone: "", address: "" });
    } catch (err) { console.error("Order Submit Error:", err); }
  };

  // --- LOGIC: ADMIN ACTIONS ---
  const deleteMenuItem = async (id) => {
    if (window.confirm("حذف هذه الخدمة؟")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menu', id));
    }
  };

  const saveMenuItem = async (item) => {
    const coll = collection(db, 'artifacts', appId, 'public', 'data', 'menu');
    if (item.id) {
      await updateDoc(doc(coll, item.id), item);
    } else {
      await addDoc(coll, item);
    }
    setEditingItem(null);
  };

  const updateGlobalSettings = async (newSettings) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), newSettings, { merge: true });
  };

  // --- DASHBOARD CALCULATIONS (RESTORED) ---
  const stats = useMemo(() => {
    const today = new Date().setHours(0,0,0,0);
    const todayOrders = orders.filter(o => o.timestamp?.toMillis() > today);
    return {
      revenue: todayOrders.reduce((a, b) => a + (b.totalPrice || 0), 0),
      count: todayOrders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      completed: orders.filter(o => o.status === 'completed').length
    };
  }, [orders]);

  // --- UI RENDER HELPERS ---
  const Modal = ({ isOpen, onClose, title, children, wide = false }) => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
        <div className={`bg-[#141414] border border-white/10 w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300`}>
          <div className="p-8 border-b border-white/5 flex justify-between items-center">
            <h2 className="text-2xl font-black italic text-[#d4af37]">{title}</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
          </div>
          <div className="p-8 max-h-[80vh] overflow-y-auto no-scrollbar">{children}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#d4af37]/30 overflow-x-hidden">
      <style>{customStyles}</style>

      {/* TOP NAVIGATION */}
      <nav className="fixed top-0 inset-x-0 h-20 bg-[#0a0a0a]/80 backdrop-blur-xl z-[400] border-b border-white/5 px-6">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center text-black rotate-3 shadow-lg shadow-[#d4af37]/20">
              <Scissors size={24} />
            </div>
            <div>
              <h1 className="font-black italic text-xl leading-none">{settings.restaurantNameEn}</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d4af37]">{settings.restaurantNameAr}</p>
            </div>
          </div>
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button onClick={() => setView('customer')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'customer' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'text-white/40'}`}>CUSTOMER</button>
            <button onClick={() => setView('owner')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'owner' ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20' : 'text-white/40'}`}>ADMIN</button>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-32">
        {view === 'customer' ? (
          <div className="max-w-6xl mx-auto px-6" dir="rtl">
            {/* HERO SECTION */}
            <div className="relative h-[400px] rounded-[3.5rem] overflow-hidden mb-12 border-8 border-[#141414] shadow-2xl group">
              <img src={settings.headerImage} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-12">
                <div className="bg-[#d4af37] text-black px-5 py-1.5 rounded-full text-[10px] font-black w-fit mb-4 animate-pulse">احجز موعدك الآن ✨</div>
                <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter mb-4">{settings.restaurantNameAr}</h2>
                <div className="flex items-center gap-6 text-white/60 font-bold">
                  <span className="flex items-center gap-2"><MapPin size={18} className="text-[#d4af37]" /> {settings.address}</span>
                  <span className="flex items-center gap-2"><Phone size={18} className="text-[#d4af37]" /> {settings.whatsapp}</span>
                </div>
              </div>
            </div>

            {/* CATEGORY BAR */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-8 sticky top-20 z-[300] bg-[#0a0a0a]/90 backdrop-blur-md py-4">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-8 py-4 rounded-[1.5rem] text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-2 ${activeCategory === cat ? 'bg-[#d4af37] border-[#d4af37] text-black scale-105 shadow-xl shadow-[#d4af37]/20' : 'bg-[#141414] border-white/5 text-white/40 hover:text-white'}`}
                >
                  {cat === 'all' ? 'جميع الخدمات' : cat}
                </button>
              ))}
            </div>

            {/* SERVICES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {menuItems.filter(i => activeCategory === 'all' || i.category === activeCategory).map(item => (
                <div key={item.id} className="barber-card p-6 rounded-[2.5rem] relative group animate-in fade-in slide-in-from-bottom-4">
                  {item.isSpecial && <div className="absolute -top-3 -left-3 bg-[#d4af37] text-black text-[10px] font-black px-4 py-2 rounded-xl z-10 shadow-lg">عرض خاص ✨</div>}
                  <div className="aspect-square rounded-[2rem] overflow-hidden mb-6 bg-black relative">
                    <img src={item.image || "https://images.unsplash.com/photo-1599351473299-d8395e69f16d?q=80&w=600"} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-700" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                      <p className="text-white text-xs font-medium leading-relaxed">{item.description || "خدمة احترافية تليق بمظهرك."}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-black">{item.name}</h3>
                    <span className="text-lg font-black text-[#d4af37] italic">{item.price?.toLocaleString()} {settings.currency}</span>
                  </div>
                  
                  {cart[item.id] ? (
                    <div className="flex items-center justify-between bg-black p-2 rounded-2xl border border-[#d4af37]/30 mt-4">
                      <button onClick={() => updateCart(item.id, -1)} className="w-10 h-10 flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-xl transition-colors"><Minus size={18} /></button>
                      <span className="font-black text-xl">{cart[item.id]}</span>
                      <button onClick={() => updateCart(item.id, 1)} className="w-10 h-10 flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-xl transition-colors"><Plus size={18} /></button>
                    </div>
                  ) : (
                    <button onClick={() => updateCart(item.id, 1)} className="w-full mt-4 py-4 rounded-2xl bg-white/5 text-[#d4af37] font-black text-[10px] uppercase tracking-widest border border-[#d4af37]/20 hover:bg-[#d4af37] hover:text-black transition-all">إضافة للحجز</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* OWNER / ADMIN SECTION */
          <div className="max-w-7xl mx-auto px-6" dir="rtl">
            {!isUnlocked ? (
              <div className="flex items-center justify-center py-32">
                <div className="bg-[#141414] p-12 rounded-[3.5rem] border border-white/5 text-center w-full max-w-md shadow-2xl animate-in zoom-in-95">
                  <div className="w-20 h-20 gold-gradient rounded-[1.5rem] flex items-center justify-center text-black mx-auto mb-8 shadow-xl shadow-[#d4af37]/20"><Settings size={40} /></div>
                  <h2 className="text-4xl font-black italic mb-8">لوحة الإدارة</h2>
                  <input 
                    type="password" 
                    placeholder="كلمة المرور" 
                    className="w-full p-6 bg-black border border-white/10 rounded-3xl text-center text-3xl font-black focus:border-[#d4af37]/50 transition-all outline-none" 
                    onChange={e => e.target.value === OWNER_PASSWORD && setIsUnlocked(true)} 
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                {/* SIDEBAR */}
                <aside className="w-full lg:w-72 space-y-2">
                  {[
                    {id: 'dashboard', icon: LayoutDashboard, label: 'لوحة التحكم'},
                    {id: 'orders', icon: ShoppingBag, label: 'الحجوزات'},
                    {id: 'menu', icon: Package, label: 'الخدمات'},
                    {id: 'reports', icon: PieChart, label: 'التقارير المالية'},
                    {id: 'settings', icon: Settings, label: 'الإعدادات'}
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black italic text-sm ${activeTab === item.id ? 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20 translate-x-[-8px]' : 'text-white/40 hover:bg-white/5'}`}
                    >
                      <item.icon size={20} />
                      {item.label}
                    </button>
                  ))}
                  <button onClick={() => setIsUnlocked(false)} className="w-full flex items-center gap-4 p-5 rounded-2xl text-red-500 font-black italic text-sm hover:bg-red-500/10 mt-10 transition-all"><LogOut size={20} /> خروج</button>
                </aside>

                {/* CONTENT AREA */}
                <div className="flex-1 space-y-8">
                  {/* TAB: DASHBOARD */}
                  {activeTab === 'dashboard' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-[#141414] p-8 rounded-[2.5rem] border border-[#d4af37]/20">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-2">دخل اليوم</p>
                          <h4 className="text-3xl font-black italic text-[#d4af37]">{stats.revenue.toLocaleString()} <span className="text-xs">{settings.currency}</span></h4>
                        </div>
                        <div className="bg-[#141414] p-8 rounded-[2.5rem] border border-white/5">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-2">طلبات اليوم</p>
                          <h4 className="text-3xl font-black italic">{stats.count}</h4>
                        </div>
                        <div className="bg-[#141414] p-8 rounded-[2.5rem] border border-white/5">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-2">حجوزات معلقة</p>
                          <h4 className="text-3xl font-black italic text-orange-500">{stats.pending}</h4>
                        </div>
                        <div className="bg-[#141414] p-8 rounded-[2.5rem] border border-white/5">
                          <p className="text-[10px] font-black text-white/40 uppercase mb-2">حجوزات مكتملة</p>
                          <h4 className="text-3xl font-black italic text-green-500">{stats.completed}</h4>
                        </div>
                      </div>

                      <div className="bg-[#141414] p-8 rounded-[3rem] border border-[#d4af37]/10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-6">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isSystemActive ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-red-500 text-white'}`}>
                            {isSystemActive ? <Play size={32} /> : <Pause size={32} />}
                          </div>
                          <div>
                            <h3 className="text-2xl font-black italic">نظام الاستقبال: {isSystemActive ? 'نشط' : 'متوقف'}</h3>
                            <p className="text-white/40 text-xs font-bold">عند التفعيل، سيقوم النظام بالتنبيه التلقائي للحجوزات الجديدة.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <button onClick={() => setIsSystemActive(!isSystemActive)} className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isSystemActive ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[#d4af37] text-black shadow-lg shadow-[#d4af37]/20'}`}>
                            {isSystemActive ? 'إيقاف النظام' : 'تشغيل النظام'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: ORDERS */}
                  {activeTab === 'orders' && (
                    <div className="bg-[#141414] rounded-[3rem] p-8 border border-white/5 min-h-[600px]">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
                        <h2 className="text-3xl font-black italic">إدارة الحجوزات</h2>
                        <div className="flex bg-black p-1.5 rounded-2xl border border-white/10">
                          {['pending', 'completed', 'all'].map(t => (
                            <button
                              key={t}
                              onClick={() => setOrderFilter(t)}
                              className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all ${orderFilter === t ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/40'}`}
                            >
                              {t === 'pending' ? 'بانتظار الحلاق' : t === 'completed' ? 'تمت بنجاح' : 'الكل'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).map(order => (
                          <div key={order.id} className="bg-black p-6 rounded-[2.5rem] border border-white/5 hover:border-[#d4af37]/30 transition-all group">
                            <div className="flex justify-between items-start mb-4">
                              <span className="bg-white/5 px-3 py-1 rounded-lg text-[10px] font-black text-white/40">#{order.id.slice(-5).toUpperCase()}</span>
                              <div className="text-right">
                                <p className="text-lg font-black text-[#d4af37]">{order.totalPrice.toLocaleString()} {settings.currency}</p>
                                <p className="text-[10px] text-white/20 font-bold">{order.timestamp?.toMillis() ? new Date(order.timestamp.toMillis()).toLocaleTimeString('ar-IQ') : ''}</p>
                              </div>
                            </div>
                            <div className="bg-[#141414] p-4 rounded-2xl mb-4 border border-white/5">
                              <p className="font-black text-white">{order.customer?.name}</p>
                              <p className="text-[#d4af37] text-xs font-bold mb-2">{order.customer?.phone}</p>
                              {order.customer?.address && <p className="text-white/30 text-[10px] italic border-t border-white/5 pt-2 mt-2">{order.customer.address}</p>}
                            </div>
                            <div className="space-y-1 mb-6 max-h-32 overflow-y-auto no-scrollbar">
                              {order.items?.map((it, idx) => (
                                <div key={idx} className="flex justify-between text-xs text-white/60">
                                  <span><span className="text-[#d4af37] font-black">{it.quantity}x</span> {it.name}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handlePrint(order.id, order)} className="p-4 rounded-xl bg-white/5 text-white/40 hover:bg-[#d4af37] hover:text-black transition-all"><Printer size={20} /></button>
                              {order.status === 'pending' ? (
                                <button 
                                  onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), { status: 'completed' })} 
                                  className="flex-1 bg-[#d4af37] text-black rounded-xl font-black text-[10px] uppercase shadow-lg shadow-[#d4af37]/10"
                                >
                                  تأكيد الحجز
                                </button>
                              ) : (
                                <div className="flex-1 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center text-[10px] font-black">مكتمل</div>
                              )}
                              <button onClick={() => window.confirm('مسح الحجز؟') && deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id))} className="p-4 rounded-xl bg-white/5 text-white/20 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB: MENU EDITING */}
                  {activeTab === 'menu' && (
                    <div className="bg-[#141414] rounded-[3rem] p-10 border border-white/5">
                      <div className="flex justify-between items-center mb-10">
                        <h2 className="text-3xl font-black italic">إدارة خدمات الصالون</h2>
                        <button 
                          onClick={() => setEditingItem({ name: "", price: 0, category: "", description: "", isSpecial: false })}
                          className="bg-[#d4af37] text-black px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-[#d4af37]/20 transition-transform active:scale-95"
                        >
                          <Plus size={20} /> إضافة خدمة
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {menuItems.map(item => (
                          <div key={item.id} className="bg-black/50 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group">
                            <div className="flex items-center gap-6">
                              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5">
                                <img src={item.image || "https://images.unsplash.com/photo-1599351473299-d8395e69f16d?q=80&w=200"} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <h4 className="font-black text-lg">{item.name}</h4>
                                <p className="text-[#d4af37] font-black italic">{item.price?.toLocaleString()} {settings.currency}</p>
                                <span className="bg-white/5 text-white/30 text-[9px] px-2 py-0.5 rounded-full uppercase font-black">{item.category}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingItem(item)} className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-[#d4af37] transition-all"><Edit3 size={18} /></button>
                              <button onClick={() => deleteMenuItem(item.id)} className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB: REPORTS */}
                  {activeTab === 'reports' && (
                    <div className="bg-[#141414] rounded-[3rem] p-10 border border-white/5 min-h-[500px]">
                      <h2 className="text-3xl font-black italic mb-10">التقارير المالية</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <h3 className="text-white/40 font-black text-xs uppercase tracking-widest border-b border-white/5 pb-4">أعلى الخدمات طلباً</h3>
                          {menuItems.slice(0, 5).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center text-black font-black italic">{idx + 1}</div>
                                <span className="font-bold">{item.name}</span>
                              </div>
                              <span className="text-white/40 text-xs">{Math.floor(Math.random() * 50) + 10} طلب</span>
                            </div>
                          ))}
                        </div>
                        <div className="bg-black/50 rounded-[2.5rem] p-10 border border-white/5 flex flex-col items-center justify-center text-center">
                          <div className="w-32 h-32 rounded-full border-8 border-[#d4af37] flex items-center justify-center mb-6">
                            <TrendingUp size={48} className="text-[#d4af37]" />
                          </div>
                          <h4 className="text-2xl font-black italic mb-2">معدل النمو الشهري</h4>
                          <p className="text-green-500 font-black text-3xl">+24.5%</p>
                          <p className="text-white/20 text-xs mt-4">بناءً على البيانات المجمعة لآخر 30 يوم</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB: SETTINGS */}
                  {activeTab === 'settings' && (
                    <div className="bg-[#141414] rounded-[3rem] p-10 border border-white/5">
                      <h2 className="text-3xl font-black italic mb-10">إعدادات النظام</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                          <div>
                            <label className="text-[10px] font-black text-white/40 uppercase mb-2 block">اسم الصالون (عربي)</label>
                            <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-2xl outline-none focus:border-[#d4af37]/50 font-bold" value={settings.restaurantNameAr} onChange={e => setSettings({...settings, restaurantNameAr: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-white/40 uppercase mb-2 block">اسم الصالون (EN)</label>
                            <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-2xl outline-none focus:border-[#d4af37]/50 font-bold uppercase" value={settings.restaurantNameEn} onChange={e => setSettings({...settings, restaurantNameEn: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-[10px] font-black text-white/40 uppercase mb-2 block">رقم واتساب</label>
                            <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-2xl outline-none focus:border-[#d4af37]/50 font-bold" value={settings.whatsapp} onChange={e => setSettings({...settings, whatsapp: e.target.value})} />
                          </div>
                          <button onClick={() => updateGlobalSettings(settings)} className="bg-[#d4af37] text-black w-full py-5 rounded-2xl font-black italic tracking-widest shadow-xl shadow-[#d4af37]/10 flex items-center justify-center gap-3"><Save size={20} /> حفظ الإعدادات</button>
                        </div>
                        <div className="space-y-6">
                          <div>
                            <label className="text-[10px] font-black text-white/40 uppercase mb-2 block">رابط صورة الهيدر</label>
                            <input type="text" className="w-full p-5 bg-black border border-white/5 rounded-2xl outline-none focus:border-[#d4af37]/50 font-bold" value={settings.headerImage} onChange={e => setSettings({...settings, headerImage: e.target.value})} />
                          </div>
                          <div className="p-6 bg-black rounded-3xl border border-white/5">
                            <h4 className="font-black italic mb-4">خيارات الطباعة</h4>
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-sm font-bold text-white/60">طباعة تلقائية للحجوزات</span>
                              <button onClick={() => setSettings({...settings, autoPrint: !settings.autoPrint})} className={`w-14 h-8 rounded-full transition-all relative ${settings.autoPrint ? 'bg-[#d4af37]' : 'bg-white/10'}`}>
                                <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${settings.autoPrint ? 'right-7' : 'right-1'}`} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FIXED FOOTER: CUSTOMER CHECKOUT */}
      {view === 'customer' && cartTotal > 0 && (
        <div className="fixed bottom-10 inset-x-0 z-[450] flex justify-center px-6 animate-in slide-in-from-bottom-10">
          <button onClick={() => setIsCheckoutOpen(true)} className="w-full max-w-lg gold-gradient text-black p-6 rounded-[2.5rem] shadow-2xl flex justify-between items-center transition-transform hover:scale-105 active:scale-95 group border-4 border-black/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center font-black text-xl">{Object.keys(cart).length}</div>
              <span className="text-xl font-black italic tracking-tighter">مراجعة طلب الحجز</span>
            </div>
            <span className="text-2xl font-black italic">{cartTotal.toLocaleString()} {settings.currency}</span>
          </button>
        </div>
      )}

      {/* MODAL: CHECKOUT */}
      <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="إرسال طلب الحجز">
        <div className="space-y-6" dir="rtl">
          <div className="p-6 bg-black rounded-3xl border border-white/5 mb-4">
             <h4 className="text-[10px] font-black uppercase text-[#d4af37] mb-3">ملخص الحجز</h4>
             {Object.entries(cart).map(([id, qty]) => {
                const item = menuItems.find(m => m.id === id);
                return <div key={id} className="flex justify-between text-sm py-1"><span>{item?.name} x{qty}</span><span>{(item?.price * qty).toLocaleString()}</span></div>
             })}
          </div>
          <div><label className="text-[10px] font-black uppercase text-white/40 mr-2">الاسم الثلاثي</label><input type="text" className="w-full p-5 bg-black border border-white/10 rounded-3xl outline-none focus:border-[#d4af37]/50 font-bold" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} /></div>
          <div><label className="text-[10px] font-black uppercase text-white/40 mr-2">رقم الهاتف</label><input type="tel" className="w-full p-5 bg-black border border-white/10 rounded-3xl outline-none focus:border-[#d4af37]/50 font-bold" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} /></div>
          <div><label className="text-[10px] font-black uppercase text-white/40 mr-2">موعد مفضل / ملاحظات</label><textarea className="w-full p-5 bg-black border border-white/10 rounded-3xl outline-none focus:border-[#d4af37]/50 font-bold h-24 resize-none" value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})} /></div>
          <div className="pt-6 grid grid-cols-2 gap-4">
            <button onClick={() => submitOrder('whatsapp')} className="bg-[#25D366] text-white p-5 rounded-3xl font-black italic text-lg flex items-center justify-center gap-3 shadow-xl shadow-[#25D366]/20 transition-all hover:scale-[1.02]"><MessageSquare /> واتساب</button>
            <button onClick={() => submitOrder('internal')} className="bg-white text-black p-5 rounded-3xl font-black italic text-lg flex items-center justify-center gap-3 transition-all hover:scale-[1.02]">تأكيد الحجز</button>
          </div>
        </div>
      </Modal>

      {/* MODAL: EDIT MENU ITEM */}
      <Modal isOpen={!!editingItem} onClose={() => setEditingItem(null)} title={editingItem?.id ? "تعديل الخدمة" : "إضافة خدمة جديدة"} wide>
        {editingItem && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8" dir="rtl">
            <div className="space-y-5">
              <div><label className="text-[10px] font-black uppercase text-white/40">اسم الخدمة</label><input type="text" className="w-full p-4 bg-black border border-white/10 rounded-2xl outline-none font-bold" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} /></div>
              <div><label className="text-[10px] font-black uppercase text-white/40">السعر</label><input type="number" className="w-full p-4 bg-black border border-white/10 rounded-2xl outline-none font-bold" value={editingItem.price} onChange={e => setEditingItem({...editingItem, price: parseInt(e.target.value)})} /></div>
              <div><label className="text-[10px] font-black uppercase text-white/40">التصنيف</label><input type="text" className="w-full p-4 bg-black border border-white/10 rounded-2xl outline-none font-bold" value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} /></div>
              <div><label className="text-[10px] font-black uppercase text-white/40">رابط الصورة</label><input type="text" className="w-full p-4 bg-black border border-white/10 rounded-2xl outline-none font-bold text-xs" value={editingItem.image} onChange={e => setEditingItem({...editingItem, image: e.target.value})} /></div>
            </div>
            <div className="space-y-5">
              <div><label className="text-[10px] font-black uppercase text-white/40">الوصف</label><textarea className="w-full p-4 bg-black border border-white/10 rounded-2xl outline-none font-bold h-32 resize-none" value={editingItem.description} onChange={e => setEditingItem({...editingItem, description: e.target.value})} /></div>
              <div className="flex items-center gap-4 bg-black p-4 rounded-2xl border border-white/5">
                <input type="checkbox" checked={editingItem.isSpecial} onChange={e => setEditingItem({...editingItem, isSpecial: e.target.checked})} className="w-6 h-6 accent-[#d4af37]" />
                <span className="font-bold text-sm">عرض خاص (سبيشل)</span>
              </div>
              <button onClick={() => saveMenuItem(editingItem)} className="w-full bg-[#d4af37] text-black py-5 rounded-2xl font-black italic text-lg shadow-xl shadow-[#d4af37]/20 mt-4">حفظ الخدمة</button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: SUCCESS */}
      <Modal isOpen={!!orderSuccess} onClose={() => setOrderSuccess(null)} title="تم بنجاح!">
        <div className="text-center py-6" dir="rtl">
          <div className="w-24 h-24 bg-[#d4af37]/20 text-[#d4af37] rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 animate-bounce"><CheckCircle2 size={56} /></div>
          <h3 className="text-3xl font-black italic mb-4">تم استلام حجزك!</h3>
          <p className="text-white/50 mb-10 font-medium leading-relaxed">شكراً لثقتك بنا. فريق العمل بانتظارك في الموعد المحدد لتقديم أفضل خدمة حلاقة.</p>
          <button onClick={() => setOrderSuccess(null)} className="w-full gold-gradient text-black py-5 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em]">فهمت، شكراً</button>
        </div>
      </Modal>
    </div>
  );
}