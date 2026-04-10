import React, { useState, useEffect, useMemo } from "react";
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
  runTransaction
} from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword,
  signOut,
  signInWithCustomToken, 
  onAuthStateChanged 
} from "firebase/auth";

/**
 * 🛠️ CONFIGURATION
 * Real keys are set in Vercel environment variables — never hardcode here.
 * For local dev create a .env file with REACT_APP_FIREBASE_* values.
 */
const localConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};

const configFromEnv = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || ""
};

const envFirebaseReady =
  Boolean(configFromEnv.apiKey && configFromEnv.authDomain && configFromEnv.projectId && configFromEnv.appId);

const firebaseConfig =
  typeof window !== "undefined" && window.__firebase_config
    ? JSON.parse(window.__firebase_config)
    : envFirebaseReady
      ? configFromEnv
      : localConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Note: offline handling is done via Firebase error catching, not navigator.onLine

const appId =
  typeof window !== "undefined" && window.__app_id
    ? window.__app_id
    : process.env.REACT_APP_APP_ID || "barber-booking-pro-v1";

// ── FIREBASE PATH HELPERS ──────────────────────────────────────────
// Teaching note: Each helper returns a Firebase reference.
// "public" = anyone can read (services, settings, available slots)
// "private" = only the authenticated owner can read (appointments, revenue)
const getServicesCollection  = () => collection(db, 'artifacts', appId, 'public',  'data', 'services');
const getSettingsDoc         = () => doc(db,        'artifacts', appId, 'public',  'data', 'settings', 'global');
const getOwnerDoc            = () => doc(db,        'artifacts', appId, 'private', 'data', 'admin',    'owner');
const getApptCollection      = (dateStr) => collection(db, 'artifacts', appId, 'private', 'data', 'appointments', dateStr, 'items');
const getApptCounterDoc      = (dateStr) => doc(db, 'artifacts', appId, 'public',  'data', 'counters', dateStr);
const getBlockedSlotsDoc     = (dateStr) => doc(db, 'artifacts', appId, 'public',  'data', 'blocked',  dateStr);
const getDateStr             = () => new Date().toLocaleDateString('en-CA');

// ============================================================
// 🚩 BUNDLE — change one word to switch plans
//
//   "basic"    = WhatsApp only      (400,000 IQD)
//   "premium"  = Full POS Dashboard (500,000 IQD)
//
const BUNDLE = "premium";
// ============================================================

// ============================================================
// 🔒 BRAND LOCK — set to false when setting up a new client
//    true  = name/colors/logo locked (client cannot change)
//    false = everything editable (developer setup mode)
const LOCKED = false;
// ============================================================

// Shorthand used throughout the code — don't touch this line
const FEATURES = {
  dashboard:    BUNDLE === "premium",
  history:      BUNDLE === "premium",
  orderNumbers: BUNDLE === "premium",
  printSlip:    BUNDLE === "premium",
  soundAlert:   BUNDLE === "premium",
};

const PLACEHOLDER = "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=200&auto=format&fit=crop";

const digitsOnly = (raw) => String(raw || "").replace(/\D/g, "");

const contactPhonesList = (s) =>
  [s?.contactPhone1, s?.contactPhone2, s?.contactPhone3]
    .map((x) => (x == null || x === "" ? "" : String(x).trim()))
    .filter((x) => digitsOnly(x).length >= 5);

const toTelHref = (raw) => {
  const d = digitsOnly(raw);
  if (!d) return "#";
  return `tel:+${d}`;
};

