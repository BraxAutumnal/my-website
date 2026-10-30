(function () {
  function mk(el, o) {
    return Object.assign({ el: el, extras: [], still: false, parent: null }, o);
  }

  function createShake(board, pieces) {
    board.classList.add('board-live');
    pieces = pieces.filter(function (p) { return p.el; });

    const GRAV = 0.5;
    const STEP = 1000 / 60;
    const GRAB_K = 0.08;
    const GRAB_C = 0.25;
    const HOME_K = 0.02;
    const HOME_C = 0.12;
    const MAX_BOX_SPEED = 60;
    const MAX_BODY_SPEED = 40;
    const SHAKE_FLIPS = 3;
    const SHAKE_WINDOW = 1100;
    const SHAKE_MIN_MOVE = 10;
    const RETURN_DELAY = 4000; // ms after you let go before everything flies home
    const RETURN_MS = 600;     // length of the trip home

    let ready = false;
    let held = false;
    let active = false;
    let returning = false;
    let moving = false;
    let suppressClick = false;
    let lastTap = 0;
    let pointerId = null;
    let returnTimer = null;
    let finalizeTimer = null;

    let restX = 0, restY = 0;
    let cx = 0, cy = 0, vx = 0, vy = 0, ax = 0, ay = 0;
    let qx = 0, qy = 0;
    const grab = { x: 0, y: 0 };

    let startX = 0, startY = 0, travel = 0;
    let axX = { dir: 0, ext: 0 };
    let axY = { dir: 0, ext: 0 };
    let flips = [];

    let W = 0, H = 0;
    let bodies = [];

    function clamp(v, m) { return v > m ? m : v < -m ? -m : v; }

    /* ---------- the board itself (springs to the pointer, then back home) ---------- */

    function measureRest() {
      const r = board.getBoundingClientRect();
      restX = r.left + r.width / 2 + window.pageXOffset - cx;
      restY = r.top + r.height / 2 + window.pageYOffset - cy;
    }

    function stepBox() {
      if (held) {
        ax = GRAB_K * (qx - (cx + grab.x)) - GRAB_C * vx;
        ay = GRAB_K * (qy - (cy + grab.y)) - GRAB_C * vy + GRAV;
      } else {
        ax = -HOME_K * cx - HOME_C * vx;
        ay = -HOME_K * cy - HOME_C * vy;
      }
      vx = clamp(vx + ax, MAX_BOX_SPEED);
      vy = clamp(vy + ay, MAX_BOX_SPEED);
      cx += vx;
      cy += vy;

      if (!held && Math.abs(cx) < 0.05 && Math.abs(cy) < 0.05 && Math.abs(vx) < 0.005 && Math.abs(vy) < 0.005) {
        cx = cy = vx = vy = ax = ay = 0;
        moving = false;
        board.style.translate = '';
      }
    }

    function writeBox() {
      board.style.translate = cx.toFixed(2) + 'px ' + cy.toFixed(2) + 'px';
    }

    /* ---------- loose pieces ---------- */

    function overlaps(a, b) {
      return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 &&
             Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
    }

    function collide(a, b) {
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      // The design overlaps a lot (rotated notes, icons on the strip). Pairs that
      // start overlapped are ignored until they've separated once.
      if (a.skip.has(b)) {
        if (ox > 0 && oy > 0) return;
        a.skip.delete(b);
        b.skip.delete(a);
      }
      if (ox <= 0 || oy <= 0) return;
      const sum = a.im + b.im;
      let nx = 0, ny = 0, pen;
      if (ox < oy) {
        pen = ox;
        nx = a.x + a.w / 2 < b.x + b.w / 2 ? -1 : 1;
      } else {
        pen = oy;
        ny = a.y + a.h / 2 < b.y + b.h / 2 ? -1 : 1;
      }
      const sa = a.im / sum;
      const sb = b.im / sum;
      a.x += nx * pen * sa;
      a.y += ny * pen * sa;
      b.x -= nx * pen * sb;
      b.y -= ny * pen * sb;
      const rvx = a.vx - b.vx;
      const rvy = a.vy - b.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const e = vn < -3 ? 0.3 : 0;
        const j = (-(1 + e) * vn) / sum;
        a.vx += j * nx * a.im;
        a.vy += j * ny * a.im;
        b.vx -= j * nx * b.im;
        b.vy -= j * ny * b.im;
        const tx = -ny, ty = nx;
        const jt = (-(rvx * tx + rvy * ty) * 0.15) / sum;
        a.vx += jt * tx * a.im;
        a.vy += jt * ty * a.im;
        b.vx -= jt * tx * b.im;
        b.vy -= jt * ty * b.im;
      }
    }

    function constrain(b) {
      if (b.x < b.lx) {
        b.x = b.lx;
        b.vx = b.vx < -3 ? -b.vx * 0.3 : 0;
        b.vy *= 0.94;
      } else if (b.x + b.w > b.rx) {
        b.x = b.rx - b.w;
        b.vx = b.vx > 3 ? -b.vx * 0.3 : 0;
        b.vy *= 0.94;
      }
      if (b.y < b.ty) {
        b.y = b.ty;
        b.vy = b.vy < -3 ? -b.vy * 0.3 : 0;
        b.vx *= 0.94;
      } else if (b.y + b.h > b.by) {
        b.y = b.by - b.h;
        b.vy = b.vy > 3 ? -b.vy * 0.3 : 0;
        b.vx *= 0.94;
      }
    }

    function stepBodies() {
      // Inside the moving board you feel gravity plus the board's own push-back.
      const wx = -ax;
      const wy = GRAV - ay;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        b.vx = clamp((b.vx + wx) * 0.998, MAX_BODY_SPEED);
        b.vy = clamp((b.vy + wy) * 0.998, MAX_BODY_SPEED);
        b.x += b.vx;
        b.y += b.vy;
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
        }
        for (let i = 0; i < bodies.length; i++) constrain(bodies[i]);
      }
    }

    function writeBodies() {
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        let dx = b.x - b.hx;
        let dy = b.y - b.hy;
        if (b.parent) {
          // nested in a moving piece: only apply the difference
          dx -= b.parent.x - b.parent.hx;
          dy -= b.parent.y - b.parent.hy;
        }
        b.el.style.translate = dx.toFixed(2) + 'px ' + dy.toFixed(2) + 'px';
        if (!b.still) {
          b.rot += (b.tilt + clamp(b.vx * 0.02, 0.4) - b.rot) * 0.12;
          b.el.style.rotate = b.rot.toFixed(4) + 'rad';
        }
      }
    }

    function cancelReturn() {
      if (returnTimer) {
        clearTimeout(returnTimer);
        returnTimer = null;
      }
    }

    function scheduleReturn() {
      cancelReturn();
      if (!active) return;
      returnTimer = setTimeout(function () {
        returnTimer = null;
        if (!held) reset();
      }, RETURN_DELAY);
    }

    function detach(kick) {
      if (active || !pieces.length) return;
      if (returning) finalize();
      active = true;

      const br = board.getBoundingClientRect();
      const ox = br.left + board.clientLeft;
      const oy = br.top + board.clientTop;
      W = board.clientWidth;
      H = board.clientHeight;

      bodies = pieces.map(function (p) {
        const r = p.el.getBoundingClientRect();
        let l = r.left, t = r.top, rt = r.right, bt = r.bottom;
        p.extras.forEach(function (e) {
          const q = e.getBoundingClientRect();
          l = Math.min(l, q.left);
          t = Math.min(t, q.top);
          rt = Math.max(rt, q.right);
          bt = Math.max(bt, q.bottom);
        });
        const w = rt - l;
        const h = bt - t;
        const x = l - ox;
        const y = t - oy;
        const mass = Math.min(4, Math.max(0.5, Math.sqrt(w * h) / 100));
        return {
          p: p, el: p.el, parent: null, still: p.still,
          x: x, y: y, hx: x, hy: y, w: w, h: h,
          vx: (Math.random() - 0.5) * 2, vy: 0,
          im: 1 / mass,
          rot: 0, tilt: (Math.random() - 0.5) * 0.3,
          skip: new Set(),
          // never snap pieces that start (partly) outside the board
          lx: Math.min(0, x), rx: Math.max(W, x + w),
          ty: Math.min(0, y), by: Math.max(H, y + h)
        };
      });

      bodies.forEach(function (b) {
        if (b.p.parent) b.parent = bodies.find(function (o) { return o.p === b.p.parent; }) || null;
      });
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          if (overlaps(bodies[i], bodies[j])) {
            bodies[i].skip.add(bodies[j]);
            bodies[j].skip.add(bodies[i]);
          }
        }
      }

      if (kick) {
        bodies.forEach(function (b) {
          b.vx += (Math.random() - 0.5) * 12;
          b.vy -= 4 + Math.random() * 8;
        });
      }
      writeBodies();
    }

    // Everything flies back to where it started, then the inline styles are cleared.
    function reset() {
      if (!active) return;
      active = false;
      cancelReturn();
      returning = true;
      const t = RETURN_MS + 'ms ease-in-out';
      bodies.forEach(function (b) {
        b.el.style.transition = 'translate ' + t + ', rotate ' + t;
        b.el.style.translate = '0px 0px';
        b.el.style.rotate = '0rad';
      });
      finalizeTimer = setTimeout(finalize, RETURN_MS + 60);
    }

    function finalize() {
      if (finalizeTimer) {
        clearTimeout(finalizeTimer);
        finalizeTimer = null;
      }
      if (!returning) return;
      returning = false;
      bodies.forEach(function (b) {
        b.el.style.transition = '';
        b.el.style.translate = '';
        b.el.style.rotate = '';
      });
      bodies = [];
    }

    /* ---------- shake detection (3 quick direction reversals) ---------- */

    function trackAxis(a, pos, t) {
      if (!a.dir) {
        if (Math.abs(pos - a.ext) >= SHAKE_MIN_MOVE) {
          a.dir = pos > a.ext ? 1 : -1;
          a.ext = pos;
        }
        return;
      }
      if ((pos - a.ext) * a.dir > 0) {
        a.ext = pos;
      } else if (Math.abs(pos - a.ext) >= SHAKE_MIN_MOVE) {
        a.dir = -a.dir;
        a.ext = pos;
        flips.push(t);
      }
    }

    function trackShake(x, y, t) {
      trackAxis(axX, x, t);
      trackAxis(axY, y, t);
      while (flips.length && t - flips[0] > SHAKE_WINDOW) flips.shift();
      if (flips.length >= SHAKE_FLIPS) {
        flips = [];
        detach(false);
      }
    }

    /* ---------- pointer handling ---------- */

    function release() {
      held = false;
      pointerId = null;
      board.classList.remove('is-held');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    }

    function onMove(e) {
      if (e.pointerId !== pointerId) return;
      qx = e.pageX - restX;
      qy = e.pageY - restY;
      travel = Math.max(travel, Math.hypot(e.pageX - startX, e.pageY - startY));
      if (!active) trackShake(e.pageX, e.pageY, performance.now());
    }

    function onUp(e) {
      if (e.pointerId !== pointerId) return;
      release();

      // the browser took over for a scroll: not a tap
      if (e.type === 'pointercancel') {
        lastTap = 0;
        if (active) scheduleReturn();
        return;
      }

      if (travel > 6) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 80);
        lastTap = 0;
        if (active) scheduleReturn();
        return;
      }

      const now = performance.now();
      const onLink = e.target && e.target.closest && e.target.closest('a');
      if (!onLink && now - lastTap < 350) {
        detach(true); // double click / double tap: shake everything loose
        lastTap = 0;
      } else {
        lastTap = now;
      }
      if (active) scheduleReturn();
    }

    board.addEventListener('pointerdown', function (e) {
      if (!ready || held) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      held = true;
      cancelReturn();
      pointerId = e.pointerId;
      travel = 0;
      startX = e.pageX;
      startY = e.pageY;
      axX = { dir: 0, ext: e.pageX };
      axY = { dir: 0, ext: e.pageY };
      flips = [];

      measureRest();
      qx = e.pageX - restX;
      qy = e.pageY - restY;
      grab.x = qx - cx;
      grab.y = qy - cy;

      moving = true;
      board.classList.add('is-held');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      if (e.cancelable && e.pointerType === 'mouse') e.preventDefault();
    });

    board.addEventListener(
      'click',
      function (e) {
        if (suppressClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    board.addEventListener('dragstart', function (e) { e.preventDefault(); });

    let lastW = board.clientWidth;
    window.addEventListener('resize', function () {
      if (board.clientWidth === lastW) return;
      lastW = board.clientWidth;
      if (active) reset();
    });

    /* ---------- loop ---------- */

    /* ---------- arm / stop (used when switching between boards) ---------- */

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let armTimer = null;

    function arm(ms) {
      ready = false;
      clearTimeout(armTimer);
      armTimer = setTimeout(function () { ready = true; }, reduce ? 0 : ms);
    }

    function stop() {
      clearTimeout(armTimer);
      ready = false;
      cancelReturn();
      if (held) release();
      if (active) {
        active = false;
        returning = true;
      }
      finalize();
      cx = cy = vx = vy = ax = ay = 0;
      moving = false;
      lastTap = 0;
      board.style.translate = '';
    }

    /* ---------- loop ---------- */

    let last = performance.now();
    let acc = 0;

    function frame(now) {
      acc += Math.min(now - last, 100);
      last = now;
      while (acc >= STEP) {
        acc -= STEP;
        if (moving) stepBox();
        if (active) stepBodies();
      }
      if (moving) writeBox();
      if (active) writeBodies();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return { arm: arm, stop: stop };
  }

  window.createBoardShake = createShake;
  window.boardPiece = mk;

  /* ---------- the main profile board ---------- */

  const $ = function (id) { return document.getElementById(id); };
  const portrait = $('PORTRAIT-ICON');
  const topSticker = $('STICKER-TOP-CENTER');
  const board = portrait && portrait.closest('.text-dark');
  if (!board || !topSticker || !$('SQUARE-IMAGE-ROW')) return;

  /* The dolphin sticker is absolutely positioned against #TOP-INFO, so lifting
     it out of the Age/Pronouns bar changes nothing visually, but lets it fall
     as its own piece. */
  const details = topSticker.parentElement;
  const nameTag = details.previousElementSibling;
  details.parentNode.insertBefore(topSticker, details.nextSibling);

  const detailsPiece = mk(details, { still: true }); // flat strip: no tumbling
  const pieces = [
    mk(portrait),
    mk(nameTag),
    detailsPiece,
    mk(topSticker),
    mk($('BASICS')),
    mk($('STICKY-NOTE'))
  ]
    .concat(
      Array.from($('SQUARE-IMAGE-ROW').querySelectorAll(':scope > div > img')).map(function (i) { return mk(i); })
    )
    .concat([
      mk($('MUSIC-PLAYER')),
      mk($('WEATHER-CARD')),
      mk($('SQUARE-IMAGE-ROW').nextElementSibling),
      mk($('STICKER-BOTTOM-LEFT')),
      mk($('STICKER-TOP-RIGHT')),
      mk($('POLAROID-1')),
      mk($('POLAROID-2'), { extras: [$('ROUND-STICKER'), $('STICKER-BOTTOM-CENTER')].filter(Boolean) })
    ])
    .concat(
      Array.from(details.querySelectorAll('#LINK-ICONS a')).map(function (a) { return mk(a, { parent: detailsPiece }); })
    );

  const main = createShake(board, pieces);
  main.arm(3900); // grabbing is enabled once the intro has finished
  window.mainBoardShake = main;
})();
