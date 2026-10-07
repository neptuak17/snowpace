// The interactive parts of the page: the demo card, the four sports, the
// factor weights and the score bands. Every score, sentence and weight comes
// from demo-data.js, which scripts/build-site-demo.mts writes from the app's
// own scoring engine. The words around them are in index.html.
(() => {
  const D = window.SNOWPACE_DEMO;
  if (!D) return;
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const hourNum = (h) => (h > 12 ? h - 12 : h);

  // ── State: which sample day, sport and hour; everything redraws from it ──
  const state = { sample: 'bluebird', act: 'classic', units: 'metric', hour: null };
  const listeners = [];
  const set = (patch) => { Object.assign(state, patch); listeners.forEach((fn) => fn()); };
  const sample = () => D.samples.find((s) => s.id === state.sample);
  const answer = () => sample().acts[state.act];

  // ── The dial: an SVG ring with 0 at twelve o'clock, as in the app ─────────
  function dial(size, stroke) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2;
    const el = document.createElement('div');
    el.className = 'dial';
    el.setAttribute('role', 'img');
    el.style.setProperty('--size', size + 'px');
    el.style.setProperty('--stroke', stroke + 'px');
    el.innerHTML =
      `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">` +
      `<circle class="dial-track" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}"/>` +
      `<circle class="dial-arc" cx="${mid}" cy="${mid}" r="${r}" stroke-width="${stroke}" ` +
      `stroke-dasharray="${c} ${c}" stroke-dashoffset="${c}" transform="rotate(-90 ${mid} ${mid})"/></svg>` +
      `<div class="dial-face"><span class="dial-num" aria-hidden="true">–</span></div>`;
    el._c = c;
    el._v = 0;
    return el;
  }
  function setDial(el, x, label) {
    const v = x.score ?? 0, num = el.querySelector('.dial-num');
    el.className = 'dial b-' + x.band;
    el.querySelector('.dial-arc').style.strokeDashoffset = String(el._c * (1 - v / 100));
    el.setAttribute('aria-label', label);
    const from = el._v;
    el._v = v;
    if (reduce.matches || from === v) { num.textContent = x.score ?? '–'; return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 650);
      num.textContent = Math.round(from + (v - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ── Chip rows ─────────────────────────────────────────────────────────────
  function chips(root, items, key, extra = {}) {
    for (const [id, label] of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', () => set({ [key]: id, ...extra }));
      root.append(b);
      listeners.push(() => b.setAttribute('aria-pressed', String(state[key] === id)));
    }
  }
  const sportItems = D.activities.map((a) => [a.key, a.label]);
  chips($('days'), D.samples.map((s) => [s.id, s.name]), 'sample', { hour: null });
  chips($('acts'), sportItems, 'act', { hour: null });
  chips($('acts2'), sportItems, 'act', { hour: null });
  chips($('units'), [['metric', '°C'], ['imperial', '°F']], 'units');

  // ── The demo card ─────────────────────────────────────────────────────────
  const big = dial(112, 13);
  $('dial-slot').append(big);
  D.hours.forEach((h) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell';
    b.addEventListener('click', () => set({ hour: h }));
    $('cells').append(b);
    $('hours').insertAdjacentHTML('beforeend', `<div class="hn"><span>${hourNum(h)}</span><i></i></div>`);
  });

  listeners.push(() => {
    const s = sample(), x = answer(), u = x[state.units];
    $('blurb').textContent = s.blurb;
    setDial(big, x, `${x.word}, ${x.score} out of 100`);
    $('word').className = 'band-word b-' + x.band;
    $('word').textContent = x.word;
    $('best').textContent = x.best || '';
    $('best').hidden = !x.best;
    $('facts').textContent = u.facts || '';
    $('facts').hidden = !u.facts;
    $('verdict').textContent = u.verdict;
    $('strip').hidden = !x.bands;
    if (!x.bands) return;
    const sel = state.hour ?? (x.window ? D.hours[x.window.from] : 12);
    $('cells').querySelectorAll('.cell').forEach((b, i) => {
      b.className = 'cell b-' + x.bands[i] + (D.hours[i] === sel ? ' on' : '');
      b.setAttribute('aria-pressed', String(D.hours[i] === sel));
      b.setAttribute('aria-label', u.lines[i]);
    });
    $('hours').querySelectorAll('.hn').forEach((n, i) => {
      n.classList.toggle('on', D.hours[i] === sel);
      n.classList.toggle('win', !!x.window && i >= x.window.from && i <= x.window.to);
    });
    $('hourline').textContent = u.lines[D.hours.indexOf(sel)];
  });

  // ── Same weather, four sports ─────────────────────────────────────────────
  for (const { key: act, label } of D.activities) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sport';
    const d = dial(76, 6.5);
    b.append(d);
    b.insertAdjacentHTML('beforeend', `<span class="name">${label}</span><span class="word"></span>`);
    b.addEventListener('click', () => set({ act, hour: null }));
    $('sports').append(b);
    listeners.push(() => {
      const x = sample().acts[act];
      setDial(d, x, `${label}: ${x.word}, ${x.score}`);
      b.querySelector('.word').className = 'word b-' + x.band;
      b.querySelector('.word').textContent = x.word;
      b.setAttribute('aria-pressed', String(act === state.act));
    });
  }
  listeners.push(() => {
    const s = sample();
    $('sports-day').textContent = `${s.name}: ${s.blurb.charAt(0).toLowerCase() + s.blurb.slice(1)}.`;
  });

  // ── The eight factors and their weights ───────────────────────────────────
  // Bars are drawn against the largest weight any sport gives any factor.
  const most = Math.max(...Object.values(D.weights).flatMap((w) => Object.values(w)));
  const youSet = $('factors').dataset.youSet;
  for (const f of D.factors) {
    const row = document.createElement('div');
    row.className = 'factor';
    row.innerHTML = `<b></b>${f.personal ? '<span class="you"></span>' : '<span></span>'}<span class="pct"></span>` +
      '<span class="bar"><i></i></span><span class="what"></span>';
    row.querySelector('b').textContent = f.name;
    row.querySelector('.what').textContent = f.what;
    if (f.personal) row.querySelector('.you').textContent = youSet;
    $('factors').append(row);
    listeners.push(() => {
      const w = D.weights[state.act][f.key];
      row.querySelector('.pct').textContent = Math.round(w * 100) + '%';
      row.querySelector('.bar i').style.width = (w / most) * 100 + '%';
    });
  }
  $('snowpack').textContent = D.snowpack;

  // ── Score bands ───────────────────────────────────────────────────────────
  for (const b of D.bands) {
    const card = document.createElement('div');
    card.className = 'bandcard b-' + b.key;
    card.innerHTML = '<div class="top"><span class="w"></span><span class="r"></span></div><p></p>';
    card.querySelector('.w').textContent = b.word;
    card.querySelector('.r').textContent = b.range;
    card.querySelector('p').textContent = b.text;
    $('bands').append(card);
  }

  // ── Snow or rain behind the opening: the chosen sample day's own weather ──
  const cv = $('sky'), ctx = cv.getContext('2d');
  let parts = [], kind = 'none', target = 0, drift = 0, raf = 0, onScreen = true, flake = '';
  function size() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function start() { if (!raf && target && onScreen && !reduce.matches) raf = requestAnimationFrame(tick); }
  function weatherFor(s) {
    const avg = (k) => s.wx.reduce((a, w) => a + w[k], 0) / s.wx.length;
    const snow = avg('snow'), rain = avg('rain');
    kind = rain > 0.2 ? 'rain' : snow > 0.05 ? 'snow' : 'none';
    target = kind === 'none' ? 0 : Math.round(40 + 160 * Math.min(1, kind === 'rain' ? rain / 1.2 : snow / 0.8));
    drift = avg('wind') / 25;
    flake = getComputedStyle(document.documentElement).getPropertyValue('--flake');
    start();
  }
  const spawn = (w, h, anywhere) => ({
    x: Math.random() * w, y: anywhere ? Math.random() * h : -10, r: 1 + Math.random() * 2.2,
    v: kind === 'rain' ? 7 + Math.random() * 5 : 0.5 + Math.random() * 1.1, ph: Math.random() * 6.28,
  });
  function tick() {
    raf = 0;
    const w = cv.clientWidth, h = cv.clientHeight;
    ctx.clearRect(0, 0, w, h);
    if (!onScreen) return;
    while (parts.length < target) parts.push(spawn(w, h, parts.length < target / 2));
    if (parts.length > target) parts.length = Math.max(target, parts.length - 3);
    ctx.fillStyle = ctx.strokeStyle = flake;
    ctx.lineWidth = 1.2;
    for (const p of parts) {
      if (kind === 'rain') {
        p.y += p.v; p.x += drift * 1.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - drift * 2, p.y - 9); ctx.stroke();
      } else {
        p.ph += 0.02; p.y += p.v; p.x += drift * 0.6 + Math.sin(p.ph) * 0.3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      if (p.y > h + 10 || p.x > w + 20) Object.assign(p, spawn(w, h, false));
    }
    if (parts.length) raf = requestAnimationFrame(tick);
  }
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; start(); }).observe(cv);
  addEventListener('resize', size);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => weatherFor(sample()));
  size();
  let lastSample = null;
  listeners.push(() => { if (state.sample !== lastSample) { lastSample = state.sample; weatherFor(sample()); } });

  set({});
})();
