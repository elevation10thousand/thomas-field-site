"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Wx = {
  ts_unix_s?: number | string;

  wind_dir_deg?: number | string;
  wind_dir_avg_deg?: number | string;
  wind_dir_gust_deg?: number | string;
  wind_dir_spread_deg?: number | string;
  wind_dir_variable?: number | string;
  wind_speed_kt?: number | string;
  wind_gust_kt?: number | string;

  temp_f?: number | string;
  dewpoint_f?: number | string;
  altimeter_inhg?: number | string;
  da_ft?: number | string;

  cloud_base_agl_ft?: number | string;

  gps_fix?: number | string;
  gps_lat?: number | string;
  gps_lon?: number | string;
  gps_sats?: number | string;
  gps_hdop?: number | string;

  rec_rwy?: "09" | "27" | string;
  hw_09?: number | string;
  xw_09?: number | string;
  hw_27?: number | string;
  xw_27?: number | string;

  advisory?: string | null;
  rec_reason?: string;

  advisory_ts_unix_s?: number | string | null;
  advisory_age_s?: number | string | null;

  advisory_color?: string | null;
};

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

function windGroup(wx?: Wx) {
  const spd = pickSpdKt(wx);
  const gst = pickGustKt(wx);
  const dir = pickDirDeg(wx);

  if (spd !== null && spd < 2) return `CALM`;

  const dirStr = dir === null ? "///" : String(Math.round(dir)).padStart(3, "0");
  const spdStr = spd === null ? "__" : String(Math.round(spd)).padStart(2, "0");

  let gustStr = "";
  if (gst !== null && spd !== null && gst >= spd + 2) gustStr = `G${String(Math.round(gst)).padStart(2, "0")}`;

  return `${dirStr}${spdStr}${gustStr}KT`;
}

function cloudBaseGroup(wx?: Wx) {
  const cb = num(wx?.cloud_base_agl_ft);
  if (cb === null) return "CB ---";
  const rounded = Math.max(0, Math.round(cb / 100) * 100);
  return `CB ${rounded}ftAGL`;
}

