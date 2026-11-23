/* OMNI web — Discover dashboard. */
'use strict';
(function () {
  const h = O.h;
  const card = (title, icon, action, ...kids) => h('div', { class: 'card stack' },
    h('div', { class: 'spread' }, h('h3', null, O.icon(icon), title), action || null), ...kids);
  const link = (label, id) => h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.go(id) }, label);

  O.pages.discover = {
    render(root) {
      const hr = new Date().getHours();
      const greet = (hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening') + (O.settings.userName ? ', ' + O.settings.userName : '');
      const orb = h('canvas');
      const pills = h('div', { class: 'row' });
      const hero = h('div', { class: 'card tint hero', style: { '--t': 'var(--blue)' } },
        h('div', { class: 'stack grow' }, h('div', { class: 'eyebrow' }, new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })),
          h('h1', null, greet), h('p', { class: 'small' }, `Tap the core to talk, or say “${O.cap(O.settings.wakePhrase)}” while Voice is on.`), pills),
        h('button', { class: 'orb-btn', type: 'button', 'aria-label': 'Talk to OMNI', 'data-orb': '', onclick: () => O.voice.talkNow() }, orb));
      O.mountOrb(orb, { size: 150 });
      const grid = h('div', { class: 'grid', style: { '--min': '320px' } });
      const widgets = {};

      widgets.status = () => {
        const tile = (icon, label, value, color, id) => h('button', { class: 'status-tile', type: 'button', onclick: () => O.go(id) }, O.badge(icon, color, 34), h('div', null, h('span', null, label), h('b', null, value)));
        return card('Live status', 'control', null, h('div', { class: 'grid two' },
          tile('mic', 'Voice', O.voice.listening ? 'Listening' : 'Off', O.voice.listening ? 'var(--cyan)' : 'var(--text3)', 'voice'),
          tile('hand', 'Gestures', O.gesture.running ? (O.gesture.armed ? 'Armed' : 'Watching') : 'Off', O.gesture.armed ? 'var(--violet)' : 'var(--text3)', 'gesture'),
          tile('gyro', 'Motion', O.motion.running ? 'On' : (O.device.motion ? 'Tap to turn on' : 'None here'), O.motion.running ? 'var(--mint)' : 'var(--text3)', 'spatial'),
          tile('timer', 'Timers', O.timers.list.length ? O.timers.list.length + ' running' : 'None', O.timers.list.length ? 'var(--amber)' : 'var(--text3)', 'voice')));
      };
      widgets.panel = () => {
        const p = O.tools.panels.find(x => x.id === O.tools.quickPanel) || O.tools.panels[0];
        return p ? card('Quick panel', 'all', link('Panels', 'workshop'), h('div', { class: 'muted' }, p.name), O.panelGrid(p, true)) : null;
      };
      widgets.voice = () => card('Voice shortcut', 'voice', null, h('div', { class: 'row nowrap' },
        h('button', { class: 'btn ' + (O.voice.listening ? 'danger' : 'primary'), type: 'button', onclick: () => O.voice.listening ? O.voice.stop() : O.voice.start() }, O.icon(O.voice.listening ? 'stop' : 'mic'), O.voice.listening ? 'Stop' : 'Listen'),
        h('div', { class: 'grow small' }, O.voice.history[0] ? 'Last: ' + O.voice.history[0].reply : 'Listening happens only while this page is open.')));
      widgets.timers = () => {
        const els = O.timers.list.map(t => h('div', { class: 'spread' }, h('span', null, O.timers.title(t)), h('span', { class: 'mono', style: { color: 'var(--cyan)' }, 'data-timer': t.id }, O.fmtClock((t.end - Date.now()) / 1000))));
        return card('Timers & notes', 'timer', link('Voice', 'voice'), ...(els.length ? els : [h('p', { class: 'small' }, 'No timers running. Say “OMNI, set a timer for 10 minutes”.')]),
          O.notes.list[0] ? h('div', { class: 'divider' }) : null, O.notes.list[0] ? h('div', { class: 'small' }, '📝 ' + O.notes.list[0].text) : null,
          O.notes.list.length ? h('div', { class: 'muted' }, `${O.notes.list.length} note${O.notes.list.length === 1 ? '' : 's'} saved`) : null);
      };
      widgets.scans = () => {
        const box = h('div', { class: 'row nowrap', style: { overflowX: 'auto' } }, h('p', { class: 'small' }, 'Loading…'));
        O.db.all().then(all => box.replaceChildren(...(all.length ? all.slice(0, 8).map(s => h('button', { type: 'button', style: { border: 0, background: 'none', padding: 0, color: 'var(--text2)', width: '96px', flex: 'none', textAlign: 'left' }, onclick: () => { O.go('scanner'); O.openScan(s); } },
          s.thumb ? h('img', { class: 'thumb', src: s.thumb, alt: '' }) : h('div', { class: 'thumb' }), h('div', { class: 'muted', style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, s.title)))
          : [h('p', { class: 'small' }, 'Nothing scanned yet. Vision and Scanner save what you capture here.')])));
        return card('Recent scans', 'scanner', link('Scanner', 'scanner'), box);
      };
      widgets.automations = () => card('Automations', 'automation', link('Edit', 'automation'), ...O.tools.automations.slice(0, 4).map(a => h('div', { class: 'row nowrap' }, O.badge(a.icon, a.color, 30),
        h('div', { class: 'grow' }, h('b', null, a.name), h('div', { class: 'muted' }, a.enabled ? O.triggerTitle(a.trigger) : 'Off')),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { const r = await O.runAutomation(a, 'Dashboard', true); O.toast(r.message, r.ok); } }, 'Run'))));
      widgets.suggestions = () => card('Try saying', 'voice', null, h('div', { class: 'chips' },
        ['What time is it', 'Set a timer for 5 minutes', ...(O.tools.commands[0] ? [O.tools.commands[0].phrases[0]] : []), 'Take a note buy milk', 'What is 15 percent of 80', 'Open scanner', 'What can you do']
          .map(s => h('button', { class: 'chip', type: 'button', onclick: async () => { const r = await O.voice.handle(s, false); O.toast(r.reply, r.ok); } }, '“' + s + '”'))),
        h('p', { class: 'muted' }, 'Tap one to run it now — it does exactly what saying it would.'));
      widgets.capabilities = () => {
        const cap = (name, ok, alt) => h('div', { class: 'spread' }, h('span', null, (ok ? '✓ ' : '– ') + name), ok ? null : h('span', { class: 'muted', style: { textAlign: 'right' } }, alt));
        return card('This device can…', 'check', null,
          cap('Camera vision', O.device.camera && isSecureContext, 'Analyze saved photos instead'),
          cap('Voice commands', O.device.speechIn, 'Type commands instead'),
          cap('Spoken replies', O.device.speechOut, 'Replies shown as text'),
          cap('Motion & compass', O.device.motion, 'Phones and tablets only'),
          cap('Apple Shortcuts', O.device.apple, 'iPhone, iPad and Mac'),
          cap('Notifications', O.notify.state !== 'unsupported', 'Add OMNI to your Home Screen first'),
          cap('Mac remote & Apple Home', false, 'In the OMNI app'),
          cap('AR notes & measuring', false, 'In the OMNI iPhone app'));
      };
      widgets.activity = () => card('Activity', 'info', null, ...(O.log.entries.length ? O.log.entries.slice(0, 6).map(e => h('div', { class: 'spread' },
        h('div', { class: 'grow' }, h('b', { style: { fontSize: '13.5px' } }, e.title), e.detail ? h('div', { class: 'muted' }, e.detail) : null), h('span', { class: 'mono muted' }, O.fmtTime(e.at)))) : [h('p', { class: 'small' }, 'Nothing yet.')]));

      const paint = () => {
        pills.replaceChildren(h('span', { class: 'pill' + (O.voice.listening ? ' live' : ''), style: { '--c': O.voice.listening ? 'var(--cyan)' : 'var(--text3)' } }, O.voice.listening ? `Listening for “${O.cap(O.settings.wakePhrase)}”` : 'Voice off'),
          O.gesture.armed ? h('span', { class: 'pill live', style: { '--c': 'var(--violet)' } }, 'Gestures armed') : null,
          O.timers.list.length ? h('span', { class: 'pill', style: { '--c': 'var(--amber)' } }, `${O.timers.list.length} timer${O.timers.list.length > 1 ? 's' : ''}`) : null,
          O.device.standalone ? null : h('span', { class: 'pill', style: { '--c': 'var(--blue)' } }, O.device.iOS ? 'Tip: Share › Add to Home Screen' : 'Works offline once loaded'));
        grid.replaceChildren(...O.tools.dashboard.map(w => widgets[w]?.()).filter(Boolean));
      };
      root.append(hero, grid);
      paint();
      this.offs = [O.bus.on('voice', paint), O.bus.on('timers', paint), O.bus.on('tools', paint),
        O.bus.on('tick', () => O.$$('[data-timer]').forEach(el => { const t = O.timers.list.find(x => x.id === el.dataset.timer); if (t) el.textContent = O.fmtClock((t.end - Date.now()) / 1000); }))];
    },
    leave() { (this.offs || []).forEach(f => f()); },
  };
})();
