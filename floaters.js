(function () {
  const els = Array.from(document.querySelectorAll('.floater'));
  if (!els.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const RESTITUTION = 0.85;  // bounciness off the screen edges
  const KEEP_PER_SEC = 0.4;  
  const MAX_FLING = 3200;    
  const CALM_SPEED = 25;     
  const CALM_TIME = 1.2;     
  const OFFSCREEN_REST = 5;  
  const BOB = 40;            


  const CONFIG = [
    { delay: 1.5, yFrac: 0.38, cross: 44, spin: 40 },
    { delay: 8,   yFrac: 0.68, cross: 56, spin: -40 }
  ];

  const W = function () { return document.documentElement.clientWidth; };
  const H = function () { return window.innerHeight; };
  const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  const t0 = performance.now() / 1000;

  const floaters = els.map(function (el, i) {
    const c = CONFIG[i] || CONFIG[i % CONFIG.length];
    el.draggable = false;
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    return {
      el: el, cfg: c,
      size: el.offsetWidth || 150,
      x: -9999, y: 0, vx: 0, vy: 0,
      angle: Math.random() * 360, spin: c.spin, baseSpin: c.spin,
      mode: 'wait', waitUntil: t0 + c.delay,
      baseY: 0, phase: 0, calm: 0,
      hist: [], offX: 0, offY: 0, pid: null
    };
  });

  function homeY(f) {
    const lo = BOB;
    const hi = Math.max(lo, H() - f.size - BOB);
    return clamp(H() * f.cfg.yFrac - f.size / 2, lo, hi);
  }

  /* ---------- fling velocity from the last ~100ms of pointer movement ---------- */

  function pointerVelocity(f) {
    const now = performance.now();
    const h = f.hist.filter(function (p) { return now - p.t <= 100; });
    if (h.length < 2) return { x: 0, y: 0 };
    const a = h[0];
    const b = h[h.length - 1];
    if (now - b.t > 80) return { x: 0, y: 0 }; // it had stopped before letting go
    const dt = (b.t - a.t) / 1000;
    if (dt < 0.005) return { x: 0, y: 0 };
    let vx = (b.x - a.x) / dt;
    let vy = (b.y - a.y) / dt;
    const sp = Math.hypot(vx, vy);
    if (sp > MAX_FLING) {
      vx *= MAX_FLING / sp;
      vy *= MAX_FLING / sp;
    }
    return { x: vx, y: vy };
  }

  function velocityOf(f) {
    if (f.mode === 'held') return pointerVelocity(f);
    return { x: f.vx, y: f.vy };
  }

  /* ---------- grabbing ---------- */

  floaters.forEach(function (f) {
    const el = f.el;

    el.addEventListener('pointerdown', function (e) {
      if (f.mode === 'wait' || f.mode === 'held') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      f.mode = 'held';
      f.pid = e.pointerId;
      f.vx = f.vy = 0;
      f.calm = 0;
      f.offX = e.clientX - f.x;
      f.offY = e.clientY - f.y;
      f.hist = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
      el.classList.add('is-held');
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });

    el.addEventListener('pointermove', function (e) {
      if (f.mode !== 'held' || e.pointerId !== f.pid) return;
      f.x = clamp(e.clientX - f.offX, 0, Math.max(0, W() - f.size));
      f.y = clamp(e.clientY - f.offY, 0, Math.max(0, H() - f.size));
      const now = performance.now();
      f.hist.push({ t: now, x: e.clientX, y: e.clientY });
      while (f.hist.length && now - f.hist[0].t > 150) f.hist.shift();
    });

    function letGo(e) {
      if (f.mode !== 'held' || e.pointerId !== f.pid) return;
      const v = e.type === 'pointercancel' ? { x: 0, y: 0 } : pointerVelocity(f);
      f.vx = v.x;
      f.vy = v.y;
      f.mode = 'free';
      f.pid = null;
      f.calm = 0;
      el.classList.remove('is-held');
    }
    el.addEventListener('pointerup', letGo);
    el.addEventListener('pointercancel', letGo);
  });

  /* ---------- per-frame motion ---------- */

  function step(f, dt, now) {
    f.size = f.el.offsetWidth || f.size;
    f.angle += f.spin * dt;

    if (f.mode === 'wait') {
      f.x = -f.size - 20;
      if (now >= f.waitUntil) {
        f.x = -f.size;
        f.baseY = homeY(f);
        f.y = f.baseY;
        f.phase = 0;
        f.mode = 'drift';
      }
      return;
    }

    if (f.mode === 'drift') {
      const speed = (W() + f.size) / f.cfg.cross;
      f.vx = speed;
      f.x += speed * dt;
      f.phase += dt * 0.45;
      f.baseY += (homeY(f) - f.baseY) * Math.min(1, dt * 2); // ease back toward its lane
      f.y = f.baseY + Math.sin(f.phase) * BOB;
      f.vy = Math.cos(f.phase) * BOB * 0.45;
      f.spin += (f.baseSpin - f.spin) * Math.min(1, dt * 1.5);
      if (f.x > W()) {
        f.mode = 'wait';
        f.waitUntil = now + OFFSCREEN_REST;
      }
      return;
    }

    if (f.mode === 'held') {
      f.spin += (f.baseSpin - f.spin) * Math.min(1, dt * 1.5);
      return;
    }

    // free flight
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const keep = Math.pow(KEEP_PER_SEC, dt);
    f.vx *= keep;
    f.vy *= keep;

    const maxX = Math.max(0, W() - f.size);
    const maxY = Math.max(0, H() - f.size);
    if (f.x < 0) { f.x = 0; f.vx = Math.abs(f.vx) * RESTITUTION; f.spin += f.vy * 0.05; }
    else if (f.x > maxX) { f.x = maxX; f.vx = -Math.abs(f.vx) * RESTITUTION; f.spin -= f.vy * 0.05; }
    if (f.y < 0) { f.y = 0; f.vy = Math.abs(f.vy) * RESTITUTION; f.spin -= f.vx * 0.05; }
    else if (f.y > maxY) { f.y = maxY; f.vy = -Math.abs(f.vy) * RESTITUTION; f.spin += f.vx * 0.05; }

    f.spin += (f.baseSpin + f.vx * 0.12 - f.spin) * Math.min(1, dt * 2);

    if (Math.hypot(f.vx, f.vy) < CALM_SPEED) {
      f.calm += dt;
      if (f.calm > CALM_TIME) {
        f.mode = 'drift'; // settled: carry on drifting from right here
        f.baseY = f.y;
        f.phase = 0;
        f.calm = 0;
      }
    } else {
      f.calm = 0;
    }
  }

  // Icons bounce off each other. A held or drifting icon acts like a heavy
  // wall, a flung one gets knocked away.
  function collide(a, b) {
    if (a.mode === 'wait' || b.mode === 'wait') return;
    const ia = a.mode === 'free' ? 1 : 0;
    const ib = b.mode === 'free' ? 1 : 0;
    const sum = ia + ib;
    if (!sum) return;
    const min = (a.size + b.size) * 0.4;
    const dx = b.x + b.size / 2 - (a.x + a.size / 2);
    const dy = b.y + b.size / 2 - (a.y + a.size / 2);
    const dist = Math.hypot(dx, dy) || 0.001;
    if (dist >= min) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const pen = min - dist;
    a.x -= (nx * pen * ia) / sum;
    a.y -= (ny * pen * ia) / sum;
    b.x += (nx * pen * ib) / sum;
    b.y += (ny * pen * ib) / sum;
    const va = velocityOf(a);
    const vb = velocityOf(b);
    const rvn = (vb.x - va.x) * nx + (vb.y - va.y) * ny;
    if (rvn >= 0) return;
    const j = (-(1 + 0.9) * rvn) / sum;
    if (ia) { a.vx -= j * nx; a.vy -= j * ny; a.spin += 60; }
    if (ib) { b.vx += j * nx; b.vy += j * ny; b.spin -= 60; }
  }

  function render(f) {
    f.el.style.transform =
      'translate3d(' + f.x.toFixed(1) + 'px,' + f.y.toFixed(1) + 'px,0) rotate(' + f.angle.toFixed(1) + 'deg)';
  }

  let last = performance.now();
  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    const now = t / 1000;
    floaters.forEach(function (f) { step(f, dt, now); });
    for (let i = 0; i < floaters.length; i++) {
      for (let j = i + 1; j < floaters.length; j++) collide(floaters[i], floaters[j]);
    }
    floaters.forEach(render);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
