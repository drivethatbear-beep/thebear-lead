// TBNC Desktop — minimal vanilla JS replacement for the React prototype.
// Handles: chip toggle for 문의 유형, form submit "접수되었습니다" feedback, smooth in-page anchor scroll.

(function () {
  'use strict';

  // ---------- Chip toggle (문의 유형) ----------
  const chips = document.querySelectorAll('.chip-row .chip');
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

    chip.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = chip.nextElementSibling || chips[0];
        if (next && next.classList.contains('chip')) { next.focus(); next.click(); }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = chip.previousElementSibling || chips[chips.length - 1];
        if (prev && prev.classList.contains('chip')) { prev.focus(); prev.click(); }
      }
    });
  });

  // ---------- Form submit feedback ----------
  const form = document.getElementById('contact-form');
  const submitBtn = document.getElementById('submit-btn');
  const defaultLabel = submitBtn ? submitBtn.querySelector('.submit-default') : null;
  const doneLabel = submitBtn ? submitBtn.querySelector('.submit-done') : null;

  if (form && submitBtn && defaultLabel && doneLabel) {
    let resetTimer = null;

    const val = (selector) => {
      const el = form.querySelector(selector);
      return (el && el.value ? el.value : '').trim();
    };

    const showDone = () => {
      submitBtn.disabled = true;
      defaultLabel.hidden = true;
      doneLabel.hidden = false;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        submitBtn.disabled = false;
        defaultLabel.hidden = false;
        doneLabel.hidden = true;
        form.reset();
        // 칩 라디오 초기 상태로 복원
        const chips = form.querySelectorAll('.chip');
        chips.forEach((c, i) => {
          c.classList.toggle('active', i === 0);
          c.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
        });
        const hidden = form.querySelector('input[name="type"]');
        if (hidden && chips[0]) hidden.value = chips[0].dataset.type || chips[0].textContent.trim();
      }, 4000);
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // 폼 데이터 수집
      const payload = new URLSearchParams();
      payload.append('source',  'desktop');
      payload.append('type',    val('input[name="type"]'));
      payload.append('company', val('input[name="company"]'));
      payload.append('name',    val('input[name="name"]'));
      payload.append('phone',   val('input[name="phone"]'));
      payload.append('email',   val('input[name="email"]'));
      payload.append('message', val('textarea[name="message"]'));

      const url = (window.TBNC_WEBHOOK_URL || '').trim();

      if (!url) {
        // config.js 의 WEBHOOK_URL 이 비어 있음 — UI 만 동작
        console.warn('[TBNC] WEBHOOK_URL 미설정. config.js 에 Apps Script URL 을 붙여넣어 주세요. (SETUP.md 참고)');
        showDone();
        return;
      }

      // 즉시 피드백 (네트워크 응답을 기다리지 않고 UX 일관성 유지)
      showDone();

      try {
        // application/x-www-form-urlencoded 로 보내면 CORS preflight 가 발생하지 않아
        // Apps Script Web App 과 가장 호환성이 좋습니다.
        await fetch(url, {
          method: 'POST',
          body: payload,
          redirect: 'follow',
          // Apps Script 는 응답을 다른 도메인(script.googleusercontent.com)으로 리다이렉트하므로
          // no-cors 모드로 보냅니다. 응답을 읽지는 못하지만 시트에는 정상 기록됩니다.
          mode: 'no-cors',
        });
      } catch (err) {
        // 네트워크 자체가 끊긴 경우만 여기로 옵니다.
        console.error('[TBNC] 상담 신청 전송 실패:', err);
      }
    });
  }

  // ---------- Smooth scroll for in-page anchors ----------
  const header = document.querySelector('.site-header');
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerH = header ? header.offsetHeight : 72;
      const top = target.getBoundingClientRect().top + window.pageYOffset - headerH + 1;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();