export default function App() {
  // ── NAVIGATION ──────────────────────────────────────────────────
  // Teaching: "view" controls which screen shows — customer booking or owner dashboard
  const [view, setView] = useState("customer");
  const [user, setUser] = useState(null);

  // ── SERVICES (replaces menu items) ──────────────────────────────
  // Teaching: Instead of food items, we have barbershop services.
  // Each service has: name, price, duration (minutes), description, image
  const [services, setServices] = useState([]);

  // ── SETTINGS ────────────────────────────────────────────────────
  // Teaching: Same structure as restaurant but barbershop fields.
  // workingHours = array of {day, open, close, closed} for each day of week
  // slotDuration = gap between appointments in minutes
  // bookingDaysAhead = how many days in advance customers can book
  const [settings, setSettings] = useState({
    shopName:        "MY BARBER SHOP",
    shopNameAr:      "صالون الحلاقة",
    primaryColor:    "#D4AF37",
    bgColor:         "#ffffff",
    whatsapp:        "964780000000",
    workingHoursStr: "9:00 AM - 10:00 PM",
    locationDesc:    "كربلاء",
    facebookUrl:     "",
    instagramUrl:    "",
    tiktokUrl:       "",
    contactPhone1:   "",
    contactPhone2:   "",
    slotDuration:    30,       // minutes between slots
    bookingDaysAhead:14,       // how many days ahead customers can book
    offDays:         ["Friday"],// days shop is closed
    bookingNote:     "يرجى الحضور قبل موعدك بـ 5 دقائق.",
    logoUrl:         "",
    dayCloseHour:    23,
    printCopies:     1,
    autoGreyHours:   3,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ── CUSTOMER BOOKING FLOW ────────────────────────────────────────
  // Teaching: Step by step — pick service → pick date → pick slot → enter info → confirm
  const [bookingStep, setBookingStep] = useState(1); // 1=service, 2=datetime, 3=info, 4=confirm
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookedSlots, setBookedSlots] = useState([]); // slots taken on selected date
  const [blockedSlots, setBlockedSlots] = useState([]); // slots blocked by owner
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [confirmedApptNum, setConfirmedApptNum] = useState(null);

  // ── OWNER DASHBOARD ──────────────────────────────────────────────
  // Teaching: Same auth structure as restaurant — reused completely
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [dataError, setDataError] = useState(null);
  const [adminTab, setAdminTab] = useState(FEATURES.dashboard ? "appointments" : "settings");
  const [dashboardDate, setDashboardDate] = useState(getDateStr()); // owner can browse any date
  const [appointments, setAppointments] = useState([]);
  const [weekCounts, setWeekCounts] = useState({}); // { "2026-04-12": 3, ... }
  const [newApptNotif, setNewApptNotif] = useState(null); // { name, date, time }
  const [historyDate, setHistoryDate] = useState("");
  const [historyAppts, setHistoryAppts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [confirmedApptDay, setConfirmedApptDay] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [apptTab, setApptTab] = useState("upcoming"); // "upcoming" | "done" | "noshow"
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(true);
  const [showMidnightWarning, setShowMidnightWarning] = useState(false);
  const [resetUnlocked, setResetUnlocked] = useState(false);
  const [historySearchNum, setHistorySearchNum] = useState("");

  // ── OWNER SERVICES MANAGEMENT ────────────────────────────────────
  const [newService, setNewService] = useState({ name: "", price: "", duration: "30", desc: "", image: "" });
  const [saveStatus, setSaveStatus] = useState("");

  // today's date string "YYYY-MM-DD"
  const todayStr = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "admin") setView("owner");
      else setView("customer");
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (newView) => {
    window.location.hash = newView === "owner" ? "admin" : "";
    setView(newView);
    window.scrollTo(0, 0); 
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = typeof window !== 'undefined' ? window.__initial_auth_token : null;
      try {
        if (auth.currentUser) return;
        if (token) await signInWithCustomToken(auth, token);
        else await signInAnonymously(auth);
      } catch (e) {
        setUser({ uid: 'guest-' + Math.random().toString(36).substr(2, 9) });
      }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const syncOwnerAccess = async () => {
      if (!user || user.isAnonymous) {
        setIsUnlocked(false);
        return;
      }
      try {
        const ownerSnap = await getDoc(getOwnerDoc());
        setIsUnlocked(ownerSnap.exists() && ownerSnap.data().uid === user.uid);
      } catch {
        setIsUnlocked(false);
      }
    };
    syncOwnerAccess();
  }, [user]);

  // ── LOAD SERVICES + SETTINGS FROM FIREBASE ──────────────────────
  // Teaching: Same pattern as restaurant — onSnapshot = live listener.
  // When owner changes a service price, every customer's screen updates instantly.
  useEffect(() => {
    if (!user) return;
    const unsubServices = onSnapshot(getServicesCollection(),
      (snap) => { setServices(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
      (err) => { console.error(err); setDataError("تعذر تحميل الخدمات."); }
    );
    const unsubSettings = onSnapshot(getSettingsDoc(),
      (snap) => {
        if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.data() }));
        setSettingsLoaded(true);
      },
      (err) => { console.error(err); setDataError("تعذر تحميل الإعدادات."); }
    );
    return () => { unsubServices(); unsubSettings(); };
  }, [user]);

  // ── APPOINTMENTS LISTENER (owner only, today) ────────────────────
  // Teaching: Same as restaurant orders listener — only fires when owner is logged in.
  // Plays a sound when a new appointment arrives.
  useEffect(() => {
    if (!isUnlocked) { setAppointments([]); return; }
    const q = query(getApptCollection(dashboardDate), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        const incoming = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAppointments(prev => {
          const prevIds = new Set(prev.map(a => a.id));
          const isNew = incoming.some(a => !prevIds.has(a.id) && a.status === 'upcoming');
          if (isNew && prev.length > 0 && FEATURES.soundAlert && dashboardDate === getDateStr()) {
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              [0, 0.2].forEach(t => {
                const osc = ctx.createOscillator(); const g = ctx.createGain();
                osc.connect(g); g.connect(ctx.destination);
                osc.frequency.value = 660;
                g.gain.setValueAtTime(0.4, ctx.currentTime + t);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
                osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.4);
              });
            } catch {}
          }
          return incoming;
        });
      },
      (err) => {
        console.error("Appt listener error:", err);
        setDataError(`خطأ في تحميل المواعيد: ${err.code || err.message}`);
      }
    );
    return () => unsub();
  }, [isUnlocked, dashboardDate]);

  // ── LOAD WEEK COUNTS (for quick-nav badges) ──────────────────────
  useEffect(() => {
    if (!isUnlocked) return;
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const offDays = settings.offDays || [];
    const dates = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      if (!offDays.includes(dayNames[d.getDay()]))
        dates.push(d.toLocaleDateString('en-CA'));
    }
    const unsubs = dates.map(dateStr => {
      const q = query(getApptCollection(dateStr));
      return onSnapshot(q, snap => {
        const count = snap.docs.filter(d => d.data().status === 'upcoming').length;
        setWeekCounts(prev => ({ ...prev, [dateStr]: count }));
      }, () => {});
    });
    return () => unsubs.forEach(u => u());
  }, [isUnlocked, settings.offDays]);

  // ── NEW APPOINTMENT NOTIFICATION ─────────────────────────────────
  useEffect(() => {
    if (!isUnlocked) return;
    // Listen across ALL dates for new upcoming appointments
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const offDays = settings.offDays || [];
    const unsubs = [];
    let initialized = false;
    const knownIds = new Set();
    for (let i = 0; i <= 14; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      if (offDays.includes(dayNames[d.getDay()])) continue;
      const dateStr = d.toLocaleDateString('en-CA');
      const q = query(getApptCollection(dateStr));
      unsubs.push(onSnapshot(q, snap => {
        if (!initialized) { snap.docs.forEach(d => knownIds.add(d.id)); return; }
        snap.docs.forEach(doc => {
          if (!knownIds.has(doc.id)) {
            knownIds.add(doc.id);
            const a = doc.data();
            if (a.status === 'upcoming') {
              setNewApptNotif({ name: a.customerName, date: dateStr, time: a.timeSlot, service: a.serviceName });
              setTimeout(() => setNewApptNotif(null), 7000);
              // Rich notification ring — ascending ding melody
              try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const notes = [
                  { freq: 523.25, t: 0,    dur: 0.18 }, // C5
                  { freq: 659.25, t: 0.18, dur: 0.18 }, // E5
                  { freq: 783.99, t: 0.36, dur: 0.18 }, // G5
                  { freq: 1046.5, t: 0.54, dur: 0.35 }, // C6 (hold)
                  { freq: 783.99, t: 0.65, dur: 0.12 }, // G5
                  { freq: 1046.5, t: 0.78, dur: 0.5  }, // C6 (final)
                ];
                notes.forEach(({ freq, t, dur }) => {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  const now = ctx.currentTime;
                  osc.type = 'sine';
                  osc.frequency.value = freq;
                  gain.gain.setValueAtTime(0, now + t);
                  gain.gain.linearRampToValueAtTime(0.45, now + t + 0.02);
                  gain.gain.exponentialRampToValueAtTime(0.001, now + t + dur + 0.25);
                  osc.connect(gain); gain.connect(ctx.destination);
                  osc.start(now + t); osc.stop(now + t + dur + 0.3);
                });
              } catch {}
            }
          }
        });
      }, () => {}));
    }
    setTimeout(() => { initialized = true; }, 3000);
    return () => unsubs.forEach(u => u());
  }, [isUnlocked]);
  // Teaching: When customer picks a date, we fetch that day's appointments
  // from Firebase to know which slots are already taken.
  // We also fetch blocked slots (slots owner manually blocked).
  useEffect(() => {
    if (!selectedDate || !user) return;
    const fetchSlots = async () => {
      try {
        const q = query(getApptCollection(selectedDate), orderBy("createdAt", "asc"));
        const snap = await getDocs(q);
        const taken = snap.docs
          .map(d => d.data())
          .filter(a => a.status !== 'cancelled')
          .map(a => a.timeSlot);
        setBookedSlots(taken);
      } catch (e) { console.error(e); }
      try {
        const blockSnap = await getDoc(getBlockedSlotsDoc(selectedDate));
        setBlockedSlots(blockSnap.exists() ? (blockSnap.data().slots || []) : []);
      } catch (e) { console.error(e); }
    };
    fetchSlots();
  }, [selectedDate, user]);

  // ── SLOT GENERATOR ────────────────────────────────────────────────
  // Teaching: This is the brain of the booking system.
  // Given working hours and slot duration, generate all possible time slots.
  // Then filter out: past slots (if today), booked slots, blocked slots.
  const generateSlots = (dateStr) => {
    if (!dateStr) return [];
    const duration = Number(settings.slotDuration) || 30;
    // Parse working hours from "9:00 AM - 10:00 PM"
    const hoursStr = settings.workingHoursStr || "9:00 AM - 10:00 PM";
    const parts = hoursStr.split(' - ');
    const parseTime = (str) => {
      const [time, period] = str.trim().split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + (m || 0);
    };
    const startMin = parseTime(parts[0]);
    const endMin   = parseTime(parts[1] || "22:00");
    const slots = [];
    const now = new Date();
    const isToday = dateStr === todayStr;
    // For today: skip slots that have already started or are within the next slot duration (buffer)
    const bufferMin = isToday ? now.getHours() * 60 + now.getMinutes() + duration : 0;
    for (let m = startMin; m + duration <= endMin; m += duration) {
      if (isToday && m < bufferMin) continue; // skip past + buffer slots
      const h = Math.floor(m / 60);
      const min = m % 60;
      const label = `${h % 12 || 12}:${min.toString().padStart(2,'0')} ${h < 12 ? 'ص' : 'م'}`;
      const val = `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
      if (!bookedSlots.includes(val) && !blockedSlots.includes(val)) {
        slots.push({ label, val });
      }
    }
    return slots;
  };

  // ── AVAILABLE DATES ────────────────────────────────────────────────
  // Teaching: Generate next N days, skip off days (e.g. Friday)
  const availableDates = useMemo(() => {
    const days = [];
    const daysAhead = Number(settings.bookingDaysAhead) || 14;
    const offDays = settings.offDays || [];
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const duration = Number(settings.slotDuration) || 30;
    const now = new Date();
    const hoursStr = settings.workingHoursStr || "9:00 AM - 10:00 PM";
    const parts = hoursStr.split(' - ');
    const parseTime = (str) => {
      const [time, period] = (str||'').trim().split(' ');
      let [h, m] = (time||'0:0').split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + (m || 0);
    };
    const endMin = parseTime(parts[1] || "22:00");

    for (let i = 0; i <= daysAhead; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayName = dayNames[d.getDay()];
      if (offDays.includes(dayName)) continue;
      // For today: only include if at least one future slot still exists
      if (i === 0) {
        const startMin = parseTime(parts[0] || "9:00 AM");
        const bufferMin = now.getHours() * 60 + now.getMinutes() + duration;
        // Check if any slot boundary falls between bufferMin and endMin
        let hasSlot = false;
        for (let s = startMin; s + duration <= endMin; s += duration) {
          if (s >= bufferMin) { hasSlot = true; break; }
        }
        if (!hasSlot) continue;
      }
      days.push({
        str: d.toLocaleDateString('en-CA'),
        label: i === 0 ? 'اليوم' : i === 1 ? 'غداً' :
          d.toLocaleDateString('ar-IQ', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return days;
  }, [settings.bookingDaysAhead, settings.offDays, settings.workingHoursStr, settings.slotDuration, todayStr]);

  // ── BOOK APPOINTMENT ──────────────────────────────────────────────
  // Teaching: Save appointment to Firebase. Uses a transaction to get
  // a unique sequential number for the day — same pattern as restaurant orders.
  const bookAppointment = async () => {
    if (!selectedService || !selectedDate || !selectedSlot || !customerName || !customerPhone) return;
    if (!user) {
      setBookingError('خطأ في المصادقة. أعد تحميل الصفحة وحاول مجدداً.');
      return;
    }
    setBookingSubmitting(true);
    setBookingError(null);
    try {
      const counterRef = getApptCounterDoc(selectedDate);
      let apptNumber = 1;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        apptNumber = snap.exists() ? (snap.data().count || 0) + 1 : 1;
        tx.set(counterRef, { count: apptNumber }, { merge: true });
      });
      await addDoc(getApptCollection(selectedDate), {
        apptNumber,
        customerName,
        customerPhone,
        serviceId:    selectedService.id,
        serviceName:  selectedService.name,
        servicePrice: selectedService.price,
        duration:     selectedService.duration,
        timeSlot:     selectedSlot,
        dateStr:      selectedDate,
        status:       'upcoming',
        createdAt:    new Date().toISOString(),
      });
      setConfirmedApptNum(apptNumber);
      setBookingStep(1);
      setSelectedService(null);
      setSelectedDate('');
      setSelectedSlot('');
      setCustomerName('');
      setCustomerPhone('');
    } catch (e) {
      console.error('Booking error:', e);
      const msg = e?.code === 'permission-denied'
        ? 'خطأ في الصلاحيات (permission-denied). تحقق من Firebase Rules.'
        : e?.message
          ? `فشل الحجز: ${e.message}`
          : 'فشل الحجز. تحقق من الاتصال وأعد المحاولة.';
      setBookingError(msg);
    }
    setBookingSubmitting(false);
  };

  // ── OWNER: UPDATE APPOINTMENT STATUS ─────────────────────────────
  const updateApptStatus = async (appt, status) => {
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'private', 'data', 'appointments', appt.dateStr, 'items', appt.id),
        { status }
      );
    } catch (e) { console.error(e); }
  };

  // ── OWNER: DELETE APPOINTMENT ─────────────────────────────────────
  const deleteAppt = async (appt) => {
    if (!window.confirm(`حذف موعد #${appt.apptNumber} للزبون ${appt.customerName}؟`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'private', 'data', 'appointments', appt.dateStr, 'items', appt.id));
    } catch (e) { console.error(e); }
  };

  // ── OWNER: BLOCK / UNBLOCK A TIME SLOT ───────────────────────────
  // Teaching: Owner can tap a slot on the calendar to block it (lunch, break, etc.)
  // Stored as an array of "HH:MM" strings in a doc per date.
  const toggleBlockSlot = async (dateStr, slotVal) => {
    const ref = getBlockedSlotsDoc(dateStr);
    try {
      const snap = await getDoc(ref);
      const current = snap.exists() ? (snap.data().slots || []) : [];
      const updated = current.includes(slotVal)
        ? current.filter(s => s !== slotVal)
        : [...current, slotVal];
      await setDoc(ref, { slots: updated }, { merge: true });
      setBlockedSlots(updated);
    } catch (e) { console.error(e); }
  };

  // ── OWNER: LOAD HISTORY ───────────────────────────────────────────
  const loadHistoryAppts = async (dateStr) => {
    setHistoryLoading(true); setHistoryAppts([]);
    try {
      const q = query(getApptCollection(dateStr), orderBy("timeSlot", "asc"));
      const snap = await getDocs(q);
      setHistoryAppts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setHistoryLoading(false);
  };

  // ── OWNER: HANDLE AUTH ────────────────────────────────────────────
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!ownerEmail.trim() || !ownerPassword) return;
    setAuthError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, ownerEmail.trim(), ownerPassword);
      const ownerRef = getOwnerDoc();
      const ownerSnap = await getDoc(ownerRef);
      if (!ownerSnap.exists()) {
        await setDoc(ownerRef, { uid: cred.user.uid, email: cred.user.email || ownerEmail.trim(), createdAt: new Date().toISOString() }, { merge: true });
      } else if (ownerSnap.data().uid !== cred.user.uid) {
        await signOut(auth); await signInAnonymously(auth);
        setAuthError('هذا الحساب ليس مالك النظام.'); setIsUnlocked(false); return;
      }
      setIsUnlocked(true); setOwnerPassword('');
    } catch { setAuthError('فشل تسجيل الدخول. تحقق من الإيميل وكلمة المرور.'); }
  };

  const handleOwnerLogout = async () => {
    setIsUnlocked(false); setOwnerPassword('');
    try { await signOut(auth); await signInAnonymously(auth); } catch (e) { console.error(e); }
    navigateTo('customer');
  };

  // ── OWNER: MANAGE SERVICES ────────────────────────────────────────
  const updateGlobalSettings = async (field, value) => {
    if (!user) return;
    await setDoc(getSettingsDoc(), { [field]: value }, { merge: true });
  };

  const handleAddService = async () => {
    if (!newService.name || !newService.price) return;
    const id = newService.id || 'svc_' + Date.now();
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'services', id), {
        ...newService, id,
        price: Number(newService.price) || 0,
        duration: Number(newService.duration) || 30,
        createdAt: new Date().toISOString()
      });
      setNewService({ name: '', price: '', duration: '30', desc: '', image: '' });
      setSaveStatus('تم الحفظ ✅'); setTimeout(() => setSaveStatus(''), 2500);
    } catch { setSaveStatus('خطأ ❌'); }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('حذف هذه الخدمة؟')) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'services', id));
  };

  // ── PRINT APPOINTMENT RECEIPT ─────────────────────────────────────
  const printApptReceipt = (appt) => {
    const win = window.open('', '_blank', 'width=260,height=500');
    if (!win) return;
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const fmtTime = (val) => { if(!val) return ''; const [h,m]=val.split(':').map(Number); return `${h%12||12}:${m.toString().padStart(2,'0')} ${h<12?'ص':'م'}`; };
    win.document.write(`<html><head><meta charset="utf-8"/>
      <style>
        @page{size:58mm auto;margin:3mm}
        *{box-sizing:border-box}
        body{font-family:'Arial',sans-serif;direction:rtl;font-size:11px;width:52mm;margin:0 auto;padding:0;color:#111}
        .shop{font-size:15px;font-weight:900;text-align:center;margin:0;letter-spacing:1px}
        .shop-ar{font-size:11px;text-align:center;color:#555;margin:1mm 0 2mm}
        .scissors{text-align:center;font-size:18px;margin:1mm 0;letter-spacing:6px}
        .num-box{border:2px solid #111;border-radius:4px;margin:2mm auto;width:32mm;text-align:center;padding:1mm}
        .num-label{font-size:8px;color:#555;text-transform:uppercase;letter-spacing:1px}
        .num{font-size:28px;font-weight:900;line-height:1}
        hr{border:none;border-top:1px dashed #aaa;margin:2mm 0}
        .row{display:flex;justify-content:space-between;align-items:center;padding:1.2mm 0;border-bottom:1px dotted #ddd;font-size:10px}
        .row:last-child{border-bottom:none}
        .lbl{color:#666}
        .val{font-weight:700;text-align:left}
        .price-row{display:flex;justify-content:space-between;align-items:center;margin:2mm 0;padding:2mm;background:#f5f5f5;border-radius:3px}
        .price-lbl{font-size:10px;font-weight:700}
        .price-val{font-size:16px;font-weight:900}
        .footer{text-align:center;margin-top:3mm;font-size:9px;color:#666;line-height:1.6}
        .thank{font-size:11px;font-weight:900;color:#111;text-align:center;margin:2mm 0}
        @media print{body{width:52mm}html{width:58mm}}
      </style></head><body>
      <p class="shop">${esc(settings.shopName)}</p>
      <p class="shop-ar">${esc(settings.shopNameAr)}</p>
      <div class="scissors">✂ ✂ ✂</div>
      <hr/>
      <div class="num-box">
        <div class="num-label">رقم الموعد</div>
        <div class="num">#${appt.apptNumber || '—'}</div>
      </div>
      <hr/>
      <div class="row"><span class="lbl">الاسم</span><span class="val">${esc(appt.customerName)}</span></div>
      <div class="row"><span class="lbl">الهاتف</span><span class="val" dir="ltr">${esc(appt.customerPhone)}</span></div>
      <div class="row"><span class="lbl">الخدمة</span><span class="val">${esc(appt.serviceName)}</span></div>
      <div class="row"><span class="lbl">المدة</span><span class="val">${appt.duration} دقيقة</span></div>
      <div class="row"><span class="lbl">التاريخ</span><span class="val" dir="ltr">${appt.dateStr}</span></div>
      <div class="row"><span class="lbl">الوقت</span><span class="val">${fmtTime(appt.timeSlot)}</span></div>
      <hr/>
      <div class="price-row">
        <span class="price-lbl">المبلغ الإجمالي</span>
        <span class="price-val">${(appt.servicePrice||0).toLocaleString()} د.ع</span>
      </div>
      <hr/>
      <p class="thank">شكراً لزيارتك! 💈</p>
      <div class="footer">
        ${settings.locationDesc ? `📍 ${esc(settings.locationDesc)}<br/>` : ''}
        ${settings.workingHoursStr ? `🕐 ${esc(settings.workingHoursStr)}` : ''}
      </div>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>`);
    win.document.close();
  };

  // ── SPLIT APPOINTMENTS ────────────────────────────────────────────
  const upcomingAppts = appointments.filter(a => a.status === 'upcoming');
  const doneAppts     = appointments.filter(a => a.status === 'done' || a.status === 'noshow');
  const todayRevenue  = doneAppts.filter(a => a.status === 'done').reduce((s,a) => s + (a.servicePrice||0), 0);

  // ── TIME FORMAT HELPER ────────────────────────────────────────────
  const fmtSlot = (val) => {
    if (!val) return '';
    const [h, m] = val.split(':').map(Number);
    return `${h%12||12}:${m.toString().padStart(2,'0')} ${h<12?'ص':'م'}`;
  };

  return (
    <div className="min-h-screen barber-bg" style={{ fontFamily: 'sans-serif' }}>
      <div className="barber-orb barber-orb-1" />
      <div className="barber-orb barber-orb-2" />

      {/* ── NAVIGATION ── */}
      <div className="flex justify-center p-4 pt-6">
        <div className="flex barber-nav p-1 rounded-full">
          <button onClick={() => navigateTo("customer")}
            className={`px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view==='customer'?'barber-nav-active':'hover:opacity-80'}`}
            style={view==='customer'?{}:{color:'rgba(212,175,55,0.6)'}}>
            حجز موعد
          </button>
          <button onClick={() => navigateTo("owner")}
            className={`px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${view==='owner'?'bg-white/10 shadow-lg':'hover:opacity-80'}`}
            style={{color: view==='owner' ? 'var(--gold)' : 'rgba(212,175,55,0.5)'}}>
            الإدارة
          </button>
        </div>
      </div>

      {dataError && (
        <div className="px-4 pb-2 max-w-xl mx-auto" dir="rtl">
          <div className="bg-red-500/15 border border-red-500/35 text-red-400 rounded-2xl px-4 py-3 text-xs font-bold text-center">{dataError}</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          OWNER PANEL
      ══════════════════════════════════════════════════════════════ */}
      {view === "owner" ? (
        !isUnlocked ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] p-6">
            <form onSubmit={handleAuthSubmit} className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] w-full max-w-sm text-center shadow-2xl">
              <div className="text-5xl mb-6">💈</div>
              <h2 className="text-white text-2xl font-black italic uppercase mb-6">دخول الإدارة</h2>
              <input type="email" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)}
                className={`w-full bg-black border ${authError?'border-red-500':'border-white/10'} p-4 rounded-2xl text-white text-right outline-none focus:border-blue-500 text-sm font-bold mb-3`}
                placeholder="Owner Email" />
              <input type="password" value={ownerPassword} onChange={e=>setOwnerPassword(e.target.value)}
                className={`w-full bg-black border ${authError?'border-red-500 animate-shake':'border-white/10'} p-4 rounded-2xl text-white text-right outline-none focus:border-blue-500 text-sm font-bold`}
                placeholder="كلمة المرور" />
              {authError && <p className="mt-3 text-red-400 text-xs font-bold">{authError}</p>}
              <button type="submit" className="w-full mt-6 py-5 text-white font-black rounded-2xl text-[12px] uppercase tracking-widest shadow-xl transition-transform active:scale-95" style={{backgroundColor:settings.primaryColor}}>دخول</button>
            </form>
          </div>
        ) : (
          <div className="owner-panel max-w-4xl mx-auto p-6 pb-40 space-y-6" dir="rtl">

            {/* 🔔 NEW APPOINTMENT NOTIFICATION TOAST */}
            {newApptNotif && (
              <div className="fixed inset-x-0 top-4 z-[9999] flex justify-center px-4 animate-slide-up pointer-events-none">
                <div className="pointer-events-auto w-full max-w-sm bg-green-900 border-2 border-green-400 rounded-3xl p-5 shadow-2xl" dir="rtl"
                  style={{boxShadow:'0 8px 40px rgba(34,197,94,0.35)'}}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl shrink-0 animate-pulse">🔔</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-green-300 font-black text-xs uppercase tracking-widest mb-0.5">موعد جديد!</p>
                      <p className="text-white font-black text-base leading-tight truncate">{newApptNotif.name}</p>
                      <p className="text-green-200 text-[12px] font-bold">{newApptNotif.service} · {fmtSlot(newApptNotif.time)}</p>
                      <p className="text-green-400/70 text-[11px] font-bold">{newApptNotif.date}</p>
                    </div>
                    <button onClick={()=>setNewApptNotif(null)}
                      className="shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-sm">✕</button>
                  </div>
                </div>
              </div>
            )}


            {/* Tab bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex bg-black/80 backdrop-blur-md p-1 rounded-2xl gap-1 flex-wrap">
                {FEATURES.dashboard && (
                  <button onClick={()=>setAdminTab("appointments")}
                    className={`relative px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all flex items-center gap-2 ${adminTab==='appointments'?'text-white shadow-lg':'text-slate-400 hover:text-white'}`}
                    style={adminTab==='appointments'?{backgroundColor:settings.primaryColor}:{}}>
                    المواعيد
                    {upcomingAppts.length > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-pulse shrink-0">{upcomingAppts.length}</span>
                    )}
                  </button>
                )}
                {FEATURES.history && (
                  <button onClick={()=>{setAdminTab("history");setHistoryDate("");setHistoryAppts([]);}}
                    className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${adminTab==='history'?'bg-white text-black shadow-lg':'text-slate-400 hover:text-white'}`}>
                    السجل 📅
                  </button>
                )}
                <button onClick={()=>setAdminTab("settings")}
                  className={`px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${adminTab==='settings'?'bg-white text-black shadow-lg':'text-slate-400 hover:text-white'}`}>
                  الإعدادات
                </button>
              </div>
              <button onClick={handleOwnerLogout}
                className="bg-black text-white px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-white hover:text-black border border-white/20 transition-colors shrink-0">
                خروج
              </button>
            </div>

            {/* ── APPOINTMENTS TAB ── */}
            {FEATURES.dashboard && adminTab === "appointments" && (
              <div className="space-y-4">

                {/* Week quick-nav */}
                <div className="bg-slate-900 rounded-2xl p-4 border border-white/5 space-y-3">
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {(()=>{
                      const dayNames=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                      const arLabels={Sunday:'الأحد',Monday:'الاثنين',Tuesday:'الثلاثاء',Wednesday:'الأربعاء',Thursday:'الخميس',Friday:'الجمعة',Saturday:'السبت'};
                      const offDays=settings.offDays||[];
                      const pills=[];
                      for(let i=0;i<=7;i++){
                        const d=new Date(); d.setDate(d.getDate()+i);
                        const dayName=dayNames[d.getDay()];
                        if(offDays.includes(dayName)) continue;
                        const str=d.toLocaleDateString('en-CA');
                        const label=i===0?'اليوم':i===1?'غداً':arLabels[dayName];
                        const count=weekCounts[str]||0;
                        const active=dashboardDate===str;
                        pills.push(
                          <button key={str} onClick={()=>setDashboardDate(str)}
                            className={`shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl font-black text-[11px] transition-all border relative ${active?'text-white border-amber-500/60 bg-amber-500/20':'bg-black/30 text-white/50 border-white/10 hover:border-white/25'}`}>
                            {count>0 && (
                              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow-lg">{count}</span>
                            )}
                            <span>{label}</span>
                            <span className="text-[9px] opacity-60">{d.toLocaleDateString('ar-IQ',{day:'numeric',month:'short'})}</span>
                          </button>
                        );
                      }
                      return pills;
                    })()}
                  </div>
                  <div className="flex gap-2">
                    <input type="date" value={dashboardDate} onChange={e=>setDashboardDate(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/10 p-2.5 rounded-xl text-white text-sm font-bold outline-none focus:border-amber-500" />
                    <button onClick={()=>setDashboardDate(getDateStr())}
                      className="shrink-0 px-3 py-2 rounded-xl text-[11px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                      اليوم
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: dashboardDate === getDateStr() ? "مواعيد اليوم" : "مواعيد " + dashboardDate, value: appointments.length, color: "text-white" },
                    { label: "قادمة",         value: upcomingAppts.length,    color: "text-yellow-400" },
                    { label: "الإيرادات",     value: todayRevenue.toLocaleString() + " د.ع", color: "text-green-400" },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-900 rounded-2xl p-4 border border-white/5 text-center">
                      <p className={`font-black text-base leading-tight ${s.color}`}>{s.value}</p>
                      <p className="text-white/30 text-[9px] font-bold mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Sub-tabs */}
                <div className="flex gap-2">
                  <button onClick={()=>setApptTab("upcoming")}
                    className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${apptTab==='upcoming'?'text-white shadow-lg':'bg-slate-800 text-slate-400'}`}
                    style={apptTab==='upcoming'?{backgroundColor:settings.primaryColor}:{}}>
                    قادمة
                    {upcomingAppts.length > 0 && (
                      <span className="bg-red-500 text-white text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center animate-pulse">{upcomingAppts.length}</span>
                    )}
                  </button>
                  <button onClick={()=>setApptTab("done")}
                    className={`flex-1 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wide transition-all ${apptTab==='done'?'bg-green-600 text-white shadow-lg':'bg-slate-800 text-slate-400'}`}>
                    منجزة ✓ ({appointments.filter(a=>a.status==='done').length})
                  </button>
                </div>

                {/* Report + Print */}
                <div className="flex gap-2">
                  <button onClick={()=>setShowReport(r=>!r)}
                    disabled={!doneAppts.length}
                    className={`flex-1 py-3 rounded-2xl font-black text-[11px] uppercase tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 border ${doneAppts.length?'bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30':'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'}`}>
                    📊 {showReport ? 'إخفاء التقرير' : 'تقرير اليوم'}
                  </button>
                  {doneAppts.length > 0 && (
                    <button onClick={()=>{
                      const win=window.open('','_blank','width=240,height=500');
                      win.document.write(`<html><head><meta charset="utf-8"/><style>@page{size:58mm auto;margin:2mm}body{font-family:'Courier New',monospace;direction:rtl;font-size:10px;width:54mm;margin:0}h2{font-size:12px;font-weight:900;text-align:center;margin:0 0 1mm}hr{border:none;border-top:1px dashed #333;margin:2mm 0}.row{display:flex;justify-content:space-between;padding:1mm 0;font-size:9px}.big{font-size:18px;font-weight:900;text-align:center;margin:2mm 0}.sign{border-bottom:1px solid #333;height:6mm;margin-top:1mm}@media print{body{width:54mm}}</style></head><body>
                      <h2>${settings.shopName}</h2><div style="text-align:center;font-size:8px">${todayStr}</div><hr/>
                      <div class="big">${todayRevenue.toLocaleString()} د.ع</div><div style="text-align:center;font-size:8px;color:#555">إجمالي الإيرادات</div>
                      <div class="row" style="margin-top:2mm"><span>عدد المواعيد:</span><span>${doneAppts.length}</span></div>
                      <div class="row"><span>متوسط الموعد:</span><span>${doneAppts.length?Math.round(todayRevenue/doneAppts.length).toLocaleString():0} د.ع</span></div><hr/>
                      ${doneAppts.map(a=>`<div class="row"><span>#${a.apptNumber} ${a.customerName}</span><span>${fmtSlot(a.timeSlot)}</span></div>`).join('')}<hr/>
                      <div>المبلغ الفعلي المعدود:</div><div class="sign"></div>
                      <div style="height:4mm"></div><div>توقيع المدير:</div><div class="sign"></div>
                      <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
                      win.document.close();
                    }}
                      className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/50 hover:text-amber-400 hover:border-amber-500/30 font-black text-[11px] transition-all active:scale-95">
                      🖨️
                    </button>
                  )}
                </div>

                {/* Inline report card */}
                {showReport && doneAppts.length > 0 && (
                  <div className="bg-slate-900 rounded-[2rem] border border-amber-500/30 p-6 space-y-4">
                    <div className="text-center border-b border-white/10 pb-4">
                      <p className="text-amber-400 font-black text-[11px] uppercase tracking-widest mb-1">تقرير اليوم</p>
                      <p className="text-white font-black text-2xl">{todayRevenue.toLocaleString()} <span className="text-sm">د.ع</span></p>
                      <p className="text-white/30 text-[10px] font-bold mt-1">{todayStr}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {label:"مواعيد منجزة", value:doneAppts.length},
                        {label:"متوسط الموعد", value:(doneAppts.length?Math.round(todayRevenue/doneAppts.length):0).toLocaleString()+" د.ع"},
                        {label:"بالصندوق", value:todayRevenue.toLocaleString()+" د.ع"},
                      ].map(s=>(
                        <div key={s.label} className="bg-black/30 rounded-2xl p-3 text-center">
                          <p className="text-white font-black text-sm leading-tight">{s.value}</p>
                          <p className="text-white/30 text-[9px] font-bold mt-1">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Top services */}
                    <div className="bg-black/30 rounded-2xl p-4">
                      <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-3">الخدمات الأكثر طلباً</p>
                      {Object.entries(doneAppts.reduce((acc,a)=>{acc[a.serviceName]=(acc[a.serviceName]||0)+1;return acc;},{}))
                        .sort((a,b)=>b[1]-a[1]).slice(0,4)
                        .map(([name,count])=>(
                          <div key={name} className="flex justify-between items-center mb-1.5">
                            <span className="text-white text-[11px] font-bold">{name}</span>
                            <span className="text-white/50 text-[11px] font-black">{count} مرة</span>
                          </div>
                        ))}
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4">
                      <p className="text-amber-300/80 text-[10px] font-black uppercase tracking-widest mb-2">المبلغ الفعلي المعدود</p>
                      <div className="border-b-2 border-dashed border-amber-500/30 h-8" />
                    </div>
                  </div>
                )}

                {/* Appointment cards */}
                {apptTab === "upcoming" && (
                  <div className="space-y-4">
                    {upcomingAppts.length === 0 && (
                      <div className="bg-slate-900 rounded-[2rem] p-14 text-center border border-white/5">
                        <div className="text-5xl mb-4">📭</div>
                        <p className="text-white/40 font-black text-sm">لا توجد مواعيد قادمة اليوم</p>
                      </div>
                    )}
                    {upcomingAppts.map(appt => (
                      <div key={appt.id} className="bg-slate-900 rounded-[2rem] p-6 border border-yellow-500/40 shadow-yellow-500/10 shadow-xl">
                        <div className="flex justify-between items-start gap-3 mb-4">
                          <div className="flex items-start gap-3">
                            {FEATURES.orderNumbers && (
                              <div className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white" style={{backgroundColor:settings.primaryColor}}>
                                #{appt.apptNumber||'?'}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="bg-yellow-500 text-white text-[9px] font-black px-3 py-1 rounded-full">قادم 🔔</span>
                                <span className="text-white/50 font-black text-sm" dir="ltr">{fmtSlot(appt.timeSlot)}</span>
                              </div>
                              <p className="text-white font-black text-base">{appt.customerName}</p>
                              <p className="text-white/50 text-[11px] font-bold" dir="ltr">{appt.customerPhone}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-2">
                            <p className="text-xl font-black" style={{color:settings.primaryColor}}>{(appt.servicePrice||0).toLocaleString()} <span className="text-[10px]">د.ع</span></p>
                            {FEATURES.printSlip && (
                              <button onClick={()=>printApptReceipt(appt)}
                                className="text-[10px] font-black text-white/40 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl transition-all">
                                🖨️ طباعة
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="bg-black/30 rounded-2xl px-4 py-3 mb-4 flex justify-between items-center">
                          <span className="text-white/60 text-[11px] font-bold">✂️ {appt.serviceName}</span>
                          <span className="text-white/40 text-[10px] font-bold">{appt.duration} دقيقة</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>updateApptStatus(appt,'done')}
                            className="flex-1 py-3 rounded-2xl text-white font-black text-[11px] uppercase tracking-wide active:scale-95 transition-all"
                            style={{backgroundColor:settings.primaryColor}}>
                            ✅ منجز
                          </button>
                          <a href={`https://wa.me/${digitsOnly(appt.customerPhone)}?text=${encodeURIComponent(`مرحباً ${appt.customerName}، موعدك عندنا اليوم ${fmtSlot(appt.timeSlot)} 💈`)}`}
                            target="_blank" rel="noreferrer"
                            className="px-4 py-3 rounded-2xl bg-[#25D366]/20 text-[#25D366] font-black text-[11px] flex items-center justify-center hover:bg-[#25D366]/30 transition-all shrink-0">
                            💬
                          </a>
                          <button onClick={()=>deleteAppt(appt)}
                            className="px-4 py-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white font-black text-[10px] transition-all">
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {apptTab === "done" && (
                  <div className="space-y-3">
                    {appointments.filter(a=>a.status==='done').length === 0 && (
                      <div className="bg-slate-900 rounded-[2rem] p-12 text-center border border-white/5">
                        <p className="text-white/40 font-black text-sm">لا توجد مواعيد منجزة بعد</p>
                      </div>
                    )}
                    {appointments.filter(a=>a.status==='done').map(appt => (
                      <div key={appt.id} className="bg-slate-900 rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {FEATURES.orderNumbers && (
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base text-white bg-green-600 shrink-0">#{appt.apptNumber}</div>
                          )}
                          <div>
                            <p className="text-white font-black text-sm">{appt.customerName}</p>
                            <p className="text-white/40 text-[10px] font-bold">{appt.serviceName} — {fmtSlot(appt.timeSlot)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-green-400 font-black text-sm">{(appt.servicePrice||0).toLocaleString()} د.ع</p>
                          <button onClick={()=>deleteAppt(appt)} className="px-2 py-1.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white font-black text-[10px] transition-all">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tiny reset */}
                <div className="flex items-center justify-end gap-2 pt-1 opacity-30 hover:opacity-80 transition-opacity">
                  <span className="text-[9px] text-white/30 font-bold">إعادة العداد من #1</span>
                  {!resetUnlocked ? (
                    <button onClick={()=>setResetUnlocked(true)} className="text-[9px] font-black text-white/20 hover:text-white/50 bg-white/5 px-2 py-1 rounded-lg transition-all">🔒 فتح</button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={async()=>{
                        if(!window.confirm('إعادة عداد المواعيد من #1؟')) return;
                        try{await deleteDoc(getApptCounterDoc(todayStr));}catch(e){console.error(e);}
                        setResetUnlocked(false);
                      }} className="text-[9px] font-black text-red-400/70 hover:text-red-400 bg-red-500/10 px-2 py-1 rounded-lg transition-all">إعادة</button>
                      <button onClick={()=>setResetUnlocked(false)} className="text-[9px] font-black text-white/20 hover:text-white/40 bg-white/5 px-2 py-1 rounded-lg transition-all">🔒</button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {FEATURES.history && adminTab === "history" && (
              <div className="space-y-4">
                <h3 className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em]">سجل المواعيد السابقة 📅</h3>
                <div className="bg-slate-900 rounded-[2rem] p-6 border border-white/5">
                  <p className="text-white/50 text-[11px] font-bold mb-3">اختر يوماً</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3">
                    {Array.from({length:7},(_,i)=>{
                      const d=new Date(); d.setDate(d.getDate()-i);
                      const str=d.toLocaleDateString('en-CA');
                      const label=i===0?'اليوم':i===1?'أمس':d.toLocaleDateString('ar-IQ',{weekday:'short'});
                      const active=historyDate===str;
                      return(
                        <button key={str} onClick={()=>{setHistoryDate(str);loadHistoryAppts(str);}}
                          className={`shrink-0 px-4 py-2.5 rounded-xl text-[11px] font-black transition-all border ${active?'text-white border-transparent':'bg-black/30 text-white/40 border-white/10 hover:border-white/20'}`}
                          style={active?{backgroundColor:settings.primaryColor}:{}}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input type="date" max={todayStr} value={historyDate}
                      onChange={e=>{setHistoryDate(e.target.value);if(e.target.value)loadHistoryAppts(e.target.value);}}
                      className="flex-1 bg-black/50 border border-white/10 p-3 rounded-xl text-white/50 text-sm font-bold outline-none focus:border-orange-500" />
                    {historyDate&&<button onClick={()=>{setHistoryDate("");setHistoryAppts([]);}} className="px-4 rounded-xl bg-white/5 text-white/40 hover:text-white font-black text-sm transition-all">✕</button>}
                  </div>
                </div>
                {historyLoading && <div className="text-center py-8"><div className="text-3xl animate-pulse">⏳</div></div>}
                {!historyLoading && historyDate && historyAppts.length === 0 && (
                  <div className="bg-slate-900 rounded-[2rem] p-12 text-center border border-white/5">
                    <div className="text-4xl mb-3">🗓️</div>
                    <p className="text-white/40 font-black text-sm">لا توجد مواعيد في هذا اليوم</p>
                  </div>
                )}
                {!historyLoading && historyAppts.length > 0 && (
                  <>
                    {/* History summary */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {label:"المواعيد",value:historyAppts.length},
                        {label:"منجزة",value:historyAppts.filter(a=>a.status==='done').length},
                        {label:"الإيرادات",value:historyAppts.filter(a=>a.status==='done').reduce((s,a)=>s+(a.servicePrice||0),0).toLocaleString()+" د.ع"},
                      ].map(s=>(
                        <div key={s.label} className="bg-slate-900 rounded-2xl p-4 border border-white/5 text-center">
                          <p className="text-white font-black text-lg">{s.value}</p>
                          <p className="text-white/30 text-[9px] font-bold mt-1">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {historyAppts.map(appt=>(
                      <div key={appt.id} className="bg-slate-900 rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0" style={{backgroundColor: appt.status==='done'?'#16a34a':appt.status==='noshow'?'#dc2626':'#64748b'}}>
                            #{appt.apptNumber||'?'}
                          </div>
                          <div>
                            <p className="text-white font-black text-sm">{appt.customerName}</p>
                            <p className="text-white/40 text-[10px] font-bold">{appt.serviceName} — {fmtSlot(appt.timeSlot)}</p>
                          </div>
                        </div>
                        <p className="text-white/60 font-black text-sm shrink-0">{(appt.servicePrice||0).toLocaleString()} د.ع</p>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── SETTINGS TAB ── */}
            {adminTab === "settings" && (
              <div className="space-y-8">

                {/* Shop branding */}
                <section className="bg-slate-900 rounded-[2.5rem] p-8 border border-white/10 shadow-xl">
                  <h3 className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">هوية الصالون</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="اسم الصالون EN" value={settings.shopName||""} onChange={e=>updateGlobalSettings("shopName",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="اسم الصالون AR" value={settings.shopNameAr||""} onChange={e=>updateGlobalSettings("shopNameAr",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="واتساب (964...)" value={settings.whatsapp||""} onChange={e=>updateGlobalSettings("whatsapp",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="ساعات العمل (مثال: 9:00 AM - 10:00 PM)" value={settings.workingHoursStr||""} onChange={e=>updateGlobalSettings("workingHoursStr",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm md:col-span-2" placeholder="الموقع / العنوان" value={settings.locationDesc||""} onChange={e=>updateGlobalSettings("locationDesc",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="Facebook URL" value={settings.facebookUrl||""} onChange={e=>updateGlobalSettings("facebookUrl",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="Instagram URL" value={settings.instagramUrl||""} onChange={e=>updateGlobalSettings("instagramUrl",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm md:col-span-2" placeholder="TikTok URL" value={settings.tiktokUrl||""} onChange={e=>updateGlobalSettings("tiktokUrl",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="رقم هاتف 1 (للاتصال)" value={settings.contactPhone1||""} onChange={e=>updateGlobalSettings("contactPhone1",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="رقم هاتف 2 (للاتصال)" value={settings.contactPhone2||""} onChange={e=>updateGlobalSettings("contactPhone2",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm md:col-span-2" placeholder="رقم هاتف 3 (للاتصال)" value={settings.contactPhone3||""} onChange={e=>updateGlobalSettings("contactPhone3",e.target.value)} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm md:col-span-2" placeholder="رابط الشعار (صورة)" value={settings.logoUrl||""} onChange={e=>updateGlobalSettings("logoUrl",e.target.value)} />
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl md:col-span-2">
                      <p className="text-white text-[10px] font-bold mb-3">أيام الإجازة (اضغط للتبديل)</p>
                      <div className="flex flex-wrap gap-2">
                        {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(day=>{
                          const arDay={Sunday:'الأحد',Monday:'الاثنين',Tuesday:'الثلاثاء',Wednesday:'الأربعاء',Thursday:'الخميس',Friday:'الجمعة',Saturday:'السبت'}[day];
                          const isOff=(settings.offDays||[]).includes(day);
                          return(
                            <button key={day} type="button"
                              onClick={()=>{const curr=settings.offDays||[];updateGlobalSettings("offDays",isOff?curr.filter(d=>d!==day):[...curr,day]);}}
                              className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${isOff?'bg-red-500/30 text-red-400 border border-red-500/40':'bg-black/30 text-white/40 border border-white/10 hover:border-white/20'}`}>
                              {arDay}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl">
                      <p className="text-white text-[10px] font-bold mb-2">مدة كل موعد (دقيقة)</p>
                      <div className="flex gap-2 flex-wrap">
                        {[15,20,30,45,60].map(n=>(
                          <button key={n} type="button" onClick={()=>updateGlobalSettings("slotDuration",n)}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${Number(settings.slotDuration)===n?'text-white':'bg-black/40 text-white/40'}`}
                            style={Number(settings.slotDuration)===n?{backgroundColor:settings.primaryColor}:{}}>
                            {n} د
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-white/5 p-4 rounded-xl">
                      <p className="text-white text-[10px] font-bold mb-2">حجز مسبق (أيام)</p>
                      <div className="flex gap-2 flex-wrap">
                        {[7,14,21,30].map(n=>(
                          <button key={n} type="button" onClick={()=>updateGlobalSettings("bookingDaysAhead",n)}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black transition-all ${Number(settings.bookingDaysAhead)===n?'text-white':'bg-black/40 text-white/40'}`}
                            style={Number(settings.bookingDaysAhead)===n?{backgroundColor:settings.primaryColor}:{}}>
                            {n} يوم
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/5">
                      <div>
                        <span className="text-white text-[10px] font-bold block">لون الإبراز (الذهبي)</span>
                        <span className="text-white/30 text-[9px]">يغير لون جميع العناصر المميزة في الموقع</span>
                      </div>
                      <input type="color" className="w-12 h-12 rounded-xl bg-transparent border-0 cursor-pointer ml-auto" value={settings.primaryColor||"#D4AF37"} onChange={e=>updateGlobalSettings("primaryColor",e.target.value)} />
                    </div>
                    <textarea className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm md:col-span-2 h-20 resize-none" placeholder="ملاحظة تظهر للزبون قبل الحجز" value={settings.bookingNote||""} onChange={e=>updateGlobalSettings("bookingNote",e.target.value)} />
                  </div>
                </section>

                {/* Services management */}
                <section id="service-form" className="bg-slate-900 rounded-[2.5rem] p-8 border border-white/10 shadow-xl">
                  <h3 className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6">إدارة الخدمات ✂️</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white font-bold" placeholder="اسم الخدمة (مثال: قص شعر)" value={newService.name} onChange={e=>setNewService({...newService,name:e.target.value})} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="السعر (د.ع)" type="number" value={newService.price} onChange={e=>setNewService({...newService,price:e.target.value})} />
                    <div className="space-y-1">
                      <p className="text-white/50 text-[10px] font-bold">المدة (دقيقة)</p>
                      <div className="flex gap-2">
                        {[15,20,30,45,60].map(n=>(
                          <button key={n} type="button" onClick={()=>setNewService({...newService,duration:String(n)})}
                            className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all ${newService.duration===String(n)?'text-white':'bg-black/40 text-white/40'}`}
                            style={newService.duration===String(n)?{backgroundColor:settings.primaryColor}:{}}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-sm" placeholder="وصف الخدمة (اختياري)" value={newService.desc} onChange={e=>setNewService({...newService,desc:e.target.value})} />
                    <input className="bg-black/40 border border-white/5 p-4 rounded-xl text-white text-xs md:col-span-2" placeholder="رابط صورة الخدمة (URL)" value={newService.image} onChange={e=>setNewService({...newService,image:e.target.value})} />
                    <button onClick={handleAddService} className="md:col-span-2 py-5 rounded-2xl text-white font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all" style={{backgroundColor:settings.primaryColor}}>
                      {newService.id ? 'تحديث الخدمة 💾' : 'إضافة خدمة +'}
                    </button>
                    {saveStatus && <p className="md:col-span-2 text-center text-xs font-bold text-white">{saveStatus}</p>}
                  </div>

                  {/* Services list */}
                  <div className="space-y-3">
                    {services.map(svc=>(
                      <div key={svc.id} className="bg-black/40 p-3 rounded-2xl border border-white/5 flex items-center justify-between hover:border-white/20 transition-all">
                        <div className="flex items-center gap-4">
                          {svc.image && <img src={svc.image} alt={svc.name} className="w-12 h-12 rounded-xl object-cover" onError={e=>e.target.style.display='none'} />}
                          <div>
                            <p className="text-white font-bold text-sm">{svc.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-orange-500">{(svc.price||0).toLocaleString()} د.ع</span>
                              <span className="text-[9px] font-black text-white/30 bg-white/5 px-2 py-0.5 rounded-md">{svc.duration} د</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={()=>setNewService({...svc})} className="text-white/40 hover:text-white p-2 text-[10px] font-black">تعديل</button>
                          <button onClick={()=>handleDeleteService(svc.id)} className="bg-red-500/10 text-red-500 px-3 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all text-[10px] font-black">حذف</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

              </div>
            )}
          </div>
        )
      ) : (

      /* ══════════════════════════════════════════════════════════════
          CUSTOMER BOOKING PAGE — LUXURY MIDNIGHT GOLD
      ══════════════════════════════════════════════════════════════ */
        <div className="pb-20 min-h-screen">

          {/* HERO HEADER */}
          <header className={`relative pt-16 pb-12 px-6 text-center overflow-hidden transition-opacity duration-500 ${settingsLoaded?'opacity-100':'opacity-0'}`}>
            {/* Decorative gold orbs */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none" style={{background:'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)', transform:'translate(-50%, -40%)'}} />
            <div className="absolute top-8 left-8 w-32 h-px barber-divider-h opacity-30" />
            <div className="absolute top-8 right-8 w-32 h-px barber-divider-h opacity-30" />

            {/* Logo */}
            {settings.logoUrl ? (
              <div className="flex justify-center mb-6">
                <div className="relative inline-flex items-center justify-center">
                  {/* Glow layer behind the image */}
                  <div className="absolute inset-0 rounded-full pointer-events-none" style={{
                    background: 'radial-gradient(circle, rgba(212,175,55,0.35) 0%, transparent 70%)',
                    filter: 'blur(18px)',
                    transform: 'scale(1.4)',
                    animation: 'logoGlow 4s ease-in-out infinite'
                  }} />
                  <img
                    src={settings.logoUrl}
                    alt={settings.shopName}
                    className="relative"
                    style={{
                      maxWidth: '110px',
                      maxHeight: '110px',
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 0 18px rgba(212,175,55,0.4))',
                    }}
                    onError={e => e.target.style.display = 'none'}
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl barber-logo-ring barber-logo-fallback">
                  💈
                </div>
              </div>
            )}

            <h1 className="barber-display text-5xl font-black uppercase tracking-widest leading-tight mb-1" style={{color:'var(--cream)'}}>{settings.shopName}</h1>
            <h2 className="barber-display text-xl font-black mb-6 tracking-wider italic" style={{color:'var(--gold)'}}>{settings.shopNameAr}</h2>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 barber-pill px-6 py-2.5 rounded-full">
                <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{background:'var(--gold)'}}></span>
                <span className="text-[11px] font-black uppercase tracking-widest" style={{color:'var(--cream)'}}>{settings.workingHoursStr}</span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{color:'var(--cream-dim)'}}>📍 {settings.locationDesc}</p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                {settings.facebookUrl && (
                  <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className="barber-social-btn w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M13.5 8.5V6.8c0-.8.5-1.1 1.2-1.1H16V3h-2.1C11.6 3 10.5 4.4 10.5 6.2v2.3H9v2.8h1.5V21h3V11.3h2.1l.3-2.8h-2.4z"/></svg>
                  </a>
                )}
                {settings.instagramUrl && (
                  <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="barber-social-btn w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none" strokeWidth="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                  </a>
                )}
                {settings.tiktokUrl && (
                  <a href={settings.tiktokUrl} target="_blank" rel="noreferrer" className="barber-social-btn w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/></svg>
                  </a>
                )}
                {[settings.contactPhone1, settings.contactPhone2, settings.contactPhone3].filter(p => digitsOnly(p).length >= 5).map((num, i) => (
                  <a key={i} href={`tel:+${digitsOnly(num)}`} dir="ltr" className="barber-social-btn inline-flex items-center gap-1.5 h-10 px-3 rounded-full shrink-0">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    <span className="text-[11px] font-black tabular-nums">{digitsOnly(num)}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* Bottom decorative line */}
            <div className="mt-10 flex items-center gap-4 px-8">
              <div className="flex-1 h-px barber-divider-h" />
              <span className="text-lg" style={{color:'rgba(212,175,55,0.4)'}}>✦</span>
              <div className="flex-1 h-px barber-divider-h" />
            </div>
          </header>

          {/* BOOKING WIZARD */}
          <div className="max-w-lg mx-auto px-4 space-y-5" dir="rtl">

            {/* Step indicator — luxury version */}
            <div className="flex items-center justify-center gap-2 mb-2 px-4">
              {[{n:1,label:'الخدمة'},{n:2,label:'الموعد'},{n:3,label:'بياناتك'}].map(({n,label})=>(
                <React.Fragment key={n}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm transition-all ${bookingStep>=n?'barber-step-active':'barber-step-inactive'}`}>
                      {bookingStep>n?'✓':n}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{color: bookingStep>=n ? 'var(--gold)' : 'rgba(245,237,214,0.2)'}}>{label}</span>
                  </div>
                  {n<3 && <div className={`flex-1 h-px mb-5 transition-all ${bookingStep>n?'barber-divider-h':'barber-divider-inactive'}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* STEP 1 — Pick service */}
            {bookingStep === 1 && (
              <div className="space-y-3 animate-fade-in">
                <h2 className="barber-section-title text-xl font-black mb-5 flex items-center gap-3">
                  <span className="barber-icon-badge">✂️</span>
                  اختر الخدمة
                </h2>
                {services.length === 0 && (
                  <div className="barber-card text-center py-12 font-bold rounded-[2rem]" style={{color:'var(--cream-muted)'}}>لا توجد خدمات بعد</div>
                )}
                {services.map(svc=>(
                  <button key={svc.id} type="button" onClick={()=>{setSelectedService(svc);setBookingStep(2);}}
                    className={`w-full rounded-[2rem] p-5 border-2 transition-all text-right flex items-center gap-4 active:scale-[0.98] ${selectedService?.id===svc.id?'barber-card-selected':'barber-card'}`}>
                    {svc.image
                      ? <img src={svc.image} alt={svc.name} className="w-16 h-16 rounded-2xl object-cover shrink-0 barber-img-ring" onError={e=>e.target.style.display='none'} />
                      : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 barber-icon-box">✂️</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className={`font-black text-lg leading-tight ${selectedService?.id===svc.id?'text-black':''}`} style={selectedService?.id===svc.id?{}:{color:'var(--cream)'}}>{svc.name}</p>
                      {svc.desc && <p className={`text-[11px] font-bold mt-0.5 ${selectedService?.id===svc.id?'text-black/60':''}`} style={selectedService?.id===svc.id?{}:{color:'var(--cream-muted)'}}>{svc.desc}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-xl ${selectedService?.id===svc.id?'text-black':''}`} style={selectedService?.id===svc.id?{}:{color:'var(--gold)'}}>{(svc.price||0).toLocaleString()}</p>
                      <p className={`text-[10px] font-bold ${selectedService?.id===svc.id?'text-black/60':''}`} style={selectedService?.id===svc.id?{}:{color:'var(--cream-muted)'}}>د.ع · {svc.duration} د</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* STEP 2 — Pick date & slot */}
            {bookingStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={()=>setBookingStep(1)} className="barber-back-btn w-9 h-9 rounded-full flex items-center justify-center transition-all">←</button>
                  <h2 className="barber-section-title text-xl font-black flex items-center gap-3">
                    <span className="barber-icon-badge">📅</span>
                    اختر الموعد
                  </h2>
                </div>
                {/* Service summary */}
                <div className="barber-card rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl barber-icon-box shrink-0">✂️</div>
                  <div>
                    <p className="font-black text-sm" style={{color:'var(--cream)'}}>{selectedService?.name}</p>
                    <p className="text-[11px] font-bold" style={{color:'var(--cream-muted)'}}>{(selectedService?.price||0).toLocaleString()} د.ع · {selectedService?.duration} دقيقة</p>
                  </div>
                </div>
                {/* Date pills */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{color:'var(--cream-muted)'}}>اختر اليوم</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {availableDates.map(({str,label})=>{
                      const active=selectedDate===str;
                      return(
                        <button key={str} type="button" onClick={()=>{setSelectedDate(str);setSelectedSlot('');}}
                          className={`shrink-0 px-5 py-3 rounded-2xl font-black text-[11px] transition-all ${active?'barber-btn-primary':'barber-btn-ghost'}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Time slots */}
                {selectedDate && (()=>{
                  const slots=generateSlots(selectedDate);
                  return(
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{color:'var(--cream-muted)'}}>اختر الوقت</p>
                      {slots.length===0&&<p className="text-sm font-bold text-center py-6" style={{color:'var(--cream-faint)'}}>لا توجد مواعيد متاحة في هذا اليوم</p>}
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map(({label,val})=>{
                          const active=selectedSlot===val;
                          return(
                            <button key={val} type="button" onClick={()=>setSelectedSlot(val)}
                              className={`py-3 rounded-2xl font-black text-[11px] transition-all ${active?'barber-btn-primary':'barber-btn-ghost'}`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {selectedDate && selectedSlot && (
                  <button onClick={()=>setBookingStep(3)}
                    className="w-full py-5 barber-btn-primary font-black rounded-2xl text-sm active:scale-95 transition-all mt-2">
                    التالي ←
                  </button>
                )}
              </div>
            )}

            {/* STEP 3 — Customer info */}
            {bookingStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={()=>setBookingStep(2)} className="barber-back-btn w-9 h-9 rounded-full flex items-center justify-center transition-all">←</button>
                  <h2 className="barber-section-title text-xl font-black flex items-center gap-3">
                    <span className="barber-icon-badge">👤</span>
                    بياناتك
                  </h2>
                </div>
                {/* Summary card */}
                <div className="barber-card rounded-2xl p-5 space-y-3">
                  {[
                    {label:'الخدمة', val:selectedService?.name},
                    {label:'التاريخ', val:selectedDate},
                    {label:'الوقت',  val:fmtSlot(selectedSlot)},
                  ].map(({label,val})=>(
                    <div key={label} className="flex justify-between text-sm">
                      <span className="font-bold" style={{color:'var(--cream-muted)'}}>{label}</span>
                      <span className="font-black" style={{color:'var(--cream)'}}>{val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm barber-divider-top pt-3 mt-1">
                    <span className="font-bold" style={{color:'var(--cream-muted)'}}>السعر</span>
                    <span className="font-black text-xl" style={{color:'var(--gold)'}}>{(selectedService?.price||0).toLocaleString()} <span className="text-sm">د.ع</span></span>
                  </div>
                </div>
                <input type="text" value={customerName} onChange={e=>setCustomerName(e.target.value)}
                  className="barber-input w-full p-5 rounded-2xl text-sm font-bold text-right outline-none"
                  placeholder="الاسم الكامل" />
                <input type="tel" value={customerPhone} onChange={e=>setCustomerPhone(e.target.value)}
                  className="barber-input w-full p-5 rounded-2xl text-sm font-bold text-right outline-none"
                  placeholder="رقم الهاتف" />
                {settings.bookingNote && (
                  <div className="barber-note rounded-2xl p-4 text-right">
                    <p className="text-xs font-black" style={{color:'var(--cream-dim)'}}>💡 {settings.bookingNote}</p>
                  </div>
                )}
                {bookingError && (
                  <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 text-right">
                    <p className="text-sm font-black text-red-400">❌ {bookingError}</p>
                  </div>
                )}
                <button
                  disabled={!customerName||!customerPhone||bookingSubmitting}
                  onClick={bookAppointment}
                  className="w-full py-6 barber-btn-primary font-black rounded-2xl text-sm disabled:opacity-30 transition-all active:scale-95 flex items-center justify-center gap-2">
                  {bookingSubmitting
                    ? <><span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin inline-block"></span>جارٍ الحجز...</>
                    : '✦ تأكيد الحجز'}
                </button>
              </div>
            )}
          </div>

          {/* CONFIRMATION POPUP — luxury */}
          {confirmedApptNum && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
              <div className="barber-popup rounded-[3rem] p-10 text-center max-w-xs w-full animate-slide-up" dir="rtl">
                <div className="text-6xl mb-4">💈</div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-3" style={{color:'var(--cream-muted)'}}>تم تأكيد موعدك</p>
                <div className="barber-appt-num text-8xl font-black tracking-tighter leading-none mb-1">#{confirmedApptNum}</div>
                <p className="text-xs font-bold mt-2 mb-8 tracking-widest" style={{color:'var(--cream-muted)'}}>احتفظ برقم موعدك</p>
                <div className="barber-divider-h w-full h-px mb-6 opacity-20" />
                <button onClick={()=>setConfirmedApptNum(null)}
                  className="w-full py-4 barber-btn-primary font-black rounded-2xl text-sm active:scale-95 transition-all">
                  حسناً 👍
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,400&family=Josefin+Sans:wght@100;300;400;700&display=swap');

        :root {
          --gold: #D4AF37;
          --gold-light: #E8CC6A;
          --gold-pale: rgba(212,175,55,0.18);
          --gold-dim: rgba(212,175,55,0.10);
          --gold-glow: rgba(212,175,55,0.35);
          --ink: #0A0A0F;
          --ink-2: #0F0F18;
          --ink-3: #161622;
          --ink-4: #1E1E2E;
          --cream: #F5EDD6;
          --cream-dim: rgba(245,237,214,0.75);
          --cream-muted: rgba(245,237,214,0.45);
          --cream-faint: rgba(245,237,214,0.15);
          --glass: rgba(255,255,255,0.04);
          --gb: rgba(212,175,55,0.2);
          --gb2: rgba(212,175,55,0.5);
        }

        .barber-bg, .barber-bg * { font-family: 'Josefin Sans', sans-serif; letter-spacing: 0.02em; }
        .barber-display { font-family: 'Cormorant Garamond', serif; }

        .barber-bg {
          background: var(--ink);
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        /* Rich layered background */
        .barber-bg::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 80% 60% at 15% 5%,   rgba(212,175,55,0.10) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 85% 95%,  rgba(212,175,55,0.07) 0%, transparent 55%),
            radial-gradient(ellipse 40% 40% at 50% 50%,  rgba(212,175,55,0.03) 0%, transparent 70%),
            linear-gradient(160deg, #0A0A0F 0%, #0F0E18 40%, #0A0A0F 100%);
          animation: bgPulse 14s ease-in-out infinite alternate;
        }
        @keyframes bgPulse { 0% { opacity:1; transform:scale(1); } 100% { opacity:0.7; transform:scale(1.04); } }

        /* Subtle noise grain */
        .barber-bg::after {
          content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.4;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
        }
        .barber-bg > * { position: relative; z-index: 1; }

        .barber-orb { position:fixed; border-radius:50%; pointer-events:none; z-index:0; filter:blur(100px); }
        .barber-orb-1 { width:600px; height:600px; top:-200px; right:-200px; background:radial-gradient(circle, rgba(212,175,55,0.10), transparent 70%); animation:orb1 22s ease-in-out infinite; }
        .barber-orb-2 { width:400px; height:400px; bottom:0%; left:-150px; background:radial-gradient(circle, rgba(212,175,55,0.07), transparent 70%); animation:orb2 28s ease-in-out infinite; }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,60px) scale(1.12)} 66%{transform:translate(30px,-40px) scale(0.92)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(60px,-80px) scale(1.18)} }

        /* ── ANIMATIONS ── */
        @keyframes goldShimmer { 0%{background-position:0% center} 100%{background-position:200% center} }
        @keyframes shimmerSweep { 0%{left:-60%} 100%{left:130%} }
        @keyframes logoGlow {
          0%,100%{box-shadow:0 0 0 2px rgba(212,175,55,0.35),0 0 0 8px rgba(212,175,55,0.08),0 0 70px rgba(212,175,55,0.18),0 24px 60px rgba(0,0,0,0.6)}
          50%{box-shadow:0 0 0 3px rgba(212,175,55,0.6),0 0 0 12px rgba(212,175,55,0.14),0 0 100px rgba(212,175,55,0.32),0 24px 60px rgba(0,0,0,0.6)}
        }
        @keyframes badgePulse { 0%,100%{box-shadow:0 2px 14px rgba(212,175,55,0.55)} 50%{box-shadow:0 2px 28px rgba(212,175,55,0.95)} }
        @keyframes numGlow { 0%,100%{text-shadow:0 0 40px rgba(212,175,55,0.5),0 0 80px rgba(212,175,55,0.2)} 50%{text-shadow:0 0 80px rgba(212,175,55,0.9),0 0 160px rgba(212,175,55,0.4)} }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes cardIn { from{opacity:0;transform:translateY(18px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }

        .animate-fade-in { animation: fadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }

        .barber-card:nth-child(1){animation:cardIn 0.5s 0.04s both cubic-bezier(0.16,1,0.3,1)}
        .barber-card:nth-child(2){animation:cardIn 0.5s 0.10s both cubic-bezier(0.16,1,0.3,1)}
        .barber-card:nth-child(3){animation:cardIn 0.5s 0.16s both cubic-bezier(0.16,1,0.3,1)}
        .barber-card:nth-child(4){animation:cardIn 0.5s 0.22s both cubic-bezier(0.16,1,0.3,1)}
        .barber-card:nth-child(5){animation:cardIn 0.5s 0.28s both cubic-bezier(0.16,1,0.3,1)}

        /* ── NAV ── */
        .barber-nav {
          background: rgba(10,10,15,0.90);
          border: 1px solid var(--gb);
          backdrop-filter: blur(32px);
          -webkit-backdrop-filter: blur(32px);
          box-shadow: 0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,175,55,0.10);
        }
        .barber-nav-active {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%);
          background-size: 200% auto;
          color: #0A0A0F !important;
          font-weight: 900;
          letter-spacing: 0.15em;
          box-shadow: 0 4px 28px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.4);
          animation: goldShimmer 3s linear infinite;
        }

        /* ── SERVICE CARDS ── */
        .barber-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%);
          border: 1px solid var(--gb);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          color: var(--cream);
          position: relative;
          overflow: hidden;
          transition: all 0.35s cubic-bezier(0.16,1,0.3,1);
          box-shadow: 0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(212,175,55,0.08);
        }
        .barber-card::before {
          content: ''; position: absolute; top: -50%; left: -60%;
          width: 35%; height: 200%;
          background: linear-gradient(105deg, transparent, rgba(212,175,55,0.06), transparent);
          transform: skewX(-15deg); pointer-events: none;
          animation: shimmerSweep 5s ease-in-out infinite;
        }
        .barber-card:hover {
          border-color: var(--gb2);
          box-shadow: 0 16px 55px rgba(212,175,55,0.14), inset 0 1px 0 rgba(212,175,55,0.18);
          transform: translateY(-3px);
          background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(212,175,55,0.04) 100%);
        }
        .barber-card-selected {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%) !important;
          background-size: 200% auto !important;
          border: 2px solid var(--gold-light) !important;
          animation: goldShimmer 3s linear infinite !important;
          box-shadow: 0 12px 55px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.3) !important;
          color: #0A0A0F !important;
        }
        .barber-card-selected * { color: #0A0A0F !important; }

        /* ── BUTTONS ── */
        .barber-btn-primary {
          background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%);
          background-size: 200% auto;
          color: #0A0A0F;
          font-weight: 900;
          letter-spacing: 0.15em;
          box-shadow: 0 4px 28px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
          animation: goldShimmer 3s linear infinite;
          transition: all 0.25s;
        }
        .barber-btn-primary:hover { box-shadow: 0 10px 50px rgba(212,175,55,0.6), inset 0 1px 0 rgba(255,255,255,0.3); transform: translateY(-2px); }
        .barber-btn-primary:active { transform: scale(0.97); }

        .barber-btn-ghost { background: rgba(212,175,55,0.06); border: 1px solid var(--gb); color: var(--cream); backdrop-filter: blur(10px); transition: all 0.2s; }
        .barber-btn-ghost:hover { background: rgba(212,175,55,0.12); border-color: var(--gb2); box-shadow: 0 0 20px rgba(212,175,55,0.12); }
        .barber-back-btn { background: rgba(212,175,55,0.06); border: 1px solid var(--gb); color: var(--cream-dim); backdrop-filter: blur(10px); transition: all 0.2s; }
        .barber-back-btn:hover { border-color: var(--gb2); color: var(--cream); }

        /* ── INPUTS ── */
        .barber-input {
          background: rgba(245,237,214,0.04);
          border: 1px solid var(--gb);
          color: var(--cream);
          letter-spacing: 0.06em;
          backdrop-filter: blur(10px);
          transition: all 0.25s;
        }
        .barber-input::placeholder { color: var(--cream-faint); letter-spacing: 0.12em; }
        .barber-input:focus { border-color: var(--gb2); background: rgba(245,237,214,0.07); box-shadow: 0 0 0 3px rgba(212,175,55,0.10), 0 0 24px rgba(212,175,55,0.08); outline: none; }

        /* ── LOGO & BADGES ── */
        .barber-logo-ring { animation: logoGlow 4s ease-in-out infinite; }
        .barber-logo-fallback { background: linear-gradient(135deg, var(--ink-3), var(--ink-4)); }
        .barber-badge { background: linear-gradient(135deg, var(--gold), var(--gold-light)); animation: badgePulse 2.5s ease-in-out infinite; }
        .barber-pill { background: rgba(245,237,214,0.04); border: 1px solid var(--gb); backdrop-filter: blur(14px); color: var(--cream-dim); }
        .barber-social-btn { background: rgba(245,237,214,0.04); border: 1px solid var(--gb); color: var(--cream-dim); backdrop-filter: blur(10px); transition: all 0.25s; }
        .barber-social-btn:hover { background: rgba(212,175,55,0.12); border-color: var(--gb2); color: var(--cream); box-shadow: 0 0 20px rgba(212,175,55,0.2); transform: translateY(-2px); }

        /* ── DIVIDERS ── */
        .barber-divider-h { background: linear-gradient(90deg, transparent, var(--gold), transparent); opacity: 0.4; }
        .barber-divider-inactive { background: rgba(245,237,214,0.06); }
        .barber-divider-top { border-top: 1px solid rgba(212,175,55,0.12); }

        /* ── ICON ELEMENTS ── */
        .barber-icon-badge { width: 2.2rem; height: 2.2rem; background: rgba(212,175,55,0.10); border: 1px solid var(--gb); border-radius: 0.75rem; display: inline-flex; align-items: center; justify-content: center; font-size: 1rem; backdrop-filter: blur(8px); }
        .barber-icon-box { background: rgba(212,175,55,0.08); border: 1px solid var(--gb); backdrop-filter: blur(8px); }
        .barber-img-ring { border: 1px solid var(--gb2); }

        /* ── STEP INDICATOR ── */
        .barber-step-active {
          background: linear-gradient(135deg, var(--gold), var(--gold-light));
          color: #0A0A0F;
          font-weight: 900;
          box-shadow: 0 4px 24px rgba(212,175,55,0.5), 0 0 0 3px rgba(212,175,55,0.18);
        }
        .barber-step-done {
          background: linear-gradient(135deg, var(--gold), var(--gold-light));
          color: #0A0A0F;
          font-weight: 900;
          opacity: 0.8;
        }
        .barber-step-inactive {
          background: rgba(245,237,214,0.05);
          border: 1px solid rgba(245,237,214,0.12);
          color: rgba(245,237,214,0.25);
        }

        /* ── TEXT COLORS ── */
        .barber-section-title { color: var(--gold) !important; letter-spacing: 0.1em; }
        .text-gold { color: var(--gold) !important; }
        .text-cream { color: var(--cream) !important; }
        .text-cream-dim { color: var(--cream-dim) !important; }
        .text-cream-muted { color: var(--cream-muted) !important; }

        /* ── NOTE BLOCK ── */
        .barber-note { background: rgba(245,237,214,0.04); border: 1px solid rgba(212,175,55,0.12); border-right: 3px solid rgba(212,175,55,0.5); color: var(--cream-dim); }

        /* ── POPUP / MODAL ── */
        .barber-popup {
          background: linear-gradient(160deg, rgba(20,20,32,0.99), rgba(10,10,15,1));
          border: 1px solid var(--gb2);
          backdrop-filter: blur(60px);
          -webkit-backdrop-filter: blur(60px);
          position: relative;
          overflow: hidden;
          box-shadow: 0 60px 120px rgba(0,0,0,0.98), 0 0 0 1px rgba(212,175,55,0.10), 0 0 140px rgba(212,175,55,0.07) inset;
        }
        .barber-popup::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); opacity: 0.8; }
        .barber-popup::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent); }
        .barber-appt-num { color: var(--gold); font-family: 'Cormorant Garamond', serif; animation: numGlow 2.5s ease-in-out infinite; }

        /* ── SLOT BUTTON ── */
        .barber-slot { background: rgba(245,237,214,0.04); border: 1px solid rgba(245,237,214,0.10); color: var(--cream-dim); transition: all 0.2s; }
        .barber-slot:hover { background: rgba(212,175,55,0.10); border-color: var(--gb2); color: var(--cream); }
        .barber-slot-active { background: linear-gradient(135deg, var(--gold), var(--gold-light)); border-color: var(--gold-light); color: #0A0A0F; font-weight: 700; box-shadow: 0 4px 20px rgba(212,175,55,0.4); }
        .barber-slot-taken { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.04); color: rgba(245,237,214,0.12); cursor: not-allowed; text-decoration: line-through; }

        /* ── SUMMARY ROW (step 3 confirmation) ── */
        .barber-summary-row { border-bottom: 1px solid rgba(245,237,214,0.07); }
        .barber-summary-label { color: var(--cream-muted); font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; }
        .barber-summary-value { color: var(--cream); font-weight: 700; }

        .no-scrollbar::-webkit-scrollbar { display: none }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none }

        /* ── OWNER PANEL (light) ── */
        .owner-panel { background: #f8fafc; min-height: 100vh; padding-bottom: 10rem }
        .owner-panel [class*="bg-slate-900"] { background: #ffffff !important }
        .owner-panel [class*="bg-black/40"], .owner-panel [class*="bg-black/30"], .owner-panel [class*="bg-black/50"] { background: #f1f5f9 !important }
        .owner-panel input, .owner-panel textarea, .owner-panel select { background: #f8fafc !important; border-color: #cbd5e1 !important; color: #0f172a !important }
        .owner-panel input::placeholder, .owner-panel textarea::placeholder { color: #94a3b8 !important }
        .owner-panel [class*="text-white"]:not([class*="bg-"]):not(button):not(a):not(span[class*="bg-"]) { color: #1e293b !important }
        .owner-panel [class*="text-white/30"] { color: #94a3b8 !important }
        .owner-panel [class*="text-white/40"] { color: #64748b !important }
        .owner-panel [class*="text-white/50"] { color: #475569 !important }
        .owner-panel [class*="border-white/5"], .owner-panel [class*="border-white/10"] { border-color: #e2e8f0 !important }
        .owner-panel [class*="bg-black/80"], .owner-panel [class*="bg-black/90"] { background: #1e293b !important }
        .owner-panel h3[class*="text-orange"] { color: #ea580c !important }
      `}} />
    </div>
  );
}