/* =========================================================
   ZINK Screen — main script
   Data-driven streaming-platform app, powered by movies.json
   ========================================================= */

const state = {
  movies: [],
  byId: new Map(),
  current: 0,
  timer: null,
  myList: JSON.parse(localStorage.getItem('zink_mylist') || '[]'),
  history: JSON.parse(localStorage.getItem('zink_history') || '[]'),
  ratings: JSON.parse(localStorage.getItem('zink_ratings') || '{}'),
};

function persist() {
  localStorage.setItem('zink_mylist', JSON.stringify(state.myList));
  localStorage.setItem('zink_history', JSON.stringify(state.history));
  localStorage.setItem('zink_ratings', JSON.stringify(state.ratings));
}

/* ---------- tiny helpers ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function uniqueValues(mapFn) {
  const set = new Set();
  state.movies.forEach((m) => mapFn(m).forEach((v) => set.add(v)));
  return [...set];
}

/* =========================================================
   MY LIST / HISTORY / RATINGS
   ========================================================= */
function inMyList(id) {
  return state.myList.includes(id);
}

function toggleMyList(id) {
  if (inMyList(id)) {
    state.myList = state.myList.filter((x) => x !== id);
    toast('از لیست پخش حذف شد');
  } else {
    state.myList.push(id);
    toast('به لیست پخش اضافه شد');
  }
  persist();
  syncListButtons();
  $$(`[data-quicklist="${id}"]`).forEach((btn) => {
    const nowIn = inMyList(id);
    btn.classList.toggle('in-list', nowIn);
    btn.innerHTML = `<i class="ph${nowIn ? '-fill' : ''} ph-bookmark-simple"></i>`;
  });
}

function pushHistory(id) {
  state.history = [id, ...state.history.filter((x) => x !== id)].slice(0, 20);
  persist();
}

function syncListButtons() {
  const heroId = heroItems[state.current]?.id;
  if (heroId) $('#heroListBtn').classList.toggle('in-list', inMyList(heroId));
  const watchId = $('#watchPage').dataset.id;
  if (watchId) $('#watchListBtn').classList.toggle('in-list', inMyList(watchId));
}

/* =========================================================
   POSTER / BANNER FALLBACKS (used when image files are missing)
   ========================================================= */
const GRADIENT_PAIRS = [
  ['#4a1220', '#141419'],
  ['#3d2a10', '#15151b'],
  ['#3a0d16', '#0f0f14'],
  ['#241417', '#0d0d11'],
  ['#33210c', '#121216'],
  ['#401323', '#111116'],
];

function hashId(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function fallbackStyle(item) {
  const [a, b] = GRADIENT_PAIRS[hashId(item.id) % GRADIENT_PAIRS.length];
  return `background:linear-gradient(160deg, ${a}, ${b});`;
}

function parseViews(str) {
  if (!str) return 0;
  const fa = '۰۱۲۳۴۵۶۷۸۹';
  const normalized = String(str).replace(/[۰-۹]/g, (d) => fa.indexOf(d));
  const num = parseFloat(normalized.replace(/[^0-9.]/g, '')) || 0;
  if (normalized.includes('میلیون')) return num * 1_000_000;
  if (normalized.includes('هزار')) return num * 1_000;
  return num;
}

function typeIconClass(type) {
  if (type === 'فیلم') return 'ph-film-slate';
  if (type === 'کنسرت') return 'ph-music-note';
  return 'ph-television-simple';
}

/* =========================================================
   CARD RENDERING (shared by every row / catalog / search)
   ========================================================= */
function cardHTML(item, opts = {}) {
  const rank = opts.rank ? `<span class="card-rank">${String(opts.rank).padStart(2, '0')}</span>` : '';
  const listed = inMyList(item.id) ? 'in-list' : '';
  return `
    <div class="card-link" data-id="${item.id}" tabindex="0" role="button" aria-label="${item.titleFa}">
      ${rank}
      <div class="card">
        <div class="card-fallback" style="${fallbackStyle(item)}">
          <i class="ph ${typeIconClass(item.type)}"></i>${item.titleEn}
        </div>
        <img src="${item.card}" alt="${item.titleFa}" loading="lazy" onerror="this.style.display='none'" />
        <span class="card-badge"><span class="ticket-badge"><i class="ph-fill ph-star"></i><b>${item.rating}</b></span></span>
        <span class="card-year">${item.year}</span>
        <button class="card-quick-list ${listed}" type="button" data-quicklist="${item.id}" aria-label="افزودن به لیست پخش">
          <i class="ph${listed ? '-fill' : ''} ph-bookmark-simple"></i>
        </button>
        <div class="card-overlay">
          <span class="play-dot"><i class="ph-fill ph-play"></i></span>
          <p class="card-overlay-title">${item.titleFa}</p>
          <p class="card-overlay-sub">${item.type} · ${item.genres[0] || ''}</p>
        </div>
      </div>
    </div>`;
}

function bindCardClicks(scope) {
  $$('.card-link', scope).forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-quicklist]')) return;
      openWatch(el.dataset.id);
    });
    el.addEventListener('keydown', (e) => {
      if (e.target.closest('[data-quicklist]')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openWatch(el.dataset.id);
      }
    });
  });
}

