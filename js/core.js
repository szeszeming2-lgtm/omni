/* OMNI web — core: helpers, storage, settings, UI primitives, navigation, timers, notes, tools. */
'use strict';
const O = window.O = {};

/* ---------- DOM helpers ---------- */
// Views pass optional pieces as `cond ? el : null`; empty pieces are skipped instead of printing "null".
for (const m of ['append', 'replaceChildren']) {
  const native = Element.prototype[m];
  Element.prototype[m] = function (...kids) { return native.apply(this, kids.filter(k => k != null && k !== false)); };
}
O.$ = (s, r = document) => r.querySelector(s);
O.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
O.h = function (tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
};
const h = O.h;
O.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
O.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
O.sleep = ms => new Promise(r => setTimeout(r, ms));
O.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- Icons (24×24 stroke) ---------- */
const P = {
  discover: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  vision: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  voice: 'M4 10v4 M8 6v12 M12 3v18 M16 7v10 M20 10v4',
  gesture: 'M7 11V5.5a1.5 1.5 0 0 1 3 0V10 M10 10V4a1.5 1.5 0 0 1 3 0v6 M13 10V5a1.5 1.5 0 0 1 3 0v6 M16 11V8a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7s-5-2-7-5l-2-3a1.5 1.5 0 0 1 2.5-1.6L7 14',
  control: 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M7.8 7.8a6 6 0 0 0 0 8.4 M16.2 7.8a6 6 0 0 1 0 8.4 M5 5a10 10 0 0 0 0 14 M19 5a10 10 0 0 1 0 14',
  devices: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z',
  spatial: 'M12 2l8 4.5v9L12 20l-8-4.5v-9z M12 11l8-4.5 M12 11v9 M12 11L4 6.5',
  scanner: 'M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M8 9h8 M8 12h8 M8 15h5',
  automation: 'M6 6m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M18 6m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M12 18m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M8 6h8 M7 8l4 8 M17 8l-4 8',
  workshop: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  all: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M5 11a7 7 0 0 0 14 0 M12 18v3',
  stop: 'M7 7h10v10H7z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  flip: 'M4 12a8 8 0 0 1 14-5.3L20 9 M20 4v5h-5 M20 12a8 8 0 0 1-14 5.3L4 15 M4 20v-5h5',
  photo: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15 9.5a1.5 1.5 0 1 0 0-.1',
  text: 'M5 6h14 M12 6v13 M8 19h8',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 18h2v2h-2z M14 18h2 M18 14h2',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9',
  plus: 'M12 5v14 M5 12h14',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12 M18 6L6 18',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  copy: 'M9 9h11v11H9z M5 15H4V4h11v1',
  share: 'M12 3v12 M7 8l5-5 5 5 M5 13v7h14v-7',
  timer: 'M12 8v5l3 2 M9 2h6 M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  note: 'M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  mail: 'M3 6h18v12H3z M3 7l9 6 9-6',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14',
  wifi: 'M5 12.5a10 10 0 0 1 14 0 M8.5 16a5 5 0 0 1 7 0 M12 19.5h.01 M2 9a14 14 0 0 1 20 0',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4',
  macbook: 'M5 5h14v10H5z M2 18h20l-1.5 2h-17z',
  iphone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10',
  gyro: 'M12 12m-9 0a9 9 0 1 0 18 0 9 9 0 1 0-18 0 M12 12m-3 0a3 9 0 1 0 6 0 3 9 0 1 0-6 0 M3 12h18',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15.5 8.5l-2 5-5 2 2-5z',
  game: 'M6 12h4 M8 10v4 M15 11h.01 M18 13h.01 M7 6h10a5 5 0 0 1 5 5v2a4 4 0 0 1-7 2.6L14 14h-4l-1 1.6A4 4 0 0 1 2 13v-2a5 5 0 0 1 5-5z',
  speaker: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12',
  hand: 'M7 11V5.5a1.5 1.5 0 0 1 3 0V10 M10 10V4a1.5 1.5 0 0 1 3 0v6 M13 10V5a1.5 1.5 0 0 1 3 0v6 M16 11V8a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7s-5-2-7-5l-2-3a1.5 1.5 0 0 1 2.5-1.6L7 14',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7z M13 4h4v16h-4z',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 20h14',
  upload: 'M12 21V9 M7 14l5-5 5 5 M5 4h14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  folder: 'M3 6h6l2 2h10v11H3z',
  stack: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5 M3 17l9 5 9-5',
  sparkle: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
  chevron: 'M9 6l6 6-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v6 M12 7.5h.01',
};
O.icon = function (name, cls) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', P[name] || P.sparkle);
  svg.append(p);
  return svg;
};
O.badge = (icon, color = 'var(--cyan)', size = 40, filled = false) =>
  h('span', { class: 'badge' + (filled ? ' filled' : ''), style: { '--c': color, '--s': size + 'px' } }, O.icon(icon));

