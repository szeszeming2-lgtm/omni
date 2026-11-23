/* OMNI web — Vision: live codes and objects, text reading, photo analysis, saving and visual search. */
'use strict';
(function () {
  const h = O.h;
  let mode = 'codes';

  O.pages.vision = {
    render(root) {
      const cam = this.cam = new O.Camera('environment');
      const vp = O.viewport(cam);
      const results = h('div', { class: 'card stack', id: 'visionResults' });
      let busy = false, loop = null, lastCodes = [], lastObjects = [], loadingMsg = '', frozen = false;

      const flipBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Switch camera', onclick: () => cam.flip() }, O.icon('flip'));
      const shutter = h('button', { class: 'shutter', type: 'button', 'aria-label': 'Capture and analyse', 'data-capture': '', onclick: () => { const c = cam.frame(1600); if (c) { O.haptic('success'); analyze(c); } } });
      const pause = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Pause live results', onclick: () => { frozen = !frozen; pause.replaceChildren(O.icon(frozen ? 'play' : 'pause')); } }, O.icon('pause'));
      vp.el.append(h('div', { class: 'controls' }, flipBtn, shutter, pause));
      const hud = h('div', { class: 'hud' }); vp.el.append(hud);

      const drawResults = () => {
        results.replaceChildren();
        if (mode === 'codes') {
          results.append(h('h3', null, O.icon('qr'), 'Codes in view'));
          if (!lastCodes.length) results.append(h('p', { class: 'small' }, `Hold a code inside the frame. This browser reads ${O.codeEngine()}.`));
          for (const c of lastCodes) results.append(h('div', { class: 'stack' }, h('div', { class: 'spread' }, h('span', { class: 'chip', style: { '--c': 'var(--mint)' } }, c.format),
            h('button', { class: 'btn ghost sm', type: 'button', onclick: () => saveCode(c) }, 'Save')), h('div', { class: 'result-text' }, c.payload), O.infoList(O.codeInfo(c.payload, c.format))));
        } else if (mode === 'objects') {
          results.append(h('h3', null, O.icon('cube'), 'What OMNI sees'), h('p', { class: 'small' }, loadingMsg || O.describeObjects(lastObjects)));
          for (const o of lastObjects) results.append(h('div', { class: 'spread' }, h('span', null, O.cap(o.label)), h('span', { class: 'row nowrap', style: { width: '130px' } }, h('div', { class: 'bar grow' }, h('i', { style: { width: Math.round(o.score * 100) + '%' } })), h('span', { class: 'mono muted' }, Math.round(o.score * 100) + '%'))));
        } else {
          results.append(h('h3', null, O.icon('text'), 'Read text'), h('p', { class: 'small' }, 'Point at printed text and press the shutter. OMNI reads it on this device — the first time downloads a 4 MB reader, then it works offline.'));
        }
      };

      const drawBoxes = () => {
        const c = vp.ctx(); if (frozen) return;
        const W = vp.el.clientWidth;
        const box = (b, color, label) => {
          let [x0, y0] = vp.map(b.x, b.y), [x1, y1] = vp.map(b.x + b.w, b.y + b.h);
          c.strokeStyle = color; c.lineWidth = 2.5; c.shadowColor = color; c.shadowBlur = 8;
          c.beginPath(); c.roundRect ? c.roundRect(x0, y0, x1 - x0, y1 - y0, 8) : c.rect(x0, y0, x1 - x0, y1 - y0); c.stroke(); c.shadowBlur = 0;
          if (label) { c.font = '600 12px Inter, system-ui'; const tw = c.measureText(label).width + 12; c.fillStyle = color; c.fillRect(Math.min(x0, W - tw), y0 - 22, tw, 20); c.fillStyle = '#020306'; c.fillText(label, Math.min(x0, W - tw) + 6, y0 - 8); }
        };
        if (mode === 'codes') lastCodes.forEach(k => k.box && box(k.box, '#52f2b3', k.format));
        if (mode === 'objects') lastObjects.forEach(o => box(o.box, '#3ff5ff', `${o.label} ${Math.round(o.score * 100)}%`));
      };

      const tick = async () => {
        if (busy || cam.state !== 'running' || frozen || document.hidden) return;
        busy = true;
        try {
          if (mode === 'codes') {
            const f = cam.frame(960); if (f) {
              const codes = await O.detectCodes(f);
              const fresh = codes.filter(k => !lastCodes.some(x => x.payload === k.payload));
              lastCodes = codes; if (fresh.length) { O.haptic('success'); fresh.forEach(k => O.event({ type: 'scanned', payload: k.payload })); drawResults(); } else if (!codes.length && results.dataset.n !== '0') drawResults();
              results.dataset.n = String(codes.length);
            }
          } else if (mode === 'objects') {
            if (!this.det) { loadingMsg = 'Downloading the object model (4.6 MB, first time only)…'; drawResults(); this.det = await O.objectDetector('VIDEO'); loadingMsg = ''; }
            const r = this.det.detectForVideo(cam.video, performance.now());
            lastObjects = r.detections.map(x => ({ label: x.categories[0].categoryName, score: x.categories[0].score,
              box: { x: x.boundingBox.originX / cam.video.videoWidth, y: x.boundingBox.originY / cam.video.videoHeight, w: x.boundingBox.width / cam.video.videoWidth, h: x.boundingBox.height / cam.video.videoHeight } }));
            drawResults();
          }
        } catch (e) { loadingMsg = e.message; drawResults(); }
        drawBoxes();
        busy = false;
      };

      const analyze = (canvas) => O.analysisSheet(canvas);
      const saveCode = async c => {
        const f = cam.frame(900);
        await O.db.put(O.newScan({ title: `${c.format}: ${c.payload.slice(0, 30)}`, kind: 'code', text: c.payload, codes: [c.payload], thumb: f ? O.thumbOf(f) : '', print: f ? O.fingerprint(f) : null }));
        O.toast('Code saved to Scanner');
      };

      root.append(...O.pageHead('vision', 'See the world', 'Point your camera at codes, objects or text. Everything is recognised in this browser on your device — frames are never uploaded.',
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.visualSearch() }, O.icon('search'), 'Visual search')),
        O.seg([['codes', 'QR & codes', 'qr'], ['objects', 'Objects', 'cube'], ['text', 'Text', 'text']], mode, v => { mode = v; lastCodes = []; lastObjects = []; vp.ctx(); drawResults(); }),
        vp.el, results,
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost', type: 'button', 'data-analyze-photo': '', onclick: async () => { const [f] = await O.pickFiles(); if (f) { try { analyze(O.canvasFrom(await O.imageFromFile(f), 1800)); } catch (e) { O.toast(e.message, false); } } } }, O.icon('photo'), 'Analyze a photo')));
      drawResults();
      cam.start('environment');
      loop = setInterval(tick, 260);
      this.stopLoop = () => clearInterval(loop);
    },
    leave() { this.stopLoop?.(); this.cam?.stop(); },
  };

  /* ---------- Full analysis of a still image ---------- */
  O.analysisSheet = function (canvas) {
    O.sheet.open('Analysis', body => {
      const img = h('img', { src: canvas.toDataURL('image/jpeg', .85), alt: 'Captured image', style: { borderRadius: '18px', maxHeight: '320px', objectFit: 'contain', background: '#000', width: '100%' } });
      const summary = h('div', { class: 'headline' }, 'Looking…');
      const codesEl = h('div', { class: 'stack' }), objectsEl = h('div', { class: 'chips' }), textEl = h('div', { class: 'stack' });
      const status = h('p', { class: 'small' });
      const state = { codes: [], objects: [], text: '' };
      const readBtn = h('button', { class: 'btn ghost sm', type: 'button', 'data-read-text': '', onclick: () => readText() }, O.icon('text'), 'Read text');
      const saveBtn = h('button', { class: 'btn primary sm', type: 'button', 'data-save-scan': '', onclick: () => save() }, O.icon('download'), 'Save');
      body.append(img, summary, codesEl, objectsEl, h('div', { class: 'row' }, readBtn, saveBtn), status, textEl);

      const paint = () => {
        summary.textContent = state.codes.length ? `Found ${state.codes.length} code${state.codes.length > 1 ? 's' : ''}.` : O.describeObjects(state.objects);
        codesEl.replaceChildren(...state.codes.map(c => h('div', { class: 'stack' }, h('div', { class: 'result-text' }, c.payload), O.infoList(O.codeInfo(c.payload, c.format)))));
        objectsEl.replaceChildren(...state.objects.map(o => h('span', { class: 'chip' }, `${O.cap(o.label)} ${Math.round(o.score * 100)}%`)));
      };
      const readText = async () => {
        readBtn.disabled = true;
        try {
          const r = await O.ocr(canvas, m => status.textContent = m);
          state.text = r.text; status.textContent = r.text ? `Read ${r.text.split(/\s+/).length} words.` : 'No readable text found.';
          textEl.replaceChildren(...(r.text ? [h('div', { class: 'spread' }, h('b', null, 'Text'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.copy(r.text) }, O.icon('copy'), 'Copy')), h('div', { class: 'result-text', id: 'ocrText' }, r.text), O.infoList(O.extractInfo(r.text))] : []));
        } catch (e) { status.textContent = e.message; }
        readBtn.disabled = false;
      };
      const save = async () => {
        saveBtn.disabled = true;
        const title = state.text.split('\n').find(Boolean)?.slice(0, 40) || (state.codes[0] && state.codes[0].payload.slice(0, 40)) || (state.objects[0] && O.cap(state.objects[0].label)) || 'Photo';
        const page = await new Promise(r => O.canvasFrom(canvas, 1800).toBlob(r, 'image/jpeg', .85));
        await O.db.put(O.newScan({ title, kind: state.codes.length ? 'code' : state.text ? 'text' : 'photo', text: state.text, labels: state.objects.map(o => o.label), codes: state.codes.map(c => c.payload), thumb: O.thumbOf(canvas), pages: [page], print: O.fingerprint(canvas) }));
        O.toast('Saved to Scanner'); saveBtn.textContent = 'Saved'; O.log.add('Saved scan', title, 'success', 'scanner');
      };

      (async () => {
        try { state.codes = await O.detectCodes(canvas); state.codes.forEach(c => O.event({ type: 'scanned', payload: c.payload })); } catch (e) {}
        paint();
        try { status.textContent = 'Recognising objects…'; state.objects = await O.detectObjects(canvas); status.textContent = ''; } catch (e) { status.textContent = e.message; }
        paint();
        if (!state.codes.length && !state.objects.length) readText();
      })();
    });
  };

  /* ---------- Visual search: words, labels, codes — or a similar-looking photo ---------- */
  O.visualSearch = function () {
    O.sheet.open('Visual search', async body => {
      const q = h('input', { class: 'field', placeholder: 'Search words, labels or codes', id: 'vsQuery' });
      const list = h('div', { class: 'stack' });
      let scans = await O.db.all(), ranked = null;
      const draw = () => {
        const rows = ranked || scans.filter(s => !q.value || O.scanMatches(s, q.value)).map(s => [s, null]);
        list.replaceChildren(...(rows.length ? rows.map(([s, sim]) => h('div', { class: 'list-row' }, s.thumb ? h('img', { src: s.thumb, alt: '', style: { width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' } }) : O.badge('scanner'),
          h('div', { class: 'main' }, h('b', null, s.title), h('span', null, s.labels.join(', ') || s.text.slice(0, 80))), sim != null ? h('span', { class: 'mono', style: { color: 'var(--cyan)' } }, Math.round(sim * 100) + '% alike') : null))
          : [O.empty('search', 'No matches', 'Saved scans appear here.')]));
      };
      q.oninput = () => { ranked = null; draw(); };
      body.append(q, h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
        const [f] = await O.pickFiles(); if (!f) return;
        const fp = O.fingerprint(O.canvasFrom(await O.imageFromFile(f), 400));
        ranked = scans.filter(s => s.print).map(s => [s, O.similarity(fp, s.print)]).sort((a, b) => b[1] - a[1]); draw();
      } }, O.icon('photo'), 'Find scans that look like a photo'), list);
      draw();
    });
  };
})();
