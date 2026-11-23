/* OMNI web — visual When → If → Then builder. */
'use strict';
(function () {
  const h = O.h;
  const COLORS = ['var(--cyan)', 'var(--blue)', 'var(--violet)', 'var(--mint)', 'var(--amber)', 'var(--danger)'];
  const ICONS = ['bolt', 'sparkle', 'mic', 'timer', 'wifi', 'hand', 'gyro', 'home', 'note', 'star', 'camera', 'qr'];

  const flow = (tag, color, icon, text) => h('div', { class: 'flow' }, h('span', { class: 'tag', style: { '--c': color } }, tag), O.icon(icon), h('span', { style: { flex: 1, minWidth: 0 } }, text));
  const trigIcon = t => ({ manual: 'bolt', voice: 'voice', gesture: 'hand', motion: 'gyro', time: 'timer', scanned: 'qr', launch: 'sparkle' }[t.k] || 'bolt');

  async function requirements(a) {
    const needs = [...new Set([...O.triggerNeeds(a.trigger), ...a.steps.flatMap(s => O.actionInfo(s).need)])];
    const rows = [];
    for (const n of needs) {
      const st = await O.permState(n), [label, color] = O.stateLabel(st), info = O.NEED[n];
      rows.push(h('div', { class: 'list-row' }, O.badge(info[0], color, 32), h('div', { class: 'main' }, h('b', null, info[1]), h('span', { style: { whiteSpace: 'normal' } }, info[2])), h('span', { class: 'small', style: { color } }, label)));
    }
    return rows;
  }

  async function enableFlow(a, done) {
    const rows = await requirements(a);
    const note = { voice: 'Voice triggers work while Voice is listening.', gesture: 'Gesture triggers work while Gesture is armed.', motion: 'Motion triggers work after you turn on motion sensors in Spatial.', time: 'Runs at that time while OMNI is open.' }[a.trigger.k] || 'Runs while OMNI is open.';
    O.sheet.open(`Turn on “${a.name}”?`, body => {
      body.append(h('p', { class: 'small' }, note), ...(rows.length ? rows : [h('p', { class: 'small', style: { color: 'var(--mint)' } }, '✓ Nothing extra is needed.')]),
        h('p', { class: 'muted' }, 'If a permission is missing, the step that needs it reports that it couldn’t run — OMNI never pretends it worked.'),
        h('button', { class: 'btn primary', type: 'button', 'data-confirm-enable': '', onclick: () => { a.enabled = true; O.saveTools(); O.sheet.close(); done(); } }, 'Turn on'));
    });
  }

  function editor(root, a, back) {
    a = JSON.parse(JSON.stringify(a));
    root.replaceChildren();
    const name = h('input', { class: 'field', value: a.name, id: 'autoName', oninput: e => a.name = e.target.value });
    const trig = h('div', { class: 'stack' }), conds = h('div', { class: 'stack' }), reqs = h('div', { class: 'stack' });
    const stage = (tag, title, color, content, last) => h('div', { style: { display: 'flex', gap: '14px' } },
      h('div', { style: { width: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' } }, h('span', { style: { width: '14px', height: '14px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, marginTop: '20px' } }),
        last ? null : h('span', { style: { width: '2px', flex: 1, background: `linear-gradient(${color}, transparent)` } })),
      h('div', { class: 'card tint stack', style: { '--t': color, flex: 1, marginBottom: last ? 0 : '14px' } }, h('div', { class: 'row' }, h('span', { class: 'tag', style: { '--c': color } }, tag), h('b', null, title)), content));

    const drawTrig = () => {
      const sel = h('select', { class: 'field', id: 'trigKind' }, [['manual', 'When I tap Run'], ['voice', 'When I say a phrase'], ['gesture', 'When I make a gesture'], ['motion', 'When I move the device'], ['time', 'At a time of day'], ['scanned', 'When I scan a code'], ['launch', 'When OMNI opens']]
        .map(([v, l]) => h('option', { value: v, selected: a.trigger.k === v }, l)));
      const extra = h('div', { class: 'stack' });
      const drawExtra = () => {
        extra.replaceChildren();
        const t = a.trigger;
        if (t.k === 'voice') extra.append(h('input', { class: 'field', placeholder: 'e.g. good night', value: t.phrase || '', oninput: e => { t.phrase = e.target.value; refresh(); } }));
        if (t.k === 'gesture') extra.append(h('select', { class: 'field', onchange: e => { t.g = e.target.value; refresh(); } }, Object.entries(O.GESTURES).map(([k, v]) => h('option', { value: k, selected: t.g === k }, v.join(' ')))));
        if (t.k === 'motion') extra.append(h('select', { class: 'field', onchange: e => { t.ev = e.target.value; refresh(); } }, Object.entries(O.MOTIONS).map(([k, v]) => h('option', { value: k, selected: t.ev === k }, v))));
        if (t.k === 'time') extra.append(h('input', { class: 'field', type: 'time', value: `${String(t.hh ?? 8).padStart(2, '0')}:${String(t.mm ?? 0).padStart(2, '0')}`, onchange: e => { const [hh, mm] = e.target.value.split(':').map(Number); t.hh = hh; t.mm = mm; refresh(); } }));
        if (t.k === 'scanned') extra.append(h('input', { class: 'field', placeholder: 'Contains (leave empty for any code)', value: t.contains || '', oninput: e => { t.contains = e.target.value; refresh(); } }));
      };
      sel.onchange = () => { const k = sel.value; a.trigger = { k, phrase: '', g: 'thumbsUp', ev: 'shake', hh: 8, mm: 0, contains: '' }; drawExtra(); refresh(); };
      trig.replaceChildren(sel, extra); drawExtra();
    };
    const drawConds = () => {
      conds.replaceChildren();
      if (!a.conditions.length) conds.append(h('p', { class: 'muted' }, 'Always run when triggered.'));
      a.conditions.forEach((c, i) => conds.append(h('div', { class: 'list-row' }, O.icon('info'), h('div', { class: 'main' }, h('b', null, O.conditionTitle(c))), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove condition', onclick: () => { a.conditions.splice(i, 1); drawConds(); } }, O.icon('x')))));
      const from = h('input', { class: 'field', type: 'time', value: '09:00' }), to = h('input', { class: 'field', type: 'time', value: '17:00' });
      const days = new Set([1, 2, 3, 4, 5]);
      const dayRow = h('div', { class: 'row' }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, d) => {
        const b = h('button', { class: 'chip', type: 'button', style: { '--c': days.has(d) ? 'var(--violet)' : 'var(--text3)' }, onclick: () => { days.has(d) ? days.delete(d) : days.add(d); b.style.setProperty('--c', days.has(d) ? 'var(--violet)' : 'var(--text3)'); } }, l);
        return b;
      }));
      const add = h('details', null, h('summary', { class: 'btn ghost sm', style: { '--c': 'var(--violet)', listStyle: 'none', display: 'inline-flex' } }, '+ Add condition'),
        h('div', { class: 'stack', style: { marginTop: '10px' } },
          h('div', { class: 'row nowrap' }, from, to, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { a.conditions.push({ id: O.uid(), k: 'between', from: from.value, to: to.value }); drawConds(); } }, 'Add time')),
          h('div', { class: 'row' }, dayRow, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { if (days.size) { a.conditions.push({ id: O.uid(), k: 'weekdays', days: [...days] }); drawConds(); } } }, 'Add days')),
          h('div', { class: 'row' }, ['iPhone', 'iPad', 'Mac'].map(dv => h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { a.conditions.push({ id: O.uid(), k: 'device', device: dv }); drawConds(); } }, 'Only on ' + dv)),
            h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { a.conditions.push({ id: O.uid(), k: 'online', on: true }); drawConds(); } }, 'When online'))));
      conds.append(add);
    };
    const refresh = async () => { reqs.replaceChildren(h('b', null, 'This automation needs'), ...(await requirements(a)).concat(O.triggerNeeds(a.trigger).length || a.steps.length ? [] : [])); if (reqs.children.length === 1) reqs.append(h('p', { class: 'muted' }, 'No special permissions.')); };
    const iconRow = h('div', { class: 'row' }, ICONS.map(ic => h('button', { class: 'icon-btn', type: 'button', style: { color: a.icon === ic ? 'var(--black)' : 'var(--text2)', background: a.icon === ic ? 'var(--cyan)' : '' }, onclick: e => { a.icon = ic; iconRow.querySelectorAll('button').forEach(b => { b.style.background = ''; b.style.color = 'var(--text2)'; }); e.currentTarget.style.background = 'var(--cyan)'; e.currentTarget.style.color = 'var(--black)'; } }, O.icon(ic))));
    const colorRow = h('div', { class: 'row' }, COLORS.map(c => h('button', { type: 'button', 'aria-label': 'Colour', style: { width: '28px', height: '28px', borderRadius: '50%', border: a.color === c ? '3px solid #fff' : '0', background: c }, onclick: e => { a.color = c; colorRow.querySelectorAll('button').forEach(b => b.style.border = '0'); e.currentTarget.style.border = '3px solid #fff'; } })));
    drawTrig(); drawConds(); refresh();
    root.append(
      h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: back }, '← All automations')),
      h('div', { class: 'row nowrap' }, O.badge(a.icon, a.color, 48, true), name),
      h('details', null, h('summary', { class: 'muted', style: { cursor: 'pointer' } }, 'Icon & colour'), h('div', { class: 'stack', style: { marginTop: '10px' } }, iconRow, colorRow)),
      h('div', null,
        stage('WHEN', 'Trigger', 'var(--cyan)', trig),
        stage('IF', 'Conditions (optional)', 'var(--violet)', conds),
        stage('THEN', 'Actions, in order', 'var(--mint)', O.stepsEditor(a.steps, refresh), true)),
      h('div', { class: 'card stack' }, reqs),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', 'data-save-automation': '', onclick: () => {
        if (!a.name.trim()) return O.toast('Give it a name first', false);
        if (!a.steps.length) return O.toast('Add at least one action', false);
        const i = O.tools.automations.findIndex(x => x.id === a.id);
        if (i >= 0) O.tools.automations[i] = a; else O.tools.automations.push(a);
        O.saveTools(); O.toast('Saved'); back();
      } }, O.icon('check'), 'Save'), h('button', { class: 'btn ghost', type: 'button', onclick: async () => { const r = await O.runAutomation(a, 'Test', true); O.toast(r.message, r.ok); } }, O.icon('play'), 'Test now')));
  }

  const TEMPLATES = () => [
    { name: 'Thumbs up = reply', icon: 'hand', color: 'var(--cyan)', trigger: { k: 'gesture', g: 'thumbsUp' }, conditions: [], steps: [{ id: O.uid(), t: 'speak', text: 'Thumbs up received.' }] },
    { name: 'Good night', icon: 'home', color: 'var(--violet)', trigger: { k: 'voice', phrase: 'good night' }, conditions: [], steps: [{ id: O.uid(), t: 'shortcut', name: 'Good night' }, { id: O.uid(), t: 'speak', text: 'Good night.' }] },
    { name: 'Face down, timer off', icon: 'gyro', color: 'var(--amber)', trigger: { k: 'motion', ev: 'faceDown' }, conditions: [], steps: [{ id: O.uid(), t: 'hush' }] },
    { name: 'Evening wind-down', icon: 'timer', color: 'var(--mint)', trigger: { k: 'time', hh: 22, mm: 0 }, conditions: [], steps: [{ id: O.uid(), t: 'notify', title: 'Wind down', body: 'Time to start winding down.' }] },
    { name: 'Website code opener', icon: 'qr', color: 'var(--blue)', trigger: { k: 'scanned', contains: 'https://' }, conditions: [], steps: [{ id: O.uid(), t: 'speak', text: 'That code is a website link. Tap Open to visit it.' }] },
  ];

  O.pages.automation = {
    render(root) {
      const list = () => {
        root.replaceChildren(...O.pageHead('automation', 'When → If → Then', 'Build routines visually. A trigger starts it, conditions decide whether it runs, and actions do the work. Automations run while OMNI is open, and nothing switches on until you’ve seen what it needs.',
          h('button', { class: 'btn primary', type: 'button', 'data-new-automation': '', onclick: () => editor(root, { id: O.uid(), name: 'New automation', icon: 'bolt', color: 'var(--cyan)', enabled: false, trigger: { k: 'manual' }, conditions: [], steps: [], runs: 0 }, list) }, O.icon('plus'), 'New')));
        const grid = h('div', { class: 'grid', style: { '--min': '320px' } });
        if (!O.tools.automations.length) grid.append(h('div', { class: 'card' }, O.empty('automation', 'No automations', 'Create one, or start from a template below.')));
        for (const a of O.tools.automations) {
          const sw = h('input', { type: 'checkbox', class: 'sw', checked: a.enabled, 'aria-label': 'Enabled', onchange: e => { if (e.target.checked) { e.target.checked = false; enableFlow(a, list); } else { a.enabled = false; O.saveTools(); list(); } } });
          grid.append(h('div', { class: 'card stack', style: a.enabled ? { boxShadow: `0 0 0 1px ${a.color}` } : null, 'data-automation': a.name },
            h('div', { class: 'row nowrap' }, O.badge(a.icon, a.color, 40, a.enabled), h('div', { class: 'grow' }, h('div', { class: 'headline' }, a.name), h('div', { class: 'muted' }, a.last ? `Ran ${new Date(a.last).toLocaleString()} · ${a.runs}×` : 'Never run')), sw),
            flow('WHEN', 'var(--cyan)', trigIcon(a.trigger), O.triggerTitle(a.trigger)),
            a.conditions.length ? flow('IF', 'var(--violet)', 'info', a.conditions.map(O.conditionTitle).join(' · ')) : null,
            flow('THEN', 'var(--mint)', 'bolt', a.steps.map(s => O.actionInfo(s).title).join(' → ') || 'No actions'),
            h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { const r = await O.runAutomation(a, 'Manual', true); O.toast(r.message, r.ok); list(); } }, 'Run now'),
              h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--text2)' }, onclick: () => editor(root, a, list) }, 'Edit'),
              h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete', style: { marginLeft: 'auto' }, onclick: async () => { if (await O.confirm({ title: `Delete “${a.name}”?`, ok: 'Delete', danger: true })) { O.tools.automations = O.tools.automations.filter(x => x.id !== a.id); O.saveTools(); list(); } } }, O.icon('trash')))));
        }
        root.append(grid, h('div', { class: 'title2' }, 'Templates'), h('div', { class: 'grid', style: { '--min': '240px', gap: '10px' } }, TEMPLATES().map(t =>
          h('button', { class: 'card tight', type: 'button', style: { textAlign: 'left', color: 'var(--text)', border: 0 }, onclick: () => editor(root, Object.assign({ id: O.uid(), enabled: false, runs: 0 }, t), list) },
            h('div', { class: 'row nowrap' }, O.badge(t.icon, t.color, 36), h('div', { class: 'grow' }, h('b', null, t.name), h('div', { class: 'muted' }, O.triggerTitle(t.trigger))), O.icon('plus'))))));
      };
      list();
    },
  };
})();