function topLine(wx?: Wx) {
  const station = "Thomas_FLD";
  const t = zulu(wx?.ts_unix_s);
  const w = windGroup(wx);
  const cb = cloudBaseGroup(wx);

  const temp = fmt1(wx?.temp_f);
  const dp = fmt1(wx?.dewpoint_f);

  const a = altGroupA(wx);
  const daN = num(wx?.da_ft);
  const da = daN === null ? "—" : `${Math.round(daN)}ft`;

  return `${station} ${t} ${w}  ${cb}  TEMP ${temp}F  DP ${dp}F  ${a}  DA ${da}`;
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

export default function LivePage() {
  const [wx, setWx] = useState<Wx | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const pollSeconds = Number(
    (process.env.NEXT_PUBLIC_SSE_POLL_SECONDS as any) || (process.env.SSE_POLL_SECONDS as any) || "8"
  );

  // --- SSE client ---
  useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;

    function start() {
      try {
        es = new EventSource("/api/live/sse");
        es.addEventListener("wx", (ev: MessageEvent) => {
          try {
            const j = JSON.parse(ev.data);
            setWx(j);
            setErr(null);
          } catch {}
        });
        es.addEventListener("error", () => {
          // browsers auto-retry, but if it keeps failing show a hint
          setErr("SSE disconnected (will retry).");
        });
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    }

    start();

    return () => {
      stopped = true;
      if (es) es.close();
      es = null;
      if (stopped) return;
    };
  }, [pollSeconds]);

  const ageSec = useMemo(() => {
    const ts = num(wx?.ts_unix_s);
    if (ts === null) return null;
    return Math.max(0, Math.round(nowMs / 1000 - ts));
  }, [wx?.ts_unix_s, nowMs]);

  const warnYellowSec = 120;
  const warnRedSec = 300;

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

  // --- Advisory (FIELD/RWY) from Sheets only ---
  const advisoryTextRaw = str(wx?.advisory).trim();
  const fieldAdvisoryText = advisoryTextRaw; // ONLY Sheets

  const advisoryAgeSec = useMemo(() => {
    const a = num(wx?.advisory_age_s);
    if (a !== null) return Math.max(0, Math.round(a));
    const ts = num(wx?.advisory_ts_unix_s);
    if (ts === null) return null;
    return Math.max(0, Math.round(nowMs / 1000 - ts));
  }, [wx?.advisory_age_s, wx?.advisory_ts_unix_s, nowMs]);

  const advisoryColorRaw = str(wx?.advisory_color).trim().toLowerCase();
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

  const fieldClosed =
    !!fieldAdvisoryText &&
    /field\s*closed|rwy\s*closed|closed|no\s*landings|do\s*not\s*land|unusable/i.test(fieldAdvisoryText);

  const hasOpsOverride =
    (() => {
      const advTs = num(wx?.advisory_ts_unix_s);
      const wxTs = num(wx?.ts_unix_s);
      return !!fieldAdvisoryText && advTs !== null && wxTs !== null && advTs > wxTs;
    })();

  const rec = fieldClosed ? "--" : (str(wx?.rec_rwy) || "—").toUpperCase();
  const recIs09 = rec === "09";
  const recIs27 = rec === "27";

  // --- Device compass smoothing ---
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassOn, setCompassOn] = useState(false);
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const headingSmoothedRef = useRef<number | null>(null);
  const lastHeadingUpdateMsRef = useRef<number>(0);

  function shortestAngleDeltaDeg(a: number, b: number) {
    // delta from a -> b in [-180, 180]
    let d = (b - a + 540) % 360 - 180;
    return d;
  }

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

    headingSmoothedRef.current = null;
    lastHeadingUpdateMsRef.current = Date.now();

    const handler: (e: DeviceOrientationEvent) => void = (e) => {
      const anyE = e as any;
      let raw: number | null = null;

      if (typeof anyE.webkitCompassHeading === "number") raw = anyE.webkitCompassHeading;
      else if (typeof e.alpha === "number") raw = e.alpha;

      if (raw === null || !Number.isFinite(raw)) return;
      raw = clamp360(raw);

      const now = Date.now();
      const dt = Math.max(0.001, (now - lastHeadingUpdateMsRef.current) / 1000);
      lastHeadingUpdateMsRef.current = now;

      const prev = headingSmoothedRef.current;

      // low-pass filter + max step (kills jitter)
      // alpha smaller => more smoothing
      const alpha = 0.10;

      let next: number;
      if (prev === null) {
        next = raw;
      } else {
        const delta = shortestAngleDeltaDeg(prev, raw);
        // limit slew rate to 90 deg/sec
        const maxStep = 90 * dt;
        const step = Math.max(-maxStep, Math.min(maxStep, delta));
        next = clamp360(prev + step);
        // additional smoothing
        const d2 = shortestAngleDeltaDeg(next, raw);
        next = clamp360(next + d2 * alpha);
      }

      headingSmoothedRef.current = next;
      setDeviceHeading(next);
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
    headingSmoothedRef.current = null;
  }

  // GPS line
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
    if (gpsLat !== null && gpsLon !== null) parts.push(`${gpsLat.toFixed(5)}, ${gpsLon.toFixed(5)}`);
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

            {err && <div className="mt-3 text-xs text-rose-300">Error: {err}</div>}

            {/* FIELD / RWY Advisory (Sheets only) */}
            {fieldAdvisoryText ? (
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
                  <div className="text-[11px] text-neutral-300/70">
                    {advisoryAgeSec === null ? "" : fmtAge(advisoryAgeSec)}
                  </div>
                </div>

                <div className="mt-1 text-sm text-neutral-100/90">{fieldAdvisoryText}</div>

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
          </div>
        </section>

        <div className="h-8" />
      </div>
    </main>
  );
}

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
  const roseRotate = showDeviceHeading && deviceHeadingDeg !== null ? -deviceHeadingDeg : 0;
  const windDeg = windFromDeg !== null ? windFromDeg : 0;

  function round3(n: number) {
    return Math.round(n * 1000) / 1000;
  }
  function polar(deg: number, r: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: round3(50 + r * Math.sin(rad)), y: round3(50 - r * Math.cos(rad)) };
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

  const hdgText =
    showDeviceHeading && deviceHeadingDeg !== null ? `${String(Math.round(deviceHeadingDeg)).padStart(3, "0")}°` : "—";

  const rec = (recRwy || "").toUpperCase();
  const rwy09Fill = rec === "09" ? "rgba(34,197,94,0.95)" : "rgba(255,255,255,0.92)";
  const rwy27Fill = rec === "27" ? "rgba(34,197,94,0.95)" : "rgba(255,255,255,0.92)";

  // runway
  const rwy = { x: 22, y: 45.6, w: 56, h: 8.8, rx: 0 };
  const yC = rwy.y + rwy.h / 2;

  const needleFill = "rgba(120,130,145,0.55)";
  const needleOuter = "rgba(255,255,255,1)";
  const needleMid = "rgba(156,163,175,0.90)";

  // ring geometry (bigger compass, no clipping)
  const R_OUT = 46.8;
  const R_TICK_OUT = 49.6;
  const R_TICK_MAJOR_IN = 45.6;
  const R_TICK_MINOR_IN = 46.9;
  const R_TICK_MICRO_IN = 47.9;

  const CARD_PAD = 7.2;
  const N_Y = 50 - (R_OUT + CARD_PAD);
  const S_Y = 50 + (R_OUT + CARD_PAD);
  const E_X = 50 + (R_OUT + CARD_PAD);
  const W_X = 50 - (R_OUT + CARD_PAD);

  // airplane: halfway to ring, pointing "forward" (up) in the rose
  const PLANE_R = R_OUT * 0.55;
  const planePos = polar(0, PLANE_R); // 0° is "north"/up in our polar() convention

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

        {/* Bigger compass without clipping */}
        <div className="mx-auto aspect-square w-full max-w-[520px] pt-14 pb-14">
          <svg viewBox="-8 -18 116 136" className="h-full w-full block" role="img" aria-label="Wind direction vs runway">
            <circle cx="50" cy="50" r={R_OUT} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.2" />
            <circle cx="50" cy="50" r="39.6" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="31.6" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

            {/* Rose rotates with device heading */}
            <g transform={`rotate(${roseRotate} 50 50)`}>
              {Array.from({ length: 72 }).map((_, i) => {
                const deg = i * 5;
                const isMajor = deg % 30 === 0;
                const isMinor = !isMajor && deg % 10 === 0;

                const a = polar(deg, R_TICK_OUT);
                const b = polar(deg, isMajor ? R_TICK_MAJOR_IN : isMinor ? R_TICK_MINOR_IN : R_TICK_MICRO_IN);

                const stroke = isMajor
                  ? "rgba(255,255,255,0.88)"
                  : isMinor
                  ? "rgba(255,255,255,0.26)"
                  : "rgba(255,255,255,0.16)";

                const sw = isMajor ? 0.95 : isMinor ? 0.62 : 0.44;

                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeLinecap="butt"
                  />
                );
              })}

              {/* runway */}
              <g>
                <rect x={rwy.x} y={rwy.y} width={rwy.w} height={rwy.h} rx={rwy.rx} fill="rgba(55,65,80,0.55)" />
                <rect
                  x={rwy.x}
                  y={rwy.y}
                  width={rwy.w}
                  height={rwy.h}
                  rx={rwy.rx}
                  fill="none"
                  stroke="rgba(255,255,255,0.24)"
                  strokeWidth="0.7"
                />

                <line
                  x1={rwy.x + rwy.w * 0.36}
                  y1={yC}
                  x2={rwy.x + rwy.w * 0.64}
                  y2={yC}
                  stroke="rgba(255,255,255,0.90)"
                  strokeWidth="1.15"
                  strokeLinecap="butt"
                  strokeDasharray="1.6 2.6"
                />

                <text
                  x={rwy.x + 6.8}
                  y={yC}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5.2"
                  letterSpacing="0.8"
                  fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
                  fontWeight="650"
                  fill={rwy09Fill}
                  transform={`rotate(90 ${rwy.x + 6.8} ${yC})`}
                >
                  09
                </text>

                <text
                  x={rwy.x + rwy.w - 6.8}
                  y={yC}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5.2"
                  letterSpacing="0.8"
                  fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
                  fontWeight="650"
                  fill={rwy27Fill}
                  transform={`rotate(270 ${rwy.x + rwy.w - 6.8} ${yC})`}
                >
                  27
                </text>
              </g>

              {textCardinal("N", 50, N_Y)}
              {textCardinal("E", E_X, 50)}
              {textCardinal("S", 50, S_Y)}
              {textCardinal("W", W_X, 50)}

              {/* airplane icon shows only when device compass is ON */}
              {showDeviceHeading ? (
                <g transform={`translate(${planePos.x} ${planePos.y}) rotate(0)`}>
                  {/* shadow */}
                  <path
                    d="M 0 -4 L 1.6 -2.6 L 6 -1.2 L 6 1.2 L 1.6 2.6 L 0 4 L -1.6 2.6 L -6 1.2 L -6 -1.2 L -1.6 -2.6 Z"
                    fill="rgba(0,0,0,0.35)"
                    transform="translate(0.45 0.55)"
                  />
                  {/* outline + fill (map style) */}
                  <path
                    d="M 0 -4 L 1.6 -2.6 L 6 -1.2 L 6 1.2 L 1.6 2.6 L 0 4 L -1.6 2.6 L -6 1.2 L -6 -1.2 L -1.6 -2.6 Z"
                    fill="rgba(255,255,255,0.95)"
                    stroke="rgba(37,99,235,0.95)"
                    strokeWidth="0.9"
                    strokeLinejoin="round"
                  />
                  {/* nose extension */}
                  <path
                    d="M 0 -6.4 L 1.2 -4.2 L 0 -3.7 L -1.2 -4.2 Z"
                    fill="rgba(255,255,255,0.95)"
                    stroke="rgba(37,99,235,0.95)"
                    strokeWidth="0.9"
                    strokeLinejoin="round"
                  />
                </g>
              ) : null}
            </g>

            {/* needle rotates with wind direction */}
            <g transform={`rotate(${windDeg} 50 50)`}>
              <path
                d="M 50 9 L 52.1 28.3 L 54.1 50 L 54.1 59 L 50 65 L 45.9 59 L 45.9 50 L 47.9 28.3 Z"
                fill={needleFill}
                stroke={needleOuter}
                strokeWidth="1.05"
                strokeLinejoin="round"
              />
              <path
                d="M 50 10.2 L 51.7 29.1 L 53.3 50 L 53.3 58.3 L 50 63.8 L 46.7 58.3 L 46.7 50 L 48.3 29.1 Z"
                fill="none"
                stroke={needleMid}
                strokeOpacity="0.9"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />
              <circle cx="50" cy="50" r="3.3" fill="rgba(255,255,255,0.10)" />
              <circle cx="50" cy="50" r="2.2" fill="#0b0f14" stroke="rgba(255,255,255,0.35)" strokeWidth="0.55" />

              {/* direction bubble at tail */}
              <g>
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