/* ---------- Storage ---------- */
O.store = {
  get(k, def) { try { const v = localStorage.getItem('omni.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem('omni.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('omni.' + k); } catch (e) {} },
};

/* ---------- Settings ---------- */
const DEFAULTS = {
  onboarded: false, userName: '', wakePhrase: 'omni', wakeOn: true, spoken: true, voiceURI: '', rate: 1,
  confirmPhysical: true, sensitivity: 0.5, cooldown: 1.0, tiltDeg: 28, haptics: true,
  calib: { extendRatio: 1.45, pinchRatio: 0.30, at: null }, onlineLookups: false,
};
O.settings = Object.assign({}, DEFAULTS, O.store.get('settings', {}));
O.setSetting = function (k, v) { O.settings[k] = v; O.store.set('settings', O.settings); O.bus.emit('settings', k); };

/* ---------- Event bus ---------- */
O.bus = {
  map: {},
  on(t, fn) { (this.map[t] ||= []).push(fn); return () => { this.map[t] = this.map[t].filter(f => f !== fn); }; },
  emit(t, p) { for (const fn of (this.map[t] || []).slice()) { try { fn(p); } catch (e) { console.error(e); } } },
};

/* ---------- Activity log ---------- */
O.log = {
  entries: [],
  add(title, detail = '', kind = 'info', icon = 'sparkle') {
    this.entries.unshift({ id: O.uid(), at: new Date(), title, detail, kind, icon });
    this.entries.length = Math.min(this.entries.length, 150);
    O.bus.emit('log');
  },
};

/* ---------- Haptics (iOS 18 switch trick, else vibrate) ---------- */
O.haptic = function (kind = 'tap') {
  if (!O.settings.haptics) return;
  try {
    if (navigator.vibrate) { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; navigator.vibrate(kind === 'warn' ? [12, 60, 12] : kind === 'success' ? [8, 40, 8] : 8); return; }
    O.$('#haptic').click();
  } catch (e) {}
};

/* ---------- Toast ---------- */
let toastTimer;
O.toast = function (text, ok = true) {
  const t = O.$('#toast');
  t.textContent = text; t.className = 'toast' + (ok ? '' : ' warn'); t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
};

/* ---------- In-page confirmation (never window.confirm) ---------- */
O.confirm = function ({ title, message = '', ok = 'Confirm', danger = false, icon = '!' }) {
  return new Promise(resolve => {
    const box = O.$('#confirm');
    O.$('#confirmTitle').textContent = title;
    O.$('#confirmMsg').textContent = message;
    O.$('#confirmIcon').textContent = icon;
    const yes = O.$('#confirmYes'), no = O.$('#confirmNo');
    yes.textContent = ok; yes.className = 'btn ' + (danger ? 'danger' : 'primary');
    box.hidden = false; yes.focus();
    const done = v => { box.hidden = true; yes.onclick = no.onclick = box.onclick = null; resolve(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
    box.onclick = e => { if (e.target === box) done(false); };
  });
};

/* ---------- Sheet (modal on desktop, bottom sheet on phones) ---------- */
O.sheet = {
  onClose: null,
  open(title, build) {
    const s = O.$('#sheet');
    O.$('#sheetTitle').textContent = title;
    const body = O.$('#sheetBody'); body.replaceChildren();
    build(body);
    s.hidden = false;
    s.querySelectorAll('[data-close]').forEach(el => el.onclick = () => this.close());
  },
  close() { O.$('#sheet').hidden = true; const f = this.onClose; this.onClose = null; f && f(); },
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!O.$('#confirm').hidden) O.$('#confirmNo').click(); else if (!O.$('#sheet').hidden) O.sheet.close(); }
});

