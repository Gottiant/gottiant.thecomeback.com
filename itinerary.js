/* ==========================================================================
   itinerary.js
   Page logic for itinerary.html:
   - Builds the SVG map (stops, routes, tooltips, filter-on-click)
   - Builds the daily distance bar chart with miles/km toggle
   - Day card expand/collapse and phase filtering
   - Map -> day-card filter sync; card-open -> map highlight
   No external dependencies. Vanilla JS.
   ========================================================================== */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────────────
     DATA — single source for stops, routes, distances
  ────────────────────────────────────────────────────────────────── */

  // SVG coordinates inside viewBox 700x480
  const STOPS = [
    { id: 'arvada',   name: 'Arvada',           x: 545, y: 195, r: 9, phase: 'arvada', days: ['D1','D2','D3','D4','D5','D6','D12','D13','D14','D15'] },
    { id: 'denver',   name: 'Denver',           x: 565, y: 210, r: 5, phase: 'arvada', days: ['D2','D5','D13'] },
    { id: 'redrocks', name: 'Red Rocks',        x: 520, y: 215, r: 5, phase: 'arvada', days: ['D2'] },
    { id: 'rmnp',     name: 'Rocky Mtn NP',     x: 490, y: 130, r: 5, phase: 'arvada', days: ['D3'] },
    { id: 'cos',      name: 'Colorado Springs', x: 555, y: 285, r: 5, phase: 'arvada', days: ['D4'] },
    { id: 'aspen',    name: 'Aspen',            x: 345, y: 215, r: 7, phase: 'rt',     days: ['D7','D8'] },
    { id: 'mbells',   name: 'Maroon Bells',     x: 320, y: 230, r: 4, phase: 'rt',     days: ['D8'] },
    { id: 'moab',     name: 'Moab, UT',         x: 130, y: 270, r: 7, phase: 'rt',     days: ['D8','D9'] },
    { id: 'montrose', name: 'Black Canyon',     x: 270, y: 305, r: 7, phase: 'rt',     days: ['D10'] },
    { id: 'dunes',    name: 'Great Sand Dunes', x: 425, y: 380, r: 6, phase: 'rt',     days: ['D11'] },
    { id: 'alamosa',  name: 'Alamosa',          x: 415, y: 405, r: 6, phase: 'rt',     days: ['D11','D12'] }
  ];

  // Route segments (curves drawn as M ... C/Q ...)
  const ROUTES = [
    // Main loop (solid green)
    { id: 'seg-arvada-aspen',   from: 'arvada', to: 'aspen',    type: 'main',  days: ['D7'],         label: 'Arvada → Aspen', miles: 200 },
    { id: 'seg-aspen-moab',     from: 'aspen',  to: 'moab',     type: 'main',  days: ['D8'],         label: 'Aspen → Moab',   miles: 235 },
    { id: 'seg-moab-montrose',  from: 'moab',   to: 'montrose', type: 'main',  days: ['D10'],        label: 'Moab → Montrose', miles: 165 },
    { id: 'seg-montrose-dunes', from: 'montrose', to: 'dunes',  type: 'main',  days: ['D11'],        label: 'Montrose → Dunes', miles: 180 },
    { id: 'seg-dunes-arvada',   from: 'dunes',  to: 'arvada',   type: 'main',  days: ['D12'],        label: 'Dunes → Arvada', miles: 250 },
    // Day trip spurs (dashed gold)
    { id: 'seg-arvada-redrocks', from: 'arvada', to: 'redrocks', type: 'spur',  days: ['D2'],         label: 'Arvada → Red Rocks', miles: 18 },
    { id: 'seg-arvada-rmnp',     from: 'arvada', to: 'rmnp',     type: 'spur',  days: ['D3'],         label: 'Arvada → RMNP', miles: 70 },
    { id: 'seg-arvada-cos',      from: 'arvada', to: 'cos',      type: 'spur',  days: ['D4'],         label: 'Arvada → Colorado Springs', miles: 80 },
    { id: 'seg-arvada-denver',   from: 'arvada', to: 'denver',   type: 'spur',  days: ['D2','D5','D13'], label: 'Arvada → Denver', miles: 12 },
    // Moab local (dotted blue)
    { id: 'seg-moab-local',      from: 'moab',   to: 'moab',     type: 'local', days: ['D9'],         label: 'Moab local loop', miles: 30 }
  ];

  // Maroon Bells satellite — short dashed connector to Aspen
  const MBELLS_CONNECTOR = { from: 'aspen', to: 'mbells' };

  const DAY_DATA = {
    miles:  [25, 20, 110, 110, 10, 10, 180, 310, 30, 220, 110, 400, 15, 10, 25],
    phases: ['arvada','arvada','arvada','arvada','arvada','arvada','rt','rt','rt','rt','rt','rt','fin','fin','fin'],
    labels: [
      'D1: Arrival + car pickup',
      'D2: Red Rocks + RiNo',
      'D3: Rocky Mountain NP',
      'D4: Colorado Springs + Pikes Peak',
      'D5: Local Arvada',
      'D6: Local Arvada',
      'D7: Arvada→Aspen (Independence Pass)',
      'D8: Aspen (Maroon Bells)→Moab',
      'D9: Moab local (Arches + Dead Horse)',
      'D10: Moab→Black Canyon (Million Dollar Hwy option)',
      'D11: Black Canyon→Great Sand Dunes',
      'D12: Alamosa→Arvada',
      'D13: TBC',
      'D14: TBC',
      'D15: Airport transfer'
    ]
  };

  /* ──────────────────────────────────────────────────────────────────
     UTILITIES
  ────────────────────────────────────────────────────────────────── */

  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}) => {
    const node = document.createElementNS(ns, tag);
    for (const k in attrs) {
      if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    }
    return node;
  };

  const stopById = id => STOPS.find(s => s.id === id);

  // Build a smooth bezier between two points with a small curvature
  const curvePath = (from, to, curvature = 0.18) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    // Perpendicular offset for control point
    const offX = -dy * curvature;
    const offY =  dx * curvature;
    const cx = mx + offX;
    const cy = my + offY;
    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  };

  // Local Moab loop — small circle around Moab
  const localLoopPath = (cx, cy, r = 14) => {
    return `M ${cx-r} ${cy} a ${r} ${r} 0 1 0 ${r*2} 0 a ${r} ${r} 0 1 0 ${-r*2} 0`;
  };

  /* ──────────────────────────────────────────────────────────────────
     SVG MAP
  ────────────────────────────────────────────────────────────────── */

  const mapSvg = document.getElementById('map-svg');
  const mapTooltip = document.getElementById('map-tooltip');
  const filterStatus = document.getElementById('map-filter-status');
  const clearBtn = document.getElementById('map-clear-btn');

  let currentMapFilter = null; // array of day strings, or null

  function buildMap() {
    if (!mapSvg) return;

    // ── Background state shapes ────────────────────────────────────
    // Colorado: large rectangle in eastern half
    const co = el('path', {
      d: 'M 220 95 L 660 95 L 660 425 L 220 425 Z',
      fill: 'var(--color-map-state-co)',
      stroke: 'var(--color-map-state-stroke)',
      'stroke-width': '1.5',
      'stroke-linejoin': 'round'
    });
    mapSvg.appendChild(co);

    // Utah: rectangle to the west, slight overlap break
    const ut = el('path', {
      d: 'M 35 95 L 220 95 L 220 425 L 35 425 Z',
      fill: 'var(--color-map-state-ut)',
      stroke: 'var(--color-map-state-stroke)',
      'stroke-width': '1.5',
      'stroke-linejoin': 'round'
    });
    mapSvg.appendChild(ut);

    // ── Mountain texture (organic squiggles in central CO) ─────────
    const mountainPaths = [
      'M 280 180 Q 310 170 340 180 T 400 175 T 460 180',
      'M 260 220 Q 300 210 340 220 T 420 215',
      'M 290 260 Q 330 250 370 260 T 440 255',
      'M 250 300 Q 280 290 310 300 T 380 295',
      'M 320 340 Q 360 330 400 340 T 470 335'
    ];
    mountainPaths.forEach(d => {
      mapSvg.appendChild(el('path', {
        d, fill: 'none',
        stroke: 'var(--color-map-mountain)',
        'stroke-width': '1.5',
        'stroke-linecap': 'round',
        opacity: '0.15'
      }));
    });

    // ── State labels ───────────────────────────────────────────────
    const utLabel = el('text', {
      x: 127, y: 415,
      class: 'state-label',
      'text-anchor': 'middle'
    });
    utLabel.textContent = 'UTAH';
    mapSvg.appendChild(utLabel);

    const coLabel = el('text', {
      x: 440, y: 415,
      class: 'state-label',
      'text-anchor': 'middle'
    });
    coLabel.textContent = 'COLORADO';
    mapSvg.appendChild(coLabel);

    // ── Routes (drawn before stops so dots sit on top) ─────────────
    // We draw spurs first, main second so main is on top visually.
    const routesGroup = el('g', { id: 'routes-group' });
    mapSvg.appendChild(routesGroup);

    // Maroon Bells short connector (dashed, thin)
    const mb = stopById('mbells');
    const aspen = stopById('aspen');
    const mbConn = el('path', {
      d: `M ${aspen.x} ${aspen.y} L ${mb.x} ${mb.y}`,
      stroke: 'var(--color-map-route-spur)',
      'stroke-width': '1',
      'stroke-dasharray': '2,2',
      fill: 'none',
      opacity: '0.7'
    });
    routesGroup.appendChild(mbConn);

    ROUTES.forEach(route => {
      const from = stopById(route.from);
      const to   = stopById(route.to);
      let d;
      let strokeAttrs = {};

      if (route.type === 'main') {
        d = curvePath(from, to, 0.15);
        strokeAttrs = {
          stroke: 'var(--color-map-route-rt)',
          'stroke-width': '2.5',
          'stroke-linecap': 'round',
          fill: 'none'
        };
      } else if (route.type === 'spur') {
        d = curvePath(from, to, 0.20);
        strokeAttrs = {
          stroke: 'var(--color-map-route-spur)',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-dasharray': '4,3',
          fill: 'none'
        };
      } else if (route.type === 'local') {
        d = localLoopPath(from.x, from.y, 14);
        strokeAttrs = {
          stroke: 'var(--color-map-route-local)',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-dasharray': '2,3',
          fill: 'none'
        };
      }

      const path = el('path', {
        id: route.id,
        class: 'route',
        d,
        ...strokeAttrs,
        'data-days': route.days.join(',')
      });

      // Pre-set animation values (length used in animate())
      const length = path.getTotalLength ? 0 : 0; // set after attach below
      routesGroup.appendChild(path);
      const len = path.getTotalLength();
      path.style.strokeDasharray = strokeAttrs['stroke-dasharray'] || len;
      path.style.strokeDashoffset = len;
      path.dataset.length = len;
      path.dataset.dashOriginal = strokeAttrs['stroke-dasharray'] || '';

      // Hover/click handlers
      path.addEventListener('mouseenter', e => {
        showMapTooltip(e, `${route.label}`, `${route.days.join(', ')} · ~${route.miles} mi`);
      });
      path.addEventListener('mousemove', moveMapTooltip);
      path.addEventListener('mouseleave', hideMapTooltip);
      path.addEventListener('click', () => {
        applyMapFilter(route.days, route.label);
      });
    });

    // ── Stops ──────────────────────────────────────────────────────
    const stopsGroup = el('g', { id: 'stops-group' });
    mapSvg.appendChild(stopsGroup);

    STOPS.forEach(stop => {
      const phaseFill = `var(--color-phase-${stop.phase})`;
      const phaseStroke = `var(--color-phase-${stop.phase}-text)`;

      const dot = el('circle', {
        id: `stop-${stop.id}`,
        class: 'stop',
        cx: stop.x, cy: stop.y, r: stop.r,
        fill: phaseFill,
        stroke: phaseStroke,
        'stroke-width': '1.5'
      });
      dot.dataset.days = stop.days.join(',');
      dot.dataset.name = stop.name;

      dot.addEventListener('mouseenter', e => {
        showMapTooltip(e, stop.name, stop.days.join(', '));
      });
      dot.addEventListener('mousemove', moveMapTooltip);
      dot.addEventListener('mouseleave', hideMapTooltip);
      dot.addEventListener('click', () => {
        applyMapFilter(stop.days, stop.name);
      });

      stopsGroup.appendChild(dot);

      // Label — only for major stops on small screens
      const labelOffsetY = stop.r + 13;
      const labelY = stop.y > 350 ? stop.y - stop.r - 6 : stop.y + labelOffsetY;
      const label = el('text', {
        x: stop.x, y: labelY,
        class: 'stop-label',
        'text-anchor': 'middle'
      });
      label.textContent = stop.name;
      stopsGroup.appendChild(label);
    });
  }

  /* ── Map tooltip ───────────────────────────────────────────────── */

  function showMapTooltip(e, title, meta) {
    if (!mapTooltip) return;
    mapTooltip.innerHTML = `<div class="map-tooltip-title">${title}</div><div class="map-tooltip-meta">${meta}</div>`;
    mapTooltip.classList.add('is-visible');
    moveMapTooltip(e);
  }

  function moveMapTooltip(e) {
    if (!mapTooltip) return;
    const wrap = mapTooltip.parentElement.getBoundingClientRect();
    const x = e.clientX - wrap.left + 12;
    const y = e.clientY - wrap.top + 12;
    mapTooltip.style.left = `${x}px`;
    mapTooltip.style.top = `${y}px`;
  }

  function hideMapTooltip() {
    if (mapTooltip) mapTooltip.classList.remove('is-visible');
  }

  /* ── Map -> Day cards filter ───────────────────────────────────── */

  function applyMapFilter(days, label) {
    // Toggle off if same selection
    if (currentMapFilter && currentMapFilter.join(',') === days.join(',')) {
      clearMapFilter();
      return;
    }
    currentMapFilter = days;

    // Reset day phase tabs
    document.querySelectorAll('.day-tab').forEach(t => {
      t.classList.toggle('is-active', t.dataset.phase === 'all');
    });

    // Filter day cards
    document.querySelectorAll('.day-card').forEach(card => {
      const cardDay = card.dataset.day;
      card.classList.toggle('is-filtered-out', !days.includes(cardDay));
    });

    if (filterStatus) {
      filterStatus.textContent = `Showing: ${days.join(', ')} — ${label}`;
    }
    if (clearBtn) clearBtn.classList.add('is-visible');
  }

  function clearMapFilter() {
    currentMapFilter = null;
    document.querySelectorAll('.day-card').forEach(card => {
      card.classList.remove('is-filtered-out');
    });
    if (filterStatus) filterStatus.textContent = 'All 15 days';
    if (clearBtn) clearBtn.classList.remove('is-visible');
  }

  if (clearBtn) clearBtn.addEventListener('click', clearMapFilter);

  /* ── Animate map on intersection ───────────────────────────────── */

  function animateMap() {
    if (!mapSvg) return;
    const spurs = mapSvg.querySelectorAll('.route');
    const spurPaths = Array.from(spurs).filter(p => /spur|local/.test(p.getAttribute('stroke-dasharray') || '') || ['seg-arvada-redrocks','seg-arvada-rmnp','seg-arvada-cos','seg-arvada-denver','seg-moab-local'].includes(p.id));
    const mainOrder = ['seg-arvada-aspen','seg-aspen-moab','seg-moab-montrose','seg-montrose-dunes','seg-dunes-arvada'];

    // Spurs draw simultaneously
    spurPaths.forEach(p => animatePath(p, 800, 0));

    // Main loop in sequence
    mainOrder.forEach((id, i) => {
      const p = mapSvg.querySelector(`#${id}`);
      if (!p) return;
      animatePath(p, 600, 800 + i * 350, () => {
        // Pulse the destination stop
        const route = ROUTES.find(r => r.id === id);
        if (route) {
          const dot = mapSvg.querySelector(`#stop-${route.to}`);
          if (dot) {
            dot.classList.remove('is-pulse');
            void dot.offsetWidth;
            dot.classList.add('is-pulse');
          }
        }
      });
    });
  }

  function animatePath(path, duration, delay, onDone) {
    const len = parseFloat(path.dataset.length) || path.getTotalLength();
    const original = path.dataset.dashOriginal || '';
    path.style.transition = 'none';
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    setTimeout(() => {
      path.style.transition = `stroke-dashoffset ${duration}ms ease-out`;
      path.style.strokeDashoffset = '0';
      setTimeout(() => {
        // Restore the original dash pattern (for spurs/local)
        if (original) {
          path.style.transition = 'none';
          path.style.strokeDasharray = original;
          path.style.strokeDashoffset = '0';
        }
        if (onDone) onDone();
      }, duration);
    }, delay);
  }

  // Intersection Observer for map
  if (mapSvg && 'IntersectionObserver' in window) {
    const mapObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateMap();
          mapObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    mapObserver.observe(mapSvg);
  }

  /* ──────────────────────────────────────────────────────────────────
     DAY CARDS — expand/collapse + map-pulse on open
  ────────────────────────────────────────────────────────────────── */

  document.querySelectorAll('.day-photo').forEach(photo => {
    photo.addEventListener('click', () => {
      const card = photo.closest('.day-card');
      if (!card) return;
      const wasOpen = card.classList.toggle('is-open');
      if (wasOpen) {
        // Pulse stops associated with this day
        const day = card.dataset.day;
        STOPS.forEach(stop => {
          if (stop.days.includes(day)) {
            const dot = mapSvg && mapSvg.querySelector(`#stop-${stop.id}`);
            if (dot) {
              dot.classList.remove('is-pulse');
              void dot.offsetWidth;
              dot.classList.add('is-pulse');
            }
          }
        });
      }
    });
  });

  /* ──────────────────────────────────────────────────────────────────
     PHASE TABS — filter day cards
  ────────────────────────────────────────────────────────────────── */

  document.querySelectorAll('.day-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const phase = tab.dataset.phase;
      document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      // Clear map filter state
      currentMapFilter = null;
      if (clearBtn) clearBtn.classList.remove('is-visible');

      document.querySelectorAll('.day-card').forEach(card => {
        if (phase === 'all') {
          card.classList.remove('is-filtered-out');
        } else {
          card.classList.toggle('is-filtered-out', card.dataset.phase !== phase);
        }
      });

      if (filterStatus) {
        const labels = { all: 'All 15 days', arvada: 'Arvada D1–D6', rt: 'Road trip D7–D12', fin: 'End of stay D13–D15' };
        filterStatus.textContent = labels[phase] || 'All 15 days';
      }
    });
  });

  /* ──────────────────────────────────────────────────────────────────
     DRIVING DISTANCE CHART
  ────────────────────────────────────────────────────────────────── */

  const chartSvg = document.getElementById('chart-svg');
  const chartTooltip = document.getElementById('chart-tooltip');
  const unitButtons = document.querySelectorAll('.unit-toggle button');
  let currentUnit = 'mi';

  const W = 700, H = 280;
  const PAD = { top: 30, right: 20, bottom: 36, left: 44 };
  const CHART_W = W - PAD.left - PAD.right;
  const CHART_H = H - PAD.top - PAD.bottom;
  const N_DAYS = 15;
  const BAR_GAP = 8;
  const BAR_W = (CHART_W - BAR_GAP * (N_DAYS - 1)) / N_DAYS;

  function buildChart() {
    if (!chartSvg) return;
    chartSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    chartSvg.innerHTML = ''; // reset

    const data = currentUnit === 'mi'
      ? DAY_DATA.miles
      : DAY_DATA.miles.map(m => Math.round(m * 1.60934));

    const maxRaw = Math.max(...data);
    // Round max up to a nice value
    const niceMax = currentUnit === 'mi'
      ? Math.ceil(maxRaw / 100) * 100
      : Math.ceil(maxRaw / 100) * 100;
    const yMax = Math.max(niceMax, 100);

    const avg = data.reduce((a, b) => a + b, 0) / data.length;

    // ── Y axis grid + labels ───────────────────────────────────────
    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const v = (yMax / yTicks) * i;
      const y = PAD.top + CHART_H - (v / yMax) * CHART_H;
      const line = el('line', {
        class: 'y-grid',
        x1: PAD.left, x2: PAD.left + CHART_W,
        y1: y, y2: y
      });
      chartSvg.appendChild(line);

      const label = el('text', {
        class: 'axis-label',
        x: PAD.left - 8, y: y + 3,
        'text-anchor': 'end'
      });
      label.textContent = Math.round(v);
      chartSvg.appendChild(label);
    }

    // Unit label on Y axis
    const unitLabel = el('text', {
      class: 'axis-label',
      x: PAD.left - 8, y: PAD.top - 12,
      'text-anchor': 'end',
      'font-weight': '600'
    });
    unitLabel.textContent = currentUnit;
    chartSvg.appendChild(unitLabel);

    // ── Bars ───────────────────────────────────────────────────────
    data.forEach((v, i) => {
      const x = PAD.left + i * (BAR_W + BAR_GAP);
      const fullH = (v / yMax) * CHART_H;
      const y = PAD.top + CHART_H - fullH;

      const g = el('g', { class: 'bar', 'data-day': `D${i+1}` });
      const rect = el('rect', {
        class: 'bar-rect',
        x, y, width: BAR_W, height: fullH,
        rx: 3,
        fill: `var(--color-phase-${DAY_DATA.phases[i]})`
      });

      // Animation: scale from 0 height
      rect.style.transformOrigin = `${x + BAR_W/2}px ${PAD.top + CHART_H}px`;
      rect.style.transform = 'scaleY(0)';
      rect.style.transition = `transform 700ms ease-out ${i * 50}ms`;

      g.appendChild(rect);

      // Day label below
      const dayLabel = el('text', {
        class: 'axis-label',
        x: x + BAR_W / 2,
        y: PAD.top + CHART_H + 16,
        'text-anchor': 'middle'
      });
      dayLabel.textContent = `D${i+1}`;
      g.appendChild(dayLabel);

      // Hover area (transparent overlay above the bar, full chart height)
      const hover = el('rect', {
        x, y: PAD.top, width: BAR_W, height: CHART_H,
        fill: 'transparent'
      });
      hover.addEventListener('mouseenter', e => {
        showChartTooltip(e, i, v);
      });
      hover.addEventListener('mousemove', moveChartTooltip);
      hover.addEventListener('mouseleave', hideChartTooltip);
      g.appendChild(hover);

      chartSvg.appendChild(g);
    });

    // ── Average line ───────────────────────────────────────────────
    const avgY = PAD.top + CHART_H - (avg / yMax) * CHART_H;
    const avgLine = el('line', {
      class: 'avg-line',
      x1: PAD.left, x2: PAD.left + CHART_W,
      y1: avgY, y2: avgY
    });
    chartSvg.appendChild(avgLine);

    const avgLabel = el('text', {
      class: 'avg-label',
      x: PAD.left + CHART_W - 4, y: avgY - 6,
      'text-anchor': 'end'
    });
    avgLabel.textContent = `Avg ${Math.round(avg)} ${currentUnit}`;
    chartSvg.appendChild(avgLabel);
  }

  function showChartTooltip(e, i, v) {
    if (!chartTooltip) return;
    chartTooltip.innerHTML = `<strong>${DAY_DATA.labels[i]}</strong>${v} ${currentUnit}`;
    chartTooltip.classList.add('is-visible');
    moveChartTooltip(e);
  }
  function moveChartTooltip(e) {
    if (!chartTooltip) return;
    const wrap = chartTooltip.parentElement.getBoundingClientRect();
    const x = e.clientX - wrap.left + 14;
    const y = e.clientY - wrap.top + 14;
    chartTooltip.style.left = `${x}px`;
    chartTooltip.style.top = `${y}px`;
  }
  function hideChartTooltip() {
    if (chartTooltip) chartTooltip.classList.remove('is-visible');
  }

  // Unit toggle
  unitButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentUnit = btn.dataset.unit;
      unitButtons.forEach(b => b.classList.toggle('is-active', b === btn));
      buildChart();
      // Re-animate after unit change
      requestAnimationFrame(() => animateChart());
    });
  });

  function animateChart() {
    if (!chartSvg) return;
    chartSvg.querySelectorAll('.bar-rect').forEach(rect => {
      requestAnimationFrame(() => {
        rect.style.transform = 'scaleY(1)';
      });
    });
  }

  if (chartSvg && 'IntersectionObserver' in window) {
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateChart();
          chartObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    chartObserver.observe(chartSvg);
  }

  /* ──────────────────────────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────────────────────────── */

  buildMap();
  buildChart();

  // Set live dates in hero / footer
  const today = new Date();
  const fmt = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  document.querySelectorAll('[data-auto-date]').forEach(n => { n.textContent = fmt; });
})();
