/* ==========================================================================
   NafsCare Pro v2.0 — FajleVerse
   ফজর (প্রভাত) থিম · ইমেইল সাইন-ইন ও ক্লাউড ব্যাকআপ · নিরাপদ ডেটা আপডেট
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------------------
   ক্লাউড সিঙ্ক (ইমেইল সাইন-ইন) চালু করতে নিজের Firebase প্রজেক্টের মান এখানে বসান।
   ফাঁকা থাকলে অ্যাপ আগের মতোই ফোনে কাজ করবে, শুধু সাইন-ইন বোতাম "প্রস্তুত নয়" দেখাবে।
   -------------------------------------------------------------------------- */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDiAk9PQ3JI3G4_RWQjIVhS4gI63FMfhwo",
    authDomain: "nafscare-2c367.firebaseapp.com",
    projectId: "nafscare-2c367",
    appId: "1:373754919912:web:7f82cde9bc589fa3a1c25d"
};
const APP_VERSION = "1.0";
const KEY = "nafscare_pro_state";           // আগের সংস্করণের একই key: পুরনো ডেটা এখান থেকেই পড়ে মাইগ্রেট হয়
const THEME_KEY = "nafscare_theme2";

/* ===== ১. ছোট সহায়ক ফাংশন ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const BNUM = '০১২৩৪৫৬৭৮৯';
const bn = n => String(n).replace(/\d/g, d => BNUM[d]);
const pad2 = n => String(n).padStart(2, '0');
const pad3 = n => String(n).padStart(3, '0');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = o => JSON.parse(JSON.stringify(o));
const dkey = (d = new Date()) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const pkey = k => { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (k, n) => { const d = pkey(k); d.setDate(d.getDate() + n); return dkey(d); };
const daysBetween = (a, b) => Math.round((pkey(b) - pkey(a)) / 86400000);
const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
const BN_DAYS_S = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const HIJRI_MONTHS = ['মুহাররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি', 'জুমাদাল উলা', 'জুমাদাস সানি', 'রজব', 'শাবান', 'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ'];
const fmtDate = (k, withDay) => { const d = pkey(k); return (withDay ? BN_DAYS[d.getDay()] + ', ' : '') + bn(d.getDate()) + ' ' + BN_MONTHS[d.getMonth()] + ' ' + bn(d.getFullYear()); };
const fmtShort = k => { const d = pkey(k); return bn(d.getDate()) + ' ' + BN_MONTHS[d.getMonth()]; };
function fmtClock(t) {
    if (!t) return '--:--';
    const p = t.split(':').map(Number), h = p[0], m = p[1];
    return bn((h % 12) || 12) + ':' + bn(pad2(m)) + (h >= 12 ? ' PM' : ' AM');
}
function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    return bn(pad2(Math.floor(sec / 3600))) + ':' + bn(pad2(Math.floor(sec % 3600 / 60))) + ':' + bn(pad2(sec % 60));
}
function relDay(k) {
    const t = dkey();
    if (k === t) return 'আজ';
    if (k === addDays(t, -1)) return 'গতকাল';
    return fmtShort(k);
}

const LS = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } },
    json(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
};

/* IndexedDB: কুরআনের লেখা ও ক্বারীর তালিকা অফলাইনে রাখার জন্য (না চললে মেমোরিতে) */
const IDB = (() => {
    let dbp = null; const mem = {};
    const open = () => dbp || (dbp = new Promise((res, rej) => {
        try {
            const r = indexedDB.open('nafscare', 1);
            r.onupgradeneeded = () => r.result.createObjectStore('kv');
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        } catch (e) { rej(e); }
    }));
    return {
        async get(k) {
            if (mem[k] !== undefined) return mem[k];
            try {
                const db = await open();
                return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
            } catch (e) { return undefined; }
        },
        async set(k, v) {
            mem[k] = v;
            try {
                const db = await open();
                await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
            } catch (e) { }
        },
        async keys() {
            try { const db = await open(); return await new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').getAllKeys(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); } catch (e) { return Object.keys(mem); }
        }
    };
})();

async function fetchJSON(url, ms = 14000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
        const r = await fetch(url, { signal: ctl.signal });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
    } finally { clearTimeout(t); }
}

/* ===== ২. আইকন (ইনলাইন SVG, বাইরের লাইব্রেরি লাগে না) ===== */
const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    beads: '<circle cx="12" cy="4.5" r="2"/><circle cx="18.5" cy="8.5" r="2"/><circle cx="18.5" cy="15.5" r="2"/><circle cx="12" cy="19.5" r="2"/><circle cx="5.5" cy="15.5" r="2"/><circle cx="5.5" cy="8.5" r="2"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    flame: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.6-2.5 1.5-3.5C10 10 11 9 11 7c0-1.5.2-2.5 1-4z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    down: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
    up: '<path d="M12 16V5"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    skipn: '<path d="M5 5l9 7-9 7z"/><path d="M19 5v14"/>',
    skipp: '<path d="M19 5l-9 7 9 7z"/><path d="M5 5v14"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    fwd: '<path d="M9 5l7 7-7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    crescent: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 9.2 4.4 4.4 0 0 1 17.5 18z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    logout: '<path d="M10 4H5v16h5"/><path d="M15 8l4 4-4 4M19 12H9"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    mosque: '<path d="M7 12c0-3 2-5 5-7 3 2 5 4 5 7"/><path d="M4 21V12h16v9"/><path d="M12 5V3"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    mountain: '<path d="M2 20l7-12 4 7 3-4 6 9z"/><path d="M9 8l1.5 3"/>',
    gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18"/><path d="M9 4l-2 5 5 11M15 4l2 5-5 11"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><path d="M12 20v.01"/>'
};
function icon(name, size = 22, sw = 2) {
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.star) + '</svg>';
}

/* ===== ৩. স্থির তথ্য: নামাজ, আমল, লেভেল, হাদিস, সূরা ===== */
const PR = [
    { k: 'fajr', n: 'ফজর', ar: 'الفجر', tk: 'Fajr', sun: '২ রাকাত' },
    { k: 'dhuhr', n: 'যোহর', ar: 'الظهر', tk: 'Dhuhr', sun: '৪ + ২ রাকাত' },
    { k: 'asr', n: 'আসর', ar: 'العصر', tk: 'Asr', sun: null },
    { k: 'maghrib', n: 'মাগরিব', ar: 'المغرب', tk: 'Maghrib', sun: '২ রাকাত' },
    { k: 'isha', n: 'ইশা', ar: 'العشاء', tk: 'Isha', sun: '২ রাকাত' }
];
const PRN = {}; PR.forEach(p => PRN[p.k] = p);
const DEEDS = [
    { k: 'quran', n: 'কুরআন তিলাওয়াত', sub: 'আজ কিছু আয়াত পড়ুন' },
    { k: 'zikr', n: 'সকাল-সন্ধ্যার জিকির', sub: 'সকালে বা সন্ধ্যায় আল্লাহকে স্মরণ' },
    { k: 'tahajjud', n: 'তাহাজ্জুদ ও নফল নামাজ', sub: 'রাতের নিরিবিলি ইবাদত' }
];
const P_FARD = 15, P_SUN = 5, P_DEED = 10, P_QADA = 8, DAY_MAX = 105;

const LEVELS = [
    ['নিয়তের সূচনা', 0], ['তাওবার পথে', 150], ['সবরের সাথী', 400], ['শুকরগুজার', 800], ['ইখলাসের পথিক', 1400],
    ['তাকওয়ার সাধক', 2200], ['ইহসানের আলো', 3300], ['ইস্তিকামাত', 4800], ['নফসের মুজাহিদ', 6800], ['জান্নাতের পথিক', 9500]
];
const THEMES = {
    fajr: { n: 'ফজর', sub: 'প্রভাত, হালকা রঙ', meta: '#eef4f0', lock: 0 },
    isha: { n: 'ইশা', sub: 'নীল রাত', meta: '#0c1124', lock: 2 },
    maghrib: { n: 'মাগরিব', sub: 'সন্ধ্যার আকাশ', meta: '#1b111a', lock: 4 }
};
const AVATARS = ['mosque', 'book', 'crescent', 'star', 'flame', 'shield', 'heart', 'sun'];
const AV_MAP = { 'fa-mosque': 'mosque', 'fa-book-quran': 'book', 'fa-moon': 'crescent', 'fa-star': 'star', 'fa-kaaba': 'mosque', 'fa-hands-praying': 'heart' };

const TASBEEH = [
    { k: 'subhanallah', ar: 'سُبْحَانَ ٱللَّهِ', n: 'সুবহানাল্লাহ', m: 'আল্লাহ পবিত্র', g: 33 },
    { k: 'alhamdulillah', ar: 'ٱلْحَمْدُ لِلَّهِ', n: 'আলহামদুলিল্লাহ', m: 'সকল প্রশংসা আল্লাহর', g: 33 },
    { k: 'allahuakbar', ar: 'ٱللَّهُ أَكْبَرُ', n: 'আল্লাহু আকবার', m: 'আল্লাহ সর্বমহান', g: 34 },
    { k: 'astagfirullah', ar: 'أَسْتَغْفِرُ ٱللَّهَ', n: 'আস্তাগফিরুল্লাহ', m: 'আমি আল্লাহর কাছে ক্ষমা চাই', g: 100 },
    { k: 'lailaha', ar: 'لَا إِلَٰهَ إِلَّا ٱللَّٰهُ', n: 'লা ইলাহা ইল্লাল্লাহ', m: 'আল্লাহ ছাড়া কোনো ইলাহ নেই', g: 100 },
    { k: 'darood', ar: 'صَلَّى ٱللَّهُ عَلَيْهِ وَسَلَّمَ', n: 'দরূদ', m: 'নবী ﷺ-এর উপর শান্তি ও রহমত', g: 100 }
];
const TAS_GOALS = [33, 34, 99, 100, 313, 500, 1000, 0];

const HADITHS = [
    { t: 'আমলের ফলাফল নিয়তের উপর নির্ভরশীল। আর প্রত্যেকে তাই পাবে, যা সে নিয়ত করে।', r: 'সহীহ বুখারী, হাদিস ১' },
    { t: 'তোমাদের মধ্যে সেই ব্যক্তি সর্বোত্তম, যে নিজে কুরআন শেখে এবং অন্যকে শেখায়।', r: 'সহীহ বুখারী, হাদিস ৫০২৭' },
    { t: 'মুমিনের বিষয়টি কতই না চমৎকার! তার প্রতিটি কাজেই কল্যাণ। সুখ এলে সে শুকরিয়া আদায় করে, তাতে তার কল্যাণ; দুঃখ এলে সবর করে, তাতেও তার কল্যাণ।', r: 'সহীহ মুসলিম, হাদিস ২৯৯৯' },
    { t: 'যে ব্যক্তি আল্লাহ ও আখিরাতে বিশ্বাস রাখে, সে যেন তার মেহমানকে সম্মান করে এবং ভালো কথা বলে, নয়তো চুপ থাকে।', r: 'সহীহ বুখারী, হাদিস ৬০১৮' },
    { t: 'তোমাদের কেউ প্রকৃত মুমিন হতে পারবে না, যতক্ষণ না সে নিজের জন্য যা পছন্দ করে, তার ভাইয়ের জন্যও তা পছন্দ করে।', r: 'সহীহ বুখারী, হাদিস ১৩' },
    { t: 'প্রকৃত মুসলিম সে, যার জিহ্বা ও হাত থেকে অন্য মুসলিমরা নিরাপদ থাকে।', r: 'সহীহ বুখারী, হাদিস ১০' },
    { t: 'সহজ করো, কঠিন করো না। সুসংবাদ দাও, মানুষকে বিমুখ করো না।', r: 'সহীহ বুখারী, হাদিস ৬৯' },
    { t: 'দুটি নিয়ামতের ব্যাপারে অনেক মানুষ ধোঁকায় পড়ে আছে: সুস্থতা ও অবসর সময়।', r: 'সহীহ বুখারী, হাদিস ৬৪১২' },
    { t: 'লজ্জা ঈমানের একটি শাখা।', r: 'সহীহ বুখারী, হাদিস ৯' },
    { t: 'যে ব্যক্তি জ্ঞান অন্বেষণের পথে চলে, আল্লাহ তার জন্য জান্নাতের পথ সহজ করে দেন।', r: 'সহীহ মুসলিম, হাদিস ২৬৯৯' },
    { t: 'ভালো কথাও সদকা।', r: 'সহীহ বুখারী ও সহীহ মুসলিম' },
    { t: 'যে আল্লাহর জন্য বিনয়ী হয়, আল্লাহ তাকে সম্মানিত করেন।', r: 'সহীহ মুসলিম, হাদিস ২৫৮৮' },
    { t: 'দুটি বাক্য জিহ্বায় হালকা, দাঁড়িপাল্লায় ভারী এবং দয়াময় আল্লাহর কাছে অত্যন্ত প্রিয়: ‘সুবহানাল্লাহি ওয়া বিহামদিহি, সুবহানাল্লাহিল আযীম’।', r: 'সহীহ বুখারী, হাদিস ৬৪০৬' },
    { t: 'যে ব্যক্তি দিনে একশ বার ‘সুবহানাল্লাহি ওয়া বিহামদিহি’ বলে, তার গুনাহ সমুদ্রের ফেনার সমান হলেও মাফ করে দেওয়া হয়।', r: 'সহীহ বুখারী, হাদিস ৬৪০৫' },
    { t: 'আল্লাহর কাছে সবচেয়ে প্রিয় আমল সেটাই, যা নিয়মিত করা হয়, তা পরিমাণে অল্প হলেও।', r: 'সহীহ বুখারী, হাদিস ৬৪৬৪' },
    { t: 'পবিত্রতা ঈমানের অর্ধেক। ‘আলহামদুলিল্লাহ’ দাঁড়িপাল্লাকে ভরে দেয়। সালাত নূর, সদকা প্রমাণ এবং সবর আলো।', r: 'সহীহ মুসলিম, হাদিস ২২৩' },
    { t: 'কারও ঘরের দরজার সামনে যদি একটি নদী থাকে আর সে প্রতিদিন পাঁচবার তাতে গোসল করে, তবে কি তার শরীরে কোনো ময়লা থাকবে? পাঁচ ওয়াক্ত সালাত ঠিক তেমন; এর মাধ্যমে আল্লাহ গুনাহ মুছে দেন।', r: 'সহীহ বুখারী, হাদিস ৫২৮' },
    { t: 'তোমাদের মধ্যে সেই ব্যক্তি সর্বোত্তম, যার চরিত্র সবচেয়ে সুন্দর।', r: 'সহীহ বুখারী, হাদিস ৩৫৫৯' },
    { t: 'প্রকৃত বীর সে নয়, যে কুস্তিতে অন্যকে হারায়; প্রকৃত বীর সে, যে রাগের সময় নিজেকে নিয়ন্ত্রণ করে।', r: 'সহীহ বুখারী, হাদিস ৬১১৪' },
    { t: 'যে ধৈর্য ধরতে চেষ্টা করে, আল্লাহ তাকে ধৈর্য দান করেন। সবরের চেয়ে উত্তম ও প্রশস্ত কোনো দান কাউকে দেওয়া হয়নি।', r: 'সহীহ বুখারী, হাদিস ১৪৬৯' },
    { t: 'আল্লাহ তোমাদের চেহারা ও সম্পদের দিকে তাকান না; তিনি তাকান তোমাদের অন্তর ও আমলের দিকে।', r: 'সহীহ মুসলিম, হাদিস ২৫৬৪' },
    { t: 'তোমরা পরস্পর হিংসা করো না, ধোঁকা দিয়ো না, একে অপরের প্রতি বিদ্বেষ রেখো না। আল্লাহর বান্দারা, তোমরা ভাই ভাই হয়ে যাও।', r: 'সহীহ মুসলিম, হাদিস ২৫৬৩' },
    { t: 'মানুষ মারা গেলে তার আমল বন্ধ হয়ে যায়, তিনটি ছাড়া: সদকায়ে জারিয়া, উপকারী ইলম এবং নেক সন্তান, যে তার জন্য দোয়া করে।', r: 'সহীহ মুসলিম, হাদিস ১৬৩১' },
    { t: 'দোয়াই ইবাদত।', r: 'জামে তিরমিযী, হাদিস ৩৩৭১' },
    { t: 'তোমাদের মধ্যে সেই ব্যক্তি উত্তম, যে তার পরিবারের কাছে উত্তম। আর আমি আমার পরিবারের কাছে তোমাদের সবার চেয়ে উত্তম।', r: 'জামে তিরমিযী, হাদিস ৩৮৯৫' },
    { t: 'সিয়াম ঢালস্বরূপ।', r: 'সহীহ বুখারী, হাদিস ১৮৯৪' },
    { t: 'যে ব্যক্তি ঈমান ও সওয়াবের আশায় রমজানে রোজা রাখে, তার পূর্ববর্তী গুনাহ মাফ করে দেওয়া হয়।', r: 'সহীহ বুখারী, হাদিস ৩৮' },
    { t: 'দুনিয়ায় এমনভাবে থাকো, যেন তুমি একজন অপরিচিত মুসাফির।', r: 'সহীহ বুখারী, হাদিস ৬৪১৬' },
    { t: 'তোমার ভাইয়ের সামনে হাসিমুখে থাকাও তোমার জন্য সদকা।', r: 'জামে তিরমিযী, হাদিস ১৯৫৬' },
    { t: 'সত্যবাদিতা পুণ্যের পথ দেখায়, আর পুণ্য জান্নাতের পথ দেখায়। মানুষ সত্য বলতে থাকলে আল্লাহর কাছে ‘সিদ্দীক’ হিসেবে লিখিত হয়।', r: 'সহীহ বুখারী, হাদিস ৬০৯৪' },
    { t: 'আল্লাহ সুন্দর এবং তিনি সৌন্দর্য ভালোবাসেন।', r: 'সহীহ মুসলিম, হাদিস ৯১' },
    { t: 'গুনাহ থেকে তাওবাকারী এমন, যার কোনো গুনাহই নেই।', r: 'সুনান ইবনে মাজাহ, হাদিস ৪২৫০' },
    { t: 'যে ব্যক্তি মিথ্যা কথা ও তার উপর আমল ছাড়েনি, তার পানাহার ত্যাগে আল্লাহর কোনো প্রয়োজন নেই।', r: 'সহীহ বুখারী, হাদিস ১৯০৩' },
    { t: 'যে ব্যক্তি কোনো মুমিনের দুনিয়ার কষ্ট দূর করে, আল্লাহ কিয়ামতের দিন তার কষ্ট দূর করবেন।', r: 'সহীহ মুসলিম, হাদিস ২৬৯৯' },
    { t: 'হালাল স্পষ্ট এবং হারামও স্পষ্ট। যে সন্দেহজনক বিষয় থেকে বেঁচে থাকে, সে নিজের দ্বীন ও সম্মান নিরাপদ করে নেয়।', r: 'সহীহ বুখারী, হাদিস ৫২' },
    { t: 'উপরের হাত (দাতার হাত) নিচের হাতের (গ্রহীতার হাতের) চেয়ে উত্তম।', r: 'সহীহ বুখারী, হাদিস ১৪২৭' },
    { t: 'আমি কি তোমাদের এমন আমলের কথা জানাব না, যা সিয়াম, সালাত ও সদকার চেয়েও উত্তম? তা হলো মানুষের মধ্যে মীমাংসা করে দেওয়া।', r: 'সুনান আবু দাউদ, হাদিস ৪৯১৯' },
    { t: 'যে ব্যক্তি ফজরের সালাত আদায় করে, সে আল্লাহর জিম্মায় থাকে।', r: 'সহীহ মুসলিম, হাদিস ৬৫৭' }
];

/* ১১৪ সূরা: বাংলা নাম | ইংরেজি নাম | আয়াত | M=মাক্কী D=মাদানী */
const SURAH_RAW = 'আল-ফাতিহা|Al-Fatihah|7|M;আল-বাকারা|Al-Baqarah|286|D;আলে ইমরান|Ali Imran|200|D;আন-নিসা|An-Nisa|176|D;আল-মায়িদা|Al-Maidah|120|D;আল-আনআম|Al-Anam|165|M;আল-আরাফ|Al-Araf|206|M;আল-আনফাল|Al-Anfal|75|D;আত-তাওবা|At-Tawbah|129|D;ইউনুস|Yunus|109|M;হুদ|Hud|123|M;ইউসুফ|Yusuf|111|M;আর-রাদ|Ar-Rad|43|D;ইবরাহিম|Ibrahim|52|M;আল-হিজর|Al-Hijr|99|M;আন-নাহল|An-Nahl|128|M;আল-ইসরা|Al-Isra|111|M;আল-কাহফ|Al-Kahf|110|M;মারইয়াম|Maryam|98|M;ত্বা-হা|Ta-Ha|135|M;আল-আম্বিয়া|Al-Anbiya|112|M;আল-হাজ্জ|Al-Hajj|78|D;আল-মুমিনুন|Al-Muminun|118|M;আন-নূর|An-Nur|64|D;আল-ফুরকান|Al-Furqan|77|M;আশ-শুআরা|Ash-Shuara|227|M;আন-নামল|An-Naml|93|M;আল-কাসাস|Al-Qasas|88|M;আল-আনকাবুত|Al-Ankabut|69|M;আর-রূম|Ar-Rum|60|M;লুকমান|Luqman|34|M;আস-সাজদা|As-Sajdah|30|M;আল-আহযাব|Al-Ahzab|73|D;সাবা|Saba|54|M;ফাতির|Fatir|45|M;ইয়া-সীন|Ya-Sin|83|M;আস-সাফফাত|As-Saffat|182|M;সোয়াদ|Sad|88|M;আয-যুমার|Az-Zumar|75|M;গাফির|Ghafir|85|M;ফুসসিলাত|Fussilat|54|M;আশ-শূরা|Ash-Shura|53|M;আয-যুখরুফ|Az-Zukhruf|89|M;আদ-দুখান|Ad-Dukhan|59|M;আল-জাসিয়া|Al-Jathiyah|37|M;আল-আহকাফ|Al-Ahqaf|35|M;মুহাম্মাদ|Muhammad|38|D;আল-ফাতহ|Al-Fath|29|D;আল-হুজুরাত|Al-Hujurat|18|D;ক্বাফ|Qaf|45|M;আয-যারিয়াত|Adh-Dhariyat|60|M;আত-তূর|At-Tur|49|M;আন-নাজম|An-Najm|62|M;আল-ক্বামার|Al-Qamar|55|M;আর-রহমান|Ar-Rahman|78|D;আল-ওয়াকিআ|Al-Waqiah|96|M;আল-হাদীদ|Al-Hadid|29|D;আল-মুজাদালা|Al-Mujadila|22|D;আল-হাশর|Al-Hashr|24|D;আল-মুমতাহিনা|Al-Mumtahanah|13|D;আস-সফ|As-Saff|14|D;আল-জুমুআ|Al-Jumuah|11|D;আল-মুনাফিকূন|Al-Munafiqun|11|D;আত-তাগাবুন|At-Taghabun|18|D;আত-তালাক|At-Talaq|12|D;আত-তাহরীম|At-Tahrim|12|D;আল-মুলক|Al-Mulk|30|M;আল-কলম|Al-Qalam|52|M;আল-হাক্কা|Al-Haqqah|52|M;আল-মাআরিজ|Al-Maarij|44|M;নূহ|Nuh|28|M;আল-জিন|Al-Jinn|28|M;আল-মুযযাম্মিল|Al-Muzzammil|20|M;আল-মুদ্দাসসির|Al-Muddaththir|56|M;আল-ক্বিয়ামা|Al-Qiyamah|40|M;আদ-দাহর|Al-Insan|31|D;আল-মুরসালাত|Al-Mursalat|50|M;আন-নাবা|An-Naba|40|M;আন-নাজিআত|An-Naziat|46|M;আবাসা|Abasa|42|M;আত-তাকবীর|At-Takwir|29|M;আল-ইনফিতার|Al-Infitar|19|M;আল-মুতাফফিফীন|Al-Mutaffifin|36|M;আল-ইনশিকাক|Al-Inshiqaq|25|M;আল-বুরূজ|Al-Buruj|22|M;আত-তারিক|At-Tariq|17|M;আল-আলা|Al-Ala|19|M;আল-গাশিয়া|Al-Ghashiyah|26|M;আল-ফজর|Al-Fajr|30|M;আল-বালাদ|Al-Balad|20|M;আশ-শামস|Ash-Shams|15|M;আল-লাইল|Al-Layl|21|M;আদ-দুহা|Ad-Duha|11|M;আল-ইনশিরাহ|Ash-Sharh|8|M;আত-তীন|At-Tin|8|M;আল-আলাক|Al-Alaq|19|M;আল-কদর|Al-Qadr|5|M;আল-বাইয়্যিনা|Al-Bayyinah|8|D;আয-যিলযাল|Az-Zalzalah|8|D;আল-আদিয়াত|Al-Adiyat|11|M;আল-কারিআ|Al-Qariah|11|M;আত-তাকাসুর|At-Takathur|8|M;আল-আসর|Al-Asr|3|M;আল-হুমাযা|Al-Humazah|9|M;আল-ফীল|Al-Fil|5|M;কুরাইশ|Quraysh|4|M;আল-মাউন|Al-Maun|7|M;আল-কাউসার|Al-Kawthar|3|M;আল-কাফিরূন|Al-Kafirun|6|M;আন-নাসর|An-Nasr|3|D;আল-মাসাদ|Al-Masad|5|M;আল-ইখলাস|Al-Ikhlas|4|M;আল-ফালাক|Al-Falaq|5|M;আন-নাস|An-Nas|6|M';
const SURAHS = SURAH_RAW.split(';').map((s, i) => { const p = s.split('|'); return { id: i + 1, bn: p[0], en: p[1], v: +p[2], t: p[3] === 'M' ? 'মাক্কী' : 'মাদানী' }; });