/* ---------- Script loader for optional libraries (pinned versions) ---------- */
const loaded = {};
O.loadScript = function (src) {
  return loaded[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => res(); s.onerror = () => { delete loaded[src]; rej(new Error('Could not download ' + src.split('/').slice(-1)[0] + '. Check your connection.')); };
    document.head.append(s);
  });
};
O.LIB = {
  jsqr: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  mpVision: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs',
  mpWasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
  handModel: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  objectModel: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite',
};
let mpPromise;
O.mediapipe = () => mpPromise ||= import(O.LIB.mpVision).then(async mp => ({ mp, files: await mp.FilesetResolver.forVisionTasks(O.LIB.mpWasm) }))
  .catch(e => { mpPromise = null; throw new Error('Could not download the vision engine. Check your connection and try again.'); });

/** Tries the GPU for speed, but never lets a stuck graphics driver hang the app. */
O.gpuOrCpu = async function (make, ms = 9000) {
  let timer;
  const stuck = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('GPU start timed out')), ms); });
  try { return await Promise.race([make('GPU'), stuck]); }
  catch (e) { return make('CPU'); }
  finally { clearTimeout(timer); }
};

/* ---------- Device facts ---------- */
O.device = (() => {
  const ua = navigator.userAgent;
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const iPhone = /iPhone|iPod/.test(ua);
  const android = /Android/.test(ua);
  const kind = iPad ? 'iPad' : iPhone ? 'iPhone' : android ? (/Mobile/.test(ua) ? 'phone' : 'tablet') : 'computer';
  return {
    kind, iOS: iPad || iPhone, apple: iPad || iPhone || /Macintosh/.test(ua), touch: navigator.maxTouchPoints > 0,
    label: { iPad: 'iPad', iPhone: 'iPhone', phone: 'phone', tablet: 'tablet', computer: /Macintosh/.test(ua) ? 'Mac' : 'computer' }[kind],
    camera: !!navigator.mediaDevices?.getUserMedia,
    speechIn: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    speechOut: 'speechSynthesis' in window,
    motion: 'DeviceOrientationEvent' in window && (navigator.maxTouchPoints > 0),
    notifications: 'Notification' in window,
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
  };
})();

/* ---------- Sections & navigation ---------- */
O.sections = [
  { id: 'discover', title: 'Discover', icon: 'discover', tag: 'Your command overview' },
  { id: 'vision', title: 'Vision', icon: 'vision', tag: 'See text, codes and objects' },
  { id: 'voice', title: 'Voice', icon: 'voice', tag: 'Say “OMNI” and ask' },
  { id: 'gesture', title: 'Gesture', icon: 'gesture', tag: 'Control with your hands' },
  { id: 'control', title: 'Control', icon: 'control', tag: 'Shortcuts & your Mac' },
  { id: 'devices', title: 'Devices', icon: 'devices', tag: 'Home, speakers & TVs' },
  { id: 'spatial', title: 'Spatial', icon: 'spatial', tag: 'Motion, compass, level' },
  { id: 'scanner', title: 'Scanner', icon: 'scanner', tag: 'Documents and codes' },
  { id: 'automation', title: 'Automation', icon: 'automation', tag: 'When → If → Then' },
  { id: 'workshop', title: 'Workshop', icon: 'workshop', tag: 'Build your own tools' },
  { id: 'settings', title: 'Settings', icon: 'settings', tag: 'Privacy and preferences' },
];
O.section = (id) => O.sections.find(s => s.id === id);
O.pages = {};   // id -> { render(root), leave() }
O.current = null;

