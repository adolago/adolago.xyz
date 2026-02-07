(() => {
  const chart = document.querySelector('[data-uptime-chart]');
  if (!chart) return;

  const avgEl = document.querySelector('[data-uptime-avg]');
  const DAYS = 90;
  const STEP = 86400;
  const QUERY = 'avg_over_time(up{job="node-exporter"}[1d])';

  function classForValue(v) {
    if (v === null) return 'no-data';
    if (v >= 1) return 'up';
    if (v >= 0.95) return 'degraded';
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

  function buildBars(slots) {
    const frag = document.createDocumentFragment();
    let tooltip = null;

    for (let i = 0; i < slots.length; i++) {
      const bar = document.createElement('div');
      bar.className = 'bar ' + classForValue(slots[i].value);
      bar.setAttribute('aria-label', `${formatDate(slots[i].ts)}: ${formatPct(slots[i].value)}`);

      bar.addEventListener('mouseenter', (e) => {
        if (tooltip) tooltip.remove();
        tooltip = document.createElement('div');
        tooltip.className = 'uptime-tooltip';
        tooltip.textContent = `${formatDate(slots[i].ts)} — ${formatPct(slots[i].value)}`;
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
    const valid = slots.filter(s => s.value !== null);
    if (valid.length === 0) return null;
    const sum = valid.reduce((a, s) => a + s.value, 0);
    return sum / valid.length;
  }

  async function init() {
    const now = Math.floor(Date.now() / 1000);
    const start = now - DAYS * STEP;

    const url = '/api/prometheus/query_range'
      + '?query=' + encodeURIComponent(QUERY)
      + '&start=' + start
      + '&end=' + now
      + '&step=' + STEP;

    let values = [];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status === 'success' && json.data?.result?.length > 0) {
        values = json.data.result[0].values;
      }
    } catch {
      // Fetch failed — render all no-data bars
    }

    // Build a map of timestamp → value
    const valueMap = new Map();
    for (const [ts, val] of values) {
      // Round to day boundary
      const dayTs = Math.floor(ts / STEP) * STEP;
      valueMap.set(dayTs, parseFloat(val));
    }

    // Generate 90 day slots
    const slots = [];
    for (let i = 0; i < DAYS; i++) {
      const dayTs = Math.floor((start + i * STEP) / STEP) * STEP;
      const v = valueMap.get(dayTs);
      slots.push({ ts: dayTs, value: v !== undefined ? v : null });
    }

    buildBars(slots);

    const avg = computeAvg(slots);
    if (avgEl) {
      avgEl.textContent = avg !== null ? formatPct(avg) + ' avg' : 'No data';
    }
  }

  init();
})();
