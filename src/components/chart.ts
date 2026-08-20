/**
 * @module components/chart
 * Canvas-based chart components (no external dependencies).
 */

import { formatCurrency } from '../utils/currency.ts';

/** Color palette for charts */
const CHART_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#a855f7', // Purple
];

export interface ChartDataItem {
  label: string;
  value: number;
  color?: string;
}

/**
 * Create a donut chart.
 */
export function createDonutChart(
  items: ChartDataItem[],
  opts: { size?: number; centerLabel?: string; centerValue?: string } = {},
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'chart-container';
  container.style.aspectRatio = '1';
  container.style.maxWidth = `${opts.size ?? 280}px`;
  container.style.margin = '0 auto';

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  const size = opts.size ?? 280;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const total = items.reduce((sum, item) => sum + Math.abs(item.value), 0);
  if (total === 0) {
    // Draw empty state
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = size * 0.18;
    ctx.stroke();
  } else {
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const lineWidth = size * 0.18;
    let startAngle = -Math.PI / 2;

    items.forEach((item, i) => {
      if (Math.abs(item.value) === 0) return;
      const sliceAngle = (Math.abs(item.value) / total) * Math.PI * 2;
      const color = item.color ?? CHART_COLORS[i % CHART_COLORS.length];

      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'butt';
      ctx.stroke();

      startAngle += sliceAngle;
    });
  }

  // Center text
  if (opts.centerValue) {
    const cx = size / 2;
    const cy = size / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#f1f5f9';
    ctx.font = `700 ${size * 0.1}px 'JetBrains Mono', monospace`;
    ctx.fillText(opts.centerValue, cx, cy - (opts.centerLabel ? 8 : 0));

    if (opts.centerLabel) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = `400 ${size * 0.055}px 'Inter', sans-serif`;
      ctx.fillText(opts.centerLabel, cx, cy + 16);
    }
  }

  // Legend
  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.style.justifyContent = 'center';
  legend.style.marginTop = '16px';

  items.forEach((item, i) => {
    if (Math.abs(item.value) === 0) return;
    const color = item.color ?? CHART_COLORS[i % CHART_COLORS.length];
    const el = document.createElement('div');
    el.className = 'chart-legend__item';
    el.innerHTML = `
      <span class="chart-legend__dot" style="background:${color}"></span>
      <span>${item.label}</span>
    `;
    legend.appendChild(el);
  });

  const wrapper = document.createElement('div');
  wrapper.appendChild(container);
  wrapper.appendChild(legend);
  return wrapper;
}

/**
 * Create a horizontal bar chart.
 */
export function createBarChart(
  items: ChartDataItem[],
  opts: { maxWidth?: number; showValues?: boolean } = {},
): HTMLElement {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '12px';
  container.style.maxWidth = `${opts.maxWidth ?? 600}px`;

  const maxValue = Math.max(...items.map((i) => Math.abs(i.value)), 1);

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    const label = document.createElement('span');
    label.style.cssText =
      'font-size:0.8rem;color:var(--text-secondary);min-width:120px;text-align:right;';
    label.textContent = item.label;

    const barBg = document.createElement('div');
    barBg.style.cssText =
      'flex:1;height:28px;background:var(--bg-input);border-radius:6px;overflow:hidden;position:relative;';

    const bar = document.createElement('div');
    const pct = (Math.abs(item.value) / maxValue) * 100;
    const color = item.color ?? CHART_COLORS[i % CHART_COLORS.length];
    bar.style.cssText = `height:100%;width:0%;background:${color};border-radius:6px;transition:width 800ms cubic-bezier(0.34,1.56,0.64,1);`;
    barBg.appendChild(bar);

    // Animate in
    requestAnimationFrame(() => {
      setTimeout(() => {
        bar.style.width = `${pct}%`;
      }, i * 80);
    });

    row.appendChild(label);
    row.appendChild(barBg);

    if (opts.showValues !== false) {
      const val = document.createElement('span');
      val.style.cssText =
        'font-family:var(--font-mono);font-size:0.8rem;color:var(--text-primary);min-width:80px;';
      val.textContent = formatCurrency(item.value);
      row.appendChild(val);
    }

    container.appendChild(row);
  });

  return container;
}

/**
 * Create a simple stacked percentage bar.
 */
export function createStackedBar(
  items: ChartDataItem[],
): HTMLElement {
  const total = items.reduce((s, i) => s + Math.abs(i.value), 0);
  const container = document.createElement('div');
  container.style.cssText =
    'display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--bg-input);';

  if (total > 0) {
    items.forEach((item, i) => {
      if (Math.abs(item.value) === 0) return;
      const pct = (Math.abs(item.value) / total) * 100;
      const seg = document.createElement('div');
      const color = item.color ?? CHART_COLORS[i % CHART_COLORS.length];
      seg.style.cssText = `width:${pct}%;background:${color};transition:width 600ms ease;`;
      seg.title = `${item.label}: ${pct.toFixed(1)}%`;
      container.appendChild(seg);
    });
  }

  return container;
}
