// lib/tf.ts
// Thomas Field helpers + normalization used by /api/live and /live UI

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
  advisory?: string;

  uptime_ms?: number;
  ip?: string;
  rssi?: number;

  // GPS
  gps_fix?: number;
  gps_lat?: number;
  gps_lon?: number;
  gps_alt_m?: number;
};

type AnyObj = Record<string, any>;

/* ---------------- basic utils ---------------- */

function num(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function int(v: any): number | undefined {
  const n = num(v);
  if (n === undefined) return undefined;
  return Math.round(n);
}

function norm360(x: number) {
  let v = x % 360;
  if (v < 0) v += 360;
  return v;
}

/* ---------------- normalization ---------------- */

// Takes raw Loki JSON (strings/numbers) and returns clean ThomasWx numbers.
export function normalizeWx(raw: any): ThomasWx | null {
  const j: AnyObj = raw && typeof raw === "object" ? raw : null;
  if (!j) return null;

  const out: ThomasWx = {
    msg: typeof j.msg === "string" ? j.msg : undefined,
    msg_seq: int(j.msg_seq),
    ts_unix_s: int(j.ts_unix_s),

    wind_dir_deg: num(j.wind_dir_deg),
    wind_dir_avg_deg: num(j.wind_dir_avg_deg),
    wind_dir_gust_deg: num(j.wind_dir_gust_deg),
    wind_dir_spread_deg: num(j.wind_dir_spread_deg),
    wind_dir_variable: int(j.wind_dir_variable),

    wind_speed_kt: num(j.wind_speed_kt),
    wind_gust_kt: num(j.wind_gust_kt),

    temp_f: num(j.temp_f),
    dewpoint_f: num(j.dewpoint_f),
    rh_pct: num(j.rh_pct),

    altimeter_inhg: num(j.altimeter_inhg),
    da_ft: num(j.da_ft),
    cloud_base_agl_ft: num(j.cloud_base_agl_ft),

    hw_09: num(j.hw_09),
    xw_09: num(j.xw_09),
    hw_27: num(j.hw_27),
    xw_27: num(j.xw_27),

    rec_rwy: typeof j.rec_rwy === "string" ? j.rec_rwy : undefined,
    rec_reason: typeof j.rec_reason === "string" ? j.rec_reason : undefined,
    advisory: typeof j.advisory === "string" ? j.advisory : undefined,

    uptime_ms: num(j.uptime_ms),
    ip: typeof j.ip === "string" ? j.ip : undefined,
    rssi: int(j.rssi),

    gps_fix: int(j.gps_fix),
    gps_lat: num(j.gps_lat),
    gps_lon: num(j.gps_lon),
    gps_alt_m: num(j.gps_alt_m),
  };

  // Normalize wind directions
  if (typeof out.wind_dir_deg === "number") out.wind_dir_deg = norm360(out.wind_dir_deg);
  if (typeof out.wind_dir_avg_deg === "number") out.wind_dir_avg_deg = norm360(out.wind_dir_avg_deg);
  if (typeof out.wind_dir_gust_deg === "number") out.wind_dir_gust_deg = norm360(out.wind_dir_gust_deg);

  return out;
}

/* ---------------- derived helpers ---------------- */

function zuluTime(tsUnixS: number): string {
  const d = new Date(tsUnixS * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}${mm}Z`;
}

function metarAltA(wx: ThomasWx): string {
  const a = wx?.altimeter_inhg;
  if (typeof a !== "number" || !Number.isFinite(a)) return "A----";
  return `A${String(Math.round(a * 100)).padStart(4, "0")}`;
}

function pickWindDirDeg(wx: ThomasWx): number | null {
  if (typeof wx.wind_dir_deg === "number") return wx.wind_dir_deg;
  if (typeof wx.wind_dir_avg_deg === "number") return wx.wind_dir_avg_deg;
  if (typeof wx.wind_dir_gust_deg === "number") return wx.wind_dir_gust_deg;
  return null;
}

function metarWind(wx: ThomasWx): string {
  const spd = wx.wind_speed_kt;
  const gst = wx.wind_gust_kt;
  const dir = pickWindDirDeg(wx);

  if (typeof spd === "number" && spd < 2) return "CALM";

  const dirStr = dir === null ? "///" : String(Math.round(dir)).padStart(3, "0");
  const spdStr = typeof spd === "number" ? String(Math.round(spd)).padStart(2, "0") : "__";

  const gustOk =
    typeof gst === "number" &&
    typeof spd === "number" &&
    gst >= spd + 2;

  const gustStr = gustOk ? `G${String(Math.round(gst)).padStart(2, "0")}` : "";

  return `${dirStr}${spdStr}${gustStr}KT`;
}

/**
 * METAR-like top line
 * EXACT FORMAT REQUESTED:
 * Thomas_FLD 0616Z 00014G33KT  CB 4300ftAGL  TEMP 22.4F  DP 3.4F  A2998  DA 9775ft
 */
export function metarTopLine(wx: ThomasWx): string {
  const station = "Thomas_FLD";
  const z = wx.ts_unix_s ? zuluTime(wx.ts_unix_s) : "----Z";
  const w = metarWind(wx);

  const cb =
    typeof wx.cloud_base_agl_ft === "number"
      ? `${Math.round(wx.cloud_base_agl_ft)}ftAGL`
      : "—";

  const t = typeof wx.temp_f === "number" ? `${wx.temp_f.toFixed(1)}F` : "—";
  const dp = typeof wx.dewpoint_f === "number" ? `${wx.dewpoint_f.toFixed(1)}F` : "—";

  const a = metarAltA(wx);
  const da = typeof wx.da_ft === "number" ? `${Math.round(wx.da_ft)}ft` : "—";

  return `${station} ${z} ${w}  CB ${cb}  TEMP ${t}  DP ${dp}  ${a}  DA ${da}`;
}






