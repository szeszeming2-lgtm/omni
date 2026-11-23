/* OMNI web — turns natural phrases into intents, entirely in the browser (port of the app's CommandParser). */
'use strict';
(function () {
  const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

  function words(text) {
    const lowered = String(text).toLowerCase().replace(/’/g, "'").replace(/%/g, ' percent');
    return lowered.replace(/[^\p{L}\p{N}'.]+/gu, ' ').split(' ').map(w => w.replace(/^[.']+|[.']+$/g, '')).filter(Boolean);
  }

  function normalise(text) {
    let joined = ' ' + words(text).join(' ') + ' ';
    const specials = [[' an hour and a half ', ' 90 minutes '], [' one and a half hours ', ' 90 minutes '], [' half an hour ', ' 30 minutes '],
      [' half a minute ', ' 30 seconds '], [' a quarter of an hour ', ' 15 minutes '], [' quarter of an hour ', ' 15 minutes '],
      [' a couple of minutes ', ' 2 minutes '], [' a couple minutes ', ' 2 minutes '], [' one hundred ', ' 100 '], [' a hundred ', ' 100 ']];
    for (const [a, b] of specials) joined = joined.split(a).join(b);
    const w = joined.trim().split(/\s+/).filter(Boolean), out = [];
    for (let i = 0; i < w.length; i++) {
      const t = w[i];
      if (TENS[t] != null) {
        const u = UNITS[w[i + 1]];
        if (u > 0 && u < 10) { out.push(String(TENS[t] + u)); i++; continue; }
        out.push(String(TENS[t])); continue;
      }
      if (UNITS[t] != null) { out.push(String(UNITS[t])); continue; }
      if ((t === 'a' || t === 'an') && ['second', 'minute', 'hour'].includes(w[i + 1])) { out.push('1'); continue; }
      out.push(t);
    }
    return out.join(' ');
  }

  function duration(text) {
    const w = text.split(' ');
    let total = 0, found = false;
    for (let i = 0; i < w.length - 1; i++) {
      const n = parseFloat(w[i]); if (isNaN(n)) continue;
      const u = w[i + 1];
      if (u.startsWith('hour') || u === 'hr' || u === 'hrs' || u === 'h') { total += n * 3600; found = true; }
      else if (u.startsWith('min') || u === 'm') { total += n * 60; found = true; }
      else if (u.startsWith('sec') || u === 's') { total += n; found = true; }
    }
    return found && total > 0 ? Math.round(total) : null;
  }

  const FILLERS = [['hey'], ['ok'], ['okay'], ['please'], ['can', 'you'], ['could', 'you'], ['would', 'you'], ['will', 'you'],
    ['i', 'want', 'you', 'to'], ["i'd", 'like', 'you', 'to'], ['i', 'need', 'you', 'to'], ['go', 'ahead', 'and'], ['just']];
  function stripFillers(text) {
    let w = text.split(' ').filter(Boolean), changed = true;
    while (changed) {
      changed = false;
      for (const f of FILLERS) if (w.length > f.length && f.every((x, i) => w[i] === x)) { w = w.slice(f.length); changed = true; }
      if (w[w.length - 1] === 'please') { w.pop(); changed = true; }
    }
    return w.join(' ');
  }

  function wakeVariants(phrase) {
    const base = words(phrase);
    if (!base.length) return [];
    const list = [base];
    if (base.join(' ') === 'omni') list.push(['omnie'], ['omny'], ['omnee'], ['omani'], ['ahmni'], ['omnia'], ['om', 'nee'], ['on', 'knee'], ['aumni']);
    return list;
  }
  /** Words after the last activation phrase, '' if it was said alone, null if it wasn't said. */
  function afterWake(transcript, phrase) {
    const w = words(transcript);
    let best = null;
    for (const v of wakeVariants(phrase)) {
      for (let i = w.length - v.length; i >= 0; i--) {
        if (v.every((x, j) => w[i + j] === x)) { const end = i + v.length; if (best == null || end > best) best = end; break; }
      }
    }
    return best == null ? null : w.slice(best).join(' ');
  }

  const capFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  function bestName(spoken, names) {
    const s = spoken.toLowerCase().trim();
    if (!s) return null;
    const exact = names.find(n => n.toLowerCase() === s); if (exact) return exact;
    const contains = names.find(n => n.toLowerCase().includes(s) || s.includes(n.toLowerCase())); if (contains) return contains;
    const sw = new Set(words(s)); let best = null, score = 0;
    for (const n of names) { const o = words(n).filter(x => sw.has(x)).length; if (o > score) { best = n; score = o; } }
    return best;
  }

  function timerLabel(text) {
    const m = text.match(/ (?:called|named|labell?ed) (.+)$/); if (m) return capFirst(m[1]);
    const w = text.split(' '), i = w.indexOf('timer');
    if (i > 0) {
      const skip = new Set(['set', 'a', 'an', 'the', 'start', 'make', 'create', 'new', 'my', 'for', 'minute', 'minutes', 'second', 'seconds', 'hour', 'hours']);
      const kept = w.slice(0, i).filter(x => !skip.has(x) && isNaN(parseFloat(x)));
      if (kept.length) return capFirst(kept.join(' '));
    }
    const f = text.match(/ for (.+)$/);
    if (f && duration(f[1]) == null) return capFirst(f[1]);
    return '';
  }

  /** Safe arithmetic for "what is 12 times 4" (numbers and + − × ÷ only). */
  function calc(text) {
    let t = text.replace(/^(what's|whats|what is|calculate|compute|how much is)\s+/, '');
    if (!/\d/.test(t)) return null;
    t = t.replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\b(times|multiplied by|x)\b/g, '*').replace(/\b(divided by|over)\b/g, '/').replace(/\s+/g, '');
    const pct = t.match(/^(\d+(?:\.\d+)?)percentof(\d+(?:\.\d+)?)$/);
    if (pct) return { expr: `${pct[1]}% of ${pct[2]}`, value: (+pct[1] / 100) * +pct[2] };
    if (!/^[\d.+\-*/()]+$/.test(t) || !/[+\-*/]/.test(t)) return null;
    let i = 0;
    const num = () => { const m = t.slice(i).match(/^\d+(\.\d+)?/); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); };
    const factor = () => { if (t[i] === '(') { i++; const v = expr(); if (t[i++] !== ')') throw 0; return v; } if (t[i] === '-') { i++; return -factor(); } return num(); };
    const term = () => { let v = factor(); while (t[i] === '*' || t[i] === '/') { const op = t[i++]; const r = factor(); v = op === '*' ? v * r : v / r; } return v; };
    const expr = () => { let v = term(); while (t[i] === '+' || t[i] === '-') { const op = t[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
    try { const v = expr(); if (i !== t.length || !isFinite(v)) return null; return { expr: text.replace(/^(what's|whats|what is|calculate|compute|how much is)\s+/, ''), value: v }; } catch (e) { return null; }
  }

  const SECTION_ALIASES = { home: 'discover', dashboard: 'discover', discover: 'discover', camera: 'vision', vision: 'vision', voice: 'voice', gestures: 'gesture', gesture: 'gesture',
    control: 'control', remote: 'control', shortcuts: 'control', devices: 'devices', 'smart home': 'devices', spatial: 'spatial', motion: 'spatial', compass: 'spatial', level: 'spatial',
    scanner: 'scanner', scan: 'scanner', documents: 'scanner', automation: 'automation', automations: 'automation', workshop: 'workshop', settings: 'settings', preferences: 'settings' };

  /**
   * ctx: { commands: [{id, phrases, enabled}], automationTriggers: [{phrase, name}], automationNames: [] }
   * returns { kind, ...fields }
   */
  function parse(raw, ctx = {}) {
    const text = stripFillers(normalise(raw));
    if (!text) return { kind: 'unknown', raw };
    const has = s => (' ' + text + ' ').includes(' ' + s + ' ');
    const starts = s => text === s || text.startsWith(s + ' ');
    const after = prefixes => {
      for (const p of prefixes.slice().sort((a, b) => b.length - a.length)) if (starts(p)) { const rest = text.slice(p.length).trim(); if (rest) return rest; }
      return null;
    };

    for (const c of ctx.commands || []) {
      if (c.enabled === false) continue;
      for (const p of c.phrases || []) {
        const np = stripFillers(normalise(p));
        if (np && (text === np || text.startsWith(np + ' ') || (np.split(' ').length >= 2 && text.includes(np)))) return { kind: 'custom', id: c.id };
      }
    }
    for (const t of ctx.automationTriggers || []) {
      const np = normalise(t.phrase);
      if (np && (text === np || text.includes(np))) return { kind: 'automation', name: t.name };
    }

    if (['stop', 'cancel', 'never mind', 'nevermind', 'stop listening', "that's all", 'thats all', 'go to sleep', 'goodbye', 'bye', 'nothing'].includes(text)) return { kind: 'stop' };

    if ((has('timer') || has('timers')) && ['cancel', 'stop', 'delete', 'clear', 'remove', 'end'].some(starts)) return { kind: 'cancelTimers' };
    if (['time left', 'time is left', 'timer status', 'how long left', 'how much longer'].some(s => text.includes(s))) return { kind: 'timerStatus' };
    if ((starts('remind me in') || starts('remind me after')) && duration(text)) {
      const m = text.match(/ (?:to|that) (.+)$/);
      return { kind: 'timer', seconds: duration(text), label: m ? capFirst(m[1]) : 'Reminder' };
    }
    if ((has('timer') || starts('countdown') || starts('count down') || starts('wake me in') || starts('alert me in')) && duration(text)) return { kind: 'timer', seconds: duration(text), label: timerLabel(text) };

    if (['read my notes', 'read notes', 'what are my notes', 'show my notes', 'list my notes', 'list notes', 'my notes', 'read me my notes'].includes(text)) return { kind: 'readNotes' };
    const note = after(['take a note that', 'take a note', 'make a note that', 'make a note', 'note that', 'add a note', 'add note', 'write down', 'jot down', 'remember that', 'remember', 'note']);
    if (note) return { kind: 'note', text: capFirst(note) };

    if (['what time is it', "what's the time", 'whats the time', 'time', 'tell me the time', 'what is the time', 'current time'].includes(text)) return { kind: 'time' };
    if (["what's the date", 'whats the date', 'what is the date', 'what day is it', "today's date", 'todays date', 'date', 'what is today', "what's today"].includes(text)) return { kind: 'date' };
    if (['help', 'what can you do', 'what can i say', 'commands', 'show commands', 'what do you do', 'how do you work'].includes(text)) return { kind: 'help' };
    if (['hello', 'hi', 'hi there', 'hello there', 'good morning', 'good afternoon', 'good evening', 'are you there', 'you there', 'omni'].includes(text)) return { kind: 'greeting' };

    const c = calc(text); if (c) return { kind: 'calc', ...c };

    if (text.includes('which way am i facing') || text.includes('what direction') || text.includes('which direction') || text.includes('where am i facing')) return { kind: 'heading' };

    const autoName = after(['run automation', 'run the automation', 'start automation', 'run routine', 'run the routine', 'start routine', 'start the routine', 'run my', 'start my']);
    if (autoName) return { kind: 'automation', name: bestName(autoName, ctx.automationNames || []) || autoName };
    const loose = after(['run', 'start', 'activate']);
    if (loose && !loose.startsWith('shortcut') && bestName(loose, ctx.automationNames || []) && (ctx.automationNames || []).some(n => n.toLowerCase().includes(loose) || loose.includes(n.toLowerCase())))
      return { kind: 'automation', name: bestName(loose, ctx.automationNames) };

    const shortcut = after(['run shortcut', 'run the shortcut', 'run my shortcut']);
    if (shortcut) return { kind: 'shortcut', name: shortcut.replace(/ on (my |the )?(mac|computer|phone|iphone)$/, '') };

    const q = after(['search for', 'search the web for', 'look up', 'google', 'search']);
    if (q) return { kind: 'search', query: q };

    if (has('flashlight') || has('torch')) return { kind: 'needsApp', what: 'The flashlight', why: 'Safari doesn’t let websites switch on the iPhone flashlight.' };

    // Things only the native app can do: other devices, your Mac, Apple Home.
    const macWords = ['slide', 'slides', 'slideshow', 'presentation', 'volume', 'mute', 'unmute', 'louder', 'quieter', 'mission control', 'lock my mac', 'screenshot', 'desktop', 'music', 'song', 'track'];
    if (macWords.some(w => text.includes(w)) || ['play', 'pause', 'resume', 'next', 'skip', 'previous'].includes(text) || text.endsWith(' on my mac') || text.endsWith(' on the mac') || starts('type'))
      return { kind: 'needsApp', what: 'Controlling your Mac', why: 'Websites can’t press keys or change volume on another device.' };
    if ((starts('turn on') || starts('turn off') || starts('switch on') || starts('switch off') || starts('dim') || has('lights') || has('lamp')) && !has('screen'))
      return { kind: 'needsApp', what: 'Apple Home control', why: 'Only apps can talk to HomeKit. Run a Shortcut instead: say “run shortcut” and its name.' };

    const target = after(['open', 'launch', 'show me', 'show', 'go to', 'switch to', 'start']);
    if (target) {
      const t = target.replace(/^(the|my) /, '').replace(/ (app|section|page|tab)$/, '');
      if (SECTION_ALIASES[t] || SECTION_ALIASES[target]) return { kind: 'navigate', section: SECTION_ALIASES[t] || SECTION_ALIASES[target] };
      if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t.replace(/ dot /g, '.'))) return { kind: 'openSite', url: 'https://' + t.replace(/ dot /g, '.') };
      return { kind: 'needsApp', what: 'Opening apps', why: 'Websites can’t open apps on your devices. Say “run shortcut” plus a Shortcut name instead.' };
    }

    if (ctx.semantic) { const id = ctx.semantic(text); if (id) return { kind: 'custom', id }; }
    return { kind: 'unknown', raw };
  }

  /** Very small meaning match for custom commands: word overlap with light stemming. */
  function semanticMatcher(commands) {
    const stem = w => w.replace(/(ing|ed|es|s)$/, '');
    const bag = s => new Set(words(s).filter(w => w.length > 2 && !['the', 'and', 'for', 'please', 'my', 'me', 'let', "let's", 'lets'].includes(w)).map(stem));
    return text => {
      const a = bag(text); if (!a.size) return null;
      let best = null, score = 0;
      for (const c of commands) {
        if (c.enabled === false) continue;
        for (const p of c.phrases) {
          const b = bag(p); if (!b.size) continue;
          const inter = [...a].filter(x => b.has(x)).length, s = inter / Math.max(a.size, b.size);
          if (s > score) { score = s; best = c.id; }
        }
      }
      return score >= .5 ? best : null;
    };
  }

  O.parser = { parse, normalise, duration, words, afterWake, wakeVariants, bestName, calc, semanticMatcher, stripFillers };
})();
