/* OMNI web — onboarding, start-up and offline support. */
'use strict';
(function () {
  const h = O.h;
  let page = 0;

  function onboarding() {
    const main = O.$('#main');
    O.$('#app').classList.add('onboarding');
    O.$('#sidebar').hidden = true; O.$('#dock').hidden = true;
    const root = h('div', { class: 'page', style: { maxWidth: '640px', minHeight: '100%', justifyContent: 'center' } });
    main.replaceChildren(root);
    const next = h('button', { class: 'btn primary', type: 'button', 'data-onboard-next': '' });
    const back = h('button', { class: 'btn ghost', type: 'button', style: { '--c': 'var(--text2)' }, onclick: () => { page--; draw(); } }, 'Back');
    const dots = h('div', { class: 'row', style: { gap: '6px' } });
    const content = h('div', { class: 'stack', style: { gap: '18px' } });
    const name = h('input', { class: 'field', placeholder: 'Your name (optional)', value: O.settings.userName, id: 'obName' });
    const phrase = h('input', { class: 'field', value: O.cap(O.settings.wakePhrase), id: 'obPhrase' });
    const draw = () => {
      dots.replaceChildren(...[0, 1, 2, 3].map(i => h('span', { style: { width: i === page ? '26px' : '8px', height: '8px', borderRadius: '4px', background: i === page ? 'var(--cyan)' : 'rgba(255,255,255,.25)', transition: 'width .3s' } })));
      back.hidden = page === 0;
      next.textContent = page === 3 ? 'Enter OMNI' : 'Continue';
      next.onclick = () => { if (page < 3) { page++; draw(); } else finish(); };
      content.replaceChildren();
      if (page === 0) {
        const orb = h('canvas', { style: { margin: '0 auto', display: 'block' } }); O.mountOrb(orb, { size: 210 });
        content.append(orb, h('h1', { style: { fontSize: '52px', letterSpacing: '.3em', textAlign: 'center', textShadow: '0 0 24px rgba(63,245,255,.5)' } }, 'OMNI'),
          h('p', { class: 'lede', style: { textAlign: 'center', margin: '0 auto' } }, 'Your phone, tablet and computer — seeing, listening and acting for you. Vision, voice, gestures, motion and scanning, right in your browser.'));
      } else if (page === 1) {
        const items = [['vision', 'Vision', 'Reads codes, objects and text live'], ['voice', 'Voice', 'Say “OMNI” and give a command'], ['gesture', 'Gesture', 'Swipe the air, open your palm to talk'],
          ['spatial', 'Spatial', 'Compass, level, tilt and shake'], ['scanner', 'Scanner', 'Flatten pages, read them, export PDF'], ['automation', 'Automation', 'When → If → Then, built visually'],
          ['workshop', 'Workshop', 'Your own commands and panels'], ['control', 'Shortcuts', 'Run Apple Shortcuts and Home scenes']];
        content.append(h('div', { class: 'eyebrow' }, 'One system'), h('h1', null, 'Everything connects'),
          h('div', { class: 'grid', style: { '--min': '240px', gap: '10px' } }, items.map(([ic, t, d]) => h('div', { class: 'card tight row nowrap' }, O.badge(ic, 'var(--cyan)', 36), h('div', null, h('b', null, t), h('div', { class: 'muted' }, d))))));
      } else if (page === 2) {
        content.append(O.badge('shield', 'var(--mint)', 56, true), h('div', { class: 'eyebrow', style: { color: 'var(--mint)' } }, 'Private by design'), h('h1', null, 'Your world stays yours'),
          h('div', { class: 'card stack' }, ...[['camera', 'Camera frames are analysed inside your browser and never uploaded.'], ['mic', 'The microphone is only on while you have Voice switched on.'],
            ['lock', 'No account, no API keys, no subscription, no tracking.'], ['folder', 'Scans, notes and tools are stored only on this device.'], ['home', 'Anything that can change a real device asks you first.']]
            .map(([ic, t]) => h('div', { class: 'row nowrap' }, h('span', { style: { color: 'var(--mint)' } }, O.icon(ic)), h('span', { class: 'small', style: { color: 'var(--text)' } }, t)))));
      } else {
        content.append(h('div', { class: 'eyebrow' }, 'Make it yours'), h('h1', null, 'Almost ready'),
          h('div', { class: 'card stack' }, h('label', { class: 'lbl', for: 'obName' }, 'What should OMNI call you?'), name, h('label', { class: 'lbl', for: 'obPhrase' }, 'Activation phrase'), phrase),
          O.device.iOS && !O.device.standalone ? h('div', { class: 'card tint row nowrap', style: { '--t': 'var(--blue)' } }, O.icon('share'), h('p', { class: 'small', style: { color: 'var(--text)' } }, 'Tip: tap Share › Add to Home Screen. OMNI then opens full-screen and works offline.')) : null);
      }
    };
    const finish = () => {
      O.setSetting('userName', name.value.trim());
      O.setSetting('wakePhrase', phrase.value.trim().toLowerCase() || 'omni');
      O.setSetting('onboarded', true);
      O.log.add('Welcome to OMNI', '', 'success', 'sparkle');
      O.$('#app').classList.remove('onboarding');
      O.$('#sidebar').hidden = false; O.$('#dock').hidden = false;
      O.go('discover');
    };
    root.append(content, h('div', { class: 'spread' }, dots, h('div', { class: 'row' }, back, next)));
    draw();
  }

  O.boot = function () {
    if (!O.settings.onboarded) { page = 0; return onboarding(); }
    O.$('#sidebar').hidden = false; O.$('#dock').hidden = false;
    const want = (location.hash || '').slice(1) || new URLSearchParams(location.search).get('open') || 'discover';
    O.go(O.pages[want] ? want : 'discover');
  };

  addEventListener('hashchange', () => { const id = location.hash.slice(1); if (O.settings.onboarded && O.pages[id] && id !== O.current) O.go(id, { push: false }); });
  addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || !O.settings.onboarded) return;
    const i = '1234567890'.indexOf(e.key);
    if (i >= 0 && O.sections[i]) { e.preventDefault(); O.go(O.sections[i].id); }
  });

  // Start-up
  O.mountOrb(O.$('.brand .orb'), { size: 34 });
  if (new URLSearchParams(location.search).has('skipOnboarding')) O.setSetting('onboarded', true);
  O.timers.run();
  O.log.add('OMNI online', O.device.label + (O.device.standalone ? ' · installed' : ''), 'info', 'sparkle');
  O.boot();
  O.event({ type: 'launch' });
  O.bus.on('settings', k => { if (k === 'wakePhrase' || k === 'onboarded') O.renderNav(); });

  // Offline: cache the app and, after first use, the downloaded engines.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || new URLSearchParams(location.search).has('sw'))) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
