import { useEffect, useRef } from 'react';
import type { Series } from '../state/series';

interface Props {
  series: Series;
  color: string;
  spanSec: number;
  active: boolean;
  label: string;
  emptyText: string;
  /** Fixed y range (e.g. 0-100 for confidence). Default: auto-scale to the visible window. */
  fixedRange?: readonly [number, number];
  tall?: boolean;
}

/** Plots REAL SDK trace samples only. Auto-scales y to the visible window; draws nothing when there is no data. */
export function Waveform({ series, color, spanSec, active, label, emptyText, fixedRange, tall }: Props): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(120,150,190,0.12)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = Math.round((h * i) / 4) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const pts = series.window(spanSec * 1e6);
      if (pts.length < 2) {
        ctx.fillStyle = 'rgba(160,180,205,0.55)';
        ctx.font = `${12 * dpr}px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(active ? 'Waiting for SDK samples\u2026' : emptyText, w / 2, h / 2);
      } else {
        let min = fixedRange ? fixedRange[0] : Infinity;
        let max = fixedRange ? fixedRange[1] : -Infinity;
        if (!fixedRange) {
          for (const p of pts) {
            if (p.v < min) min = p.v;
            if (p.v > max) max = p.v;
          }
        }
        const range = max - min || 1;
        const newest = (pts[pts.length - 1] as { t: number }).t;
        const x0 = newest - spanSec * 1e6;
        const pad = 6 * dpr;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const x = ((p.t - x0) / (spanSec * 1e6)) * w;
          const y = h - pad - ((p.v - min) / range) * (h - 2 * pad);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * dpr;
        ctx.lineJoin = 'round';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8 * dpr;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [series, color, spanSec, active, emptyText, fixedRange]);

  return <canvas ref={ref} className={tall ? 'wave wave-tall' : 'wave'} role="img" aria-label={label} />;
}
