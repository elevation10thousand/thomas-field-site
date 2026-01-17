"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ThomasWx,
  ageSeconds,
  metarLikeLine1,
  metarLikeLine2,
  pickWindDirDeg,
} from "../../lib/tf";

const CALM_KT = 2.0; // show CALM when wind < 2 kt
const WARNING_SECONDS = 300; // 5 minutes
const WEDGE_SPREAD_MIN_DEG = 8; // show wedge if spread > this, OR wind_dir_variable==1

function fmtAge(s: number) {
  if (!isFinite(s) || s < 0) return "—";
  if (s < 60) return `${Math.round(s)}s ago`;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}m ${r}s ago`;
}

export default function LivePage() {
  const [wx, setWx] = useState<ThomasWx | null>(null);
  const [status, setStatus] = useState<string>("Connecting…");
  const [now, setNow] = useState<number>(() => Date.now());

  const staleSeconds = Number(process.env.NEXT_PUBLIC_STALE_SECONDS || "180");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/live");

    es.addEventListener("status", (e: MessageEvent) => {
      try {
        const j = JSON.parse(e.data);
        if (j?.connected) setStatus("Live");
        else if (j?.found === false) setStatus("Waiting for data…");
      } catch {
        setStatus("Live");
      }
    });

    es.addEventListener("wx", (e: MessageEvent) => {
      const j = JSON.parse(e.data) as ThomasWx;
      setWx(j);
      setStatus("Live");
    });

    es.addEventListener("error", () => setStatus("Reconnecting…"));

    return () => es.close();
  }, []);

  const age = useMemo(() => (wx ? ageSeconds(wx, now) : NaN), [wx, now]);
  const stale = useMemo(
    () => (wx ? ageSeconds(wx, now) > staleSeconds : false),
    [wx, now, staleSeconds]
  );

  const metar1 = wx ? metarLikeLine1(wx) : "Thomas_FLD ------Z ---__KT A----";
  const metar2 = wx ? metarLikeLine2(wx) : "";

  // wind_dir_deg first (primary decision driver)
  const windDir = wx ? pickWindDirDeg(wx) : null;

  const windSpd = wx?.wind_speed_kt ?? null;
  const windGust = wx?.wind_gust_kt ?? null;
  const spread = wx?.wind_dir_spread_deg ?? null;
  const variableFlag = wx?.wind_dir_variable ?? 0;

  const isCalm =
    typeof windSpd === "number" && isFinite(windSpd) && windSpd < CALM_KT;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-5">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* METAR-like strip */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-lg md:text-xl whitespace-pre-wrap leading-snug">
              {metar1}
              {metar2 ? "\n" + metar2 : ""}
            </div>

            <div className="text-right">
              <div className="text-sm text-neutral-300">{status}</div>

              {/* UPDATED status w/ WARNING */}
              {(() => {
                const ageSec = wx ? ageSeconds(wx, now) : NaN;
                const warn5min = isFinite(ageSec) && ageSec >= WARNING_SECONDS;

                const updatedText = wx ? `UPDATED ${fmtAge(ageSec)}` : "UPDATED —";

                return (
                  <div
                    className={`text-sm font-semibold ${
                      warn5min
                        ? "text-red-400"
                        : stale
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {warn5min ? (
                      <span className="mr-2 font-extrabold text-red-500">
                        WARNING
                      </span>
                    ) : null}
                    {updatedText}
                  </div>
                );
              })()}

              {/* calm hint */}
              <div className="mt-1 text-xs text-neutral-400">
                {isCalm ? "CALM (<2 kt)" : ""}
              </div>
            </div>
          </div>
        </section>

        {/* Compass / Runway / Wind */}
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-neutral-300 text-sm">Pilot Wind Graphic</div>
            <div className="text-xs text-neutral-400">
              Dir uses{" "}
              <span className="text-neutral-200">wind_dir_deg</span> • Wedge uses{" "}
              <span className="text-neutral-200">spread</span> /{" "}
              <span className="text-neutral-200">variable</span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <CompassRunwayWind
              windDirDeg={windDir}
              windSpeedKt={numRaw(windSpd)}
              windGustKt={numRaw(windGust)}
              windSpreadDeg={numRaw(spread)}
              windDirVariable={variableFlag}
              recRwy={wx?.rec_rwy ?? null}
              rwyHeading09={90} // RWY 09/27
            />
          </div>
        </section>

        {/* Tiles */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Recommended Runway">
            <div className="text-5xl font-semibold tracking-wide">
              {wx?.rec_rwy ? `RWY ${wx.rec_rwy}` : "—"}
            </div>
          </Card>

          <Card title="Wind">
            <div className="text-4xl font-semibold">
              {num(wx?.wind_speed_kt, 1)}{" "}
              <span className="text-base font-normal text-neutral-300">kt</span>
            </div>
            <div className="text-neutral-200 mt-1">
              {isCalm ? (
                <span className="font-semibold text-neutral-100">CALM</span>
              ) : null}
              {isCalm ? " • " : ""}
              Gust: {num(wx?.wind_gust_kt, 1)} kt • Dir:{" "}
              {windDir !== null ? `${Math.round(windDir)}°` : "—"} • Spread:{" "}
              {wx?.wind_dir_spread_deg?.toFixed?.(1) ?? "—"}°
            </div>
          </Card>

          <Card title="Runway Components (RWY 09)">
            <div className="text-neutral-200">
              <span className="text-neutral-400">REC:</span>{" "}
              <span className="text-neutral-100 font-semibold">
                {wx?.rec_rwy ?? "—"}
              </span>{" "}
              • <span className="text-neutral-400">XW:</span>{" "}
              {signed(wx?.xw_09)} kt •{" "}
              <span className="text-neutral-400">HW:</span> {signed(wx?.hw_09)} kt
            </div>
          </Card>

          <Card title="Runway Components (RWY 27)">
            <div className="text-neutral-200">
              <span className="text-neutral-400">REC:</span>{" "}
              <span className="text-neutral-100 font-semibold">
                {wx?.rec_rwy ?? "—"}
              </span>{" "}
              • <span className="text-neutral-400">XW:</span>{" "}
              {signed(wx?.xw_27)} kt •{" "}
              <span className="text-neutral-400">HW:</span> {signed(wx?.hw_27)} kt
            </div>
          </Card>

          <Card title="Altimeter">
            <div className="text-4xl font-semibold">{num(wx?.altimeter_inhg, 2)}</div>
            <div className="text-neutral-400 text-sm mt-1">inHg</div>
          </Card>

          <Card title="Density Altitude">
            <div className="text-4xl font-semibold">
              {wx?.da_ft ? Math.round(wx.da_ft) : "—"}
            </div>
            <div className="text-neutral-400 text-sm mt-1">ft</div>
          </Card>

          <Card title="Temp / Dewpoint / RH">
            <div className="text-neutral-200">
              {num(wx?.temp_f, 1)}°F / {num(wx?.dewpoint_f, 1)}°F • RH{" "}
              {num(wx?.rh_pct, 0)}%
            </div>
          </Card>

          <Card title="Cloud Base (derived)">
            <div className="text-neutral-200">
              {wx?.cloud_base_agl_ft
                ? `${Math.round(wx.cloud_base_agl_ft)} AGL ft`
                : "—"}
            </div>
          </Card>

          <Card title="System Health">
            <div className="text-neutral-200">
              Uptime:{" "}
              {wx?.uptime_ms ? `${Math.round(wx.uptime_ms / 1000)}s` : "—"} • RSSI:{" "}
              {wx?.rssi ?? "—"} • IP: {wx?.ip ?? "—"}
            </div>
          </Card>

          <Card title="Raw JSON (debug)">
            <pre className="text-xs overflow-auto max-h-44 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              {wx ? JSON.stringify(wx, null, 2) : "Waiting for wx…"}
            </pre>
          </Card>
        </section>
      </div>
    </main>
  );
}

