(() => {
  const chart = document.querySelector('[data-uptime-chart]');
  if (!chart) return;

  const avgEl = document.querySelector('[data-uptime-avg]');
  const DAYS = 90;
  const STEP = 86400;
  const DEFAULT_QUERY = 'avg_over_time(probe_success[1d])';
  const STATUS_URL = '/api/status.json';
  const FULL_DAY_THRESHOLDS = { up: 1.0, degraded: 0.95 };
  const IN_PROGRESS_THRESHOLDS = { up: 0.95, degraded: 0.75 };

  function resolveQuery() {
    const fromAttr = chart.getAttribute('data-uptime-query');
    if (typeof fromAttr === 'string' && fromAttr.trim()) return fromAttr.trim();

    const fromGlobal = typeof window.EDGE_UPTIME_QUERY === 'string' ? window.EDGE_UPTIME_QUERY : '';
    if (fromGlobal.trim()) return fromGlobal.trim();

    return DEFAULT_QUERY;
  }

  function classForValue(v, { inProgress = false } = {}) {
    if (v === null) return 'no-data';

    const thresholds = inProgress ? IN_PROGRESS_THRESHOLDS : FULL_DAY_THRESHOLDS;
    if (v >= thresholds.up) return 'up';
    if (v >= thresholds.degraded) return 'degraded';
    return 'down';
  }

  function formatDate(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatPct(v) {
    if (v === null) return 'No data';
    return (v * 100).toFixed(2) + '%';
  }

  function buildBars(slots, currentDayTs) {
    const frag = document.createDocumentFragment();
    let tooltip = null;

    for (let i = 0; i < slots.length; i++) {
      const isCurrentDay = slots[i].ts === currentDayTs;
      const dayLabel = isCurrentDay ? 'Today (in progress)' : formatDate(slots[i].ts);

      const bar = document.createElement('div');
      bar.className = 'bar ' + classForValue(slots[i].value, { inProgress: isCurrentDay });
      bar.setAttribute('aria-label', `${dayLabel}: ${formatPct(slots[i].value)}`);

      bar.addEventListener('mouseenter', () => {
        if (tooltip) tooltip.remove();
        tooltip = document.createElement('div');
        tooltip.className = 'uptime-tooltip';
        tooltip.textContent = `${dayLabel} — ${formatPct(slots[i].value)}`;
        chart.appendChild(tooltip);

        const barRect = bar.getBoundingClientRect();
        const chartRect = chart.getBoundingClientRect();
        tooltip.style.left = (barRect.left - chartRect.left + barRect.width / 2) + 'px';
      });

      bar.addEventListener('mouseleave', () => {
        if (tooltip) { tooltip.remove(); tooltip = null; }
      });

      frag.appendChild(bar);
    }

    chart.appendChild(frag);
  }

  function computeAvg(slots) {
    const sampled = slots.filter((slot) => slot.value !== null);
    if (sampled.length === 0) return { avg: null, sampledCount: 0 };

    const sum = sampled.reduce((acc, slot) => acc + slot.value, 0);
    return {
      avg: sum / sampled.length,
      sampledCount: sampled.length,
    };
  }

  async function fetchStatusUptime() {
    try {
      const res = await fetch(`${STATUS_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;

      const json = await res.json();
      if (json?.ok !== true) return null;

      const uptimeSeconds = typeof json?.uptime_seconds === 'number' ? json.uptime_seconds : null;
      if (!Number.isFinite(uptimeSeconds) || uptimeSeconds < 0) return null;

      return uptimeSeconds;
    } catch {
      return null;
    }
  }

  function backfillSlotsFromCurrentUptime(slots, uptimeSeconds, nowTs) {
    if (!Number.isFinite(uptimeSeconds) || uptimeSeconds <= 0) return 0;

    const uptimeStart = nowTs - uptimeSeconds;
    let filled = 0;

    for (const slot of slots) {
      if (slot.value !== null) continue;

      const dayStart = slot.ts;
      const dayEnd = dayStart + STEP;
      const overlapStart = Math.max(dayStart, uptimeStart);
      const overlapEnd = Math.min(dayEnd, nowTs);
      const overlap = overlapEnd - overlapStart;

      if (overlap <= 0) continue;

      slot.value = Math.max(0, Math.min(1, overlap / STEP));
      filled += 1;
    }

    return filled;
  }

  async function init() {
    const now = Math.floor(Date.now() / 1000);
    const currentDayTs = Math.floor(now / STEP) * STEP;
    const start = currentDayTs - (DAYS - 1) * STEP;
    const query = resolveQuery();

    const url = '/api/prometheus/query_range'
      + '?query=' + encodeURIComponent(query)
      + '&start=' + start
      + '&end=' + now
      + '&step=' + STEP;

    const [promResult, statusUptimeSeconds] = await Promise.all([
      (async () => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          if (json.status === 'success' && json.data?.result?.length > 0) {
            return { series: json.data.result, fetchFailed: false };
          }
          return { series: [], fetchFailed: false };
        } catch {
          return { series: [], fetchFailed: true };
        }
      })(),
      fetchStatusUptime(),
    ]);

    const series = promResult.series;
    const fetchFailed = promResult.fetchFailed;

    // Build a map of timestamp → value using the daily minimum across series.
    const valueMap = new Map();
    for (const result of series) {
      if (!Array.isArray(result?.values)) continue;

      for (const point of result.values) {
        if (!Array.isArray(point) || point.length < 2) continue;

        const ts = Number(point[0]);
        const val = parseFloat(point[1]);
        if (!Number.isFinite(ts) || !Number.isFinite(val)) continue;

        const dayTs = Math.floor(ts / STEP) * STEP;
        const prev = valueMap.get(dayTs);
        if (prev === undefined || val < prev) {
          valueMap.set(dayTs, val);
        }
      }
    }

    // Generate 90 day slots
    const slots = [];
    for (let i = 0; i < DAYS; i++) {
      const dayTs = start + i * STEP;
      const v = valueMap.get(dayTs);
      slots.push({ ts: dayTs, value: v !== undefined ? v : null });
    }

    const backfilledCount = backfillSlotsFromCurrentUptime(slots, statusUptimeSeconds, now);

    buildBars(slots, currentDayTs);

    const { avg, sampledCount } = computeAvg(slots);
    const sampledCoverage = `(${sampledCount}/${slots.length} days sampled)`;
    if (avgEl) {
      avgEl.textContent = avg !== null
        ? `${formatPct(avg)} avg ${sampledCoverage}`
        : `No data ${sampledCoverage}`;

      const includesCurrentDay = slots.some((slot) => slot.ts === currentDayTs && slot.value !== null);

      if (fetchFailed && backfilledCount > 0) {
        avgEl.title = 'Prometheus query failed; recent days estimated from current uptime. No-data days are excluded from the average.';
      } else if (fetchFailed) {
        avgEl.title = 'Prometheus query failed; no-data days are excluded from the average.';
      } else if (valueMap.size === 0 && backfilledCount > 0) {
        avgEl.title = 'Probe history is still building; recent days estimated from current uptime. No-data days are excluded from the average.';
      } else if (valueMap.size === 0) {
        avgEl.title = 'No uptime samples returned yet.';
      } else if (sampledCount < slots.length) {
        avgEl.title = 'Average uses sampled days only; no-data days are excluded.';
      } else {
        avgEl.removeAttribute('title');
      }

      if (includesCurrentDay) {
        const existingTitle = avgEl.getAttribute('title');
        const inProgressNote = 'Includes today (in progress). Today uses relaxed thresholds: green >= 95%, orange >= 75%, red < 75%.';
        if (existingTitle) {
          avgEl.title = `${existingTitle} ${inProgressNote}`;
        } else {
          avgEl.title = inProgressNote;
        }
      } else {
        const existingTitle = avgEl.getAttribute('title');
        if (existingTitle === 'Includes today (in progress). Today uses relaxed thresholds: green >= 95%, orange >= 75%, red < 75%.') {
          avgEl.removeAttribute('title');
        }
      }
    }
  }

  init();
})();
