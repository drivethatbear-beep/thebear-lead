// TBNC — single responsive page interactivity
// (Merges previous desktop.js + mobile.js into one file.)
//
// Handles:
//   - Drawer open/close + body scroll lock (mobile)
//   - Services accordion single-open behavior (mobile only; desktop CSS forces all bodies visible)
//   - Chip radio for 문의 유형
//   - Contact form submit → Google Apps Script webhook (config.js > window.TBNC_WEBHOOK_URL)
//   - Smooth in-page anchor scroll with sticky-header offset
//   - Floating CTA auto-hide when the contact section is in view (mobile only)

(function () {
  'use strict';

  // ---------- Drawer (mobile) ----------
  const drawer       = document.getElementById('drawer');
  const backdrop     = document.getElementById('drawer-backdrop');
  const menuOpen     = document.getElementById('menu-open');
  const menuClose    = document.getElementById('menu-close');
  const drawerClose  = document.querySelectorAll('[data-drawer-close]');

  function openDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    if (menuOpen) menuOpen.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawer || !backdrop) return;
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    if (menuOpen) menuOpen.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (menuOpen)  menuOpen.addEventListener('click', openDrawer);
  if (menuClose) menuClose.addEventListener('click', closeDrawer);
  if (backdrop)  backdrop.addEventListener('click', closeDrawer);
  drawerClose.forEach((a) => a.addEventListener('click', closeDrawer));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) closeDrawer();
  });

  // ---------- Services accordion (single-open; first card open by default) ----------
  // On desktop, CSS forces all bodies visible regardless of data-open, so this
  // attribute toggling becomes visually a no-op (and .service-toggle is hidden).
  const cards = document.querySelectorAll('.service-card');
  cards.forEach((card) => {
    const header = card.querySelector('.service-card-header');
    if (!header) return;

    const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

    const toggle = () => {
      if (isDesktop()) return;   // no-op on desktop
      const isOpen = card.dataset.open === 'true';
      cards.forEach((c) => {
        c.dataset.open = 'false';
        const h = c.querySelector('.service-card-header');
        if (h) h.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        card.dataset.open = 'true';
        header.setAttribute('aria-expanded', 'true');
      }
    };

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  // ---------- Chip selector (문의 유형) ----------
  const chips      = document.querySelectorAll('.chip-row .chip');
  const typeHidden = document.querySelector('input[name="type"]');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-checked', 'true');
      if (typeHidden) typeHidden.value = chip.dataset.type || chip.textContent.trim();
    });
  });

  // ---------- Contact form submit → Google Apps Script webhook ----------
  const form         = document.getElementById('contact-form');
  const submitBtn    = document.getElementById('submit-btn');
  const defaultLabel = submitBtn ? submitBtn.querySelector('.submit-default') : null;
  const doneLabel    = submitBtn ? submitBtn.querySelector('.submit-done') : null;

  if (form && submitBtn && defaultLabel && doneLabel) {
    let resetTimer = null;

    const val = (selector) => {
      const el = form.querySelector(selector);
      return (el && el.value ? el.value : '').trim();
    };

    const showDone = () => {
      submitBtn.disabled = true;
      defaultLabel.hidden = true;
      doneLabel.hidden    = false;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        submitBtn.disabled  = false;
        defaultLabel.hidden = false;
        doneLabel.hidden    = true;
        form.reset();
        // Re-set chip default to first option
        const allChips = form.querySelectorAll('.chip');
        allChips.forEach((c, i) => {
          c.classList.toggle('active', i === 0);
          c.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
        });
        const hid = form.querySelector('input[name="type"]');
        if (hid && allChips[0]) hid.value = allChips[0].dataset.type || allChips[0].textContent.trim();
      }, 4000);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const payload = new URLSearchParams();
      payload.append('source',  window.matchMedia('(min-width: 900px)').matches ? 'desktop' : 'mobile');
      payload.append('type',    val('input[name="type"]'));
      payload.append('company', val('input[name="company"]'));
      payload.append('name',    val('input[name="name"]'));
      payload.append('phone',   val('input[name="phone"]'));
      payload.append('email',   val('input[name="email"]'));
      payload.append('message', val('textarea[name="message"]'));

      const url = (window.TBNC_WEBHOOK_URL || '').trim();
      if (!url) {
        console.warn('[TBNC] WEBHOOK_URL 미설정. config.js 에 Apps Script URL 을 붙여넣어 주세요. (SETUP.md 참고)');
        showDone();
        return;
      }

      // Optimistically show feedback; we don't wait for the no-cors response
      // because Apps Script Web App responses can't be read cross-origin.
      showDone();

      try {
        await fetch(url, {
          method: 'POST',
          body: payload,
          redirect: 'follow',
          mode: 'no-cors',
        });
      } catch (err) {
        console.error('[TBNC] 상담 신청 전송 실패:', err);
      }
    });
  }

  // ---------- Smooth in-page anchor scroll (with sticky-header offset) ----------
  const header = document.querySelector('.site-header');
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerH = header ? header.offsetHeight : 60;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerH + 1;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ---------- Auto-hide floating CTA when contact section in view (mobile only) ----------
  const floating = document.getElementById('floating-cta');
  const contact  = document.getElementById('contact');
  if (floating && contact && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          floating.classList.toggle('hidden', entry.isIntersecting);
        });
      },
      { threshold: 0.15 }
    );
    io.observe(contact);
  }
})();
