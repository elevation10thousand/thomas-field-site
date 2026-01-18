// app/live/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Wx = {
  ts_unix_s?: number | string;

  // wind
  wind_dir_deg?: number | string; // primary
  wind_dir_avg_deg?: number | string;
  wind_dir_gust_deg?: number | string;
  wind_dir_spread_deg?: number | string; // variability degrees
  wind_dir_variable?: number | string; // 1/0 flag
  wind_speed_kt?: number | string;
  wind_gust_kt?: number | string;

  // thermodynamics
  temp_f?: number | string;
  dewpoint_f?: number | string;
  altimeter_inhg?: number | string;
  da_ft?: number | string;

  // cloud base (estimated)
  cloud_base_agl_ft?: number | string;

  // GPS (optional)
  gps_fix?: number | string;
  gps_lat?: number | string;
  gps_lon?: number | string;
  gps_sats?: number | string;
  gps_hdop?: number | string;

  // runway
  rec_rwy?: "09" | "27" | string;
  hw_09?: number | string;
  xw_09?: number | string;
  hw_27?: number | string;
  xw_27?: number | string;

  // optional message/advisory fields
  advisory?: string;
  rec_reason?: string;

  // advisory timing (from /api/live)
  advisory_ts_unix_s?: number | string | null;
  advisory_age_s?: number | string | null;

  // advisory color from Sheets
  advisory_color?: string | null;
};

/* ---------------- helpers ---------------- */

