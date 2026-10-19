// HouseChief na telefon: lista zakupów do odhaczania, tryb Gotuj krok po kroku, plan.
// Dane przychodzą z data.json generowanego przez aplikację na komputerze.
// Odhaczenia i bieżący krok zapisują się w telefonie (localStorage), więc działają offline w sklepie.

let data = null;
const $ = (s) => document.querySelector(s);

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const key = (name) => `hc:${data?.generated || 'x'}:${name}`;

// ---------- tabs ----------
for (const b of document.querySelectorAll('nav button')) {
  b.addEventListener('click', () => showTab(b.dataset.tab));
}
function showTab(name) {
  for (const b of document.querySelectorAll('nav button')) b.classList.toggle('active', b.dataset.tab === name);
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.id === `tab-${name}`);
  store.set('hc:tab', name);
}

// ---------- lista ----------
function renderLista() {
  const root = $('#lista');
  root.innerHTML = '';
  const lista = data.lista || [];
  if (!lista.length) { root.innerHTML = '<p class="empty">Lista jest pusta. Wygeneruj ją w HouseChief na komputerze.</p>'; return; }
  const done = store.get(key('done'), {});
  const all = lista.flatMap((g) => g.pozycje);
  const progress = document.createElement('div');
  const bar = document.createElement('div'); bar.className = 'bar'; bar.innerHTML = '<div></div>';
  progress.className = 'progress';
  root.append(progress, bar);
  const update = () => {
    const n = all.filter((p) => done[p]).length;
    progress.textContent = n === all.length ? 'Wszystko kupione 🎉' : `${n} z ${all.length}`;
    bar.firstChild.style.width = `${(100 * n) / all.length}%`;
  };
  for (const g of lista) {
    const h = document.createElement('h2'); h.textContent = g.dzial; root.appendChild(h);
    for (const p of g.pozycje) {
      const row = document.createElement('label'); row.className = 'item' + (done[p] ? ' done' : '');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!done[p];
      const span = document.createElement('span'); span.textContent = p;
      cb.addEventListener('change', () => { done[p] = cb.checked; store.set(key('done'), done); row.classList.toggle('done', cb.checked); update(); });
      row.append(cb, span); root.appendChild(row);
    }
  }
  update();
  $('#lista-hint').textContent = 'Odhaczenia zostają w telefonie. Nowa lista z komputera zaczyna od zera.';
}

// ---------- gotuj ----------
let timerId = null;
let wakeLock = null;

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880;
      const t = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      o.start(t); o.stop(t + 0.3);
    }
  } catch {}
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
}

async function keepAwake() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wakeLock) { wakeLock = null; keepAwake(); } });

