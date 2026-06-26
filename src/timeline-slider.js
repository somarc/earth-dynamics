import { formatDate } from './utils.js';

function yearOf(dateStr) {
  return Number.parseInt(dateStr.slice(0, 4), 10);
}

function findIndexOnOrAfter(dates, target) {
  let lo = 0;
  let hi = dates.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (dates[mid] >= target) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return best;
}

export function buildDecadeTicks(dates) {
  if (!dates?.length) return [];

  const startYear = yearOf(dates[0]);
  const endYear = yearOf(dates.at(-1));
  const firstDecade = Math.ceil(startYear / 10) * 10;
  const ticks = [{ year: startYear, index: 0 }];

  for (let year = firstDecade; year <= endYear; year += 10) {
    const idx = findIndexOnOrAfter(dates, `${year}-01-01`);
    if (idx < 0 || idx === ticks[ticks.length - 1]?.index) continue;
    ticks.push({ year, index: idx });
  }

  const lastIdx = dates.length - 1;
  if (ticks.at(-1).index !== lastIdx) {
    ticks.push({ year: endYear, index: lastIdx });
  }

  const maxIdx = Math.max(1, dates.length - 1);
  return ticks.map((t) => ({
    ...t,
    pct: (t.index / maxIdx) * 100,
  }));
}

export function timelineMeta(dates, index) {
  const total = dates.length;
  const idx = Math.max(0, Math.min(index, total - 1));
  const date = dates[idx];
  const startYear = yearOf(dates[0]);
  const year = yearOf(date);
  const yearsElapsed = year - startYear;
  const spanYears = yearOf(dates.at(-1)) - startYear;
  const pct = total > 1 ? Math.round((idx / (total - 1)) * 100) : 0;

  return {
    date,
    formatted: formatDate(date),
    year,
    yearsElapsed,
    spanYears,
    pct,
    index: idx,
    total,
    iso: date,
  };
}

function renderTicks(ticksEl, ticks) {
  ticksEl.innerHTML = ticks
    .map(
      (t) => `
        <span class="timeline-tick" style="left:${t.pct.toFixed(3)}%" title="${t.year}">
          <span class="timeline-tick__mark"></span>
          <span class="timeline-tick__label">${t.year}</span>
        </span>`,
    )
    .join('');
}

export function createTimelineSlider({ dates, slider, ticksEl, fillEl, dateEl, metaEl }) {
  const ticks = buildDecadeTicks(dates);
  renderTicks(ticksEl, ticks);

  const update = (index) => {
    const meta = timelineMeta(dates, index);
    const maxIdx = Math.max(1, dates.length - 1);
    const pct = (meta.index / maxIdx) * 100;

    slider.value = String(meta.index);
    slider.setAttribute('aria-valuenow', String(meta.index));
    slider.setAttribute('aria-valuetext', `${meta.formatted} (${meta.pct}% through timeline)`);

    if (fillEl) fillEl.style.width = `${pct}%`;
    if (dateEl) dateEl.textContent = meta.formatted;
    if (metaEl) {
      metaEl.textContent = `${meta.year} · ${meta.pct}% · +${meta.yearsElapsed}y from ${yearOf(dates[0])}`;
    }

    ticksEl.querySelectorAll('.timeline-tick').forEach((el) => {
      const tickYear = Number.parseInt(el.title, 10);
      el.classList.toggle('timeline-tick--near', Math.abs(tickYear - meta.year) < 6);
    });

    return meta;
  };

  return { ticks, update };
}