O.go = function (id, { push = true } = {}) {
  if (!O.pages[id]) id = 'discover';
  if (O.current && O.current !== id) { try { O.pages[O.current].leave?.(); } catch (e) {} }
  O.current = id;
  const main = O.$('#main');
  main.replaceChildren();
  const root = h('div', { class: 'page', id: 'page-' + id });
  main.append(root);
  main.scrollTop = 0;
  try { O.pages[id].render(root); } catch (e) { console.error(e); root.append(h('div', { class: 'card' }, 'This section hit an error: ' + e.message)); }
  if (push && location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  O.renderNav();
};
O.sectionStep = function (dir) {
  const i = O.sections.findIndex(s => s.id === O.current);
  const n = O.sections[(i + dir + O.sections.length) % O.sections.length];
  O.go(n.id);
};

O.renderNav = function () {
  const nav = O.$('#nav');
  nav.replaceChildren(...O.sections.map(s => {
    const b = h('button', { class: 'nav-item', type: 'button', 'aria-current': O.current === s.id ? 'page' : null, onclick: () => O.go(s.id), 'data-nav': s.id },
      h('span', { class: 'ico' }, O.icon(s.icon)), s.title);
    if (s.id === 'voice' && O.voice?.listening) b.append(h('span', { class: 'dot' }));
    if (s.id === 'gesture' && O.gesture?.armed) b.append(h('span', { class: 'dot', style: { background: 'var(--violet)' } }));
    return b;
  }));
  const dockIds = ['discover', 'vision', 'voice', 'scanner'];
  const dock = O.$('#dock');
  dock.replaceChildren(...dockIds.map(id => {
    const s = O.section(id);
    return h('button', { class: 'dock-item', type: 'button', 'aria-current': O.current === id ? 'page' : null, onclick: () => { O.haptic(); O.go(id); }, 'data-dock': id }, O.icon(s.icon), s.title);
  }), h('button', { class: 'dock-item', type: 'button', 'aria-current': dockIds.includes(O.current) ? null : 'page', onclick: () => O.openAllModules(), 'data-dock': 'all' }, O.icon('all'), 'All'));
  const foot = O.$('#footStatus');
  foot.replaceChildren(O.icon(O.voice?.listening ? 'mic' : 'sparkle'), h('span', null, h('b', null, 'Status'), O.voice?.listening ? 'Listening for “' + O.cap(O.settings.wakePhrase) + '”' : 'Ready · ' + O.device.label));
  foot.onclick = () => O.go('voice');
};

O.openAllModules = function () {
  O.sheet.open('All modules', body => {
    body.append(h('div', { class: 'grid tiles' }, O.sections.map(s =>
      h('button', { class: 'card tight', type: 'button', style: { textAlign: 'left', border: 0, color: 'var(--text)' }, onclick: () => { O.sheet.close(); O.go(s.id); }, 'data-module': s.id },
        h('div', { class: 'stack' }, O.badge(s.icon, O.current === s.id ? 'var(--cyan)' : 'var(--blue)', 38, O.current === s.id), h('div', { class: 'headline' }, s.title), h('div', { class: 'muted' }, s.tag))))));
  });
};

/* ---------- Page scaffolding ---------- */
O.cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
O.pageHead = function (id, title, lede, trailing) {
  const s = O.section(id);
  return [
    h('div', { class: 'page-head' }, O.badge(s.icon, 'var(--cyan)', 48, true),
      h('div', { class: 'grow' }, h('div', { class: 'eyebrow' }, s.title), h('h1', null, title)), trailing || null),
    h('p', { class: 'lede' }, lede),
  ];
};
O.seg = function (options, value, onChange) {
  const wrap = h('div', { class: 'seg', role: 'group' });
  const draw = v => wrap.replaceChildren(...options.map(([val, label, icon]) =>
    h('button', { type: 'button', 'aria-pressed': String(val === v), 'data-seg': val, onclick: () => { O.haptic(); draw(val); onChange(val); } }, icon ? O.icon(icon) : null, label)));
  draw(value);
  return wrap;
};
O.toggle = function (title, detail, checked, onChange, id) {
  const input = h('input', { type: 'checkbox', class: 'sw', checked, id: id || ('t-' + O.uid()), onchange: e => onChange(e.target.checked) });
  return h('label', { class: 'toggle', for: input.id }, h('div', { class: 't' }, h('b', null, title), detail ? h('span', null, detail) : null), input);
};
O.unavailable = (icon, title, reason, alt) => h('div', { class: 'card tint unavailable', style: { '--t': 'var(--amber)' } },
  O.badge(icon, 'var(--amber)', 42), h('div', { class: 'stack' }, h('div', { class: 'headline' }, title), h('p', { class: 'small' }, reason), alt ? h('p', { class: 'alt' }, '↳ ' + alt) : null));
O.empty = (icon, title, msg, action) => h('div', { class: 'empty' }, O.badge(icon, 'var(--blue)', 52), h('div', { class: 'headline' }, title), h('p', { class: 'small' }, msg), action || null);
O.outcome = r => h('div', { class: 'list-row', style: { borderColor: r.ok ? 'rgba(82,242,179,.3)' : 'rgba(255,189,82,.35)' } },
  h('span', { style: { color: r.ok ? 'var(--mint)' : 'var(--amber)' } }, r.ok ? '✓' : '!'), h('div', { class: 'main' }, h('span', { style: { color: 'var(--text)', whiteSpace: 'normal' } }, r.message)));
O.copy = async function (text, el) {
  try { await navigator.clipboard.writeText(text); O.toast('Copied'); O.haptic(); return true; }
  catch (e) {
    if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    O.toast('Select the text and copy it', false); return false;
  }
};
O.download = function (blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
};
O.share = async function (file, title) {
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title }); return true; } catch (e) { return false; } }
  O.download(file, file.name); return true;
};