function renderGotuj() {
  const root = $('#gotuj');
  root.innerHTML = '';
  if (timerId) { clearInterval(timerId); timerId = null; }
  const r = data.przepis;
  if (!r || !r.kroki?.length) { root.innerHTML = '<p class="empty">Brak przepisu. Zaplanuj danie w HouseChief na komputerze.</p>'; return; }

  // krok 0 = mise en place (checklista), potem kroki 1..n
  const total = r.kroki.length;
  let idx = store.get(key('step'), 0);
  idx = Math.max(0, Math.min(idx, total));

  const head = document.createElement('div'); head.className = 'step-head';
  const card = document.createElement('div'); card.className = 'step-card';
  const nav = document.createElement('div'); nav.className = 'nav-steps';
  const back = document.createElement('button'); back.textContent = '‹ Wstecz';
  const next = document.createElement('button'); next.className = 'primary';
  root.append(head, card, nav);
  nav.append(back, next);

  if (idx === 0) {
    head.innerHTML = `<span>${r.tytul}</span><span>przygotowanie</span>`;
    const mise = store.get(key('mise'), {});
    card.innerHTML = '<div style="font-size:18px;color:var(--muted);margin-bottom:8px">Wyjmij i odmierz WSZYSTKO, zanim zaczniesz:</div>';
    for (const m of r.miseEnPlace || []) {
      const row = document.createElement('label'); row.className = 'check';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!mise[m];
      cb.addEventListener('change', () => { mise[m] = cb.checked; store.set(key('mise'), mise); });
      const s = document.createElement('span'); s.textContent = m;
      row.append(cb, s); card.appendChild(row);
    }
    if (!(r.miseEnPlace || []).length) card.innerHTML += '<p>Brak listy przygotowań w przepisie.</p>';
    back.disabled = true;
    next.textContent = 'Zaczynam ›';
  } else {
    const step = r.kroki[idx - 1];
    head.innerHTML = `<span>${r.tytul}</span><span>krok ${idx} z ${total}</span>`;
    const txt = document.createElement('div'); txt.textContent = step.tekst; card.appendChild(txt);
    if (step.minuty) {
      const t = document.createElement('div'); t.className = 'timer';
      const clock = document.createElement('div'); clock.className = 'clock';
      const btn = document.createElement('button'); btn.className = 'small';
      t.append(clock, btn); card.appendChild(t);
      const tkey = key(`timer${idx}`);
      let endAt = store.get(tkey, null);
      const fmt = (s) => { const a = Math.abs(s); return `${s < 0 ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`; };
      let beeped = false;
      const tick = () => {
        if (!endAt) { clock.textContent = fmt(step.minuty * 60); clock.classList.remove('over'); btn.textContent = `Start ${step.minuty} min`; return; }
        const left = Math.round((endAt - Date.now()) / 1000);
        clock.textContent = fmt(left);
        clock.classList.toggle('over', left <= 0);
        btn.textContent = 'Zeruj';
        if (left <= 0 && !beeped) { beeped = true; beep(); }
      };
      btn.addEventListener('click', () => {
        if (endAt) { endAt = null; store.set(tkey, null); beeped = false; }
        else { endAt = Date.now() + step.minuty * 60000; store.set(tkey, endAt); keepAwake(); }
        tick();
      });
      tick();
      timerId = setInterval(tick, 500);
    }
    back.disabled = false;
    next.textContent = idx === total ? 'Gotowe ✓' : 'Dalej ›';
  }

  back.addEventListener('click', () => { store.set(key('step'), idx - 1); renderGotuj(); });
  next.addEventListener('click', () => {
    if (idx === total) { store.set(key('step'), 0); alert('Smacznego! Napisz potem w HouseChief, jak wyszło.'); renderGotuj(); return; }
    store.set(key('step'), idx + 1); keepAwake(); renderGotuj();
  });

  if (r.ratunek?.length) {
    const d = document.createElement('details'); d.className = 'rescue';
    d.innerHTML = `<summary>🆘 Ratunek: co jeśli coś idzie nie tak</summary><ul>${r.ratunek.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    root.appendChild(d);
  }
}

// ---------- plan ----------
function renderPlan() {
  const root = $('#plan');
  const p = data.plan || {};
  const rows = Object.entries(p).filter(([k, v]) => v && k !== 'przepis');
  root.innerHTML = rows.length
    ? `<div class="plan-card">${rows.map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}</div>`
    : '<p class="empty">Brak planu.</p>';
  if (data.przepis?.osCzasu?.length) {
    root.innerHTML += `<h2>Oś czasu</h2><ul>${data.przepis.osCzasu.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  }
  $('#meta').textContent = data.generated ? `Wysłano z komputera: ${new Date(data.generated).toLocaleString('pl-PL')}` : '';
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- load ----------
async function load() {
  try {
    const res = await fetch('data.json', { cache: 'no-cache' });
    data = await res.json();
    store.set('hc:lastData', data);
  } catch {
    data = store.get('hc:lastData', null);
  }
  if (!data) { $('#lista').innerHTML = '<p class="empty">Brak danych i brak internetu.</p>'; return; }
  renderLista(); renderGotuj(); renderPlan();
  showTab(store.get('hc:tab', 'lista'));
}
$('#refresh').addEventListener('click', () => location.reload());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
load();
