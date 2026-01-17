"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Wx = {
  ts_unix_s?: number;

  // wind
  wind_dir_deg?: number;
  wind_dir_avg_deg?: number;
  wind_dir_gust_deg?: number;
  wind_speed_kt?: number;
  wind_gust_kt?: number;

  // thermodynamics
  temp_f?: number;
  dewpoint_f?: number;
  altimeter_inhg?: number;
  da_ft?: number;

  // runway
  rec_rwy?: string;

  // advisory
  advisory?: string;
  rec_reason?: string;
};

/* ---------------- helpers ---------------- */

function isNum(x: any): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function clamp360(deg: number) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

function zulu(tsUnixS?: number) {
  if (!isNum(tsUnixS)) return "----Z";
  const d = new Date(tsUnixS * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}${mm}Z`;
}

function fmt1(x?: number) {
  return isNum(x) ? x.toFixed(1) : "—";
}

function pickDirDeg(wx?: Wx): number | null {
  const cand = [wx?.wind_dir_deg, wx?.wind_dir_avg_deg, wx?.wind_dir_gust_deg];
  for (const v of cand) if (isNum(v)) return clamp360(v);
  return null;
}

function pickSpdKt(wx?: Wx): number | null {
  return isNum(wx?.wind_speed_kt) ? wx.wind_speed_kt : null;
}

function pickGustKt(wx?: Wx): number | null {
  return isNum(wx?.wind_gust_kt) ? wx.wind_gust_kt : null;
}

function altGroupA(wx?: Wx) {
  if (!isNum(wx?.altimeter_inhg)) return "A----";
  const n = Math.round(wx.altimeter_inhg * 100);
  return `A${String(n).padStart(4, "0")}`;
}

/**
 * Wind group rules:
 * - If speed < 2kt => "CALM"
 * - If calm BUT gust exists >= 2kt => "CALM G12KT"
 * - Else standard 28012G18KT
 */
function windGroup(wx?: Wx) {
  const spd = pickSpdKt(wx);
  const gst = pickGustKt(wx);
  const dir = pickDirDeg(wx);

  if (spd !== null && spd < 2) {
    if (gst !== null && gst >= 2) {
      return `CALM G${String(Math.round(gst)).padStart(2, "0")}KT`;
    }
    return "CALM";
  }

  const dirStr = dir === null ? "///" : String(Math.round(dir)).padStart(3, "0");
  const spdStr = spd === null ? "__" : String(Math.round(spd)).padStart(2, "0");

  let gustStr = "";
  if (gst !== null && spd !== null && gst >= spd + 2) {
    gustStr = `G${String(Math.round(gst)).padStart(2, "0")}`;
  }

  return `${dirStr}${spdStr}${gustStr}KT`;
}

/** Your desired order: field, time, wind, temp, dp, alt, da */
function topLine(wx?: Wx) {
  const station = "Thomas_FLD";
  const t = zulu(wx?.ts_unix_s);
  const w = windGroup(wx);

  const temp = fmt1(wx?.temp_f);
  const dp = fmt1(wx?.dewpoint_f);
  const a = altGroupA(wx);
  const da = isNum(wx?.da_ft) ? `${Math.round(wx.da_ft)}ft` : "—";

  return `${station} ${t} ${w}  TEMP ${temp}F  DP ${dp}F  ${a}  DA ${da}`;
}

function fmtAge(ageSec: number | null) {
  if (ageSec === null) return "—";
  if (ageSec < 60) return `${ageSec}s old`;
  const m = Math.floor(ageSec / 60);
  const s = ageSec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s old`;
}

function compForRunway(windFromDeg: number | null, windKt: number | null, rwyHeadingDeg: number) {
  if (windFromDeg === null || windKt === null) {
    return { hwLabel: "HW", hwVal: "—", xwSide: "", xwVal: "—" };
  }

  const delta = ((windFromDeg - rwyHeadingDeg) * Math.PI) / 180;
  const hw = windKt * Math.cos(delta);
  const xw = windKt * Math.sin(delta);

  const hwLabel = hw >= 0 ? "HW" : "TW";
  const hwVal = Math.abs(hw).toFixed(1);

  const xwSide = xw >= 0 ? "R" : "L";
  const xwVal = Math.abs(xw).toFixed(1);

  return { hwLabel, hwVal, xwSide, xwVal };
}

/* ---------------- page ---------------- */