/* মেডেলের চিহ্ন ও ধাতব রঙ (প্রতিটি লেভেলের আলাদা) */
const EMB = [
    '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>',
    '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9.5 14.5a2.7 2.7 0 0 0 2.5 2.5"/>',
    '<path d="M6 3h12M6 21h12"/><path d="M7 3c0 5 5 6 5 9s-5 4-5 9"/><path d="M17 3c0 5-5 6-5 9s5 4 5 9"/>',
    '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18"/><path d="M9 4l-2 5 5 11M15 4l2 5-5 11"/>',
    '<path d="M7 12c0-3 2-5 5-7 3 2 5 4 5 7"/><path d="M4 21V12h16v9"/><path d="M12 5V3"/><path d="M3 21h18"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    '<path d="M2 20l7-12 4 7 3-4 6 9z"/><path d="M9 8l1.5 3"/>',
    '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 8l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14l-2.4 1.2.5-2.6L8.2 10.8l2.6-.4z"/>',
    '<path d="M5 21V10a7 7 0 0 1 14 0v11"/><path d="M9 21v-7a3 3 0 0 1 6 0v7"/><path d="M12 1.5v2.5"/><path d="M3 21h18"/>'
];
const TIERS = {
    bronze: ['#f6d0a8', '#c47a3a', '#5e3010', '#e6a868', '#9a5522'],
    silver: ['#ffffff', '#c4ccda', '#5d667a', '#eef2f8', '#a3adc0'],
    gold: ['#fff3c4', '#f2c14e', '#7d500d', '#ffe48f', '#cf9520'],
    legend: ['#fff3c4', '#f2c14e', '#7d500d', '#8ff5ea', '#13897f']
};
function medal(i, state, uid) {
    const tier = i < 3 ? 'bronze' : i < 6 ? 'silver' : i < 9 ? 'gold' : 'legend';
    let c = TIERS[tier];
    if (state === 'locked') c = ['#e4e9e6', '#c3cdc8', '#95a19b', '#eef2ef', '#d3dbd7'];
    const g = 'md' + i + (uid || ''), sd = state === 'locked' ? '#8a9690' : '#2a1704', emb = EMB[i];
    const rib = state === 'locked' ? ['#cfd8d3', '#b4bfb9'] : ['#1f8f6f', '#0e5a45'];
    const glow = state === 'current' ? 'filter:drop-shadow(0 0 9px rgba(233,162,27,.65));' : state === 'done' ? 'filter:drop-shadow(0 4px 5px rgba(16,48,42,.25));' : '';
    const lock = state === 'locked' ? '<g transform="translate(40,52)"><circle cx="10" cy="10" r="10" fill="#fff" stroke="#b6c1bb" stroke-width="1.4"/><g transform="translate(4.5,4.5) scale(.46)" fill="none" stroke="#6d7a74" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></g></g>' : '';
    return '<svg class="medal" role="img" aria-label="ব্যাজ ' + bn(i + 1) + '" width="64" height="78" viewBox="0 0 64 78" style="' + glow + '"><defs>' +
        '<linearGradient id="' + g + 'r" x1=".15" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".45" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient>' +
        '<radialGradient id="' + g + 'f" cx=".35" cy=".28" r=".85"><stop offset="0" stop-color="' + c[3] + '"/><stop offset="1" stop-color="' + c[4] + '"/></radialGradient>' +
        '<linearGradient id="' + g + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + rib[0] + '"/><stop offset="1" stop-color="' + rib[1] + '"/></linearGradient></defs>' +
        '<path d="M20 0h10l6 30h-12z" fill="url(#' + g + 'b)"/><path d="M44 0H34l-6 30h12z" fill="url(#' + g + 'b)" opacity=".92"/>' +
        '<circle cx="32" cy="46" r="28" fill="url(#' + g + 'r)"/><circle cx="32" cy="46" r="23.5" fill="none" stroke="' + c[2] + '" stroke-opacity=".5"/><circle cx="32" cy="46" r="22" fill="url(#' + g + 'f)"/>' +
        '<ellipse cx="25" cy="34" rx="13" ry="7" fill="#fff" opacity="' + (state === 'locked' ? .5 : .35) + '" transform="rotate(-25 25 34)"/>' +
        '<g transform="translate(19,33) scale(1.08)" opacity="' + (state === 'locked' ? .7 : 1) + '"><g transform="translate(.7,.9)" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + emb + '</g><g fill="none" stroke="' + sd + '" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + emb + '</g></g>' + lock + '</svg>';
}

/* ===== ৪. অ্যাপের ডেটা (state): মাইগ্রেশন, লোড, সেভ ===== */
function defaultState() {
    const t = Date.now(), today = dkey();
    return {
        v: 2,
        user: { name: 'মুসাফির', avatar: 'mosque', gender: 'auto', ts: 0 },
        set: {
            theme: 'fajr', auto: false, method: 1, school: 1, arSize: 30, showBn: true, autoNext: true, ayahReciter: 'Alafasy_128kbps',
            f: { sunnah: true, qada: true, qadaGap: true, forbidden: true, hadith: true, vib: true, sound: false, ramadan: true },
            n: { prayer: false, hadith: false },
            ts: 0
        },
        days: {},
        qada: { items: [], base: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, baseTs: 0 },
        tas: { sessions: [], cur: { k: 'subhanallah', n: 0, goal: 33, ts: 0 } },
        quran: { last: { s: 1, a: 1, ts: 0 }, marks: [], hifz: {}, rec: null, recTs: 0 },
        habits: [],
        meta: { created: t, qadaFrom: t, lastSeen: today, lvl: 0, hSlotN: -1, pNotif: '' }
}
function fillDefaults(t, d) {
    Object.keys(d).forEach(k => {
        if (t[k] === undefined || t[k] === null) t[k] = clone(d[k]);
        else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && typeof t[k] === 'object' && !Array.isArray(t[k])) fillDefaults(t[k], d[k]);
    });
    return t;
}
function newDay() { return { p: {}, a: {}, note: '', tas: 0, ts: 0 }; }
function hasActivity(r) { return !!r && (Object.keys(r.p || {}).length > 0 || Object.keys(r.a || {}).length > 0 || (r.note && r.note.trim()) || (r.tas || 0) > 0); }

/* পুরনো (v1) অ্যাপের ডেটা নতুন ফরম্যাটে আনা — কিছুই মোছা হয় না */
function migrateV1(o) {
    const n = defaultState(), u = o.user || {};
    n.user.name = u.name || n.user.name;
    n.user.gender = u.genderMode || 'auto';
    n.user.avatar = AV_MAP[u.avatarIcon] || 'mosque';
    const dr = o.dailyRecords || {};
    Object.keys(dr).forEach(k => {
        const r = dr[k]; if (!r) return;
        const ci = r.checkedItems || {}, rec = newDay();
        PR.forEach(p => { if (ci[p.k]) rec.p[p.k] = 1; });
        DEEDS.forEach(d => { if (ci[d.k]) rec.a[d.k] = 1; });
        rec.note = r.note || ''; rec.tas = r.tasbeehTotal || 0;
        if (hasActivity(rec)) n.days[k] = rec;
    });
    n.quran.last = { s: o.quranBookmark || 1, a: 1, ts: 0 };
    n.meta.migrated = Date.now();
    return n;
}
let S = null;
function loadState() {
    let raw = LS.get(KEY), obj = null;
    if (raw) { try { obj = JSON.parse(raw); } catch (e) { LS.set(KEY + '_corrupt', raw); obj = null; } }
    if (!obj) { const bak = LS.get(KEY + '_bak'); if (bak) { try { obj = JSON.parse(bak); loadState.restored = true; } catch (e) { obj = null; } } }
    if (!obj || typeof obj !== 'object') return defaultState();
    if (obj.v !== 2) {
        if (!LS.get(KEY + '_v1')) LS.set(KEY + '_v1', raw || JSON.stringify(obj));   // পুরনো ডেটার আলাদা কপি
        obj = migrateV1(obj);
    }
    return fillDefaults(obj, defaultState());
}
let saveT = null;
function saveState(immediate) {
    S.meta.saved = Date.now();
    const doSave = () => {
        const j = JSON.stringify(S);
        if (!LS.set(KEY, j)) {
            if (!saveState.warned) { saveState.warned = true; toast('ফোনের স্টোরেজ ভরে গেছে, ডেটা সেভ হচ্ছে না!'); }
        } else {
            const t = dkey();
            if (LS.get(KEY + '_bakday') !== t) { LS.set(KEY + '_bak', j); LS.set(KEY + '_bakday', t); }
        }
        if (typeof scheduleCloud === 'function') scheduleCloud();
    };
    clearTimeout(saveT);
    if (immediate) doSave(); else saveT = setTimeout(doSave, 300);
}
window.addEventListener('pagehide', () => { if (S) saveState(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S) saveState(true); });

/* ===== ৫. পয়েন্ট, স্ট্রেইক, লেভেল ===== */
function rec4(k) {
    if (!S.days[k]) S.days[k] = newDay();
    const r = S.days[k]; r.p = r.p || {}; r.a = r.a || {};
    return r;
}
const fardCount = r => r && r.p ? PR.filter(p => (r.p[p.k] || 0) & 1).length : 0;
const sunCount = r => r && r.p ? PR.filter(p => p.sun && ((r.p[p.k] || 0) & 2)).length : 0;
const deedCount = r => r && r.a ? DEEDS.filter(d => r.a[d.k]).length : 0;
function dayPts(r) {
    if (!r) return 0;
    return fardCount(r) * P_FARD + sunCount(r) * P_SUN + deedCount(r) * P_DEED + Math.min(10, Math.floor((r.tas || 0) / 50));
}
function dayScore(r) { return r ? Math.min(100, Math.round((fardCount(r) * P_FARD + deedCount(r) * P_DEED) / DAY_MAX * 100)) : 0; }
const isActiveDay = r => !!r && (fardCount(r) > 0 || deedCount(r) > 0);
function qadaDoneCount() { return S.qada.items.filter(i => i.done).length; }
function totalPoints() {
    let t = qadaDoneCount() * P_QADA;
    Object.keys(S.days).forEach(k => { t += dayPts(S.days[k]); });
    return t;
}
function streak() {
    let k = dkey(), n = 0;
    if (!isActiveDay(S.days[k])) k = addDays(k, -1);
    while (isActiveDay(S.days[k]) && n < 4000) { n++; k = addDays(k, -1); }
    return n;
}
function activeDaysCount() { return Object.keys(S.days).filter(k => hasActivity(S.days[k])).length; }
function levelInfo(p) {
    let i = 0; while (i < LEVELS.length - 1 && p >= LEVELS[i + 1][1]) i++;
    const cur = LEVELS[i][1], nx = LEVELS[i + 1] ? LEVELS[i + 1][1] : null;
    return { i, name: LEVELS[i][0], cur, nxt: nx, pct: nx ? clamp(Math.round((p - cur) / (nx - cur) * 100), 0, 100) : 100, left: nx ? Math.max(0, nx - p) : 0 };
}
/* অর্জিত ব্যাজ কখনো কমে না (পয়েন্ট কমলেও) */
function badgeLevel() { return Math.max(S.meta.lvl || 0, levelInfo(totalPoints()).i); }
function checkLevelUp() {
    const l = levelInfo(totalPoints()).i;
    if (l > (S.meta.lvl || 0)) { S.meta.lvl = l; setTimeout(() => levelUpSheet(l), 500); }
}
function effectiveGender() {
    const g = S.user.gender;
    if (g === 'male' || g === 'female') return g;
    const n = (S.user.name || '').toLowerCase().trim();
    const FEM = ['ফাতিমা', 'ফাতেমা', 'আয়েশা', 'আয়শা', 'খাদিজা', 'মরিয়ম', 'নুসরাত', 'তাসনিম', 'ফারজানা', 'সাদিয়া', 'জান্নাত', 'aisha', 'fatima', 'khadija', 'sumaiya', 'nusrat', 'sadia', 'jannat', 'tasnim', 'maria'];
    if (FEM.some(x => n.includes(x))) return 'female';
    if (['া', 'ি', 'ী'].includes(n.slice(-1)) && !n.includes('রেজা') && !n.includes('রানা')) return 'female';
    return 'male';
}
const honorific = () => effectiveGender() === 'female' ? 'বোন' : 'ভাই';

/* ===== ৬. টোস্ট, শিট (নিচ থেকে উঠে আসা বক্স), প্রশ্ন-ডায়ালগ ===== */
function toast(msg, o) {
    o = o || {};
    const root = $('#toasts'); if (!root) return;
    const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (o.act ? '<button type="button" class="toast-act">' + esc(o.act) + '</button>' : '');
    root.appendChild(el);
    while (root.children.length > 3) root.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    const kill = () => { el.classList.remove('in'); setTimeout(() => el.remove(), 260); };
    if (o.act) el.querySelector('button').onclick = () => { kill(); if (o.fn) o.fn(); };
    setTimeout(kill, o.ms || (o.act ? 5500 : 2600));
}
let sheetClose = null;
function openSheet(html, o) {
    o = o || {};
    closeSheet(true);
    const root = $('#sheetRoot');
    root.innerHTML = '<div class="backdrop" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(o.title || '') + '"><div class="sheet-grip"></div>' +
        '<div class="sheet-head"><h2 class="tiro">' + esc(o.title || '') + '</h2><button type="button" class="iconbtn sm" data-act="sheet-close" aria-label="বন্ধ করুন">' + icon('close', 20) + '</button></div>' +
        '<div class="sheet-body" id="sheetBody">' + html + '</div></div>';
    root.classList.remove('open'); document.body.classList.add('sheet-open');
    requestAnimationFrame(() => root.classList.add('open'));
    sheetClose = o.onClose || null;
}
function closeSheet(silent) {
    const root = $('#sheetRoot'); if (!root || !root.firstChild) return;
    root.innerHTML = ''; root.classList.remove('open'); document.body.classList.remove('sheet-open');
    const f = sheetClose; sheetClose = null; if (!silent && f) f();
}
function ask(o) {
    return new Promise(res => {
        const root = $('#dlgRoot');
        root.innerHTML = '<div class="backdrop show"></div><div class="dialog" role="alertdialog" aria-modal="true"><h2 class="tiro">' + esc(o.title) + '</h2><p>' + esc(o.text || '') + '</p>' +
            '<div class="dlg-btns"><button type="button" class="btn ghost" data-r="0">' + esc(o.cancel || 'বাতিল') + '</button><button type="button" class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-r="1">' + esc(o.ok || 'হ্যাঁ') + '</button></div></div>';
        root.classList.add('on');
        root.onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; root.classList.remove('on'); root.innerHTML = ''; res(b.dataset.r === '1'); };
    });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ===== ৭. ক্লিক/ইনপুট বিতরণ (inline onclick লাগে না) ===== */
const ACT = {}, INP = {};
document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (fn) fn(el, e);
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && INP[el.dataset.in]) INP[el.dataset.in](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && INP[el.dataset.ch]) INP[el.dataset.ch](el, e); });
ACT['sheet-close'] = () => closeSheet();/* ===== ৮. থিম ===== */
function currentThemeName() {
    let t = S.set.theme || 'fajr';
    if (S.set.auto) {
        const w = waqtNow();
        t = w.sky === 'maghrib' ? 'maghrib' : w.sky === 'isha' ? 'isha' : 'fajr';
    }
    const th = THEMES[t];
    if (!th || badgeLevel() < th.lock) t = 'fajr';
    return t;
}
function applyTheme() {
    const t = currentThemeName();
    document.documentElement.setAttribute('data-theme', t);
    const m = $('#metaTheme'); if (m) m.setAttribute('content', THEMES[t].meta);
    LS.set(THEME_KEY, t);
}

