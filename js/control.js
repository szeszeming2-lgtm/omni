/* OMNI web — Control (Shortcuts launcher, panels, the Mac remote's honest status) and Devices (Apple Home through Shortcuts). */
'use strict';
(function () {
  const h = O.h;

  function shortcutList(key, { confirmRun = false, emptyText, placeholder }) {
    const wrap = h('div', { class: 'stack' });
    const draw = () => {
      const list = O.store.get(key, []);
      wrap.replaceChildren();
      if (!list.length) wrap.append(h('p', { class: 'small' }, emptyText));
      const grid = h('div', { class: 'grid tiles' });
      for (const name of list) {
        grid.append(h('div', { class: 'stack', style: { gap: '6px' } },
          h('button', { class: 'pad', type: 'button', style: { '--c': 'var(--violet)' }, 'data-shortcut': name, onclick: async () => {
            if (confirmRun && O.settings.confirmPhysical && !(await O.confirm({ title: `Run “${name}”?`, message: 'This Shortcut may change real devices in your home.', ok: 'Run', icon: '⌂' }))) return;
            const r = O.runShortcut(name); O.toast(r.message, r.ok);
          } }, O.icon('stack'), h('span', null, name)),
          h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--text3)' }, onclick: () => { O.store.set(key, O.store.get(key, []).filter(n => n !== name)); draw(); } }, 'Remove')));
      }
      if (list.length) wrap.append(grid);
      const input = h('input', { class: 'field', placeholder, id: key + 'Name' });
      const add = () => { const n = input.value.trim(); if (!n) return; const l = O.store.get(key, []); if (!l.includes(n)) l.push(n); O.store.set(key, l); input.value = ''; draw(); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
      wrap.append(h('div', { class: 'row nowrap' }, input, h('button', { class: 'btn ghost', type: 'button', onclick: add }, O.icon('plus'), 'Add')));
    };
    draw();
    return wrap;
  }

  O.pages.control = {
    render(root) {
      const appCard = h('div', { class: 'card tint stack', style: { '--t': 'var(--blue)' } },
        h('div', { class: 'row nowrap' }, O.badge('macbook', 'var(--blue)', 46, true), h('div', { class: 'grow' }, h('div', { class: 'title2' }, 'Mac remote'), h('p', { class: 'small' }, 'Slides, media, volume, apps, typing, trackpad and file transfer between your iPhone and Mac.'))),
        h('p', { class: 'small' }, 'Browsers aren’t allowed to press keys or change volume on another computer, so the encrypted Mac link lives in the native OMNI app. It installs from the OMNI project in Xcode on your Mac (free with your Apple ID), then pairs with a 6-digit code.'));
      const shortcuts = O.device.apple
        ? h('div', { class: 'card stack' }, h('h3', null, O.icon('stack'), 'Your Shortcuts'),
          h('p', { class: 'small' }, `Add any Shortcut by its exact name. Tapping it opens the Shortcuts app on this ${O.device.label} and runs it — Shortcuts can control your Mac, apps and Home.`),
          shortcutList('shortcuts', { emptyText: 'No Shortcuts added yet.', placeholder: 'Shortcut name, e.g. “Start my day”' }))
        : O.unavailable('stack', 'Shortcuts need an Apple device', 'Apple Shortcuts runs on iPhone, iPad and Mac.', 'Panels and voice work everywhere.');
      const panels = h('div', { class: 'stack' });
      for (const p of O.tools.panels) panels.append(h('div', { class: 'card stack' }, h('h3', null, O.icon(p.icon), p.name), O.panelGrid(p)));
      root.append(...O.pageHead('control', 'Shortcuts & panels', 'Run your Apple Shortcuts and your own control panels from one place. The full Mac remote is part of the OMNI app.'),
        shortcuts, h('div', { class: 'title2' }, 'Your panels'), panels,
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.go('workshop') }, O.icon('workshop'), 'Build a panel in Workshop'), appCard);
    },
  };

  O.pages.devices = {
    render(root) {
      root.append(...O.pageHead('devices', 'Your smart home', 'Control lights, plugs, scenes, speakers and TVs through Apple Shortcuts. OMNI always asks before running something that can change a real device.'),
        O.device.apple
          ? h('div', { class: 'card stack' }, h('h3', null, O.icon('home'), 'Home Shortcuts'),
            h('p', { class: 'small' }, 'In the Shortcuts app, make a Shortcut with the Home action (for example “Lights off” or “Movie night”), then add its name here. Matter devices added to Apple Home work too.'),
            shortcutList('homeShortcuts', { confirmRun: true, emptyText: 'No Home Shortcuts added yet.', placeholder: 'e.g. Lights off' }),
            h('p', { class: 'muted' }, 'A website can’t see whether a Shortcut worked — the Shortcuts app shows the result.'))
          : O.unavailable('home', 'Apple Home needs an Apple device', 'Open OMNI on your iPhone, iPad or Mac to run Home Shortcuts.'),
        O.unavailable('devices', 'Live device status is in the OMNI app', 'Seeing each light’s real state, dimming and adding accessories uses HomeKit, which only apps can reach.', 'The OMNI iPhone/iPad app shows every accessory and the real result of every change.'),
        h('div', { class: 'card stack' }, h('h3', null, O.icon('speaker'), 'Speakers & TVs'),
          h('p', { class: 'small' }, O.device.iOS ? 'Open Control Centre and tap AirPlay to send sound to a HomePod, AirPlay speaker or Apple TV.' : 'Use the AirPlay or Cast button in your system’s sound settings to choose a speaker or TV.')));
    },
  };
})();