function clamp360(deg: number) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function zulu(tsUnixS?: number | string) {
  const t = num(tsUnixS);
  if (!t) return "----Z";
  const d = new Date(t * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}${mm}Z`;
}

function fmt1(v?: number | string) {
  const n = num(v);
  return n === null ? "—" : n.toFixed(1);
}

function pickDirDeg(wx?: Wx): number | null {
  const cand = [wx?.wind_dir_deg, wx?.wind_dir_avg_deg, wx?.wind_dir_gust_deg];
  for (const v of cand) {
    const n = num(v);
    if (n !== null) return clamp360(n);
  }
  return null;
}

function pickSpdKt(wx?: Wx): number | null {
  return num(wx?.wind_speed_kt);
}

function pickGustKt(wx?: Wx): number | null {
  return num(wx?.wind_gust_kt);
}

function altGroupA(wx?: Wx) {
  const a = num(wx?.altimeter_inhg);
  if (a === null) return "A----";
  const n = Math.round(a * 100);
  return `A${String(n).padStart(4, "0")}`;
}

/**
 * Wind group with:
 * - CALM when <2 kt
 * - Gust shown as Gxx when not calm and gust meaningful
 */
function windGroup(wx?: Wx) {
  const spd = pickSpdKt(wx);
  const gst = pickGustKt(wx);
  const dir = pickDirDeg(wx);

  if (spd !== null && spd < 2) return "CALM";

  const dirStr = dir === null ? "///" : String(Math.round(dir)).padStart(3, "0");
  const spdStr = spd === null ? "__" : String(Math.round(spd)).padStart(2, "0");

  let gustStr = "";
  if (gst !== null && spd !== null && gst >= spd + 2) {
    gustStr = `G${String(Math.round(gst)).padStart(2, "0")}`;
  }

  return `${dirStr}${spdStr}${gustStr}KT`;
}

function cloudBaseGroup(wx?: Wx) {
  const cb = num(wx?.cloud_base_agl_ft);
  if (cb === null) return "CB ---ftAGL";
  const rounded = Math.max(0, Math.round(cb / 100) * 100);
  return `CB ${rounded}ftAGL`;
}

function topLine(wx?: Wx) {
  const station = "Thomas Field";
  const t = zulu(wx?.ts_unix_s);

  const w = windGroup(wx);

  const temp = fmt1(wx?.temp_f);
  const dp = fmt1(wx?.dewpoint_f);

  const a = altGroupA(wx);

  const daN = num(wx?.da_ft);
  const da = daN === null ? "—" : `${Math.round(daN)}FT`;

  const cbN = num(wx?.cloud_base_agl_ft);
  const cb = cbN === null ? "—" : `${Math.round(cbN)}FT`;

  return `${station} ${t} ${w} TEMP ${temp}F DEWPOINT ${dp}F ${a} DA ${da} (Est.CloudBase ${cb} AGL)`;
}


function compForRunway(windFromDeg: number | null, windKt: number | null, rwyHeadingDeg: number) {
  if (windFromDeg === null || windKt === null) {
    return { hwLabel: "HW", hwVal: "—", xwSide: "", xwVal: "—" };
  }

  const delta = ((windFromDeg - rwyHeadingDeg) * Math.PI) / 180;
  const hw = windKt * Math.cos(delta);
  const xw = windKt * Math.sin(delta);

  const hwAbs = Math.abs(hw);
  const xwAbs = Math.abs(xw);

  const hwLabel = hw >= 0 ? "HW" : "TW";
  const hwVal = hwAbs.toFixed(1);

  const xwSide = xw >= 0 ? "R" : "L";
  const xwVal = xwAbs.toFixed(1);

  return { hwLabel, hwVal, xwSide, xwVal };
}

function fmtAge(ageSec: number) {
  if (ageSec < 60) return `${ageSec}s old`;
  const m = Math.floor(ageSec / 60);
  const s = ageSec % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, "0")} old`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m old`;
}

// Smooth angle (wrap-aware). Lower alpha = smoother
function smoothAngle(prev: number, next: number, alpha = 0.045) {
  let d = next - prev;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return clamp360(prev + alpha * d);
}

/* ---------------- page ---------------- */

export default function LivePage() {
  const [wx, setWx] = useState<Wx | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sticky advisory (prevents flipping old/new)
  const [stickyAdv, setStickyAdv] = useState<{
    advisory: string | null;
    advisory_color: string | null;
    advisory_ts_unix_s: number | null;
  }>({
    advisory: null,
    advisory_color: null,
    advisory_ts_unix_s: null,
  });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassOn, setCompassOn] = useState(false);
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  // smoothing state (ref so we can update inside event handler safely)
  const smoothRef = useRef<number | null>(null);
  const lastEmitRef = useRef<number>(0);
  // Vector-based smoothing (better than degree smoothing on Android)
const smoothSinRef = useRef<number | null>(null);
const smoothCosRef = useRef<number | null>(null);


  const pollSeconds = Number(
    (process.env.NEXT_PUBLIC_SSE_POLL_SECONDS as any) || (process.env.SSE_POLL_SECONDS as any) || "8"
  );

  const warnYellowSec = 120;
  const warnRedSec = 300;

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

        // Sticky advisory: accept only if timestamp moves forward
        setStickyAdv((cur) => {
          const ts = num(j.advisory_ts_unix_s);
          const text = typeof j.advisory === "string" ? j.advisory.trim() : "";
          const color = typeof j.advisory_color === "string" ? j.advisory_color.trim() : null;

          if (!ts || !text) return cur;
          if (!cur.advisory_ts_unix_s || ts > cur.advisory_ts_unix_s) {
            return { advisory: text, advisory_color: color, advisory_ts_unix_s: ts };
          }
          return cur;
        });
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

  const ageSec = useMemo(() => {
    const ts = num(wx?.ts_unix_s);
    if (ts === null) return null;
    return Math.max(0, Math.round(nowMs / 1000 - ts));
  }, [wx?.ts_unix_s, nowMs]);

  const status =
    ageSec === null
      ? "UNKNOWN"
      : ageSec >= warnRedSec
      ? "STALE"
      : ageSec >= warnYellowSec
      ? "OLD"
      : "UPDATED";

  const statusClass =
    status === "UPDATED"
      ? "text-emerald-300"
      : status === "OLD"
      ? "text-amber-300"
      : status === "STALE"
      ? "text-rose-300"
      : "text-neutral-400";

  const dir = pickDirDeg(wx || undefined);
  const spd = pickSpdKt(wx || undefined);
  const gst = pickGustKt(wx || undefined);

  const variabilityDeg = num(wx?.wind_dir_spread_deg);
  const variableFlag = num(wx?.wind_dir_variable);

  const comp09 = useMemo(() => compForRunway(dir, spd, 90), [dir, spd]);
  const comp27 = useMemo(() => compForRunway(dir, spd, 270), [dir, spd]);

  const advisoryAgeSec = useMemo(() => {
    const a = num(wx?.advisory_age_s);
    if (a !== null) return Math.max(0, Math.round(a));

    const ts = stickyAdv.advisory_ts_unix_s ?? num(wx?.advisory_ts_unix_s);
    if (ts === null) return null;

    return Math.max(0, Math.round(nowMs / 1000 - ts));
  }, [wx?.advisory_age_s, wx?.advisory_ts_unix_s, stickyAdv.advisory_ts_unix_s, nowMs]);

  // Use sticky advisory first; fall back to wx if sticky is empty
  const advisoryTextRaw = (stickyAdv.advisory ?? str(wx?.advisory)).trim();
  const advisoryText = advisoryTextRaw || "";

  const fieldClosed =
    !!advisoryTextRaw &&
    /field\s*closed|rwy\s*closed|closed|no\s*landings|do\s*not\s*land|unusable/i.test(advisoryTextRaw);

  const hasOpsOverride =
    (!!advisoryTextRaw && fieldClosed) ||
    (() => {
      const advTs = stickyAdv.advisory_ts_unix_s ?? num(wx?.advisory_ts_unix_s);
      const wxTs = num(wx?.ts_unix_s);
      return !!advisoryTextRaw && advTs !== null && wxTs !== null && advTs > wxTs;
    })();

  const rec = fieldClosed ? "--" : (str(wx?.rec_rwy) || "--").toUpperCase();
  const recIs09 = rec === "09";
  const recIs27 = rec === "27";

  // advisory color ONLY from Sheets (sticky first)
  const advisoryColorRaw = (stickyAdv.advisory_color ?? str(wx?.advisory_color)).trim().toLowerCase();
  const advisoryColor =
    advisoryColorRaw === "red"
      ? "red"
      : advisoryColorRaw === "amber" || advisoryColorRaw === "yellow"
      ? "amber"
      : advisoryColorRaw === "green"
      ? "green"
      : advisoryColorRaw === "neutral" || advisoryColorRaw === "gray" || advisoryColorRaw === "grey"
      ? "neutral"
      : "neutral";

  const advisoryBorder =
    advisoryColor === "red"
      ? "border-rose-500/45 bg-rose-500/12"
      : advisoryColor === "amber"
      ? "border-amber-500/45 bg-amber-500/12"
      : advisoryColor === "green"
      ? "border-emerald-500/35 bg-emerald-500/12"
      : "border-neutral-700 bg-neutral-950/20";

  const advisoryTitleColor =
    advisoryColor === "red"
      ? "text-rose-200"
      : advisoryColor === "amber"
      ? "text-amber-200"
      : advisoryColor === "green"
      ? "text-emerald-200"
      : "text-neutral-200";

  async function startCompass() {
    setCompassOn(true);
smoothRef.current = null;
lastEmitRef.current = 0;
smoothSinRef.current = null;
smoothCosRef.current = null;

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
    } catch {
      // ignore
    }

    // ✅ CLEAN, BRACE-SAFE handler (vector smoothing + less jitter)
const handler: (e: DeviceOrientationEvent) => void = (e) => {
  const anyE = e as any;

  let hdg: number | null = null;

  // iOS Safari: true heading (usually best / true north-ish)
  if (typeof anyE.webkitCompassHeading === "number") {
    hdg = anyE.webkitCompassHeading;
  } else if (typeof e.alpha === "number") {
    // Android / Chrome: alpha corrected for screen orientation
    const screenAngle =
      typeof window !== "undefined" &&
      typeof (window.screen as any)?.orientation?.angle === "number"
        ? (window.screen as any).orientation.angle
        : (window as any).orientation || 0;

    // 🔧 Android fix: many devices report alpha mirrored.
    // If "east shows as west", flip alpha.
    const alphaDeg = 360 - e.alpha; // <-- flip fixes E/W swap on many Androids
    hdg = alphaDeg + screenAngle;
  }

  if (hdg === null || !Number.isFinite(hdg)) return;

  const next = clamp360(hdg);

  // Throttle to ~12.5 Hz (even smoother on Android)
  const now = performance.now();
  if (now - lastEmitRef.current < 80) return;
  lastEmitRef.current = now;

  // --- Vector smoothing (EMA on unit circle) ---
  const alpha = 0.045; // smaller = smoother/slower; try 0.035–0.07

  const rad = (next * Math.PI) / 180;
  const s = Math.sin(rad);
  const c = Math.cos(rad);

  if (smoothSinRef.current === null || smoothCosRef.current === null) {
    smoothSinRef.current = s;
    smoothCosRef.current = c;
  } else {
    smoothSinRef.current = smoothSinRef.current * (1 - alpha) + s * alpha;
    smoothCosRef.current = smoothCosRef.current * (1 - alpha) + c * alpha;
  }

  const smRad = Math.atan2(smoothSinRef.current, smoothCosRef.current);
  let smDeg = (smRad * 180) / Math.PI;
  smDeg = clamp360(smDeg);

  // Dead-band: ignore tiny output wobble (post-smoothing)
  const prev = smoothRef.current;
  if (prev !== null) {
    let delta = Math.abs(smDeg - prev);
    if (delta > 180) delta = 360 - delta;
    if (delta < 1.0) return; // increase if still twitchy (0.6–1.2)
  }

  smoothRef.current = smDeg;
  setDeviceHeading(smDeg);
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
smoothRef.current = null;
smoothSinRef.current = null;
smoothCosRef.current = null;

  }

  // GPS text
  const gpsFix = num(wx?.gps_fix);
  const gpsLat = num(wx?.gps_lat);
  const gpsLon = num(wx?.gps_lon);
  const gpsSats = num(wx?.gps_sats);
  const gpsHdop = num(wx?.gps_hdop);

  const gpsLine = useMemo(() => {
    const fixText = gpsFix === null ? "GPS: —" : gpsFix > 0 ? "GPS: FIX" : "GPS: NO FIX";
    const parts: string[] = [fixText];

    if (gpsSats !== null) parts.push(`SAT ${Math.round(gpsSats)}`);
    if (gpsHdop !== null) parts.push(`HDOP ${gpsHdop.toFixed(1)}`);

    if (gpsLat !== null && gpsLon !== null) {
      parts.push(`${gpsLat.toFixed(5)}, ${gpsLon.toFixed(5)}`);
    }

    return parts.join(" • ");
  }, [gpsFix, gpsSats, gpsHdop, gpsLat, gpsLon]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="text-sm font-semibold text-neutral-200 hover:text-neutral-100">
            ← Thomas Field
          </a>
          <a href="/" className="text-xs text-neutral-400 hover:text-neutral-200">
            Lots / Info
          </a>
        </div>

        {/* METAR-like top strip */}
        <section className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-mono text-[15px] leading-snug whitespace-pre-wrap">{topLine(wx || undefined)}</div>

              <div className="text-right shrink-0">
                <div className="text-xs text-neutral-400">Live</div>
                <div className={`text-sm font-semibold ${statusClass}`}>{status}</div>
                <div className="text-xs text-neutral-400">{ageSec === null ? "—" : fmtAge(ageSec)}</div>
              </div>
            </div>

            {err && <div className="mt-3 text-xs text-rose-300">Error loading data: {err}</div>}

            {/* Field / runway advisory (Sheets-driven) */}
            {advisoryText ? (
              <div className={["mt-4 rounded-2xl border p-3", advisoryBorder].join(" ")}>
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-xs font-semibold ${advisoryTitleColor}`}>
                    Field / RWY Advisory
                    {hasOpsOverride ? (
                      <span className="ml-2 rounded-full border border-neutral-700 bg-neutral-950/40 px-2 py-0.5 text-[10px] font-extrabold text-neutral-200">
                        OPS OVERRIDE
                      </span>
                    ) : null}
                  </div>

                  <div className="text-[11px] text-neutral-300/70">{advisoryAgeSec === null ? "" : fmtAge(advisoryAgeSec)}</div>
                </div>

                <div className="mt-1 text-sm text-neutral-100/90">{advisoryText}</div>

                {fieldClosed ? (
                  <div className="mt-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2">
                    <div className="text-sm font-extrabold text-rose-200">FIELD CLOSED</div>
                    <div className="text-xs text-rose-100/90 mt-0.5">Runway recommendation locked to “--”.</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {/* Wind + compass card */}
        <section className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold">Pilot wind</div>
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
                gustKt={gst}
                variabilityDeg={variabilityDeg}
                variableFlag={variableFlag}
                deviceHeadingDeg={deviceHeading}
                showDeviceHeading={compassOn}
                recRwy={rec}
              />

              {/* GPS line BELOW compass but still inside the card */}
              <div className="mt-3 rounded-2xl border border-neutral-800 bg-neutral-950/25 px-3 py-2">
                <div className="text-[11px] tracking-wider uppercase text-neutral-400">GPS</div>
                <div className="mt-0.5 text-sm text-neutral-100/90 font-mono">{gpsLine}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Runway recommendation + components */}
        <section className="mt-4 rounded-3xl border border-neutral-800 bg-neutral-900/25 overflow-hidden">
          <div className="p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold">Runway</div>
                <div className="text-xs text-neutral-400 mt-1">
                  Recommended: <span className="text-neutral-100 font-semibold">RWY {rec}</span>
                  {fieldClosed ? <span className="ml-2 text-rose-200 font-semibold">(locked by advisory)</span> : null}
                </div>
              </div>
              <div className="text-xs text-neutral-400">Components shown in kt</div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <RunwayRow
                label="RWY 09"
                good={!fieldClosed && recIs09}
                hwLabel={comp09.hwLabel}
                hwVal={comp09.hwVal}
                xwSide={comp09.xwSide}
                xwVal={comp09.xwVal}
              />
              <RunwayRow
                label="RWY 27"
                good={!fieldClosed && recIs27}
                hwLabel={comp27.hwLabel}
                hwVal={comp27.hwVal}
                xwSide={comp27.xwSide}
                xwVal={comp27.xwVal}
              />
            </div>

            {/* IMPORTANT: rec_reason should NOT replace advisory banner. If you want it shown, keep it separate: */}
            {str(wx?.rec_reason).trim() === "WIND COMPONENTS" ? (
              <div className="mt-3 text-xs text-neutral-400">
                Recommendation based on <span className="text-neutral-200 font-semibold">wind components</span>.
              </div>
            ) : null}
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
  good,
  hwLabel,
  hwVal,
  xwSide,
  xwVal,
}: {
  label: string;
  good: boolean;
  hwLabel: string;
  hwVal: string;
  xwSide: string;
  xwVal: string;
}) {
  const border = good ? "border-emerald-500/30" : "border-rose-500/30";
  const bg = good ? "bg-emerald-500/10" : "bg-rose-500/10";
  const title = good ? "text-emerald-200" : "text-rose-200";

  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 flex items-center justify-between`}>
      <div className={`text-sm font-semibold ${title}`}>{label}</div>

      <div className="flex items-center gap-4 text-sm">
        <div className="text-neutral-200">
          <span className="text-neutral-400">{hwLabel}</span> <span className="font-semibold">{hwVal}</span>
        </div>
        <div className="text-neutral-200">
          <span className="text-neutral-400">XW</span> <span className="text-neutral-400">{xwSide}</span>{" "}
          <span className="font-semibold">{xwVal}</span>
        </div>
      </div>
    </div>
  );
}

function WindCompass({
  windFromDeg,
  windKt,
  gustKt,
  variabilityDeg,
  variableFlag,
  deviceHeadingDeg,
  showDeviceHeading,
  recRwy,
}: {
  windFromDeg: number | null;
  windKt: number | null;
  gustKt: number | null;
  variabilityDeg: number | null;
  variableFlag: number | null;
  deviceHeadingDeg: number | null;
  showDeviceHeading: boolean;
  recRwy: string;
}) {
  const hasHdg = showDeviceHeading && deviceHeadingDeg !== null;

    // Rose rotates opposite device heading (heading-up)
  const roseRotate = hasHdg ? -deviceHeadingDeg! : 0;

  // Needle is relative to device heading when enabled
  const windDegAbs = windFromDeg ?? 0;
  const needleRotate = hasHdg ? clamp360(windDegAbs - deviceHeadingDeg!) : windDegAbs;

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

  function norm360(deg: number) {
    return clamp360(deg);
  }

  // SVG arc path from start->end clockwise, with wrap handled outside
  function arcPath(startDeg: number, endDeg: number, r: number) {
    const a = polar(startDeg, r);
    const b = polar(endDeg, r);

    let sweep = endDeg - startDeg;
    while (sweep < 0) sweep += 360;
    while (sweep >= 360) sweep -= 360;

    const largeArc = sweep > 180 ? 1 : 0;
    const sweepFlag = 1; // clockwise

    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${b.x} ${b.y}`;
  }

  function textCardinal(letter: "N" | "E" | "S" | "W", x: number, y: number) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="5.2"
        fill="rgba(255,255,255,0.70)"
        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
        fontWeight="700"
        letterSpacing="1.0"
      >
        {letter}
      </text>
    );
  }

  const dirLabel = windFromDeg === null ? "---°" : `${String(Math.round(windFromDeg)).padStart(3, "0")}°`;

  const windLabel = windKt === null ? "—" : windKt < 2 ? "CALM" : `${Math.round(windKt)}kt`;
  const gustLabel = gustKt === null ? "—" : `${Math.round(gustKt)}kt`;

  const varText =
    variableFlag !== null && variableFlag > 0
      ? variabilityDeg !== null
        ? `VAR ${Math.round(variabilityDeg)}°`
        : "VAR"
      : variabilityDeg !== null
      ? `${Math.round(variabilityDeg)}°`
      : "—";

  const hdgText = showDeviceHeading
    ? deviceHeadingDeg !== null
      ? `${String(Math.round(deviceHeadingDeg)).padStart(3, "0")}°`
      : "…"
    : "—";

  const rec = (recRwy || "").toUpperCase();
  const rwy09Fill = rec === "09" ? "rgba(34,197,94,0.95)" : "rgba(255,255,255,0.92)";
  const rwy27Fill = rec === "27" ? "rgba(34,197,94,0.95)" : "rgba(255,255,255,0.92)";

  // runway: square ends, darker transparent gray
  const rwy = {
  w: 80,                 // ⬅ longer runway
  h: 9.6,
  x: 50 - 80 / 2,        // ⬅ keep centered
  y: 45.8,
  rx: 0,
};
  const yC = rwy.y + rwy.h / 2;

  const needleFill = "rgba(120,130,145,0.55)";
  const needleOuter = "rgba(255,255,255,1)";
  const needleMid = "rgba(156,163,175,0.90)";

  // instrument-grade geometry
  const R_OUT = 45.8;
  const R_TICK_OUT = 49.4; // pushed outward
  const R_TICK_MAJOR_IN = 45.6; // shorter
  const R_TICK_MINOR_IN = 46.8;
  const R_TICK_MICRO_IN = 47.6;

  // Gust spread arc config
  const spreadDeg = variabilityDeg !== null ? Math.max(0, Math.min(180, variabilityDeg)) : 0;
  const centerDeg = windFromDeg ?? 0;
  const showSpreadArc = spreadDeg >= 8;


  const startDeg = norm360(centerDeg - spreadDeg / 2);
  const endDeg = norm360(centerDeg + spreadDeg / 2);
  const spreadWraps = endDeg < startDeg;

  // cardinals: pushed out, equal distance from ring
  const CARD_PAD = 7.8;
  const N_Y = 50 - (R_OUT + CARD_PAD);
  const S_Y = 50 + (R_OUT + CARD_PAD);
  const E_X = 50 + (R_OUT + CARD_PAD);
  const W_X = 50 - (R_OUT + CARD_PAD);

  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-950/35 p-4 w-full overflow-hidden">
      <div className="relative">
        {/* 4 corner metrics */}
        <div className="pointer-events-none absolute left-0 top-0 text-left">
          <div className="text-[11px] tracking-wider uppercase text-neutral-400">Wind</div>
          <div className="text-3xl leading-none font-semibold text-neutral-100">{windLabel}</div>
        </div>

        <div className="pointer-events-none absolute right-0 top-0 text-right">
          <div className="text-[11px] tracking-wider uppercase text-neutral-400">Gust</div>
          <div className="text-3xl leading-none font-semibold text-neutral-100">{gustLabel}</div>
        </div>

        <div className="pointer-events-none absolute left-0 bottom-0 text-left">
          <div className="text-[11px] tracking-wider uppercase text-neutral-400">Var</div>
          <div className="text-3xl leading-none font-semibold text-neutral-100">{varText}</div>
        </div>

        <div className="pointer-events-none absolute right-0 bottom-0 text-right">
          <div className="text-[11px] tracking-wider uppercase text-neutral-400">Hdg</div>
          <div className="text-3xl leading-none font-semibold text-neutral-100">{hdgText}</div>
        </div>

        {/* Bigger compass WITHOUT clipping */}
        <div className="mx-auto aspect-square w-full max-w-[620px] pt-10 pb-10">
          <svg viewBox="-6 -10 112 128" className="h-full w-full block" role="img" aria-label="Wind direction vs runway 09/27">
            {/* rings */}
            <circle cx="50" cy="50" r={R_OUT} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.2" />
            <circle cx="50" cy="50" r="39" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

            {/* Rose rotates with device heading (heading-up) */}
            <g transform={`rotate(${roseRotate} 50 50)`}>
              {/* ticks */}
              {Array.from({ length: 72 }).map((_, i) => {
                const deg = i * 5;
                const isMajor = deg % 30 === 0;
                const isMinor = !isMajor && deg % 10 === 0;

                const a = polar(deg, R_TICK_OUT);
                const b = polar(deg, isMajor ? R_TICK_MAJOR_IN : isMinor ? R_TICK_MINOR_IN : R_TICK_MICRO_IN);

                const stroke = isMajor
                  ? "rgba(255,255,255,0.88)"
                  : isMinor
                  ? "rgba(255,255,255,0.24)"
                  : "rgba(255,255,255,0.14)";

                const sw = isMajor ? 0.9 : isMinor ? 0.6 : 0.42;

                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" />
                );
              })}

              {/* Gust / variable spread arc */}
              {showSpreadArc ? (
                <g>
                  {(() => {
                    const rArc = 43.8; // tweak 41–45
                    const swArc = 3.2; // thickness

                    const arc1 = spreadWraps ? arcPath(startDeg, 360, rArc) : arcPath(startDeg, endDeg, rArc);
                    const arc2 = spreadWraps ? arcPath(0, endDeg, rArc) : null;

                    return (
                      <>
                        <path
                          d={arc1}
                          fill="none"
                          stroke="rgba(255,255,255,0.18)"
                          strokeWidth={swArc}
                          strokeLinecap="round"
                        />
                        {arc2 ? (
                          <path
                            d={arc2}
                            fill="none"
                            stroke="rgba(255,255,255,0.18)"
                            strokeWidth={swArc}
                            strokeLinecap="round"
                          />
                        ) : null}
                      </>
                    );
                  })()}
                </g>
              ) : null}

              {/* runway */}
              <g>
                <rect x={rwy.x} y={rwy.y} width={rwy.w} height={rwy.h} rx={rwy.rx} fill="rgba(55,65,80,0.55)" />
                <rect x={rwy.x} y={rwy.y} width={rwy.w} height={rwy.h} rx={rwy.rx} fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="0.7" />

                <line
                  x1={rwy.x + rwy.w * 0.36}
                  y1={yC}
                  x2={rwy.x + rwy.w * 0.64}
                  y2={yC}
                  stroke="rgba(255,255,255,0.90)"
                  strokeWidth="0.65"
                  strokeLinecap="butt"
                  strokeDasharray="1.6 2.6"
                />

                {/* runway numbers */}
                <text
                  x={rwy.x + 6.5}
                  y={yC}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5.1"
                  letterSpacing="0.7"
                  fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
                  fontWeight="650"
                  fill={rwy09Fill}
                  transform={`rotate(90 ${rwy.x + 6.5} ${yC})`}
                >
                  09
                </text>

                <text
                  x={rwy.x + rwy.w - 6.5}
                  y={yC}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5.1"
                  letterSpacing="0.7"
                  fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
                  fontWeight="650"
                  fill={rwy27Fill}
                  transform={`rotate(270 ${rwy.x + rwy.w - 6.5} ${yC})`}
                >
                  27
                </text>
              </g>

              {/* cardinals OUTSIDE the ring */}
              {textCardinal("N", 50, N_Y)}
              {textCardinal("E", E_X, 50)}
              {textCardinal("S", 50, S_Y)}
              {textCardinal("W", W_X, 50)}
            </g>

            {/* Airplane icon — ONLY when device compass is ON (behind needle) */}
            {showDeviceHeading ? (
              <g transform="translate(50 50)">
                {/* Your outline points RIGHT; rotate 90 to point UP, then +180 as requested => 270 total */}
                <g transform="rotate(270) scale(65)">
                  <path
                    d={PLANE_OUTLINE_PATH}
                    fill="rgba(255,255,255,0.10)"
                    stroke="rgba(255,255,255,0.40)"
                    strokeWidth={0.03}
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            ) : null}

            {/* Wind needle — ALWAYS visible */}
