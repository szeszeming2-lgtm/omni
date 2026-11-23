/* OMNI web — actions, tools (automations, commands, panels, gestures), automation engine and the shared action editor. */
'use strict';
(function () {
  const h = O.h;

  /* ---------- Action catalogue ---------- */
  const A = {
    speak: { icon: 'speaker', title: a => `Say “${(a.text || '').slice(0, 40)}”`, need: [] },
    notify: { icon: 'info', title: a => `Notify: ${a.title || 'OMNI'}`, need: ['notifications'] },
    timer: { icon: 'timer', title: a => `Timer ${O.fmtDur(a.s)}${a.label ? ' · ' + a.label : ''}`, need: [] },
    note: { icon: 'note', title: a => `Note “${(a.text || '').slice(0, 30)}”`, need: [] },
    url: { icon: 'link', title: a => `Open ${(a.url || '').replace(/^https?:\/\//, '').slice(0, 40)}`, need: [] },
    shortcut: { icon: 'stack', title: a => `Run Shortcut “${a.name}”`, need: ['shortcuts'] },
    search: { icon: 'search', title: a => `Search “${a.query}”`, need: [] },
    wait: { icon: 'timer', title: a => `Wait ${a.s} s`, need: [] },
    go: { icon: 'all', title: a => `Open ${O.section(a.section)?.title || a.section}`, need: [] },
    step: { icon: 'chevron', title: a => a.dir > 0 ? 'Next section' : 'Previous section', need: [] },
    copy: { icon: 'copy', title: a => `Copy “${(a.text || '').slice(0, 24)}”`, need: [] },
    voice: { icon: 'mic', title: a => a.on === 'toggle' ? 'Start / stop listening' : a.on ? 'Start listening' : 'Stop listening', need: ['microphone'] },
    vibrate: { icon: 'iphone', title: () => 'Haptic tap', need: [] },
    hush: { icon: 'stop', title: () => 'Stop talking', need: [] },
  };
  O.actionInfo = a => ({ title: (A[a.t]?.title || (() => a.t))(a), icon: A[a.t]?.icon || 'bolt', need: A[a.t]?.need || [] });

  /* ---------- Running actions — every outcome is the real one ---------- */
  O.perform = async function (a, source = 'OMNI') {
    switch (a.t) {
      case 'speak': O.speak(a.text); return { ok: true, message: `Said “${a.text}”.` };
      case 'notify': return O.notify.show(a.title || 'OMNI', a.body || '');
      case 'timer': return O.timers.start(a.s, a.label || '');
      case 'note': O.notes.add(a.text, source); return { ok: true, message: 'Saved note.' };
      case 'url': {
        let u; try { u = new URL(a.url.includes(':') ? a.url : 'https://' + a.url); } catch (e) { return { ok: false, message: 'That isn’t a valid link.' }; }
        if (!['http:', 'https:', 'mailto:', 'tel:', 'sms:', 'maps:', 'facetime:'].includes(u.protocol)) return { ok: false, message: 'Only web, mail, phone, messages and Maps links can be opened.' };
        const w = u.protocol.startsWith('http') ? window.open(u.href, '_blank', 'noopener') : (location.href = u.href, true);
        return w ? { ok: true, message: `Opened ${u.host || u.href}.` } : { ok: false, message: 'Your browser blocked the new tab — tap the action again.' };
      }
      case 'shortcut': return O.runShortcut(a.name);
      case 'search': window.open('https://duckduckgo.com/?q=' + encodeURIComponent(a.query), '_blank', 'noopener'); return { ok: true, message: `Searched the web for “${a.query}”.` };
      case 'wait': await O.sleep(Math.min(600, Math.max(0, a.s)) * 1000); return { ok: true, message: 'Waited.' };
      case 'go': O.go(a.section); return { ok: true, message: `Opened ${O.section(a.section)?.title}.` };
      case 'step': O.sectionStep(a.dir); return { ok: true, message: 'Moved to ' + O.section(O.current).title + '.' };
      case 'copy': { const ok = await O.copy(a.text); return ok ? { ok: true, message: 'Copied.' } : { ok: false, message: 'This browser wouldn’t let OMNI copy without a tap.' }; }
      case 'voice': {
        const want = a.on === 'toggle' ? !O.voice.listening : !!a.on;
        if (want) await O.voice.start(); else O.voice.stop();
        return { ok: O.voice.listening === want, message: O.voice.listening ? 'Listening.' : (want ? (O.voice.problem || 'Couldn’t start listening.') : 'Stopped listening.') };
      }
      case 'vibrate': O.haptic(); return { ok: true, message: 'Tap.' };
      case 'hush': O.hush(); return { ok: true, message: 'Stopped.' };
      default: return { ok: false, message: 'This action isn’t available on the web.' };
    }
  };
  O.run = async function (steps, source = 'OMNI') {
    const out = [];
    for (const s of steps || []) { const r = await O.perform(s, source); out.push(r); }
    return out;
  };
  O.runShortcut = function (name) {
    if (!O.device.apple) return { ok: false, message: 'Shortcuts are an Apple app — open OMNI on your iPhone, iPad or Mac to run “' + name + '”.' };
    location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent(name);
    O.log.add('Shortcut', name, 'info', 'stack');
    return { ok: true, message: `Handed “${name}” to the Shortcuts app. Shortcuts shows whether it worked.` };
  };

  /* ---------- Tools store ---------- */
  const s = (t, o = {}) => Object.assign({ id: O.uid(), t }, o);
  function starter() {
    return {
      v: 1,
      automations: [
        { id: O.uid(), name: 'Shake to talk', icon: 'mic', color: 'var(--violet)', enabled: false, trigger: { k: 'motion', ev: 'shake' }, conditions: [], steps: [s('voice', { on: 'toggle' })], runs: 0 },
        { id: O.uid(), name: 'Wi-Fi code helper', icon: 'wifi', color: 'var(--blue)', enabled: false, trigger: { k: 'scanned', contains: 'WIFI:' }, conditions: [], steps: [s('speak', { text: 'That is a Wi-Fi code. The details are on screen.' })], runs: 0 },
        { id: O.uid(), name: 'Morning hello', icon: 'sparkle', color: 'var(--mint)', enabled: false, trigger: { k: 'time', hh: 8, mm: 0 }, conditions: [{ id: O.uid(), k: 'weekdays', days: [1, 2, 3, 4, 5] }], steps: [s('speak', { text: 'Good morning. OMNI is online.' }), s('go', { section: 'discover' })], runs: 0 },
      ],
      commands: [
        { id: O.uid(), phrases: ['focus mode', 'help me focus'], reply: 'Focus mode. Twenty five minutes on the clock.', steps: [s('timer', { s: 1500, label: 'Focus' })], enabled: true },
        { id: O.uid(), phrases: ['tea time', 'make tea'], reply: 'Tea timer started. Four minutes.', steps: [s('timer', { s: 240, label: 'Tea' })], enabled: true },
      ],
      panels: [
        { id: O.uid(), name: 'Focus', icon: 'timer', cols: 3, buttons: [
          { id: O.uid(), title: '25 min focus', icon: 'timer', color: 'var(--mint)', steps: [s('timer', { s: 1500, label: 'Focus' }), s('speak', { text: 'Focus timer started.' })] },
          { id: O.uid(), title: '5 min break', icon: 'pause', color: 'var(--amber)', steps: [s('timer', { s: 300, label: 'Break' })] },
          { id: O.uid(), title: 'Stop timers', icon: 'stop', color: 'var(--danger)', steps: [] , special: 'cancelTimers' },
        ] },
        { id: O.uid(), name: 'Quick tools', icon: 'bolt', cols: 3, buttons: [
          { id: O.uid(), title: 'Scan', icon: 'scanner', color: 'var(--cyan)', steps: [s('go', { section: 'scanner' })] },
          { id: O.uid(), title: 'Listen', icon: 'mic', color: 'var(--blue)', steps: [s('voice', { on: 'toggle' })] },
          { id: O.uid(), title: 'Compass', icon: 'compass', color: 'var(--violet)', steps: [s('go', { section: 'spatial' })] },
        ] },
      ],
      gestures: {
        thumbsUp: { enabled: true, steps: [s('speak', { text: 'Got it.' })] },
        openPalm: { enabled: true, steps: [s('voice', { on: 'toggle' })] },
        swipeRight: { enabled: true, steps: [s('step', { dir: 1 })] },
        swipeLeft: { enabled: true, steps: [s('step', { dir: -1 })] },
        fist: { enabled: true, steps: [s('hush')] },
        victory: { enabled: false, steps: [s('timer', { s: 300, label: 'Break' })] },
        pinch: { enabled: false, steps: [s('vibrate')] },
        point: { enabled: false, steps: [] },
      },
      dashboard: ['status', 'panel', 'voice', 'timers', 'scans', 'automations', 'suggestions', 'capabilities', 'activity'],
      quickPanel: null,
    };
  }
  O.tools = O.store.get('tools', null) || starter();
  if (!O.tools.quickPanel && O.tools.panels[0]) O.tools.quickPanel = O.tools.panels[0].id;
  O.saveTools = () => { O.store.set('tools', O.tools); O.bus.emit('tools'); };
  O.saveTools();
  O.starterTools = starter;

  /* ---------- Gestures & motion vocab ---------- */
  O.GESTURES = {
    openPalm: ['✋', 'Open palm'], fist: ['✊', 'Closed fist'], pinch: ['🤏', 'Pinch'], point: ['☝️', 'Point'],
    victory: ['✌️', 'Victory'], thumbsUp: ['👍', 'Thumbs up'], swipeLeft: ['👈', 'Swipe left'], swipeRight: ['👉', 'Swipe right'],
  };
  O.MOTIONS = { shake: 'Shake', faceDown: 'Turn face down', faceUp: 'Turn face up', tiltLeft: 'Tilt left', tiltRight: 'Tilt right' };

  /* ---------- Automation engine ---------- */
  O.triggerTitle = tr => ({
    manual: () => 'When I tap Run', voice: () => `When I say “${tr.phrase}”`, gesture: () => `When I make ${(O.GESTURES[tr.g] || ['', tr.g])[1].toLowerCase()}`,
    motion: () => `When I ${(O.MOTIONS[tr.ev] || tr.ev).toLowerCase()}`, time: () => `Every day at ${String(tr.hh).padStart(2, '0')}:${String(tr.mm).padStart(2, '0')}`,
    scanned: () => tr.contains ? `When I scan a code containing “${tr.contains}”` : 'When I scan any code', launch: () => 'When OMNI opens',
  }[tr.k] || (() => tr.k))();
  O.triggerNeeds = tr => ({ voice: ['microphone'], gesture: ['camera'], motion: ['motion'], scanned: ['camera'], time: ['notifications'] }[tr.k] || []);
  const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  O.conditionTitle = c => ({
    between: () => `Between ${c.from} and ${c.to}`, weekdays: () => 'On ' + c.days.slice().sort().map(d => DAY[d]).join(', '),
    device: () => `Only on ${c.device}`, online: () => c.on ? 'When online' : 'When offline',
  }[c.k] || (() => c.k))();

  O.triggerMatches = function (tr, ev) {
    switch (tr.k) {
      case 'voice': if (ev.type !== 'voice') return false; { const p = O.parser.normalise(tr.phrase), s2 = O.parser.normalise(ev.text); return !!p && (s2 === p || s2.includes(p)); }
      case 'gesture': return ev.type === 'gesture' && ev.g === tr.g;
      case 'motion': return ev.type === 'motion' && ev.ev === tr.ev;
      case 'scanned': return ev.type === 'scanned' && (!tr.contains || ev.payload.toLowerCase().includes(tr.contains.toLowerCase()));
      case 'launch': return ev.type === 'launch';
      case 'time': return ev.type === 'tick' && ev.date.getHours() === tr.hh && ev.date.getMinutes() === tr.mm;
      default: return false;
    }
  };
  O.conditionsHold = function (conds, now = new Date()) {
    for (const c of conds || []) {
      if (c.k === 'between') {
        const m = now.getHours() * 60 + now.getMinutes(), [fh, fm] = c.from.split(':').map(Number), [th, tm] = c.to.split(':').map(Number);
        const a = fh * 60 + fm, b = th * 60 + tm, inside = a <= b ? m >= a && m < b : m >= a || m < b;
        if (!inside) return [false, O.conditionTitle(c)];
      } else if (c.k === 'weekdays') { if (!c.days.includes(now.getDay())) return [false, O.conditionTitle(c)]; }
      else if (c.k === 'device') { if (c.device !== O.device.label && !(c.device === 'phone' && O.device.kind === 'iPhone')) return [false, O.conditionTitle(c)]; }
      else if (c.k === 'online') { if (navigator.onLine !== !!c.on) return [false, O.conditionTitle(c)]; }
    }
    return [true, null];
  };
  const running = new Set(), firedToday = {};
  O.runAutomation = async function (a, source = 'Automation', manual = false) {
    if (running.has(a.id)) return { ok: false, message: `“${a.name}” is already running.` };
    if (!manual) { const [ok, why] = O.conditionsHold(a.conditions); if (!ok) { O.log.add('Skipped ' + a.name, 'Condition not met: ' + why, 'info', 'automation'); return { ok: false, message: 'Conditions not met.' }; } }
    running.add(a.id);
    try {
      const res = await O.run(a.steps, source + ': ' + a.name);
      a.runs = (a.runs || 0) + 1; a.last = Date.now(); O.saveTools();
      const bad = res.find(r => !r.ok);
      O.log.add(bad ? a.name + ' ran with a problem' : 'Ran ' + a.name, bad ? bad.message : `${res.length} step${res.length === 1 ? '' : 's'} done`, bad ? 'warning' : 'success', 'automation');
      return bad ? { ok: false, message: `“${a.name}” ran, but a step failed: ${bad.message}` } : { ok: true, message: `Ran “${a.name}”.` };
    } finally { running.delete(a.id); }
  };
  O.runAutomationNamed = function (name, source) {
    const n = name.toLowerCase();
    const a = O.tools.automations.find(x => x.name.toLowerCase() === n) || O.tools.automations.find(x => x.name.toLowerCase().includes(n));
    return a ? O.runAutomation(a, source, true) : Promise.resolve({ ok: false, message: `There’s no automation called “${name}”. Create it in Automation.` });
  };
  O.event = function (ev) {
    O.bus.emit('event', ev);
    for (const a of O.tools.automations) {
      if (!a.enabled || !O.triggerMatches(a.trigger, ev)) continue;
      if (a.trigger.k === 'time') { const key = new Date().toDateString(); if (firedToday[a.id] === key) continue; firedToday[a.id] = key; }
      O.runAutomation(a, 'Automation');
    }
  };
  setInterval(() => O.event({ type: 'tick', date: new Date() }), 15000);

  /* ---------- Permission states (best effort; never prompts) ---------- */
  O.permState = async function (need) {
    try {
      if (need === 'camera' || need === 'microphone') {
        if (need === 'camera' && !O.device.camera) return 'unavailable';
        if (need === 'microphone' && !O.device.speechIn) return 'unavailable';
        const r = await navigator.permissions?.query({ name: need }); return r ? r.state : 'ask';
      }
      if (need === 'notifications') return O.notify.state === 'default' ? 'ask' : O.notify.state === 'unsupported' ? 'unavailable' : O.notify.state;
      if (need === 'motion') return O.device.motion ? (O.motionGranted ? 'granted' : 'ask') : 'unavailable';
      if (need === 'shortcuts') return O.device.apple ? 'granted' : 'unavailable';
    } catch (e) {}
    return 'ask';
  };
  O.NEED = {
    camera: ['camera', 'Camera', 'To see text, codes, objects and your hands. Frames stay in this browser.'],
    microphone: ['mic', 'Microphone & speech', 'To hear “OMNI” and your commands while Voice is on.'],
    motion: ['gyro', 'Motion sensors', 'To read tilt, shake and the compass. iPhone asks once per visit.'],
    notifications: ['info', 'Notifications', 'To alert you when timers finish or automations run.'],
    shortcuts: ['stack', 'Apple Shortcuts', 'Shortcuts runs on iPhone, iPad and Mac.'],
  };
  O.stateLabel = st => ({ granted: ['Allowed', 'var(--mint)'], denied: ['Off', 'var(--danger)'], prompt: ['Asks when needed', 'var(--amber)'], ask: ['Asks when needed', 'var(--amber)'], unavailable: ['Not on this device', 'var(--text3)'] }[st] || [st, 'var(--text3)']);

  /* ---------- Shared action editor (inline, no nested dialogs) ---------- */
  O.stepsEditor = function (steps, onChange) {
    const wrap = h('div', { class: 'stack' });
    const draw = () => {
      wrap.replaceChildren();
      if (!steps.length) wrap.append(h('p', { class: 'muted' }, 'No actions yet.'));
      steps.forEach((st, i) => {
        const info = O.actionInfo(st);
        wrap.append(h('div', { class: 'list-row' }, h('span', { class: 'mono muted' }, i + 1), O.badge(info.icon, 'var(--cyan)', 30),
          h('div', { class: 'main' }, h('b', null, info.title), info.need.length ? h('span', null, 'Needs ' + info.need.map(n => O.NEED[n]?.[1] || n).join(', ')) : null),
          i > 0 ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move up', onclick: () => { [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; onChange(); draw(); } }, '↑') : null,
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove', onclick: () => { steps.splice(i, 1); onChange(); draw(); } }, O.icon('trash'))));
      });
      const picker = h('div', { class: 'stack', hidden: true });
      const add = h('button', { class: 'btn ghost sm', type: 'button', 'data-add-action': '', onclick: () => { picker.hidden = !picker.hidden; } }, O.icon('plus'), 'Add action');
      wrap.append(add, picker);
      buildPicker(picker, a => { steps.push(Object.assign({ id: O.uid() }, a)); onChange(); draw(); });
    };
    draw();
    return wrap;
  };

  function buildPicker(root, pick) {
    const field = (ph, type = 'text') => h('input', { class: 'field', placeholder: ph, type });
    const opt = (icon, title, detail, inputs, make) => {
      const body = h('div', { class: 'stack', hidden: true }, ...inputs, h('button', { class: 'btn primary sm', type: 'button', onclick: () => { const a = make(); if (a) pick(a); } }, 'Add'));
      const head = h('button', { class: 'list-row', type: 'button', style: { width: '100%', textAlign: 'left', color: 'var(--text)' }, 'data-pick': title,
        onclick: () => { if (!inputs.length) { pick(make()); } else body.hidden = !body.hidden; } },
        O.badge(icon, 'var(--cyan)', 30), h('div', { class: 'main' }, h('b', null, title), h('span', null, detail)));
      return h('div', { class: 'stack' }, head, body);
    };
    const speak = field('What OMNI should say'), note = field('Note text'), url = field('https://…', 'url'), sc = field('Shortcut name, exactly as in Shortcuts'),
      q = field('Search words'), copy = field('Text to copy'), nt = field('Title'), nb = field('Message'), tm = field('Minutes', 'number'), tl = field('Label (optional)'), w = field('Seconds', 'number');
    tm.value = 5; w.value = 2;
    const sec = h('select', { class: 'field' }, O.sections.map(x => h('option', { value: x.id }, x.title)));
    root.append(
      opt('speaker', 'Speak', 'Spoken with this device’s voice', [speak], () => speak.value.trim() && { t: 'speak', text: speak.value.trim() }),
      opt('timer', 'Start a timer', 'Counts down on screen', [tm, tl], () => +tm.value > 0 && { t: 'timer', s: Math.round(+tm.value * 60), label: tl.value.trim() }),
      opt('note', 'Save a note', 'Kept in Voice › Notes', [note], () => note.value.trim() && { t: 'note', text: note.value.trim() }),
      opt('info', 'Show a notification', 'Needs notification permission', [nt, nb], () => nb.value.trim() && { t: 'notify', title: nt.value.trim() || 'OMNI', body: nb.value.trim() }),
      opt('stack', 'Run a Shortcut', 'Apple Shortcuts on iPhone, iPad or Mac', [sc], () => sc.value.trim() && { t: 'shortcut', name: sc.value.trim() }),
      opt('link', 'Open a link', 'Web, mail, phone, Maps', [url], () => url.value.trim() && { t: 'url', url: url.value.trim() }),
      opt('search', 'Search the web', 'Opens DuckDuckGo', [q], () => q.value.trim() && { t: 'search', query: q.value.trim() }),
      opt('copy', 'Copy text', 'To the clipboard', [copy], () => copy.value && { t: 'copy', text: copy.value }),
      opt('mic', 'Start / stop listening', 'Toggles Voice', [], () => ({ t: 'voice', on: 'toggle' })),
      opt('stop', 'Stop talking', 'Silences OMNI', [], () => ({ t: 'hush' })),
      opt('all', 'Open a section', 'Jump to a module', [sec], () => ({ t: 'go', section: sec.value })),
      opt('chevron', 'Next section', '', [], () => ({ t: 'step', dir: 1 })),
      opt('chevron', 'Previous section', '', [], () => ({ t: 'step', dir: -1 })),
      opt('iphone', 'Haptic tap', 'Vibrates where supported', [], () => ({ t: 'vibrate' })),
      opt('timer', 'Wait', 'Pause between steps', [w], () => +w.value >= 0 && { t: 'wait', s: +w.value }),
    );
  }

  /* ---------- Panel grid (used by Discover, Control, Workshop) ---------- */
  O.panelGrid = function (panel, compact = false) {
    const out = h('div', { class: 'stack' });
    const res = h('div');
    const grid = h('div', { style: { display: 'grid', gap: '10px', gridTemplateColumns: `repeat(${Math.max(1, Math.min(panel.cols || 3, 4))}, minmax(0, 1fr))` } },
      panel.buttons.map(b => h('button', { class: 'pad', type: 'button', style: { '--c': b.color || 'var(--cyan)', minHeight: compact ? '66px' : '82px' }, 'data-panel-btn': b.title,
        onclick: async () => {
          O.haptic();
          let r;
          if (b.special === 'cancelTimers') { const n = O.timers.cancelAll(); r = { ok: true, message: n ? `Stopped ${n} timer${n === 1 ? '' : 's'}.` : 'No timers were running.' }; }
          else { const out2 = await O.run(b.steps, 'Panel ' + panel.name); r = out2.find(x => !x.ok) || out2[out2.length - 1] || { ok: true, message: 'Done.' }; }
          res.replaceChildren(O.outcome(r)); setTimeout(() => res.replaceChildren(), 3500);
        } }, O.icon(b.icon), h('span', null, b.title))));
    out.append(grid, res);
    return out;
  };
})();