/* ---------- Time formatting ---------- */
O.fmtDur = s => { s = Math.round(s); const hh = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  if (hh) return m ? `${hh} h ${m} min` : `${hh} h`; if (m) return ss ? `${m} min ${ss} s` : `${m} min`; return `${ss} s`; };
O.fmtClock = s => { s = Math.max(0, Math.round(s)); const hh = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  return (hh ? hh + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(ss).padStart(2, '0'); };
O.fmtTime = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/* ---------- Timers (in-page countdowns + notification when allowed) ---------- */
O.timers = {
  list: O.store.get('timers', []).filter(t => t.end > Date.now()),
  tick: null,
  save() { O.store.set('timers', this.list); },
  start(seconds, label = '') {
    if (!(seconds > 0) || seconds > 86400) return { ok: false, message: 'Timers can run from 1 second to 24 hours.' };
    this.list.push({ id: O.uid(), label, dur: seconds, end: Date.now() + seconds * 1000 });
    this.list.sort((a, b) => a.end - b.end); this.save(); this.run(); O.bus.emit('timers');
    O.notify.ask();
    return { ok: true, message: `Timer set for ${O.fmtDur(seconds)}${label ? ' — ' + label : ''}.` };
  },
  cancel(id) { this.list = this.list.filter(t => t.id !== id); this.save(); O.bus.emit('timers'); },
  cancelAll() { const n = this.list.length; this.list = []; this.save(); O.bus.emit('timers'); return n; },
  title: t => t.label || `${O.fmtDur(t.dur)} timer`,
  describe() { return this.list.length ? this.list.map(t => `${this.title(t)}: ${O.fmtDur((t.end - Date.now()) / 1000)} left`).join('. ') + '.' : 'There are no timers running.'; },
  run() {
    if (this.tick) return;
    this.tick = setInterval(() => {
      const now = Date.now(), done = this.list.filter(t => t.end <= now);
      if (done.length) {
        this.list = this.list.filter(t => t.end > now); this.save();
        for (const t of done) {
          O.log.add('Timer finished', this.title(t), 'success', 'timer');
          O.toast(this.title(t) + ' is done'); O.haptic('success'); O.chime();
          O.notify.show('OMNI timer', this.title(t) + ' is done.');
          if (O.settings.spoken) O.speak(this.title(t) + ' is done.');
        }
      }
      O.bus.emit('tick');
      if (!this.list.length) { clearInterval(this.tick); this.tick = null; O.bus.emit('timers'); }
    }, 500);
  },
};

/* ---------- Notifications (only shows if the person allowed them) ---------- */
O.notify = {
  get state() { return O.device.notifications ? Notification.permission : 'unsupported'; },
  async ask() { if (O.device.notifications && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) {} } return this.state; },
  show(title, body) {
    if (this.state !== 'granted') return { ok: false, message: 'Notifications are off for this site, so nothing was shown outside the page.' };
    try { new Notification(title, { body, icon: 'icons/icon-192.png' }); return { ok: true, message: 'Notification shown.' }; }
    catch (e) {
      navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon: 'icons/icon-192.png' })).catch(() => {});
      return { ok: true, message: 'Notification sent.' };
    }
  },
};