<g transform={`rotate(${needleRotate} 50 50)`}>
  <path
    d="
      M 50 9
      L 52.1 28.3
      L 54.1 50
      L 54.1 59
      L 50 65
      L 45.9 59
      L 45.9 50
      L 47.9 28.3 Z
    "
    fill={needleFill}
    stroke={needleOuter}
    strokeWidth="1.05"
    strokeLinejoin="round"
  />

  <path
    d="
      M 50 9
      L 51.4 28.3
      L 52.6 50
      L 52.6 59
      L 50 64
      L 47.4 59
      L 47.4 50
      L 48.6 28.3 Z
    "
    fill="none"
    stroke={needleMid}
    strokeOpacity="0.9"
    strokeWidth="0.4"
    strokeLinejoin="round"
  />

  <circle cx="50" cy="50" r="3.3" fill="rgba(255,255,255,0.10)" />
  <circle
    cx="50"
    cy="50"
    r="2.2"
    fill="#0b0f14"
    stroke="rgba(255,255,255,0.35)"
    strokeWidth="0.55"
  />

  {/* direction bubble at tail (COUNTER-ROTATE so it stays upright) */}
  <g transform={`rotate(${-needleRotate} 50 50)`}>
    <rect
      x={50 - 7.0}
      y={71.4}
      width={14.0}
      height={7.4}
      rx={2.4}
      fill="rgba(0,0,0,0.55)"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="0.5"
    />
    <text
      x="50"
      y={71.4 + 5.2}
      textAnchor="middle"
      fontSize="4.0"
      fill="rgba(255,255,255,0.92)"
      fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
      fontWeight="800"
    >
      {dirLabel}
    </text>
  </g>
</g>

          </svg>
        </div>
      </div>
    </div>
  );

}

/**
 * Airplane outline path extracted from your provided icon.
 * Original points appear to face RIGHT; we rotate it in the SVG.
 */
const PLANE_OUTLINE_PATH =
  "M -0.19 -0.54 L -0.2 -0.49 L -0.22 -0.06 L -0.37 -0.05 L -0.39 -0.01 L -0.44 0 L -0.39 0.02 L -0.37 0.05 L -0.21 0.06 L -0.21 0.3 L -0.19 0.52 L -0.17 0.54 L -0.11 0.54 L -0.05 0.29 L -0.06 0.07 L -0.05 0.05 L 0.24 0.01 L 0.26 0.03 L 0.27 0.18 L 0.36 0.19 L 0.37 0.05 L 0.35 0.02 L 0.36 0.01 L 0.48 -0.01 L 0.35 -0.02 L 0.37 -0.05 L 0.36 -0.2 L 0.27 -0.19 L 0.26 -0.04 L 0.24 -0.02 L -0.05 -0.06 L -0.06 -0.3 L -0.11 -0.54 Z";
