/* OMNI web — Settings and permissions. */
'use strict';
(function () {
  const h = O.h;
  const group = (title, icon, ...kids) => h('div', { class: 'card stack' }, h('h3', { style: { color: 'var(--cyan)' } }, O.icon(icon), title), ...kids);
  const slider = (label, key, min, max, step, fmt) => {
    const out = h('span', { class: 'mono small', style: { width: '60px', textAlign: 'right' } }, fmt(O.settings[key]));
    return h('div', { class: 'row nowrap' }, h('span', { style: { width: '120px', flex: 'none' } }, label),
      h('input', { type: 'range', min, max, step, value: O.settings[key], id: 's-' + key, oninput: e => { O.setSetting(key, +e.target.value); out.textContent = fmt(+e.target.value); } }), out);
  };

  O.pages.settings = {
    render(root) {
      const S = O.settings;
      const name = h('input', { class: 'field', value: S.userName, placeholder: 'Your name', id: 'sName', onchange: e => O.setSetting('userName', e.target.value.trim()) });
      const wake = h('input', { class: 'field', value: S.wakePhrase, id: 'sWake', style: { maxWidth: '200px' }, onchange: e => O.setSetting('wakePhrase', e.target.value.trim().toLowerCase() || 'omni') });
      const voiceSel = h('select', { class: 'field', id: 'sVoice', onchange: e => O.setSetting('voiceURI', e.target.value) });
      const fillVoices = () => voiceSel.replaceChildren(h('option', { value: '' }, 'Automatic (best available)'), ...O.voices().map(v => h('option', { value: v.voiceURI, selected: v.voiceURI === S.voiceURI }, v.name + (v.localService ? '' : ' (online)'))));
      fillVoices();
      const perms = h('div', { class: 'stack' });
      const drawPerms = async () => {
        const rows = [];
        for (const n of ['camera', 'microphone', 'motion', 'notifications', 'shortcuts']) {
          const st = await O.permState(n), [label, color] = O.stateLabel(st), info = O.NEED[n];
          const action = n === 'notifications' && st === 'ask' ? h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await O.notify.ask(); drawPerms(); } }, 'Allow')
            : n === 'motion' && st === 'ask' ? h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await O.motion.enable(); drawPerms(); } }, 'Allow') : null;
          rows.push(h('div', { class: 'list-row', style: { alignItems: 'flex-start' } }, O.badge(info[0], color, 32), h('div', { class: 'main' }, h('div', { class: 'spread' }, h('b', null, info[1]), h('span', { class: 'small', style: { color } }, label)),
            h('span', { style: { whiteSpace: 'normal' } }, info[2]), action)));
        }
        perms.replaceChildren(...rows, h('p', { class: 'muted' }, O.device.iOS ? 'To change a permission later: Settings app › Safari › Camera / Microphone / Motion & Orientation Access, or aA › Website Settings.' : 'To change a permission later, use the site settings in your browser’s address bar.'));
      };
      drawPerms();

      root.append(...O.pageHead('settings', 'Preferences & privacy', 'Everything OMNI does is listed here, with exactly which permissions it uses and why.'),
        group('Profile', 'person', name),
        group('Voice', 'voice',
          O.toggle('Listen for the activation phrase', 'Only while this page is open and Voice is on', S.wakeOn, v => O.setSetting('wakeOn', v)),
          h('div', { class: 'spread' }, h('span', null, 'Activation phrase'), wake),
          O.toggle('Spoken replies', null, S.spoken, v => O.setSetting('spoken', v)),
          h('label', { class: 'lbl', for: 'sVoice' }, 'Voice'), voiceSel,
          slider('Speed', 'rate', .6, 1.4, .05, v => v.toFixed(2) + '×'),
          h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', type: 'button', onclick: () => O.speak(`Hello${O.settings.userName ? ', ' + O.settings.userName : ''}. OMNI is online.`) }, O.icon('speaker'), 'Test voice'))),
        group('Safety', 'shield',
          O.toggle('Confirm before running Home Shortcuts', 'They can change real devices', S.confirmPhysical, v => O.setSetting('confirmPhysical', v)),
          O.toggle('Haptics', 'Light taps on supported phones', S.haptics, v => O.setSetting('haptics', v))),
        group('Gestures & motion', 'hand',
          slider('Gesture sensitivity', 'sensitivity', 0, 1, .05, v => Math.round(v * 100) + '%'),
          slider('Repeat delay', 'cooldown', .4, 3, .1, v => v.toFixed(1) + ' s'),
          slider('Tilt angle', 'tiltDeg', 15, 50, 1, v => Math.round(v) + '°'),
          h('div', { class: 'spread' }, h('span', { class: 'small' }, S.calib.at ? 'Calibrated ' + new Date(S.calib.at).toLocaleString() : 'Using default hand calibration'),
            h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { O.setSetting('calib', { extendRatio: 1.45, pinchRatio: .3, at: null }); O.go('settings'); } }, 'Reset'))),
        group('Online extras', 'globe',
          O.toggle('Look up product barcodes online', 'Optional. Sends only the barcode number to the free Open Food Facts database. Off by default.', S.onlineLookups, v => O.setSetting('onlineLookups', v))),
        group('Permissions', 'lock', h('p', { class: 'muted' }, 'OMNI asks for each one only when you first use the feature that needs it.'), perms),
        group('Your data', 'folder',
          h('p', { class: 'small' }, 'Scans, notes, timers and tools are stored only in this browser on this device. Nothing is uploaded, and there’s no account.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--danger)' }, onclick: async () => { if (await O.confirm({ title: 'Delete every scan?', message: 'This can’t be undone.', ok: 'Delete scans', danger: true })) { await O.db.clear(); O.toast('Scans deleted'); } } }, 'Delete all scans'),
            h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--danger)' }, onclick: async () => { if (await O.confirm({ title: 'Delete every note?', message: 'This can’t be undone.', ok: 'Delete notes', danger: true })) { O.notes.list = []; O.store.set('notes', []); O.toast('Notes deleted'); } } }, 'Delete all notes'),
            h('button', { class: 'btn ghost sm', type: 'button', style: { '--c': 'var(--text2)' }, onclick: () => { O.setSetting('onboarded', false); O.boot(); } }, 'Show welcome again'))),
        group('About', 'info',
          h('p', { class: 'small' }, `OMNI web · ${O.device.label}${O.device.standalone ? ' · installed' : ''}. Vision, gestures and text reading run in your browser with Google’s MediaPipe and Tesseract (downloaded once, then cached for offline use). Speech uses your browser’s own recogniser. No accounts, no API keys, no tracking.`),
          h('p', { class: 'small' }, 'The native OMNI app for iPhone, iPad and Mac adds the encrypted Mac remote, Apple Home control, AR notes and measuring.'),
          h('a', { class: 'btn ghost sm', href: 'https://github.com/szeszeming2-lgtm/omni#readme', target: '_blank', rel: 'noopener' }, 'Web app source')));
      this.off = O.bus.on('voices', fillVoices);
    },
    leave() { this.off?.(); },
  };
})();