function bindQuickList(scope) {
  $$('[data-quicklist]', scope).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMyList(btn.dataset.quicklist);
    });
  });
}

/* =========================================================
   ROWS (home page)
   ========================================================= */
function renderRow(container, { title, eyebrow, items, ranked = false, genre = null, type = null, mode = null, sort = null }) {
  if (!items.length) return;
  const section = document.createElement('section');
  section.className = 'movie-row-section';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <span class="eyebrow">${eyebrow}</span>
        <h2>${title}</h2>
      </div>
      <a href="#" class="see-all" data-genre="${genre || ''}" data-type="${type || ''}" data-mode="${mode || ''}" data-sort="${sort || ''}" data-title="${title}">
        مشاهده همه <i class="ph ph-arrow-left"></i>
      </a>
    </div>
    <div class="movie-row">${items.map((m, i) => cardHTML(m, { rank: ranked ? i + 1 : 0 })).join('')}</div>`;
  container.appendChild(section);
}

function buildRows() {
  const container = $('#rowsContainer');
  container.innerHTML = '';

  const continueItems = state.history.map((id) => state.byId.get(id)).filter(Boolean);
  renderRow(container, { title: 'ادامه تماشا', eyebrow: 'برای شما', items: continueItems, mode: 'history' });

  const mostViewed = [...state.movies].sort((a, b) => parseViews(b.views) - parseViews(a.views)).slice(0, 10);
  renderRow(container, { title: 'پربازدیدترین‌های این هفته', eyebrow: 'داغ‌ترین‌ها', items: mostViewed, ranked: true, sort: 'views' });

  const trending = [...state.movies].sort((a, b) => b.rating - a.rating).slice(0, 10);
  renderRow(container, { title: 'ترند این هفته', eyebrow: 'انتخاب سردبیر', items: trending, ranked: true, sort: 'rating' });

  const fresh = [...state.movies].sort((a, b) => b.year - a.year);
  renderRow(container, { title: 'تازه‌ها', eyebrow: 'جدیدترین‌ها', items: fresh, sort: 'year' });

  uniqueValues((m) => m.genres).forEach((g) => {
    const items = state.movies.filter((m) => m.genres.includes(g));
    if (items.length >= 2) {
      renderRow(container, { title: `ژانر ${g}`, eyebrow: 'بر اساس ژانر', items, genre: g });
    }
  });

  const concerts = state.movies.filter((m) => m.type === 'کنسرت');
  renderRow(container, { title: 'موزیک و کنسرت', eyebrow: 'اجرای زنده', items: concerts, type: 'کنسرت' });

  const myListItems = state.myList.map((id) => state.byId.get(id)).filter(Boolean);
  renderRow(container, { title: 'لیست پخش من', eyebrow: 'ذخیره‌شده‌ها', items: myListItems, mode: 'playlist' });

  bindCardClicks(container);
  bindQuickList(container);
  bindSeeAll(container);
}

function bindSeeAll(scope) {
  $$('.see-all', scope).forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openCatalog({
        genre: a.dataset.genre || undefined,
        type: a.dataset.type || undefined,
        mode: a.dataset.mode && a.dataset.mode !== 'history' ? a.dataset.mode : undefined,
        sort: a.dataset.sort || undefined,
        title: a.dataset.title,
      });
    });
  });
}

/* =========================================================
   HERO BANNER
   ========================================================= */
let heroSlides = [];
let heroItems = [];

function heroSlideHTML(item, index) {
  return `
    <article class="hero-slide${index === 0 ? ' active' : ''}" data-id="${item.id}">
      <div class="hero-media-fallback" style="${fallbackStyle(item)}">${item.titleEn}</div>
      <img class="hero-media" src="${item.banner}" alt="${item.titleFa}" onerror="this.remove()" />
    </article>`;
}

function buildHero() {
  const wrap = $('#slides');
  wrap.innerHTML = '';
  const items = state.movies.filter((m) => m.hero);
  const list = items.length ? items : state.movies.slice(0, 5);

  list.forEach((item, i) => wrap.insertAdjacentHTML('beforeend', heroSlideHTML(item, i)));
  heroSlides = [...wrap.children];

  const dotsWrap = $('#bannerCount');
  dotsWrap.innerHTML = '';
  list.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.className = `dot ${index === 0 ? 'dot-active' : ''}`;
    dot.setAttribute('aria-label', `اسلاید ${index + 1}`);
    dot.addEventListener('click', () => goTo(index, true));
    dotsWrap.appendChild(dot);
  });

  return list;
}

const ui = {};
function cacheUI() {
  Object.assign(ui, {
    type: $('#showType'),
    views: $('#showViews'),
    titleEn: $('#showTitleEn'),
    titleFa: $('#showTitleFa'),
    genres: $('#showGenres'),
    country: $('#showCountry'),
    years: $('#showYears'),
    rating: $('#showRating'),
    description: $('#showDescription'),
  });
}

function updateHeroText(item) {
  ui.type.textContent = item.type;
  ui.views.textContent = item.views;
  ui.titleEn.textContent = item.titleEn;
  ui.titleFa.textContent = item.titleFa;
  ui.genres.textContent = item.genres.join(' / ');
  ui.country.textContent = item.country;
  ui.years.textContent = item.years;
  ui.rating.textContent = item.rating;
  ui.description.textContent = item.description;
  syncListButtons();
}

function goTo(index, manual = false) {
  const n = heroItems.length;
  if (!n) return;
  const next = ((index % n) + n) % n;
  if (next !== state.current) {
    heroSlides[state.current].classList.remove('active');
    heroSlides[next].classList.add('active');
    $$('.dot', $('#bannerCount')).forEach((d, i) => d.classList.toggle('dot-active', i === next));
    state.current = next;
    updateHeroText(heroItems[next]);
  }
  if (manual) restartTimer();
}

function restartTimer() {
  clearInterval(state.timer);
  if (heroItems.length > 1) {
    state.timer = setInterval(() => goTo(state.current + 1), 6500);
  }
}

/* =========================================================
   WATCH PAGE
   ========================================================= */
function setWatchMedia(item) {
  const bg = $('#watchBg');
  let html = `<div class="hero-media-fallback" style="${fallbackStyle(item)}">${item.titleEn}</div>`;
  if (item.video) {
    html += `<video id="watchVideoTag" controls playsinline preload="metadata" poster="${item.banner || item.poster}"><source src="${item.video}" type="video/mp4" /></video>`;
  } else {
    html += `<img src="${item.banner || item.poster}" alt="${item.titleFa}" onerror="this.remove()" />`;
  }
  bg.innerHTML = html;
}

function renderRateStars(id) {
  const wrap = $('#rateStars');
  wrap.innerHTML = '';
  const current = state.ratings[id] || 0;
  for (let i = 1; i <= 10; i++) {
    const filled = i <= current;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `امتیاز ${i} از ۱۰`);
    btn.innerHTML = `<i class="${filled ? 'ph-fill filled' : 'ph'} ph-star"></i>`;
    btn.addEventListener('click', () => {
      state.ratings[id] = i;
      persist();
      renderRateStars(id);
      toast(`امتیاز ${i} از ۱۰ ثبت شد`);
    });
    wrap.appendChild(btn);
  }
  $('#rateValue').textContent = current ? `امتیاز شما: ${current} از ۱۰` : 'هنوز امتیاز نداده‌اید';
}

function renderRelated(item) {
  const related = state.movies.filter(
    (m) => m.id !== item.id && (m.type === item.type || m.genres.some((g) => item.genres.includes(g)))
  );
  const list = (related.length ? related : state.movies.filter((m) => m.id !== item.id)).slice(0, 12);
  const wrap = $('#watchRelated');
  wrap.innerHTML = list.length ? list.map((m) => cardHTML(m)).join('') : `<p class="empty-state">موردی برای پیشنهاد نیست.</p>`;
  bindCardClicks(wrap);
  bindQuickList(wrap);
}

function openWatch(id) {
  const item = state.byId.get(id);
  if (!item) return;
  $('#watchPage').dataset.id = id;
  setWatchMedia(item);
  $('#watchType').textContent = item.type;
  $('#watchViews').textContent = item.views;
  $('#watchTitleEn').textContent = item.titleEn;
  $('#watchTitleFa').textContent = item.titleFa;
  $('#watchGenres').textContent = item.genres.join(' / ');
  $('#watchCountry').textContent = item.country;
  $('#watchYears').textContent = item.years;
  $('#watchRating').textContent = item.rating;
  $('#watchDescription').textContent = item.description;
  renderRateStars(id);
  renderRelated(item);
  pushHistory(id);
  syncListButtons();

  document.body.classList.add('no-scroll');
  $('#watchPage').classList.add('open');
  $('.watch-scroll').scrollTop = 0;
}

function closeWatch() {
  $('#watchPage').classList.remove('open');
  document.body.classList.remove('no-scroll');
  const v = $('#watchVideoTag');
  if (v) v.pause();
  buildRows(); // refresh "ادامه تماشا" / "لیست پخش من" rows with latest state
}

/* =========================================================
   CATALOG
   ========================================================= */
function openCatalog(preset = {}) {
  closeSearch();
  const section = $('#catalogSection');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const filters = $('#catalogFilters');
  const isSpecialMode = ['history', 'playlist', 'ratings'].includes(preset.mode);

  filters.innerHTML = isSpecialMode
    ? ''
    : `
    <select id="fGenre"><option value="">همه ژانرها</option>${uniqueValues((m) => m.genres).map((g) => `<option value="${g}">${g}</option>`).join('')}</select>
    <select id="fYear"><option value="">همه سال‌ها</option>${uniqueValues((m) => [m.year]).sort((a, b) => b - a).map((y) => `<option value="${y}">${y}</option>`).join('')}</select>
    <select id="fType"><option value="">همه انواع</option>${uniqueValues((m) => [m.type]).map((t) => `<option value="${t}">${t}</option>`).join('')}</select>
    <select id="fCountry"><option value="">همه کشورها</option>${uniqueValues((m) => [m.country]).map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
    <select id="fSort">
      <option value="rating">بیشترین امتیاز</option>
      <option value="views">پربازدیدترین</option>
      <option value="year">جدیدترین</option>
      <option value="az">حروف الفبا</option>
    </select>`;

  if (!isSpecialMode) {
    if (preset.genre) $('#fGenre').value = preset.genre;
    if (preset.type) $('#fType').value = preset.type;
    if (preset.sort) $('#fSort').value = preset.sort;
  }

  $('#catalogTitle').textContent =
    preset.mode === 'history' ? 'تاریخچه تماشا' :
    preset.mode === 'playlist' ? 'لیست پخش من' :
    preset.mode === 'ratings' ? 'امتیازهای من' :
    preset.title || 'همه محتوا';

  function apply() {
    let list;
    if (preset.mode === 'history') {
      list = state.history.map((id) => state.byId.get(id)).filter(Boolean);
    } else if (preset.mode === 'playlist') {
      list = state.myList.map((id) => state.byId.get(id)).filter(Boolean);
    } else if (preset.mode === 'ratings') {
      list = Object.keys(state.ratings)
        .map((id) => state.byId.get(id))
        .filter(Boolean)
        .sort((a, b) => state.ratings[b.id] - state.ratings[a.id]);
    } else {
      list = [...state.movies];
      const g = $('#fGenre')?.value, y = $('#fYear')?.value, t = $('#fType')?.value, c = $('#fCountry')?.value;
      if (g) list = list.filter((m) => m.genres.includes(g));
      if (y) list = list.filter((m) => String(m.year) === y);
      if (t) list = list.filter((m) => m.type === t);
      if (c) list = list.filter((m) => m.country === c);
      const sort = $('#fSort')?.value;
      if (sort === 'year') list.sort((a, b) => b.year - a.year);
      else if (sort === 'az') list.sort((a, b) => a.titleFa.localeCompare(b.titleFa, 'fa'));
      else if (sort === 'views') list.sort((a, b) => parseViews(b.views) - parseViews(a.views));
      else list.sort((a, b) => b.rating - a.rating);
    }
    const grid = $('#catalogGrid');
    grid.innerHTML = list.length ? list.map((m) => cardHTML(m)).join('') : `<p class="empty-state">چیزی برای نمایش نیست.</p>`;
    $('#catalogCount').textContent = list.length ? `${list.length} عنوان` : '';
    bindCardClicks(grid);
    bindQuickList(grid);
  }

  $$('select', filters).forEach((s) => s.addEventListener('change', apply));
  apply();
}

function closeCatalog() {
  $('#catalogSection').classList.add('hidden');
}

/* =========================================================
   SEARCH
   ========================================================= */
function buildSearchHints() {
  const hints = $('#searchHints');
  const genres = uniqueValues((m) => m.genres).slice(0, 8);
  hints.innerHTML = genres.map((g) => `<span class="chip chip-ghost" data-hint="${g}">${g}</span>`).join('');
  $$('[data-hint]', hints).forEach((c) => {
    c.addEventListener('click', () => {
      $('#searchInput').value = c.dataset.hint;
      runSearch(c.dataset.hint);
      $('#searchInput').focus();
    });
  });
}

function openSearch() {
  $('#searchOverlay').classList.add('open');
  document.body.classList.add('no-scroll');
  setTimeout(() => $('#searchInput').focus(), 150);
}
function closeSearch() {
  $('#searchOverlay').classList.remove('open');
  document.body.classList.remove('no-scroll');
}
function runSearch(q) {
  const results = $('#searchResults');
  const query = q.trim();
  if (!query) {
    results.innerHTML = '';
    return;
  }
  const found = state.movies.filter(
    (m) =>
      m.titleFa.includes(query) ||
      m.titleEn.toLowerCase().includes(query.toLowerCase()) ||
      m.genres.some((g) => g.includes(query)) ||
      m.country.includes(query)
  );
  results.innerHTML = found.length
    ? `<div class="movie-grid">${found.map((m) => cardHTML(m)).join('')}</div>`
    : `<p class="empty-state">نتیجه‌ای برای «${query}» پیدا نشد.</p>`;
  bindCardClicks(results);
  bindQuickList(results);
  $$('.card-link', results).forEach((el) => el.addEventListener('click', closeSearch));
}

/* =========================================================
   DRAWER / SIDEBAR (mobile)
   ========================================================= */
function openDrawer() {
  $('#sidebar').classList.add('open');
  $('#drawerBackdrop').classList.add('open');
}
function closeDrawer() {
  $('#sidebar').classList.remove('open');
  $('#drawerBackdrop').classList.remove('open');
}

/* =========================================================
   INIT
   ========================================================= */
async function init() {
  try {
    const res = await fetch('./movies.json');
    const movies = await res.json();
    state.movies = movies;
    movies.forEach((m) => state.byId.set(m.id, m));
  } catch (err) {
    console.error(err);
    toast('خطا در بارگذاری اطلاعات محتوا');
  }

  cacheUI();
  heroItems = buildHero();
  buildRows();
  buildSearchHints();

  if (heroItems.length) {
    updateHeroText(heroItems[0]);
    restartTimer();
  }

  /* hero controls */
  $('#nextBanner').addEventListener('click', () => goTo(state.current + 1, true));
  $('#prevBanner').addEventListener('click', () => goTo(state.current - 1, true));
  $('#heroBanner').addEventListener('mouseenter', () => clearInterval(state.timer));
  $('#heroBanner').addEventListener('mouseleave', restartTimer);
  $('#heroWatchBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (heroItems[state.current]) openWatch(heroItems[state.current].id);
  });
  $('#heroListBtn').addEventListener('click', (e) => {
    e.preventDefault();
    if (heroItems[state.current]) toggleMyList(heroItems[state.current].id);
  });

  let touchStartX = 0;
  $('#heroBanner').addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].clientX; clearInterval(state.timer); }, { passive: true });
  $('#heroBanner').addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 45) {
      if (dx > 0) goTo(state.current - 1, true);
      else goTo(state.current + 1, true);
    } else {
      restartTimer();
    }
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if ($('#watchPage').classList.contains('open')) {
      if (e.key === 'Escape') closeWatch();
      return;
    }
    if ($('#searchOverlay').classList.contains('open')) {
      if (e.key === 'Escape') closeSearch();
      return;
    }
    if (e.key === 'ArrowRight') goTo(state.current - 1, true);
    if (e.key === 'ArrowLeft') goTo(state.current + 1, true);
  });

  /* watch page */
  $('#watchClose').addEventListener('click', closeWatch);
  $('#watchListBtn').addEventListener('click', (e) => {
    e.preventDefault();
    toggleMyList($('#watchPage').dataset.id);
  });
  $('#watchPlayBtn').addEventListener('click', (e) => {
    e.preventDefault();
    const v = $('#watchVideoTag');
    if (v) v.play().catch(() => {});
    else toast('پیش‌نمایش این عنوان در دسترس نیست');
  });

  /* search */
  $('#openSearch').addEventListener('click', openSearch);
  $('#closeSearch').addEventListener('click', closeSearch);
  $('#searchInput').addEventListener('input', (e) => runSearch(e.target.value));

  /* quick access cards */
  $$('.quick-card').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const k = a.dataset.quick;
      if (k === 'popular') openCatalog({ sort: 'rating', title: 'محبوب‌ترین‌ها' });
      else if (k === 'new') openCatalog({ sort: 'year', title: 'تازه اکران‌شده' });
      else if (k === 'music') openCatalog({ type: 'کنسرت', title: 'موزیک و کنسرت' });
      else if (k === 'mylist') openCatalog({ mode: 'playlist' });
    });
  });

  /* top nav */
  $('.brand').addEventListener('click', (e) => {
    e.preventDefault();
    closeCatalog();
    closeWatch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $$('.nav-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.nav-link').forEach((x) => x.classList.remove('is-active'));
      a.classList.add('is-active');
      const kind = a.dataset.nav;
      closeCatalog();
      if (kind === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
      else if (kind === 'movies') openCatalog({ type: 'فیلم', title: 'فیلم‌ها' });
      else if (kind === 'series') openCatalog({ type: 'سریال', title: 'سریال‌ها' });
      else if (kind === 'music') openCatalog({ type: 'کنسرت', title: 'موزیک و کنسرت' });
      else if (kind === 'top') openCatalog({ sort: 'rating', title: 'پرامتیازترین‌ها' });
      else if (kind === 'live') toast('پخش زنده به‌زودی فعال می‌شود');
    });
  });

  /* sidebar / drawer */
  $$('.side-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.side-link').forEach((x) => x.classList.remove('is-active'));
      a.classList.add('is-active');
      const f = a.dataset.filter;
      closeDrawer();
      if (f === 'home') { closeCatalog(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (f === 'history') openCatalog({ mode: 'history' });
      else if (f === 'playlist') openCatalog({ mode: 'playlist' });
      else if (f === 'ratings') openCatalog({ mode: 'ratings' });
      else if (f === 'year') openCatalog({ sort: 'year', title: 'بر اساس سال انتشار' });
      else if (f === 'rating') openCatalog({ sort: 'rating', title: 'پرامتیازترین‌ها' });
      else if (f === 'settings') toast('تنظیمات به‌زودی اضافه می‌شود');
      else if (f === 'logout') toast('خروج با موفقیت انجام شد');
      else openCatalog({});
    });
  });
  $('#openDrawer').addEventListener('click', openDrawer);
  $('#closeDrawer').addEventListener('click', closeDrawer);
  $('#drawerBackdrop').addEventListener('click', closeDrawer);

  /* mobile tab bar */
  $$('.tab-item').forEach((t) => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.tab-item').forEach((x) => x.classList.remove('is-active'));
      t.classList.add('is-active');
      const k = t.dataset.tab;
      if (k === 'home') { closeCatalog(); closeDrawer(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (k === 'search') openSearch();
      else if (k === 'catalog') openCatalog({});
      else if (k === 'playlist') openCatalog({ mode: 'playlist' });
      else if (k === 'menu') openDrawer();
    });
  });

  /* header tools */
  $('#openMyList').addEventListener('click', (e) => { e.preventDefault(); openCatalog({ mode: 'playlist' }); });
  $('#openAccount').addEventListener('click', (e) => { e.preventDefault(); toast('پروفایل کاربری به‌زودی فعال می‌شود'); });
  $('#closeCatalog').addEventListener('click', closeCatalog);

  syncListButtons();
  $('#pageLoader').classList.add('done');
}

init();
