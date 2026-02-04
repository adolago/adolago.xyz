(() => {
  const selectors = {
    dot: '[data-edge-status-dot]',
    title: '[data-edge-status-title]',
    subtitle: '[data-edge-status-subtitle]',
    uptimeFill: '[data-edge-uptime-fill]',
    uptimeText: '[data-edge-uptime-text]',
    updatedAt: '[data-edge-updated-at]',
  };

  const elements = {
    dots: [...document.querySelectorAll(selectors.dot)],
    titles: [...document.querySelectorAll(selectors.title)],
    subtitles: [...document.querySelectorAll(selectors.subtitle)],
    uptimeFills: [...document.querySelectorAll(selectors.uptimeFill)],
    uptimeTexts: [...document.querySelectorAll(selectors.uptimeText)],
    updatedAts: [...document.querySelectorAll(selectors.updatedAt)],
  };

  const hasAnyTarget = Object.values(elements).some((arr) => arr.length > 0);
  if (!hasAnyTarget) return;

  const STATUS_URL = '/api/status.json';
  const POLL_MS = 15000;
  const FETCH_TIMEOUT_MS = 2500;
  const UPTIME_METER_MAX_SECONDS = 7 * 24 * 60 * 60; // 7 days

  function setAll(nodes, text) {
    for (const node of nodes) node.textContent = text;
  }

  function setDots(state) {
    for (const dot of elements.dots) {
      dot.classList.remove('online', 'offline');
      if (state === 'online') dot.classList.add('online');
      if (state === 'offline') dot.classList.add('offline');
    }
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--';
    const s = Math.floor(seconds);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function formatUpdatedAt(isoString) {
    if (!isoString) return '--';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function setUptimeFill(uptimeSeconds) {
    const clamped = Math.max(0, Math.min(uptimeSeconds, UPTIME_METER_MAX_SECONDS));
    const pct = (clamped / UPTIME_METER_MAX_SECONDS) * 100;
    for (const fill of elements.uptimeFills) fill.style.width = `${pct.toFixed(1)}%`;
  }

  function setOnline({ uptimeSeconds, generatedAt }) {
    setDots('online');
    setAll(elements.titles, 'Edge: Online');
    setAll(elements.subtitles, 'Edge gateway responding');
    setAll(elements.uptimeTexts, `Uptime: ${formatDuration(uptimeSeconds)}`);
    setAll(elements.updatedAts, `Updated: ${formatUpdatedAt(generatedAt)}`);
    setUptimeFill(uptimeSeconds);
  }

  function setOffline(message) {
    setDots('offline');
    setAll(elements.titles, 'Edge: Offline');
    setAll(elements.subtitles, message || 'Status endpoint unreachable');
    setAll(elements.uptimeTexts, 'Uptime: --');
    setAll(elements.updatedAts, 'Updated: --');
    setUptimeFill(0);
  }

  async function fetchStatus() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${STATUS_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function poll() {
    try {
      const data = await fetchStatus();
      const ok = data && data.ok === true;
      const uptimeSeconds = typeof data?.uptime_seconds === 'number' ? data.uptime_seconds : null;
      const generatedAt = typeof data?.generated_at === 'string' ? data.generated_at : null;

      if (!ok || uptimeSeconds === null) {
        setOffline('Invalid status payload');
        return;
      }
      setOnline({ uptimeSeconds, generatedAt });
    } catch (err) {
      const msg = err?.name === 'AbortError' ? 'Timed out' : 'Fetch failed';
      setOffline(msg);
    }
  }

  poll();
  setInterval(poll, POLL_MS);
})();
