// HOMEPICK — listings store & UI
(function () {
  'use strict';

  const STORAGE_KEY = 'homepick.listings.v1';
  const TYPE_LABEL = { sale: '매매', rent: '임대', presale: '분양' };

  // ---------- store ----------
  function loadAll() {
    let userListings = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) userListings = JSON.parse(raw) || [];
    } catch (e) {
      userListings = [];
    }
    const seed = window.SEED_LISTINGS || [];
    return [...userListings, ...seed].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function saveListing(listing) {
    let userListings = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) userListings = JSON.parse(raw) || [];
    } catch (e) {}
    userListings.unshift(listing);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userListings));
  }

  function getById(id) {
    return loadAll().find((x) => x.id === id) || null;
  }

  // ---------- helpers ----------
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null) node.setAttribute(k, v);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach((c) => {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function listingCard(item) {
    const typeClass = item.type === 'sale' ? 'sale' : (item.type === 'rent' ? 'rent' : 'new');
    const typeLabel = TYPE_LABEL[item.type] || '매물';
    const card = document.createElement('a');
    card.className = 'listing-card';
    card.href = `detail.html?id=${encodeURIComponent(item.id)}`;
    card.innerHTML = `
      <div class="listing-thumb">
        ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy"/>` : ''}
        <span class="tag ${typeClass}">${typeLabel}</span>
        <button class="fav" type="button" aria-label="찜하기" data-fav="${item.id}">♡</button>
      </div>
      <div class="listing-body">
        <div class="listing-loc">📍 ${escapeHtml(item.location || '')}</div>
        <div class="listing-title">${escapeHtml(item.title)}</div>
        <div class="listing-meta">
          <span>🏢 ${escapeHtml((item.area || '').split('(')[0].trim())}</span>
          <span>🛗 ${escapeHtml(item.floor || '-')}</span>
        </div>
        <div class="listing-price">
          <span class="price">${escapeHtml(item.price)}</span>
          <span class="unit">${escapeHtml(item.priceUnit || '')}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-fav]')) {
        e.preventDefault();
        const btn = e.target.closest('[data-fav]');
        btn.classList.toggle('liked');
        btn.textContent = btn.classList.contains('liked') ? '♥' : '♡';
      }
    });
    return card;
  }

  function renderGrid(container, items, emptyMsg) {
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <div class="ic">🏚️</div>
          <h3>등록된 매물이 없습니다</h3>
          <p>${escapeHtml(emptyMsg || '첫 매물을 등록해 보세요')}</p>
        </div>`;
      return;
    }
    items.forEach((it) => container.appendChild(listingCard(it)));
  }

  function toast(msg, kind) {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------- page: index ----------
  function initIndex() {
    const grid = document.getElementById('featured-grid');
    if (!grid) return;

    const all = loadAll();
    let activeFilter = 'all';

    function render() {
      const items = activeFilter === 'all'
        ? all.slice(0, 9)
        : all.filter((x) => x.type === activeFilter).slice(0, 9);
      renderGrid(grid, items, '곧 새로운 매물이 업데이트됩니다');
    }
    render();

    document.querySelectorAll('[data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter;
        render();
      });
    });

    // search tabs (visual only — for demo)
    document.querySelectorAll('.search-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.search-tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const searchForm = document.getElementById('hero-search');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = document.getElementById('hero-q').value.trim();
        const url = q ? `listings.html?q=${encodeURIComponent(q)}` : 'listings.html';
        window.location.href = url;
      });
    }

    // hero stats
    const statTotal = document.getElementById('stat-total');
    if (statTotal) statTotal.textContent = (all.length + 1240).toLocaleString();
  }

  // ---------- page: listings ----------
  function initListings() {
    const grid = document.getElementById('listings-grid');
    if (!grid) return;

    const all = loadAll();
    const params = new URLSearchParams(location.search);
    const initialType = params.get('type') || 'all';
    const initialQ = params.get('q') || '';

    const searchInput = document.getElementById('list-q');
    if (searchInput && initialQ) searchInput.value = initialQ;

    let state = { type: initialType, q: initialQ };

    function apply() {
      let items = all.slice();
      if (state.type !== 'all') items = items.filter((x) => x.type === state.type);
      if (state.q) {
        const q = state.q.toLowerCase();
        items = items.filter((x) =>
          (x.title || '').toLowerCase().includes(q) ||
          (x.location || '').toLowerCase().includes(q) ||
          (x.building || '').toLowerCase().includes(q)
        );
      }
      document.getElementById('result-count').textContent = items.length.toLocaleString();
      renderGrid(grid, items);
    }

    document.querySelectorAll('[data-filter]').forEach((chip) => {
      if (chip.dataset.filter === state.type) chip.classList.add('active');
      else chip.classList.remove('active');
      chip.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.type = chip.dataset.filter;
        apply();
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.q = e.target.value.trim();
        apply();
      });
    }

    apply();
  }

  // ---------- page: post ----------
  function initPost() {
    const form = document.getElementById('post-form');
    if (!form) return;

    const fileInput = document.getElementById('photo-input');
    const dropZone = document.getElementById('photo-drop');
    const previewGrid = document.getElementById('photo-preview');
    let images = [];

    function refreshPreview() {
      previewGrid.innerHTML = '';
      images.forEach((src, idx) => {
        const ph = el('div', { class: 'ph' }, [
          el('img', { src, alt: `사진 ${idx + 1}` }),
          el('button', {
            type: 'button', 'aria-label': '삭제',
            onclick: () => { images.splice(idx, 1); refreshPreview(); },
          }, '×'),
        ]);
        previewGrid.appendChild(ph);
      });
    }

    function readFiles(files) {
      const list = Array.from(files).slice(0, 8 - images.length);
      list.forEach((f) => {
        if (!f.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => { images.push(e.target.result); refreshPreview(); };
        reader.readAsDataURL(f);
      });
    }

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => readFiles(e.target.files));
    ['dragenter', 'dragover'].forEach((evt) => dropZone.addEventListener(evt, (e) => {
      e.preventDefault(); dropZone.style.borderColor = 'var(--accent)';
    }));
    ['dragleave', 'drop'].forEach((evt) => dropZone.addEventListener(evt, (e) => {
      e.preventDefault(); dropZone.style.borderColor = '';
    }));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.files) readFiles(e.dataTransfer.files);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const type = fd.get('type');
      const data = {
        id: 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
        type,
        title: fd.get('title').trim(),
        location: fd.get('location').trim(),
        building: fd.get('building').trim(),
        area: `전용 ${fd.get('area_exclusive')}㎡${fd.get('area_contract') ? ` / 계약 ${fd.get('area_contract')}㎡` : ''}`,
        floor: fd.get('floor').trim(),
        price: fd.get('price').trim(),
        priceUnit: type === 'sale' ? '매매가' : (type === 'rent' ? '임대' : '분양가'),
        bedrooms: fd.get('purpose') || '오피스',
        parking: fd.get('parking') || '-',
        builtYear: fd.get('built') || '-',
        description: fd.get('description').trim(),
        image: images[0] || '',
        images: images.slice(),
        createdAt: Date.now(),
      };

      if (!data.title || !data.location || !data.price) {
        toast('필수 항목을 모두 입력해 주세요', 'error');
        return;
      }

      saveListing(data);
      toast('매물이 등록되었습니다', 'success');
      setTimeout(() => { window.location.href = `detail.html?id=${encodeURIComponent(data.id)}`; }, 700);
    });
  }

  // ---------- page: detail ----------
  function initDetail() {
    const root = document.getElementById('detail-root');
    if (!root) return;

    const id = new URLSearchParams(location.search).get('id');
    const item = id ? getById(id) : null;

    if (!item) {
      root.innerHTML = `
        <div class="empty">
          <div class="ic">🔎</div>
          <h3>매물을 찾을 수 없습니다</h3>
          <p><a class="btn btn-outline" href="listings.html" style="margin-top:16px;">매물 목록으로</a></p>
        </div>`;
      return;
    }

    const typeLabel = TYPE_LABEL[item.type] || '매물';
    const images = (item.images && item.images.length) ? item.images : (item.image ? [item.image] : []);
    const multi = images.length > 1;

    const slidesHtml = images.length
      ? images.map((src, i) =>
          `<div class="dg-slide"><img src="${escapeHtml(src)}" alt="${escapeHtml(item.title)} 사진 ${i + 1}" ${i === 0 ? '' : 'loading="lazy"'}/></div>`
        ).join('')
      : '<div class="dg-slide dg-empty">사진 준비 중</div>';

    const galleryHtml = `
      <div class="detail-gallery-wrap">
        <div class="detail-gallery" id="detail-gallery">${slidesHtml}</div>
        ${multi ? `<div class="dg-counter"><strong>1</strong> / ${images.length}</div>` : ''}
        ${multi ? '<button class="dg-nav prev" type="button" aria-label="이전 사진">‹</button><button class="dg-nav next" type="button" aria-label="다음 사진">›</button>' : ''}
      </div>
      ${multi ? `<div class="detail-thumbs">${images.map((t, i) =>
        `<button class="t${i === 0 ? ' active' : ''}" type="button" data-go="${i}"><img src="${escapeHtml(t)}" alt="" loading="lazy"/></button>`
      ).join('')}</div>` : ''}`;

    root.innerHTML = `
      <div class="detail-hero">
        <div class="crumb"><a href="index.html">HOMEPICK</a> / <a href="listings.html">매물</a> / ${escapeHtml(typeLabel)}</div>
        <div class="detail-grid">
          <div>
            ${galleryHtml}
            <div class="detail-desc">${escapeHtml(item.description || '상세 설명이 곧 추가됩니다.')}</div>
          </div>
          <div class="detail-info">
            <span class="hero-eyebrow"><span class="dot"></span> ${escapeHtml(typeLabel)} · ${escapeHtml(item.building || '')}</span>
            <h1 style="margin-top:14px;">${escapeHtml(item.title)}</h1>
            <div class="loc">📍 ${escapeHtml(item.location || '')}</div>
            <div class="detail-price-box">
              <div class="lbl">${escapeHtml(item.priceUnit || '가격')}</div>
              <div class="v">${escapeHtml(item.price)}</div>
            </div>
            <div class="detail-specs">
              <div class="spec"><div class="l">면적</div><div class="v">${escapeHtml(item.area || '-')}</div></div>
              <div class="spec"><div class="l">층수</div><div class="v">${escapeHtml(item.floor || '-')}</div></div>
              <div class="spec"><div class="l">용도</div><div class="v">${escapeHtml(item.bedrooms || '오피스')}</div></div>
              <div class="spec"><div class="l">주차</div><div class="v">${escapeHtml(item.parking || '-')}</div></div>
              <div class="spec"><div class="l">준공</div><div class="v">${escapeHtml(item.builtYear || '-')}</div></div>
              <div class="spec"><div class="l">등록일</div><div class="v">${new Date(item.createdAt || Date.now()).toLocaleDateString('ko-KR')}</div></div>
            </div>
            <div style="display:flex;gap:10px;">
              <button class="btn btn-primary btn-lg" style="flex:1" data-consult>💬 무료 상담 신청</button>
              <button class="btn btn-outline btn-lg" onclick="this.classList.toggle('liked');this.textContent=this.classList.contains('liked')?'♥ 찜한 매물':'♡ 찜하기'">♡ 찜하기</button>
            </div>
          </div>
        </div>
      </div>`;

    initDetailGallery();
  }

  // ---------- detail gallery (swipe + thumbs) ----------
  function initDetailGallery() {
    const gallery = document.getElementById('detail-gallery');
    if (!gallery) return;
    const slides = gallery.querySelectorAll('.dg-slide');
    if (slides.length < 2) return;

    const wrap = gallery.closest('.detail-gallery-wrap');
    const counter = wrap && wrap.querySelector('.dg-counter strong');
    const prev = wrap && wrap.querySelector('.dg-nav.prev');
    const next = wrap && wrap.querySelector('.dg-nav.next');
    const thumbs = wrap && wrap.parentElement.querySelectorAll('.detail-thumbs .t');
    let idx = 0;

    function goTo(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      gallery.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: 'smooth' });
      setActive(i);
    }
    function setActive(i) {
      idx = i;
      if (counter) counter.textContent = String(i + 1);
      if (thumbs) thumbs.forEach((t, ti) => t.classList.toggle('active', ti === i));
      if (prev) prev.toggleAttribute('disabled', i === 0);
      if (next) next.toggleAttribute('disabled', i === slides.length - 1);
    }

    prev && prev.addEventListener('click', () => goTo(idx - 1));
    next && next.addEventListener('click', () => goTo(idx + 1));
    thumbs && thumbs.forEach((t) => t.addEventListener('click', () => goTo(+t.dataset.go)));

    let tm;
    gallery.addEventListener('scroll', () => {
      clearTimeout(tm);
      tm = setTimeout(() => {
        const w = slides[0].getBoundingClientRect().width;
        const i = Math.round(gallery.scrollLeft / w);
        if (i !== idx) setActive(i);
      }, 80);
    }, { passive: true });

    setActive(0);
  }

  // ---------- hero title typewriter ----------
  function initTypewriter() {
    const el = document.getElementById('typed-word');
    if (!el) return;
    const words = ['사무실', '아파트', '건물', '전세', '월세'];

    // Respect reduced-motion: cycle words without the typing animation
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let i = 0;
      el.textContent = words[0];
      setInterval(() => { i = (i + 1) % words.length; el.textContent = words[i]; }, 2200);
      return;
    }

    const TYPE = 120, ERASE = 60, HOLD = 1500, GAP = 350;
    let wi = 0, ci = 0, deleting = false;

    function tick() {
      const word = words[wi];
      if (!deleting) {
        ci++;
        el.textContent = word.slice(0, ci);
        if (ci === word.length) { deleting = true; setTimeout(tick, HOLD); return; }
        setTimeout(tick, TYPE);
      } else {
        ci--;
        el.textContent = word.slice(0, ci);
        if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; setTimeout(tick, GAP); return; }
        setTimeout(tick, ERASE);
      }
    }
    setTimeout(tick, HOLD); // start after holding the first word a beat
  }

  // ---------- theme toggle (light / dark) ----------
  function initTheme() {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]');

    function apply(theme) {
      root.setAttribute('data-theme', theme);
      if (meta) meta.setAttribute('content', theme === 'dark' ? '#0F151B' : '#0B1B2B');
      try { localStorage.setItem('homepick.theme', theme); } catch (e) {}
    }

    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(next);
      });
    });

    // Follow OS changes only when the user hasn't explicitly chosen
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener && mq.addEventListener('change', (e) => {
      let stored = null;
      try { stored = localStorage.getItem('homepick.theme'); } catch (err) {}
      if (!stored) root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    });
  }

  // ---------- mobile nav drawer ----------
  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('mobile-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.classList.toggle('is-open', open);
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }

    toggle.addEventListener('click', () => {
      setOpen(!nav.classList.contains('is-open'));
    });
    nav.querySelectorAll('a').forEach((a) => {
      // Close drawer when navigating; data-consult links also need the drawer
      // closed before the modal opens so the body scroll lock transfers cleanly.
      a.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false);
    });
    // Auto-close if the viewport grows past the breakpoint
    window.addEventListener('resize', () => {
      if (window.innerWidth > 960 && nav.classList.contains('is-open')) setOpen(false);
    });
  }

  // ---------- realtor carousel ----------
  function initRealtorCarousel() {
    const carousel = document.getElementById('realtor-carousel');
    if (!carousel) return;

    const track = carousel.querySelector('.rc-track');
    const cards = track.querySelectorAll('.realtor-card');
    const dots = carousel.querySelectorAll('.rc-dot');
    const counter = carousel.querySelector('.rc-counter strong');
    const prevBtn = carousel.querySelector('.rc-nav.prev');
    const nextBtn = carousel.querySelector('.rc-nav.next');
    const total = cards.length;
    if (!total) return;

    let currentIdx = 0;

    function scrollToCard(idx) {
      const target = cards[idx];
      if (!target) return;
      const left = target.offsetLeft - cards[0].offsetLeft;
      track.scrollTo({ left, behavior: 'smooth' });
    }

    function setActive(idx) {
      idx = Math.max(0, Math.min(total - 1, idx));
      currentIdx = idx;
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      if (counter) counter.textContent = String(idx + 1).padStart(2, '0');
      if (prevBtn) prevBtn.toggleAttribute('disabled', idx === 0);
      if (nextBtn) nextBtn.toggleAttribute('disabled', idx === total - 1);
    }

    function goTo(idx) {
      idx = Math.max(0, Math.min(total - 1, idx));
      scrollToCard(idx);
      setActive(idx);
    }

    // ----- auto-rotate -----
    const AUTO_MS = 4000;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let autoTimer = null;
    function startAuto() {
      if (reduceMotion) return;
      stopAuto();
      autoTimer = setInterval(() => goTo((currentIdx + 1) % total), AUTO_MS);
    }
    function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
    // Restart the timer after any manual move so it doesn't jump immediately
    function restartAuto() { if (!reduceMotion) startAuto(); }

    prevBtn && prevBtn.addEventListener('click', () => { goTo(currentIdx - 1); restartAuto(); });
    nextBtn && nextBtn.addEventListener('click', () => { goTo(currentIdx + 1); restartAuto(); });
    dots.forEach((d, i) => d.addEventListener('click', () => { goTo(i); restartAuto(); }));

    // Keep dots/counter in sync when the user swipes/drags manually
    let scrollTm;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollTm);
      scrollTm = setTimeout(() => {
        const cardWidth = cards[0].getBoundingClientRect().width;
        const gap = parseFloat(getComputedStyle(track).columnGap || '16') || 16;
        const idx = Math.round(track.scrollLeft / (cardWidth + gap));
        if (idx !== currentIdx) setActive(idx);
      }, 80);
    }, { passive: true });

    // Keyboard nav when the carousel area has focus
    carousel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIdx - 1); restartAuto(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIdx + 1); restartAuto(); }
    });

    // Pause while the user is hovering / touching, resume after
    carousel.addEventListener('mouseenter', stopAuto);
    carousel.addEventListener('mouseleave', startAuto);
    carousel.addEventListener('touchstart', stopAuto, { passive: true });
    carousel.addEventListener('touchend', restartAuto, { passive: true });
    // Pause when the tab is hidden (saves cycles, avoids surprise jumps)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto(); else startAuto();
    });

    setActive(0);
    startAuto();
  }

  // ---------- bottom CTA: reveal after passing the hero ----------
  function initBottomCTA() {
    const cta = document.getElementById('bottom-cta');
    if (!cta) return;

    const hero = document.querySelector('.hero');
    function threshold() {
      // Reveal after the hero is mostly scrolled past, or after 280px elsewhere.
      if (hero) return hero.offsetHeight * 0.7;
      return 280;
    }

    let visible = false;
    function onScroll() {
      const shouldShow = window.scrollY > threshold();
      if (shouldShow === visible) return;
      visible = shouldShow;
      cta.classList.toggle('is-visible', shouldShow);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  // ---------- reveal on scroll ----------
  function initReveal() {
    const targets = document.querySelectorAll('.reveal');
    if (!targets.length) return;
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((el) => obs.observe(el));
  }

  // ---------- AI overlay ----------
  function initAI() {
    const overlay = document.getElementById('ai-overlay');
    if (!overlay) return;
    const chat = overlay.querySelector('#ai-chat');
    const chips = overlay.querySelector('#ai-chips');

    function open() {
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-ai-open]').forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); open(); });
    });
    overlay.querySelectorAll('[data-ai-close]').forEach((el) => el.addEventListener('click', close));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    });

    // Chip pick → echo user message + AI typing + response (mocked)
    if (chips) {
      chips.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ai-pick]');
        if (!btn || btn.classList.contains('selected')) return;
        chips.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        const pick = btn.dataset.aiPick;
        // append user echo + typing
        const userMsg = document.createElement('div');
        userMsg.className = 'ai-msg ai-user';
        userMsg.textContent = pick;
        chat.appendChild(userMsg);
        const typing = document.createElement('div');
        typing.className = 'ai-msg ai-bot';
        typing.innerHTML = '<span class="ai-typing"><span></span><span></span><span></span></span>';
        chat.appendChild(typing);
        chat.scrollTop = chat.scrollHeight;
        setTimeout(() => {
          typing.innerHTML = `${pick} 매물 기준으로 송도 핵심 3건을 추렸어요.<br/>아래 버튼으로 전문가의 큐레이션을 받아보세요.`;
          chat.scrollTop = chat.scrollHeight;
        }, 1200);
      });
    }
  }

  // ---------- consult overlay ----------
  function initConsult() {
    const overlay = document.getElementById('consult-overlay');
    if (!overlay) return;

    function open() {
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-consult]').forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); open(); });
    });
    overlay.querySelectorAll('[data-consult-close]').forEach((el) => {
      el.addEventListener('click', close);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // expose globally so inline handlers (e.g., detail page) can call it
    window.HOMEPICK_openConsult = open;
  }

  // ---------- loader ----------
  function hideLoader() {
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.classList.add('is-hidden');
    document.body.classList.remove('is-loading');
    // Remove from DOM after the fade so it can't intercept scrolls
    setTimeout(() => loader.parentNode && loader.parentNode.removeChild(loader), 600);
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileNav();
    initTypewriter();
    initIndex();
    initListings();
    initPost();
    initDetail();
    initRealtorCarousel();
    initBottomCTA();
    initConsult();
    initAI();
    initReveal();

    // year in footer
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  });

  // Wait for full load (images/fonts) then hide loader with a minimum delay
  // so the brand moment is visible even on fast connections.
  const loadStart = Date.now();
  const MIN_LOADER_MS = 700;
  window.addEventListener('load', () => {
    const elapsed = Date.now() - loadStart;
    setTimeout(hideLoader, Math.max(0, MIN_LOADER_MS - elapsed));
  });
  // Safety net: never let the loader linger
  setTimeout(hideLoader, 3500);

  // expose for debug
  window.HOMEPICK = { loadAll, saveListing, getById };
})();
