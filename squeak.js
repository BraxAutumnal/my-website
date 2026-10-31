/*
  Squeaky toy sound for the floating BraxEye icon.
  Press (click, hold, grab or fling) the icon and it squeaks.

  This only listens to presses. It doesn't touch floaters.js, so the icon's
  spinning, drifting and fling physics are exactly as they were.

  Finding the sound file: it tries the names below in order. If none load, it
  looks through your GitHub repo for an .mp3 with "squeak" in its name (set
  OWNER / REPO). If that fails too, open the browser console (F12) for a hint.
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
  const VOLUME = 0.7;   // 0 to 1
  const VOICES = 3;     // a few copies, so fast presses can overlap instead of cutting off

  const icons = Array.from(document.querySelectorAll('.floater'));
  if (!icons.length) return;

  /* ---------- find a file that really loads ---------- */

  function probe(url, ok, fail) {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('loadedmetadata', function () { ok(url); }, { once: true });
    a.addEventListener('error', fail, { once: true });
    a.src = url;
  }

  function tryFiles(i, done) {
    if (i >= FILES.length) return done(null);
    probe(encodeURI(FILES[i]), done, function () { tryFiles(i + 1, done); });
  }

  function searchRepo(done) {
    fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/git/trees/HEAD?recursive=1')
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (j) {
        const hit = (j.tree || []).find(function (f) { return /squeak.*\.mp3$/i.test(f.path); });
        if (!hit) return done(null);
        const url = new URL(hit.path.split('/').map(encodeURIComponent).join('/'), location.href).href;
        probe(url, done, function () { done(null); });
      })
      .catch(function () { done(null); });
  }

  /* ---------- sound ---------- */

  let pool = null;
  let next = 0;

  function ready(src) {
    if (!src) {
      if (window.console) console.warn('Squeak: no sound file found. Put "' + FILES[0] + '" next to index.html.');
      return;
    }
    pool = [];
    for (let i = 0; i < VOICES; i++) {
      const a = new Audio(src);
      a.preload = 'auto';
      a.volume = VOLUME;
      pool.push(a);
    }
  }

  tryFiles(0, function (src) {
    if (src) ready(src); else searchRepo(ready);
  });

  // resolves true if the browser actually started the sound
  function squeak() {
    if (!pool) return Promise.resolve(false);
    const a = pool[next];
    next = (next + 1) % pool.length;
    try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
    const p = a.play();
    if (!p || !p.then) return Promise.resolve(true);
    return p.then(function () { return true; }, function () { return false; });
  }

  /* ---------- triggers ---------- */

  // The press is what we want (so holding works). Some browsers only allow
  // sound after a full click, so if the press was refused, the click retries.
  let pressPlayed = false;

  icons.forEach(function (el) {
    el.addEventListener('pointerdown', function (e) {
      pressPlayed = false;
      if (e.pointerType === 'mouse' && e.button === 0) {
        squeak().then(function (ok) { pressPlayed = ok; });
      }
    });
    // finger / pen: the moment browsers allow sound is when it lifts
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'mouse') squeak().then(function (ok) { pressPlayed = ok; });
    });
    el.addEventListener('click', function () {
      if (!pressPlayed) squeak();
      pressPlayed = false;
    });
  });
})();