/* ---------- Sound ---------- */
let actx;
O.chime = function (up = true) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(up ? 660 : 880, t); o.frequency.exponentialRampToValueAtTime(up ? 990 : 520, t + .16);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .25);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + .27);
  } catch (e) {}
};

/* ---------- Notes ---------- */
O.notes = {
  list: O.store.get('notes', []),
  add(text, source = 'voice') { this.list.unshift({ id: O.uid(), text, source, at: Date.now() }); O.store.set('notes', this.list); O.log.add('Note saved', text, 'success', 'note'); O.bus.emit('notes'); },
  remove(id) { this.list = this.list.filter(n => n.id !== id); O.store.set('notes', this.list); O.bus.emit('notes'); },
};

/* ---------- Scans (IndexedDB) ---------- */
O.db = {
  _db: null,
  open() {
    return this._db ||= new Promise((res, rej) => {
      const r = indexedDB.open('omni', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('scans', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('scans', mode), st = t.objectStore('scans'); let out;
      Promise.resolve(fn(st)).then(v => out = v);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    });
  },
  async all() {
    try { return (await this.tx('readonly', st => new Promise(r => { const q = st.getAll(); q.onsuccess = () => r(q.result); }))).sort((a, b) => b.at - a.at); }
    catch (e) { return []; }
  },
  async put(rec) { await this.tx('readwrite', st => st.put(rec)); O.bus.emit('scans'); },
  async remove(id) { await this.tx('readwrite', st => st.delete(id)); O.bus.emit('scans'); },
  async clear() { await this.tx('readwrite', st => st.clear()); O.bus.emit('scans'); },
};
O.newScan = (fields) => Object.assign({ id: O.uid(), at: Date.now(), title: 'Scan', kind: 'photo', text: '', labels: [], codes: [], folder: 'Inbox', fav: false, thumb: '', pages: [], print: null }, fields);
O.scanMatches = (r, q) => { q = q.toLowerCase(); return [r.title, r.text, r.labels.join(' '), r.codes.join(' '), r.folder].join(' ').toLowerCase().includes(q); };

/* ---------- Canvas helpers ---------- */
O.canvasFrom = function (source, maxSide = 1600) {
  const w = source.videoWidth || source.naturalWidth || source.width, hgt = source.videoHeight || source.naturalHeight || source.height;
  const k = Math.min(1, maxSide / Math.max(w, hgt));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(hgt * k);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c;
};
O.thumbOf = (canvas, side = 320) => O.canvasFrom(canvas, side).toDataURL('image/jpeg', .72);
O.imageFromFile = file => new Promise((res, rej) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  img.onerror = () => rej(new Error('That file isn’t an image this browser can open.'));
  img.src = url;
});
O.pickFiles = function ({ accept = 'image/*', multiple = false, capture = false } = {}) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    if (capture) i.setAttribute('capture', 'environment');
    i.onchange = () => { res(Array.from(i.files || [])); i.remove(); };
    document.body.append(i); i.click();
  });
};

