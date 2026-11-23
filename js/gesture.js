/* OMNI web — hand tracking (MediaPipe Hand Landmarker, on device) → gestures → actions. Same geometry as the app. */
'use strict';
(function () {
  const h = O.h;
  // MediaPipe landmark indices
  const J = { wrist: 0, thumbCMC: 1, thumbMP: 2, thumbIP: 3, thumbTip: 4, indexMCP: 5, indexPIP: 6, indexDIP: 7, indexTip: 8, middleMCP: 9, middlePIP: 10, middleDIP: 11, middleTip: 12,
    ringMCP: 13, ringPIP: 14, ringDIP: 15, ringTip: 16, littleMCP: 17, littlePIP: 18, littleDIP: 19, littleTip: 20 };
  const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16], [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]];
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** Pure classifier on 21 points (x right, y DOWN, 0…1 — MediaPipe image coordinates). */
  const G = O.gestureMath = {
    handSize: p => d(p[J.wrist], p[J.middleMCP]),
    ratio: (p, tip, mcp) => d(p[tip], p[J.wrist]) / Math.max(1e-4, d(p[mcp], p[J.wrist])),
    fingers(p, cal) {
      const t = cal.extendRatio, size = G.handSize(p);
      return {
        index: G.ratio(p, J.indexTip, J.indexMCP) > t, middle: G.ratio(p, J.middleTip, J.middleMCP) > t,
        ring: G.ratio(p, J.ringTip, J.ringMCP) > t, little: G.ratio(p, J.littleTip, J.littleMCP) > t,
        thumb: d(p[J.thumbTip], p[J.indexMCP]) / size > .55 && d(p[J.thumbTip], p[J.littleMCP]) / size > .9,
      };
    },
    pinchRatio: p => d(p[J.thumbTip], p[J.indexTip]) / G.handSize(p),
    classify(p, cal) {
      const f = G.fingers(p, cal), size = G.handSize(p);
      const indexRaised = G.ratio(p, J.indexTip, J.indexMCP) > 1.15;
      if (G.pinchRatio(p) < cal.pinchRatio && indexRaised && !(f.index && f.middle && f.ring && f.little)) return 'pinch';
      const k = [f.index, f.middle, f.ring, f.little].map(Number).join('');
      if (k === '1111') return 'openPalm';
      if (k === '1000') return 'point';
      if (k === '1100') return 'victory';
      if (k === '0000') {
        // y grows downward here, so "above the wrist" means a smaller y.
        if (f.thumb && (p[J.wrist].y - p[J.thumbTip].y) > .6 * size && p[J.thumbTip].y < p[J.indexMCP].y) return 'thumbsUp';
        return 'fist';
      }
      return null;
    },
    palm: p => { const js = [J.wrist, J.indexMCP, J.middleMCP, J.ringMCP, J.littleMCP]; return { x: js.reduce((s, i) => s + p[i].x, 0) / 5, y: js.reduce((s, i) => s + p[i].y, 0) / 5 }; },
    meanRatio: p => (G.ratio(p, J.indexTip, J.indexMCP) + G.ratio(p, J.middleTip, J.middleMCP) + G.ratio(p, J.ringTip, J.ringMCP) + G.ratio(p, J.littleTip, J.littleMCP)) / 4,
  };

  class Swipe {
    constructor() { this.samples = []; this.last = -10; }
    add(t, palm, sens, facesUser) {
      if (!palm) { this.samples = []; return null; }
      this.samples.push({ t, x: palm.x, y: palm.y }); this.samples = this.samples.filter(s => t - s.t <= .55);
      if (this.samples.length < 3 || t - this.last < .7) return null;
      const f = this.samples[0], dx = palm.x - f.x, dy = palm.y - f.y, thr = .34 - .2 * O.clamp(sens, 0, 1);
      if (Math.abs(dx) <= thr || Math.abs(dx) <= 1.8 * Math.abs(dy)) return null;
      this.last = t; this.samples = [];
      const personRight = facesUser ? dx < 0 : dx > 0;
      return personRight ? 'swipeRight' : 'swipeLeft';
    }
  }
  class Stable {
    constructor() { this.cand = null; this.count = 0; this.latched = null; this.fired = {}; }
    push(g, t, frames, cooldown) {
      if (g !== this.cand) { this.cand = g; this.count = 0; }
      this.count++;
      if (!g) { this.latched = null; return null; }
      if (this.latched === g || this.count < frames) return null;
      if (this.fired[g] && t - this.fired[g] < cooldown) return null;
      this.latched = g; this.fired[g] = t; return g;
    }
  }
  O.Swipe = Swipe; O.Stable = Stable;

  /* ---------- Engine ---------- */
  const E = O.gesture = {
    armed: false, running: false, landmarker: null, cam: null, pose: null, current: null, lastFired: null, fps: 0, problem: null,
    calib: null, calibMsg: '', calibProgress: 0,
    swipe: new Swipe(), stable: new Stable(), times: [],
    async start(onFrame) {
      this.cam ||= new O.Camera('user');
      this.onFrame = onFrame;
      this.problem = null;
      await this.cam.start('user');
      if (this.cam.state !== 'running') return;
      try {
        if (!this.landmarker) {
          this.problem = 'Downloading the hand model (7 MB, first time only)…'; onFrame && onFrame();
          const { mp, files } = await O.mediapipe();
          const make = delegate => mp.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: O.LIB.handModel, delegate }, runningMode: 'VIDEO', numHands: 1 });
          this.landmarker = await O.gpuOrCpu(make);
          this.problem = null;
        }
      } catch (e) { this.problem = e.message; onFrame && onFrame(); return; }
      this.running = true;
      const loop = () => {
        if (!this.running) return;
        const v = this.cam.video;
        if (v.readyState >= 2 && !document.hidden) {
          const t = performance.now();
          try { const r = this.landmarker.detectForVideo(v, t); this.process(r.landmarks?.[0] || null, t / 1000); } catch (e) {}
        }
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    },
    stop() { this.running = false; cancelAnimationFrame(this.raf); this.cam?.stop(); this.pose = null; this.current = null; },
    process(pose, t) {
      this.pose = pose;
      this.times.push(t); this.times = this.times.filter(x => t - x <= 1); this.fps = this.times.length;
      const cal = O.settings.calib;
      const shape = pose ? G.classify(pose, cal) : null;
      this.current = shape;
      if (this.calib) { this.calibrate(pose); this.onFrame && this.onFrame(); return; }
      const sens = O.settings.sensitivity;
      let fired = this.swipe.add(t, (shape === 'openPalm' || shape == null) && pose ? G.palm(pose) : null, sens, true);
      if (fired) this.current = fired;
      else fired = this.stable.push(shape, t, 3 + Math.round((1 - sens) * 4), O.settings.cooldown);
      if (fired) {
        this.lastFired = fired; this.lastAt = Date.now(); O.haptic();
        if (this.armed) this.fire(fired);
      }
      this.onFrame && this.onFrame();
    },
    async fire(g) {
      O.event({ type: 'gesture', g });
      const b = O.tools.gestures[g];
      if (!b || !b.enabled || !b.steps.length) return;
      const res = await O.run(b.steps, 'Gesture ' + O.GESTURES[g][1]);
      const r = res[0]; if (r) { O.log.add(O.GESTURES[g].join(' '), r.message, r.ok ? 'success' : 'warning', 'gesture'); if (!r.ok) O.toast(r.message, false); }
    },
    beginCalibration() { this.calib = { step: 'palm', palm: [], fist: [], pinch: [] }; this.calibMsg = 'Hold your open palm towards the camera.'; this.calibProgress = 0; },
    calibrate(pose) {
      const c = this.calib;
      if (!pose) { this.calibMsg = 'I can’t see your hand — move it into the frame.'; return; }
      if (c.step === 'palm') { c.palm.push(G.meanRatio(pose)); this.calibProgress = c.palm.length / 20; if (c.palm.length >= 20) { c.step = 'fist'; this.calibMsg = 'Now make a closed fist.'; } }
      else if (c.step === 'fist') { c.fist.push(G.meanRatio(pose)); this.calibProgress = c.fist.length / 20; if (c.fist.length >= 20) { c.step = 'pinch'; this.calibMsg = 'Last one: pinch your thumb and index finger.'; } }
      else if (c.step === 'pinch') {
        c.pinch.push(G.pinchRatio(pose)); this.calibProgress = c.pinch.length / 20;
        if (c.pinch.length >= 20) {
          const mean = a => a.reduce((s, x) => s + x, 0) / a.length, pm = mean(c.palm), fm = mean(c.fist);
          if (pm > fm + .2) {
            O.setSetting('calib', { extendRatio: O.clamp((pm + fm) / 2, 1.15, 2.1), pinchRatio: O.clamp(mean(c.pinch) * 1.8, .15, .45), at: Date.now() });
            this.calibMsg = 'Calibrated to your hand.'; O.log.add('Gesture calibration saved', '', 'success', 'gesture');
          } else this.calibMsg = 'Those poses looked too similar. Try again with a wider palm and a tight fist.';
          this.calib = null; this.calibDone = Date.now();
        }
      }
    },
    async analyzePhoto(canvas) {
      const { mp, files } = await O.mediapipe();
      const lm = await mp.HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: O.LIB.handModel, delegate: 'CPU' }, runningMode: 'IMAGE', numHands: 1 });
      const r = lm.detect(canvas); lm.close();
      const pose = r.landmarks?.[0] || null;
      return { pose, gesture: pose ? G.classify(pose, O.settings.calib) : null };
    },
  };

  function drawSkeleton(ctx, pose, map, color) {
    if (!pose) return;
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
    for (const [a, b] of BONES) { const [x1, y1] = map(pose[a].x, pose[a].y), [x2, y2] = map(pose[b].x, pose[b].y); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke();
    pose.forEach((p, i) => { const [x, y] = map(p.x, p.y); ctx.fillStyle = i === 0 ? '#2f7bff' : '#fff'; ctx.beginPath(); ctx.arc(x, y, [4, 8, 12, 16, 20].includes(i) ? 6 : 4, 0, 7); ctx.fill(); });
  }

  /* ---------- Page ---------- */
  O.pages.gesture = {
    render(root) {
      E.cam ||= new O.Camera('user');
      const vp = O.viewport(E.cam, { mirrorPreview: true });
      const hud = h('div', { class: 'hud' }), big = h('div', { class: 'big-gesture glass-badge' });
      vp.el.append(hud, big);
      const arm = O.toggle('Gestures armed', 'Recognised gestures run their actions', E.armed, v => { E.armed = v; O.renderNav(); paint(); }, 'gestureArm');
      const calRow = h('div', { class: 'spread' });
      const sens = h('input', { type: 'range', min: 0, max: 1, step: .05, value: O.settings.sensitivity, id: 'gSens', oninput: e => O.setSetting('sensitivity', +e.target.value) });
      const cool = h('input', { type: 'range', min: .4, max: 3, step: .1, value: O.settings.cooldown, id: 'gCool', oninput: e => { O.setSetting('cooldown', +e.target.value); coolLbl.textContent = `Repeat delay ${(+e.target.value).toFixed(1)} s`; } });
      const coolLbl = h('span', { class: 'small' }, `Repeat delay ${O.settings.cooldown.toFixed(1)} s`);
      const list = h('div', { class: 'grid', style: { '--min': '250px', gap: '10px' } });
      const photo = h('div', { class: 'stack' });

      const paint = () => {
        const c = vp.ctx();
        drawSkeleton(c, E.pose, (x, y) => { const [px, py] = vp.map(x, y); return [px, py]; }, E.armed ? '#8f73ff' : '#3ff5ff');
        hud.replaceChildren(h('span', { class: 'pill' + (E.pose ? ' live' : ''), style: { '--c': E.pose ? 'var(--mint)' : 'var(--text3)' } }, E.pose ? 'Hand tracked' : (E.problem || 'No hand')), E.running ? h('span', { class: 'glass-badge mono' }, E.fps + ' fps') : null);
        if (E.calib) big.textContent = `${E.calibMsg} ${Math.round(E.calibProgress * 100)}%`;
        else if (E.calibDone && Date.now() - E.calibDone < 4000) big.textContent = E.calibMsg;
        else big.textContent = E.current ? O.GESTURES[E.current].join(' ') : '';
        big.hidden = !big.textContent;
        vp.el.style.boxShadow = E.armed ? '0 0 0 2px var(--violet)' : 'none';
        calRow.replaceChildren(h('div', { class: 'stack', style: { gap: '2px' } }, h('b', null, 'Calibrate to your hand'), h('span', { class: 'muted' }, O.settings.calib.at ? 'Calibrated — recalibrate any time.' : 'Hold a palm, a fist and a pinch for a few seconds each.')),
          E.calib ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { E.calib = null; } }, 'Cancel') : h('button', { class: 'btn ghost sm', type: 'button', disabled: !E.running, onclick: () => E.beginCalibration() }, 'Calibrate'));
      };
      const drawList = () => {
        list.replaceChildren(...Object.keys(O.GESTURES).map(g => {
          const b = O.tools.gestures[g] || { enabled: false, steps: [] };
          return h('button', { class: 'card tight', type: 'button', style: { textAlign: 'left', color: 'var(--text)', border: 0, boxShadow: E.lastFired === g ? '0 0 0 1px var(--violet)' : 'none' }, onclick: () => editBinding(g, drawList) },
            h('div', { class: 'row nowrap' }, h('span', { style: { fontSize: '28px' } }, O.GESTURES[g][0]), h('div', { class: 'grow' }, h('div', { class: 'headline' }, O.GESTURES[g][1]),
              h('div', { class: 'muted', style: { color: b.enabled && b.steps.length ? 'var(--cyan)' : 'var(--text3)' } }, b.enabled && b.steps.length ? b.steps.map(s => O.actionInfo(s).title).join(' → ') : 'Not used'))));
        }));
      };
      root.append(...O.pageHead('gesture', 'Control with your hands', 'OMNI follows 21 points on your hand with your camera, inside this browser. Arm gestures to make them do things — swipe between sections, open your palm to talk, thumbs up for a reply.'),
        vp.el, h('div', { class: 'card' }, arm),
        h('div', { class: 'card stack' }, h('h3', null, 'Sensitivity'), h('div', { class: 'row nowrap' }, h('span', { class: 'muted' }, 'Steady'), sens, h('span', { class: 'muted' }, 'Eager')), coolLbl, cool, h('div', { class: 'divider' }), calRow),
        h('div', { class: 'title2' }, 'What each gesture does'), list,
        h('div', { class: 'card stack' }, h('h3', null, O.icon('photo'), 'Test with a photo'), h('p', { class: 'small' }, 'No camera handy? Pick a photo of a hand and OMNI will read its pose.'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
            const [f] = await O.pickFiles(); if (!f) return;
            photo.replaceChildren(h('p', { class: 'small' }, 'Reading the hand…'));
            try {
              const canvas = O.canvasFrom(await O.imageFromFile(f), 1200);
              const r = await E.analyzePhoto(canvas);
              const c = canvas.getContext('2d'); drawSkeleton(c, r.pose, (x, y) => [x * canvas.width, y * canvas.height], '#3ff5ff');
              canvas.style.cssText = 'width:100%;max-height:320px;object-fit:contain;border-radius:16px;background:#000';
              photo.replaceChildren(canvas, h('div', { class: 'headline', style: { color: r.gesture ? 'var(--mint)' : 'var(--amber)' } }, !r.pose ? 'No hand found in that photo.' : r.gesture ? 'Detected: ' + O.GESTURES[r.gesture].join(' ') : 'A hand, but not a known gesture.'));
            } catch (e) { photo.replaceChildren(h('p', { class: 'small' }, e.message)); }
          } }, 'Choose photo'), photo));
      drawList(); paint();
      E.start(paint);
      this.off = O.bus.on('tools', drawList);
    },
    leave() { this.off?.(); if (!E.armed) E.stop(); else E.onFrame = null; },
  };

  function editBinding(g, after) {
    const b = JSON.parse(JSON.stringify(O.tools.gestures[g] || { enabled: false, steps: [] }));
    O.sheet.open(O.GESTURES[g].join(' '), body => {
      body.append(O.toggle('Use this gesture', 'Runs while Gesture is armed', b.enabled, v => b.enabled = v),
        h('b', null, 'When recognised'), O.stepsEditor(b.steps, () => {}),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { O.tools.gestures[g] = b; O.saveTools(); O.sheet.close(); after && after(); } }, 'Save'));
    });
  }
  O.editGestureBinding = editBinding;
})();
