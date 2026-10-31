/*
  Squeaky toy sound for the floating BraxEye icon.
  Press (click, hold, grab or fling) the icon and it squeaks.

  This only listens to presses. It doesn't touch floaters.js, so the icon's
  spinning, drifting and fling physics are exactly as they were.

  How it works
  - The sound is downloaded once and played with the Web Audio API. That works
    on phones too, and lets it be played a bit louder than a normal <audio> tag
    (the clip itself is fairly quiet): change GAIN below.
  - It tries the file names in FILES. If none exist, it looks through the
    GitHub repo (OWNER / REPO) for an .mp3 with "squeak" in its name, then for
    any .mp3 that isn't omg.
  - Trouble? Open your site with  ?squeakdebug  on the end of the address
    (e.g.  braxhere.vercel.app/?squeakdebug ). A small box at the bottom left
    says what it found and what happens when you press the icon.
*/
(function () {
  const FILES = [
    'Squeaky_Toy_Sound_Effect.mp3',
    'Squeaky Toy Sound Effect.mp3',
    'squeaky_toy_sound_effect.mp3',
    'squeaky-toy-sound-effect.mp3',
    'squeak.mp3'
  ];
  const OWNER = 'BraxAutumnal';
  const REPO = 'my-website';
  const GAIN = 1.9;     // 1 = as recorded. The clip peaks at about -7 dB, so 1.9 is about as loud as it can go cleanly.
  const VOICES = 3;     // fallback <audio> copies, so fast presses can overlap

  const DEBUG = /[?&]squeakdebug\b/.test(location.search);
  const icons = Array.from(document.querySelectorAll('.floater'));

  /* ---------- tiny log (and an on-screen box with ?squeakdebug) ---------- */

  let panel = null;
  function log(msg) {
    if (window.console) console.log('[squeak] ' + msg);
    if (!DEBUG) return;
    if (!panel) {
      panel = document.createElement('pre');
      panel.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:6px 8px;max-width:92vw;' +
        'max-height:40vh;overflow:auto;white-space:pre-wrap;font:12px/1.35 monospace;color:#9f9;background:rgba(0,0,0,.85);' +
        'border-radius:6px;pointer-events:none;';
      document.body.appendChild(panel);
    }
    panel.textContent += msg + '\n';
  }

  if (!icons.length) { log('no .floater icon found on the page'); return; }
  log('icons found: ' + icons.length);

  /* ---------- state ---------- */

  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let gain = null;
  let url = null;        // where the sound file was found
  let bytes = null;      // its raw data (when it could be downloaded)
  let buffer = null;     // decoded sound
  let pool = null;       // fallback <audio> elements
  let next = 0;

  /* ---------- finding the file ---------- */

  function fetchBytes(u) {
    return fetch(u).then(function (r) {
      const type = r.headers.get('content-type') || '';
      if (!r.ok || /text\/html/i.test(type)) throw new Error('not found');
      return r.arrayBuffer();
    }).then(function (b) {
      if (b.byteLength < 500) throw new Error('too small');
      return b;
    });
  }

  function tryUrls(list, i, done) {
    if (i >= list.length) return done(null);
    fetchBytes(list[i]).then(
      function (b) { done({ url: list[i], bytes: b }); },
      function () { tryUrls(list, i + 1, done); }
    );
  }

  function searchRepo(done) {
    fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/git/trees/HEAD?recursive=1')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (j) {
        const mp3 = (j.tree || []).filter(function (f) { return /\.mp3$/i.test(f.path); });
        const squeaks = mp3.filter(function (f) { return /squeak/i.test(f.path); });
        const others = mp3.filter(function (f) { return !/squeak|omg/i.test(f.path); });
        const list = squeaks.concat(others).map(function (f) {
          return new URL(f.path.split('/').map(encodeURIComponent).join('/'), location.href).href;
        });
        log('repo search found ' + list.length + ' candidate(s)');
        tryUrls(list, 0, done);
      })
      .catch(function () { done(null); });
  }

  // last resort (e.g. opening index.html straight from a folder, where fetch is blocked)
  function probeWithAudio(i, done) {
    if (i >= FILES.length) return done(null);
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('loadedmetadata', function () { done({ url: encodeURI(FILES[i]), bytes: null }); }, { once: true });
    a.addEventListener('error', function () { probeWithAudio(i + 1, done); }, { once: true });
    a.src = encodeURI(FILES[i]);
  }

  function found(hit) {
    if (!hit) {
      log('NO SOUND FILE FOUND. Put "' + FILES[0] + '" in the same folder as index.html.');
      return;
    }
    url = hit.url;
    bytes = hit.bytes;
    log('sound file found: ' + url + (bytes ? ' (' + bytes.byteLength + ' bytes)' : ''));
  }

  tryUrls(FILES.map(encodeURI), 0, function (hit) {
    if (hit) return found(hit);
    searchRepo(function (hit2) {
      if (hit2) return found(hit2);
      probeWithAudio(0, found);
    });
  });

  /* ---------- playing ---------- */

  function getCtx() {
    if (!ctx && AC) {
      try {
        ctx = new AC();
        gain = ctx.createGain();
        gain.gain.value = GAIN;
        gain.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    return ctx;
  }

  function decode() {
    if (buffer) return Promise.resolve(buffer);
    if (!bytes || !getCtx()) return Promise.resolve(null);
    return new Promise(function (resolve) {
      try {
        const p = ctx.decodeAudioData(bytes.slice(0), resolve, function () { resolve(null); });
        if (p && p.catch) p.catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    }).then(function (b) {
      buffer = b;
      if (!b) log('could not decode the sound, using a plain <audio> tag instead');
      return b;
    });
  }

  function playElement() {
    if (!url) { log('press ignored: the sound file has not been found'); return; }
    if (!pool) {
      pool = [];
      for (let i = 0; i < VOICES; i++) {
        const a = new Audio(url);
        a.preload = 'auto';
        a.volume = 1;
        pool.push(a);
      }
    }
    const a = pool[next];
    next = (next + 1) % pool.length;
    try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
    const p = a.play();
    if (p && p.then) {
      p.then(function () { log('squeak (audio tag)'); },
             function (e) { log('browser blocked the sound: ' + e.name); });
    }
  }

  function start() {
    decode().then(function (b) {
      if (b && ctx) {
        const s = ctx.createBufferSource();
        s.buffer = b;
        s.connect(gain);
        s.start(0);
        log('squeak (web audio, state: ' + ctx.state + ')');
      } else {
        playElement();
      }
    });
  }

  function unlock() {
    const c = getCtx();
    if (!c || c.state === 'running') return Promise.resolve();
    return Promise.resolve(c.resume()).catch(function () { /* ignore */ });
  }

  let played = false;

  function playOnce() {
    if (played) return;
    played = true;
    start();
  }

  icons.forEach(function (el) {
    el.addEventListener('pointerdown', function (e) {
      played = false;
      log('pressed (' + e.pointerType + ')');
      if (e.pointerType === 'mouse') {
        if (e.button === 0) unlock().then(playOnce);
      }
    });
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'mouse') unlock().then(playOnce);
    });
    el.addEventListener('click', function () {
      unlock().then(function () { playOnce(); played = false; });
    });
  });
})();
