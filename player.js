(function () {
  const TRACKS = [
    {
      files: [
        'omg.mp3',
        '뉴진스__OMG___2007_ver__.mp3',
        'music/omg.mp3',
        'audio/omg.mp3',
        'assets/omg.mp3'
      ]
    }
  ];

  const root = document.getElementById('MUSIC-PLAYER');
  if (!root || !TRACKS.length) return;
  const btn = root.querySelector('.mp-btn');
  const seek = root.querySelector('.mp-seek');

  const audio = new Audio();
  audio.preload = 'auto';

  let index = 0;
  let attempt = 0;
  let scrubbing = false;
  let wantPlay = false;
  let searched = false;
  let extra = null; // an mp3 found by searching the repo

  function candidates() {
    return extra ? TRACKS[index].files.concat([extra]) : TRACKS[index].files;
  }

  function load(i, a) {
    index = i;
    attempt = a || 0;
    const f = candidates()[attempt];
    audio.src = /^https?:/.test(f) ? f : encodeURI(f);
    seek.value = 0;
  }

  function setPlaying(on) {
    root.classList.toggle('is-playing', on);
    btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  }

  function play() {
    wantPlay = true;
    const p = audio.play();
    if (p && p.catch) p.catch(function () { /* waiting for the file, or blocked: stay paused */ });
  }

  function pause() {
    wantPlay = false;
    audio.pause();
  }

  function next() {
    extra = null;
    searched = false;
    load((index + 1) % TRACKS.length);
    if (wantPlay) play();
  }

  /* GitHub Pages only: list the repo and pick an .mp3 */
  function search(done) {
    const host = location.hostname;
    if (!/\.github\.io$/.test(host)) return done(null);
    const owner = host.split('.')[0];
    const first = location.pathname.split('/')[1];
    const repos = [];
    if (first && first.indexOf('.') < 0) repos.push({ name: first, base: '/' + first + '/' });
    repos.push({ name: owner + '.github.io', base: '/' });

    (function tryRepo(i) {
      if (i >= repos.length) return done(null);
      fetch('https://api.github.com/repos/' + owner + '/' + repos[i].name + '/git/trees/HEAD?recursive=1')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (j) {
          const mp3 = (j.tree || []).filter(function (f) { return /\.mp3$/i.test(f.path); });
          if (!mp3.length) return tryRepo(i + 1);
          const pick = mp3.find(function (f) { return /omg/i.test(f.path); }) || mp3[0];
          done(location.origin + repos[i].base + pick.path.split('/').map(encodeURIComponent).join('/'));
        })
        .catch(function () { tryRepo(i + 1); });
    })(0);
  }

  function giveUp() {
    root.classList.add('is-error');
    root.title = 'Couldn\u2019t find the song file';
    setPlaying(false);
    if (window.console) console.warn('Music player: no song loaded. Tried:', candidates());
  }

  /* The board grabs on pointerdown (for shaking). Keep the player's own
     presses to itself so the button and slider just work. */
  root.addEventListener('pointerdown', function (e) { e.stopPropagation(); });

  btn.addEventListener('click', function () {
    if (root.classList.contains('is-error')) {
      // try everything again (e.g. the file was uploaded after the page loaded)
      root.classList.remove('is-error');
      root.title = '';
      searched = false;
      extra = null;
      load(index, 0);
      play();
      return;
    }
    if (audio.paused) play(); else pause();
  });

  audio.addEventListener('play', function () { setPlaying(true); });
  audio.addEventListener('pause', function () { setPlaying(false); });
  audio.addEventListener('ended', function () {
    if (TRACKS.length === 1) { audio.currentTime = 0; play(); } else next();
  });

  audio.addEventListener('timeupdate', function () {
    if (scrubbing || !isFinite(audio.duration) || !audio.duration) return;
    seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
  });

  seek.addEventListener('pointerdown', function () { scrubbing = true; });
  seek.addEventListener('input', function () {
    if (isFinite(audio.duration) && audio.duration) {
      audio.currentTime = (seek.value / 1000) * audio.duration;
    }
  });
  function endScrub() { scrubbing = false; }
  seek.addEventListener('pointerup', endScrub);
  seek.addEventListener('pointercancel', endScrub);
  seek.addEventListener('change', endScrub);

  // a file name that doesn't load -> try the next one, then search the repo
  audio.addEventListener('error', function () {
    if (attempt + 1 < candidates().length) {
      load(index, attempt + 1);
      if (wantPlay) play();
    } else if (!searched) {
      searched = true;
      search(function (url) {
        if (!url) return giveUp();
        extra = url;
        load(index, candidates().length - 1);
        if (wantPlay) play();
      });
    } else {
      giveUp();
    }
  });
  audio.addEventListener('loadedmetadata', function () {
    root.classList.remove('is-error');
    root.title = '';
  });

  load(0);
})();
