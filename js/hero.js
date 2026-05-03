/* ==========================================================================
   hero.js
   Injects the shared layered-ridge mountain silhouette into every page's
   hero. Each page includes an empty <svg class="hero-mountains"> tag and
   this script populates it on load. Single source of truth for the ridge
   artwork — edit it here, it updates everywhere.
   ========================================================================== */

(function () {
  'use strict';

  const RIDGES_SVG = `
    <!-- Faint stars -->
    <circle cx="980" cy="22" r="1.2" fill="#F5F2EC" opacity="0.55"/>
    <circle cx="1040" cy="48" r="0.9" fill="#F5F2EC" opacity="0.4"/>
    <circle cx="900" cy="38" r="0.7" fill="#F5F2EC" opacity="0.35"/>
    <circle cx="1100" cy="30" r="1.1" fill="#F5F2EC" opacity="0.5"/>
    <circle cx="850" cy="60" r="0.6" fill="#F5F2EC" opacity="0.3"/>

    <!-- Back ridge (lightest, farthest) -->
    <path d="M0 130 C 80 110, 160 95, 240 102 C 330 110, 380 80, 460 88
             C 540 96, 620 70, 700 78 C 780 86, 850 72, 940 80
             C 1030 88, 1100 96, 1200 88 L 1200 200 L 0 200 Z"
          fill="#3A5A48" opacity="0.55"/>

    <!-- Mid ridge -->
    <path d="M0 150 C 60 138, 140 120, 220 130 C 290 140, 360 110, 440 122
             C 520 132, 580 150, 660 138 C 740 124, 810 100, 890 116
             C 970 130, 1060 142, 1200 130 L 1200 200 L 0 200 Z"
          fill="#2D4A3A" opacity="0.85"/>

    <!-- Front ridge (darkest pine) -->
    <path d="M0 175 C 50 168, 110 150, 180 158 C 250 168, 290 145, 360 152
             C 420 158, 470 168, 540 158 C 610 148, 660 130, 730 142
             C 800 154, 870 168, 940 158 C 1010 148, 1090 158, 1200 152
             L 1200 200 L 0 200 Z"
          fill="#1C3028"/>
  `;

  document.querySelectorAll('svg.hero-mountains').forEach(svg => {
    // Only inject if it's empty (i.e. acting as a placeholder)
    if (svg.children.length === 0) {
      svg.setAttribute('viewBox', '0 0 1200 200');
      svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = RIDGES_SVG;
    }
  });
})();
