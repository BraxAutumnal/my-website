/*
  Gallery board.
  - Click the "Brax / The autumnal wolverine" note on the main board and the
    page swaps to a second board with the same design, filled with Brax's art.
    (No navigation: the address just gets #gallery so the browser Back button works.)
  - Webm pieces play on a loop, every piece pops in one by one, and the whole
    board can be grabbed and shaken just like the main one (uses shake.js).
  - Clicking a piece (without dragging) opens the VGen page.
*/
(function () {
  const mainView = document.getElementById('MAIN-VIEW');
  const view = document.getElementById('GALLERY-VIEW');
  const grid = document.getElementById('GALLERY-GRID');
  const nameTag = document.querySelector('#TOP-INFO > div:first-child');
  if (!mainView || !view || !grid || !nameTag || !window.createBoardShake) return;

  const HREF = 'https://vsona.vgen.co/brax';
  const CHAR = 'https://storage.vgen.co/uploads/characters/7339c96a-d63b-48fa-a283-002a62c7807b/gallery/';
  const VER = 'https://storage.vgen.co/uploads/';
  const c = function (id, ext) { return CHAR + id + '.' + ext; };

  // k: img | video     z: sm | md | lg (frame width)
  const ART = [
    { k: 'img',   z: 'lg', s: c('a5fef965-3c3d-4ae8-94a4-609015e44440', 'webp') },  // full body
    { k: 'video', z: 'md', s: c('5548d74b-265b-4375-8350-d6c03f4af2bd', 'webm') },
    { k: 'img',   z: 'sm', s: c('eb6682e9-a3a7-4339-973c-49f9a44de522', 'webp') },  // icon
    { k: 'img',   z: 'md', s: c('a29b1b11-62fc-4222-b081-e04154e4d0d1', 'webp') },
    { k: 'video', z: 'lg', s: c('2ed23d39-0f8a-4f9e-ac79-b014c8ac58ef', 'webm') },
    { k: 'img',   z: 'md', s: c('6348655f-c4d8-4802-8c93-df9bcf13217d', 'webp') },
    { k: 'img',   z: 'sm', s: c('6293c258-5ac6-45ea-83dd-2b0ec8bf0a6d', 'webp') },  // icon
    { k: 'video', z: 'md', s: VER + '21e9e135-7f48-44a3-874d-c1166c846b87/verified/U375HFLH0BYD/25756326-568d-4364-90f3-e2a6c6c3a5ef.webm' },
    { k: 'img',   z: 'lg', s: c('a6a8616d-f345-42d3-ae8d-ca4641326fcb', 'webp') },
    { k: 'video', z: 'md', s: c('166cc490-0fe4-4c1f-8528-dbd5eeb4df58', 'webm') },
    { k: 'img',   z: 'md', s: c('083c8491-e356-4450-aa89-af0d895911b8', 'webp') },
    { k: 'img',   z: 'sm', s: c('d6b8d0ff-abc1-4b72-979c-0cfbf3a898b9', 'webp') },  // icon
    { k: 'video', z: 'lg', s: VER + 'f0bc9edd-7c78-4744-8de0-3c4cb259bc92/verified/J89I4DL0OELB/bb9f66ee-e7f3-4cf9-ac95-d5979a5eecb2.webm' },
    { k: 'img',   z: 'md', s: c('487cb4c1-54bf-4647-a061-92bb72fc33bf', 'webp') },
    { k: 'video', z: 'md', s: VER + 'f0bc9edd-7c78-4744-8de0-3c4cb259bc92/verified/ERWG9D8PIUO4/f04600d6-5eea-46d8-bc94-9ce2d3cc2b39.webm' },
    { k: 'img',   z: 'lg', s: c('fe28a91a-dbf3-4dbf-aac2-caa974441c0e', 'webp') },
    { k: 'video', z: 'md', s: c('c9e5f766-a74b-4b31-ac10-2d29eb9e9b8a', 'webm') },
    { k: 'img',   z: 'md', s: c('e9d7f615-16d4-42e7-89fe-086c490e190e', 'webp') },
    { k: 'video', z: 'md', s: c('73ff97ad-ba73-4858-b10a-04a9d093b80a', 'webm') },
    { k: 'img',   z: 'lg', s: c('907af249-06fb-4b82-ba7b-8ead0cdae06c', 'webp') },
    { k: 'img',   z: 'md', s: c('045c6c89-7244-48d1-9933-c899b74ff46a', 'webp') },
    { k: 'img',   z: 'md', s: c('91c7ac19-605a-43a6-b500-de25d0e91932', 'webp') },
    { k: 'img',   z: 'lg', s: c('9df4bd6a-9ead-4e15-8445-a60f32117051', 'webp') },
    { k: 'img',   z: 'md', s: c('7a6dccd9-a5e7-4ef1-806c-4f6afd985199', 'webp') },
    { k: 'img',   z: 'md', s: c('698b79fa-0860-4f66-bf96-4008517bdc90', 'webp') }
  ];

  // gentle tilt + a little overlap, repeating, so the wall looks hand-pinned but never piled up
  const TILT = [-4, 3, -2, 5, -5, 2, 4, -3, 1, -6, 3, -1];
  const NUDGE = [
    [0, 0],        // [margin-left, margin-top]
    [-22, 10],
    [0, -18],
    [-14, -8]
  ];
  const STEP = 0.12;   // s between pop-ins
  const FIRST = 0.75;  // s before the first piece

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let built = false;
  let shake = null;
  let isOpen = false;
  let openedHere = false;
  let discovered = false; // once they've opened the gallery, the hint retires

  function build() {
    built = true;

    ART.forEach(function (a, i) {
      const link = document.createElement('a');
      link.className = 'g-piece g-pop g-' + a.z + (i % 3 === 0 ? ' g-tape' : '');
      link.href = HREF;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', 'Brax art ' + (i + 1) + ' on VGen');
      const n = NUDGE[i % NUDGE.length];
      link.style.marginLeft = n[0] + 'px';
      link.style.marginTop = n[1] + 'px';
      link.style.setProperty('--r', TILT[i % TILT.length] + 'deg');
      link.style.setProperty('--d', (FIRST + i * STEP).toFixed(2) + 's');

      let m;
      if (a.k === 'video') {
        m = document.createElement('video');
        m.muted = true;
        m.loop = true;
        m.playsInline = true;
        m.setAttribute('muted', '');
        m.setAttribute('playsinline', '');
        m.preload = 'auto';
        m.autoplay = !reduce;
      } else {
        m = document.createElement('img');
        m.alt = 'Art of Brax';
        m.decoding = 'async';
      }
      m.draggable = false;
      m.addEventListener('error', function () { link.style.display = 'none'; });
      m.src = a.s;
      link.appendChild(m);
      grid.appendChild(link);
    });

    const pieces = [
      window.boardPiece(document.getElementById('GALLERY-TITLE')),
      window.boardPiece(document.getElementById('GALLERY-BACK'))
    ]
      .concat(Array.from(grid.children).map(function (el) { return window.boardPiece(el); }))
      .concat(Array.from(document.querySelectorAll('#GALLERY-INNER > .g-sticker')).map(function (el) { return window.boardPiece(el); }));

    shake = window.createBoardShake(document.getElementById('GALLERY-BOARD'), pieces);
  }

  function videos() { return Array.from(grid.querySelectorAll('video')); }

  function show() {
    if (isOpen) return;
    isOpen = true;
    discovered = true; // they found it (also covers landing straight on #gallery)
    stopHint();
    if (window.mainBoardShake) window.mainBoardShake.stop();
    mainView.hidden = true;
    view.hidden = false;
    if (!built) build();
    videos().forEach(function (v) {
      v.currentTime = 0;
      if (!reduce) { const p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
    window.scrollTo(0, 0);
    shake.arm((FIRST + ART.length * STEP + 0.6) * 1000);
  }

  function hide() {
    if (!isOpen) return;
    isOpen = false;
    if (shake) shake.stop();
    videos().forEach(function (v) { v.pause(); });
    view.hidden = true;
    mainView.hidden = false;
    window.scrollTo(0, 0);
    if (window.mainBoardShake) window.mainBoardShake.arm(3900);
  }

  function route() {
    if (location.hash === '#gallery') show(); else hide();
  }

  function open() {
    discovered = true;
    stopHint();
    openedHere = true;
    if (location.hash !== '#gallery') location.hash = 'gallery'; // fires hashchange -> route()
    else route();
  }

  function close() {
    if (openedHere) {
      openedHere = false;
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      route();
    }
  }


  /* ---------- "click me" hint ----------
     A small cursor fades in, glides onto the name note, taps it, and fades out.
     It first plays a few seconds after the page loads (once the intro has
     finished), then once more 12 seconds later, and that's it (it also stops
     for good as soon as the gallery has been opened). */
  const board = nameTag.closest('.text-dark');
  const hint = document.createElement('div');
  let hintTimer = null;
  let hintPlays = 0; // the hint plays twice in total

  function stopHint() {
    clearTimeout(hintTimer);
    hint.classList.remove('is-on');
    if (hint.parentNode) hint.parentNode.removeChild(hint);
  }

  function scheduleHint(ms) {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(tryHint, ms);
  }

  function tryHint() {
    if (discovered) return;
    // wait while the board is being grabbed / shaken apart, or the tab is hidden
    const busy = isOpen || document.hidden || board.classList.contains('is-held') || nameTag.style.translate;
    if (busy) { scheduleHint(2000); return; }
    const b = board.getBoundingClientRect();
    const n = nameTag.getBoundingClientRect();
    hint.style.left = (n.left + n.width * 0.64 - b.left - board.clientLeft).toFixed(1) + 'px';
    hint.style.top = (n.top + n.height * 0.5 - b.top - board.clientTop).toFixed(1) + 'px';
    hintPlays++;
    hint.classList.remove('is-on');
    void hint.offsetWidth; // restart the animation
    hint.classList.add('is-on');
  }

  if (board && !reduce) {
    hint.id = 'CLICK-HINT';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML =
      '<svg viewBox="0 0 17 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 1 L1 18.5 L5.6 14.6 L8.8 21.8 L12 20.3 L8.9 13.3 L15.2 13.2 Z" fill="#fff" stroke-linejoin="round"/></svg>' +
      '<span class="hint-tag">click me!</span>';
    board.appendChild(hint);
    hint.addEventListener('animationend', function (e) {
      if (e.target !== hint) return;
      hint.classList.remove('is-on');
      if (hintPlays < 2) scheduleHint(12000); else stopHint();
    });
    scheduleHint(4600); // main-board intro (~3.9s) + a beat
  }

  /* the name note on the main board is the doorway */
  nameTag.classList.add('name-tag-link');
  nameTag.setAttribute('role', 'button');
  nameTag.setAttribute('tabindex', '0');
  nameTag.setAttribute('aria-label', 'Open Brax\u2019s gallery');
  nameTag.addEventListener('click', open);
  nameTag.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  document.getElementById('GALLERY-BACK').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) close(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);

  route(); // landing straight on /#gallery works too
})();
