import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from "firebase/auth";

/**
 * 🛠️ CONFIGURATION - KEPT EXACTLY AS YOURS
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
const db = getFirestore(app);
const auth = getAuth(app);
const appId = "karbala-barber-pos"; 

// --- THEME CONSTANTS ---
const THEME = {
  primary: "#d4af37", // Luxury Gold
  bg: "#0a0a0a",      // Midnight Black
  card: "#141414",    // Dark Slate
  text: "#ffffff",
  textMuted: "#a0a0a0",
  accent: "#1e1e1e"
};

export default function App() {
  // --- ALL YOUR ORIGINAL STATE LOGIC ---
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("menu");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [tableNumber, setTableNumber] = useState(""); 
  const [showCart, setShowCart] = useState(false);

  // --- AUTH INITIALIZATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Check if user is owner (you can add your logic here)
    });
  }, []);

  // --- REAL-TIME DATA LISTENERS (FIREBASE) ---
  useEffect(() => {
    if (!user) return;
    
    const catsRef = collection(db, 'artifacts', appId, 'public', 'data', 'categories');
    const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'items');
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');

    const unsubCats = onSnapshot(catsRef, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Cats error:", err));

    const unsubItems = onSnapshot(itemsRef, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Items error:", err));

    const unsubOrders = onSnapshot(ordersRef, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Orders error:", err));

    return () => {
      unsubCats();
      unsubItems();
      unsubOrders();
    };
  }, [user]);

  // --- CART LOGIC ---
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const total = useMemo(() => cart.reduce((sum, i) => sum + (i.price * i.qty), 0), [cart]);

  // --- ORDER SUBMISSION ---
  const submitOrder = async () => {
    if (!tableNumber) return alert("Please enter Chair Number");
    if (cart.length === 0) return;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), {
        items: cart,
        total,
        chair: tableNumber,
        status: 'pending',
        timestamp: new Date().toISOString(),
        userId: user.uid
      });
      setCart([]);
      setTableNumber("");
      setShowCart(false);
      alert("Booking Sent Successfully!");
    } catch (err) {
      console.error("Order error:", err);
    }
  };

  // --- UI COMPONENTS (MINIFIED FOR CLEANLINESS BUT FULL POWER) ---
  return (
    <div className="min-h-screen" style={{ backgroundColor: THEME.bg, color: THEME.text, fontFamily: 'inter, sans-serif' }}>
      
      {/* HEADER */}
      <header className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-black/80 backdrop-blur-md z-50">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter" style={{ color: THEME.primary }}>AL-MANSOUR</h1>
          <p className="text-xs text-white/50 uppercase tracking-widest">Premium Grooming Lounge</p>
        </div>
        <button 
          onClick={() => setIsOwner(!isOwner)}
          className="text-[10px] border border-white/20 px-2 py-1 rounded hover:bg-white/10"
        >
          {isOwner ? "CLIENT VIEW" : "OWNER PORTAL"}
        </button>
      </header>

      {isOwner ? (
        /* --- OWNER PANEL (KEPT ALL YOUR LOGIC) --- */
        <div className="p-6 max-w-4xl mx-auto">
          <h2 className="text-xl mb-6">Queue Management</h2>
          <div className="grid gap-4">
            {orders.map(order => (
              <div key={order.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex justify-between items-center">
                <div>
                  <p className="font-bold">Chair #{order.chair}</p>
                  <p className="text-sm text-white/60">{order.items.map(i => i.name).join(", ")}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id), { status: 'completed' })} className="bg-green-600 px-3 py-1 rounded text-xs">Done</button>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.id))} className="bg-red-600 px-3 py-1 rounded text-xs">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* --- CLIENT VIEW (BARBER THEME) --- */
        <main className="p-4 pb-32 max-w-5xl mx-auto">
          
          {/* CATEGORY SLIDER */}
          <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
            <button 
              onClick={() => setSelectedCategory("all")}
              className={`px-5 py-2 rounded-full whitespace-nowrap text-sm transition ${selectedCategory === "all" ? "bg-gold text-black" : "bg-white/5"}`}
              style={{ backgroundColor: selectedCategory === "all" ? THEME.primary : "" }}
            >
              All Services
            </button>
            {categories.map(cat => (
              <button 
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="px-5 py-2 rounded-full bg-white/5 whitespace-nowrap text-sm"
                style={{ backgroundColor: selectedCategory === cat.id ? THEME.primary : "" }}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* SERVICES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {items
              .filter(item => selectedCategory === "all" || item.categoryId === selectedCategory)
              .map(item => (
                <div key={item.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex justify-between items-center group hover:border-gold/50 transition">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{item.name}</h3>
                    <p className="text-sm text-white/40 mb-2">{item.description || "Premium service with expert barbers."}</p>
                    <span className="text-gold font-mono" style={{ color: THEME.primary }}>{item.price.toLocaleString()} IQD</span>
                  </div>
                  <button 
                    onClick={() => addToCart(item)}
                    className="ml-4 w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold hover:text-black transition active:scale-95"
                  >
                    +
                  </button>
                </div>
              ))}
          </div>
        </main>
      )}

      {/* FLOATING ACTION BAR */}
      {!isOwner && cart.length > 0 && (
        <div className="fixed bottom-6 left-6 right-6 max-w-md mx-auto z-50">
          <div className="bg-white text-black p-4 rounded-3xl shadow-2xl flex items-center justify-between">
            <div className="pl-2">
              <p className="text-[10px] uppercase font-bold opacity-50">Total Booking</p>
              <p className="text-xl font-black">{total.toLocaleString()} IQD</p>
            </div>
            <button 
              onClick={() => setShowCart(true)}
              className="bg-black text-white px-8 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition"
            >
              Finish Order ({cart.length})
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCart && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-4">
          <div className="bg-zinc-900 w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Booking Details</h2>
              <button onClick={() => setShowCart(false)} className="text-white/40">Close</button>
            </div>

            <input 
              type="text"
              placeholder="Enter Chair Number (e.g. 3)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl mb-4 focus:border-gold outline-none"
            />

            <div className="space-y-3 mb-8 max-h-48 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center">
                  <span>{item.name} x{item.qty}</span>
                  <div className="flex items-center gap-4">
                    <span>{(item.price * item.qty).toLocaleString()}</span>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-500 text-xs underline">Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={submitOrder}
              className="w-full py-4 rounded-2xl font-bold transition active:scale-95"
              style={{ backgroundColor: THEME.primary, color: '#000' }}
            >
              SEND BOOKING TO BARBER
            </button>
          </div>
        </div>
      )}

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .bg-gold { background-color: ${THEME.primary}; }
        .text-gold { color: ${THEME.primary}; }
        .border-gold { border-color: ${THEME.primary}; }
      `}</style>

    </div>
  );
}