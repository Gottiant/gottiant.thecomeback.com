/* ==========================================================================
   nav.js
   Shared navigation behavior across all pages.
   - Toggles solid background on scroll past 60px
   - Mobile hamburger toggle
   No external dependencies. Vanilla JS.
   ========================================================================== */

(function () {
  'use strict';

  const nav = document.getElementById('site-nav');
  const hamburger = document.getElementById('nav-hamburger');
  const links = document.querySelector('.nav-links');

  if (!nav) return;

  // Sticky scroll behavior
  const handleScroll = () => {
    if (window.scrollY > 60) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  };

  // Throttle via rAF
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  handleScroll();

  // Mobile hamburger
  if (hamburger && links) {
    hamburger.addEventListener('click', () => {
      const open = links.classList.toggle('is-open');
      hamburger.classList.toggle('is-open', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    // Close mobile menu on link click
    links.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        links.classList.remove('is-open');
        hamburger.classList.remove('is-open');
      });
    });
  }
})();