/* ===== ৯. লোকেশন (জিপিএস), ঠিকানা ও নামাজের সময় ===== */
const LOC_KEY = 'nafscare_last_loc', TIM_KEY = 'nafscare_timings';
const DEFAULT_T = { Fajr: '04:48', Sunrise: '06:05', Dhuhr: '12:05', Asr: '16:16', Sunset: '18:00', Maghrib: '18:02', Isha: '19:13' };
let LOC = LS.json(LOC_KEY, null);          // { lat, lon, addr, ts }
let TIM = null, TIMSRC = 'default', HIJ = null, lastFetchDay = '';
let gpsState = 'idle', geoWatch = null, timesBusy = false;
const toMin = t => { const p = String(t || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
function cleanT(t) {
    const o = {};
    ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Sunset', 'Maghrib', 'Isha'].forEach(k => { o[k] = String(t[k] || '').split(' ')[0]; });
    if (!o.Sunset) o.Sunset = o.Maghrib;
    return o;
}
const timCache = () => LS.json(TIM_KEY, {});
function timingsFor(k) {
    const c = timCache();
    return (c[k] && c[k].t) || TIM || DEFAULT_T;
}
function distKm(a, b, c, d) {
    const R = 6371, r = x => x * Math.PI / 180, dl = r(c - a), dn = r(d - b);
    const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dn / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
function useCachedTimings() {
    const c = timCache(), today = dkey();
    let e = c[today];
    if (!e || e.m !== S.set.method || e.s !== S.set.school) {
        const ks = Object.keys(c).sort();
        e = ks.length ? c[ks[ks.length - 1]] : null;
        if (e && (e.m !== S.set.method || e.s !== S.set.school)) e = null;
    } else { lastFetchDay = today; }
    if (e) { TIM = e.t; HIJ = e.h || null; TIMSRC = 'cache'; }
    else { TIM = DEFAULT_T; TIMSRC = 'default'; }
}
async function loadTimes(lat, lon) {
    if (timesBusy) return; timesBusy = true;
    const d = new Date(), today = dkey();
    const ds = pad2(d.getDate()) + '-' + pad2(d.getMonth() + 1) + '-' + d.getFullYear();
    try {
        const j = await fetchJSON('https://api.aladhan.com/v1/timings/' + ds + '?latitude=' + lat + '&longitude=' + lon + '&method=' + S.set.method + '&school=' + S.set.school);
        if (!j || !j.data || !j.data.timings) throw new Error('bad');
        TIM = cleanT(j.data.timings); TIMSRC = 'live';
        const h = j.data.date && j.data.date.hijri;
        HIJ = h ? { d: +h.day, m: +(h.month && h.month.number), y: +h.year } : null;
        const c = timCache();
        c[today] = { t: TIM, h: HIJ, m: S.set.method, s: S.set.school, lat: lat, lon: lon };
        Object.keys(c).sort().slice(0, -10).forEach(k => delete c[k]);
        LS.set(TIM_KEY, JSON.stringify(c));
        lastFetchDay = today;
    } catch (e) { /* অফলাইন: আগের সময়ই চলবে */ }
    timesBusy = false;
    onTimesChanged();
}
function onTimesChanged() {
    applyTheme(); qadaSweep(); paintLoc();
    if (curTab === 'home' || curTab === 'track') renderTab(curTab);
}
function startLocation(manual) {
    if (!navigator.geolocation) { gpsState = 'none'; fallbackTimes(); paintLoc(); return; }
    gpsState = 'loading'; paintLoc();
    navigator.geolocation.getCurrentPosition(
        p => { gotPos(p, manual); watchLoc(); },
        err => { gpsState = err && err.code === 1 ? 'denied' : 'fail'; fallbackTimes(); paintLoc(); watchLoc(); },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: manual ? 0 : 300000 }
    );
}
function watchLoc() {
    if (geoWatch !== null || !navigator.geolocation) return;
    geoWatch = navigator.geolocation.watchPosition(p => gotPos(p, false), () => { }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 30000 });
}
function fallbackTimes() {
    if (LOC && (TIMSRC !== 'live' || lastFetchDay !== dkey())) loadTimes(LOC.lat, LOC.lon);
}
function gotPos(pos, manual) {
    const lat = pos.coords.latitude, lon = pos.coords.longitude, prev = LOC;
    const far = !prev || distKm(prev.lat, prev.lon, lat, lon) >= 3;
    const near1 = !prev || distKm(prev.lat, prev.lon, lat, lon) >= 1;
    gpsState = 'ok';
    LOC = { lat: lat, lon: lon, addr: prev ? prev.addr : '', ts: Date.now() };
    LS.set(LOC_KEY, JSON.stringify(LOC));
    if (far || manual || TIMSRC !== 'live' || lastFetchDay !== dkey()) loadTimes(lat, lon);
    if (!LOC.addr || near1 || manual) reverseGeocode(lat, lon);
    paintLoc();
}
function joinAddr(parts) {
    const out = [];
    parts.forEach(p => { p = String(p || '').trim(); if (p && !out.some(x => x === p || x.includes(p) || p.includes(x))) out.push(p); });
    return out.slice(0, 3).join(', ');
}
async function reverseGeocode(lat, lon) {
    let addr = '';
    try {
        const j = await fetchJSON('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=bn', 10000);
        addr = joinAddr([j.locality, j.city || j.principalSubdivision, j.countryName]);
    } catch (e) { }
    if (!addr) {
        try {
            const j = await fetchJSON('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=bn&lat=' + lat + '&lon=' + lon, 10000), a = j.address || {};
            addr = joinAddr([a.suburb || a.neighbourhood || a.village || a.hamlet, a.city || a.town || a.county || a.state_district || a.state, a.country]);
        } catch (e) { }
    }
    if (addr && LOC) { LOC.addr = addr; LS.set(LOC_KEY, JSON.stringify(LOC)); }
    paintLoc();
}
/* ঠিকানা সবসময় [ বন্ধনীর ] ভেতরে */
function locText() {
    if (gpsState === 'loading' && !(LOC && LOC.addr)) return '[লোকেশন খোঁজা হচ্ছে…]';
    if (LOC && LOC.addr) return '[' + LOC.addr + ']';
    if (LOC) return '[' + bn(LOC.lat.toFixed(2)) + ', ' + bn(LOC.lon.toFixed(2)) + ']';
    if (gpsState === 'denied') return '[লোকেশন বন্ধ আছে]';
    return '[ঠিকানা পাওয়া যায়নি]';
}
function locNote() {
    if (gpsState === 'denied' && !LOC) return 'লোকেশন অনুমতি দিন, নইলে নামাজের সময় আনুমানিক দেখাবে';
    if (TIMSRC === 'default') return 'আনুমানিক সময় দেখানো হচ্ছে';
    if (TIMSRC === 'cache') return 'সর্বশেষ সংরক্ষিত সময়';
    return 'জিপিএস থেকে হালনাগাদ';
}
function paintLoc() {
    $$('.loc-text').forEach(e => { e.textContent = locText(); });
    $$('.loc-note').forEach(e => { e.textContent = locNote(); });
}
function hijriText() {
    if (!HIJ || !HIJ.m) return '';
    return bn(HIJ.d) + ' ' + (HIJRI_MONTHS[HIJ.m - 1] || '') + ' ' + bn(HIJ.y) + ' হিজরি';
}

/* ===== ১০. ওয়াক্তের ইঞ্জিন: এখন কোন ওয়াক্ত, কতক্ষণ বাকি, নিষিদ্ধ সময় ===== */
function waqtNow(d) {
    d = d || new Date();
    const T = TIM || DEFAULT_T;
    const cur = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(), m = k => toMin(T[k]) * 60;
    const f = m('Fajr'), sr = m('Sunrise'), dh = m('Dhuhr'), as = m('Asr'), mg = m('Maghrib'), is = m('Isha'), ss = m('Sunset');
    let key = null, start, end, sky;
    if (cur >= f && cur < sr) { key = 'fajr'; start = f; end = sr; sky = 'fajr'; }
    else if (cur >= sr && cur < dh) { start = sr; end = dh; sky = 'day'; }
    else if (cur >= dh && cur < as) { key = 'dhuhr'; start = dh; end = as; sky = 'day'; }
    else if (cur >= as && cur < mg) { key = 'asr'; start = as; end = mg; sky = 'asr'; }
    else if (cur >= mg && cur < is) { key = 'maghrib'; start = mg; end = is; sky = 'maghrib'; }
    else if (cur >= is) { key = 'isha'; start = is; end = f + 86400; sky = 'isha'; }
    else { key = 'isha'; start = is - 86400; end = f; sky = 'isha'; }
    let forb = null;
    if (cur >= sr && cur < sr + 1200) forb = 'সূর্যোদয়ের সময় চলছে। এখন নফল নামাজ জায়েজ নয় (প্রায় ২০ মিনিট)।';
    else if (cur >= dh - 900 && cur < dh) forb = 'ঠিক দুপুরের সময় (জাওয়াল) চলছে। এখন নফল নামাজ জায়েজ নয়।';
    else if (cur >= ss - 1200 && cur < mg) forb = 'সূর্যাস্তের সময় চলছে। এখন নফল নামাজ জায়েজ নয়।';
    const list = [['fajr', f], ['dhuhr', dh], ['asr', as], ['maghrib', mg], ['isha', is]];
    let nx = list.find(x => x[1] > cur), nin;
    if (nx) nin = nx[1] - cur; else { nx = ['fajr', f + 86400]; nin = f + 86400 - cur; }
    return {
        key: key, name: key ? PRN[key].n : 'যোহরের অপেক্ষা', ar: key ? PRN[key].ar : '', start: start, end: end, cur: cur,
        left: Math.max(0, end - cur), pct: clamp((cur - start) / Math.max(end - start, 1) * 100, 0, 100), sky: sky, forb: forb,
        next: { k: nx[0], n: PRN[nx[0]].n, inSec: nin, t: T[PRN[nx[0]].tk] }
    };
}
function waqtStartMs(dk, pk) { return pkey(dk).getTime() + toMin(timingsFor(dk)[PRN[pk].tk]) * 60000; }
function waqtEndMs(dk, pk) {
    const T = timingsFor(dk), base = pkey(dk).getTime(), at = (b, t) => b + toMin(t) * 60000;
    switch (pk) {
        case 'fajr': return at(base, T.Sunrise);
        case 'dhuhr': return at(base, T.Asr);
        case 'asr': return at(base, T.Maghrib);
        case 'maghrib': return at(base, T.Isha);
        default: { const nk = addDays(dk, 1); return at(pkey(nk).getTime(), timingsFor(nk).Fajr); }
    }
}

/* ===== ১১. কাজা নামাজ: ওয়াক্ত শেষ হলে টিক না থাকলে নিজে থেকে যোগ হয় ===== */
const qadaHas = id => S.qada.items.some(i => i.id === id);
const qadaPending = () => S.qada.items.filter(i => !i.done);
const qadaBaseTotal = () => PR.reduce((a, p) => a + (S.qada.base[p.k] || 0), 0);
const qadaTotal = () => qadaPending().length + qadaBaseTotal();
function removeAutoQada(k, pk) {
    const id = k + '_' + pk, n = S.qada.items.length;
    S.qada.items = S.qada.items.filter(i => !(i.id === id && !i.done));
    return S.qada.items.length !== n;
}
function qadaSweep(days) {
    if (!S.set.f.qada || !S) return false;
    const now = Date.now(), today = dkey();
    days = days || [addDays(today, -1), today];
    let changed = false;
    days.forEach(k => {
        if (k > today) return;
        const rec = S.days[k];
        PR.forEach(p => {
            const id = k + '_' + p.k;
            if (rec && rec.p && ((rec.p[p.k] || 0) & 1)) { if (removeAutoQada(k, p.k)) changed = true; return; }
            const end = waqtEndMs(k, p.k);
            if (end <= now && end > S.meta.qadaFrom && !qadaHas(id)) {
                S.qada.items.push({ id: id, pr: p.k, d: k, a: 1, done: 0, ts: now }); changed = true;
            }
        });
    });
    if (changed) { saveState(); if (typeof refreshUI === 'function') refreshUI(); }
    return changed;
}
let PENDING_GAP = null;
function qadaBoot() {
    const today = dkey(), yesterday = addDays(today, -1);
    const L = S.meta.lastSeen && S.meta.lastSeen <= today ? S.meta.lastSeen : today;
    let normal = [yesterday, today], gap = [];
    if (L < yesterday) {
        normal = [L, today];
        for (let k = addDays(L, 1); k < today; k = addDays(k, 1)) gap.push(k);
    }
    qadaSweep(normal);
    S.meta.lastSeen = today; saveState();
    if (!gap.length || !S.set.f.qada || !S.set.f.qadaGap) return;
    const missed = {}; let total = 0;
    PR.forEach(p => { missed[p.k] = 0; });
    gap.forEach(k => { const r = S.days[k]; PR.forEach(p => { if (!(r && r.p && ((r.p[p.k] || 0) & 1))) { missed[p.k]++; total++; } }); });
    if (!total) return;
    PENDING_GAP = { missed: missed, total: total, from: gap[0], to: gap[gap.length - 1], n: gap.length };
    setTimeout(() => {
        openSheet('<p class="lead">আপনি ' + bn(gap.length) + ' দিন অ্যাপ খোলেননি (' + fmtShort(gap[0]) + (gap.length > 1 ? ' থেকে ' + fmtShort(gap[gap.length - 1]) : '') + ')। ওই দিনগুলোর মোট <b>' + bn(total) + ' ওয়াক্ত</b> নামাজ কি কাজা তালিকায় যোগ করবেন?</p>' +
            '<p class="muted sm">যোগ করলে "পুরনো কাজা" গণনায় বাড়বে, পরে নিজে কমাতে-বাড়াতে পারবেন। না চাইলে "না" চাপুন, কিছুই বদলাবে না।</p>' +
            '<div class="dlg-btns"><button type="button" class="btn ghost" data-act="gap-no">না, দরকার নেই</button><button type="button" class="btn primary" data-act="gap-yes">হ্যাঁ, যোগ করুন</button></div>', { title: 'অ্যাপ বন্ধ থাকা দিনের নামাজ', onClose: () => { PENDING_GAP = null; } });
    }, 700);
}
ACT['gap-yes'] = () => {
    if (PENDING_GAP) { PR.forEach(p => { S.qada.base[p.k] = (S.qada.base[p.k] || 0) + PENDING_GAP.missed[p.k]; }); S.qada.baseTs = Date.now(); saveState(); }
    PENDING_GAP = null; closeSheet(true); toast('কাজা তালিকায় যোগ হয়েছে'); refreshUI();
};
ACT['gap-no'] = () => { PENDING_GAP = null; closeSheet(true); };

/* ===== ১২. হাদিস: প্রতি ২ ঘণ্টায় নতুন ===== */
function hadithSlot(d) {
    d = d || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) * 12 + Math.floor(d.getHours() / 2);
}
const hadithNow = d => HADITHS[hadithSlot(d) % HADITHS.length];
function hadithNextAt(d) {
    d = d || new Date();
    const h = (Math.floor(d.getHours() / 2) + 1) * 2;
    return fmtClock(pad2(h % 24) + ':00');
}

/* ===== ১৩. নোটিফিকেশন ===== */
const notifOK = () => 'Notification' in window;
async function askNotif() {
    if (!notifOK()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
}
function notify(title, body, tag, toastFallback) {
    try {
        if (notifOK() && Notification.permission === 'granted') { new Notification(title, { body: body, tag: tag || undefined }); return true; }
    } catch (e) { }
    if (toastFallback) toast(title + ': ' + body, { ms: 6000 });
    return false;
}
function vibrate(p) { if (S && S.set.f.vib && 'vibrate' in navigator) { try { navigator.vibrate(p); } catch (e) { } } }
let audioCtx = null;
function clickSound() {
    if (!S.set.f.sound) return;
    try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime;
        o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.06);
        g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.1);
    } catch (e) { }
}

/* ===== ১৪. সময়ের টিক: প্রতি সেকেন্ডে কাউন্টডাউন, প্রতি ৩০ সেকেন্ডে ঝাড়ু ===== */
let lastWaqtKey = null, curDay = dkey(), lastPrayerNotif = '';
function tick1() {
    if (!S) return;
    const w = waqtNow(), k = w.key || 'x';
    if (lastWaqtKey !== null && k !== lastWaqtKey) {
        applyTheme(); qadaSweep();
        if (S.set.n.prayer && w.key && w.cur - w.start < 120 && lastPrayerNotif !== dkey() + w.key) {
            lastPrayerNotif = dkey() + w.key;
            notify('ওয়াক্ত শুরু হয়েছে', w.name + ' নামাজের ওয়াক্ত শুরু হয়েছে।', 'prayer', true);
        }
        if (curTab === 'home' || curTab === 'track') renderTab(curTab);
    }
    lastWaqtKey = k;
    if (curTab === 'home') paintHeroTick(w);
}
function tick30() {
    if (!S) return;
    const today = dkey();
    if (today !== curDay) {
        curDay = today; lastFetchDay = ''; TIMSRC = TIMSRC === 'live' ? 'cache' : TIMSRC;
        if (trackDate === addDays(today, -1)) trackDate = today;
        if (LOC) loadTimes(LOC.lat, LOC.lon);
        S.meta.lastSeen = today; saveState();
    } else if (LOC && lastFetchDay !== today && navigator.onLine) loadTimes(LOC.lat, LOC.lon);
    qadaSweep();
    const slot = hadithSlot();
    if (S.set.n.hadith && S.meta.hSlotN !== slot) {
        S.meta.hSlotN = slot; saveState();
        const h = hadithNow(); notify('আজকের হাদিস', h.t, 'hadith', document.visibilityState === 'visible' && !notifOK());
    }
    if (curTab === 'home' && S.set.f.hadith) { const hc = $('#hadithBox'); if (hc && +hc.dataset.slot !== slot) renderTab('home'); }
    if (S.set.auto) applyTheme();
}
window.addEventListener('online', () => { if (LOC) loadTimes(LOC.lat, LOC.lon); if (typeof cloudSync === 'function' && Cloud.user) cloudSync('online'); });
document.addEventListener('visibilitychange', () => {
    if (document.hidden || !S) return;
    tick30();
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => gotPos(p, false), () => { }, { maximumAge: 60000, timeout: 8000 });
});/* ===== ১৫. পেজ নেভিগেশন ===== */
const TABS = [['home', 'হোম', 'home'], ['track', 'ট্র্যাকার', 'list'], ['report', 'রিপোর্ট', 'chart'], ['tasbeeh', 'তাসবিহ', 'beads'], ['quran', 'কুরআন', 'book'], ['profile', 'প্রোফাইল', 'user']];
let curTab = 'home', trackDate = dkey(), reportRange = 'week', qadaAll = false, notesAll = false;
const RENDER = {};
function renderNav() {
    $('#nav').innerHTML = TABS.map(t => '<button type="button" class="nav-b' + (t[0] === curTab ? ' on' : '') + '" data-act="go" data-tab="' + t[0] + '" aria-label="' + t[1] + '"' + (t[0] === curTab ? ' aria-current="page"' : '') + '>' + icon(t[2], 21, 2.1) + '<span>' + t[1] + '</span></button>').join('');
}
function go(tab) {
    curTab = tab;
    $$('.tab').forEach(e => e.classList.toggle('on', e.id === 'tab-' + tab));
    renderNav(); renderTab(tab);
    const sc = $('#scroll'); if (sc) sc.scrollTop = 0;
}
ACT.go = el => go(el.dataset.tab);
function renderTab(t) { const f = RENDER[t]; if (f) f(); }
function refreshUI() { renderTab(curTab); }
function commit() { checkLevelUp(); saveState(); refreshUI(); }
function copyText(txt) {
    const ok = () => toast('কপি হয়েছে');
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(ok, () => fallbackCopy(txt, ok)); }
    else fallbackCopy(txt, ok);
}
function fallbackCopy(txt, ok) {
    const a = document.createElement('textarea'); a.value = txt; a.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); ok(); } catch (e) { toast('কপি করা গেল না'); }
    a.remove();
}
function fmtLeft(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    return h > 0 ? bn(h) + ' ঘণ্টা ' + bn(m) + ' মিনিট' : bn(Math.max(1, m)) + ' মিনিট';
}
function ringSVG(pct, size, sw, cls) {
    const r = (size - sw) / 2, c = 2 * Math.PI * r, h = size / 2;
    return '<svg class="ring ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle class="rg-t" cx="' + h + '" cy="' + h + '" r="' + r + '" fill="none" stroke-width="' + sw + '"/><circle class="rg-v" cx="' + h + '" cy="' + h + '" r="' + r + '" fill="none" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - clamp(pct, 0, 100) / 100)).toFixed(1) + '" transform="rotate(-90 ' + h + ' ' + h + ')"/></svg>';
}
function segHTML(items, active, act) {
    return '<div class="seg" role="tablist" style="grid-template-columns:repeat(' + items.length + ',minmax(0,1fr))">' + items.map(i =>
        '<button type="button" role="tab" aria-selected="' + (i[0] === active) + '" class="' + (i[0] === active ? 'on' : '') + '" data-act="' + act + '" data-v="' + i[0] + '">' + i[1] + '</button>').join('') + '</div>';
}
function missionRow(o) {
    const box = o.done ? '<span class="mis-box on">' + icon('check', 16, 3) + '</span>' : '<span class="mis-box"></span>';
    const bar = !o.done && o.pct != null ? '<div class="bar sm"><i style="width:' + o.pct + '%"></i></div>' : '';
    return '<button type="button" class="mis' + (o.done ? ' done' : '') + '" ' + o.attrs + '>' + box + '<span class="mis-t"><b>' + o.title + '</b><small>' + o.sub + '</small>' + bar + '</span><span class="mis-p">+' + bn(o.pts) + '</span></button>';
}

