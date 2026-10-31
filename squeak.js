
(function () {
  const SRC = 'Squeaky_Toy_Sound_Effect.mp3';
  const VOLUME = 0.7;   // 0 to 1
  const VOICES = 3;     // a few copies, so fast presses can overlap instead of cutting off

  const icons = Array.from(document.querySelectorAll('.floater'));
  if (!icons.length) return;

  const pool = [];
  for (let i = 0; i < VOICES; i++) {
    const a = new Audio(SRC);
    a.preload = 'auto';
    a.volume = VOLUME;
    a.addEventListener('error', function () {
      if (window.console && i === 0) console.warn('Squeak: could not load "' + SRC + '" (is it in the same folder as index.html?)');
    });
    pool.push(a);
  }
  let next = 0;

  function squeak() {
    const a = pool[next];
    next = (next + 1) % pool.length;
    try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
    const p = a.play();
    if (p && p.catch) p.catch(function () { /* blocked or file missing: stay silent */ });
  }

  icons.forEach(function (el) {
    // mouse: squeak on the press itself
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button === 0) squeak();
    });
    // finger / pen: squeak when it lifts (the moment browsers allow sound)
    el.addEventListener('pointerup', function (e) {
      if (e.pointerType !== 'mouse') squeak();
    });
  });
})();
