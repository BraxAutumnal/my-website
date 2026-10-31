/*
  Squeaky toy sound for the floating BraxEye icon.
  Click (or tap) the icon and it squeaks.

  This only listens for clicks. It doesn't touch floaters.js, so the icon's
  spinning, drifting and fling physics are exactly as they were.
*/
(function () {
  const SRC = 'Squeaky_Toy_Sound_Effect.mp3';
  const VOLUME = 0.7;   // 0 to 1
  const VOICES = 3;     // a few copies, so fast clicks can overlap instead of cutting off

  const icons = Array.from(document.querySelectorAll('.floater'));
  if (!icons.length) return;

  const pool = [];
  for (let i = 0; i < VOICES; i++) {
    const a = new Audio(SRC);
    a.preload = 'auto';
    a.volume = VOLUME;
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
    el.addEventListener('click', squeak);
  });
})();