/* ===== ১৬. হোম ===== */
function skyArt(sky) {
    if (sky === 'isha') {
        const st = [[52, 150], [96, 112], [140, 96], [300, 140], [330, 190], [214, 66], [178, 128], [70, 196], [318, 110], [122, 172], [262, 170], [196, 98], [284, 84], [40, 206]];
        return '<circle cx="250" cy="104" r="46" fill="#e9dcb9" opacity=".08"/><path d="M250 80a23 23 0 1 0 15 40a18 18 0 1 1-15-40z" fill="#f1e6c8"/>' +
            st.map((p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (1 + (i % 3) * .35) + '" fill="#fff" opacity="' + (.55 + (i % 4) * .1).toFixed(2) + '"/>').join('');
    }
    if (sky === 'maghrib') return '<circle cx="268" cy="226" r="70" fill="#ffd88a" opacity=".28"/><circle cx="268" cy="226" r="27" fill="#ffd88a"/><ellipse cx="90" cy="150" rx="52" ry="8" fill="#f6ebdc" opacity=".22"/><ellipse cx="130" cy="166" rx="34" ry="6" fill="#f6ebdc" opacity=".18"/>';
    if (sky === 'asr') return '<circle cx="262" cy="170" r="56" fill="#fff0c2" opacity=".5"/><circle cx="262" cy="170" r="24" fill="#ffd36e"/><ellipse cx="90" cy="130" rx="40" ry="8" fill="#fff" opacity=".5"/><ellipse cx="124" cy="144" rx="26" ry="6" fill="#fff" opacity=".4"/>';
    if (sky === 'day') return '<circle cx="262" cy="100" r="50" fill="#fffbe0" opacity=".5"/><circle cx="262" cy="100" r="22" fill="#fff6c2"/><ellipse cx="90" cy="120" rx="44" ry="9" fill="#fff" opacity=".7"/><ellipse cx="128" cy="134" rx="28" ry="7" fill="#fff" opacity=".55"/><ellipse cx="300" cy="170" rx="34" ry="7" fill="#fff" opacity=".5"/>';
    return '<circle cx="96" cy="222" r="56" fill="#fff6d6" opacity=".5"/><circle cx="96" cy="222" r="22" fill="#fff4c9"/><ellipse cx="250" cy="120" rx="46" ry="9" fill="#fff" opacity=".55"/><ellipse cx="282" cy="132" rx="30" ry="7" fill="#fff" opacity=".45"/><ellipse cx="70" cy="140" rx="34" ry="7" fill="#fff" opacity=".45"/>';
}
function heroHTML(w) {
    const arch = 'M0 420V200C0 110 70 50 179 4C288 50 358 110 358 200V420Z', inner = 'M10 420V204C10 120 76 62 179 18C282 62 348 120 348 204V420';
    const sil = '<g style="fill:var(--sil)"><rect x="110" y="214" width="138" height="20"/><path d="M122 214C122 184 152 170 179 160C206 170 236 184 236 214z"/><rect x="177" y="146" width="4" height="14"/><circle cx="179" cy="143" r="4"/><rect x="78" y="168" width="12" height="66"/><path d="M76 168L84 146L92 168z"/><rect x="268" y="168" width="12" height="66"/><path d="M266 168L274 146L282 168z"/><rect x="0" y="232" width="358" height="12"/></g>';
    return '<section class="hero" data-sky="' + w.sky + '" aria-label="চলমান ওয়াক্ত"><svg class="hero-svg" viewBox="0 0 358 420" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>' +
        '<linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sk1)"/><stop offset=".55" style="stop-color:var(--sk2)"/><stop offset="1" style="stop-color:var(--sk3)"/></linearGradient>' +
        '<linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--surface);stop-opacity:0"/><stop offset=".28" style="stop-color:var(--surface);stop-opacity:.96"/><stop offset="1" style="stop-color:var(--surface)"/></linearGradient>' +
        '<clipPath id="archC"><path d="' + arch + '"/></clipPath></defs><g clip-path="url(#archC)"><rect width="358" height="420" style="fill:var(--surface)"/><rect width="358" height="244" fill="url(#skyG)"/>' + skyArt(w.sky) + sil + '<rect y="214" width="358" height="206" fill="url(#fadeG)"/></g>' +
        '<path d="' + arch + '" fill="none" style="stroke:var(--accent)" stroke-width="1.6"/><path d="' + inner + '" fill="none" style="stroke:var(--accent)" stroke-opacity=".35"/></svg>' +
        '<div class="hero-in"><span class="muted sm" id="wqLabel">' + (w.key ? 'চলমান ওয়াক্ত' : 'এখন নামাজের ওয়াক্ত নেই') + '</span>' +
        '<span class="tiro hero-name" id="wqName">' + w.name + '</span><span class="ar hero-ar" lang="ar">' + (w.ar || '&nbsp;') + '</span>' +
        '<div class="hero-count"><b id="wqCount">' + fmtDur(w.left) + '</b><span class="muted sm" id="wqSuffix">' + (w.key ? 'শেষ হতে বাকি' : 'যোহর শুরু হতে বাকি') + '</span></div>' +
        '<div class="bar"><i id="wqBar" style="width:' + (100 - w.pct).toFixed(1) + '%"></i></div>' +
        '<div class="hero-loc"><span class="loc-text">' + esc(locText()) + '</span><button type="button" class="link" data-act="loc-refresh">' + icon('refresh', 16, 2.2) + ' আপডেট</button></div>' +
        '<span class="muted xs loc-note">' + locNote() + '</span></div></section>';
}
function paintHeroTick(w) {
    const c = $('#wqCount'); if (!c) return;
    c.textContent = fmtDur(w.left);
    const b = $('#wqBar'); if (b) b.style.width = (100 - w.pct).toFixed(1) + '%';
    const nl = $('#nextLine'); if (nl) nl.textContent = 'পরের নামাজ ' + w.next.n + ', ' + fmtClock(w.next.t) + ' (আর ' + fmtLeft(w.next.inSec) + ')';
    const fb = $('#forbBox');
    if (fb) { const on = !!(w.forb && S.set.f.forbidden); fb.hidden = !on; if (on) $('#forbText').textContent = w.forb; }
}
ACT['loc-refresh'] = () => { toast('লোকেশন আপডেট হচ্ছে…'); startLocation(true); };
function timelineHTML(k, w) {
    const rec = S.days[k], T = timingsFor(k);
    return '<section class="timeline" aria-label="আজকের পাঁচ ওয়াক্ত"><div class="tl-line"></div>' + PR.map(p => {
        const done = rec && rec.p && ((rec.p[p.k] || 0) & 1), now = w.key === p.k, miss = !done && qadaHas(k + '_' + p.k) && !S.qada.items.find(i => i.id === k + '_' + p.k).done;
        return '<div class="tl-i' + (done ? ' done' : '') + (now ? ' now' : '') + (miss ? ' miss' : '') + '"><span class="tl-dot">' + (done ? icon('check', 11, 3.6) : '') + '</span><b>' + p.n + '</b><small>' + fmtClock(T[p.tk]).replace(' ', '&nbsp;') + '</small></div>';
    }).join('') + '</section>';
}
RENDER.home = function () {
    const el = $('#tab-home'), k = dkey(), rec = S.days[k], w = waqtNow();
    const pts = totalPoints(), bl = badgeLevel(), lv = levelInfo(pts), sc = dayScore(rec), st = streak();
    const sl = hadithSlot(), h = hadithNow(), hij = hijriText();
    const nF = fardCount(rec), pend = qadaTotal(), last = S.quran.last, sur = SURAHS[(last.s || 1) - 1];
    el.innerHTML =
        '<header class="top"><div class="top-l"><span class="muted sm">আসসালামু আলাইকুম</span><h1 class="tiro h1">' + esc(S.user.name) + ' ' + honorific() + '</h1>' +
        '<span class="muted sm">' + fmtDate(k, true) + '</span>' + (hij ? '<span class="muted xs">' + hij + '</span>' : '') + '</div>' +
        '<button type="button" class="iconbtn lg" data-act="go" data-tab="profile" aria-label="প্রোফাইল">' + icon(S.user.avatar || 'mosque', 24) + '</button></header>' +
        heroHTML(w) +
        '<p class="next-line" id="nextLine">পরের নামাজ ' + w.next.n + ', ' + fmtClock(w.next.t) + ' (আর ' + fmtLeft(w.next.inSec) + ')</p>' +
        '<div class="notice warn" id="forbBox" role="alert"' + (w.forb && S.set.f.forbidden ? '' : ' hidden') + '>' + icon('alert', 20, 2) + '<span id="forbText">' + esc(w.forb || '') + '</span></div>' +
        timelineHTML(k, w) +
        '<section class="card stats3" aria-label="আপনার অগ্রগতি">' +
        '<div class="st"><span class="st-ic fl">' + icon('flame', 22, 2) + '</span><b class="tiro">' + bn(st) + '</b><small>দিনের স্ট্রেইক</small></div>' +
        '<div class="st ringst">' + ringSVG(sc, 58, 6, 'gold') + '<b class="tiro rg-n">' + bn(sc) + '%</b><small>আজকের স্কোর</small></div>' +
        '<button type="button" class="st lvst" data-act="go" data-tab="profile" aria-label="লেভেল ও ব্যাজ দেখুন"><span class="mini-medal">' + medal(bl, 'current', 'h') + '</span><b class="tiro">লেভেল ' + bn(bl + 1) + '</b><small>' + LEVELS[bl][0] + '</small></button></section>' +
        (S.set.f.hadith ? '<article class="card hadith" id="hadithBox" data-slot="' + sl + '"><div class="orn"><span></span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></svg><span></span></div>' +
            '<div class="hd-top"><b class="tiro">হাদিস</b><small class="muted">ভাবার্থ</small></div><p class="hd-text tiro">' + esc(h.t) + '</p>' +
            '<div class="hd-foot"><span class="muted sm">' + esc(h.r) + '</span><button type="button" class="iconbtn sm" data-act="copy-hadith" aria-label="হাদিস কপি করুন">' + icon('copy', 18) + '</button></div>' +
            '<p class="muted xs hd-next">পরের হাদিস আসবে ' + hadithNextAt() + '-এ</p></article>' : '') +
        '<section class="card" aria-label="আজকের আমল"><div class="card-h"><h2 class="tiro">আজকের আমল</h2><span class="muted sm">' + fmtShort(k) + '</span></div>' +
        missionRow({ done: nF >= 5, title: 'ফরজ নামাজ', sub: bn(nF) + ' / ৫ ওয়াক্ত সম্পন্ন', pts: P_FARD * 5, pct: nF * 20, attrs: 'data-act="go" data-tab="track"' }) +
        DEEDS.map(d => missionRow({ done: !!(rec && rec.a && rec.a[d.k]), title: d.n, sub: d.sub, pts: P_DEED, pct: 0, attrs: 'data-act="deed" data-d="' + d.k + '" data-k="' + k + '"' })).join('') + '</section>' +
        '<div class="quick">' +
        (S.set.f.qada && pend > 0 ? '<button type="button" class="qk warn" data-act="go" data-tab="track">' + icon('shield', 20, 2) + '<span><b>কাজা বাকি ' + bn(pend) + ' ওয়াক্ত</b><small>আদায় করে নিন</small></span></button>' : '') +
        '<button type="button" class="qk" data-act="go" data-tab="quran">' + icon('book', 20, 2) + '<span><b>চালিয়ে পড়ুন</b><small>সূরা ' + sur.bn + ', আয়াত ' + bn(last.a || 1) + '</small></span></button>' +
        '<button type="button" class="qk" data-act="go" data-tab="tasbeeh">' + icon('beads', 20, 2) + '<span><b>তাসবিহ</b><small>আজ ' + bn((rec && rec.tas) || 0) + ' বার</small></span></button></div>';
};
ACT['copy-hadith'] = () => { const h = hadithNow(); copyText('“' + h.t + '”\n— ' + h.r); };
ACT.deed = el => {
    const k = el.dataset.k || dkey(), rec = rec4(k), d = el.dataset.d;
    if (rec.a[d]) delete rec.a[d]; else { rec.a[d] = 1; vibrate(20); }
    rec.ts = Date.now(); commit();
};

/* ===== ১৭. ট্র্যাকার (নামাজ, কাজা, আমল, নোট) ===== */
function tgl(kind, on, label, sub, attrs) {
    return '<button type="button" class="tg tg-' + kind + (on ? ' on' : '') + '" aria-pressed="' + !!on + '" ' + attrs + '><span class="tg-box">' + (on ? icon('check', 15, 3.2) : '') + '</span><span class="tg-t"><b>' + label + '</b><small>' + sub + '</small></span></button>';
}
function prayerCard(k, p, rec) {
    const v = (rec.p && rec.p[p.k]) || 0, fOn = v & 1, sOn = v & 2, T = timingsFor(k)[p.tk], id = k + '_' + p.k;
    const item = S.qada.items.find(i => i.id === id), sunOn = S.set.f.sunnah;
    let fard;
    if (fOn) fard = tgl('f', true, 'ফরজ', '+' + bn(P_FARD) + ' পয়েন্ট', 'data-act="tick" data-k="' + k + '" data-p="' + p.k + '" data-b="1"');
    else if (item && !item.done) fard = '<button type="button" class="tg tg-miss" data-act="miss-info" data-k="' + k + '" data-p="' + p.k + '"><span class="tg-t"><b>ওয়াক্ত শেষ</b><small>কাজায় যোগ হয়েছে</small></span></button>';
    else if (item && item.done) fard = '<div class="tg tg-qd"><span class="tg-box">' + icon('check', 15, 3.2) + '</span><span class="tg-t"><b>কাজা আদায়</b><small>আলহামদুলিল্লাহ</small></span></div>';
    else fard = tgl('f', false, 'ফরজ', '+' + bn(P_FARD) + ' পয়েন্ট', 'data-act="tick" data-k="' + k + '" data-p="' + p.k + '" data-b="1"');
    let sun = '';
    if (sunOn) sun = p.sun ? tgl('s', !!sOn, 'সুন্নত', p.sun, 'data-act="tick" data-k="' + k + '" data-p="' + p.k + '" data-b="2"')
        : '<div class="tg tg-none">মুয়াক্কাদা সুন্নত নেই, ইচ্ছা হলে ৪ রাকাত নফল</div>';
    return '<article class="pcard"><div class="pc-h"><h3 class="tiro">' + p.n + '</h3><span class="muted sm">' + fmtClock(T) + '</span></div><div class="pc-b' + (sunOn ? '' : ' one') + '">' + fard + sun + '</div></article>';
}
function qadaCardHTML() {
    const pend = qadaPending().sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : PR.findIndex(x => x.k === b.pr) - PR.findIndex(x => x.k === a.pr));
    const show = qadaAll ? pend : pend.slice(0, 6);
    const rows = show.map(i => '<div class="qrow"><div><b>' + PRN[i.pr].n + '</b><small class="muted">' + relDay(i.d) + (i.d !== dkey() ? '' : ', ' + fmtDate(i.d)) + '</small></div><button type="button" class="btn sm outline" data-act="qada-done" data-id="' + i.id + '">' + icon('check', 16, 3) + ' আদায় করেছি</button></div>').join('');
    const base = PR.map(p => '<div class="qrow"><b>' + p.n + '</b><div class="cnt"><button type="button" class="cbtn" data-act="qb" data-p="' + p.k + '" data-d="-1" aria-label="' + p.n + ' কমান">' + icon('minus', 18, 2.4) + '</button><b class="cnum" aria-live="polite">' + bn(S.qada.base[p.k] || 0) + '</b><button type="button" class="cbtn pl" data-act="qb" data-p="' + p.k + '" data-d="1" aria-label="' + p.n + ' বাড়ান">' + icon('plus', 18, 2.6) + '</button></div></div>').join('');
    return '<section class="card" id="qadaCard"><div class="card-h"><h2 class="tiro">কাজা নামাজ</h2><span class="chip gold">মোট বাকি ' + bn(qadaTotal()) + '</span></div>' +
        '<p class="muted sm">ওয়াক্ত শেষ হওয়ার পরও টিক না থাকলে নামাজ নিজে থেকে এখানে যোগ হয়। আদায় করলে "আদায় করেছি" চাপুন।</p>' +
        '<h3 class="sub-h">নিজে থেকে যোগ হয়েছে (' + bn(pend.length) + ')</h3>' + (rows || '<p class="empty">কোনো কাজা নেই, আলহামদুলিল্লাহ।</p>') +
        (pend.length > 6 ? '<button type="button" class="link wide" data-act="qada-all">' + (qadaAll ? 'কম দেখান' : 'আরও ' + bn(pend.length - 6) + 'টি দেখান') + '</button>' : '') +
        '<h3 class="sub-h">পুরনো কাজা, নিজে যোগ করুন (' + bn(qadaBaseTotal()) + ')</h3><p class="muted sm">আগের বছরের বাকি নামাজ এখানে গুনে রাখুন। এক ওয়াক্ত আদায় করলে কমিয়ে দিন।</p>' + base +
        (S.set.f.qadaGap ? '<p class="note-box">অ্যাপ খোলা হয়নি এমন দিনের নামাজ নিজে থেকে যোগ হয় না। অ্যাপ খুললে জিজ্ঞেস করবে।</p>' : '') + '</section>';
}
ACT['qada-all'] = () => { qadaAll = !qadaAll; refreshUI(); };
ACT['qada-done'] = el => {
    const it = S.qada.items.find(i => i.id === el.dataset.id); if (!it || it.done) return;
    it.done = Date.now(); S.qada.baseTs = S.qada.baseTs || 0; vibrate(25); commit();
    toast('আলহামদুলিল্লাহ, কাজা আদায় হলো (+' + bn(P_QADA) + ')', { act: 'ফিরিয়ে নিন', fn: () => { it.done = 0; commit(); } });
};
ACT.qb = el => {
    const p = el.dataset.p, d = +el.dataset.d;
    S.qada.base[p] = Math.max(0, (S.qada.base[p] || 0) + d); S.qada.baseTs = Date.now();
    saveState(); refreshUI();
};
function tickPrayer(k, pk, bit) {
    const r0 = S.days[k], cur = (r0 && r0.p && r0.p[pk]) || 0;
    if (!(cur & bit) && k === dkey() && waqtStartMs(k, pk) > Date.now()) { toast(PRN[pk].n + ' নামাজের ওয়াক্ত এখনো শুরু হয়নি'); return; }
    const rec = rec4(k);
    rec.p[pk] = (rec.p[pk] || 0) ^ bit; if (!rec.p[pk]) delete rec.p[pk];
    rec.ts = Date.now();
    if (bit === 1 && (rec.p[pk] & 1)) { removeAutoQada(k, pk); vibrate(20); }
    qadaSweep([k]);
    commit();
}
ACT.tick = el => tickPrayer(el.dataset.k, el.dataset.p, +el.dataset.b);
ACT['miss-info'] = el => {
    const k = el.dataset.k, p = el.dataset.p;
    openSheet('<p class="lead">' + PRN[p].n + ' নামাজের ওয়াক্ত শেষ হয়ে গেছে, তাই এটি কাজা তালিকায় আছে।</p><p class="muted">আপনি কি ওয়াক্তের ভেতরেই পড়েছিলেন, শুধু টিক দিতে ভুলে গিয়েছিলেন?</p>' +
        '<div class="stack"><button type="button" class="btn primary" data-act="miss-ontime" data-k="' + k + '" data-p="' + p + '">হ্যাঁ, ওয়াক্তে পড়েছি, টিক দিন</button>' +
        '<button type="button" class="btn outline" data-act="miss-qada" data-id="' + k + '_' + p + '">না, এখন কাজা আদায় করেছি</button></div>', { title: PRN[p].n + ' (' + relDay(k) + ')' });
};
ACT['miss-ontime'] = el => { closeSheet(true); const k = el.dataset.k, p = el.dataset.p; const rec = rec4(k); rec.p[p] = (rec.p[p] || 0) | 1; rec.ts = Date.now(); removeAutoQada(k, p); commit(); };
ACT['miss-qada'] = el => { closeSheet(true); ACT['qada-done']({ dataset: { id: el.dataset.id } }); };
INP.note = el => {
    const rec = rec4(trackDate); rec.note = el.value; rec.ts = Date.now();
    saveState();
};
RENDER.track = function () {
    const el = $('#tab-track'), k = trackDate, today = dkey(), rec = S.days[k] || newDay();
    const sunOn = S.set.f.sunnah, f = fardCount(rec), s = sunCount(rec), den = 5 + (sunOn ? 4 : 0), pct = Math.round((f + (sunOn ? s : 0)) / den * 100);
    const noteActive = document.activeElement && document.activeElement.id === 'noteArea';
    const miss = PR.filter(p => { const it = S.qada.items.find(i => i.id === k + '_' + p.k); return it && !it.done && it.a; }).length;
    el.innerHTML =
        '<header class="top"><div class="top-l"><span class="muted sm">আজকের মুহাসাবাহ</span><h1 class="tiro h1">নামাজ ও আমল</h1></div></header>' +
        '<div class="datebar"><button type="button" class="iconbtn" data-act="day" data-d="-1" aria-label="আগের দিন">' + icon('back', 20, 2.4) + '</button>' +
        '<div class="db-m"><b>' + fmtDate(k, true) + '</b><small class="muted">' + relDay(k) + '</small></div>' +
        '<button type="button" class="iconbtn" data-act="day" data-d="1" aria-label="পরের দিন"' + (k >= today ? ' disabled' : '') + '>' + icon('fwd', 20, 2.4) + '</button>' +
        (k !== today ? '<button type="button" class="btn sm primary" data-act="day-today">আজ</button>' : '') + '</div>' +
        '<section class="card raised score"><div class="sc-l"><span class="muted sm">নামাজের অর্জন</span><b class="tiro big">' + bn(pct) + '%</b></div><div class="sc-r muted sm">ফরজ <b>' + bn(f) + '/৫</b>' + (sunOn ? '<br>সুন্নত মুয়াক্কাদা <b>' + bn(s) + '/৪</b>' : '') + '</div><div class="bar full"><i style="width:' + pct + '%"></i></div></section>' +
        (miss && S.set.f.qada ? '<div class="notice warn">' + icon('shield', 20, 2) + '<span>' + bn(miss) + ' ওয়াক্তের সময় শেষ হয়ে গেছে, তাই কাজা তালিকায় যোগ হয়েছে। সুযোগ পেলেই আদায় করে নিন।</span></div>' : '') +
        '<div class="plist">' + PR.map(p => prayerCard(k, p, rec)).join('') + '</div>' +
        '<section class="card" aria-label="অন্যান্য আমল"><div class="card-h"><h2 class="tiro">নফল আমল</h2></div>' +
        DEEDS.map(d => missionRow({ done: !!(rec.a && rec.a[d.k]), title: d.n, sub: d.sub, pts: P_DEED, pct: 0, attrs: 'data-act="deed" data-d="' + d.k + '" data-k="' + k + '"' })).join('') + '</section>' +
        (S.set.f.qada ? qadaCardHTML() : '') +
        '<section class="card"><div class="card-h"><h2 class="tiro">মুহাসাবাহ নোট</h2></div><textarea id="noteArea" class="field area" data-in="note" rows="4" maxlength="2000" placeholder="আজ কী ভালো করলাম, কোথায় ভুল হলো, কাল কী করব…">' + esc(rec.note || '') + '</textarea><p class="muted xs">নোট নিজে থেকেই সেভ হয়।</p></section>';
    if (noteActive) { const n = $('#noteArea'); if (n) n.focus(); }
};
ACT.day = el => { const nk = addDays(trackDate, +el.dataset.d); if (nk <= dkey()) { trackDate = nk; refreshUI(); } };
ACT['day-today'] = () => { trackDate = dkey(); refreshUI(); };