/* ---------- Animated orb ---------- */
O.orbs = new Set();
O.mountOrb = function (canvas, { size = 150, tint = '#3ff5ff' } = {}) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = canvas.height = size * dpr; canvas.style.width = canvas.style.height = size + 'px';
  const o = { canvas, size, dpr, tint, level: 0, active: false };
  O.orbs.add(o);
  return o;
};
O.drawOrbs = function (t) {
  for (const o of O.orbs) {
    if (!o.canvas.isConnected) { O.orbs.delete(o); continue; }
    const c = o.canvas.getContext('2d'), s = o.size * o.dpr, r0 = s / 2;
    c.clearRect(0, 0, s, s);
    const level = O.voice?.level || 0;
    const active = O.voice?.listening && (o.react !== false);
    const breathe = .5 + .5 * Math.sin(t / 1000 * (active ? 3.2 : 1.2)), boost = Math.min(1, level * 1.6);
    const g = c.createRadialGradient(r0, r0, 0, r0, r0, r0);
    g.addColorStop(0, `rgba(63,245,255,${.45 + .35 * boost})`); g.addColorStop(.6, 'rgba(47,123,255,.16)'); g.addColorStop(1, 'rgba(47,123,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(r0, r0, r0 * (.92 + .06 * breathe + .1 * boost), 0, 7); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const rr = r0 * (.92 - i * .17), sp = (i % 2 ? -.8 : .5) * (active ? 2.4 : 1), a0 = t / 1000 * sp;
      c.strokeStyle = i === 0 ? '#2f7bff' : o.tint; c.lineWidth = (i === 0 ? 3 : 2) * o.dpr * (o.size / 150);
      c.globalAlpha = .9; c.beginPath(); c.arc(r0, r0, rr, a0, a0 + (i === 1 ? 2.6 : 4.4)); c.stroke();
      c.globalAlpha = .5; c.beginPath(); c.arc(r0, r0, rr, -t / 1000 * .3 * (i + 1) + 3.4, -t / 1000 * .3 * (i + 1) + 5.4); c.stroke();
    }
    c.globalAlpha = 1;
    const core = r0 * .36 * (1 + .05 * breathe + .18 * boost);
    const cg = c.createRadialGradient(r0 - core * .2, r0 - core * .3, 0, r0, r0, core);
    cg.addColorStop(0, '#fff'); cg.addColorStop(.4, o.tint); cg.addColorStop(1, '#2f7bff');
    c.shadowColor = o.tint; c.shadowBlur = (18 + 20 * boost) * o.dpr * (o.size / 150);
    c.fillStyle = cg; c.beginPath(); c.arc(r0, r0, core, 0, 7); c.fill(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(2,5,14,.9)'; c.beginPath(); c.arc(r0, r0, r0 * .15, 0, 7); c.fill();
    c.fillStyle = o.tint; c.beginPath(); c.arc(r0, r0, r0 * .055, 0, 7); c.fill();
  }
};

/* ---------- Background ---------- */
O.drawBackground = function (t) {
  const c = O.$('#bg'), dpr = Math.min(2, devicePixelRatio || 1);
  const w = innerWidth, hh = innerHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(hh * dpr)) { c.width = w * dpr; c.height = hh * dpr; }
  const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = x.createLinearGradient(0, 0, w * .3, hh); bg.addColorStop(0, '#050b1a'); bg.addColorStop(.55, '#02030b'); bg.addColorStop(1, '#020306');
  x.fillStyle = bg; x.fillRect(0, 0, w, hh);
  const glows = [['47,123,255', .18, .12, .55], ['63,245,255', .85, .28, .4], ['143,115,255', .55, .92, .28]];
  glows.forEach(([col, gx, gy, k], i) => {
    const ph = t / 1000 * .05 + i * 2.1, cx = w * (gx + .06 * Math.sin(ph)), cy = hh * (gy + .05 * Math.cos(ph * 1.3)), r = Math.max(w, hh) * .55;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${col},${.32 * k})`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.fillRect(0, 0, w, hh);
  });
  x.strokeStyle = 'rgba(47,123,255,.035)'; x.lineWidth = .5; x.beginPath();
  for (let gx = 0; gx < w; gx += 44) { x.moveTo(gx, 0); x.lineTo(gx, hh); }
  for (let gy = 0; gy < hh; gy += 44) { x.moveTo(0, gy); x.lineTo(w, gy); }
  x.stroke();
};
O.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastBg = 0;
function frame(t) {
  if (!document.hidden) {
    if (!O.reduceMotion || !lastBg) { if (t - lastBg > 50) { O.drawBackground(t); lastBg = t; } }
    O.drawOrbs(O.reduceMotion ? 0 : t);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { lastBg = 0; });
