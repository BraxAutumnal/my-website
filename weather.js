(function () {
  const card = document.getElementById('WEATHER-CARD');
  if (!card) return;

  const LAT = 33.7865;
  const LON = -84.0628;
  const TZ = 'America/New_York';


  const USER_AGENT = '(braxhere.vercel.app, contact@example.com)';

  const FORECAST_TTL = 15 * 60 * 1000;           // 15 minutes
  const GRID_TTL = 7 * 24 * 60 * 60 * 1000;      // 7 days
  const KEY_FORECAST = 'wx:forecast:v1';
  const KEY_GRID = 'wx:grid:v1';
  const DAYS_SHOWN = 4;

  const elTime = card.querySelector('.wx-time');
  const elIcon = card.querySelector('.wx-icon');
  const elTemp = card.querySelector('.wx-temp');
  const elText = card.querySelector('.wx-text');
  const elDays = card.querySelector('.wx-days');

  /* ---------- clock (Atlanta, 24h, no seconds) ---------- */

  const clockFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  let clockTimer = null;

  function tick() {
    const t = clockFmt.format(new Date()).split(':');
    elTime.innerHTML = t[0] + '<span class="wx-colon">:</span>' + t[1];
    elTime.setAttribute('aria-label', t[0] + ':' + t[1] + ' in Atlanta');
    clearTimeout(clockTimer);
    // wake up right after the next minute starts
    clockTimer = setTimeout(tick, 60000 - (Date.now() % 60000) + 50);
  }

  /* ---------- tiny localStorage helpers (they can throw in private mode) ---------- */

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ---------- NWS requests ---------- */

  // Browsers may refuse (or block via CORS) a custom User-Agent. So: try with
  // it, and if the request itself fails, try again with the browser's own.
  function request(url) {
    const base = { Accept: 'application/geo+json' };
    return fetch(url, { headers: Object.assign({ 'User-Agent': USER_AGENT }, base) })
      .catch(function () { return fetch(url, { headers: base }); })
      .then(function (r) {
        if (!r.ok) throw new Error('NWS ' + r.status);
        return r.json();
      });
  }

  // the NWS sometimes returns a one-off 500, so try twice
  function getJSON(url) {
    return request(url).catch(function () {
      return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return request(url); });
    });
  }

  function forecastUrl() {
    const g = load(KEY_GRID);
    if (g && g.url && Date.now() - g.t < GRID_TTL) return Promise.resolve(g.url);
    // step 1: which grid square is this point in, and where is its forecast?
    return getJSON('https://api.weather.gov/points/' + LAT + ',' + LON).then(function (j) {
      const url = j.properties.forecast;
      save(KEY_GRID, { t: Date.now(), url: url });
      return url;
    });
  }

  function fetchForecast() {
    // step 2: the 7-day forecast itself
    return forecastUrl().then(getJSON).then(function (j) {
      const periods = j.properties.periods.map(function (p) {
        return {
          name: p.name,
          startTime: p.startTime,
          isDaytime: p.isDaytime,
          temperature: p.temperature,
          unit: p.temperatureUnit,
          short: p.shortForecast
        };
      });
      save(KEY_FORECAST, { t: Date.now(), periods: periods });
      return periods;
    });
  }

  /* ---------- turning periods into what the card shows ---------- */

  function iconFor(text, day) {
    const s = String(text || '').toLowerCase();
    if (/thunder/.test(s)) return '\u26C8\uFE0F';
    if (/snow|sleet|flurr|ice|freezing/.test(s)) return '\u2744\uFE0F';
    if (/rain|shower|drizzle/.test(s)) return '\uD83C\uDF27\uFE0F';
    if (/fog|haze|smoke|mist/.test(s)) return '\uD83C\uDF2B\uFE0F';
    if (/windy|breezy/.test(s)) return '\uD83D\uDCA8';
    if (/partly|mostly sunny|mostly clear/.test(s)) return day ? '\u26C5' : '\uD83C\uDF19';
    if (/mostly cloudy/.test(s)) return '\uD83C\uDF25\uFE0F';
    if (/cloud|overcast/.test(s)) return '\u2601\uFE0F';
    if (/sunny|clear/.test(s)) return day ? '\u2600\uFE0F' : '\uD83C\uDF19';
    return '\uD83C\uDF21\uFE0F';
  }

  // group the 12-hour periods into days: high from the day period, low from the night
  function summarize(periods) {
    const today = dateFmt.format(new Date());
    const byDate = {};
    const order = [];
    periods.forEach(function (p) {
      const d = p.startTime.slice(0, 10); // local date at the grid point
      if (!byDate[d]) { byDate[d] = { date: d, hi: null, lo: null, short: '' }; order.push(d); }
      if (p.isDaytime) { byDate[d].hi = p.temperature; byDate[d].short = p.short; }
      else byDate[d].lo = p.temperature;
    });
    return order
      .filter(function (d) { return d > today; })
      .slice(0, DAYS_SHOWN)
      .map(function (d) { return byDate[d]; });
  }

  function weekday(iso) {
    const p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { weekday: 'short' });
  }

  function degrees(v) { return v == null ? '\u2013' : v + '\u00B0'; }

  function render(periods) {
    const now = periods[0];
    elIcon.textContent = iconFor(now.short, now.isDaytime);
    elTemp.textContent = degrees(now.temperature);
    elText.textContent = now.short;
    card.title = now.name + ': ' + now.short;

    elDays.innerHTML = '';
    summarize(periods).forEach(function (d) {
      const li = document.createElement('li');
      const day = document.createElement('span');
      const ico = document.createElement('span');
      const hi = document.createElement('span');
      const lo = document.createElement('span');
      day.className = 'wx-d';
      ico.className = 'wx-di';
      hi.className = 'wx-hi';
      lo.className = 'wx-lo';
      day.textContent = weekday(d.date);
      ico.textContent = iconFor(d.short, true);
      hi.textContent = degrees(d.hi);
      lo.textContent = degrees(d.lo);
      li.appendChild(day);
      li.appendChild(ico);
      li.appendChild(hi);
      li.appendChild(lo);
      elDays.appendChild(li);
    });
    card.classList.remove('is-loading', 'is-error');
  }

  function showError() {
    card.classList.remove('is-loading');
    card.classList.add('is-error');
    elIcon.textContent = '';
    elTemp.textContent = '';
    elText.textContent = 'Weather unavailable';
    elDays.innerHTML = '';
  }

  function update() {
    const cached = load(KEY_FORECAST);
    if (cached && cached.periods && Date.now() - cached.t < FORECAST_TTL) {
      render(cached.periods);
      return;
    }
    fetchForecast()
      .then(render)
      .catch(function () {
        if (cached && cached.periods) render(cached.periods); // stale beats nothing
        else showError();
      });
  }

  /* ---------- go ---------- */

  card.classList.add('is-loading');
  tick();
  update();
  setInterval(update, FORECAST_TTL);            // uses the cache until it expires
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { tick(); update(); }
  });
})();