/* ===== ১৮. রিপোর্ট ===== */
ACT.range = el => { reportRange = el.dataset.v; refreshUI(); };
ACT['notes-all'] = () => { notesAll = !notesAll; refreshUI(); };
function rangeStats(fromK, toK) {
    const o = { days: 0, pts: 0, f: 0, s: 0, deeds: { quran: 0, zikr: 0, tahajjud: 0 }, per: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, tas: 0 };
    Object.keys(S.days).forEach(k => {
        if (k < fromK || k > toK) return;
        const r = S.days[k]; if (!hasActivity(r)) return;
        o.days++; o.pts += dayPts(r); o.f += fardCount(r); o.s += sunCount(r); o.tas += r.tas || 0;
        PR.forEach(p => { if ((r.p[p.k] || 0) & 1) o.per[p.k]++; });
        DEEDS.forEach(d => { if (r.a[d.k]) o.deeds[d.k]++; });
    });
    return o;
}
function barChart(bars, label) {
    const W = 340, H = 150, pad = 22, n = bars.length, bw = (W - 8) / n, gap = Math.min(8, bw * .3);
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + (H + pad) + '" role="img" aria-label="' + esc(label) + '">' +
        [0, 50, 100].map(v => '<line x1="0" x2="' + W + '" y1="' + (H - v / 100 * (H - 10)) + '" y2="' + (H - v / 100 * (H - 10)) + '" class="gl"/>').join('') +
        bars.map((b, i) => {
            const h = Math.max(b.v > 0 ? 3 : 0, b.v / 100 * (H - 10)), x = 4 + i * bw + gap / 2, w = bw - gap;
            return '<rect x="' + x.toFixed(1) + '" y="' + (H - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(5, w / 2).toFixed(1) + '" class="bar-r' + (b.today ? ' today' : '') + '"/>' +
                (b.l ? '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (H + 15) + '" text-anchor="middle" class="ax">' + b.l + '</text>' : '');
        }).join('') + '</svg>';
}
function longestStreak() {
    const ks = Object.keys(S.days).filter(k => isActiveDay(S.days[k])).sort();
    let best = 0, cur = 0, prev = null;
    ks.forEach(k => { cur = prev && addDays(prev, 1) === k ? cur + 1 : 1; if (cur > best) best = cur; prev = k; });
    return best;
}
RENDER.report = function () {
    const el = $('#tab-report'), today = dkey();
    let bars = [], from, label;
      if (reportRange === 'all') {
        const d0 = new Date(), created = new Date(S.meta.created || Date.now());
        let months = clamp((d0.getFullYear() - created.getFullYear()) * 12 + (d0.getMonth() - created.getMonth()) + 1, 1, 120);
        label = 'সারাজীবনের গড় স্কোর (মাস অনুযায়ী)';
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1), y = d.getFullYear(), m = d.getMonth();
            const dim = new Date(y, m + 1, 0).getDate(), lim = (y === d0.getFullYear() && m === d0.getMonth()) ? d0.getDate() : dim;
            let sum = 0; for (let j = 1; j <= lim; j++) sum += dayScore(S.days[y + '-' + pad2(m + 1) + '-' + pad2(j)]);
            bars.push({ v: Math.round(sum / lim), l: months <= 24 ? BN_MONTHS[m].slice(0, 3) : (m === 0 ? bn(y) : ''), today: i === 0 });
        }
        from = dkey(new Date(d0.getFullYear(), d0.getMonth() - (months - 1), 1));
    
    } else if (reportRange === 'year') {
        const d0 = new Date(); label = 'গত ১২ মাসের গড় স্কোর';
        for (let i = 11; i >= 0; i--) {
            const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1), y = d.getFullYear(), m = d.getMonth();
            const dim = new Date(y, m + 1, 0).getDate(), lim = (y === d0.getFullYear() && m === d0.getMonth()) ? d0.getDate() : dim;
            let sum = 0; for (let j = 1; j <= lim; j++) sum += dayScore(S.days[y + '-' + pad2(m + 1) + '-' + pad2(j)]);
            bars.push({ v: Math.round(sum / lim), l: BN_MONTHS[m].slice(0, 3), today: i === 0 });
        }
        from = dkey(new Date(d0.getFullYear(), d0.getMonth() - 11, 1));
    } else {
        const n = reportRange === 'month' ? 30 : 7; label = n === 7 ? 'গত ৭ দিনের স্কোর' : 'গত ৩০ দিনের স্কোর';
        for (let i = n - 1; i >= 0; i--) {
            const k = addDays(today, -i), d = pkey(k);
            bars.push({ v: dayScore(S.days[k]), l: n === 7 ? BN_DAYS_S[d.getDay()] : (i % 5 === 0 ? bn(d.getDate()) : ''), today: i === 0 });
        }
        from = addDays(today, -(n - 1));
    }
    const rs = rangeStats(from, today), avg = bars.length ? Math.round(bars.reduce((a, b) => a + b.v, 0) / bars.length) : 0;
    const allDays = activeDaysCount(), notes = Object.keys(S.days).filter(k => (S.days[k].note || '').trim()).sort().reverse();
    const cal = [], first = new Date(); first.setDate(first.getDate() - 34);
    const start = new Date(first); start.setDate(first.getDate() - first.getDay());
    for (let i = 0; i < 42; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i); const k = dkey(d);
        if (k > today) { cal.push('<span class="hm none"></span>'); continue; }
        const sc = dayScore(S.days[k]), cl = sc === 0 ? (hasActivity(S.days[k]) ? 'l1' : 'l0') : sc < 40 ? 'l1' : sc < 80 ? 'l2' : 'l3';
        cal.push('<span class="hm ' + cl + (k === today ? ' tod' : '') + '" title="' + fmtShort(k) + ': ' + bn(sc) + '%"></span>');
    }
    const cnt = [['ফজর', rs.per.fajr], ['যোহর', rs.per.dhuhr], ['আসর', rs.per.asr], ['মাগরিব', rs.per.maghrib], ['ইশা', rs.per.isha], ['কুরআন', rs.deeds.quran], ['জিকির', rs.deeds.zikr], ['তাহাজ্জুদ', rs.deeds.tahajjud]];
    el.innerHTML =
        '<header class="top"><div class="top-l"><span class="muted sm">আপনার অগ্রগতি</span><h1 class="tiro h1">রিপোর্ট</h1></div></header>' +
        segHTML([['week', '৭ দিন'], ['month', '৩০ দিন'], ['year', '১২ মাস'], ['all', 'সর্বমোট']], reportRange, 'range') +
        '<section class="card"><div class="card-h"><h2 class="tiro">' + label + '</h2><span class="chip">গড় ' + bn(avg) + '%</span></div>' + barChart(bars, label + ', গড় ' + avg + ' শতাংশ') + '</section>' +
        '<section class="card stats3 plain"><div class="st"><span class="muted sm">সক্রিয় দিন</span><b class="tiro">' + bn(allDays) + '</b></div><div class="st"><span class="muted sm">এই সময়ে পয়েন্ট</span><b class="tiro">' + bn(rs.pts) + '</b></div><div class="st"><span class="muted sm">মোট পয়েন্ট</span><b class="tiro">' + bn(totalPoints()) + '</b></div></section>' +
        '<section class="card"><div class="card-h"><h2 class="tiro">এই সময়ের হিসাব</h2></div><div class="cgrid">' + cnt.map(c => '<div class="ct"><span>' + c[0] + '</span><b>' + bn(c[1]) + '</b></div>').join('') + '</div>' +
        '<div class="kv"><span>সুন্নত মুয়াক্কাদা</span><b>' + bn(rs.s) + '</b></div><div class="kv"><span>তাসবিহ গণনা</span><b>' + bn(rs.tas) + '</b></div><div class="kv"><span>কাজা আদায় (মোট)</span><b>' + bn(qadaDoneCount()) + '</b></div></section>' +
        '<section class="card"><div class="card-h"><h2 class="tiro">স্ট্রেইক ক্যালেন্ডার</h2><span class="chip gold">' + icon('flame', 14, 2.2) + ' ' + bn(streak()) + ' দিন</span></div>' +
        '<div class="hm-w">' + BN_DAYS_S.map(d => '<small>' + d + '</small>').join('') + '</div><div class="hm-g">' + cal.join('') + '</div>' +
        '<p class="muted xs">সবচেয়ে বড় স্ট্রেইক: <b>' + bn(longestStreak()) + ' দিন</b>। গাঢ় রঙ মানে সেদিন বেশি আমল হয়েছে।</p></section>' +
        '<section class="card"><div class="card-h"><h2 class="tiro">নোটের ইতিহাস</h2><span class="muted sm">' + bn(notes.length) + 'টি</span></div>' +
        (notes.length ? (notesAll ? notes : notes.slice(0, 5)).map(k => '<div class="note-i"><b>' + fmtDate(k) + '</b><p>' + esc(S.days[k].note) + '</p></div>').join('') : '<p class="empty">এখনো কোনো নোট লেখা হয়নি। ট্র্যাকার পেজে মুহাসাবাহ লিখুন।</p>') +
        (notes.length > 5 ? '<button type="button" class="link wide" data-act="notes-all">' + (notesAll ? 'কম দেখান' : 'সব নোট দেখান') + '</button>' : '') + '</section>';
};/* ===== ১৯. তাসবিহ (দানা ঘুরে সরে যায়, ইতিহাস সহ) ===== */
const BEAD_N = 33, BEAD_STEP = 360 / BEAD_N, BEAD_CX = 170, BEAD_CY = 158, BEAD_R = 118;
let beadRot = 0, beadAnim = 0;
const tasPh = () => TASBEEH.find(x => x.k === S.tas.cur.k) || TASBEEH[0];
const litCount = n => n <= 0 ? 0 : ((n - 1) % BEAD_N) + 1;
function beadsSVG(n) {
    const lit = litCount(n);
    let beads = '';
    for (let i = 0; i < BEAD_N; i++) {
        const th = (90 + i * BEAD_STEP) * Math.PI / 180, x = BEAD_CX + BEAD_R * Math.cos(th), y = BEAD_CY + BEAD_R * Math.sin(th);
        beads += '<circle class="bd" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="10.5" fill="url(#' + (i < lit ? 'bdL' : 'bdD') + ')"/><circle cx="' + (x - 3.2).toFixed(1) + '" cy="' + (y - 3.6).toFixed(1) + '" r="2.6" fill="#fff" opacity=".45"/>';
    }
    const ix = BEAD_CX, iy = BEAD_CY + BEAD_R;
    let tassel = '';
    [-15, -8, 0, 8, 15].forEach(d => { tassel += '<path d="M' + ix + ' ' + (iy + 16) + ' C ' + (ix + d * .3) + ' ' + (iy + 34) + ', ' + (ix + d) + ' ' + (iy + 44) + ', ' + (ix + d * 1.1) + ' ' + (iy + 84) + '" fill="none" stroke="#b08a4a" stroke-width="2.4" stroke-linecap="round"/>'; });
    return '<svg class="beads" viewBox="0 0 340 400" aria-hidden="true"><defs>' +
        '<radialGradient id="bdL" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff3c8"/><stop offset=".5" stop-color="#e9a21b"/><stop offset="1" stop-color="#8a5508"/></radialGradient>' +
        '<radialGradient id="bdD" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e9dfcc"/><stop offset="1" stop-color="#b5a58a"/></radialGradient>' +
        '<radialGradient id="bdI" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#b9f0d6"/><stop offset=".5" stop-color="#14684f"/><stop offset="1" stop-color="#0a3a2c"/></radialGradient></defs>' +
        '<circle cx="' + BEAD_CX + '" cy="' + BEAD_CY + '" r="' + BEAD_R + '" fill="none" stroke="#b08a4a" stroke-width="1.6" opacity=".65"/>' + tassel +
        '<g id="beadG" transform="rotate(' + beadRot.toFixed(2) + ' ' + BEAD_CX + ' ' + BEAD_CY + ')">' + beads + '</g>' +
        '<rect x="' + (ix - 5) + '" y="' + (iy + 11) + '" width="10" height="9" rx="3" fill="#14684f"/><ellipse cx="' + ix + '" cy="' + iy + '" rx="12.5" ry="16.5" fill="url(#bdI)"/><ellipse cx="' + (ix - 3.5) + '" cy="' + (iy - 5) + '" rx="3.2" ry="5" fill="#fff" opacity=".35"/></svg>';
}
function setBeadRot(deg) {
    beadRot = deg;
    const g = $('#beadG'); if (g) g.setAttribute('transform', 'rotate(' + deg.toFixed(2) + ' ' + BEAD_CX + ' ' + BEAD_CY + ')');
}
function animateBeads(to) {
    const from = beadRot, t0 = performance.now(), id = ++beadAnim;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { setBeadRot(to); return; }
    const dur = 190;
    (function step(t) {
        if (id !== beadAnim) return;
        const p = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
        setBeadRot(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(step);
    })(t0);
}
function paintLit(n) {
    const lit = litCount(n);
    $$('#beadG .bd').forEach((c, i) => c.setAttribute('fill', 'url(#' + (i < lit ? 'bdL' : 'bdD') + ')'));
}
function tasLine(n, goal) {
    if (!goal) return 'ফ্রি গণনা, মোট ' + bn(n);
    return 'লক্ষ্য ' + bn(goal) + (n >= goal ? ', পূর্ণ ' + bn(Math.floor(n / goal)) + ' বার' : ', বাকি ' + bn(goal - n));
}
function tasPaint() {
    const c = S.tas.cur;
    const nEl = $('#tasNum'); if (nEl) nEl.textContent = bn(c.n);
    const l = $('#tasLine'); if (l) l.textContent = tasLine(c.n, c.goal);
    const b = $('#tasBar'); if (b) b.style.width = (c.goal ? clamp((c.n % c.goal || (c.n ? c.goal : 0)) / c.goal * 100, 0, 100) : 0) + '%';
    const sv = $('#tasSave'); if (sv) sv.disabled = c.n <= 0;
    const un = $('#tasUndo'); if (un) un.disabled = c.n <= 0;
}
function tasTap() {
    const c = S.tas.cur;
    c.n++; c.ts = Date.now();
    vibrate(12); clickSound();
    paintLit(c.n); animateBeads(-(c.n % BEAD_N) * BEAD_STEP - Math.floor(c.n / BEAD_N) * 360);
    tasPaint();
    const nEl = $('#tasNum'); if (nEl) { nEl.classList.remove('pop'); void nEl.offsetWidth; nEl.classList.add('pop'); }
    if (c.goal && c.n % c.goal === 0) { vibrate([60, 40, 60, 40, 120]); toast('মাশাআল্লাহ! ' + bn(c.n) + ' পূর্ণ হয়েছে। ইতিহাসে সেভ করতে ভুলবেন না'); }
    saveState();
}
ACT['tas-tap'] = () => tasTap();
ACT['tas-undo'] = () => {
    const c = S.tas.cur; if (c.n <= 0) return;
    c.n--; c.ts = Date.now(); paintLit(c.n); animateBeads(-(c.n % BEAD_N) * BEAD_STEP - Math.floor(c.n / BEAD_N) * 360); tasPaint(); saveState();
};
ACT['tas-reset'] = () => {
    const c = S.tas.cur; if (c.n <= 0) return;
    const old = c.n; c.n = 0; c.ts = Date.now(); saveState(); refreshUI();
    toast('গণনা শূন্য করা হয়েছে', { act: 'ফিরিয়ে নিন', fn: () => { S.tas.cur.n = old; S.tas.cur.ts = Date.now(); saveState(); refreshUI(); } });
};
function tasSaveSession(silent) {
    const c = S.tas.cur; if (c.n <= 0) return false;
    const ph = tasPh(), now = Date.now(), k = dkey();
    S.tas.sessions.unshift({ id: 's' + now.toString(36) + Math.random().toString(36).slice(2, 5), ts: now, k: ph.k, n: c.n, goal: c.goal });
    if (S.tas.sessions.length > 400) S.tas.sessions.length = 400;
    const rec = rec4(k); rec.tas = (rec.tas || 0) + c.n; rec.ts = now;
    const saved = c.n; c.n = 0; c.ts = now; beadRot = 0;
    if (!silent) toast(bn(saved) + ' বার ' + ph.n + ' ইতিহাসে সেভ হয়েছে');
    commit();
    return true;
}
ACT['tas-save'] = () => tasSaveSession(false);
ACT['tas-ph'] = el => {
    const k = el.dataset.k; if (k === S.tas.cur.k) return;
    if (S.tas.cur.n > 0) tasSaveSession(true);
    const ph = TASBEEH.find(x => x.k === k);
    S.tas.cur = { k: k, n: 0, goal: ph.g, ts: Date.now() }; beadRot = 0; saveState(); refreshUI();
};
ACT['tas-goal'] = () => {
    openSheet('<p class="muted">কতবার পড়বেন বেছে নিন, বা নিজের সংখ্যা লিখুন।</p><div class="chips wrap">' + TAS_GOALS.map(g => '<button type="button" class="chip-b' + (S.tas.cur.goal === g ? ' on' : '') + '" data-act="tas-goal-set" data-g="' + g + '">' + (g ? bn(g) : 'ফ্রি') + '</button>').join('') + '</div>' +
        '<div class="row2"><input id="goalIn" class="field" type="number" inputmode="numeric" min="1" max="100000" placeholder="নিজের সংখ্যা"><button type="button" class="btn primary" data-act="tas-goal-own">ঠিক আছে</button></div>', { title: 'লক্ষ্য ঠিক করুন' });
};
ACT['tas-goal-set'] = el => { S.tas.cur.goal = +el.dataset.g; S.tas.cur.ts = Date.now(); closeSheet(true); saveState(); refreshUI(); };
ACT['tas-goal-own'] = () => { const v = parseInt($('#goalIn').value, 10); if (!(v > 0)) { toast('একটি সংখ্যা লিখুন'); return; } S.tas.cur.goal = clamp(v, 1, 100000); S.tas.cur.ts = Date.now(); closeSheet(true); saveState(); refreshUI(); };
ACT['tas-del'] = async el => {
    const s = S.tas.sessions.find(x => x.id === el.dataset.id); if (!s) return;
    if (!(await ask({ title: 'এই এন্ট্রি মুছবেন?', text: bn(s.n) + ' বার ' + (TASBEEH.find(x => x.k === s.k) || TASBEEH[0]).n + ' ইতিহাস ও মোট গণনা থেকে বাদ যাবে।', ok: 'মুছুন', danger: true }))) return;
    S.tas.sessions = S.tas.sessions.filter(x => x.id !== s.id);
    const k = dkey(new Date(s.ts)), r = S.days[k]; if (r) { r.tas = Math.max(0, (r.tas || 0) - s.n); r.ts = Date.now(); }
    commit();
};
RENDER.tasbeeh = function () {
    const el = $('#tab-tasbeeh'), c = S.tas.cur, ph = tasPh(), today = dkey();
    beadRot = -(c.n % BEAD_N) * BEAD_STEP - Math.floor(c.n / BEAD_N) * 360;
    let weekSum = 0, allSum = 0, max = 1; const bars = [];
    for (let i = 6; i >= 0; i--) { const k = addDays(today, -i), v = (S.days[k] && S.days[k].tas) || 0; weekSum += v; if (v > max) max = v; bars.push({ k: k, v: v, i: i }); }
    Object.keys(S.days).forEach(k => { allSum += S.days[k].tas || 0; });
    const todayN = (S.days[today] && S.days[today].tas) || 0;
    const sess = S.tas.sessions.slice(0, 12);
    el.innerHTML =
        '<header class="top"><div class="top-l"><span class="muted sm">জিকিরের গণনা</span><h1 class="tiro h1">তাসবিহ</h1></div></header>' +
        '<div class="chips scroll-x" role="tablist" aria-label="জিকির বেছে নিন">' + TASBEEH.map(t => '<button type="button" role="tab" aria-selected="' + (t.k === c.k) + '" class="chip-b' + (t.k === c.k ? ' on' : '') + '" data-act="tas-ph" data-k="' + t.k + '">' + t.n + '</button>').join('') + '</div>' +
        '<section class="tas-arch" data-act="tas-tap" role="button" tabindex="0" aria-label="গণনা করতে ট্যাপ করুন"><div class="ta-in"></div>' + beadsSVG(c.n) +
        '<div class="tas-mid"><span class="ar tas-ar" lang="ar">' + ph.ar + '</span><b class="tiro tas-n" id="tasNum">' + bn(c.n) + '</b><span class="tas-l" id="tasLine">' + tasLine(c.n, c.goal) + '</span><div class="bar sm tas-b"><i id="tasBar" style="width:0"></i></div></div></section>' +
        '<p class="muted sm center">' + esc(ph.m) + '</p>' +
        '<button type="button" class="btn primary xl" data-act="tas-tap">' + icon('plus', 24, 2.6) + ' গণনা করুন</button>' +
        '<div class="row3"><button type="button" class="btn outline" id="tasUndo" data-act="tas-undo"' + (c.n ? '' : ' disabled') + '>' + icon('undo', 18, 2.2) + ' −১</button><button type="button" class="btn outline" data-act="tas-reset">রিসেট</button><button type="button" class="btn outline" data-act="tas-goal">লক্ষ্য: ' + (c.goal ? bn(c.goal) : 'ফ্রি') + '</button></div>' +
        '<button type="button" class="btn primary" id="tasSave" data-act="tas-save"' + (c.n ? '' : ' disabled') + '>ইতিহাসে সেভ করুন</button>' +
        '<section class="card"><div class="card-h"><h2 class="tiro">তাসবিহ ইতিহাস</h2><span class="muted sm">গত ৭ দিন</span></div>' +
        '<div class="tbars" role="img" aria-label="গত সাত দিনের তাসবিহ গণনা">' + bars.map(b => '<div class="tb' + (b.i === 0 ? ' td' : '') + '"><i style="height:' + (b.v ? Math.max(6, Math.round(b.v / max * 100)) : 0) + '%"></i><span>' + (b.i === 0 ? 'আজ' : BN_DAYS_S[pkey(b.k).getDay()]) + '</span></div>').join('') + '</div>' +
        '<div class="stats3 plain"><div class="st"><span class="muted sm">আজ</span><b class="tiro">' + bn(todayN) + '</b></div><div class="st"><span class="muted sm">এই সপ্তাহ</span><b class="tiro">' + bn(weekSum) + '</b></div><div class="st"><span class="muted sm">সর্বমোট</span><b class="tiro">' + bn(allSum) + '</b></div></div>' +
        (sess.length ? sess.map(s => { const d = new Date(s.ts), p = TASBEEH.find(x => x.k === s.k) || TASBEEH[0]; return '<div class="hrow"><div><b>' + p.n + '</b><small class="muted">' + relDay(dkey(d)) + ', ' + fmtClock(pad2(d.getHours()) + ':' + pad2(d.getMinutes())) + '</small></div><div class="hr-r"><b class="tiro">' + bn(s.n) + '</b><button type="button" class="iconbtn sm ghost" data-act="tas-del" data-id="' + s.id + '" aria-label="এই এন্ট্রি মুছুন">' + icon('trash', 17) + '</button></div></div>'; }).join('') : '<p class="empty">এখনো কোনো সেশন সেভ হয়নি। গণনা শেষে "ইতিহাসে সেভ করুন" চাপুন।</p>') + '</section>';
    tasPaint();
};
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('tas-arch')) { e.preventDefault(); tasTap(); } });

/* ===== ২০. কুরআন: শুনুন (সব ক্বারী, ১১৪ সূরা), পড়ুন, হিফজ ===== */
const DEFAULT_REC = { id: 'afs', name: 'Mishary Rashid Alafasy', srv: 'https://server8.mp3quran.net/afs/', list: '' };
const FALLBACK_RECS = [
    DEFAULT_REC,
    { id: 'basit', name: 'Abdul Basit Abdul Samad', srv: 'https://server7.mp3quran.net/basit/', list: '' },
    { id: 'maher', name: 'Maher Al Muaiqly', srv: 'https://server12.mp3quran.net/maher/', list: '' },
    { id: 'shur', name: 'Saud Al-Shuraim', srv: 'https://server7.mp3quran.net/shur/', list: '' },
    { id: 'sudais', name: 'Abdul Rahman Al-Sudais', srv: 'https://server11.mp3quran.net/sudais/', list: '' },
    { id: 'husr', name: 'Mahmoud Khalil Al-Husary', srv: 'https://server13.mp3quran.net/husr/', list: '' },
    { id: 'shatri', name: 'Abu Bakr Al-Shatri', srv: 'https://server11.mp3quran.net/shatri/', list: '' },
    { id: 'yasser', name: 'Yasser Al-Dosari', srv: 'https://server11.mp3quran.net/yasser/', list: '' },
    { id: 'hani', name: 'Hani Ar-Rifai', srv: 'https://server8.mp3quran.net/hani/', list: '' },
    { id: 'gmd', name: 'Saad Al-Ghamdi', srv: 'https://server7.mp3quran.net/s_gmd/', list: '' },
    { id: 'minsh', name: 'Mohamed Siddiq Al-Minshawi', srv: 'https://server10.mp3quran.net/minsh/', list: '' }
];
const AYAH_RECS = [
    ['Alafasy_128kbps', 'মিশারি আলাফাসি'], ['Abdul_Basit_Murattal_192kbps', 'আব্দুল বাসিত (মুরাত্তাল)'], ['Abdurrahmaan_As-Sudais_192kbps', 'আস-সুদাইস'],
    ['Husary_128kbps', 'মাহমুদ খলিল আল-হুসারি'], ['Minshawy_Murattal_128kbps', 'আল-মিনশাওয়ি'], ['Saood_ash-Shuraym_128kbps', 'সৌদ আশ-শুরাইম'],
    ['Abu_Bakr_Ash-Shaatree_128kbps', 'আবু বকর আশ-শাতিরি'], ['Hani_Rifai_192kbps', 'হানি আর-রিফাঈ'], ['Ghamadi_40kbps', 'সাদ আল-গামিদি'],
    ['Yasser_Ad-Dussary_128kbps', 'ইয়াসির আদ-দোসারি'], ['Muhammad_Ayyoub_128kbps', 'মুহাম্মাদ আইয়ুব'], ['Hudhaify_128kbps', 'আল-হুযাইফি'], ['Abdullah_Basfar_192kbps', 'আব্দুল্লাহ বাসফার']
];
const Q = {
    mode: 'listen', s: 1, recs: [], recsState: 'idle', text: {}, tState: '', limit: 25, filter: '', seekT: 0,
    hifz: { from: 1, to: 5, rep: 3, hide: 'ar', loop: false }, reveal: {},
    play: { kind: null, s: 0, a: 0, loading: false, loop: false }
};
const SETC = {};
const curRec = () => S.quran.rec || DEFAULT_REC;
function recHas(rec, n) {
    if (!rec.list) return true;
    const s = SETC[rec.id] || (SETC[rec.id] = new Set(String(rec.list).split(',').map(Number)));
    return s.has(n);
}
function ayahRecName() { const r = AYAH_RECS.find(x => x[0] === S.set.ayahReciter); return r ? r[1] : S.set.ayahReciter; }
function nextAvail(s, dir) {
    const rec = curRec();
    for (let n = s + dir; n >= 1 && n <= 114; n += dir) if (recHas(rec, n)) return n;
    return null;
}
async function loadReciters() {
    if (Q.recsState === 'loading' || Q.recsState === 'ok') return;
    Q.recsState = 'loading';
    let list = null;
    try {
        const j = await fetchJSON('https://mp3quran.net/api/v3/reciters?language=eng', 18000);
        list = [];
        ((j && j.reciters) || []).forEach(r => (r.moshaf || []).forEach(m => {
            if (!m || !m.server) return;
            list.push({ id: r.id + '-' + m.id, name: r.name + (r.moshaf.length > 1 && m.name ? ' — ' + m.name : ''), srv: m.server.slice(-1) === '/' ? m.server : m.server + '/', list: m.surah_list || '' });
        }));
        list.sort((a, b) => a.name.localeCompare(b.name));
        if (list.length) IDB.set('recs', list);
    } catch (e) { list = null; }
    if (!list || !list.length) { const c = await IDB.get('recs'); if (c && c.length) list = c; }
    if (!list || !list.length) { list = FALLBACK_RECS; Q.recsState = 'fail'; } else Q.recsState = 'ok';
    Q.recs = list;
    if (curTab === 'quran' && Q.mode === 'listen') renderTab('quran');
}
/* ---- সূরার লেখা (আরবি + বাংলা অনুবাদ), একবার নামলে অফলাইনেও থাকে ---- */
function stripBism(txt, s, a) {
    if (a !== 1 || s === 1 || s === 9) return txt;
    const w = String(txt).trim().split(/\s+/);
    if (w.length > 4 && w[0].replace(/[ً-ٰٟۖ-ۭـ]/g, '') === 'بسم') return w.slice(4).join(' ');
    return txt;
}
async function loadSurah(n) {
    if (Q.text[n]) return Q.text[n];
    const c = await IDB.get('sur' + n);
    if (c && c.ar && c.ar.length) { Q.text[n] = c; return c; }
    const j = await fetchJSON('https://api.alquran.cloud/v1/surah/' + n + '/editions/quran-uthmani,bn.bengali', 22000);
    const d = (j && j.data) || [];
    const ar = d.find(x => x.edition && x.edition.identifier === 'quran-uthmani') || d[0], tr = d.find(x => x.edition && x.edition.identifier === 'bn.bengali') || d[1];
    if (!ar || !ar.ayahs || !ar.ayahs.length) throw new Error('empty');
    const t = { name: ar.name || '', ar: ar.ayahs.map(x => stripBism(x.text, n, x.numberInSurah)), bn: tr && tr.ayahs ? tr.ayahs.map(x => x.text) : [] };
    Q.text[n] = t; IDB.set('sur' + n, t);
    return t;
}
async function ensureText() {
    const n = Q.s;
    if (Q.text[n]) { Q.tState = ''; return; }
    Q.tState = 'loading';
    try { await loadSurah(n); Q.tState = ''; } catch (e) { Q.tState = 'fail'; }
    if (curTab === 'quran' && Q.mode !== 'listen' && Q.s === n) renderTab('quran');
}
async function downloadAllSurahs(onProg) {
    let done = 0, fail = 0, i = 1;
    const worker = async () => {
        while (i <= 114) {
            const n = i++;
            try { await loadSurah(n); } catch (e) { fail++; }
            done++; if (onProg) onProg(done, fail);
        }
    };
    await Promise.all([worker(), worker(), worker()]);
    return { done: done, fail: fail };
}
async function savedSurahCount() { const ks = await IDB.keys(); return (ks || []).filter(k => /^sur\d+$/.test(k)).length; }