export default function LivePage() {
  const [wx, setWx] = useState<Wx | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // ticking clock so "age" counts up smoothly
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // device heading
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassOn, setCompassOn] = useState(false);
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const pollSeconds = Number(process.env.NEXT_PUBLIC_SSE_POLL_SECONDS || "8");

  // Fetch the latest record from the API (which itself reads from Loki)
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const r = await fetch("/api/live", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as Wx;
        if (!alive) return;

        setWx(j);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || e));
      }
    }

    load();
    const id = setInterval(load, Math.max(3, pollSeconds) * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollSeconds]);

  // ✅ TRUE age = now - timestamp of last Wx record
  const ageSec = useMemo(() => {
    if (!wx || !isNum(wx.ts_unix_s)) return null;
    const age = Math.floor(nowMs / 1000 - wx.ts_unix_s);
    return Number.isFinite(age) ? Math.max(0, age) : null;
  }, [wx, nowMs]);

  // Color thresholds you asked for
  const warnYellowSeconds = 120; // 2 min
  const warnRedSeconds = 300; // 5 min

  const status = useMemo(() => {
    if (ageSec === null) return { label: "—", cls: "text-neutral-400" };
    if (ageSec >= warnRedSeconds) return { label: fmtAge(ageSec), cls: "text-rose-300" };
    if (ageSec >= warnYellowSeconds) return { label: fmtAge(ageSec), cls: "text-amber-300" };
    return { label: "UPDATED", cls: "text-emerald-300" };
  }, [ageSec]);

  const dir = pickDirDeg(wx || undefined);
  const spd = pickSpdKt(wx || undefined);
  const gst = pickGustKt(wx || undefined);

  const comp09 = useMemo(() => compForRunway(dir, spd, 90), [dir, spd]);
  const comp27 = useMemo(() => compForRunway(dir, spd, 270), [dir, spd]);

  const rec = (wx?.rec_rwy || "").trim();
  const advisoryText = (wx?.advisory || wx?.rec_reason || "").trim();

  const rowTone = (rwy: "09" | "27") => {
    if (rec === "09" || rec === "27") {
      return rec === rwy
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
        : "border-rose-400/30 bg-rose-400/10 text-rose-100";
    }
    return "border-neutral-800 bg-neutral-950/35 text-neutral-100";
  };

  // --- compass start/stop ---
  async function startCompass() {
    setCompassOn(true);

    const anyDOE = DeviceOrientationEvent as any;
    try {
      if (anyDOE && typeof anyDOE.requestPermission === "function") {
        const res = await anyDOE.requestPermission();
        if (res !== "granted") {
          setCompassOn(false);
          setDeviceHeading(null);
          alert("Motion/compass permission was not granted.");
          return;
        }
      }
    } catch {}

    const handler: (e: DeviceOrientationEvent) => void = (e) => {
      const anyE = e as any;
      let hdg: number | null = null;

      if (typeof anyE.webkitCompassHeading === "number") {
        hdg = anyE.webkitCompassHeading;
      } else if (typeof e.alpha === "number") {
        hdg = e.alpha;
      }

      if (hdg === null || !Number.isFinite(hdg)) return;
      setDeviceHeading(clamp360(hdg));
    };

    handlerRef.current = handler;

    window.addEventListener("deviceorientationabsolute" as any, handler, true);
    window.addEventListener("deviceorientation", handler, true);
  }

  function stopCompass() {
    const handler = handlerRef.current;
    if (handler) {
      window.removeEventListener("deviceorientation", handler, true);
      window.removeEventListener("deviceorientationabsolute" as any, handler, true);
    }
    handlerRef.current = null;
    setCompassOn(false);
    setDeviceHeading(null);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="text-sm font-semibold text-neutral-200 hover:text-neutral-100">
            ← Thomas Field
          </a>
          <a href="/" className="text-xs text-neutral-400 hover:text-neutral-200">
            Lots / Info
          </a>
        </div>

        {/* METAR-like strip */}
        <section className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-mono text-[15px] leading-snug whitespace-pre-wrap">
                {topLine(wx || undefined)}
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-neutral-400">Live</div>
                <div className={`text-sm font-semibold ${status.cls}`}>{status.label}</div>
                <div className="text-xs text-neutral-400">{fmtAge(ageSec)}</div>
              </div>
            </div>

            {err && <div className="mt-3 text-xs text-rose-300">Error loading data: {err}</div>}

            {advisoryText ? (
              <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3">
                <div className="text-xs font-semibold text-amber-200">Advisory</div>
                <div className="mt-1 text-sm text-amber-100/90">{advisoryText}</div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Wind + compass */}
        <section className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Pilot wind</div>
                <div className="text-xs text-neutral-400 mt-1">
                  Wind from {dir === null ? "—" : `${Math.round(dir)}°`} •{" "}
                  {spd === null ? "—" : `${Math.round(spd)} kt`}
                  {gst !== null ? ` (gust ${Math.round(gst)})` : ""}
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  {spd !== null && spd < 2 && gst !== null && gst >= 2
                    ? `Calm now — last gust ${Math.round(gst)} kt`
                    : ""}
                </div>
              </div>

              <button
                onClick={() => (compassOn ? stopCompass() : startCompass())}
                className="rounded-2xl border border-neutral-700 bg-neutral-950/40 px-3 py-2 text-xs font-semibold hover:bg-neutral-950/70"
              >
                {compassOn ? "Stop device compass" : "Use device compass"}
              </button>
            </div>

            <div className="mt-4">
              <WindCompass
                windFromDeg={dir}
                windKt={spd}
                deviceHeadingDeg={deviceHeading}
                showDeviceHeading={compassOn}
              />
            </div>
          </div>
        </section>

        {/* Runway */}
        <section className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
          <div className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold">Runway</div>
                <div className="text-xs text-neutral-400 mt-1">
                  Recommended: <span className="text-neutral-100 font-semibold">RWY {rec || "—"}</span>
                </div>
              </div>
              <div className="text-xs text-neutral-400">Components in kt</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <RunwayRow toneClass={rowTone("09")} label="RWY 09" {...comp09} />
              <RunwayRow toneClass={rowTone("27")} label="RWY 27" {...comp27} />
            </div>
          </div>
        </section>

        <div className="h-8" />
      </div>
    </main>
  );
}

