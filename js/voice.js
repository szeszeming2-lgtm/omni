/* OMNI web — speech out (speechSynthesis), speech in (Web Speech API) with the “OMNI” wake word, and the assistant. */
'use strict';
(function () {
  const h = O.h;

  /* ---------- Speaking ---------- */
  O.voices = () => { try { return speechSynthesis.getVoices().filter(v => v.lang.startsWith((navigator.language || 'en').slice(0, 2))); } catch (e) { return []; } };
  O.speaking = false;
  O.speak = function (text, done) {
    if (!O.device.speechOut || !text) { done && done(); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find(x => x.voiceURI === O.settings.voiceURI) || pickVoice();
      if (v) u.voice = v;
      u.rate = O.settings.rate || 1;
      O.speaking = true; O.bus.emit('voice');
      const end = () => { O.speaking = false; O.bus.emit('voice'); const d = done; done = null; d && d(); };
      u.onend = end; u.onerror = end;
      setTimeout(() => { if (O.speaking && !speechSynthesis.speaking) end(); }, 1200 + text.length * 120);
      speechSynthesis.speak(u);
    } catch (e) { done && done(); }
  };
  function pickVoice() {
    const vs = O.voices();
    return vs.find(v => /premium|enhanced|natural/i.test(v.name)) || vs.find(v => v.localService) || vs[0];
  }
  O.hush = () => { try { speechSynthesis.cancel(); } catch (e) {} O.speaking = false; O.bus.emit('voice'); };

  /* ---------- Listening ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const V = O.voice = {
    listening: false, mode: 'off', live: '', history: [], problem: null, level: 0, pushToTalk: false,
    rec: null, silence: null, restartTimer: null, stream: null, analyser: null,

    async start(ptt = false) {
      if (!SR) { this.problem = 'This browser can’t recognise speech. Safari and Chrome can — or type your command below.'; O.bus.emit('voice'); return; }
      this.problem = null;
      this.pushToTalk = ptt || !O.settings.wakeOn;
      if (!this.listening) {
        this.listening = true;
        // iPhone/iPad Safari can't share the microphone between a level meter and recognition.
        if (!O.device.iOS) this.meter();
        this.begin();
        O.log.add('Voice on', 'Listening while this page is open', 'info', 'mic');
      }
      this.mode = this.pushToTalk ? 'capturing' : 'waiting';
      if (this.pushToTalk) this.capture();
      O.bus.emit('voice'); O.renderNav();
    },
    stop() {
      this.listening = false; this.mode = 'off'; this.live = '';
      clearTimeout(this.silence); clearTimeout(this.restartTimer);
      try { this.rec && this.rec.abort(); } catch (e) {}
      this.rec = null;
      if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
      this.level = 0;
      O.bus.emit('voice'); O.renderNav();
    },
    async talkNow() {
      O.hush();
      if (!this.listening) return this.start(true);
      this.pushToTalk = true; this.capture(); this.restart();
    },
    begin() {
      if (!this.listening) return;
      const r = new SR();
      r.continuous = true; r.interimResults = true; r.lang = navigator.language || 'en-US'; r.maxAlternatives = 1;
      r.onresult = e => {
        let text = '', final = false;
        for (let i = e.resultIndex; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; }
        // Keep the whole session transcript so the wake word and the command can arrive in separate results.
        let all = ''; for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript + ' ';
        this.heard(all.trim(), final);
      };
      r.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.problem = 'Microphone or speech recognition is blocked for this site. Allow it in the browser’s website settings.'; this.stop(); }
        else if (e.error === 'network') { this.problem = 'Speech recognition needs a connection in this browser.'; }
      };
      r.onend = () => { if (this.listening && this.rec === r && this.mode !== 'speaking' && this.mode !== 'thinking') this.restartTimer = setTimeout(() => this.begin(), 250); };
      this.rec = r;
      try { r.start(); } catch (e) {}
    },
    restart() { try { this.rec && this.rec.abort(); } catch (e) {} this.rec = null; clearTimeout(this.restartTimer); this.restartTimer = setTimeout(() => this.begin(), 200); },
    pause() { try { this.rec && this.rec.abort(); } catch (e) {} this.rec = null; },
    async meter() {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ac = new (window.AudioContext || window.webkitAudioContext)(), src = ac.createMediaStreamSource(this.stream), an = ac.createAnalyser();
        an.fftSize = 512; src.connect(an); const buf = new Float32Array(an.fftSize);
        const loop = () => {
          if (!this.listening) { ac.close(); return; }
          an.getFloatTimeDomainData(buf); let sum = 0; for (const v of buf) sum += v * v;
          const db = 20 * Math.log10(Math.max(Math.sqrt(sum / buf.length), 1e-5));
          this.level = O.clamp((db + 55) / 45, 0, 1); O.bus.emit('level'); requestAnimationFrame(loop);
        };
        loop();
      } catch (e) { /* the level meter is optional; recognition still works */ }
    },
    capture() {
      this.mode = 'capturing'; this.live = ''; this.captureBase = null;
      O.chime(); O.haptic();
      this.arm(6);
      O.bus.emit('voice');
    },
    heard(text, final) {
      if (this.mode === 'waiting') {
        const after = O.parser.afterWake(text, O.settings.wakePhrase);
        if (after != null) { this.capture(); this.live = after; this.arm(after ? 1.4 : 6); O.bus.emit('voice'); }
      } else if (this.mode === 'capturing') {
        if (this.captureBase == null && this.pushToTalk) this.captureBase = '';
        const cmd = this.pushToTalk ? text : (O.parser.afterWake(text, O.settings.wakePhrase) ?? text);
        if (cmd !== this.live) { this.live = cmd; this.arm(cmd ? 1.4 : 6); O.bus.emit('voice'); }
        if (final && cmd && !SR_IS_SAFARI) this.finish();
      }
    },
    arm(sec) {
      clearTimeout(this.silence);
      this.silence = setTimeout(() => { if (this.mode !== 'capturing') return; this.live.trim() ? this.finish() : this.back(); }, sec * 1000);
    },
    finish() {
      clearTimeout(this.silence);
      const cmd = this.live.trim(); if (!cmd) return this.back();
      this.mode = 'thinking'; this.pause(); O.bus.emit('voice');
      this.handle(cmd, true);
    },
    back() {
      this.live = '';
      if (this.pushToTalk && !O.settings.wakeOn) return this.stop();
      this.pushToTalk = false; this.mode = this.listening ? 'waiting' : 'off';
      if (this.listening) this.restart();
      O.bus.emit('voice');
    },
    context() {
      const t = O.tools;
      return {
        commands: t.commands, automationNames: t.automations.map(a => a.name),
        automationTriggers: t.automations.filter(a => a.enabled && a.trigger.k === 'voice').map(a => ({ phrase: a.trigger.phrase, name: a.name })),
        semantic: O.parser.semanticMatcher(t.commands),
      };
    },
    async handle(cmd, spoken) {
      const intent = O.parser.parse(cmd, this.context());
      const [reply, ok] = await execute(intent);
      this.history.unshift({ heard: cmd, reply, ok, at: new Date() }); this.history.length = Math.min(this.history.length, 60);
      O.event({ type: 'voice', text: cmd });
      const stopAfter = intent.kind === 'stop';
      O.bus.emit('voice');
      const after = () => { if (stopAfter) this.stop(); else if (this.listening) this.back(); };
      if (O.settings.spoken) { if (this.listening) this.mode = 'speaking'; O.bus.emit('voice'); O.speak(reply, after); } else after();
      this.live = '';
      return { reply, ok };
    },
  };
  const SR_IS_SAFARI = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  async function execute(i) {
    const name = O.settings.userName ? ', ' + O.settings.userName : '';
    switch (i.kind) {
      case 'timer': { const r = O.timers.start(i.seconds, i.label); return [r.message, r.ok]; }
      case 'cancelTimers': { const n = O.timers.cancelAll(); return [n ? `Cancelled ${n} timer${n === 1 ? '' : 's'}.` : 'There are no timers running.', true]; }
      case 'timerStatus': return [O.timers.describe(), true];
      case 'note': O.notes.add(i.text, 'voice'); return ['Noted: ' + i.text, true];
      case 'readNotes': return O.notes.list.length ? ['Your latest notes: ' + O.notes.list.slice(0, 3).map(n => n.text).join('. '), true] : ['You don’t have any notes yet.', true];
      case 'time': return [`It’s ${O.fmtTime(new Date())}.`, true];
      case 'date': return ['Today is ' + new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) + '.', true];
      case 'calc': { const v = Math.round(i.value * 1e6) / 1e6; return [`${i.expr} is ${v.toLocaleString()}.`, true]; }
      case 'help': return ['Try: set a timer for five minutes. Take a note. What is 12 times 7. Open scanner. Run shortcut lights off. Search for the weather. Or what time is it.', true];
      case 'greeting': return [`Hello${name}. I'm listening.`, true];
      case 'stop': return ['Okay. I’ll stop listening.', true];
      case 'navigate': O.go(i.section); return [`Opening ${O.section(i.section).title}.`, true];
      case 'automation': { const r = await O.runAutomationNamed(i.name, 'Voice'); return [r.message, r.ok]; }
      case 'custom': {
        const c = O.tools.commands.find(x => x.id === i.id); if (!c) return ['That command no longer exists.', false];
        const res = await O.run(c.steps, 'Voice: ' + c.phrases[0]); const bad = res.find(r => !r.ok);
        return bad ? [(c.reply ? c.reply + ' ' : '') + 'But one step didn’t work: ' + bad.message, false] : [c.reply || 'Done.', true];
      }
      case 'shortcut': { const r = O.runShortcut(i.name); return [r.message, r.ok]; }
      case 'search': { const r = await O.perform({ t: 'search', query: i.query }); return [r.message, r.ok]; }
      case 'openSite': { const r = await O.perform({ t: 'url', url: i.url }); return [r.message, r.ok]; }
      case 'heading': {
        if (O.motion?.heading != null) return [`You’re facing ${O.compassName(O.motion.heading)}, ${Math.round(O.motion.heading)} degrees.`, true];
        return ['Open Spatial and allow motion sensors, then ask again.', false];
      }
      case 'needsApp': return [`${i.what} needs the OMNI app — ${i.why}`, false];
      default: return [`I heard “${i.raw}”, but that isn’t a command I know. Say “what can you do” for ideas, or teach me in Workshop.`, false];
    }
  }

  /* ---------- Voice page ---------- */
  let tab = 'chat';
  O.pages.voice = {
    render(root) {
      const orb = h('canvas', { class: 'orb' });
      const stateEl = h('div', { class: 'title2' });
      const liveEl = h('div', { class: 'live' });
      const startBtn = h('button', { class: 'btn primary', type: 'button', 'data-voice-toggle': '', onclick: () => V.listening ? V.stop() : V.start() });
      const talk = h('button', { class: 'btn ghost', type: 'button', onclick: () => V.talkNow() }, O.icon('voice'), 'Talk now');
      const pills = h('div', { class: 'row center' });
      const problem = h('div');
      const core = h('div', { class: 'card tint voice-core', style: { '--t': 'var(--cyan)' } }, h('button', { class: 'orb-btn', type: 'button', style: { border: 0, background: 'none' }, onclick: () => V.talkNow(), 'aria-label': 'Talk to OMNI' }, orb),
        stateEl, liveEl, h('div', { class: 'row center' }, startBtn, talk), pills);
      O.mountOrb(orb, { size: 190 });

      const input = h('input', { class: 'field', placeholder: 'Type a command — e.g. “set a timer for 10 minutes”', id: 'voiceTyped', enterkeyhint: 'send' });
      const send = () => { const t = input.value.trim(); if (!t) return; input.value = ''; V.handle(t, false); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      const typeBar = h('div', { class: 'row nowrap' }, input, h('button', { class: 'btn primary', type: 'button', onclick: send, 'aria-label': 'Send', 'data-voice-send': '' }, O.icon('chevron')));
      const body = h('div', { class: 'stack' });

      const paint = () => {
        const wake = O.cap(O.settings.wakePhrase);
        stateEl.textContent = { off: 'Voice is off', waiting: `Listening for “${wake}”`, capturing: 'I’m listening…', thinking: 'Working on it…', speaking: 'Speaking' }[V.mode];
        liveEl.textContent = V.live ? `“${V.live}”` : (V.mode === 'waiting' ? `Try: “${wake}, what time is it?”` : '');
        startBtn.replaceChildren(O.icon(V.listening ? 'stop' : 'mic'), V.listening ? 'Stop listening' : 'Start listening');
        startBtn.className = 'btn ' + (V.listening ? 'danger' : 'primary');
        pills.replaceChildren(...[V.listening ? h('span', { class: 'pill live', style: { '--c': 'var(--cyan)' } }, 'Listening only while this page is open') : null,
          O.speaking ? h('span', { class: 'pill live', style: { '--c': 'var(--mint)' } }, 'Speaking') : null].filter(Boolean));
        problem.replaceChildren(V.problem ? O.unavailable('mic', 'Voice can’t start', V.problem, 'You can still type commands below.') : (!SR ? O.unavailable('mic', 'Speech recognition isn’t in this browser', 'Use Safari on iPhone/iPad/Mac or Chrome.', 'Typing works everywhere.') : ''));
        drawTab();
      };
      const drawTab = () => {
        body.replaceChildren();
        if (tab === 'chat') {
          if (!V.history.length) body.append(h('div', { class: 'card' }, O.empty('voice', 'No conversation yet', 'Commands you say or type — and OMNI’s real answers — appear here.')));
          const list = h('div', { class: 'stack', id: 'voiceHistory' });
          for (const x of V.history) list.append(h('div', { class: 'stack' }, h('div', { class: 'bubble-me' }, x.heard), h('div', { class: 'bubble-omni', style: { borderColor: x.ok ? 'var(--stroke)' : 'rgba(255,189,82,.35)' } }, x.reply)));
          body.append(list);
        } else if (tab === 'timers') {
          if (!O.timers.list.length) body.append(h('div', { class: 'card' }, O.empty('timer', 'No timers', 'Say “OMNI, set a pasta timer for 10 minutes”.')));
          for (const t of O.timers.list) {
            const left = (t.end - Date.now()) / 1000;
            body.append(h('div', { class: 'card tight spread' }, h('div', { class: 'grow stack' }, h('b', null, O.timers.title(t)), h('div', { class: 'bar' }, h('i', { style: { width: (100 * (1 - left / t.dur)) + '%' } }))),
              h('span', { class: 'num', style: { color: 'var(--cyan)', fontSize: '26px' } }, O.fmtClock(left)), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cancel timer', onclick: () => O.timers.cancel(t.id) }, O.icon('x'))));
          }
          body.append(h('div', { class: 'row' }, [1, 5, 10, 25].map(m => h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.timers.start(m * 60, '') }, m + ' min'))));
        } else if (tab === 'notes') {
          if (!O.notes.list.length) body.append(h('div', { class: 'card' }, O.empty('note', 'No notes', 'Say “OMNI, take a note…” or type “note …” above.')));
          for (const n of O.notes.list) body.append(h('div', { class: 'list-row' }, O.icon(n.source === 'voice' ? 'voice' : 'note'), h('div', { class: 'main' }, h('b', { style: { whiteSpace: 'normal' } }, n.text), h('span', null, new Date(n.at).toLocaleString())),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Read aloud', onclick: () => O.speak(n.text) }, O.icon('speaker')), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete note', onclick: () => O.notes.remove(n.id) }, O.icon('trash'))));
        } else {
          const groups = [['Timers & notes', 'timer', ['set a timer for 5 minutes', 'remind me in 20 minutes to call Sam', 'how much time is left', 'take a note buy milk', 'read my notes']],
            ['Ask', 'sparkle', ['what time is it', 'what is 18 percent of 240', 'what is 12 times 7', 'search for the weather tomorrow', 'which way am I facing']],
            ['OMNI', 'all', ['open scanner', 'open spatial', 'run automation morning hello', 'run shortcut lights off', 'stop listening']]];
          for (const [g, ic, list] of groups) body.append(h('div', { class: 'card stack' }, h('h3', null, O.icon(ic), g), h('div', { class: 'chips' }, list.map(c => h('button', { class: 'chip', type: 'button', onclick: () => V.handle(c, false) }, c)))));
          if (O.tools.commands.length) body.append(h('div', { class: 'card stack' }, h('h3', null, O.icon('workshop'), 'Your commands'), h('div', { class: 'chips' }, O.tools.commands.flatMap(c => c.phrases).map(p => h('span', { class: 'chip', style: { '--c': 'var(--violet)' } }, p)))));
          body.append(h('p', { class: 'muted' }, 'Your Mac, Apple Home and the flashlight need the OMNI app — websites aren’t allowed to control them.'));
        }
      };

      root.append(...O.pageHead('voice', `Say “${O.cap(O.settings.wakePhrase)}”`, 'Switch Voice on and OMNI listens for its name while this page is open. It never listens in the background. Recognition is done by your browser (Safari uses Apple’s speech service).'),
        core, problem, typeBar,
        O.seg([['chat', 'Conversation', 'voice'], ['timers', 'Timers', 'timer'], ['notes', 'Notes', 'note'], ['help', 'Commands', 'info']], tab, v => { tab = v; drawTab(); }), body);
      paint();
      this.offs = [O.bus.on('voice', paint), O.bus.on('timers', drawTab), O.bus.on('notes', drawTab), O.bus.on('tick', () => { if (tab === 'timers') drawTab(); })];
    },
    leave() { (this.offs || []).forEach(f => f()); },
  };
  if (O.device.speechOut) try { speechSynthesis.onvoiceschanged = () => O.bus.emit('voices'); } catch (e) {}
})();