/* ---- অডিও ইঞ্জিন: একটাই <audio>, তাই স্ক্রল/ট্যাব বদলালেও চলতে থাকে ---- */
const AUD = () => $('#qAudio');
const PRE = typeof Audio !== 'undefined' ? new Audio() : null;
const surahUrl = (rec, n) => rec.srv + pad3(n) + '.mp3';
const ayahUrl = (s, a) => 'https://everyayah.com/data/' + S.set.ayahReciter + '/' + pad3(s) + pad3(a) + '.mp3';
let playSeq = 0;
function fmtMS(sec) { sec = Math.max(0, Math.floor(sec || 0)); return bn(Math.floor(sec / 60)) + ':' + bn(pad2(sec % 60)); }
function startAudio(url, seq) {
    const a = AUD(); a.src = url;
    const p = a.play(); if (p && p.catch) p.catch(err => { if (err && err.name === 'NotAllowedError') { Q.play.loading = false; renderPlayer(); } else onAudioFail(seq); });
}
function playSurah(n, o) {
    const rec = curRec();
    if (!recHas(rec, n)) { toast('এই ক্বারীর রেকর্ডিংয়ে সূরা ' + SURAHS[n - 1].bn + ' নেই। অন্য ক্বারী বেছে নিন'); return; }
    playSeq++;
    Q.play = { kind: 'surah', s: n, a: 0, loading: true, loop: Q.play.loop, tried: false, seq: playSeq };
    startAudio(surahUrl(rec, n), playSeq);
    setMedia('সূরা ' + SURAHS[n - 1].bn, rec.name);
    renderPlayer(); if (curTab === 'quran' && Q.mode === 'listen') renderTab('quran');
}
function playAyah(s, a, o) {
    o = o || {};
    const v = SURAHS[s - 1].v; a = clamp(a, 1, v);
    playSeq++;
    const rep = o.rep || 1;
    Q.play = { kind: 'ayah', s: s, a: a, until: clamp(o.until || v, a, v), rep: rep, repLeft: o.repLeft || rep, hifz: !!o.hifz, fallback: !!o.fallback, loading: true, loop: false, tried: true, seq: playSeq };
    startAudio(ayahUrl(s, a), playSeq);
    if (PRE && a < Q.play.until) { PRE.src = ayahUrl(s, a + 1); }
    setMedia('সূরা ' + SURAHS[s - 1].bn + ', আয়াত ' + a, ayahRecName());
    renderPlayer(); markPlaying(true);
}
function markPlaying(scroll) {
    $$('.ayah.playing').forEach(e => e.classList.remove('playing'));
    const P = Q.play; if (P.kind !== 'ayah' || P.s !== Q.s) return;
    let el = $('#ay-' + P.a);
    if (!el && P.a > Q.limit && curTab === 'quran') { Q.limit = P.a + 10; renderTab('quran'); el = $('#ay-' + P.a); }
    if (el) { el.classList.add('playing'); if (scroll && curTab === 'quran' && Q.mode !== 'listen') el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
function onAudioFail(seq) {
    const P = Q.play;
    if (seq !== P.seq) return;
    if (P.kind === 'surah' && !P.tried) {
        P.tried = true;
        toast('এই সোর্স থেকে অডিও আসছে না, আয়াত ধরে ধরে চালানো হচ্ছে');
        playAyah(P.s, 1, { fallback: true });
        return;
    }
    P.loading = false; AUD().pause();
    toast('অডিও চালানো যাচ্ছে না। ইন্টারনেট দেখুন বা অন্য ক্বারী বেছে নিন');
    renderPlayer();
}
function onEnded() {
    const P = Q.play;
    if (P.kind === 'surah') {
        if (P.loop) { playSurah(P.s); return; }
        if (S.set.autoNext) { const nx = nextAvail(P.s, 1); if (nx) { playSurah(nx); return; } }
        P.ended = true; renderPlayer(); if (curTab === 'quran' && Q.mode === 'listen') renderTab('quran');
    } else if (P.kind === 'ayah') {
        if (P.repLeft > 1) { playAyah(P.s, P.a, { rep: P.rep, repLeft: P.repLeft - 1, until: P.until, hifz: P.hifz, fallback: P.fallback }); return; }
        if (P.a < P.until) { playAyah(P.s, P.a + 1, { rep: P.rep, until: P.until, hifz: P.hifz, fallback: P.fallback }); return; }
        if (P.hifz && Q.hifz.loop) { playAyah(P.s, Q.hifz.from, { rep: Q.hifz.rep, until: Q.hifz.to, hifz: true }); return; }
        if (P.fallback && S.set.autoNext) { const nx = nextAvail(P.s, 1); if (nx) { playSurah(nx); return; } }
        P.ended = true; P.loading = false; renderPlayer(); markPlaying(false);
        if (P.hifz) toast('এই অংশের পুনরাবৃত্তি শেষ হয়েছে');
    }
}
function stepPlay(dir) {
    const P = Q.play;
    if (P.kind === 'surah') { const nx = nextAvail(P.s, dir); if (nx) playSurah(nx); else toast(dir > 0 ? 'এটাই শেষ সূরা' : 'এটাই প্রথম সূরা'); }
    else if (P.kind === 'ayah') { const na = P.a + dir; if (na >= 1 && na <= SURAHS[P.s - 1].v) playAyah(P.s, na, { rep: P.rep, until: Math.max(P.until, na), hifz: P.hifz, fallback: P.fallback }); }
}
function stopAudio() { const a = AUD(); a.pause(); try { a.currentTime = 0; } catch (e) { } playSeq++; Q.play = { kind: null, loop: false }; renderPlayer(); markPlaying(false); if (curTab === 'quran' && Q.mode === 'listen') renderTab('quran'); }
function setMedia(title, artist) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: title, artist: artist, album: 'NafsCare Pro' });
        navigator.mediaSession.setActionHandler('play', () => AUD().play());
        navigator.mediaSession.setActionHandler('pause', () => AUD().pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => stepPlay(1));
        navigator.mediaSession.setActionHandler('previoustrack', () => stepPlay(-1));
    } catch (e) { }
}
function renderPlayer() {
    const bar = $('#playerBar'), P = Q.play, a = AUD();
    if (!bar) return;
    if (!P.kind) { bar.hidden = true; bar.innerHTML = ''; document.body.classList.remove('has-player'); return; }
    const playing = !a.paused && !a.ended && !P.ended;
    const title = P.kind === 'surah' ? 'সূরা ' + SURAHS[P.s - 1].bn : 'সূরা ' + SURAHS[P.s - 1].bn + ', আয়াত ' + bn(P.a);
    const sub = P.kind === 'surah' ? curRec().name : ayahRecName();
    bar.hidden = false; document.body.classList.add('has-player');
    bar.innerHTML = '<button type="button" class="pb-info" data-act="pb-open"><b>' + esc(title) + '</b><small>' + esc(sub) + (P.loading ? ' · লোড হচ্ছে…' : '') + '</small></button>' +
        '<div class="pb-c"><button type="button" class="pb-b" data-act="pb-prev" aria-label="আগেরটি">' + icon('skipp', 18, 2.2) + '</button>' +
        '<button type="button" class="pb-b big" data-act="pb-toggle" aria-label="' + (playing ? 'থামান' : 'চালান') + '">' + icon(playing ? 'pause' : 'play', 22, 2.2) + '</button>' +
        '<button type="button" class="pb-b" data-act="pb-next" aria-label="পরেরটি">' + icon('skipn', 18, 2.2) + '</button>' +
        (P.kind === 'surah' ? '<button type="button" class="pb-b' + (P.loop ? ' on' : '') + '" data-act="pb-loop" aria-label="এই সূরা বারবার" aria-pressed="' + !!P.loop + '">' + icon('repeat', 17, 2.2) + '</button>' : '') +
        '<button type="button" class="pb-b" data-act="pb-stop" aria-label="প্লেয়ার বন্ধ করুন">' + icon('close', 17, 2.2) + '</button></div>' +
        '<div class="pb-s"><input id="pbSeek" class="pb-seek" type="range" min="0" max="100" value="0" step="1" data-in="pb-seek" aria-label="অডিওর অবস্থান"><span id="pbTime" class="pb-t">০:০০</span></div>';
    paintProgress();
}
function paintProgress() {
    const a = AUD(), r = $('#pbSeek'); if (!r || Date.now() - Q.seekT < 700) return;
    const d = isFinite(a.duration) ? a.duration : 0;
    r.max = d ? Math.floor(d) : 100; r.value = Math.floor(a.currentTime || 0);
    const t = $('#pbTime'); if (t) t.textContent = fmtMS(a.currentTime) + (d ? ' / ' + fmtMS(d) : '');
}
INP['pb-seek'] = el => { Q.seekT = Date.now(); const a = AUD(); if (isFinite(a.duration)) a.currentTime = +el.value; const t = $('#pbTime'); if (t) t.textContent = fmtMS(el.value) + (isFinite(a.duration) ? ' / ' + fmtMS(a.duration) : ''); };
ACT['pb-toggle'] = () => { const a = AUD(); if (Q.play.ended) { if (Q.play.kind === 'surah') playSurah(Q.play.s); else playAyah(Q.play.s, Q.play.a); return; } if (a.paused) a.play().catch(() => { }); else a.pause(); };
ACT['pb-prev'] = () => stepPlay(-1);
ACT['pb-next'] = () => stepPlay(1);
ACT['pb-stop'] = () => stopAudio();
ACT['pb-loop'] = () => { Q.play.loop = !Q.play.loop; renderPlayer(); };
ACT['pb-open'] = () => { if (Q.play.kind === 'ayah' && Q.mode === 'listen') Q.mode = 'read'; if (Q.play.kind === 'ayah') Q.s = Q.play.s; go('quran'); };
function bindAudio() {
    const a = AUD(); let lastT = 0;
    a.addEventListener('playing', () => { Q.play.loading = false; Q.play.ended = false; renderPlayer(); if (curTab === 'quran' && Q.mode === 'listen') renderTab('quran'); });
    a.addEventListener('pause', () => { renderPlayer(); if (curTab === 'quran' && Q.mode === 'listen') renderTab('quran'); });
    a.addEventListener('waiting', () => { if (Q.play.kind && !Q.play.loading) { Q.play.loading = true; renderPlayer(); } });
    a.addEventListener('canplay', () => { if (Q.play.loading) { Q.play.loading = false; renderPlayer(); } });
    a.addEventListener('timeupdate', () => { const t = Date.now(); if (t - lastT > 400) { lastT = t; paintProgress(); } });
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', () => { if (Q.play.kind) onAudioFail(Q.play.seq); });
}

/* ---- ক্বারী ও সূরা বাছাই ---- */
function recRowsHTML(q) {
    const cur = curRec().id, ql = q.trim().toLowerCase();
    const list = Q.recs.length ? Q.recs : FALLBACK_RECS;
    const out = list.filter(r => !ql || r.name.toLowerCase().includes(ql)).slice(0, 150);
    if (!out.length) return '<p class="empty">কোনো ক্বারী পাওয়া যায়নি।</p>';
    return out.map(r => '<button type="button" class="lrow' + (r.id === cur ? ' on' : '') + '" data-act="rec-pick" data-id="' + esc(r.id) + '"><span class="lr-t"><b>' + esc(r.name) + '</b><small class="muted">' + (r.list ? bn(r.list.split(',').length) + 'টি সূরা' : 'সব ১১৪ সূরা') + '</small></span>' + (r.id === cur ? icon('check', 18, 3) : '') + '</button>').join('');
}
ACT['rec-open'] = () => {
    openSheet('<div class="search">' + icon('search', 18) + '<input id="recQ" class="field" type="search" data-in="rec-q" placeholder="ক্বারীর নাম লিখুন (ইংরেজিতে)" autocomplete="off"></div><p class="muted xs" id="recInfo">' + (Q.recsState === 'ok' ? bn(Q.recs.length) + 'টি রেকর্ডিং' : Q.recsState === 'loading' ? 'তালিকা আসছে…' : 'অফলাইন তালিকা দেখানো হচ্ছে') + '</p><div id="recList" class="llist">' + recRowsHTML('') + '</div>', { title: 'ক্বারী বেছে নিন' });
    if (Q.recsState === 'idle') loadReciters().then(() => { const l = $('#recList'); if (l) l.innerHTML = recRowsHTML(($('#recQ') || {}).value || ''); const i = $('#recInfo'); if (i && Q.recsState === 'ok') i.textContent = bn(Q.recs.length) + 'টি রেকর্ডিং'; });
};
INP['rec-q'] = el => { const l = $('#recList'); if (l) l.innerHTML = recRowsHTML(el.value); };
ACT['rec-pick'] = el => {
    const r = (Q.recs.length ? Q.recs : FALLBACK_RECS).find(x => x.id === el.dataset.id); if (!r) return;
    S.quran.rec = r; S.quran.recTs = Date.now(); saveState(); closeSheet(true);
    const P = Q.play;
    if (P.kind === 'surah') { if (recHas(r, P.s)) playSurah(P.s); else { toast('এই ক্বারীর রেকর্ডিংয়ে চলমান সূরাটি নেই'); stopAudio(); } }
    else refreshUI();
    toast(r.name + ' বেছে নেওয়া হয়েছে');
};
function surRowsHTML(q, act) {
    const ql = q.trim().toLowerCase(), qn = ql.replace(/[০-৯]/g, d => BNUM.indexOf(d));
    return SURAHS.filter(s => !ql || s.bn.toLowerCase().includes(ql) || s.en.toLowerCase().includes(ql) || String(s.id) === qn).map(s =>
        '<button type="button" class="lrow' + (s.id === Q.s ? ' on' : '') + '" data-act="' + act + '" data-s="' + s.id + '"><span class="num">' + bn(s.id) + '</span><span class="lr-t"><b>' + s.bn + '</b><small class="muted">' + s.en + ', ' + s.t + ', ' + bn(s.v) + ' আয়াত</small></span></button>').join('') || '<p class="empty">কোনো সূরা পাওয়া যায়নি।</p>';
}
ACT['sur-open'] = () => {
    const marks = S.quran.marks.slice().sort((a, b) => b.ts - a.ts).slice(0, 8);
    openSheet('<div class="search">' + icon('search', 18) + '<input id="surQ" class="field" type="search" data-in="sur-q" placeholder="সূরার নাম বা নম্বর" autocomplete="off"></div>' +
        (marks.length ? '<h3 class="sub-h">বুকমার্ক</h3><div class="chips wrap">' + marks.map(m => '<button type="button" class="chip-b" data-act="mark-go" data-s="' + m.s + '" data-a="' + m.a + '">' + SURAHS[m.s - 1].bn + ' ' + bn(m.a) + '</button>').join('') + '</div>' : '') +
        '<div id="surList" class="llist">' + surRowsHTML('', 'sur-pick') + '</div>', { title: 'সূরা বেছে নিন' });
};
INP['sur-q'] = el => { const l = $('#surList'); if (l) l.innerHTML = surRowsHTML(el.value, 'sur-pick'); };
ACT['sur-pick'] = el => { closeSheet(true); openSurah(+el.dataset.s, 1); };
ACT['mark-go'] = el => { closeSheet(true); if (Q.mode === 'listen') Q.mode = 'read'; openSurah(+el.dataset.s, +el.dataset.a); };
function openSurah(s, a) {
    Q.s = clamp(s, 1, 114); Q.limit = Math.max(25, (a || 1) + 10); Q.reveal = {};
    Q.hifz.from = 1; Q.hifz.to = Math.min(SURAHS[Q.s - 1].v, 5);
    if (Q.mode === 'listen') Q.mode = 'read';
    go('quran');
    if (a && a > 1) setTimeout(() => { const el = $('#ay-' + a); if (el) el.scrollIntoView({ block: 'start' }); }, 120);
}
ACT.qmode = el => { Q.mode = el.dataset.v; Q.reveal = {}; refreshUI(); if (Q.mode === 'listen') loadReciters(); };
ACT['sur-step'] = el => { openSurah(Q.s + (+el.dataset.d), 1); };
ACT['ar-size'] = el => { S.set.arSize = clamp((S.set.arSize || 30) + (+el.dataset.d), 22, 50); S.set.ts = Date.now(); saveState(); refreshUI(); };
ACT['tr-toggle'] = () => { S.set.showBn = !S.set.showBn; S.set.ts = Date.now(); saveState(); refreshUI(); };
ACT['auto-next'] = () => { S.set.autoNext = !S.set.autoNext; S.set.ts = Date.now(); saveState(); refreshUI(); };
ACT['q-more'] = () => { Q.limit += 25; refreshUI(); };
ACT['q-retry'] = () => { Q.tState = ''; ensureText(); refreshUI(); };
ACT['q-continue'] = () => { const l = S.quran.last; Q.mode = 'read'; openSurah(l.s || 1, l.a || 1); };
ACT['listen-play'] = el => { const n = +el.dataset.s, P = Q.play, a = AUD(); if (P.kind === 'surah' && P.s === n && !P.ended) { if (a.paused) a.play().catch(() => { }); else a.pause(); } else playSurah(n); };
ACT['ay-play'] = el => { const a = +el.dataset.a; playAyah(Q.s, a, { rep: 1 }); };
const markHas = (s, a) => S.quran.marks.some(m => m.s === s && m.a === a);
ACT.mark = el => {
    const s = +el.dataset.s, a = +el.dataset.a;
    if (markHas(s, a)) S.quran.marks = S.quran.marks.filter(m => !(m.s === s && m.a === a)); else { S.quran.marks.push({ s: s, a: a, ts: Date.now() }); toast('বুকমার্ক করা হয়েছে'); }
    saveState(); refreshUI();
};
const memoSet = s => S.quran.hifz[s] || (S.quran.hifz[s] = []);
const memoHas = (s, a) => (S.quran.hifz[s] || []).includes(a);
ACT.memo = el => {
    const s = +el.dataset.s, a = +el.dataset.a, arr = memoSet(s), i = arr.indexOf(a);
    if (i >= 0) arr.splice(i, 1); else { arr.push(a); arr.sort((x, y) => x - y); vibrate(20); }
    if (!arr.length) delete S.quran.hifz[s];
    saveState(); refreshUI();
};
ACT.reveal = el => { const k = el.dataset.s + ':' + el.dataset.a; Q.reveal[k] = !Q.reveal[k]; refreshUI(); };
ACT['h-rng'] = el => {
    const h = Q.hifz, v = SURAHS[Q.s - 1].v, w = el.dataset.w, d = +el.dataset.d;
    if (w === 'from') h.from = clamp(h.from + d, 1, h.to); else h.to = clamp(h.to + d, h.from, v);
    refreshUI();
};
ACT['h-all'] = () => { Q.hifz.from = 1; Q.hifz.to = SURAHS[Q.s - 1].v; refreshUI(); };
ACT['h-rep'] = el => { Q.hifz.rep = +el.dataset.v; refreshUI(); };
ACT['h-hide'] = el => { Q.hifz.hide = el.dataset.v; Q.reveal = {}; refreshUI(); };
ACT['h-loop'] = () => { Q.hifz.loop = !Q.hifz.loop; refreshUI(); };
ACT['h-play'] = () => { const h = Q.hifz; playAyah(Q.s, h.from, { rep: h.rep, until: h.to, hifz: true }); };