/* ---------------- components ---------------- */

function RunwayRow({
  label,
  toneClass,
  hwLabel,
  hwVal,
  xwSide,
  xwVal,
}: {
  label: string;
  toneClass: string;
  hwLabel: string;
  hwVal: string;
  xwSide: string;
  xwVal: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 flex items-center justify-between ${toneClass}`}>
      <div className="text-sm font-semibold">{label}</div>
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="opacity-70">{hwLabel}</span>{" "}
          <span className="font-semibold">{hwVal}</span>
        </div>
        <div>
          <span className="opacity-70">XW</span>{" "}
          <span className="opacity-70">{xwSide}</span>{" "}
          <span className="font-semibold">{xwVal}</span>
        </div>
      </div>
    </div>
  );
}

function WindCompass({
  windFromDeg,
  windKt,
  deviceHeadingDeg,
  showDeviceHeading,
}: {
  windFromDeg: number | null;
  windKt: number | null;
  deviceHeadingDeg: number | null;
  showDeviceHeading: boolean;
}) {
  const roseRotate = showDeviceHeading && deviceHeadingDeg !== null ? -deviceHeadingDeg : 0;
  const arrowDeg = windFromDeg !== null ? windFromDeg : 0;

  function round3(n: number) {
    return Math.round(n * 1000) / 1000;
  }

  function polar(deg: number, r: number) {
    const rad = (deg * Math.PI) / 180;
    return {
      x: round3(50 + r * Math.sin(rad)),
      y: round3(50 - r * Math.cos(rad)),
    };
  }

  const tip = polar(arrowDeg, 34);
  const base = polar(arrowDeg + 180, 10);

  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-950/30 p-4 w-full overflow-hidden">
      <div className="mx-auto aspect-square w-full max-w-[420px]">
        <svg viewBox="0 0 100 100" className="h-full w-full block">
          <g transform={`rotate(${roseRotate} 50 50)`}>
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1.2" />
            <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
            <circle cx="50" cy="50" r="24" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

            {Array.from({ length: 36 }).map((_, i) => {
              const deg = i * 10;
              const a = polar(deg, 44);
              const b = polar(deg, deg % 90 === 0 ? 40 : 42);
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth={deg % 90 === 0 ? 1.6 : 1}
                  strokeLinecap="round"
                />
              );
            })}

            <text x="50" y="10.5" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.65)" fontFamily="ui-sans-serif, system-ui">
              N
            </text>
            <text x="89.5" y="52" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.50)" fontFamily="ui-sans-serif, system-ui">
              E
            </text>
            <text x="50" y="94" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.50)" fontFamily="ui-sans-serif, system-ui">
              S
            </text>
            <text x="10.5" y="52" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.50)" fontFamily="ui-sans-serif, system-ui">
              W
            </text>

            <text x="16" y="52" textAnchor="middle" fontSize="6" fill="rgba(34,197,94,0.85)" fontFamily="ui-sans-serif, system-ui">
              27
            </text>
            <text x="84" y="52" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.45)" fontFamily="ui-sans-serif, system-ui">
              09
            </text>
            <line x1="18" y1="52" x2="82" y2="52" stroke="rgba(255,255,255,0.20)" strokeWidth="2.0" strokeLinecap="round" />
            <circle cx="50" cy="50" r="1.8" fill="rgba(255,255,255,0.65)" />
          </g>

          <g>
            <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" strokeLinecap="round" />
            {(() => {
              const left = polar(arrowDeg + 160, 8);
              const right = polar(arrowDeg + 200, 8);
              return <path d={`M ${tip.x} ${tip.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`} fill="rgba(255,255,255,0.75)" />;
            })()}
          </g>

          <text x="50" y="78" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.45)" fontFamily="ui-sans-serif, system-ui">
            {windKt === null ? "— kt" : windKt < 2 ? "CALM" : `${Math.round(windKt)} kt`}
          </text>
        </svg>
      </div>
    </div>
  );
}

