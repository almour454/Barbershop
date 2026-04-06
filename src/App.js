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
 * 🛠️ CONFIGURATION & FIREBASE SETUP (KEPT FROM YOUR ORIGINAL)
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

const OWNER_PASSWORD = "12345";
const PING_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

/**
 * 🎨 LUXURY THEME STYLES
 */
const customStyles = `
  @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
  .animate-shimmer { animation: shimmer 2s infinite; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  
  @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  .animate-float { animation: float 3s ease-in-out infinite; }

  .barber-card {
    background: #141414;
    border: 1px solid rgba(212, 175, 55, 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .barber-card:hover {
    border-color: rgba(212, 175, 55, 0.4);
    box-shadow: 0 20px 40px -20px rgba(212, 175, 55, 0.2);
    transform: translateY(-5px);
  }
  .gold-gradient {
    background: linear-gradient(135deg, #d4af37 0%, #f1d592 100%);
  }
`;

/**
 * 🛒 SHARED COMPONENTS
 */
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95">
        <div className="p-8 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-2xl font-black italic text-[#d4af37]">{title}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // --- CORE STATE (KEPT UNCHANGED) ---
  const [view, setView] = useState("customer");
  const [user, setUser] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({
    restaurantNameAr: "صالون الحلاقة الملكي",
    restaurantNameEn: "ROYAL BARBER SHOP",
    primaryColor: "#d4af37",
    whatsapp: "964780000000",
    headerImage: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=1200",
    isStoreOpen: true,
    currency: "د.ع"
  });

  // --- POS STATE (KEPT UNCHANGED) ---
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [isAutoPrintEnabled, setIsAutoPrintEnabled] = useState(false);
  const [activeOrderTab, setActiveOrderTab] = useState('pending');
  
  // --- CUSTOMER STATE (KEPT UNCHANGED) ---
  const [cart, setCart] = useState({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [customerInfo, setCustomerInfo] = useState({ name: "", phone: "", address: "" });
  const [orderSuccess, setOrderSuccess] = useState(null);

  const audioRef = useRef(new Audio(PING_SOUND_URL));
  const printedIds = useRef(new Set());

  // Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    onAuthStateChanged(auth, setUser);
  }, []);

  // Sync Data
  useEffect(() => {
    if (!user) return;
    const unsubMenu = onSnapshot(getMenuColl(), snap => setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(getSettingsDoc(), snap => snap.exists() && setSettings(s => ({ ...s, ...snap.data() })));
    const q = query(getOrdersColl(), orderBy('timestamp', 'desc'), limit(50));
    const unsubOrders = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      if (isSystemActive) {
        snap.docChanges().forEach(change => {
          if (change.type === "added" && (Date.now() - (change.doc.data().timestamp?.toMillis() || 0)) < 20000) {
            audioRef.current.play().catch(() => {});
            if (isAutoPrintEnabled) handlePrint(change.doc.id, change.doc.data());
          }
        });
      }
    });
    return () => { unsubMenu(); unsubSettings(); unsubOrders(); };
  }, [user, isSystemActive, isAutoPrintEnabled]);

  const cartTotal = useMemo(() => {
    return Object.entries(cart).reduce((acc, [id, qty]) => {
      const item = menuItems.find(m => m.id === id);
      return acc + (item ? item.price * qty : 0);
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

  // --- LOGIC FUNCTIONS (KEPT UNCHANGED) ---
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
    };
    try {
      const docRef = await addDoc(getOrdersColl(), orderData);
      if (target === 'whatsapp' || target === 'both') {
        const itemsList = orderData.items.map(i => `• ${i.name} (${i.quantity}x)`).join('\n');
        const waMsg = `حجز صالون جديد ✂️\n---\nالاسم: ${customerInfo.name}\nالهاتف: ${customerInfo.phone}\nالملاحظات: ${customerInfo.address}\n---\nالخدمات:\n${itemsList}\n---\nالمجموع: ${cartTotal.toLocaleString()} د.ع`;
        window.open(`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(waMsg)}`, '_blank');
      }
      setOrderSuccess(docRef.id);
      setCart({});
      setIsCheckoutOpen(false);
      setCustomerInfo({ name: "", phone: "", address: "" });
    } catch (e) { console.error(e); }
  };

  const handlePrint = (id, data) => {
    printedIds.current.add(id);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const content = `<html dir="rtl"><style>body { font-family: sans-serif; width: 80mm; padding: 4mm; margin: 0; } .center { text-align: center; } .header { border-bottom: 2px dashed #000; padding-bottom: 4mm; margin-bottom: 4mm; } .item { display: flex; justify-content: space-between; margin-bottom: 2mm; font-size: 14px; } .total { border-top: 2px solid #000; padding-top: 2mm; font-weight: bold; font-size: 18px; }</style><body><div class="header center"><h1 style="margin:0;">${settings.restaurantNameAr}</h1><p>رقم الحجز: #${id.slice(-5).toUpperCase()}</p></div><p>الزبون: ${data.customer.name}</p><p>الهاتف: ${data.customer.phone}</p><div style="margin: 5mm 0;">${data.items.map(i => `<div class="item"><span>${i.quantity}x ${i.name}</span><span>${(i.price * i.quantity).toLocaleString()}</span></div>`).join('')}</div><div class="total item"><span>المجموع</span><span>${data.totalPrice.toLocaleString()} د.ع</span></div><p class="center" style="margin-top: 5mm;">شكراً لزيارتكم!</p></body></html>`;
    iframe.contentWindow.document.write(content);
    iframe.contentWindow.document.close();
    setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => document.body.removeChild(iframe), 1000); }, 500);
  };

  const categories = ['all', ...new Set(menuItems.map(i => i.category))].filter(Boolean);
  const filteredMenu = menuItems.filter(i => activeCategory === 'all' || i.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#d4af37]/30 overflow-x-hidden">
      <style>{customStyles}</style>

      {/* NAVBAR */}
      <nav className="fixed top-0 inset-x-0 h-20 bg-[#0a0a0a]/80 backdrop-blur-xl z-[250] border-b border-white/5 px-6">
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
            <button onClick={() => setView('customer')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'customer' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/40'}`}>BOOKING</button>
            <button onClick={() => setView('owner')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${view === 'owner' ? 'bg-[#d4af37] text-black shadow-lg' : 'text-white/40'}`}>PANEL</button>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-32">
        {view === 'customer' ? (
          <div className="max-w-6xl mx-auto px-6" dir="rtl">
            {/* HERO */}
            <div className="relative h-[350px] rounded-[3rem] overflow-hidden mb-12 border-8 border-[#141414] shadow-2xl group">
              <img src={settings.headerImage} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent flex flex-col justify-end p-12">
                <div className="bg-[#d4af37] text-black px-4 py-1 rounded-full text-[10px] font-black w-fit mb-4 animate-bounce">تجربة حلاقة ملكية ✨</div>
                <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter mb-2">{settings.restaurantNameAr}</h2>
                <p className="text-white/60 text-lg font-bold">أرقى أنواع العناية بالرجل في كربلاء المقدسة</p>
              </div>
            </div>

            {/* CATEGORIES */}
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-8 sticky top-20 z-[200] bg-[#0a0a0a]/90 backdrop-blur-md py-4">
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

            {/* GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredMenu.map(item => (
                <div key={item.id} className="barber-card p-6 rounded-[2.5rem] relative group">
                  {item.isSpecial && <div className="absolute -top-3 -left-3 bg-[#d4af37] text-black text-[10px] font-black px-4 py-2 rounded-xl z-10">عرض خاص ✨</div>}
                  <div className="aspect-square rounded-[2rem] overflow-hidden mb-6 bg-black">
                    <img src={item.image || "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600"} className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-700" />
                  </div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-black">{item.name}</h3>
                    <span className="text-lg font-black text-[#d4af37] italic">{item.price.toLocaleString()} {settings.currency}</span>
                  </div>
                  <p className="text-white/40 text-sm mb-6 leading-relaxed h-10 overflow-hidden line-clamp-2">{item.description || "خدمة احترافية للعناية بمظهرك."}</p>
                  
                  {cart[item.id] ? (
                    <div className="flex items-center justify-between bg-black/50 p-2 rounded-2xl border border-[#d4af37]/20">
                      <button onClick={() => updateCart(item.id, -1)} className="w-10 h-10 flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-xl"><Minus size={18} /></button>
                      <span className="font-black text-xl">{cart[item.id]}</span>
                      <button onClick={() => updateCart(item.id, 1)} className="w-10 h-10 flex items-center justify-center text-[#d4af37] hover:bg-white/5 rounded-xl"><Plus size={18} /></button>
                    </div>
                  ) : (
                    <button onClick={() => updateCart(item.id, 1)} className="w-full py-4 rounded-2xl bg-white/5 text-[#d4af37] font-black text-[10px] uppercase tracking-widest border border-[#d4af37]/20 hover:bg-[#d4af37] hover:text-black transition-all">إضافة للحجز</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* POS PANEL */
          <div className="max-w-7xl mx-auto px-6" dir="rtl">
            {!isUnlocked ? (
              <div className="flex items-center justify-center py-32 animate-in zoom-in-95">
                <div className="bg-[#141414] p-12 rounded-[3.5rem] border border-white/5 text-center w-full max-w-md shadow-2xl">
                  <div className="w-20 h-20 gold-gradient rounded-[1.5rem] flex items-center justify-center text-black mx-auto mb-8 animate-float shadow-xl shadow-[#d4af37]/20"><Settings size={40} /></div>
                  <h2 className="text-4xl font-black italic mb-8">لوحة الإدارة</h2>
                  <input type="password" placeholder="كلمة المرور" className="w-full p-6 bg-black border border-white/10 rounded-3xl text-center text-3xl font-black focus:border-[#d4af37]/50 transition-all outline-none" onChange={e => e.target.value === OWNER_PASSWORD && setIsUnlocked(true)} />
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-[#141414] rounded-[2.5rem] p-8 border border-[#d4af37]/20 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-[10px] font-black text-[#d4af37]/60 uppercase tracking-widest mb-2">Print Server</p>
                      <h3 className="text-3xl font-black italic mb-6">{isSystemActive ? 'ONLINE' : 'OFFLINE'}</h3>
                      <div className="flex gap-2">
                        <button onClick={() => { setIsSystemActive(!isSystemActive); setIsAutoPrintEnabled(!isSystemActive); }} className={`flex-1 p-4 rounded-2xl flex items-center justify-center transition-all ${isSystemActive ? 'bg-red-500/20 text-red-500' : 'bg-[#d4af37] text-black'}`}>{isSystemActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</button>
                        <button onClick={() => setIsAutoPrintEnabled(!isAutoPrintEnabled)} className={`flex-1 p-4 rounded-2xl text-[10px] font-black ${isAutoPrintEnabled ? 'bg-green-500/20 text-green-500' : 'bg-white/5 text-white/30'}`}>AUTO: {isAutoPrintEnabled ? 'ON' : 'OFF'}</button>
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-3 bg-[#141414] rounded-[2.5rem] p-8 border border-white/5 shadow-xl grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
                    <div><p className="text-[10px] font-black text-white/40 uppercase mb-1">Pending</p><p className="text-4xl font-black italic text-[#d4af37]">{orders.filter(o => o.status === 'pending').length}</p></div>
                    <div><p className="text-[10px] font-black text-white/40 uppercase mb-1">Today Revenue</p><p className="text-4xl font-black italic">{orders.reduce((a,o) => a + (o.totalPrice || 0), 0).toLocaleString()}</p></div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button onClick={() => setIsUnlocked(false)} className="bg-white/5 p-4 rounded-2xl text-[10px] font-black text-white hover:bg-red-500/20 hover:text-red-500 transition-all">SIGN OUT</button>
                    </div>
                  </div>
                </div>

                <div className="bg-[#141414] rounded-[3rem] p-10 border border-white/5 min-h-[500px]">
                  <div className="flex justify-between items-center mb-12">
                    <h2 className="text-4xl font-black italic">الحجوزات الحالية</h2>
                    <div className="flex bg-black p-1.5 rounded-2xl border border-white/10">
                      {['pending', 'completed', 'all'].map(t => <button key={t} onClick={() => setActiveOrderTab(t)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeOrderTab === t ? 'bg-[#d4af37] text-black' : 'text-white/40'}`}>{t === 'pending' ? 'بانتظار الحلاق' : t === 'completed' ? 'تمت بنجاح' : 'الكل'}</button>)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {orders.filter(o => activeOrderTab === 'all' || o.status === activeOrderTab).map(order => (
                      <div key={order.id} className="bg-black p-8 rounded-[2.5rem] border border-white/5 hover:border-[#d4af37]/30 transition-all group">
                        <div className="flex justify-between items-start mb-6">
                          <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-black text-white/60">#{order.id.slice(-5).toUpperCase()}</span>
                          <span className="text-xl font-black text-[#d4af37] italic">{order.totalPrice.toLocaleString()} {settings.currency}</span>
                        </div>
                        <div className="bg-[#141414] p-5 rounded-2xl mb-6">
                          <p className="font-black text-lg mb-1">{order.customer?.name}</p>
                          <p className="text-[#d4af37] text-xs font-bold mb-3">{order.customer?.phone}</p>
                          <p className="text-white/40 text-[10px] line-clamp-2 italic">{order.customer?.address || "بدون ملاحظات"}</p>
                        </div>
                        <div className="space-y-2 mb-8">
                          {order.items?.map((it, idx) => (
                            <div key={idx} className="flex justify-between text-xs text-white/60"><span><span className="text-[#d4af37] font-black">{it.quantity}x</span> {it.name}</span></div>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handlePrint(order.id, order)} className="p-4 rounded-xl bg-white/5 text-white/40 hover:bg-[#d4af37] hover:text-black transition-all"><Printer size={20} /></button>
                          {order.status === 'pending' ? (
                            <button onClick={() => updateDoc(doc(getOrdersColl(), order.id), { status: 'completed' })} className="flex-1 bg-[#d4af37] text-black rounded-xl font-black text-[10px] uppercase shadow-lg shadow-[#d4af37]/10">تأكيد الحجز</button>
                          ) : (
                            <div className="flex-1 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center text-[10px] font-black uppercase">مكتمل</div>
                          )}
                          <button onClick={() => window.confirm('مسح الحجز؟') && deleteDoc(doc(getOrdersColl(), order.id))} className="p-4 rounded-xl bg-white/5 text-white/20 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER ACTION */}
      {view === 'customer' && cartTotal > 0 && (
        <div className="fixed bottom-10 inset-x-0 z-[280] flex justify-center px-6 animate-in slide-in-from-bottom-10">
          <button onClick={() => setIsCheckoutOpen(true)} className="w-full max-w-lg gold-gradient text-black p-6 rounded-[2.5rem] shadow-2xl flex justify-between items-center transition-transform hover:scale-105 active:scale-95 group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black/10 rounded-2xl flex items-center justify-center font-black text-xl">{Object.keys(cart).length}</div>
              <span className="text-xl font-black italic tracking-tighter">مراجعة طلب الحجز</span>
            </div>
            <span className="text-2xl font-black italic">{cartTotal.toLocaleString()} {settings.currency}</span>
          </button>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      <Modal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} title="إرسال طلب الحجز">
        <div className="space-y-5" dir="rtl">
          <div><label className="text-[10px] font-black uppercase text-white/40 mr-2">الاسم</label><input type="text" className="w-full p-5 bg-black border border-white/10 rounded-3xl outline-none focus:border-[#d4af37]/50 font-bold" value={customerInfo.name} onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} /></div>
          <div><label className="text-[10px] font-black uppercase text-white/40 mr-2">رقم الهاتف</label><input type="tel" className="w-full p-5 bg-black border border-white/10 rounded-3xl outline-none focus:border-[#d4af37]/50 font-bold" value={customerInfo.phone} onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} /></div>
          <div><label className="text-[10px] font-black uppercase text-white/40 mr-2">ملاحظات / موعد</label><textarea className="w-full p-5 bg-black border border-white/10 rounded-3xl outline-none focus:border-[#d4af37]/50 font-bold h-24 resize-none" value={customerInfo.address} onChange={e => setCustomerInfo({...customerInfo, address: e.target.value})} /></div>
          <div className="pt-6 space-y-3">
            <button onClick={() => submitOrder('whatsapp')} className="w-full bg-[#25D366] text-white p-6 rounded-3xl font-black italic text-lg flex items-center justify-center gap-3 shadow-xl shadow-[#25D366]/10">تأكيد عبر واتساب</button>
            <button onClick={() => submitOrder('both')} className="w-full bg-white text-black p-6 rounded-3xl font-black italic text-lg flex items-center justify-center gap-3">إرسال للصالون مباشرة</button>
          </div>
        </div>
      </Modal>

      {/* SUCCESS MODAL */}
      <Modal isOpen={!!orderSuccess} onClose={() => setOrderSuccess(null)} title="تم بنجاح!">
        <div className="text-center py-6" dir="rtl">
          <div className="w-20 h-20 bg-[#d4af37]/20 text-[#d4af37] rounded-3xl flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={48} /></div>
          <h3 className="text-2xl font-black italic mb-4">تم استلام حجزك!</h3>
          <p className="text-white/50 mb-8 font-medium">سيقوم فريق العمل بتجهيز الحلاق المختص لك. يرجى التواجد في الموعد المحدد.</p>
          <button onClick={() => setOrderSuccess(null)} className="w-full gold-gradient text-black py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em]">فهمت، شكراً</button>
        </div>
      </Modal>
    </div>
  );
}