/* ---- কুরআন ট্যাবের স্ক্রিন ---- */
function listenHTML() {
    const rec = curRec(), P = Q.play, a = AUD(), q = Q.filter.trim().toLowerCase(), qn = q.replace(/[০-৯]/g, d => BNUM.indexOf(d));
    const rows = SURAHS.filter(s => !q || s.bn.toLowerCase().includes(q) || s.en.toLowerCase().includes(q) || String(s.id) === qn).map(s => {
        const has = recHas(rec, s.id), on = P.kind === 'surah' && P.s === s.id, pl = on && !a.paused && !P.ended;
        return '<div class="lrow sr' + (on ? ' on' : '') + (has ? '' : ' off') + '"><span class="num">' + bn(s.id) + '</span><span class="lr-t"><b>' + s.bn + '</b><small class="muted">' + s.en + ', ' + s.t + ', ' + bn(s.v) + ' আয়াত' + (has ? '' : ', এই ক্বারীতে নেই') + '</small></span>' +
            '<button type="button" class="iconbtn sm' + (pl ? ' act' : '') + '" data-act="listen-play" data-s="' + s.id + '"' + (has ? '' : ' disabled') + ' aria-label="সূরা ' + s.bn + (pl ? ' থামান' : ' শুনুন') + '">' + icon(pl ? 'pause' : 'play', 18, 2.2) + '</button>' +
            '<button type="button" class="iconbtn sm ghost" data-act="sur-read" data-s="' + s.id + '" aria-label="সূরা ' + s.bn + ' পড়ুন">' + icon('book', 18, 2) + '</button></div>';
    }).join('');
    return '<button type="button" class="card recard" data-act="rec-open"><span class="rc-i">' + icon('mic', 22) + '</span><span class="lr-t"><small class="muted">ক্বারী</small><b>' + esc(rec.name) + '</b></span>' + icon('chev', 20, 2.2) + '</button>' +
        '<div class="row2 tight"><div class="search grow">' + icon('search', 18) + '<input class="field" type="search" data-in="sur-filter" value="' + esc(Q.filter) + '" placeholder="সূরা খুঁজুন" autocomplete="off" aria-label="সূরা খুঁজুন"></div>' +
        '<button type="button" class="chip-b' + (S.set.autoNext ? ' on' : '') + '" data-act="auto-next" aria-pressed="' + !!S.set.autoNext + '">পরের সূরা অটো</button></div>' +
        (Q.recsState === 'fail' ? '<div class="notice">' + icon('wifi', 20) + '<span>ক্বারীর পূর্ণ তালিকা আনা যায়নি, কয়েকজন জনপ্রিয় ক্বারী দেখানো হচ্ছে।</span></div>' : '') +
        '<div class="card list" id="surRows">' + (rows || '<p class="empty">কোনো সূরা পাওয়া যায়নি।</p>') + '</div>';
}
INP['sur-filter'] = el => {
    Q.filter = el.value;
    const holder = $('#surRows'); if (!holder) return;
    const keep = el.selectionStart; const html = listenHTML(); const tmp = document.createElement('div'); tmp.innerHTML = html;
    const nr = tmp.querySelector('#surRows'); if (nr) holder.innerHTML = nr.innerHTML; void keep;
};
ACT['sur-read'] = el => { Q.mode = 'read'; openSurah(+el.dataset.s, 1); };
function ayahCard(s, a, t, hifz) {
    const ar = t.ar[a - 1] || '', tr = t.bn[a - 1] || '', h = Q.hifz, rv = !!Q.reveal[s + ':' + a];
    const hideAr = hifz && h.hide !== 'none' && !rv, hideTr = hifz && h.hide === 'all' && !rv;
    const memo = memoHas(s, a), mk = markHas(s, a);
    return '<article class="ayah' + (memo && hifz ? ' memo' : '') + '" id="ay-' + a + '" data-a="' + a + '"><div class="ay-h"><span class="ay-n">' + bn(a) + '</span><div class="ay-acts">' +
        '<button type="button" class="iconbtn sm" data-act="ay-play" data-a="' + a + '" aria-label="আয়াত ' + bn(a) + ' শুনুন">' + icon('play', 17, 2.2) + '</button>' +
        (hifz ? '<button type="button" class="iconbtn sm' + (memo ? ' act' : '') + '" data-act="memo" data-s="' + s + '" data-a="' + a + '" aria-pressed="' + memo + '" aria-label="মুখস্থ হয়েছে চিহ্নিত করুন">' + icon('check', 17, 3) + '</button>' : '') +
        '<button type="button" class="iconbtn sm' + (mk ? ' act' : '') + '" data-act="mark" data-s="' + s + '" data-a="' + a + '" aria-pressed="' + mk + '" aria-label="বুকমার্ক">' + icon('bookmark', 17, 2.1) + '</button></div></div>' +
        '<div class="ay-body' + (hideAr ? ' hid' : '') + '"><p class="ar-text' + (hideAr ? ' blur' : '') + '" lang="ar" dir="rtl" style="font-size:' + (S.set.arSize || 30) + 'px">' + esc(ar) + '</p>' +
        (hideAr ? '<button type="button" class="reveal-b" data-act="reveal" data-s="' + s + '" data-a="' + a + '">' + icon('eye', 18, 2.2) + ' ট্যাপ করে দেখুন</button>' : '') + '</div>' +
        (S.set.showBn && tr ? '<p class="ay-tr' + (hideTr ? ' blur' : '') + '">' + esc(tr) + '</p>' : '') + '</article>';
}
function readerHTML() {
    const s = Q.s, sur = SURAHS[s - 1], t = Q.text[s], hifz = Q.mode === 'hifz', last = S.quran.last;
    let head = '<div class="sur-head"><button type="button" class="iconbtn" data-act="sur-step" data-d="-1"' + (s <= 1 ? ' disabled' : '') + ' aria-label="আগের সূরা">' + icon('back', 20, 2.4) + '</button>' +
        '<button type="button" class="sh-m" data-act="sur-open" aria-label="সূরা বদলান"><span class="ar sh-ar" lang="ar">' + esc((t && t.name) || '') + '</span><b>সূরা ' + sur.bn + '</b><small class="muted">' + sur.t + ', ' + bn(sur.v) + ' আয়াত</small></button>' +
        '<button type="button" class="iconbtn" data-act="sur-step" data-d="1"' + (s >= 114 ? ' disabled' : '') + ' aria-label="পরের সূরা">' + icon('fwd', 20, 2.4) + '</button></div>';
    head += '<div class="tools"><div class="tl-g"><button type="button" class="chip-b" data-act="ar-size" data-d="-2" aria-label="লেখা ছোট করুন">আ−</button><button type="button" class="chip-b" data-act="ar-size" data-d="2" aria-label="লেখা বড় করুন">আ+</button></div>' +
        '<button type="button" class="chip-b' + (S.set.showBn ? ' on' : '') + '" data-act="tr-toggle" aria-pressed="' + !!S.set.showBn + '">বাংলা অনুবাদ</button></div>';
    if (!hifz && last && (last.s !== s || (last.a || 1) > 1) && last.ts) head += '<div class="notice gold"><span>শেষ পড়া: <b>সূরা ' + SURAHS[(last.s || 1) - 1].bn + ', আয়াত ' + bn(last.a || 1) + '</b></span><button type="button" class="btn sm primary" data-act="q-continue">চালিয়ে যান</button></div>';
    let body = '';
    if (!t) {
        body = Q.tState === 'fail' ? '<div class="card center"><p>সূরার লেখা আনা যায়নি। প্রথমবার পড়তে ইন্টারনেট লাগে, এরপর অফলাইনেও থাকে।</p><button type="button" class="btn primary" data-act="q-retry">আবার চেষ্টা করুন</button></div>'
            : '<div class="card center"><div class="spin" aria-hidden="true"></div><p class="muted">সূরা আসছে…</p></div>';
        return head + body;
    }
    if (hifz) {
        const h = Q.hifz, done = (S.quran.hifz[s] || []).length;
        head += '<section class="card hifz"><div class="card-h"><h2 class="tiro">হিফজ মোড</h2><span class="chip gold">মুখস্থ ' + bn(done) + '/' + bn(sur.v) + '</span></div>' +
            '<div class="bar full"><i style="width:' + Math.round(done / sur.v * 100) + '%"></i></div>' +
            '<div class="rng"><span>কোথা থেকে</span><div class="cnt"><button type="button" class="cbtn" data-act="h-rng" data-w="from" data-d="-1" aria-label="শুরু কমান">' + icon('minus', 18, 2.4) + '</button><b class="cnum">' + bn(h.from) + '</b><button type="button" class="cbtn pl" data-act="h-rng" data-w="from" data-d="1" aria-label="শুরু বাড়ান">' + icon('plus', 18, 2.6) + '</button></div></div>' +
            '<div class="rng"><span>কোথা পর্যন্ত</span><div class="cnt"><button type="button" class="cbtn" data-act="h-rng" data-w="to" data-d="-1" aria-label="শেষ কমান">' + icon('minus', 18, 2.4) + '</button><b class="cnum">' + bn(h.to) + '</b><button type="button" class="cbtn pl" data-act="h-rng" data-w="to" data-d="1" aria-label="শেষ বাড়ান">' + icon('plus', 18, 2.6) + '</button></div></div>' +
            '<button type="button" class="link wide" data-act="h-all">পুরো সূরা নিন</button>' +
            '<p class="sub-h">প্রতি আয়াত কতবার শুনবেন</p><div class="chips">' + [1, 3, 5, 10].map(n => '<button type="button" class="chip-b' + (h.rep === n ? ' on' : '') + '" data-act="h-rep" data-v="' + n + '">' + bn(n) + ' বার</button>').join('') + '</div>' +
            '<p class="sub-h">কী লুকিয়ে রাখবেন</p><div class="chips">' + [['none', 'কিছু না'], ['ar', 'আরবি ঝাপসা'], ['all', 'আরবি ও অনুবাদ']].map(x => '<button type="button" class="chip-b' + (h.hide === x[0] ? ' on' : '') + '" data-act="h-hide" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
            '<div class="row2"><button type="button" class="btn primary" data-act="h-play">' + icon('play', 20, 2.2) + ' শুনে মুখস্থ করুন</button><button type="button" class="chip-b' + (h.loop ? ' on' : '') + '" data-act="h-loop" aria-pressed="' + !!h.loop + '">পুরোটা বারবার</button></div></section>';
        const out = []; for (let a = Q.hifz.from; a <= Q.hifz.to; a++) out.push(ayahCard(s, a, t, true));
        return head + '<div class="alist">' + out.join('') + '</div>';
    }
    const total = sur.v, shown = Math.min(Q.limit, total), out = [];
    if (s !== 1 && s !== 9) out.push('<p class="bismillah ar" lang="ar">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>');
    for (let a = 1; a <= shown; a++) out.push(ayahCard(s, a, t, false));
    if (shown < total) out.push('<button type="button" class="btn outline" id="moreBtn" data-act="q-more">আরও ' + bn(Math.min(25, total - shown)) + 'টি আয়াত দেখান</button>');
    else if (s < 114) out.push('<button type="button" class="btn primary" data-act="sur-step" data-d="1">পরের সূরা: ' + SURAHS[s].bn + '</button>');
    return head + '<div class="alist">' + out.join('') + '</div>';
}
RENDER.quran = function () {
    const el = $('#tab-quran');
    el.innerHTML = '<header class="top"><div class="top-l"><span class="muted sm">কুরআন</span><h1 class="tiro h1">শুনুন, পড়ুন, মুখস্থ করুন</h1></div></header>' +
        segHTML([['listen', 'শুনুন'], ['read', 'পড়ুন'], ['hifz', 'হিফজ']], Q.mode, 'qmode') +
        (Q.mode === 'listen' ? listenHTML() : readerHTML());
    if (Q.mode === 'listen') { if (Q.recsState === 'idle') loadReciters(); }
    else if (!Q.text[Q.s] && Q.tState !== 'loading' && Q.tState !== 'fail') ensureText();
    markPlaying(false);
};
/* পড়ার সময় "শেষ পড়া আয়াত" নিজে থেকে মনে রাখে */
let lastReadT = null;
function trackLastRead() {
    if (curTab !== 'quran' || Q.mode !== 'read') return;
    clearTimeout(lastReadT);
    lastReadT = setTimeout(() => {
        const cards = $$('#tab-quran .ayah'); let hit = null;
        for (const c of cards) { const r = c.getBoundingClientRect(); if (r.bottom > 150) { hit = c; break; } }
        if (!hit) return;
        const a = +hit.dataset.a;
        if (S.quran.last.s !== Q.s || S.quran.last.a !== a) { S.quran.last = { s: Q.s, a: a, ts: Date.now() }; saveState(); }
    }, 900);
}
/* ===== ২১. ডেটা মিলিয়ে নেওয়া (merge): কোনো ইতিহাস হারায় না ===== */
function mergeDay(x, y) {
    const xt = x.ts || 0, yt = y.ts || 0, n = clone(xt >= yt ? x : y), o = xt >= yt ? y : x;
    n.p = n.p || {}; n.a = n.a || {};
    if (xt === yt) {
        Object.keys(o.p || {}).forEach(k => { n.p[k] = (n.p[k] || 0) | o.p[k]; });
        Object.keys(o.a || {}).forEach(k => { n.a[k] = 1; });
    }
    n.tas = Math.max(x.tas || 0, y.tas || 0);
    if (!String(n.note || '').trim() && String(o.note || '').trim()) n.note = o.note;
    n.ts = Math.max(xt, yt);
    return n;
}
function mergeStates(a, b) {
    const out = clone(a), g = (o, k) => (o && o[k]) || 0;
    const fresh = !Object.keys(a.days || {}).length && !((a.qada && a.qada.items) || []).length;
    if (g(b.user, 'ts') > g(a.user, 'ts')) out.user = clone(b.user);
    if (g(b.set, 'ts') > g(a.set, 'ts')) out.set = clone(b.set);
    out.days = {};
    const keys = new Set(Object.keys(a.days || {}).concat(Object.keys(b.days || {})));
    keys.forEach(k => { const x = (a.days || {})[k], y = (b.days || {})[k]; out.days[k] = x && y ? mergeDay(x, y) : clone(x || y); });
    const items = {};
    [((a.qada || {}).items || []), ((b.qada || {}).items || [])].forEach(list => list.forEach(i => { const e = items[i.id]; if (!e) items[i.id] = clone(i); else if (i.done && !e.done) e.done = i.done; }));
    const baseSrc = g(b.qada, 'baseTs') > g(a.qada, 'baseTs') ? b.qada : a.qada;
    out.qada = { items: Object.keys(items).map(k => items[k]), base: clone((baseSrc && baseSrc.base) || {}), baseTs: Math.max(g(a.qada, 'baseTs'), g(b.qada, 'baseTs')) };
    const ss = {};
    ((a.tas || {}).sessions || []).concat((b.tas || {}).sessions || []).forEach(s => { if (!ss[s.id]) ss[s.id] = s; });
    const curSrc = g((b.tas || {}).cur, 'ts') > g((a.tas || {}).cur, 'ts') ? b.tas.cur : (a.tas || {}).cur;
    out.tas = { sessions: Object.keys(ss).map(k => ss[k]).sort((p, q) => q.ts - p.ts).slice(0, 400), cur: clone(curSrc || { k: 'subhanallah', n: 0, goal: 33, ts: 0 }) };
    const qa = a.quran || {}, qb = b.quran || {}, marks = {}, hifz = {};
    (qa.marks || []).concat(qb.marks || []).forEach(m => { const k = m.s + ':' + m.a; if (!marks[k]) marks[k] = m; });
    new Set(Object.keys(qa.hifz || {}).concat(Object.keys(qb.hifz || {}))).forEach(s => { hifz[s] = Array.from(new Set(((qa.hifz || {})[s] || []).concat((qb.hifz || {})[s] || []))).sort((x, y) => x - y); });
    out.quran = {
        last: clone(g(qb.last, 'ts') > g(qa.last, 'ts') ? qb.last : (qa.last || { s: 1, a: 1, ts: 0 })),
        marks: Object.keys(marks).map(k => marks[k]), hifz: hifz,
        rec: (qb.recTs || 0) > (qa.recTs || 0) ? qb.rec : qa.rec, recTs: Math.max(qa.recTs || 0, qb.recTs || 0)
    };
    const ma = a.meta || {}, mb = b.meta || {};
    out.meta = Object.assign({}, ma, {
        created: Math.min(ma.created || Date.now(), mb.created || Date.now()),
        qadaFrom: Math.min(ma.qadaFrom || Date.now(), mb.qadaFrom || Date.now()),
        lvl: Math.max(ma.lvl || 0, mb.lvl || 0),
        lastSeen: fresh && mb.lastSeen ? mb.lastSeen : ((ma.lastSeen || '') > (mb.lastSeen || '') ? ma.lastSeen : (mb.lastSeen || ma.lastSeen))
    });
    out.v = 2;
    return fillDefaults(out, defaultState());
}

/* ===== ২২. ইমেইল সাইন-ইন ও ক্লাউড ব্যাকআপ (Firebase) ===== */
const Cloud = { ready: false, auth: null, db: null, user: null, status: 'off', last: 0, err: '', busy: false, sig: {}, loadP: null, timer: null };
const cloudConfigured = () => !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('script')); document.head.appendChild(s); }); }
function cloudInit() {
    if (Cloud.loadP) return Cloud.loadP;
    if (!cloudConfigured()) return Promise.resolve(false);
    Cloud.loadP = (async () => {
        try {
            const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
            await loadScript(base + 'firebase-app-compat.js');
            await loadScript(base + 'firebase-auth-compat.js');
            await loadScript(base + 'firebase-firestore-compat.js');
            firebase.initializeApp(FIREBASE_CONFIG);
            Cloud.auth = firebase.auth(); Cloud.db = firebase.firestore();
            Cloud.ready = true;
            Cloud.auth.onAuthStateChanged(u => { Cloud.user = u; if (u) { Cloud.syncP = cloudSync('login'); } else { setCloudStatus('off'); } if (curTab === 'profile') renderTab('profile'); });
            return true;
        } catch (e) { Cloud.loadP = null; Cloud.err = 'ইন্টারনেট না থাকায় ক্লাউড সংযোগ হয়নি'; setCloudStatus('offline'); return false; }
    })();
    return Cloud.loadP;
}
function setCloudStatus(s) { Cloud.status = s; if (curTab === 'profile') renderTab('profile'); const e = $('#authStat'); if (e) e.textContent = cloudStatusText(); }
function cloudStatusText() {
    switch (Cloud.status) {
        case 'syncing': return 'সিঙ্ক হচ্ছে…';
        case 'ok': return 'সর্বশেষ সিঙ্ক: ' + (Cloud.last ? relDay(dkey(new Date(Cloud.last))) + ', ' + fmtClock(pad2(new Date(Cloud.last).getHours()) + ':' + pad2(new Date(Cloud.last).getMinutes())) : '');
        case 'error': return Cloud.err || 'সিঙ্ক হয়নি';
        case 'offline': return 'ইন্টারনেট নেই, সংযোগ পেলে সিঙ্ক হবে';
        default: return '';
    }
}
const strHash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
function cloudParts() {
    const rest = Object.assign({}, S); delete rest.days;
    const years = {};
    Object.keys(S.days).forEach(k => { const y = k.slice(0, 4); (years[y] = years[y] || {})[k] = S.days[k]; });
    const out = { root: JSON.stringify(rest), years: {} };
    Object.keys(years).forEach(y => { out.years[y] = JSON.stringify(years[y]); });
    return out;
}
async function cloudPush() {
    if (!Cloud.user || !Cloud.db) return;
    const ref = Cloud.db.collection('users').doc(Cloud.user.uid), parts = cloudParts(), batch = Cloud.db.batch();
    let n = 0;
    const rh = strHash(parts.root);
    if (Cloud.sig.root !== rh) { batch.set(ref, { data: parts.root, v: 2, email: Cloud.user.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); n++; }
    Object.keys(parts.years).forEach(y => {
        const h = strHash(parts.years[y]);
        if (Cloud.sig['y' + y] !== h) { batch.set(ref.collection('years').doc(y), { days: parts.years[y], updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); n++; }
    });
    if (n) await batch.commit();
    Cloud.sig.root = rh; Object.keys(parts.years).forEach(y => { Cloud.sig['y' + y] = strHash(parts.years[y]); });
}
function cloudErr(e) {
    const c = (e && (e.code || e.message)) || '';
    if (/permission-denied|Missing or insufficient/.test(c)) return 'ক্লাউডে লেখার অনুমতি নেই। Firestore Rules ঠিক করতে হবে';
    if (/unavailable|network|offline/.test(c)) return 'ইন্টারনেট সংযোগ নেই';
    if (/failed-precondition|not-found|project/.test(c)) return 'Firestore ডেটাবেস চালু করা হয়নি';
    return 'সিঙ্ক হয়নি, পরে আবার চেষ্টা করুন';
}
async function cloudSync(reason) {
    if (!Cloud.user || !Cloud.db || Cloud.busy) return;
    Cloud.busy = true; setCloudStatus('syncing');
    try {
        const uid = Cloud.user.uid, ref = Cloud.db.collection('users').doc(uid);
        const snap = await ref.get(), ys = await ref.collection('years').get();
        if (S.meta.uid && S.meta.uid !== uid) {
            const wipe = await ask({ title: 'অন্য অ্যাকাউন্টের ডেটা', text: 'এই ফোনের বর্তমান ডেটা অন্য একটি অ্যাকাউন্টের। ফোনের ডেটা মুছে শুধু এই অ্যাকাউন্টের ডেটা আনবেন, নাকি দুটো মিলিয়ে নেবেন?', ok: 'ফোনের ডেটা বদলান', cancel: 'মিলিয়ে নিন', danger: true });
            if (wipe) { LS.set(KEY + '_other_acct', JSON.stringify(S)); S = defaultState(); }
        }
        if (snap.exists) {
            const remote = JSON.parse(snap.data().data || '{}'); remote.days = {};
            Cloud.sig.root = strHash(snap.data().data || '');
            ys.forEach(d => { const str = d.data().days || '{}'; Cloud.sig['y' + d.id] = strHash(str); Object.assign(remote.days, JSON.parse(str)); });
            S = mergeStates(S, remote);
        }
        S.meta.uid = uid;
        saveState(true); applyTheme(); refreshUI();
        await cloudPush();
        Cloud.last = Date.now(); Cloud.err = ''; Cloud.busy = false; setCloudStatus('ok');
    } catch (e) { Cloud.busy = false; Cloud.err = cloudErr(e); setCloudStatus(navigator.onLine ? 'error' : 'offline'); }
}
function scheduleCloud() {
    if (!Cloud.user || !Cloud.db) return;
    clearTimeout(Cloud.timer);
    Cloud.timer = setTimeout(async () => {
        if (Cloud.busy || !navigator.onLine) return;
        try { await cloudPush(); Cloud.last = Date.now(); Cloud.err = ''; setCloudStatus('ok'); } catch (e) { Cloud.err = cloudErr(e); setCloudStatus('error'); }
    }, 5000);
}
const AUTH_ERR = {
    'auth/invalid-email': 'ইমেইল ঠিকানাটি সঠিক নয়', 'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট নেই', 'auth/wrong-password': 'পাসওয়ার্ড ভুল',
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড ভুল', 'auth/email-already-in-use': 'এই ইমেইলে আগেই অ্যাকাউন্ট খোলা আছে, "সাইন ইন" ট্যাবে যান',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন', 'auth/network-request-failed': 'ইন্টারনেট সংযোগ নেই', 'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন',
    'auth/operation-not-allowed': 'Firebase-এ Email/Password সাইন-ইন চালু করা হয়নি', 'auth/missing-password': 'পাসওয়ার্ড লিখুন', 'auth/missing-email': 'ইমেইল লিখুন', 'auth/user-disabled': 'এই অ্যাকাউন্ট বন্ধ করা আছে'
};
let authMode = 'in', authBusy = false;
function authHTML() {
    return segHTML([['in', 'সাইন ইন'], ['up', 'নতুন অ্যাকাউন্ট']], authMode, 'auth-tab') +
        '<p class="muted sm">ইমেইল দিয়ে ঢুকলে আপনার সব ইতিহাস ক্লাউডে সুরক্ষিত থাকে। অ্যাপ মুছে আবার ইনস্টল করলেও একই ইমেইলে ঢুকে সব ফিরে পাবেন।</p>' +
        '<form id="authForm" class="stack" novalidate>' +
(authMode === 'up' ? '<label class="lbl">আপনার নাম<input id="authName" class="field" type="text" maxlength="40" autocomplete="nickname" placeholder="যেমনঃ আব্দুল্লাহ" required></label>' : '') +
'<label class="lbl">ইমেইল<input id="authEmail" class="field" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required></label>' +
        '<label class="lbl">পাসওয়ার্ড<input id="authPass" class="field" type="password" autocomplete="' + (authMode === 'up' ? 'new-password' : 'current-password') + '" placeholder="কমপক্ষে ৬ অক্ষর" minlength="6" required></label>' +
        (authMode === 'up' ? '<label class="lbl">পাসওয়ার্ড আবার লিখুন<input id="authPass2" class="field" type="password" autocomplete="new-password" placeholder="একই পাসওয়ার্ড" required></label>' : '') +
        '<p id="authErr" class="err" role="alert" hidden></p>' +
        '<button type="submit" class="btn primary xl" id="authGo">' + (authMode === 'up' ? 'অ্যাকাউন্ট খুলুন' : 'সাইন ইন করুন') + '</button></form>' +
        (authMode === 'in' ? '<button type="button" class="link wide" data-act="auth-reset">পাসওয়ার্ড ভুলে গেছেন?</button>' : '') +
        '<p class="muted xs">আপনার পাসওয়ার্ড আমরা দেখতে পাই না। ডেটা শুধু আপনার অ্যাকাউন্টেই জমা হয়।</p>';
}
function authError(msg) { const e = $('#authErr'); if (e) { e.textContent = msg; e.hidden = !msg; } }
ACT['auth-open'] = async () => {
    if (!cloudConfigured()) {
        openSheet('<p class="lead">ক্লাউড সিঙ্ক এখনো চালু করা হয়নি।</p><p class="muted">অ্যাপের মালিক Firebase প্রজেক্টের তথ্য বসালেই ইমেইল সাইন-ইন কাজ করবে। ততদিন আপনার সব ডেটা এই ফোনেই সুরক্ষিত থাকবে, আর "ব্যাকআপ" বোতাম দিয়ে ফাইলে সেভ করে রাখতে পারবেন।</p>', { title: 'ক্লাউড সিঙ্ক' });
        return;
    }
    authMode = 'in'; openSheet(authHTML(), { title: 'ইমেইল দিয়ে সাইন ইন' });
    const ok = await cloudInit(); if (!ok) authError('সংযোগ হয়নি, ইন্টারনেট দেখে আবার চেষ্টা করুন');
};
ACT['auth-tab'] = el => { authMode = el.dataset.v; const b = $('#sheetBody'); if (b) b.innerHTML = authHTML(); };
document.addEventListener('submit', async e => {
    if (e.target.id !== 'authForm') return;
    e.preventDefault();
    if (authBusy) return;
    const email = $('#authEmail').value.trim(), pass = $('#authPass').value;
    const name = authMode === 'up' ? ($('#authName').value || '').trim() : '';
    if (authMode === 'up' && !name) { authError('আপনার নাম লিখুন'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { authError('ইমেইল ঠিকানাটি সঠিক নয়'); return; }
    if (pass.length < 6) { authError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন'); return; }
    if (authMode === 'up' && $('#authPass2').value !== pass) { authError('দুই জায়গায় পাসওয়ার্ড মেলেনি'); return; }
    authError(''); authBusy = true; const btn = $('#authGo'); btn.disabled = true; btn.textContent = 'অপেক্ষা করুন…';
    try {
        if (!(await cloudInit())) throw { code: 'auth/network-request-failed' };
        if (authMode === 'up') {
            await Cloud.auth.createUserWithEmailAndPassword(email, pass);
            if (Cloud.syncP) await Cloud.syncP;
            S.user.name = name; S.user.ts = Date.now(); saveState(); refreshUI();
            await cloudPush();
        } else {
            await Cloud.auth.signInWithEmailAndPassword(email, pass);
            if (Cloud.syncP) await Cloud.syncP;
        }
        closeSheet(true); toast(authMode === 'up' ? 'অ্যাকাউন্ট তৈরি হয়েছে, ডেটা সেভ হচ্ছে' : 'সাইন ইন হয়েছে, ইতিহাস মিলিয়ে নেওয়া হয়েছে');
    } catch (err) { authError(AUTH_ERR[err && err.code] || 'সাইন ইন করা যায়নি, আবার চেষ্টা করুন'); btn.disabled = false; btn.textContent = authMode === 'up' ? 'অ্যাকাউন্ট খুলুন' : 'সাইন ইন করুন'; }
    authBusy = false;
});
ACT['auth-reset'] = async () => {
    const email = ($('#authEmail').value || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { authError('উপরে ইমেইল লিখুন, তারপর এখানে চাপুন'); return; }
    try { await cloudInit(); await Cloud.auth.sendPasswordResetEmail(email); authError(''); toast('পাসওয়ার্ড বদলের লিংক ইমেইলে পাঠানো হয়েছে'); } catch (err) { authError(AUTH_ERR[err && err.code] || 'ইমেইল পাঠানো যায়নি'); }
};
ACT['cloud-sync'] = () => { if (!Cloud.user) return; toast('সিঙ্ক শুরু হচ্ছে…'); cloudSync('manual'); };
ACT['auth-out'] = async () => {
    if (!(await ask({ title: 'সাইন আউট করবেন?', text: 'ফোনের ডেটা এই ফোনেই থাকবে। আবার সাইন ইন করলে ক্লাউডের সাথে মিলে যাবে।', ok: 'সাইন আউট' }))) return;
    try { await Cloud.auth.signOut(); } catch (e) { }
    Cloud.user = null; Cloud.sig = {}; setCloudStatus('off'); toast('সাইন আউট হয়েছে');
};

/* ===== ২৩. লেভেল-আপ, অ্যাপ সম্পর্কে (i) ===== */
function levelUpSheet(l) {
    const unlock = Object.keys(THEMES).filter(k => THEMES[k].lock === l).map(k => THEMES[k].n);
    openSheet('<div class="lu"><div class="lu-m">' + medal(l, 'current', 'lu') + '</div><h3 class="tiro">' + LEVELS[l][0] + '</h3><p class="muted">আপনি লেভেল ' + bn(l + 1) + ' অর্জন করেছেন। আলহামদুলিল্লাহ, এভাবেই এগিয়ে যান।</p>' +
        (unlock.length ? '<p class="note-box">নতুন উপহার: <b>' + unlock.join(', ') + ' থিম</b> খুলে গেছে। সেটিং থেকে বেছে নিন।</p>' : '') +
        '<button type="button" class="btn primary" data-act="sheet-close">জাযাকাল্লাহু খাইরান</button></div>', { title: 'নতুন ব্যাজ অর্জিত' });
}
ACT['about-open'] = () => {
    openSheet('<div class="about"><div class="logo-m">' + icon('crescent', 34, 1.8) + '</div><h3 class="tiro">NafsCare Pro</h3><p class="muted">সংস্করণ ' + bn(APP_VERSION) + '</p>' +
        '<p>নিজের নামাজ, আমল ও জিকিরের হিসাব রাখার একটি শান্ত সঙ্গী। লক্ষ্য একটাই: প্রতিদিন একটু একটু করে নিজেকে শুধরে নেওয়া।</p>' +
        '<h4 class="sub-h">ডেটা ও গোপনীয়তা</h4><p class="muted sm">আপনার হিসাব এই ফোনেই থাকে। ইমেইলে সাইন ইন করলে আপনার নিজের অ্যাকাউন্টে ব্যাকআপ জমা হয়, আর কারো সাথে শেয়ার হয় না। অ্যাপ আপডেট করলে আগের ইতিহাস মোছে না।</p>' +
        '<h4 class="sub-h">যেসব সেবা ব্যবহার হয়</h4><p class="muted sm">নামাজের সময়: AlAdhan। ঠিকানা: BigDataCloud ও OpenStreetMap। কুরআনের লেখা: AlQuran Cloud। তিলাওয়াত: MP3Quran ও EveryAyah।</p>' +
        '<h4 class="sub-h">হাদিস সম্পর্কে</h4><p class="muted sm">হাদিসগুলো বাংলা ভাবার্থ। আমলের আগে নির্ভরযোগ্য আলেমের কাছে যাচাই করে নেওয়া ভালো।</p>' +
        '<p class="made">তৈরি করেছে <b>FajleVerse</b>, ভালোবাসা ও দোয়ার সাথে।</p></div>', { title: 'অ্যাপ সম্পর্কে' });
};
/* ===== অভ্যাস ত্যাগ ট্র্যাকার + রমজান কাউন্টডাউন ===== */
const RAMADAN_DATES = ['2027-02-09', '2028-01-28'];
function ramadanCountdownHTML() {
    const today = dkey();
    const next = RAMADAN_DATES.find(d => d >= today);
    if (!next) return '';
    const d = daysBetween(today, next);
    if (d <= 0) return '';
    return '<section class="card" aria-label="রমজান কাউন্টডাউন"><div class="card-h"><h2 class="tiro">' + icon('crescent', 20, 2) + ' রমজান পর্যন্ত বাকি</h2></div>' +
        '<p class="tiro" style="font-size:30px;margin:4px 0">' + bn(d) + ' দিন</p>' +
        '<p class="muted xs">আনুমানিক তারিখ, চাঁদ দেখার উপর নির্ভরশীল (১ দিন আগে-পরে হতে পারে)</p></section>';
}
function habitsCardHTML() {
    const today = dkey();
    const rows = S.habits.map(h => {
        const d = daysBetween(h.start, today);
        return '<div class="swr"><span class="lr-t"><b>' + esc(h.name) + '</b><small class="muted">' + bn(Math.max(0, d)) + ' দিন ধরে বিরত</small></span>' +
            '<span style="display:flex;gap:6px"><button type="button" class="iconbtn sm" data-act="habit-reset" data-id="' + h.id + '" aria-label="আবার শুরু">' + icon('undo', 18, 2.2) + '</button>' +
            '<button type="button" class="iconbtn sm" data-act="habit-del" data-id="' + h.id + '" aria-label="মুছুন">' + icon('trash', 18, 2.2) + '</button></span></div>';
    }).join('');
    return '<section class="card"><div class="card-h"><h2 class="tiro">অভ্যাস ত্যাগ ট্র্যাকার</h2></div>' +
        (S.habits.length ? rows : '<p class="muted sm">যে অভ্যাস ছাড়তে চান, সেটা যোগ করুন — প্রতিদিন কত দিন ধরে বিরত আছেন দেখতে পাবেন।</p>') +
        '<button type="button" class="btn outline wide" data-act="habit-add" style="margin-top:10px">' + icon('plus', 18, 2.2) + ' নতুন অভ্যাস যোগ করুন</button></section>';
}
ACT['habit-add'] = () => {
    openSheet('<label class="lbl">কোন অভ্যাস ছাড়তে চান?<input id="habitName" class="field" type="text" maxlength="40" placeholder="যেমনঃ ধূমপান"></label>' +
        '<button type="button" class="btn primary xl wide" data-act="habit-save">শুরু করুন</button>', { title: 'নতুন অভ্যাস' });
};
ACT['habit-save'] = () => {
    const name = ($('#habitName').value || '').trim();
    if (!name) { toast('নাম লিখুন'); return; }
    S.habits.push({ id: 'h' + Date.now(), name: name, start: dkey() });
    closeSheet(true); saveState(); refreshUI(); toast('যোগ হয়েছে, আজ থেকে গোনা শুরু');
};
ACT['habit-reset'] = async el => {
    if (!(await ask({ title: 'আবার শুরু করবেন?', text: 'দিনের হিসাব আজ থেকে আবার শুরু হবে।', ok: 'আবার শুরু' }))) return;
    const h = S.habits.find(x => x.id === el.dataset.id); if (!h) return;
    h.start = dkey(); saveState(); refreshUI();
};
ACT['habit-del'] = async el => {
    if (!(await ask({ title: 'মুছে ফেলবেন?', text: 'এই অভ্যাসের ট্র্যাকিং মুছে যাবে।', ok: 'মুছুন', danger: true }))) return;
    S.habits = S.habits.filter(x => x.id !== el.dataset.id); saveState(); refreshUI();
};
/* ===== ২৪. প্রোফাইল ===== */
function cloudCardHTML() {
    if (Cloud.user) return '<section class="card"><div class="card-h"><h2 class="tiro">অ্যাকাউন্ট</h2><span class="chip">' + icon('cloud', 14, 2.2) + ' ক্লাউডে সুরক্ষিত</span></div>' +
        '<p class="acc-mail">' + esc(Cloud.user.email || '') + '</p><p class="muted sm" id="authStat">' + esc(cloudStatusText()) + '</p>' +
        '<div class="row2"><button type="button" class="btn outline" data-act="cloud-sync">' + icon('refresh', 18, 2.2) + ' এখনই সিঙ্ক</button><button type="button" class="btn ghost" data-act="auth-out">' + icon('logout', 18, 2.2) + ' সাইন আউট</button></div></section>';
    return '<section class="card"><div class="card-h"><h2 class="tiro">অ্যাকাউন্ট</h2></div><p class="muted sm">ইমেইল দিয়ে সাইন ইন করুন। তাহলে ফোন বদলালে বা অ্যাপ মুছে আবার ইনস্টল করলেও আপনার পুরো ইতিহাস ফিরে পাবেন।</p>' +
        '<button type="button" class="btn primary" data-act="auth-open">' + icon('mail', 20, 2) + ' ইমেইল দিয়ে সাইন ইন / সাইন আপ</button>' + (Cloud.status === 'offline' ? '<p class="muted xs">' + esc(cloudStatusText()) + '</p>' : '') + '</section>';
}
RENDER.profile = function () {
    const el = $('#tab-profile'), pts = totalPoints(), bl = badgeLevel(), lv = levelInfo(pts), shown = Math.max(bl, lv.i);
    const nx = LEVELS[shown + 1], pct = nx ? clamp(Math.round((pts - LEVELS[shown][1]) / (nx[1] - LEVELS[shown][1]) * 100), 0, 100) : 100;
    el.innerHTML =
        '<header class="top"><div class="top-l"><span class="muted sm">আপনার যাত্রা</span><h1 class="tiro h1">প্রোফাইল</h1></div><div class="top-r"><button type="button" class="iconbtn" data-act="settings-open" aria-label="সেটিং">' + icon('gear', 22) + '</button><button type="button" class="iconbtn" data-act="about-open" aria-label="অ্যাপ সম্পর্কে">' + icon('info', 22) + '</button></div></header>' +
        '<section class="parch"><div class="av-w">' + ringSVG(pct, 128, 7, 'gold') + '<div class="av">' + icon(S.user.avatar || 'mosque', 42, 1.8) + '</div><span class="lv-tag">লেভেল ' + bn(shown + 1) + '</span></div>' +
        '<h2 class="tiro pname">' + esc(S.user.name) + '</h2><span class="lv-name">' + LEVELS[shown][0] + '</span>' +
        '<div class="lv-bar"><div class="lv-t"><span>' + bn(pts) + ' পয়েন্ট</span><span class="muted">' + (nx ? 'পরের লেভেল ' + bn(nx[1]) : 'সর্বোচ্চ লেভেল') + '</span></div><div class="bar full"><i style="width:' + pct + '%"></i></div>' +
        (nx ? '<span class="muted sm">' + nx[0] + ' হতে আর ' + bn(Math.max(0, nx[1] - pts)) + ' পয়েন্ট</span>' : '') + '</div></section>' +
        '<section class="card stats3 plain"><div class="st"><span class="muted sm">মোট দিন</span><b class="tiro">' + bn(activeDaysCount()) + '</b></div><div class="st"><span class="muted sm">স্ট্রেইক</span><b class="tiro">' + bn(streak()) + '</b></div><div class="st"><span class="muted sm">মোট পয়েন্ট</span><b class="tiro">' + bn(pts) + '</b></div></section>' +
        '<button type="button" class="card setrow" data-act="settings-open"><span class="sr-i">' + icon('gear', 24) + '</span><span class="lr-t"><b class="tiro">সেটিং</b><small class="muted">থিম, ফিচার, নামাজের হিসাব, নোটিফিকেশন, ডেটা</small></span>' + icon('fwd', 20, 2.2) + '</button>' +
        cloudCardHTML() +
        '<section class="card"><div class="card-h"><h2 class="tiro">ব্যাজ ও লেভেল</h2><span class="muted sm">' + bn(shown + 1) + '/১০ অর্জিত</span></div><div class="badges">' +
        LEVELS.map((L, i) => '<div class="bdg' + (i > shown ? ' lk' : '') + '">' + medal(i, i < shown ? 'done' : i === shown ? 'current' : 'locked', 'p') + '<b>' + L[0] + '</b><small class="muted">' + bn(L[1]) + ' পয়েন্ট</small></div>').join('') + '</div></section>' +
        '<section class="card"><div class="card-h"><h2 class="tiro">ডেটা ও নিরাপত্তা</h2></div><p class="muted sm">অ্যাপ আপডেট করলেও আপনার সব ইতিহাস আগের মতোই থাকে। চাইলে আলাদা ব্যাকআপও রাখতে পারেন।</p>' +
        '<div class="row2"><button type="button" class="btn outline" data-act="bk-dl">' + icon('down', 18, 2.2) + ' ব্যাকআপ</button><button type="button" class="btn outline" data-act="bk-open">' + icon('up', 18, 2.2) + ' রিস্টোর</button></div></section>' +
        '<button type="button" class="wm" data-act="about-open" aria-label="অ্যাপ সম্পর্কে">NafsCare · FajleVerse</button>';
};

/* ===== ২৫. সেটিং ===== */
const METHODS = [[1, 'করাচি'], [3, 'মুসলিম ওয়ার্ল্ড লীগ'], [2, 'ISNA (উত্তর আমেরিকা)'], [4, 'উম্মুল কুরা (মক্কা)'], [5, 'মিশর']];
const getPath = (o, p) => p.split('.').reduce((a, k) => a && a[k], o);
function setPath(o, p, v) { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }
function swRow(label, sub, path) {
    const on = !!getPath(S.set, path);
    return '<div class="swr"><span class="lr-t"><b>' + label + '</b>' + (sub ? '<small class="muted">' + sub + '</small>' : '') + '</span><button type="button" role="switch" class="sw' + (on ? ' on' : '') + '" aria-checked="' + on + '" aria-label="' + label + '" data-act="sw" data-p="' + path + '"><i></i></button></div>';
}
function settingsHTML() {
    const bl = badgeLevel();
    const themes = Object.keys(THEMES).map(k => {
        const t = THEMES[k], lock = bl < t.lock;
        return '<button type="button" class="thm' + (S.set.theme === k && !S.set.auto ? ' on' : '') + (lock ? ' lk' : '') + '" data-act="theme-pick" data-t="' + k + '" aria-pressed="' + (S.set.theme === k && !S.set.auto) + '"><span class="thm-sw" data-pv="' + k + '"><i></i><i></i><i></i></span><b>' + t.n + '</b><small class="muted">' + (lock ? 'লেভেল ' + bn(t.lock + 1) + '-এ খুলবে' : t.sub) + '</small>' + (lock ? '<span class="thm-l">' + icon('lock', 16, 2.2) + '</span>' : '') + '</button>';
    }).join('');
    const anyDark = bl >= THEMES.isha.lock || bl >= THEMES.maghrib.lock;
    const arList = AYAH_RECS.map(r => '<option value="' + r[0] + '"' + (S.set.ayahReciter === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('');
    return '<div class="set">' +
        '<section class="set-sec"><h3>প্রোফাইল</h3><label class="lbl">আপনার নাম<input class="field" type="text" maxlength="40" value="' + esc(S.user.name) + '" data-ch="set-name" autocomplete="nickname"></label>' +
        '<p class="sub-h">সম্বোধন</p><div class="chips">' + [['auto', 'নাম দেখে'], ['male', 'ভাই'], ['female', 'বোন']].map(x => '<button type="button" class="chip-b' + (S.user.gender === x[0] ? ' on' : '') + '" data-act="gender" data-v="' + x[0] + '" aria-pressed="' + (S.user.gender === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
        '<p class="sub-h">ছবির চিহ্ন</p><div class="avs">' + AVATARS.map(a => '<button type="button" class="avb' + (S.user.avatar === a ? ' on' : '') + '" data-act="avatar" data-v="' + a + '" aria-label="চিহ্ন: ' + a + '" aria-pressed="' + (S.user.avatar === a) + '">' + icon(a, 22, 1.9) + '</button>').join('') + '</div></section>' +
        '<section class="set-sec"><h3>থিম</h3><div class="thms">' + themes + '</div>' + (anyDark ? swRow('ওয়াক্ত অনুযায়ী থিম', 'মাগরিবে ও রাতে নিজে থেকে গাঢ় থিম', 'auto') : '<p class="muted xs">লেভেল বাড়লে নতুন থিম উপহার হিসেবে খুলবে।</p>') + '</section>' +
        '<section class="set-sec"><h3>নামাজের হিসাব</h3><p class="sub-h">সময় গণনার পদ্ধতি</p><div class="chips wrap">' + METHODS.map(m => '<button type="button" class="chip-b' + (S.set.method === m[0] ? ' on' : '') + '" data-act="method" data-v="' + m[0] + '" aria-pressed="' + (S.set.method === m[0]) + '">' + m[1] + '</button>').join('') + '</div>' +
        '<p class="sub-h">আসরের মাজহাব</p><div class="chips">' + [[1, 'হানাফি'], [0, 'শাফিয়ি, মালিকি, হাম্বলি']].map(m => '<button type="button" class="chip-b' + (S.set.school === m[0] ? ' on' : '') + '" data-act="school" data-v="' + m[0] + '" aria-pressed="' + (S.set.school === m[0]) + '">' + m[1] + '</button>').join('') + '</div></section>' +
        '<section class="set-sec"><h3>ফিচার চালু/বন্ধ</h3><p class="muted xs">যেটা দরকার নেই, বন্ধ রাখুন। বন্ধ করলে ডেটা মোছে না।</p>' +
        swRow('সুন্নত মুয়াক্কাদা ট্র্যাকিং', 'প্রতি ওয়াক্তে সুন্নতের বোতাম', 'f.sunnah') + swRow('কাজা নামাজ', 'ওয়াক্ত শেষে টিক না থাকলে নিজে যোগ হবে', 'f.qada') +
        swRow('অ্যাপ বন্ধ থাকা দিনের প্রশ্ন', 'কয়েকদিন পর খুললে কাজা যোগ করবেন কিনা জিজ্ঞেস করবে', 'f.qadaGap') + swRow('নিষিদ্ধ সময়ের সতর্কতা', 'সূর্যোদয়, দুপুর, সূর্যাস্ত', 'f.forbidden') +
        swRow('হাদিস কার্ড', 'হোম পেজে প্রতি ২ ঘণ্টায় নতুন হাদিস', 'f.hadith') + swRow('তাসবিহে কম্পন', '', 'f.vib') + swRow('তাসবিহে ক্লিকের শব্দ', '', 'f.sound') + '</section>' +
        '<section class="set-sec"><h3>নোটিফিকেশন</h3>' + swRow('ওয়াক্ত শুরুর বার্তা', 'নতুন ওয়াক্ত শুরু হলে', 'n.prayer') + swRow('প্রতি ২ ঘণ্টায় হাদিস', 'প্রতি দুই ঘণ্টায় একটি করে', 'n.hadith') +
        '<p class="note-box">নোটিফিকেশন শুধু অ্যাপ খোলা বা পেছনে চালু থাকলে আসে। অ্যাপ পুরোপুরি বন্ধ থাকলে ফোনের নিয়মে আসে না। এই পরিবেশে অনুমতি না মিললে অ্যাপের ভেতরে বার্তা দেখাবে।</p></section>' +
        '<section class="set-sec"><h3>কুরআন</h3><label class="lbl">আয়াত শোনার ক্বারী (পড়া ও হিফজে)<select class="field" data-ch="ayah-rec">' + arList + '</select></label>' +
        swRow('পরের সূরা অটো চালু', '', 'autoNext') + '<div class="row2"><span class="lr-t"><b>অফলাইনে পড়া</b><small class="muted" id="dlInfo">সংরক্ষিত সূরা গুনছি…</small></span><button type="button" class="btn outline sm" data-act="dl-all">সব সূরা নামান</button></div></section>' +
        '<section class="set-sec"><h3>ডেটা</h3><div class="row2"><button type="button" class="btn outline" data-act="bk-dl">' + icon('down', 18, 2.2) + ' ব্যাকআপ ফাইল</button><button type="button" class="btn outline" data-act="bk-open">' + icon('up', 18, 2.2) + ' রিস্টোর</button></div>' +
        '<button type="button" class="btn ghost wide" data-act="bk-copy">' + icon('copy', 18, 2) + ' ব্যাকআপ কপি করুন</button>' +
        '<button type="button" class="btn danger wide" data-act="reset-all">' + icon('trash', 18, 2) + ' ফোনের সব ডেটা মুছুন</button></section></div>';
}
function paintSettings() {
    const b = $('#sheetBody'); if (!b || !b.querySelector('.set')) return;
    const top = b.scrollTop; b.innerHTML = settingsHTML(); b.scrollTop = top; updateDlInfo();
}
async function updateDlInfo() { const e = $('#dlInfo'); if (e) { const n = await savedSurahCount(); const e2 = $('#dlInfo'); if (e2) e2.textContent = 'ফোনে সংরক্ষিত: ' + bn(n) + '/১১৪ সূরা'; } }
ACT['settings-open'] = () => { openSheet(settingsHTML(), { title: 'সেটিং', onClose: () => refreshUI() }); updateDlInfo(); };
function setChanged() { S.set.ts = Date.now(); saveState(); applyTheme(); paintSettings(); }
ACT.sw = el => {
    const p = el.dataset.p, v = !getPath(S.set, p); setPath(S.set, p, v);
    if (p === 'f.qada' && v) { S.meta.qadaFrom = Date.now(); S.meta.lastSeen = dkey(); }
    setChanged();
    if (v && p === 'n.prayer' || v && p === 'n.hadith') askNotif().then(r => { if (r === 'granted') { toast('নোটিফিকেশন চালু হয়েছে'); if (p === 'n.hadith') S.meta.hSlotN = hadithSlot(); } else if (r === 'unsupported') toast('এই পরিবেশে নোটিফিকেশন নেই, অ্যাপের ভেতরেই বার্তা দেখাবে'); else toast('অনুমতি পাওয়া যায়নি, অ্যাপের ভেতরেই বার্তা দেখাবে'); });
};
ACT['theme-pick'] = el => {
    const k = el.dataset.t, t = THEMES[k];
    if (badgeLevel() < t.lock) { toast('লেভেল ' + bn(t.lock + 1) + ' অর্জন করলে এই থিম খুলবে'); return; }
    S.set.theme = k; S.set.auto = false; setChanged();
};
ACT.method = el => { S.set.method = +el.dataset.v; setChanged(); if (LOC) { TIMSRC = 'default'; useCachedTimings(); loadTimes(LOC.lat, LOC.lon); } };
ACT.school = el => { S.set.school = +el.dataset.v; setChanged(); if (LOC) { TIMSRC = 'default'; useCachedTimings(); loadTimes(LOC.lat, LOC.lon); } };
ACT.gender = el => { S.user.gender = el.dataset.v; S.user.ts = Date.now(); saveState(); paintSettings(); };
ACT.avatar = el => { S.user.avatar = el.dataset.v; S.user.ts = Date.now(); saveState(); paintSettings(); };
INP['set-name'] = el => { S.user.name = el.value.trim() || 'মুসাফির'; S.user.ts = Date.now(); saveState(); el.value = S.user.name; };
INP['ayah-rec'] = el => { S.set.ayahReciter = el.value; S.set.ts = Date.now(); saveState(); toast('আয়াতের ক্বারী বদলেছে'); };
ACT['dl-all'] = async () => {
    if (!navigator.onLine) { toast('ইন্টারনেট সংযোগ নেই'); return; }
    toast('সব সূরা নামানো শুরু হয়েছে, কিছুক্ষণ লাগবে…', { ms: 3500 });
    const r = await downloadAllSurahs((d) => { const e = $('#dlInfo'); if (e) e.textContent = 'নামানো হচ্ছে: ' + bn(d) + '/১১৪'; });
    toast(r.fail ? bn(r.fail) + 'টি সূরা নামেনি, আবার চেষ্টা করুন' : 'সব সূরা ফোনে সংরক্ষিত হয়েছে'); updateDlInfo();
};

/* ===== ২৬. ব্যাকআপ, রিস্টোর, সব মুছে ফেলা ===== */
const backupJSON = () => JSON.stringify({ app: 'nafscare', v: 2, exported: new Date().toISOString(), data: S });
ACT['bk-dl'] = () => {
    try {
        const url = URL.createObjectURL(new Blob([backupJSON()], { type: 'application/json' })), a = document.createElement('a');
        a.href = url; a.download = 'NafsCare_Backup_' + dkey() + '.json'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000); toast('ব্যাকআপ ফাইল তৈরি হয়েছে। না পেলে "ব্যাকআপ কপি করুন" ব্যবহার করুন', { ms: 4200 });
    } catch (e) { copyText(backupJSON()); }
};
ACT['bk-copy'] = () => copyText(backupJSON());
ACT['bk-open'] = () => {
    openSheet('<p class="muted">ব্যাকআপ ফাইল বেছে নিন, বা কপি করা লেখা নিচে পেস্ট করুন। রিস্টোর করলে বর্তমান ডেটার সাথে <b>মিলিয়ে</b> নেওয়া হয়, কিছুই মোছে না।</p>' +
        '<label class="btn outline wide filebtn">' + icon('up', 18, 2.2) + ' ফাইল বেছে নিন<input type="file" accept=".json,application/json" data-ch="bk-file" hidden></label>' +
        '<textarea id="bkText" class="field area" rows="5" placeholder="অথবা এখানে ব্যাকআপের লেখা পেস্ট করুন"></textarea><button type="button" class="btn primary" data-act="bk-paste">পেস্ট করা লেখা থেকে রিস্টোর</button>', { title: 'রিস্টোর' });
};
INP['bk-file'] = el => { const f = el.files && el.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => restoreFromText(String(r.result)); r.readAsText(f); };
ACT['bk-paste'] = () => restoreFromText(($('#bkText') || {}).value || '');
function restoreFromText(txt) {
    let o; try { o = JSON.parse(txt); } catch (e) { toast('এই লেখা বা ফাইলটি পড়া যায়নি'); return; }
    let d = o && o.data ? o.data : o;
    if (!d || typeof d !== 'object' || (!d.days && !d.dailyRecords)) { toast('এটি NafsCare-এর ব্যাকআপ বলে মনে হচ্ছে না'); return; }
    if (d.v !== 2) d = migrateV1(d);
    LS.set(KEY + '_before_restore', JSON.stringify(S));
    S = mergeStates(S, fillDefaults(d, defaultState()));
    saveState(true); applyTheme(); closeSheet(true); refreshUI(); toast('রিস্টোর হয়েছে, আগের কিছুই মোছেনি');
}
ACT['reset-all'] = async () => {
    if (!(await ask({ title: 'ফোনের সব ডেটা মুছবেন?', text: 'এই ফোনের সব ইতিহাস মুছে যাবে। ক্লাউডে সেভ থাকা ডেটা মুছবে না। আগে ব্যাকআপ নিয়ে রাখা ভালো।', ok: 'হ্যাঁ, মুছুন', danger: true }))) return;
    if (!(await ask({ title: 'শেষবারের মতো নিশ্চিত করুন', text: 'এটি আর ফেরানো যাবে না। সত্যিই মুছবেন?', ok: 'মুছে ফেলুন', danger: true }))) return;
    LS.set(KEY + '_before_reset', JSON.stringify(S));
    if (Cloud.user) { try { await Cloud.auth.signOut(); } catch (e) { } Cloud.user = null; Cloud.sig = {}; }
    S = defaultState(); saveState(true); closeSheet(true); applyTheme(); go('home'); toast('ফোনের ডেটা মুছে ফেলা হয়েছে');
};

/* ===== ২৭. চালু করা ===== */
function boot() {
    S = loadState();
    S.meta.lvl = Math.max(S.meta.lvl || 0, levelInfo(totalPoints()).i);
    useCachedTimings();
    applyTheme();
    renderNav();
    Q.s = (S.quran.last && S.quran.last.s) || 1;
    bindAudio();
    go('home');
    if (loadState.restored) toast('ডেটা গতকালের ব্যাকআপ থেকে ফিরিয়ে আনা হয়েছে', { ms: 4500 });
    qadaBoot();
    startLocation(false);
    setInterval(tick1, 1000); setInterval(tick30, 30000);
    tick1();
    if (cloudConfigured()) cloudInit();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
    $('#scroll').addEventListener('scroll', trackLastRead, { passive: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

/* ---- র‍্যাপার অ্যাপের "টেনে রিফ্রেশ" আটকানো: পেজ সবসময় ১px নিচে থাকে ---- */
(function () {
    const root = document.scrollingElement || document.documentElement;
    const pin = () => { if (root.scrollTop < 1) root.scrollTop = 1; };
    window.addEventListener('load', () => setTimeout(pin, 50));
    window.addEventListener('scroll', pin, { passive: true });
    window.addEventListener('resize', pin);
    document.addEventListener('visibilitychange', pin);
})();
