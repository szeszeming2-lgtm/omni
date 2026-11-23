/* OMNI web — Scanner: find the page, flatten it, clean it up, read it, keep it, export PDF/text. */
'use strict';
(function () {
  const h = O.h;

  /* ---------- Geometry ---------- */
  function solve(A, b) { // Gaussian elimination, n×n
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
    return x;
  }
  /** Homography mapping each (u,v) in `from` to (x,y) in `to`. */
  O.homography = function (from, to) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [u, v] = from[i], [x, y] = to[i];
      A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
      A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
    }
    const s = solve(A, b);
    return [s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], 1];
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /** Flattens the quad (TL, TR, BR, BL in source pixels) into an upright page. */
  O.warp = function (src, quad, maxSide = 1800) {
    let W = Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2])), H = Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
    const k = Math.min(1, maxSide / Math.max(W, H)); W = Math.max(1, Math.round(W * k)); H = Math.max(1, Math.round(H * k));
    const M = O.homography([[0, 0], [W, 0], [W, H], [0, H]], quad);
    const sd = src.getContext('2d').getImageData(0, 0, src.width, src.height), s = sd.data, sw = src.width, sh = src.height;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const od = out.getContext('2d').createImageData(W, H), o = od.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const z = M[6] * x + M[7] * y + 1, fx = (M[0] * x + M[1] * y + M[2]) / z, fy = (M[3] * x + M[4] * y + M[5]) / z;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), ax = fx - x0, ay = fy - y0, oi = (y * W + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { o[oi + 3] = 255; continue; }
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) o[oi + c] = (s[i00 + c] * (1 - ax) + s[i10 + c] * ax) * (1 - ay) + (s[i01 + c] * (1 - ax) + s[i11 + c] * ax) * ay;
      o[oi + 3] = 255;
    }
    out.getContext('2d').putImageData(od, 0, 0);
    return out;
  };

  /** Guesses the page corners: Otsu threshold, then the extreme bright points. Falls back to an inset frame. */
  O.findPage = function (canvas) {
    const small = O.canvasFrom(canvas, 320), w = small.width, hh = small.height;
    const d = small.getContext('2d').getImageData(0, 0, w, hh).data, lum = new Float32Array(w * hh), hist = new Array(256).fill(0);
    for (let i = 0; i < w * hh; i++) { const L = d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114; lum[i] = L; hist[L | 0]++; }
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, thr = 128;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = w * hh - wB; if (!wF) break; sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2; if (between > best) { best = between; thr = t; } }
    let tl = null, tr = null, br = null, bl = null, count = 0;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      if (lum[y * w + x] <= thr) continue; count++;
      if (!tl || x + y < tl[0] + tl[1]) tl = [x, y];
      if (!br || x + y > br[0] + br[1]) br = [x, y];
      if (!tr || x - y > tr[0] - tr[1]) tr = [x, y];
      if (!bl || x - y < bl[0] - bl[1]) bl = [x, y];
    }
    const sx = canvas.width / w, sy = canvas.height / hh;
    const inset = () => [[.06, .06], [.94, .06], [.94, .94], [.06, .94]].map(([a, b]) => [a * canvas.width, b * canvas.height]);
    if (count < w * hh * .12 || count > w * hh * .97) return { quad: inset(), found: false };
    const quad = [tl, tr, br, bl].map(([x, y]) => [x * sx, y * sy]);
    const area = Math.abs((quad[0][0] * quad[1][1] - quad[1][0] * quad[0][1]) + (quad[1][0] * quad[2][1] - quad[2][0] * quad[1][1]) + (quad[2][0] * quad[3][1] - quad[3][0] * quad[2][1]) + (quad[3][0] * quad[0][1] - quad[0][0] * quad[3][1])) / 2;
    if (area < canvas.width * canvas.height * .1) return { quad: inset(), found: false };
    return { quad, found: true };
  };

  /** Even lighting and crisp text: grayscale + percentile stretch. */
  O.enhance = function (canvas, color = false) {
    const x = canvas.getContext('2d'), img = x.getImageData(0, 0, canvas.width, canvas.height), d = img.data, hist = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) | 0]++;
    const n = d.length / 4; let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * .02) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * .10) { hi = i; break; } }
    const span = Math.max(30, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      if (color) { for (let c = 0; c < 3; c++) d[i + c] = O.clamp((d[i + c] - lo) * 255 / span, 0, 255); }
      else { const L = O.clamp(((d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) - lo) * 255 / span, 0, 255), v = L > 200 ? 255 : L; d[i] = d[i + 1] = d[i + 2] = v; }
    }
    x.putImageData(img, 0, 0);
    return canvas;
  };

  /* ---------- Crop editor ---------- */
  function cropEditor(canvas, doneRaw) {
    let settled = false;
    const done = out => { if (settled) return; settled = true; doneRaw(out); };
    O.sheet.open('Adjust the corners', body => {
      O.sheet.onClose = () => done(null);
      const view = O.canvasFrom(canvas, 1200);
      const scale = canvas.width / view.width;
      const found = O.findPage(view);
      const pts = found.quad.map(p => p.slice());
      const wrap = h('div', { class: 'crop-wrap' }, view);
      const lines = h('canvas', { style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } });
      wrap.append(lines);
      const handles = pts.map((p, i) => h('div', { class: 'handle', 'data-corner': i }));
      wrap.append(...handles);
      const place = () => {
        const k = wrap.clientWidth / view.width;
        handles.forEach((el, i) => { el.style.left = pts[i][0] * k + 'px'; el.style.top = pts[i][1] * k + 'px'; });
        lines.width = wrap.clientWidth; lines.height = wrap.clientHeight;
        const c = lines.getContext('2d'); c.strokeStyle = '#3ff5ff'; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath();
        pts.forEach((p, i) => i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k)); c.closePath(); c.stroke();
      };
      handles.forEach((el, i) => {
        el.addEventListener('pointerdown', e => {
          el.setPointerCapture(e.pointerId);
          const move = ev => { const r = wrap.getBoundingClientRect(), k = wrap.clientWidth / view.width; pts[i] = [O.clamp((ev.clientX - r.left) / k, 0, view.width), O.clamp((ev.clientY - r.top) / k, 0, view.height)]; place(); };
          const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
          el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
        });
      });
      const clean = h('input', { type: 'checkbox', class: 'sw', checked: true, id: 'cleanScan' });
      const color = h('input', { type: 'checkbox', class: 'sw', id: 'colorScan' });
      body.append(h('p', { class: 'small' }, found.found ? 'OMNI found the page. Drag a corner if it needs adjusting.' : 'Drag the four corners onto the edges of the page.'), wrap,
        h('label', { class: 'toggle', for: 'cleanScan' }, h('div', { class: 't' }, h('b', null, 'Clean up'), h('span', null, 'Even lighting and crisp text')), clean),
        h('label', { class: 'toggle', for: 'colorScan' }, h('div', { class: 't' }, h('b', null, 'Keep colour')), color),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', 'data-flatten': '', onclick: () => {
          const quad = pts.map(([x, y]) => [x * scale, y * scale]);
          let out = O.warp(canvas, quad);
          if (clean.checked) out = O.enhance(out, color.checked);
          done(out); O.sheet.close();
        } }, O.icon('check'), 'Flatten page'), h('button', { class: 'btn ghost', type: 'button', onclick: () => { done(clean.checked ? O.enhance(O.canvasFrom(canvas, 1800), color.checked) : O.canvasFrom(canvas, 1800)); O.sheet.close(); } }, 'Use as is')));
      requestAnimationFrame(place); new ResizeObserver(place).observe(wrap);
    });
  }

  /* ---------- Saving and exporting ---------- */
  async function savePages(pages, { flat = true } = {}) {
    O.toast('Reading the page…');
    let text = '';
    try { for (const p of pages) { const r = await O.ocr(p, m => O.toast(m)); text += (text ? '\n\n' : '') + r.text; } } catch (e) { O.toast(e.message, false); }
    let codes = [];
    for (const p of pages) { try { codes = codes.concat((await O.detectCodes(p)).map(c => c.payload)); } catch (e) {} }
    const blobs = await Promise.all(pages.map(p => new Promise(r => p.toBlob(r, 'image/jpeg', .85))));
    const rec = O.newScan({ title: (text.split('\n').find(l => l.trim().length > 2) || 'Document').trim().slice(0, 40), kind: 'document', text, codes, thumb: O.thumbOf(pages[0]), pages: blobs, print: O.fingerprint(pages[0]), folder: folderFilter === 'All' || folderFilter === 'Favorites' ? 'Inbox' : folderFilter });
    await O.db.put(rec);
    codes.forEach(c => O.event({ type: 'scanned', payload: c }));
    O.log.add(`Scanned ${pages.length} page${pages.length > 1 ? 's' : ''}`, rec.title, 'success', 'scanner');
    O.toast('Saved “' + rec.title + '”');
    openDetail(rec);
  }

  O.makePDF = async function (rec) {
    await O.loadScript(O.LIB.jspdf);
    const { jsPDF } = window.jspdf;
    let doc = null;
    for (const blob of rec.pages) {
      const img = await O.imageFromFile(blob);
      const w = 595, hh = Math.round(595 * img.naturalHeight / img.naturalWidth);
      const data = O.canvasFrom(img, 2000).toDataURL('image/jpeg', .85);
      if (!doc) doc = new jsPDF({ unit: 'pt', format: [w, hh] }); else doc.addPage([w, hh]);
      doc.addImage(data, 'JPEG', 0, 0, w, hh);
    }
    return doc ? doc.output('blob') : null;
  };

  /* ---------- Library ---------- */
  let folderFilter = 'All', query = '';
  function openDetail(rec) {
    O.sheet.open(rec.kind === 'document' ? 'Document' : 'Scan', body => {
      const urls = rec.pages.map(b => URL.createObjectURL(b));
      O.sheet.onClose = () => urls.forEach(u => URL.revokeObjectURL(u));
      const title = h('input', { class: 'field', value: rec.title, id: 'scanTitle' });
      const folder = h('input', { class: 'field', value: rec.folder, id: 'scanFolder', placeholder: 'Folder' });
      const fav = h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--amber)' }, onclick: async () => { rec.fav = !rec.fav; await O.db.put(rec); fav.textContent = rec.fav ? '★ Favourite' : '☆ Favourite'; } }, rec.fav ? '★ Favourite' : '☆ Favourite');
      const persist = async () => { rec.title = title.value.trim() || rec.title; rec.folder = folder.value.trim() || 'Inbox'; await O.db.put(rec); };
      title.onchange = persist; folder.onchange = persist;
      const pages = urls.length ? h('div', { style: { display: 'flex', gap: '10px', overflowX: 'auto', scrollSnapType: 'x mandatory' } }, urls.map(u => h('img', { src: u, alt: 'Page', style: { maxHeight: '360px', borderRadius: '14px', scrollSnapAlign: 'start', background: '#fff' } })))
        : rec.thumb ? h('img', { src: rec.thumb, alt: '', class: 'thumb', style: { maxWidth: '260px' } }) : null;
      const exportRow = h('div', { class: 'row' });
      if (rec.pages.length) exportRow.append(h('button', { class: 'btn ghost sm', type: 'button', 'data-export-pdf': '', onclick: async e => {
        e.target.disabled = true; try { const blob = await O.makePDF(rec); await O.share(new File([blob], rec.title.replace(/[\\/:*?"<>|]/g, '-') + '.pdf', { type: 'application/pdf' }), rec.title); } catch (err) { O.toast(err.message, false); } e.target.disabled = false;
      } }, O.icon('share'), 'PDF'));
      if (rec.text) exportRow.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.share(new File([rec.text], rec.title.replace(/[\\/:*?"<>|]/g, '-') + '.txt', { type: 'text/plain' }), rec.title) }, O.icon('share'), 'Text'));
      exportRow.append(h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--danger)', marginLeft: 'auto' }, onclick: async () => {
        if (await O.confirm({ title: 'Delete this scan?', message: 'Its pages and text are removed from this browser.', ok: 'Delete', danger: true })) { await O.db.remove(rec.id); O.sheet.close(); O.toast('Deleted'); }
      } }, O.icon('trash'), 'Delete'));
      body.append(pages, h('div', { class: 'row nowrap' }, title, fav), folder);
      if (rec.codes.length) body.append(h('b', null, 'Codes'), ...rec.codes.map(c => h('div', { class: 'stack' }, h('div', { class: 'result-text' }, c), O.infoList(O.codeInfo(c, /^\d+$/.test(c) ? 'EAN-13' : 'QR')))));
      if (rec.labels.length) body.append(h('div', { class: 'chips' }, rec.labels.map(l => h('span', { class: 'chip' }, O.cap(l)))));
      if (rec.text) {
        const t = h('div', { class: 'result-text' }, rec.text);
        body.append(h('div', { class: 'spread' }, h('b', null, 'Text'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.copy(rec.text, t) }, O.icon('copy'), 'Copy')), t, O.infoList(O.extractInfo(rec.text)));
      }
      body.append(exportRow);
    });
  }

  O.pages.scanner = {
    render(root) {
      const listEl = h('div', { class: 'grid', style: { '--min': '160px', gap: '12px' } });
      const folders = h('div', { class: 'chips' });
      const search = h('input', { class: 'field', placeholder: 'Search scans, text, codes, folders', value: query, id: 'scanSearch', oninput: e => { query = e.target.value; draw(); } });
      let all = [];
      const draw = async () => {
        all = await O.db.all();
        const names = ['All', 'Favorites', ...new Set(all.map(s => s.folder))];
        folders.replaceChildren(...names.map(n => h('button', { class: 'chip', type: 'button', style: { '--c': folderFilter === n ? 'var(--cyan)' : 'var(--text3)' }, onclick: () => { folderFilter = n; draw(); } }, n === 'Favorites' ? '★ ' + n : n)));
        const shown = all.filter(r => (folderFilter === 'All' || (folderFilter === 'Favorites' ? r.fav : r.folder === folderFilter)) && (!query || O.scanMatches(r, query)));
        listEl.replaceChildren(...(shown.length ? shown.map(r => h('button', { class: 'card tight', type: 'button', style: { textAlign: 'left', color: 'var(--text)', border: 0 }, 'data-scan': r.id, onclick: () => openDetail(r) },
          r.thumb ? h('img', { class: 'thumb', src: r.thumb, alt: '' }) : h('div', { class: 'thumb', style: { display: 'grid', placeItems: 'center' } }, O.icon('scanner')),
          h('div', { style: { marginTop: '8px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, (r.fav ? '★ ' : '') + r.title),
          h('div', { class: 'muted' }, `${r.folder} · ${new Date(r.at).toLocaleDateString()}`)))
          : [h('div', { class: 'card', style: { gridColumn: '1 / -1' } }, O.empty('scanner', all.length ? 'Nothing matches' : 'No scans yet', all.length ? 'Try another word or folder.' : 'Take a photo of a page or import one to begin.'))]));
      };
      const tile = (icon, title, detail, onclick, attr) => h('button', Object.assign({ class: 'card tight', type: 'button', style: { textAlign: 'left', color: 'var(--text)', border: 0 }, onclick }, attr || {}),
        h('div', { class: 'stack' }, O.badge(icon, 'var(--cyan)', 36), h('div', { class: 'headline' }, title), h('div', { class: 'muted' }, detail)));
      const importPages = async (capture) => {
        const files = await O.pickFiles({ multiple: !capture, capture });
        const pages = [];
        for (const f of files) {
          try {
            const c = O.canvasFrom(await O.imageFromFile(f), 2400);
            await new Promise(res => cropEditor(c, out => { if (out) pages.push(out); res(); }));
          } catch (e) { O.toast(e.message, false); }
        }
        if (pages.length) savePages(pages);
      };
      root.append(...O.pageHead('scanner', 'Documents & codes', 'Photograph a page, flatten it, read the text and export a PDF. Everything is processed in your browser and kept on this device.'),
        h('div', { class: 'grid tiles' },
          O.device.touch ? tile('camera', 'Scan a page', 'Opens the camera', () => importPages(true), { 'data-scan-camera': '' }) : null,
          tile('photo', 'Import photos', 'Finds and flattens pages', () => importPages(false), { 'data-scan-import': '' }),
          tile('qr', 'Scan a code', 'Live in Vision', () => O.go('vision'))),
        search, folders, listEl);
      draw();
      this.off = O.bus.on('scans', draw);
    },
    leave() { this.off?.(); },
  };
  O.openScan = openDetail;
})();
