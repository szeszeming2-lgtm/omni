/* OMNI web — live camera with honest states, plus shared recognisers (codes, text, objects) and info extraction. */
'use strict';
(function () {
  const h = O.h;

  O.Camera = class {
    constructor(facing = 'environment') { this.facing = facing; this.state = 'idle'; this.stream = null; this.video = h('video', { playsinline: true, muted: true, autoplay: true }); this.video.muted = true; this.listeners = new Set(); }
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    set(st, msg) { this.state = st; this.message = msg; this.listeners.forEach(f => f(st)); }
    get mirrored() { return this.facing === 'user'; }
    async start(facing = this.facing) {
      this.facing = facing;
      if (!O.device.camera) return this.set('unavailable', 'This browser can’t use a camera.');
      if (!isSecureContext) return this.set('unavailable', 'The camera only works on a secure (https) page.');
      this.stop(true);
      this.set('starting');
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        this.video.srcObject = this.stream;
        await this.video.play().catch(() => {});
        await new Promise(r => { if (this.video.videoWidth) r(); else this.video.onloadedmetadata = () => r(); setTimeout(r, 1500); });
        this.set('running');
      } catch (e) {
        if (e.name === 'NotAllowedError' || e.name === 'SecurityError') this.set('denied', 'Camera access is off for this site.');
        else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') this.set('unavailable', 'No camera was found.');
        else this.set('failed', 'The camera couldn’t start: ' + (e.message || e.name));
      }
    }
    stop(quiet = false) {
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      this.stream = null; this.video.srcObject = null;
      if (!quiet) this.set('idle');
    }
    flip() { return this.start(this.facing === 'user' ? 'environment' : 'user'); }
    frame(maxSide = 1280) { return this.state === 'running' && this.video.videoWidth ? O.canvasFrom(this.video, maxSide) : null; }
  };

  /** Camera viewport element with status overlay; returns { el, overlay(canvas), map(nx, ny) }. */
  O.viewport = function (cam, { mirrorPreview } = {}) {
    const overlay = h('canvas', { class: 'overlay' });
    const status = h('div', { class: 'state' });
    const el = h('div', { class: 'viewport' }, cam.video, overlay, h('div', { class: 'brackets' }), status);
    const paint = () => {
      cam.video.classList.toggle('mirror', mirrorPreview ?? cam.mirrored);
      overlay.classList.toggle('mirror', mirrorPreview ?? cam.mirrored);
      status.hidden = cam.state === 'running';
      const msg = {
        idle: [null, 'Camera is off.'], starting: [null, 'Starting camera…'],
        denied: ['Camera access is off', 'Allow the camera for this site in your browser settings (Safari: aA › Website Settings › Camera), then reload.'],
        unavailable: ['No camera here', (cam.message || 'This device has no camera.') + ' Use “Analyze a photo” instead — it works the same.'],
        failed: ['Camera problem', cam.message],
      }[cam.state] || [null, ''];
      status.replaceChildren(cam.state === 'starting' ? h('div', { class: 'num' }, '◌') : O.icon('camera'), msg[0] ? h('div', { class: 'headline', style: { color: 'var(--text)' } }, msg[0]) : null, h('p', { class: 'small' }, msg[1]),
        ['failed', 'idle'].includes(cam.state) ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => cam.start() }, 'Start camera') : null);
    };
    cam.on(paint); paint();
    const map = (nx, ny) => {
      const W = el.clientWidth, H = el.clientHeight, vw = cam.video.videoWidth || W, vh = cam.video.videoHeight || H;
      const k = Math.max(W / vw, H / vh), ox = (W - vw * k) / 2, oy = (H - vh * k) / 2;
      return [nx * vw * k + ox, ny * vh * k + oy];
    };
    const ctx = () => { const d = Math.min(2, devicePixelRatio || 1); if (overlay.width !== el.clientWidth * d) { overlay.width = el.clientWidth * d; overlay.height = el.clientHeight * d; } const c = overlay.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, el.clientWidth, el.clientHeight); return c; };
    return { el, overlay, map, ctx };
  };

  /* ---------- Codes: BarcodeDetector where the browser has it, otherwise jsQR (QR only) ---------- */
  let detector = null;
  O.detectCodes = async function (canvas) {
    try {
      if ('BarcodeDetector' in window) {
        detector ||= new window.BarcodeDetector();
        const found = await detector.detect(canvas);
        return found.map(f => ({ payload: f.rawValue, format: fmt(f.format), box: f.boundingBox && { x: f.boundingBox.x / canvas.width, y: f.boundingBox.y / canvas.height, w: f.boundingBox.width / canvas.width, h: f.boundingBox.height / canvas.height } }));
      }
    } catch (e) { detector = null; }
    await O.loadScript(O.LIB.jsqr);
    const small = canvas.width > 960 ? O.canvasFrom(canvas, 960) : canvas;
    const data = small.getContext('2d').getImageData(0, 0, small.width, small.height);
    const r = window.jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
    if (!r || !r.data) return [];
    const xs = [r.location.topLeftCorner.x, r.location.topRightCorner.x, r.location.bottomLeftCorner.x, r.location.bottomRightCorner.x];
    const ys = [r.location.topLeftCorner.y, r.location.topRightCorner.y, r.location.bottomLeftCorner.y, r.location.bottomRightCorner.y];
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return [{ payload: r.data, format: 'QR', box: { x: x0 / small.width, y: y0 / small.height, w: (Math.max(...xs) - x0) / small.width, h: (Math.max(...ys) - y0) / small.height } }];
  };
  const fmt = f => ({ qr_code: 'QR', ean_13: 'EAN-13', ean_8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E', code_128: 'Code 128', code_39: 'Code 39', pdf417: 'PDF417', aztec: 'Aztec', data_matrix: 'Data Matrix', itf: 'ITF' }[f] || f);
  O.codeEngine = () => 'BarcodeDetector' in window ? 'QR codes and barcodes' : 'QR codes';

  /* ---------- Text: Tesseract (downloads ~4 MB once, then works offline) ---------- */
  let worker = null;
  O.ocr = async function (canvas, progress) {
    await O.loadScript(O.LIB.tesseract);
    if (!worker) {
      progress && progress('Downloading the text reader (first time only)…');
      worker = window.Tesseract.createWorker('eng', 1, { logger: m => { if (progress && m.status === 'recognizing text') progress(`Reading text… ${Math.round(m.progress * 100)}%`); } });
    }
    const w = await worker;
    const { data } = await w.recognize(canvas);
    return { text: (data.text || '').trim(), confidence: data.confidence, words: (data.words || []).map(x => ({ text: x.text, conf: x.confidence, box: { x: x.bbox.x0 / canvas.width, y: x.bbox.y0 / canvas.height, w: (x.bbox.x1 - x.bbox.x0) / canvas.width, h: (x.bbox.y1 - x.bbox.y0) / canvas.height } })) };
  };

  /* ---------- Objects: MediaPipe EfficientDet-Lite0 (on device) ---------- */
  const detectors = {};
  O.objectDetector = async function (mode = 'VIDEO') {
    if (detectors[mode]) return detectors[mode];
    const { mp, files } = await O.mediapipe();
    const make = delegate => mp.ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: O.LIB.objectModel, delegate }, runningMode: mode, maxResults: 6, scoreThreshold: .35 });
    detectors[mode] = mode === 'IMAGE' ? await make('CPU') : await O.gpuOrCpu(make);
    return detectors[mode];
  };
  O.detectObjects = async function (canvas) {
    const d = await O.objectDetector('IMAGE');
    return d.detect(canvas).detections.map(x => ({ label: x.categories[0].categoryName, score: x.categories[0].score,
      box: { x: x.boundingBox.originX / canvas.width, y: x.boundingBox.originY / canvas.height, w: x.boundingBox.width / canvas.width, h: x.boundingBox.height / canvas.height } }));
  };
  O.describeObjects = function (objs) {
    if (!objs.length) return 'Nothing recognisable yet — try more light or move closer.';
    const counts = {}; for (const o of objs) counts[o.label] = (counts[o.label] || 0) + 1;
    return 'Looks like ' + Object.entries(counts).map(([k, n]) => n > 1 ? `${n} ${k}s` : `a ${k}`).join(', ') + '.';
  };

  /* ---------- Useful information from text and codes (on device) ---------- */
  O.extractInfo = function (text) {
    const out = [], seen = new Set();
    const add = (kind, title, detail, value, href, icon) => { const k = kind + value; if (seen.has(k)) return; seen.add(k); out.push({ kind, title, detail, value, href, icon }); };
    for (const m of text.matchAll(/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g)) add('email', 'Email', m[0], m[0], 'mailto:' + m[0], 'mail');
    for (const m of text.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"]+[^\s<>".,;:!?)]/gi)) add('link', 'Link', m[0], m[0], m[0].startsWith('http') ? m[0] : 'https://' + m[0], 'link');
    for (const m of text.matchAll(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{2,4}[\s.-]\d{3,4}[\s.-]?\d{0,4}/g)) {
      const digits = m[0].replace(/\D/g, ''); if (digits.length >= 8 && digits.length <= 15) add('phone', 'Phone number', m[0].trim(), digits, 'tel:' + (m[0].trim().startsWith('+') ? '+' : '') + digits, 'phone');
    }
    for (const m of text.matchAll(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:st|nd|rd|th)?,? \d{4})\b/gi)) add('date', 'Date', m[0], m[0], null, 'calendar');
    for (const m of text.matchAll(/\b\d{1,5} [A-Z][a-z]+(?: [A-Z][a-z]+)* (?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Way|Court|Ct|Place|Pl)\b\.?/g))
      add('address', 'Address', m[0], m[0], 'https://maps.apple.com/?q=' + encodeURIComponent(m[0]), 'map');
    return out;
  };
  O.codeInfo = function (payload, format = 'QR') {
    const p = payload.trim();
    if (/^WIFI:/i.test(p)) {
      const f = wifiFields(p), out = [{ kind: 'wifi', title: 'Wi-Fi network', detail: f.S || 'Unknown network', value: f.S || '', icon: 'wifi' }];
      if (f.P) out.push({ kind: 'wifi', title: `Wi-Fi password (${f.T || 'WPA'})`, detail: '•'.repeat(Math.min(12, f.P.length)), value: f.P, icon: 'lock' });
      return out;
    }
    if (/^https?:\/\//i.test(p)) { let host = p; try { host = new URL(p).host; } catch (e) {} return [{ kind: 'link', title: 'Website', detail: host, value: p, href: p, icon: 'link' }]; }
    if (/^mailto:/i.test(p)) return [{ kind: 'email', title: 'Email', detail: p.slice(7), value: p.slice(7), href: p, icon: 'mail' }];
    if (/^tel:/i.test(p)) return [{ kind: 'phone', title: 'Phone', detail: p.slice(4), value: p.slice(4), href: p, icon: 'phone' }];
    if (/^BEGIN:VCARD/i.test(p)) { const fn = (p.match(/^FN:(.*)$/m) || [])[1] || 'Contact card'; return [{ kind: 'person', title: 'Contact card', detail: fn, value: p, icon: 'person' }]; }
    if (/^(EAN|UPC)/.test(format) && /^\d+$/.test(p)) return [{ kind: 'product', title: 'Product barcode', detail: p, value: p, icon: 'qr' }];
    const fromText = O.extractInfo(p);
    return fromText.length ? fromText : [{ kind: 'text', title: 'Text', detail: p, value: p, icon: 'text' }];
  };
  function wifiFields(payload) {
    const out = {}; let key = '', val = '', inKey = true, esc = false;
    for (const ch of payload.slice(5)) {
      if (esc) { val += ch; esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (inKey) { if (ch === ':') inKey = false; else key += ch; }
      else if (ch === ';') { out[key] = val; key = ''; val = ''; inKey = true; } else val += ch;
    }
    if (key) out[key] = val;
    return out;
  }
  O.wifiFields = wifiFields;

  /** Optional, off by default: Open Food Facts is free and keyless. Only the barcode number is sent. */
  O.productLookup = async function (code) {
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity`);
      const j = await r.json();
      const p = j.product; if (!p || !p.product_name) return 'Not in the free product database.';
      return p.product_name + (p.brands ? ' — ' + p.brands : '') + (p.quantity ? ` (${p.quantity})` : '');
    } catch (e) { return 'Couldn’t reach the product database.'; }
  };

  O.infoList = function (items) {
    const wrap = h('div', { class: 'stack' });
    for (const it of items) {
      const detail = h('b', { style: { whiteSpace: 'normal' } }, it.detail);
      const row = h('div', { class: 'list-row' }, O.icon(it.icon || 'info'), h('div', { class: 'main' }, h('span', null, it.title), detail));
      if (it.href) row.append(h('a', { class: 'btn ghost sm', href: it.href, target: it.href.startsWith('http') ? '_blank' : null, rel: 'noopener' }, { link: 'Open', email: 'Email', phone: 'Call', address: 'Map' }[it.kind] || 'Open'));
      if (it.kind === 'product' && O.settings.onlineLookups) row.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: async e => { e.target.disabled = true; detail.textContent = await O.productLookup(it.value); } }, 'Look up'));
      row.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Copy', onclick: () => O.copy(it.value) }, O.icon('copy')));
      wrap.append(row);
    }
    return wrap;
  };

  /* ---------- Visual fingerprint for “find similar photos” (difference hash + colour) ---------- */
  O.fingerprint = function (canvas) {
    const c = document.createElement('canvas'); c.width = 9; c.height = 8;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, 9, 8);
    const d = x.getImageData(0, 0, 9, 8).data; let bits = '';
    const lum = i => d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    for (let y = 0; y < 8; y++) for (let xx = 0; xx < 8; xx++) bits += lum((y * 9 + xx) * 4) > lum((y * 9 + xx + 1) * 4) ? '1' : '0';
    let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return { bits, rgb: [r / n, g / n, b / n] };
  };
  O.similarity = function (a, b) {
    if (!a || !b) return 0;
    let same = 0; for (let i = 0; i < 64; i++) if (a.bits[i] === b.bits[i]) same++;
    const cd = Math.hypot(a.rgb[0] - b.rgb[0], a.rgb[1] - b.rgb[1], a.rgb[2] - b.rgb[2]) / 441;
    return O.clamp(.75 * same / 64 + .25 * (1 - cd), 0, 1);
  };
})();
