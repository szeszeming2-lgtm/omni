/* OMNI web — Spatial: orientation, compass, level, movement events (shake / tilt / face down) and the Orb Run game. */
'use strict';
(function () {
  const h = O.h;
  O.compassName = deg => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.floor(((deg + 22.5) % 360) / 45)];

  const M = O.motion = {
    running: false, pitch: 0, roll: 0, yaw: 0, heading: null, gx: 0, gy: 0, gz: 0, accel: 0, moving: false, last: null, lastAt: null, score: 0,
    lastShake: 0, tiltLatch: null, faceDown: false, downSince: null,
    /** iPhone/iPad need a tap to ask permission; other browsers just start. */
    async enable() {
      try {
        if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
          const a = await DeviceMotionEvent.requestPermission();
          const b = DeviceOrientationEvent.requestPermission ? await DeviceOrientationEvent.requestPermission() : 'granted';
          if (a !== 'granted' || b !== 'granted') { this.problem = 'Motion access was declined. Reload the page to be asked again.'; O.bus.emit('motion'); return false; }
        }
      } catch (e) { this.problem = 'Motion access needs a tap on this button (and a secure https page).'; O.bus.emit('motion'); return false; }
      O.motionGranted = true;
      if (!this.running) {
        addEventListener('deviceorientation', this.onOrient);
        addEventListener('devicemotion', this.onMotion);
        this.running = true;
        setTimeout(() => { if (this.running && !this.got) { this.problem = 'No motion data arrived — this device may not have motion sensors.'; O.bus.emit('motion'); } }, 2500);
      }
      O.bus.emit('motion');
      return true;
    },
    onOrient: e => {
      M.got = true;
      M.pitch = (e.beta || 0) * Math.PI / 180; M.roll = (e.gamma || 0) * Math.PI / 180; M.yaw = (e.alpha || 0) * Math.PI / 180;
      if (typeof e.webkitCompassHeading === 'number') M.heading = e.webkitCompassHeading;
      else if (e.absolute && e.alpha != null) M.heading = (360 - e.alpha) % 360;
      const lim = O.settings.tiltDeg;
      let tilt = null;
      if (e.gamma < -lim) tilt = 'tiltLeft'; else if (e.gamma > lim) tilt = 'tiltRight';
      if (tilt) { if (M.tiltLatch !== tilt) { M.tiltLatch = tilt; M.emit(tilt); } }
      else if (Math.abs(e.gamma) < lim / 2) M.tiltLatch = null;
      O.bus.emit('motionFrame');
    },
    onMotion: e => {
      M.got = true;
      const g = e.accelerationIncludingGravity || {}, a = e.acceleration || {};
      M.gx = (g.x || 0) / 9.81; M.gy = (g.y || 0) / 9.81; M.gz = (g.z || 0) / 9.81;
      M.accel = Math.hypot(a.x || 0, a.y || 0, a.z || 0) / 9.81;
      M.score = M.score * .9 + (M.accel > .08 ? .1 : 0); M.moving = M.score > .35;
      const now = Date.now();
      if (M.accel > 2 && now - M.lastShake > 1500) { M.lastShake = now; M.emit('shake'); }
      // iPhone reports z ≈ +1 g with the screen facing down.
      if (M.gz > .88) { M.downSince ||= now; if (!M.faceDown && now - M.downSince > 600) { M.faceDown = true; M.emit('faceDown'); } }
      else { M.downSince = null; if (M.faceDown && M.gz < -.6) { M.faceDown = false; M.emit('faceUp'); } }
    },
    emit(ev) { this.last = ev; this.lastAt = new Date(); O.event({ type: 'motion', ev }); O.bus.emit('motion'); },
  };

  /* ---------- Orb Run (tilt, arrow keys or drag) ---------- */
  function orbRun(canvas, scoreEl) {
    const st = { pos: { x: .5, y: .5 }, vel: { x: 0, y: 0 }, spark: { x: .25, y: .3 }, score: 0, time: 30, running: false, keys: new Set(), drag: null, best: O.store.get('orbBest', 0) };
    const reset = () => { Object.assign(st, { pos: { x: .5, y: .5 }, vel: { x: 0, y: 0 }, score: 0, time: 30, running: true }); st.spark = { x: .1 + Math.random() * .8, y: .1 + Math.random() * .8 }; };
    const key = (e, down) => { const k = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' }[e.key]; if (k && st.running) { e.preventDefault(); down ? st.keys.add(k) : st.keys.delete(k); } };
    const kd = e => key(e, true), ku = e => key(e, false);
    addEventListener('keydown', kd); addEventListener('keyup', ku);
    canvas.addEventListener('pointerdown', e => { st.drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (st.drag) { st.vel.x += (e.clientX - st.drag.x) / 9000; st.vel.y += (e.clientY - st.drag.y) / 9000; st.drag = { x: e.clientX, y: e.clientY }; } });
    canvas.addEventListener('pointerup', () => st.drag = null);
    let raf, last = performance.now();
    const step = t => {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      const W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
      const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      if (st.running) {
        st.time -= dt;
        let ax = 0, ay = 0;
        if (M.running) { ax = M.roll * 1.3; ay = M.pitch * 1.3 - .3; }
        if (st.keys.has('l')) ax -= .6; if (st.keys.has('r')) ax += .6; if (st.keys.has('u')) ay -= .6; if (st.keys.has('d')) ay += .6;
        st.vel.x = (st.vel.x + ax * .00055 * dt * 60) * .985; st.vel.y = (st.vel.y + ay * .00055 * dt * 60) * .985;
        st.pos.x += st.vel.x * dt * 60; st.pos.y += st.vel.y * dt * 60;
        if (st.pos.x < .04 || st.pos.x > .96) { st.vel.x *= -.6; st.pos.x = O.clamp(st.pos.x, .04, .96); }
        if (st.pos.y < .05 || st.pos.y > .95) { st.vel.y *= -.6; st.pos.y = O.clamp(st.pos.y, .05, .95); }
        if (Math.hypot((st.pos.x - st.spark.x) * W / H, st.pos.y - st.spark.y) < .08) { st.score++; O.haptic(); O.chime(); st.spark = { x: .08 + Math.random() * .84, y: .08 + Math.random() * .84 }; }
        if (st.time <= 0) { st.running = false; if (st.score > st.best) { st.best = st.score; O.store.set('orbBest', st.best); } O.haptic('success'); }
      }
      const sx = st.spark.x * W, sy = st.spark.y * H, px = st.pos.x * W, py = st.pos.y * H;
      let g = c.createRadialGradient(sx, sy, 0, sx, sy, 24); g.addColorStop(0, 'rgba(255,189,82,.95)'); g.addColorStop(1, 'rgba(255,189,82,0)'); c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 24, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(sx, sy, 6, 0, 7); c.fill();
      g = c.createRadialGradient(px, py, 0, px, py, 38); g.addColorStop(0, 'rgba(63,245,255,.7)'); g.addColorStop(1, 'rgba(63,245,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(px, py, 38, 0, 7); c.fill();
      g = c.createRadialGradient(px - 4, py - 4, 0, px, py, 17); g.addColorStop(0, '#fff'); g.addColorStop(.45, '#3ff5ff'); g.addColorStop(1, '#2f7bff'); c.fillStyle = g; c.beginPath(); c.arc(px, py, 16, 0, 7); c.fill();
      if (!st.running) {
        c.fillStyle = 'rgba(2,3,6,.55)'; c.fillRect(0, 0, W, H); c.textAlign = 'center'; c.fillStyle = '#f4f7ff';
        c.font = '700 26px "Space Grotesk", system-ui'; c.fillText(st.time <= 0 ? `Time! ${st.score} sparks` : 'Orb Run', W / 2, H / 2 - 18);
        c.font = '500 14px Inter, system-ui'; c.fillStyle = 'rgba(244,247,255,.7)';
        c.fillText(M.running ? 'Tilt to roll the orb into the sparks. Tap to start.' : 'Use the arrow keys or drag to steer. Tap to start.', W / 2, H / 2 + 12);
      }
      scoreEl.textContent = `Score ${st.score} · Best ${st.best} · ${Math.max(0, Math.ceil(st.time))} s`;
      raf = requestAnimationFrame(step);
    };
    canvas.addEventListener('click', () => { if (!st.running) reset(); });
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
  }

  /* ---------- Page ---------- */
  let tab = 'motion';
  O.pages.spatial = {
    render(root) {
      const body = h('div', { class: 'stack' });
      const draw = () => {
        this.stopGame?.(); this.stopGame = null;
        (this.offs || []).forEach(f => f()); this.offs = [];
        body.replaceChildren();
        if (tab === 'motion') motionTab(body); else if (tab === 'play') {
          const canvas = h('canvas', { class: 'game', id: 'orbGame', tabindex: 0, 'aria-label': 'Orb Run game' }), score = h('div', { class: 'headline' });
          body.append(score, canvas, M.running || !O.device.motion ? null : h('button', { class: 'btn ghost sm', type: 'button', onclick: () => M.enable() }, O.icon('gyro'), 'Use tilt'));
          this.stopGame = orbRun(canvas, score);
        } else {
          body.append(O.unavailable('spatial', 'AR notes and measuring need the OMNI app', 'Pinning notes in your room and measuring with ARKit only works in the iPhone/iPad app — Safari doesn’t offer AR to websites.', 'Here: use the compass, level and motion tools, or Vision’s live object labels.'),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => O.go('vision') }, O.icon('cube'), 'Open object labels'));
        }
      };
      root.append(...O.pageHead('spatial', 'Space & motion', 'Use your device’s motion sensors: orientation, compass, a spirit level, and shake / tilt / face-down events that can trigger automations. Overlays stay on your screen.'),
        O.seg([['motion', 'Motion', 'gyro'], ['play', 'Orb run', 'game'], ['ar', 'AR', 'spatial']], tab, v => { tab = v; draw(); }), body);
      draw();
    },
    leave() { this.stopGame?.(); (this.offs || []).forEach(f => f()); },
  };

  function motionTab(body) {
    if (!O.device.motion) {
      body.append(O.unavailable('gyro', 'No motion sensors here', 'This looks like a computer without a gyroscope or compass.', 'Open OMNI on your iPhone or iPad for motion, or play Orb Run with the arrow keys.'));
      return;
    }
    const enable = h('button', { class: 'btn primary', type: 'button', 'data-motion-enable': '', onclick: () => M.enable() }, O.icon('gyro'), 'Turn on motion sensors');
    const problem = h('div');
    const phone = h('div', { style: { width: '64px', height: '120px', margin: '10px auto', borderRadius: '16px', border: '2px solid var(--cyan)', background: 'linear-gradient(var(--blue), rgba(63,245,255,.35))', boxShadow: '0 0 16px rgba(63,245,255,.4)' } });
    const readout = h('div', { class: 'row center mono small' });
    const ring = h('canvas', { width: 170, height: 170, style: { display: 'block', margin: '0 auto' } });
    const headingTxt = h('div', { class: 'headline', style: { textAlign: 'center', color: 'var(--cyan)' } });
    const bubble = h('div', { style: { position: 'absolute', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--cyan)', boxShadow: '0 0 12px var(--cyan)', left: '65px', top: '65px' } });
    const level = h('div', { style: { position: 'relative', width: '160px', height: '160px', margin: '0 auto', borderRadius: '50%', background: 'rgba(2,3,6,.45)', border: '1px solid var(--stroke)' } },
      h('div', { style: { position: 'absolute', inset: '60px', borderRadius: '50%', border: '1px solid var(--stroke)' } }), bubble);
    const move = h('div', { class: 'stack' });
    const tilt = O.toggle('Tilt for next / previous section', 'Tilt right to go forward, left to go back', !!M.tiltNav, v => { M.tiltNav = v; }, 'tiltNav');
    body.append(problem, M.running ? null : h('div', { class: 'card stack' }, h('p', { class: 'small' }, 'iPhone and iPad ask before a website can read motion. Nothing is recorded or sent anywhere.'), enable),
      h('div', { class: 'grid', style: { '--min': '260px' } },
        h('div', { class: 'card stack' }, h('h3', null, O.icon('spatial'), 'Orientation'), phone, readout),
        h('div', { class: 'card stack' }, h('h3', null, O.icon('compass'), 'Compass'), ring, headingTxt),
        h('div', { class: 'card stack' }, h('h3', null, O.icon('gyro'), 'Level'), level),
        h('div', { class: 'card stack' }, h('h3', null, O.icon('bolt'), 'Movement'), move)),
      h('div', { class: 'card stack' }, tilt, h('p', { class: 'muted' }, 'Shake, tilt and face-down can trigger anything: Automation › New › When I shake…'), h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.go('automation') }, 'Open Automation')));
    const paint = () => {
      problem.replaceChildren(M.problem ? O.unavailable('gyro', 'Motion sensors', M.problem) : '');
      phone.style.transform = `perspective(400px) rotateX(${-M.pitch}rad) rotateY(${M.roll}rad)`;
      readout.textContent = `Pitch ${Math.round(M.pitch * 57.3)}° · Roll ${Math.round(M.roll * 57.3)}° · Yaw ${Math.round(M.yaw * 57.3)}°`;
      const c = ring.getContext('2d'); c.clearRect(0, 0, 170, 170); c.save(); c.translate(85, 85); c.rotate(-(M.heading || 0) * Math.PI / 180);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 10; c.beginPath(); c.arc(0, 0, 75, 0, 7); c.stroke();
      for (let i = 0; i < 36; i++) { c.save(); c.rotate(i * Math.PI / 18); c.fillStyle = i % 9 ? 'rgba(244,247,255,.45)' : '#3ff5ff'; c.fillRect(-1, -78, 2, i % 9 ? 7 : 14); c.restore(); }
      c.font = '600 14px "Space Grotesk", system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
      ['N', 'E', 'S', 'W'].forEach((l, i) => { c.save(); c.rotate(i * Math.PI / 2); c.fillStyle = l === 'N' ? '#ff6170' : 'rgba(244,247,255,.75)'; c.fillText(l, 0, -52); c.restore(); });
      c.restore();
      c.fillStyle = '#3ff5ff'; c.beginPath(); c.moveTo(85, 62); c.lineTo(93, 92); c.lineTo(85, 86); c.lineTo(77, 92); c.closePath(); c.fill();
      headingTxt.textContent = M.heading != null ? `${Math.round(M.heading)}° ${O.compassName(M.heading)}` : (M.running ? 'No compass reading (try moving in a figure 8)' : '—');
      bubble.style.transform = `translate(${O.clamp(M.gx, -1, 1) * 62}px, ${O.clamp(-M.gy, -1, 1) * 62}px)`;
      bubble.style.background = Math.abs(M.gx) < .02 && Math.abs(M.gy) < .02 ? 'var(--mint)' : 'var(--cyan)';
      move.replaceChildren(h('span', { class: 'pill' + (M.moving ? ' live' : ''), style: { '--c': M.moving ? 'var(--amber)' : 'var(--mint)' } }, M.moving ? 'Moving' : 'Still'),
        h('p', { class: 'small' }, M.last ? `Last: ${O.MOTIONS[M.last]} · ${M.lastAt.toLocaleTimeString()}` : 'Shake, tilt or turn the device face down.'),
        h('div', { class: 'bar' }, h('i', { style: { width: Math.min(100, M.accel * 50) + '%' } })));
    };
    paint();
    const offs = [O.bus.on('motionFrame', paint), O.bus.on('motion', paint)];
    O.pages.spatial.offs = offs;
  }
  O.bus.on('event', ev => { if (ev.type === 'motion' && M.tiltNav && (ev.ev === 'tiltLeft' || ev.ev === 'tiltRight')) { O.haptic(); O.sectionStep(ev.ev === 'tiltRight' ? 1 : -1); } });
})();
