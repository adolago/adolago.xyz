(() => {
  const chart = document.querySelector('[data-uptime-chart]');
  if (!chart) return;

  const avgEl = document.querySelector('[data-uptime-avg]');
  const DAYS = 90;
  const STEP = 86400;
  const LIVE_STEP = 300;
  const REFRESH_MS = 30000;
  const DEFAULT_QUERY = 'avg_over_time(probe_success[1d])';
  const STATUS_URL = '/api/status.json';
  // Unified color thresholds for all days (including today) to avoid day-rollover color flips.
  const UPTIME_THRESHOLDS = { up: 0.95, degraded: 0.75 };
  let refreshInFlight = false;
  let refreshTimer = null;

  function resolveQuery() {
    const fromAttr = chart.getAttribute('data-uptime-query');
    if (typeof fromAttr === 'string' && fromAttr.trim()) return fromAttr.trim();

    const fromGlobal = typeof window.EDGE_UPTIME_QUERY === 'string' ? window.EDGE_UPTIME_QUERY : '';
    if (fromGlobal.trim()) return fromGlobal.trim();

    return DEFAULT_QUERY;
  }

  function classForValue(v) {
    if (v === null) return 'no-data';

    if (v >= UPTIME_THRESHOLDS.up) return 'up';
    if (v >= UPTIME_THRESHOLDS.degraded) return 'degraded';
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

  function formatLiveStamp(ts) {
    return new Date(ts * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function buildBars(slots, currentDayTs) {
    const frag = document.createDocumentFragment();
    let tooltip = null;

    for (let i = 0; i < slots.length; i++) {
      const isCurrentDay = slots[i].ts === currentDayTs;
      const dayLabel = isCurrentDay ? 'Today (live)' : formatDate(slots[i].ts);

      const bar = document.createElement('div');
      bar.className = 'bar ' + classForValue(slots[i].value);
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

  function resolveLiveTodayQuery(query) {
    const match = query.match(/^\s*avg_over_time\((.+)\[1d\]\)\s*$/);
    if (match && match[1]) {
      return match[1].trim();
    }
    return query;
  }

  function computeLiveTodayRatioFromSeries(series, currentDayTs, nowTs) {
    const pointMinMap = new Map();

    for (const result of series) {
      if (!Array.isArray(result?.values)) continue;

      for (const point of result.values) {
        if (!Array.isArray(point) || point.length < 2) continue;

        const ts = Number(point[0]);
        const val = parseFloat(point[1]);
        if (!Number.isFinite(ts) || !Number.isFinite(val)) continue;
        if (ts < currentDayTs || ts > nowTs) continue;

        const prev = pointMinMap.get(ts);
        if (prev === undefined || val < prev) {
          pointMinMap.set(ts, Math.max(0, Math.min(1, val)));
        }
      }
    }

    if (pointMinMap.size === 0) return null;
    const values = Array.from(pointMinMap.values());
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
  }

  function computeTodayRatioFromStatus(uptimeSeconds, currentDayTs, nowTs) {
    if (!Number.isFinite(uptimeSeconds) || uptimeSeconds <= 0) return null;

    const uptimeStart = nowTs - uptimeSeconds;
    const overlapStart = Math.max(currentDayTs, uptimeStart);
    const overlap = nowTs - overlapStart;
    if (overlap <= 0) return null;

    const elapsedToday = Math.max(1, nowTs - currentDayTs);
    return Math.max(0, Math.min(1, overlap / elapsedToday));
  }

  function backfillSlotsFromCurrentUptime(slots, uptimeSeconds, nowTs) {
    if (!Number.isFinite(uptimeSeconds) || uptimeSeconds <= 0) return 0;

    const currentDayTs = Math.floor(nowTs / STEP) * STEP;
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

      const denominator = dayStart === currentDayTs
        ? Math.max(1, nowTs - currentDayTs)
        : STEP;
      slot.value = Math.max(0, Math.min(1, overlap / denominator));
      filled += 1;
    }

    return filled;
  }

  async function refresh() {
    if (refreshInFlight) return;
    refreshInFlight = true;

    const now = Math.floor(Date.now() / 1000);
    const currentDayTs = Math.floor(now / STEP) * STEP;
    const start = currentDayTs - (DAYS - 1) * STEP;
    const query = resolveQuery();
    const liveTodayQuery = resolveLiveTodayQuery(query);

    const url = '/api/prometheus/query_range'
      + '?query=' + encodeURIComponent(query)
      + '&start=' + start
      + '&end=' + now
      + '&step=' + STEP;

    const liveTodayUrl = '/api/prometheus/query_range'
      + '?query=' + encodeURIComponent(liveTodayQuery)
      + '&start=' + currentDayTs
      + '&end=' + now
      + '&step=' + LIVE_STEP;

    const [promResult, statusUptimeSeconds, liveTodayResult] = await Promise.all([
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
      (async () => {
        try {
          const res = await fetch(liveTodayUrl);
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
    ]);

    try {
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

      const todaySlot = slots.find((slot) => slot.ts === currentDayTs);
      const liveTodayRatio = computeLiveTodayRatioFromSeries(liveTodayResult.series, currentDayTs, now);
      const statusTodayRatio = computeTodayRatioFromStatus(statusUptimeSeconds, currentDayTs, now);
      if (todaySlot) {
        if (liveTodayRatio !== null) {
          todaySlot.value = liveTodayRatio;
        } else if (statusTodayRatio !== null) {
          todaySlot.value = statusTodayRatio;
        }
      }

      chart.textContent = '';
      buildBars(slots, currentDayTs);

      const { avg, sampledCount } = computeAvg(slots);
      const sampledCoverage = `(${sampledCount}/${slots.length} days sampled)`;
      if (avgEl) {
        const liveStamp = formatLiveStamp(now);
        avgEl.textContent = avg !== null
          ? `${formatPct(avg)} avg ${sampledCoverage} · live ${liveStamp}`
          : `No data ${sampledCoverage} · live ${liveStamp}`;

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

        if (liveTodayRatio !== null) {
          const existingTitle = avgEl.getAttribute('title');
          const liveNote = 'Today uses live probe samples from midnight to now.';
          avgEl.title = existingTitle ? `${existingTitle} ${liveNote}` : liveNote;
        } else if (statusTodayRatio !== null) {
          const existingTitle = avgEl.getAttribute('title');
          const fallbackNote = 'Today is estimated from status uptime because live probe samples were unavailable.';
          avgEl.title = existingTitle ? `${existingTitle} ${fallbackNote}` : fallbackNote;
        }

        if (includesCurrentDay) {
          const existingTitle = avgEl.getAttribute('title');
          const thresholdsNote = 'Color thresholds: green >= 95%, orange >= 75%, red < 75%.';
          avgEl.title = existingTitle ? `${existingTitle} ${thresholdsNote}` : thresholdsNote;
        }
      }
    } finally {
      refreshInFlight = false;
    }
  }

  function start() {
    refresh();
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, REFRESH_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  start();
})();
