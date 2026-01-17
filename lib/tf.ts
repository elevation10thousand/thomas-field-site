// lib/tf.ts
// Thomas Field helpers used by the /live page

export type ThomasWx = {
  msg?: string;
  msg_seq?: number;
  ts_unix_s?: number;

  wind_dir_deg?: number;
  wind_dir_avg_deg?: number;
  wind_dir_gust_deg?: number;
  wind_dir_spread_deg?: number;
  wind_dir_variable?: number;

  wind_speed_kt?: number;
  wind_gust_kt?: number;

  temp_f?: number;
  dewpoint_f?: number;
  rh_pct?: number;

  altimeter_inhg?: number;
  da_ft?: number;
  cloud_base_agl_ft?: number;

  hw_09?: number;
  xw_09?: number;
  hw_27?: number;
  xw_27?: number;
  rec_rwy?: string;
  rec_reason?: string;

  uptime_ms?: number;
  ip?: string;
  rssi?: number;
};

export function ageSeconds(wx: ThomasWx, nowMs: number): number {
  const ts = wx?.ts_unix_s;
  if (typeof ts !== "number" || !isFinite(ts) || ts <= 0) return NaN;
  const nowS = nowMs / 1000;
  return nowS - ts;
}

// Per your request: use wind_dir_deg first as primary decision driver.
// If missing, fall back to avg.
export function pickWindDirDeg(wx: ThomasWx): number | null {
  const d = wx?.wind_dir_deg;
  if (typeof d === "number" && isFinite(d)) return norm360(d);

  const a = wx?.wind_dir_avg_deg;
  if (typeof a === "number" && isFinite(a)) return norm360(a);

  return null;
}

// METAR-like line 1 (no 10SM CLR)
export function metarLikeLine1(wx: ThomasWx): string {
  // Station ID per your request
  const station = "Thomas_FLD";

  // Time in Z from ts_unix_s if present
  const z = wx?.ts_unix_s ? zuluTime(wx.ts_unix_s) : "------Z";

  // Wind group
  const dir = pickWindDirDeg(wx);
  const spd = num(wx?.wind_speed_kt);
  const gst = num(wx?.wind_gust_kt);

  const dirStr = dir === null ? "///" : String(Math.round(dir)).padStart(3, "0");
  const spdStr = spd === null ? "__" : String(spd).padStart(2, "0");

  // Add gust only if meaningful (gust >= speed + 2)
  const gustStr =
    gst !== null && spd !== null && gst >= spd + 2 ? `G${String(gst).padStart(2, "0")}` : "";

  // Altimeter
  const alt = typeof wx?.altimeter_inhg === "number" && isFinite(wx.altimeter_inhg)
    ? `A${String(Math.round(wx.altimeter_inhg * 100)).padStart(4, "0")}`
    : "A----";

  return `${station} ${z} ${dirStr}${spdStr}${gustStr}KT ${alt}`;
}

// METAR-like line 2 (put the extras you care about)
export function metarLikeLine2(wx: ThomasWx): string {
  const t = typeof wx?.temp_f === "number" && isFinite(wx.temp_f) ? `${wx.temp_f.toFixed(1)}F` : "—";
  const dp = typeof wx?.dewpoint_f === "number" && isFinite(wx.dewpoint_f) ? `${wx.dewpoint_f.toFixed(1)}F` : "—";
  const da = typeof wx?.da_ft === "number" && isFinite(wx.da_ft) ? `${Math.round(wx.da_ft)}ft` : "—";
  const cb = typeof wx?.cloud_base_agl_ft === "number" && isFinite(wx.cloud_base_agl_ft)
    ? `${Math.round(wx.cloud_base_agl_ft)}AGL`
    : "—";

  const rec = wx?.rec_rwy ? `RWY${wx.rec_rwy}` : "RWY—";

  return `TEMP ${t}  DP ${dp}  DA ${da}  CIG ${cb}  REC ${rec}`;
}

/* ---------------- helpers ---------------- */

function norm360(x: number) {
  let v = x % 360;
  if (v < 0) v += 360;
  return v;
}

function num(v: any): number | null {
  const n = typeof v === "number" && isFinite(v) ? v : NaN;
  return isFinite(n) ? Math.round(n) : null;
}

function zuluTime(tsUnixS: number): string {
  const d = new Date(tsUnixS * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  // METAR usually HHMMZ; we'll keep it simple:
  return `${hh}${mm}Z`;
}
