/* OMNI web — Workshop: voice commands, control panels, gesture actions, dashboard layout, export/import. */
'use strict';
(function () {
  const h = O.h;
  const ICONS = ['bolt', 'timer', 'mic', 'speaker', 'note', 'stack', 'link', 'search', 'home', 'star', 'camera', 'qr', 'scanner', 'compass', 'play', 'pause', 'stop', 'sparkle'];
  const COLORS = ['var(--cyan)', 'var(--blue)', 'var(--violet)', 'var(--mint)', 'var(--amber)', 'var(--danger)'];
  O.WIDGETS = { status: 'Live status', panel: 'Quick panel', voice: 'Voice shortcut', timers: 'Timers & notes', scans: 'Recent scans', automations: 'Automations', suggestions: 'Try saying', capabilities: 'This device can…', activity: 'Activity' };
  let tab = 'commands';

  function commandEditor(c, done) {
    c = JSON.parse(JSON.stringify(c));
    O.sheet.open('Voice command', body => {
      const phrases = h('textarea', { class: 'field', id: 'cmdPhrases', placeholder: 'One phrase per line, e.g. movie time' }, c.phrases.join('\n'));
      const reply = h('input', { class: 'field', value: c.reply || '', placeholder: 'Optional spoken reply' });
      const hint = h('p', { class: 'muted' });
      const upd = () => { const p = phrases.value.split('\n').map(x => x.trim()).filter(Boolean); hint.textContent = `You’ll say “${O.cap(O.settings.wakePhrase)}, ${p[0] || '…'}”.`;
        const clash = p.find(x => O.parser.parse(x).kind !== 'unknown'); if (clash) hint.textContent += ` “${clash}” is also a built-in command — yours wins.`; };
      phrases.oninput = upd; upd();
      body.append(h('label', { class: 'lbl', for: 'cmdPhrases' }, 'When I say'), phrases, hint, h('label', { class: 'lbl' }, 'OMNI replies'), reply, h('b', null, 'Then do'), O.stepsEditor(c.steps, () => {}),
        h('button', { class: 'btn primary', type: 'button', 'data-save-command': '', onclick: () => {
          c.phrases = phrases.value.split('\n').map(x => x.trim()).filter(Boolean); c.reply = reply.value.trim();
          if (!c.phrases.length) return O.toast('Add at least one phrase', false);
          const i = O.tools.commands.findIndex(x => x.id === c.id); if (i >= 0) O.tools.commands[i] = c; else O.tools.commands.push(c);
          O.saveTools(); O.sheet.close(); done();
        } }, 'Save'));
    });
  }

  function panelEditor(p, done) {
    p = JSON.parse(JSON.stringify(p));
    O.sheet.open(p.name ? 'Edit panel' : 'New panel', body => {
      const list = h('div', { class: 'stack' });
      const preview = h('div');
      const drawList = () => {
        list.replaceChildren(...p.buttons.map((b, i) => h('div', { class: 'list-row' }, O.badge(b.icon, b.color, 32), h('div', { class: 'main' }, h('b', null, b.title), h('span', null, b.steps.map(s => O.actionInfo(s).title).join(' → ') || 'No actions')),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => editButton(i) }, 'Edit'), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove button', onclick: () => { p.buttons.splice(i, 1); drawList(); } }, O.icon('trash')))));
        preview.replaceChildren(p.buttons.length ? O.panelGrid(p) : '');
      };
      const editButton = i => {
        const b = i == null ? { id: O.uid(), title: 'New', icon: 'bolt', color: 'var(--cyan)', steps: [] } : JSON.parse(JSON.stringify(p.buttons[i]));
        const box = h('div', { class: 'card stack' });
        const title = h('input', { class: 'field', value: b.title, oninput: e => b.title = e.target.value });
        const icons = h('div', { class: 'row' }, ICONS.map(ic => h('button', { class: 'icon-btn', type: 'button', style: b.icon === ic ? { background: 'var(--cyan)', color: 'var(--black)' } : null, onclick: e => { b.icon = ic; icons.querySelectorAll('button').forEach(x => { x.style.background = ''; x.style.color = ''; }); e.currentTarget.style.background = 'var(--cyan)'; e.currentTarget.style.color = 'var(--black)'; } }, O.icon(ic))));
        const colors = h('div', { class: 'row' }, COLORS.map(c => h('button', { type: 'button', 'aria-label': 'Colour', style: { width: '28px', height: '28px', borderRadius: '50%', background: c, border: b.color === c ? '3px solid #fff' : 0 }, onclick: e => { b.color = c; colors.querySelectorAll('button').forEach(x => x.style.border = '0'); e.currentTarget.style.border = '3px solid #fff'; } })));
        box.append(h('b', null, 'Button'), title, icons, colors, O.stepsEditor(b.steps, () => {}), h('div', { class: 'row' },
          h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (i == null) p.buttons.push(b); else p.buttons[i] = b; box.remove(); drawList(); } }, 'Done'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => box.remove() }, 'Cancel')));
        list.after(box); box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      const name = h('input', { class: 'field', value: p.name, placeholder: 'Panel name', oninput: e => p.name = e.target.value });
      const cols = h('select', { class: 'field', onchange: e => { p.cols = +e.target.value; drawList(); } }, [1, 2, 3, 4].map(n => h('option', { value: n, selected: p.cols === n }, n + ' column' + (n > 1 ? 's' : ''))));
      body.append(name, cols, h('b', null, 'Buttons'), list, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => editButton(null) }, O.icon('plus'), 'Add button'), h('b', null, 'Preview'), preview,
        h('button', { class: 'btn primary', type: 'button', onclick: () => { if (!p.name.trim()) return O.toast('Name the panel', false); const i = O.tools.panels.findIndex(x => x.id === p.id); if (i >= 0) O.tools.panels[i] = p; else O.tools.panels.push(p); O.tools.quickPanel ||= p.id; O.saveTools(); O.sheet.close(); done(); } }, 'Save panel'));
      drawList();
    });
  }

  O.pages.workshop = {
    render(root) {
      const body = h('div', { class: 'stack' });
      const draw = () => {
        body.replaceChildren();
        if (tab === 'commands') {
          body.append(h('button', { class: 'btn primary', type: 'button', 'data-new-command': '', onclick: () => commandEditor({ id: O.uid(), phrases: [], reply: '', steps: [], enabled: true }, draw) }, O.icon('plus'), 'New voice command'));
          for (const c of O.tools.commands) {
            const sw = h('input', { type: 'checkbox', class: 'sw', checked: c.enabled !== false, 'aria-label': 'Enabled', onchange: e => { c.enabled = e.target.checked; O.saveTools(); } });
            body.append(h('div', { class: 'card stack' }, h('div', { class: 'spread' }, h('div', { class: 'chips' }, c.phrases.map(p => h('span', { class: 'chip', style: { '--c': 'var(--violet)' } }, '“' + p + '”'))), sw),
              h('div', { class: 'flow' }, h('span', { class: 'tag', style: { '--c': 'var(--mint)' } }, 'THEN'), h('span', null, c.steps.map(s => O.actionInfo(s).title).join(' → ') || 'Just reply')),
              c.reply ? h('div', { class: 'flow' }, h('span', { class: 'tag' }, 'SAY'), h('span', null, c.reply)) : null,
              h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { const r = await O.voice.handle(c.phrases[0], false); O.toast(r.reply, r.ok); } }, 'Try it'),
                h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--text2)' }, onclick: () => commandEditor(c, draw) }, 'Edit'),
                h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete', style: { marginLeft: 'auto' }, onclick: () => { O.tools.commands = O.tools.commands.filter(x => x.id !== c.id); O.saveTools(); draw(); } }, O.icon('trash')))));
          }
          body.append(h('p', { class: 'muted' }, 'Your phrases are matched first, then by meaning — so “let’s focus” can still find “focus mode”.'));
        } else if (tab === 'panels') {
          body.append(h('button', { class: 'btn primary', type: 'button', onclick: () => panelEditor({ id: O.uid(), name: '', icon: 'bolt', cols: 3, buttons: [] }, draw) }, O.icon('plus'), 'New panel'));
          for (const p of O.tools.panels) body.append(h('div', { class: 'card stack' }, h('div', { class: 'spread' }, h('h3', null, O.icon(p.icon), p.name, O.tools.quickPanel === p.id ? h('span', { class: 'chip', style: { '--c': 'var(--amber)' } }, '★ On dashboard') : null),
            h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => panelEditor(p, draw) }, 'Edit'),
              O.tools.quickPanel === p.id ? null : h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--amber)' }, onclick: () => { O.tools.quickPanel = p.id; O.saveTools(); draw(); } }, '★'),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete panel', onclick: () => { O.tools.panels = O.tools.panels.filter(x => x.id !== p.id); if (O.tools.quickPanel === p.id) O.tools.quickPanel = O.tools.panels[0]?.id || null; O.saveTools(); draw(); } }, O.icon('trash')))), O.panelGrid(p)));
        } else if (tab === 'gestures') {
          for (const g of Object.keys(O.GESTURES)) {
            const b = O.tools.gestures[g] || { enabled: false, steps: [] };
            body.append(h('button', { class: 'card tight', type: 'button', style: { textAlign: 'left', color: 'var(--text)', border: 0 }, onclick: () => O.editGestureBinding(g, draw) },
              h('div', { class: 'row nowrap' }, h('span', { style: { fontSize: '26px' } }, O.GESTURES[g][0]), h('div', { class: 'grow' }, h('b', null, O.GESTURES[g][1]), h('div', { class: 'muted', style: { color: b.enabled && b.steps.length ? 'var(--cyan)' : '' } }, b.enabled && b.steps.length ? b.steps.map(s => O.actionInfo(s).title).join(' → ') : 'Not used')), O.icon('chevron'))));
          }
        } else if (tab === 'dashboard') {
          body.append(h('p', { class: 'small' }, 'Choose what appears on Discover, and in which order.'));
          O.tools.dashboard.forEach((w, i) => body.append(h('div', { class: 'list-row' }, h('div', { class: 'main' }, h('b', null, O.WIDGETS[w])),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { const d = O.tools.dashboard; [d[i - 1], d[i]] = [d[i], d[i - 1]]; O.saveTools(); draw(); } }, '↑'),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move down', disabled: i === O.tools.dashboard.length - 1, onclick: () => { const d = O.tools.dashboard; [d[i + 1], d[i]] = [d[i], d[i + 1]]; O.saveTools(); draw(); } }, '↓'),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Hide', onclick: () => { O.tools.dashboard.splice(i, 1); O.saveTools(); draw(); } }, O.icon('eye')))));
          const hidden = Object.keys(O.WIDGETS).filter(w => !O.tools.dashboard.includes(w));
          if (hidden.length) body.append(h('b', null, 'Hidden'), h('div', { class: 'chips' }, hidden.map(w => h('button', { class: 'chip', type: 'button', style: { '--c': 'var(--text2)' }, onclick: () => { O.tools.dashboard.push(w); O.saveTools(); draw(); } }, '+ ' + O.WIDGETS[w]))));
        } else {
          const status = h('div');
          body.append(h('div', { class: 'card stack' }, h('h3', null, O.icon('share'), 'Share your tools'),
            h('p', { class: 'small' }, 'Exports your automations, commands, panels, gesture choices and dashboard as one JSON file. No personal data is included.'),
            h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.share(new File([JSON.stringify(O.tools, null, 2)], 'OMNI Tools.json', { type: 'application/json' }), 'OMNI tools') }, O.icon('download'), 'Export'),
              h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => {
                const [f] = await O.pickFiles({ accept: 'application/json,.json' }); if (!f) return;
                try {
                  const b = JSON.parse(await f.text());
                  if (!Array.isArray(b.automations) || !Array.isArray(b.commands) || !Array.isArray(b.panels)) throw 0;
                  const fresh = x => Object.assign({}, x, { id: O.uid() });
                  O.tools.automations.push(...b.automations.map(a => Object.assign(fresh(a), { enabled: false })));
                  O.tools.commands.push(...b.commands.map(fresh)); O.tools.panels.push(...b.panels.map(fresh)); O.saveTools();
                  status.replaceChildren(O.outcome({ ok: true, message: `Imported ${b.automations.length} automations, ${b.commands.length} commands and ${b.panels.length} panels. Imported automations start switched off.` }));
                } catch (e) { status.replaceChildren(O.outcome({ ok: false, message: 'That file isn’t an OMNI tools export.' })); }
              } }, O.icon('upload'), 'Import')), status),
            h('div', { class: 'card stack' }, h('h3', null, O.icon('stack'), 'Starter kit'), h('p', { class: 'small' }, 'Adds the example panels, commands and automations again (automations stay off).'),
              h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { const s = O.starterTools(); O.tools.automations.push(...s.automations); O.tools.commands.push(...s.commands); O.tools.panels.push(...s.panels); O.saveTools(); O.toast('Starter kit added'); } }, 'Add starter kit')),
            h('div', { class: 'grid tiles' }, [['automations', 'automations'], ['commands', 'commands'], ['panels', 'panels']].map(([k, l]) => h('div', { class: 'card tight', style: { textAlign: 'center' } }, h('div', { class: 'num', style: { color: 'var(--cyan)' } }, O.tools[k].length), h('div', { class: 'muted' }, l))),
              h('div', { class: 'card tight', style: { textAlign: 'center' } }, h('div', { class: 'num', style: { color: 'var(--cyan)' } }, Object.values(O.tools.gestures).filter(g => g.enabled).length), h('div', { class: 'muted' }, 'gestures'))));
        }
      };
      root.append(...O.pageHead('workshop', 'Build your own tools', 'Teach OMNI new voice commands, design control panels, choose what each gesture does and arrange your dashboard. Everything you build can be exported and shared as a file.'),
        O.seg([['commands', 'Voice commands', 'voice'], ['panels', 'Control panels', 'all'], ['gestures', 'Gestures', 'hand'], ['dashboard', 'Dashboard', 'discover'], ['library', 'Library', 'stack']], tab, v => { tab = v; draw(); }), body);
      draw();
    },
  };
})();