function CompassRunwayWind(props: {
  windDirDeg: number | null;
  windSpeedKt: number | null;
  windGustKt: number | null;
  windSpreadDeg: number | null;
  windDirVariable: number;
  recRwy: string | null;
  rwyHeading09: number; // degrees (09 = 90)
}) {
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 160;
  const rInner = 130;

  const dir = props.windDirDeg;
  const spread = props.windSpreadDeg;

  const isCalm =
    props.windSpeedKt !== null && isFinite(props.windSpeedKt) && props.windSpeedKt < CALM_KT;

  const rwyA = props.rwyHeading09; // 90
  const rwyB = (rwyA + 180) % 360; // 270

  const headA = `${String(Math.round(rwyA)).padStart(3, "0")}°`;
  const headB = `${String(Math.round(rwyB)).padStart(3, "0")}°`;

  const windLabel =
    dir === null
      ? "—"
      : `${pad3(dir)}° ${isCalm ? "CALM" : `${fmtKt(props.windSpeedKt)}KT${
          props.windGustKt !== null &&
          props.windSpeedKt !== null &&
          props.windGustKt >= props.windSpeedKt + 2
            ? ` G${fmtKt(props.windGustKt)}`
            : ""
        }`}`;

  // Wedge only when variable flag OR spread > threshold
  const showWedge =
    dir !== null &&
    spread !== null &&
    (props.windDirVariable === 1 || spread > WEDGE_SPREAD_MIN_DEG);

  const wedgePath =
    showWedge && dir !== null && spread !== null
      ? arcWedgePath(cx, cy, rOuter - 6, rInner + 10, dir - spread / 2, dir + spread / 2)
      : null;

  // Always draw arrow when we have direction (faint if calm)
  const arrow = dir !== null ? windArrow(cx, cy, rInner - 8, 120, dir) : null;

  const isRec09 = props.recRwy === "09";
  const isRec27 = props.recRwy === "27";

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* outer rings */}
          <circle
            cx={cx}
            cy={cy}
            r={rOuter}
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="2"
          />
          <circle
            cx={cx}
            cy={cy}
            r={rInner}
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="1"
          />

          {/* ticks */}
          {Array.from({ length: 36 }).map((_, i) => {
            const a = i * 10;
            const isCard = a % 90 === 0;
            const isMajor = a % 30 === 0;
            const len = isCard ? 16 : isMajor ? 10 : 6;
            const p1 = polar(cx, cy, rOuter, a);
            const p2 = polar(cx, cy, rOuter - len, a);
            return (
              <line
                key={i}
                x1={p1.x.toFixed(2)}
                y1={p1.y.toFixed(2)}
                x2={p2.x.toFixed(2)}
                y2={p2.y.toFixed(2)}
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={isCard ? 2 : 1}
              />
            );
          })}

          {/* cardinal labels */}
          {[
            { t: "N", a: 0 },
            { t: "E", a: 90 },
            { t: "S", a: 180 },
            { t: "W", a: 270 },
          ].map((c) => {
            const p = polar(cx, cy, rOuter + 22, c.a);
            return (
              <text
                key={c.t}
                x={p.x.toFixed(2)}
                y={p.y.toFixed(2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="16"
                fill="rgba(255,255,255,0.70)"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
              >
                {c.t}
              </text>
            );
          })}

          {/* runway line (09/27) */}
          {(() => {
            const pA = polar(cx, cy, rInner - 20, rwyA);
            const pB = polar(cx, cy, rInner - 20, rwyB);
            return (
              <>
                <line
                  x1={pA.x.toFixed(2)}
                  y1={pA.y.toFixed(2)}
                  x2={pB.x.toFixed(2)}
                  y2={pB.y.toFixed(2)}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <line
                  x1={pA.x.toFixed(2)}
                  y1={pA.y.toFixed(2)}
                  x2={pB.x.toFixed(2)}
                  y2={pB.y.toFixed(2)}
                  stroke="rgba(0,0,0,0.30)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </>
            );
          })()}

          {/* runway end labels (09 / 27) */}
          {(() => {
            const p09 = polar(cx, cy, rInner + 10, rwyA);
            const p27 = polar(cx, cy, rInner + 10, rwyB);
            return (
              <>
                <text
                  x={p09.x.toFixed(2)}
                  y={p09.y.toFixed(2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="14"
                  fill={isRec09 ? "rgba(110,231,183,0.95)" : "rgba(255,255,255,0.75)"}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                >
                  09
                </text>
                <text
                  x={p27.x.toFixed(2)}
                  y={p27.y.toFixed(2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="14"
                  fill={isRec27 ? "rgba(110,231,183,0.95)" : "rgba(255,255,255,0.75)"}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                >
                  27
                </text>
              </>
            );
          })()}

          {/* runway heading markers (090°/270°) OUTSIDE ring to avoid “duplicate 09/27” look */}
          {(() => {
            const pA = polar(cx, cy, rOuter + 40, rwyA);
            const pB = polar(cx, cy, rOuter + 40, rwyB);
            return (
              <>
                <text
                  x={pA.x.toFixed(2)}
                  y={pA.y.toFixed(2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.55)"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                >
                  {headA}
                </text>
                <text
                  x={pB.x.toFixed(2)}
                  y={pB.y.toFixed(2)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="rgba(255,255,255,0.55)"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
                >
                  {headB}
                </text>
              </>
            );
          })()}

          {/* variable wind wedge */}
          {wedgePath ? (
            <path
              d={wedgePath}
              fill="rgba(255,255,255,0.10)"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
            />
          ) : null}

          {/* wind arrow (faint if calm) */}
          {arrow ? (
            <>
              <path
                d={arrow.line}
                stroke={isCalm ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)"}
                strokeWidth={isCalm ? "2" : "3"}
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={arrow.head}
                fill={isCalm ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)"}
              />
            </>
          ) : null}

          {/* center dot */}
          <circle cx={cx} cy={cy} r={4} fill="rgba(255,255,255,0.8)" />
        </svg>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="font-mono text-sm text-neutral-200">{windLabel}</div>
          <div className="text-xs text-neutral-400">
            {props.windDirVariable === 1 ? (
              <span className="text-neutral-100 font-semibold">VAR</span>
            ) : spread !== null && spread > WEDGE_SPREAD_MIN_DEG ? (
              `VAR ±${(spread / 2).toFixed(1)}°`
            ) : (
              "VAR —"
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/30 p-4">
      <div className="text-neutral-300 text-sm mb-2">{title}</div>
      {children}
    </div>
  );
}

function num(v: any, digits: number) {
  const n = typeof v === "number" && isFinite(v) ? v : NaN;
  return isFinite(n) ? n.toFixed(digits) : "—";
}

function numRaw(v: any): number | null {
  const n = typeof v === "number" && isFinite(v) ? v : NaN;
  return isFinite(n) ? n : null;
}

function signed(v: any) {
  const n = typeof v === "number" && isFinite(v) ? v : NaN;
  if (!isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "−";
  return `${s}${Math.abs(n).toFixed(1)}`;
}

function pad3(n: number): string {
  const x = Math.round(n) % 360;
  return String(x).padStart(3, "0");
}

function fmtKt(v: number | null): string {
  if (v === null) return "__";
  return String(Math.round(v)).padStart(2, "0");
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180; // 0 deg at north
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function windArrow(
  cx: number,
  cy: number,
  rStart: number,
  len: number,
  windFromDeg: number
) {
  // Arrow points FROM outer ring toward center along wind direction
  const p1 = polar(cx, cy, rStart + len, windFromDeg);
  const p2 = polar(cx, cy, rStart, windFromDeg);
  const line = `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(
    2
  )} ${p2.y.toFixed(2)}`;

  // Arrowhead near p2 (toward center)
  const headSize = 10;
  const left = polar(p2.x, p2.y, headSize, windFromDeg + 140);
  const right = polar(p2.x, p2.y, headSize, windFromDeg - 140);
  const head = `M ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${left.x.toFixed(
    2
  )} ${left.y.toFixed(2)} L ${right.x.toFixed(2)} ${right.y.toFixed(2)} Z`;

  return { line, head };
}

function arcWedgePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number
) {
  // normalize sweep (keep it small)
  let s = startDeg;
  let e = endDeg;
  while (e < s) e += 360;

  const largeArc = e - s > 180 ? 1 : 0;

  const p1 = polar(cx, cy, rOuter, s);
  const p2 = polar(cx, cy, rOuter, e);
  const p3 = polar(cx, cy, rInner, e);
  const p4 = polar(cx, cy, rInner, s);

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}





