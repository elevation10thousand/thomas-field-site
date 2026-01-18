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

  // ✅ advisory color from Sheets
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
 * NOTE: Removed LGxx (last gust) per your request.
 */
function windGroup(wx?: Wx) {
  const spd = pickSpdKt(wx);
  const gst = pickGustKt(wx);
  const dir = pickDirDeg(wx);

  // CALM logic
  if (spd !== null && spd < 2) {
    return `CALM`;
  }

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
  if (cb === null) return "CB ---";
  const rounded = Math.max(0, Math.round(cb / 100) * 100);
  return `CB ${rounded}ftAGL`;
}

function topLine(wx?: Wx) {
  // Order: fld, time, wind, cloud base, temp, dp, alt, da
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

/* ---------------- page ---------------- */

export default function LivePage() {
  const [wx, setWx] = useState<Wx | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [compassOn, setCompassOn] = useState(false);
  const handlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

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
    const ts = num(wx?.advisory_ts_unix_s);
    if (ts === null) return null;
    return Math.max(0, Math.round(nowMs / 1000 - ts));
  }, [wx?.advisory_age_s, wx?.advisory_ts_unix_s, nowMs]);

  // advisory text
  const advisoryTextRaw = str(wx?.advisory).trim();
  const advisoryText = advisoryTextRaw || str(wx?.rec_reason).trim();

  const fieldClosed =
    !!advisoryTextRaw &&
    /field\s*closed|rwy\s*closed|closed|no\s*landings|do\s*not\s*land|unusable/i.test(advisoryTextRaw);

  const hasOpsOverride =
    (!!advisoryTextRaw && fieldClosed) ||
    (() => {
      const advTs = num(wx?.advisory_ts_unix_s);
      const wxTs = num(wx?.ts_unix_s);
      return !!advisoryTextRaw && advTs !== null && wxTs !== null && advTs > wxTs;
    })();

  const rec = fieldClosed ? "--" : (str(wx?.rec_rwy) || "—").toUpperCase();
  const recIs09 = rec === "09";
  const recIs27 = rec === "27";

  // ─────────────────────────────────────────────
  // Advisory color: Sheets overrides aging colors
  // ─────────────────────────────────────────────
  const sheetsColorRaw = str(wx?.advisory_color).trim().toLowerCase();
  const sheetsColor =
    sheetsColorRaw === "green"
      ? "green"
      : sheetsColorRaw === "amber" || sheetsColorRaw === "yellow"
      ? "amber"
      : sheetsColorRaw === "red"
      ? "red"
      : sheetsColorRaw === "neutral" || sheetsColorRaw === "gray" || sheetsColorRaw === "grey"
      ? "neutral"
      : "";

  const hasSheetsColor = sheetsColor.length > 0;

  // fallback to age-based only if Sheets didn’t provide a color
  const advisoryIsFresh = advisoryAgeSec !== null && advisoryAgeSec < 120;
  const advisoryIsOld = advisoryAgeSec !== null && advisoryAgeSec >= 120 && advisoryAgeSec < 300;
  const advisoryIsStale = advisoryAgeSec !== null && advisoryAgeSec >= 300;

  const advisoryBorder = hasSheetsColor
    ? sheetsColor === "red"
      ? "border-rose-500/45 bg-rose-500/12"
      : sheetsColor === "amber"
      ? "border-amber-500/45 bg-amber-500/12"
      : sheetsColor === "green"
      ? "border-emerald-500/35 bg-emerald-500/12"
      : "border-neutral-700 bg-neutral-950/20"
    : advisoryIsStale
    ? "border-rose-500/40 bg-rose-500/10"
    : advisoryIsOld
    ? "border-amber-500/35 bg-amber-500/10"
    : "border-emerald-500/25 bg-emerald-500/10";

  const advisoryTitleColor = hasSheetsColor
    ? sheetsColor === "red"
      ? "text-rose-200"
      : sheetsColor === "amber"
      ? "text-amber-200"
      : sheetsColor === "green"
      ? "text-emerald-200"
      : "text-neutral-200"
    : advisoryIsStale
    ? "text-rose-200"
    : advisoryIsOld
    ? "text-amber-200"
    : "text-emerald-200";

  // pulse only if Sheets says amber/red and it's "fresh"
  const advisoryPulse = hasSheetsColor && advisoryIsFresh && (sheetsColor === "amber" || sheetsColor === "red");

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
    } catch {
      // ignore
    }

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

  // GPS text (simple, robust)
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
              <div className="font-mono text-[15px] leading-snug whitespace-pre-wrap">
                {topLine(wx || undefined)}
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-neutral-400">Live</div>
                <div className={`text-sm font-semibold ${statusClass}`}>{status}</div>
                <div className="text-xs text-neutral-400">{ageSec === null ? "—" : fmtAge(ageSec)}</div>
              </div>
            </div>

            {err && <div className="mt-3 text-xs text-rose-300">Error loading data: {err}</div>}

            {/* Advisory */}
            {advisoryText ? (
              <div
                className={[
                  "mt-4 rounded-2xl border p-3",
                  advisoryBorder,
                  advisoryPulse ? "animate-pulse" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-xs font-semibold ${advisoryTitleColor}`}>
                    Advisory
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

/* ---------------- your WindCompass component stays exactly as you pasted ---------------- */
/* Paste it unchanged below. */

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
    return {
      x: round3(50 + r * Math.sin(rad)),
      y: round3(50 - r * Math.cos(rad)),
    };
  }

  function textCardinal(letter: "N" | "E" | "S" | "W", x: number, y: number) {
    return (
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="5.6"
        fill="rgba(255,255,255,0.72)"
        fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
        fontWeight="700"
        letterSpacing="1.1"
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
    showDeviceHeading && deviceHeadingDeg !== null
      ? `${String(Math.round(deviceHeadingDeg)).padStart(3, "0")}°`
      : "—";

  const rec = (recRwy || "").toUpperCase();
  const rwy09Fill = rec === "09" ? "rgba(34,197,94,0.95)" : "rgba(255,255,255,0.92)";
  const rwy27Fill = rec === "27" ? "rgba(34,197,94,0.95)" : "rgba(255,255,255,0.92)";

  // runway: square ends, darker transparent gray
  const rwy = { x: 20, y: 45.2, w: 60, h: 9.6, rx: 0 };
  const yC = rwy.y + rwy.h / 2;

  const needleFill = "rgba(120,130,145,0.55)";
  const needleOuter = "rgba(255,255,255,1)";
  const needleMid = "rgba(156,163,175,0.90)";

  // instrument-grade geometry
  const R_OUT = 45.8;
  const R_TICK_OUT = 48.2; // pushed outward more
  const R_TICK_MAJOR_IN = 43.6; // smaller ticks (shorter)
  const R_TICK_MINOR_IN = 45.1;
  const R_TICK_MICRO_IN = 46.2;

  // cardinals: pushed out, equal distance from ring
  const CARD_PAD = 6.4;
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

        {/* Taller box for breathing room */}
        <div className="mx-auto aspect-square w-full max-w-[460px] pt-14 pb-14">
          <svg viewBox="-6 -12 112 124" className="h-full w-full block" role="img" aria-label="Wind direction vs runway 09/27">
            {/* rings */}
            <circle cx="50" cy="50" r={R_OUT} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="2.2" />
            <circle cx="50" cy="50" r="39" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="31" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

            {/* Rose rotates with device heading */}
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
                  ? "rgba(255,255,255,0.26)"
                  : "rgba(255,255,255,0.16)";

                const sw = isMajor ? 0.95 : isMinor ? 0.62 : 0.44;

                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeLinecap="butt" />
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
                  x={rwy.x + 7.2}
                  y={yC}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5.4"
                  letterSpacing="0.8"
                  fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
                  fontWeight="650"
                  fill={rwy09Fill}
                  transform={`rotate(90 ${rwy.x + 7.2} ${yC})`}
                >
                  09
                </text>

                <text
                  x={rwy.x + rwy.w - 7.2}
                  y={yC}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="5.4"
                  letterSpacing="0.8"
                  fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto'
                  fontWeight="650"
                  fill={rwy27Fill}
                  transform={`rotate(270 ${rwy.x + rwy.w - 7.2} ${yC})`}
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

            {/* needle rotates with wind direction */}
            <g transform={`rotate(${windDeg} 50 50)`}>
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
                  M 50 10.2
                  L 51.7 29.1
                  L 53.3 50
                  L 53.3 58.3
                  L 50 63.8
                  L 46.7 58.3
                  L 46.7 50
                  L 48.3 29.1 Z
                "
                fill="none"
                stroke={needleMid}
                strokeOpacity="0.9"
                strokeWidth="0.7"
                strokeLinejoin="round"
              />

              <path
                d="
                  M 50 11.6
                  L 51.0 30.5
                  L 52.3 50
                  L 52.3 57.6
                  L 50 62.6
                  L 47.7 57.6
                  L 47.7 50
                  L 49.0 30.5 Z
                "
                fill="none"
                stroke={needleOuter}
                strokeWidth="0.35"
                strokeLinejoin="round"
              />

              <rect x="49.2" y="65.0" width="1.6" height="4.8" rx="0.5" fill={needleFill} stroke={needleOuter} strokeWidth="0.45" />
              <rect x="49.35" y="65.15" width="1.3" height="4.5" rx="0.45" fill="none" stroke={needleMid} strokeWidth="0.35" />

              <circle cx="50" cy="50" r="3.3" fill="rgba(255,255,255,0.10)" />
              <circle cx="50" cy="50" r="2.2" fill="#0b0f14" stroke="rgba(255,255,255,0.35)" strokeWidth="0.55" />

              {/* direction bubble at tail */}
              <g>
                <rect x={50 - 7.0} y={71.4} width={14.0} height={7.4} rx={2.4} fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" />
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







