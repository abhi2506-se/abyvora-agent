"use client";

import Link from "next/link";
import { useState } from "react";

const fmtInr = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
const axisInr = (v: number) => (v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(Math.round(v)));

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function labelFor(bucket: string, grouping: string) {
  const d = new Date(`${bucket}T00:00:00Z`);
  return grouping === "month"
    ? d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function RevenueChart({ series, grouping }: { series: { bucket: string; net: number; gross: number; refunds: number }[]; grouping: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 230, L = 46, R = 12, T = 14, B = 28;
  const max = niceMax(Math.max(...series.map((s) => s.net), 0));
  const x = (i: number) => L + (series.length <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (series.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const pts = series.map((s, i) => `${x(i)},${y(Math.max(0, s.net))}`);
  const line = pts.length ? `M${pts.join(" L")}` : "";
  const area = pts.length ? `${line} L${x(series.length - 1)},${H - B} L${x(0)},${H - B} Z` : "";
  const every = Math.max(1, Math.ceil(series.length / 8));
  const hp = hover !== null ? series[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Net revenue over time"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - L) / (W - L - R)) * (series.length - 1));
          setHover(series.length ? Math.min(series.length - 1, Math.max(0, i)) : null);
        }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={L - 8} y={y(max * t) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted)">{axisInr(max * t)}</text>
          </g>
        ))}
        {series.map((s, i) => i % every === 0 && (
          <text key={s.bucket} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">{labelFor(s.bucket, grouping)}</text>
        ))}
        {area && <path d={area} fill="url(#revFill)" />}
        {line && <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
        {series.length <= 40 && series.map((s, i) => <circle key={s.bucket} cx={x(i)} cy={y(Math.max(0, s.net))} r={hover === i ? 5 : 3} fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--brand)" strokeOpacity="0.35" />}
      </svg>
      {hp && hover !== null && (
        <div className="pointer-events-none absolute rounded-lg px-3 py-2 text-[12px] shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 4, transform: `translateX(${hover > series.length / 2 ? "-105%" : "5%"})`, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <div className="font-semibold">{labelFor(hp.bucket, grouping)}</div>
          <div className="font-bold text-[14px]">{fmtInr(hp.net)}</div>
          <div style={{ color: "var(--text-secondary)" }}>Gross {fmtInr(hp.gross)} · Refunds {fmtInr(hp.refunds)}</div>
        </div>
      )}
    </div>
  );
}

export function UserGrowthChart({ series, grouping }: { series: { bucket: string; newUsers: number; activeUsers: number }[]; grouping: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 230, L = 36, R = 8, T = 12, B = 28;
  const max = niceMax(Math.max(...series.flatMap((s) => [s.newUsers, s.activeUsers]), 0));
  const slot = (W - L - R) / Math.max(1, series.length);
  const bw = Math.min(18, slot * 0.38);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const every = Math.max(1, Math.ceil(series.length / 8));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="New and active users over time" onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={L - 6} y={y(max * t) + 4} textAnchor="end" fontSize="10.5" fill="var(--text-muted)">{Math.round(max * t)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const cx = L + slot * i + slot / 2;
          return (
            <g key={s.bucket} onMouseEnter={() => setHover(i)}>
              <rect x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" />
              <rect x={cx - bw - 1} y={y(s.newUsers)} width={bw} height={Math.max(0, H - B - y(s.newUsers))} rx="3" fill="var(--brand)" opacity={hover === null || hover === i ? 1 : 0.55} />
              <rect x={cx + 1} y={y(s.activeUsers)} width={bw} height={Math.max(0, H - B - y(s.activeUsers))} rx="3" fill="var(--accent)" opacity={hover === null || hover === i ? 0.45 : 0.25} />
              {i % every === 0 && <text x={cx} y={H - 8} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">{labelFor(s.bucket, grouping)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && series[hover] && (
        <div className="pointer-events-none absolute rounded-lg px-3 py-2 text-[12px] shadow-lg" style={{ left: `${Math.min(70, Math.max(0, ((L + slot * hover) / W) * 100))}%`, top: 0, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <div className="font-semibold">{labelFor(series[hover].bucket, grouping)}</div>
          <div>New users: <b>{series[hover].newUsers}</b></div>
          <div>Active users: <b>{series[hover].activeUsers}</b></div>
        </div>
      )}
    </div>
  );
}

const PALETTE = ["#2f6df6", "#16c47f", "#7c4dff", "#f6a21e", "#e5484d", "#06b6d4"];

export type DonutSlice = { name: string; count: number; pct: number; href: string };

/** Each segment and legend row is a real link → filtered organizations list. */
export function DonutChart({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const r = 62, c = 2 * Math.PI * r;
  const offsets = slices.map((_, i) => slices.slice(0, i).reduce((sum, s) => sum + (s.count / total) * c, 0));
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 180 180" width="170" height="170" role="img" aria-label="Organizations by plan">
        <g transform="rotate(-90 90 90)">
          {slices.map((s, i) => {
            const len = (s.count / total) * c;
            const offset = offsets[i];
            const el = (
              <Link key={s.name} href={s.href}>
                <circle cx="90" cy="90" r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={hover === i ? 30 : 26}
                  strokeDasharray={`${Math.max(0, len - (slices.length > 1 ? 1.5 : 0))} ${c}`} strokeDashoffset={-offset} style={{ cursor: "pointer", transition: "stroke-width .12s" }}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}><title>{`${s.name}: ${s.count} (${s.pct}%)`}</title></circle>
              </Link>
            );
            return el;
          })}
        </g>
        <text x="90" y="88" textAnchor="middle" fontSize="26" fontWeight="700" fill="var(--text-primary)">{hover !== null ? slices[hover].count : total}</text>
        <text x="90" y="108" textAnchor="middle" fontSize="12" fill="var(--text-secondary)">{hover !== null ? slices[hover].name : "Total"}</text>
      </svg>
      <ul className="space-y-2.5 text-[13px]">
        {slices.map((s, i) => (
          <li key={s.name}>
            <Link href={s.href} className="flex items-start gap-2 hover:underline" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <span className="w-2.5 h-2.5 rounded-[3px] mt-1.5" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span><span className="font-semibold" style={{ color: "var(--text-primary)" }}>{s.name}</span><br /><span style={{ color: "var(--text-secondary)" }}>{s.count} ({s.pct}%)</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
