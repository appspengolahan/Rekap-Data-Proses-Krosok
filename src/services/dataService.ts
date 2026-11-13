import {
  KrosokRecord,
  DashboardData,
  FilterOptions,
  RingkasanData,
  RekapGroup,
  TrendJenisData,
  GASConfig,
  DhpKrosokItem,
  RekapRawDateRow,
  ActiveDateRealizationAudit
} from '../types';
import { INITIAL_SEED_RECORDS } from '../data/seedData';

export const MONTH_ORDER = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DEFAULT_CONFIG: GASConfig = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbxmUX71wkbeQ5BwmYU-cucKUwXh36sZJjQOiuC1H2haKz0DTJj_7TAwZ6O5eWuH9FOt/exec',
  spreadsheetId: '1A9GgHirYSNN26fG4emsFNOM4pod8xjn4gleWzCaTVzM',
  sheetName: 'REKAP SUSUT KROSOK',
  dhpSpreadsheetId: '1tyE6QWZOPhjLCsjvesU82QePF5RqEBToJsp1m0qQY_w',
  dhpSheetName: 'INTEGRASI DATA',
  autoSyncEnabled: true,
  autoSyncIntervalSeconds: 60,
  lastSyncTimestamp: null,
};

const STORAGE_KEYS = {
  CONFIG: 'krosok_gas_config_v1',
  RAW_DATA: 'krosok_raw_records_v1',
  LAST_FETCH: 'krosok_last_fetch_ts_v1',
  SIDEBAR_COLLAPSED: 'krosok_sidebar_collapsed_v1',
  USER_ROLE: 'krosok_user_role_v1',
  DHP_CACHE: 'krosok_dhp_cache_v1',
  DHP_ACTIVE_DATE: 'krosok_dhp_active_sheet_date_v1',
  DHP_ACTIVE_ISO_DATE: 'krosok_dhp_active_sheet_iso_v1',
};

let _configCacheRaw: string | null | undefined = undefined;
let _configCacheVal: GASConfig | null = null;

export function loadConfig(): GASConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (_configCacheVal && saved === _configCacheRaw) {
      return _configCacheVal;
    }
    _configCacheRaw = saved;
    if (saved) {
      const parsed = JSON.parse(saved);
      // Automatically migrate to new standalone URL if user has older or relative /api proxy URL in localStorage
      if (!parsed.gasUrl || parsed.gasUrl.startsWith('/api') || parsed.gasUrl.startsWith('/') || parsed.gasUrl.includes('AKfycbxe') || parsed.gasUrl.includes('AKfycbw')) {
        parsed.gasUrl = DEFAULT_CONFIG.gasUrl;
      }
      const merged: GASConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        gasUrl: parsed.gasUrl || DEFAULT_CONFIG.gasUrl,
        dhpSpreadsheetId: parsed.dhpSpreadsheetId || DEFAULT_CONFIG.dhpSpreadsheetId,
        dhpSheetName: parsed.dhpSheetName || DEFAULT_CONFIG.dhpSheetName,
      };
      _configCacheVal = merged;
      return merged;
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  _configCacheVal = DEFAULT_CONFIG;
  return DEFAULT_CONFIG;
}

export function saveConfig(cfg: GASConfig): void {
  try {
    const raw = JSON.stringify(cfg);
    localStorage.setItem(STORAGE_KEYS.CONFIG, raw);
    _configCacheRaw = raw;
    _configCacheVal = cfg;
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

const NUM_FMT_1DEC = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NUM_FMT_2DEC = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INT_FMT = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return NUM_FMT_1DEC.format(Number(n));
}

export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return NUM_FMT_2DEC.format(Number(n));
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return INT_FMT.format(Math.round(Number(n)));
}

export function getPctClass(v: number): string {
  if (v >= 10) return 'text-rose-600 font-bold';
  if (v <= 4) return 'text-emerald-600 font-bold';
  return 'text-slate-700';
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const STATIC_HOSTING_CACHE_KEY = 'krosok_static_hosting_mode_v1';
let staticHostingModeDetected = false;

export function isStaticHostingMode(): boolean {
  if (staticHostingModeDetected) return true;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STATIC_HOSTING_CACHE_KEY) === '1') {
      staticHostingModeDetected = true;
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function markStaticHostingMode(): void {
  staticHostingModeDetected = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STATIC_HOSTING_CACHE_KEY, '1');
    }
  } catch {
    // ignore storage errors
  }
}

function getWibDateParts(input?: Date | number | string): {
  year: number;
  monthIdx: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  iso: string;
} {
  let baseMs: number;
  if (input === undefined || input === null) {
    baseMs = Date.now();
  } else if (typeof input === 'number') {
    baseMs = input;
  } else if (input instanceof Date) {
    baseMs = input.getTime();
  } else {
    const parsed = Date.parse(String(input));
    baseMs = isNaN(parsed) ? Date.now() : parsed;
  }
  const shifted = new Date(baseMs + WIB_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const monthIdx = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const hours = shifted.getUTCHours();
  const minutes = shifted.getUTCMinutes();
  const seconds = shifted.getUTCSeconds();
  return {
    year,
    monthIdx,
    day,
    hours,
    minutes,
    seconds,
    iso: `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  };
}

/** Tanggal hari ini dalam zona waktu WIB permanen (UTC+7) format YYYY-MM-DD */
export function getTodayWibIso(): string {
  return getWibDateParts().iso;
}

/** Jam:Menit dalam WIB permanen (UTC+7), tanpa konstruksi Intl.DateTimeFormat berulang */
export function formatWibHHMM(input?: Date | number | string): string {
  if (input !== undefined && typeof input === 'string' && isNaN(Date.parse(input))) return '';
  const p = getWibDateParts(input);
  return `${String(p.hours).padStart(2, '0')}:${String(p.minutes).padStart(2, '0')}`;
}

/** Jam:Menit:Detik dalam WIB permanen (UTC+7) */
export function formatWibHHMMSS(input?: Date | number | string): string {
  const p = getWibDateParts(input);
  return `${String(p.hours).padStart(2, '0')}:${String(p.minutes).padStart(2, '0')}:${String(p.seconds).padStart(2, '0')}`;
}

/** Tanggal panjang Bahasa Indonesia dalam WIB permanen (UTC+7) tanpa membuat Intl.DateTimeFormat */
export function formatWibLongDate(input?: Date | number | string, padDay: boolean = false): string {
  const p = getWibDateParts(input);
  const dStr = padDay ? String(p.day).padStart(2, '0') : String(p.day);
  return `${dStr} ${MONTH_ORDER[p.monthIdx] || 'Oktober'} ${p.year}`;
}

function monthKey(tahun: string | number, bulan: string): number {
  return Number(tahun) * 12 + MONTH_ORDER.indexOf(bulan);
}

/** Parses Google Visualization query Date string e.g. "Date(2025,10,12)" or ISO/Date using permanent WIB (UTC+7) arithmetic */
function parseGvizDate(v: any): { iso: string; display: string; bulan: string; tahun: string } {
  if (typeof v === 'string' && v.startsWith('Date(')) {
    const parts = v.replace('Date(', '').replace(')', '').split(',').map(s => parseInt(s.trim(), 10));
    const year = parts[0];
    const month = parts[1]; // 0-indexed in JS/Gviz
    const day = parts[2];
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 0 && month <= 11) {
      const monthName = MONTH_ORDER[month] || 'Oktober';
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        iso,
        display: `${day} ${monthName} ${year}`,
        bulan: monthName,
        tahun: String(year)
      };
    }
  }

  if (v instanceof Date && !isNaN(v.getTime())) {
    const p = getWibDateParts(v);
    const monthName = MONTH_ORDER[p.monthIdx] || 'Oktober';
    return {
      iso: p.iso,
      display: `${p.day} ${monthName} ${p.year}`,
      bulan: monthName,
      tahun: String(p.year)
    };
  }

  const s = String(v || '').trim();
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const mIdx = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const monthName = MONTH_ORDER[mIdx] || 'Oktober';
    return {
      iso: `${year}-${isoMatch[2]}-${isoMatch[3]}`,
      display: `${day} ${monthName} ${year}`,
      bulan: monthName,
      tahun: year
    };
  }

  const idSlashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (idSlashMatch) {
    const day = parseInt(idSlashMatch[1], 10);
    const month = parseInt(idSlashMatch[2], 10);
    const year = idSlashMatch[3];
    const monthName = MONTH_ORDER[month - 1] || 'Oktober';
    return {
      iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      display: `${day} ${monthName} ${year}`,
      bulan: monthName,
      tahun: year
    };
  }

  const wibToday = getWibDateParts();
  return {
    iso: s,
    display: s,
    bulan: MONTH_ORDER[wibToday.monthIdx] || 'Oktober',
    tahun: String(wibToday.year)
  };
}

/** Lightweight RFC-4180 CSV parser for Google Sheets CSV fallback */
function parseCsvMatrix(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // skip CR, handle LF next
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseLocaleNum(val: string | undefined): number {
  if (!val) return NaN;
  const cleaned = val.trim().replace(/\s/g, '');
  if (!cleaned) return NaN;
  // Handle Indonesian/US decimals safely
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  if (/^-?\d+(,\d+)$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned.replace(/,/g, ''));
}

/** Fetch data via Google Visualization API query endpoint with automatic Google Sheets CSV fallback */
export async function fetchFromGviz(spreadsheetId: string, sheetName: string): Promise<KrosokRecord[]> {
  if (!spreadsheetId) return [];
  const encSheet = encodeURIComponent(sheetName);

  // 1. Primary attempt: Google Visualization JSON
  try {
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encSheet}`;
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (!isHtmlResponse(text, contentType) && !text.trim().startsWith('<')) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end > start) {
          const json = JSON.parse(text.substring(start, end + 1));
          const rows = json.table?.rows || [];
          const records: KrosokRecord[] = [];

          for (let i = 0; i < rows.length; i++) {
            const c = rows[i].c;
            if (!c) continue;

            const rawTgl = c[1]?.v;
            const rawBulan = c[2]?.v;
            const rawTahun = c[3]?.v;
            const rawPerlakuan = c[4]?.v;
            const rawKrosok = c[5]?.v;
            const rawProses = c[6]?.v;
            const rawBaku = c[7]?.v;
            const rawHasil = c[8]?.v;

            if (
              rawTgl &&
              typeof rawBaku === 'number' &&
              typeof rawHasil === 'number' &&
              rawBaku > 0
            ) {
              const parsedDate = parseGvizDate(rawTgl);
              const baku = rawBaku;
              const hasil = rawHasil;
              const susutKg = typeof c[9]?.v === 'number' ? c[9]?.v : (baku - hasil);
              const susutPct = typeof c[10]?.v === 'number' ? c[10]?.v : (susutKg / baku * 100);
              const gagangKg = typeof c[11]?.v === 'number' ? c[11]?.v : 0;
              const airKg = typeof c[12]?.v === 'number' ? c[12]?.v : 0;
              const debuKg = typeof c[13]?.v === 'number' ? c[13]?.v : 0;
              const debuAirKg = airKg + debuKg;

              records.push({
                srcRow: i + 1,
                tanggal: parsedDate.iso,
                tanggalDisplay: parsedDate.display,
                bulan: String(rawBulan || parsedDate.bulan).trim(),
                tahun: String(rawTahun || parsedDate.tahun).trim(),
                jenisPerlakuan: rawPerlakuan ? String(rawPerlakuan).trim() : undefined,
                jenisKrosok: rawKrosok ? String(rawKrosok).trim() : 'Lainnya',
                jenisProses: rawProses ? String(rawProses).trim() : 'SKT',
                baku: round2(baku),
                hasil: round2(hasil),
                susutKg: round2(susutKg),
                susutPct: round2(susutPct),
                gagangKg: round2(gagangKg),
                gagangPct: round2(baku ? (gagangKg / baku * 100) : 0),
                airKg: round2(airKg),
                debuKg: round2(debuKg),
                debuAirKg: round2(debuAirKg),
                debuAirPct: round2(baku ? (debuAirKg / baku * 100) : 0),
              });
            }
          }

          if (records.length > 0) return records;
        }
      }
    }
  } catch (err) {
    console.warn('fetchFromGviz JSON notice, trying CSV fallback:', err);
  }

  // 2. Fallback: Google Sheets CSV (`!rawText.trim().startsWith('<')`)
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encSheet}`;
    const csvResp = await fetch(csvUrl);
    if (!csvResp.ok) return [];
    const csvText = await csvResp.text();
    const csvContentType = csvResp.headers.get('content-type') || '';
    if (!csvText.trim() || csvText.trim().startsWith('<') || isHtmlResponse(csvText, csvContentType)) {
      return [];
    }

    const matrix = parseCsvMatrix(csvText);
    const records: KrosokRecord[] = [];
    for (let i = 0; i < matrix.length; i++) {
      const c = matrix[i];
      if (!c || c.length < 9) continue;
      const rawTgl = c[1]?.trim();
      const rawBulan = c[2]?.trim();
      const rawTahun = c[3]?.trim();
      const rawPerlakuan = c[4]?.trim();
      const rawKrosok = c[5]?.trim();
      const rawProses = c[6]?.trim();
      const baku = parseLocaleNum(c[7]);
      const hasil = parseLocaleNum(c[8]);

      if (!rawTgl || isNaN(baku) || isNaN(hasil) || baku <= 0 || rawKrosok?.toUpperCase() === 'JENIS KROSOK') {
        continue;
      }

      const parsedDate = parseGvizDate(rawTgl);
      const rawSusut = parseLocaleNum(c[9]);
      const susutKg = !isNaN(rawSusut) ? rawSusut : (baku - hasil);
      const rawSusutPct = parseLocaleNum(c[10]);
      const susutPct = !isNaN(rawSusutPct) ? rawSusutPct : (susutKg / baku * 100);
      const gagangKg = parseLocaleNum(c[11]) || 0;
      const airKg = parseLocaleNum(c[12]) || 0;
      const debuKg = parseLocaleNum(c[13]) || 0;
      const debuAirKg = airKg + debuKg;

      records.push({
        srcRow: i + 1,
        tanggal: parsedDate.iso,
        tanggalDisplay: parsedDate.display,
        bulan: rawBulan || parsedDate.bulan,
        tahun: rawTahun || parsedDate.tahun,
        jenisPerlakuan: rawPerlakuan || undefined,
        jenisKrosok: rawKrosok || 'Lainnya',
        jenisProses: rawProses || 'SKT',
        baku: round2(baku),
        hasil: round2(hasil),
        susutKg: round2(susutKg),
        susutPct: round2(susutPct),
        gagangKg: round2(gagangKg),
        gagangPct: round2(baku ? (gagangKg / baku * 100) : 0),
        airKg: round2(airKg),
        debuKg: round2(debuKg),
        debuAirKg: round2(debuAirKg),
        debuAirPct: round2(baku ? (debuAirKg / baku * 100) : 0),
      });
    }
    return records;
  } catch (err) {
    console.warn('fetchFromGviz CSV fallback notice (using offline/cached records):', err);
    return [];
  }
}

/** Normalize a raw record from GAS or Gviz into a clean KrosokRecord */
function normalizeKrosokRecord(
  raw: any,
  fallbackDetail?: Partial<KrosokRecord>
): KrosokRecord | null {
  const baku = round2(Number(raw.baku) || 0);
  const hasil = round2(Number(raw.hasil) || 0);
  const tanggal = String(raw.tanggal || '').trim();
  if (!tanggal || baku <= 0 || hasil <= 0) return null;

  let bulan = String(raw.bulan || '').trim();
  let tahun = String(raw.tahun || '').trim();
  let tanggalDisplay = String(raw.tanggalDisplay || '').trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
    const [yStr, mStr, dStr] = tanggal.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    const dNum = parseInt(dStr, 10);
    if (!bulan || !MONTH_ORDER.includes(bulan)) {
      bulan = MONTH_ORDER[mIdx] || 'Oktober';
    }
    if (!tahun || !/^\d{4}$/.test(tahun)) {
      tahun = yStr;
    }
    if (!tanggalDisplay) {
      tanggalDisplay = `${dNum} ${bulan} ${tahun}`;
    }
  }

  const jenisKrosok = String(
    raw.jenisKrosok || fallbackDetail?.jenisKrosok || ''
  ).trim();
  if (!jenisKrosok) return null;

  const rawProses = String(raw.jenisProses || '').trim();
  const jenisProses =
    rawProses && rawProses !== 'Lainnya'
      ? rawProses
      : fallbackDetail?.jenisProses || 'SKT';

  const susutKg = round2(baku - hasil);
  const susutPct = round2((susutKg / baku) * 100);
  const gagangKg = round2(
    Number(fallbackDetail?.gagangKg ?? raw.gagangKg ?? 0) || 0
  );
  const airKg = round2(Number(fallbackDetail?.airKg ?? raw.airKg ?? 0) || 0);
  const rawDebu = Number(
    fallbackDetail?.debuKg ??
      raw.debuKg ??
      Math.max(0, (Number(raw.debuAirKg) || 0) - airKg)
  );
  const debuKg = round2(Math.max(0, rawDebu || 0));
  const debuAirKg = round2(
    Math.max(0, airKg + debuKg, Number(raw.debuAirKg) || 0)
  );

  return {
    srcRow: Number(raw.srcRow) || fallbackDetail?.srcRow || 0,
    tanggal,
    tanggalDisplay: tanggalDisplay || tanggal,
    bulan,
    tahun,
    jenisPerlakuan:
      fallbackDetail?.jenisPerlakuan ||
      (raw.jenisPerlakuan ? String(raw.jenisPerlakuan).trim() : `${jenisKrosok} ${jenisProses}`),
    jenisKrosok,
    jenisProses,
    baku,
    hasil,
    susutKg,
    susutPct,
    gagangKg,
    gagangPct: round2((gagangKg / baku) * 100),
    airKg,
    debuKg,
    debuAirKg,
    debuAirPct: round2((debuAirKg / baku) * 100)
  };
}

export interface KrosokPhysicsValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Layer 2 — Sanity Check & Physics Boundary untuk Neraca Massa Krosok:
 * Menolak fraksi limbah negatif (Gagang/Air/Debu < 0) dan salah ketik timbangan ekstrem
 * (Susut > 35% atau Hasil > 115% Baku), sambil tetap mengizinkan serap uap alami (misal -0,06%).
 */
export function validateKrosokPhysics(params: {
  baku: number;
  hasil: number;
  gagangKg?: number;
  airKg?: number;
  debuKg?: number;
}): KrosokPhysicsValidation {
  const { baku, hasil, gagangKg = 0, airKg = 0, debuKg = 0 } = params;
  if (debuKg < 0) {
    return {
      valid: false,
      reason: `Fraksi Debu bernilai negatif (${debuKg.toFixed(1)} Kg) — melanggar hukum kekekalan massa`
    };
  }
  if (gagangKg < 0) {
    return {
      valid: false,
      reason: `Fraksi Gagang bernilai negatif (${gagangKg.toFixed(1)} Kg) — melanggar hukum kekekalan massa`
    };
  }
  if (airKg < 0) {
    return {
      valid: false,
      reason: `Fraksi Air bernilai negatif (${airKg.toFixed(1)} Kg) — melanggar hukum kekekalan massa`
    };
  }
  if (hasil > 0 && baku > 0) {
    const susutPct = ((baku - hasil) / baku) * 100;
    if (susutPct > 35) {
      return {
        valid: false,
        reason: `Susut ekstrem ${susutPct.toFixed(2)}% (> 35%) — indikasi salah input timbangan Hasil (${hasil.toFixed(1)} Kg dari Baku ${baku.toFixed(1)} Kg)`
      };
    }
    if (susutPct < -15) {
      return {
        valid: false,
        reason: `Netto Hasil (${hasil.toFixed(1)} Kg) melampaui batas serap uap fisik (> 115% dari Baku ${baku.toFixed(1)} Kg)`
      };
    }
  }
  return { valid: true };
}

export function isHtmlResponse(rawText: string, contentType?: string | null): boolean {
  if (contentType && (contentType.includes('text/html') || contentType.includes('application/xhtml+xml'))) {
    return true;
  }
  const trimmed = rawText.trim();
  if (!trimmed) return false;
  const sample = trimmed.slice(0, 150).toLowerCase();
  return (
    sample.startsWith('<!doctype') ||
    sample.startsWith('<html') ||
    sample.startsWith('<head') ||
    sample.startsWith('<body') ||
    trimmed.startsWith('<')
  );
}

/**
 * Layer 4 — Resilient Stream & JSON Parser:
 * Membaca payload via response.text() terlebih dahulu agar stream terpotong / timeout GAS
 * tidak pernah memicu unhandled exception "Unexpected end of JSON input".
 * Juga mendeteksi dokumen HTML (misal dari Cloudflare SPA routing pada rute /api proxy).
 */
export async function safeParseJsonResponse<T = any>(
  response: Response
): Promise<{ ok: boolean; data: T | null; rawText: string; isHtml?: boolean; parseError?: string }> {
  let rawText = '';
  const contentType = response.headers.get('content-type') || '';
  try {
    rawText = await response.text();
  } catch (readErr: any) {
    return {
      ok: false,
      data: null,
      rawText: '',
      isHtml: false,
      parseError: readErr?.message || 'Gagal membaca aliran respons HTTP'
    };
  }
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      ok: false,
      data: null,
      rawText,
      isHtml: false,
      parseError: 'Respons server kosong (aliran koneksi terputus / batas waktu eksekusi)'
    };
  }

  // Deteksi dokumen HTML (rute internal /api tidak ada di Cloudflare static hosting)
  if (isHtmlResponse(trimmed, contentType)) {
    return {
      ok: false,
      data: null,
      rawText,
      isHtml: true,
      parseError: 'Respons adalah dokumen HTML (bukan JSON)'
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as T;
    return { ok: response.ok, data: parsed, rawText, isHtml: false };
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const extracted = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
        return { ok: response.ok, data: extracted, rawText, isHtml: false };
      } catch {
        // fallthrough to structured error
      }
    }
    return {
      ok: false,
      data: null,
      rawText,
      isHtml: false,
      parseError: 'Format respons server terpotong atau bukan JSON valid'
    };
  }
}

/**
 * Fetch data from GAS endpoint with automatic fallback to direct GAS URL with CORS
 * jika rute internal /api proxy mengembalikan HTML atau gagal.
 */
export async function fetchFromGAS(
  gasUrl: string,
  referenceRecords: KrosokRecord[] = []
): Promise<KrosokRecord[]> {
  const primaryUrl = gasUrl && gasUrl.trim() ? gasUrl.trim() : DEFAULT_CONFIG.gasUrl;

  const attemptFetch = async (targetUrl: string): Promise<KrosokRecord[] | null> => {
    try {
      const urlWithAction = targetUrl.includes('?')
        ? `${targetUrl}&action=readAll`
        : `${targetUrl}?action=readAll`;
      const response = await fetch(urlWithAction, { redirect: 'follow' });
      const contentType = response.headers.get('content-type') || '';
      const parsed = await safeParseJsonResponse<any>(response);

      // Jika respons berupa HTML (misal Cloudflare SPA fallback menyajikan index.html untuk rute /api)
      if (parsed.isHtml || isHtmlResponse(parsed.rawText, contentType)) {
        console.warn(
          `[Cloudflare Migration] Rute ${targetUrl} mengembalikan HTML. Perlu direct fallback ke endpoint Google Apps Script.`
        );
        return null;
      }

      if (!response.ok || !parsed.data) {
        if (parsed.parseError) {
          console.warn('GAS JSON parse guard notice:', parsed.parseError);
        }
        return null;
      }
      const data = parsed.data;
      const rawList: any[] = Array.isArray(data)
        ? data
        : data && Array.isArray(data.records)
        ? data.records
        : [];
      if (rawList.length === 0) return [];

      // Isolate the authoritative primary sheet block if GAS iterated across multiple tabs
      const blocks: any[][] = [];
      let currentBlock: any[] = [];
      for (let i = 0; i < rawList.length; i++) {
        if (
          i > 0 &&
          Number(rawList[i].srcRow) <= Number(rawList[i - 1].srcRow)
        ) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
        currentBlock.push(rawList[i]);
      }
      if (currentBlock.length > 0) blocks.push(currentBlock);

      // Choose the largest contiguous sheet block (REKAP SUSUT KROSOK)
      const mainBlock = blocks.reduce(
        (best, cand) => (cand.length >= best.length ? cand : best),
        blocks[0]
      );

      const refMap = new Map<string, KrosokRecord>();
      referenceRecords.forEach((r) => {
        refMap.set(`${r.tanggal}|${r.baku.toFixed(1)}|${r.jenisKrosok}`, r);
        refMap.set(`${r.tanggal}|${r.baku.toFixed(1)}`, r);
      });

      const normalized: KrosokRecord[] = [];
      for (const row of mainBlock) {
        const bKey1 = `${row.tanggal}|${Number(row.baku || 0).toFixed(1)}|${String(row.jenisKrosok || '').trim()}`;
        const bKey2 = `${row.tanggal}|${Number(row.baku || 0).toFixed(1)}`;
        const fallback = refMap.get(bKey1) || refMap.get(bKey2);
        const clean = normalizeKrosokRecord(row, fallback);
        if (clean) normalized.push(clean);
      }

      return normalized;
    } catch (err) {
      console.warn(`Fetch notice for ${targetUrl}:`, err);
      return null;
    }
  };

  const shouldBypassRelativeProxy =
    primaryUrl.startsWith('/') || (isStaticHostingMode() && primaryUrl !== DEFAULT_CONFIG.gasUrl);

  // 1. Jika bukan proxy /api yang sudah terdeteksi mode static hosting, coba URL utama terlebih dahulu
  let result: KrosokRecord[] | null = null;
  if (!shouldBypassRelativeProxy) {
    result = await attemptFetch(primaryUrl);
    if (result === null && primaryUrl !== DEFAULT_CONFIG.gasUrl) {
      markStaticHostingMode();
    }
  } else if (primaryUrl.startsWith('/')) {
    markStaticHostingMode();
  }

  // 2. Jika gagal, mengembalikan HTML, atau mode static hosting aktif, fallback langsung ke endpoint GAS dengan CORS
  if (result === null) {
    if (primaryUrl !== DEFAULT_CONFIG.gasUrl) {
      console.warn(
        `[Cloudflare Fallback] Beralih otomatis ke direct fetch endpoint Google Apps Script: ${DEFAULT_CONFIG.gasUrl}`
      );
      result = await attemptFetch(DEFAULT_CONFIG.gasUrl);
    }
  }

  return result || [];
}

/**
 * Pengiriman POST aman ke GAS dengan fallback otomatis jika rute internal /api proxy
 * mengembalikan HTML atau gagal saat dihosting di Cloudflare (plus cache flag mode static hosting).
 */
export async function postToGASWithFallback(
  gasUrl: string,
  payload: any
): Promise<{ ok: boolean; data?: any; error?: string; isFallback?: boolean }> {
  const primaryUrl = gasUrl && gasUrl.trim() ? gasUrl.trim() : DEFAULT_CONFIG.gasUrl;

  const attemptPost = async (url: string) => {
    try {
      const postRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
      const parsedRes = await safeParseJsonResponse<any>(postRes);
      if (parsedRes.isHtml) {
        markStaticHostingMode();
        return { isHtml: true, ok: false, error: 'Respons HTML dari proxy' };
      }
      return {
        isHtml: false,
        ok: postRes.ok && parsedRes.ok,
        data: parsedRes.data,
        parseError: parsedRes.parseError
      };
    } catch (err: any) {
      return { isHtml: false, ok: false, error: err?.message || 'Network error' };
    }
  };

  const shouldBypassProxy =
    primaryUrl.startsWith('/') || (isStaticHostingMode() && primaryUrl !== DEFAULT_CONFIG.gasUrl);

  let res: { isHtml: boolean; ok: boolean; data?: any; error?: string; parseError?: string };
  let isFallback = false;

  if (shouldBypassProxy) {
    markStaticHostingMode();
    res = await attemptPost(DEFAULT_CONFIG.gasUrl);
    isFallback = primaryUrl !== DEFAULT_CONFIG.gasUrl;
  } else {
    res = await attemptPost(primaryUrl);
    // Jika proxy /api mengembalikan HTML atau gagal, lakukan direct fetch ke endpoint GAS resmi
    if ((res.isHtml || !res.ok) && primaryUrl !== DEFAULT_CONFIG.gasUrl) {
      markStaticHostingMode();
      console.warn(
        `[Cloudflare Fallback] POST ke ${primaryUrl} mengembalikan HTML / gagal. Melakukan direct fallback ke ${DEFAULT_CONFIG.gasUrl}`
      );
      res = await attemptPost(DEFAULT_CONFIG.gasUrl);
      isFallback = true;
    }
  }

  if (res.data) {
    return { ok: res.ok, data: res.data, isFallback };
  }
  return { ok: false, error: res.error || res.parseError || 'Gagal mengirim data ke GAS', isFallback };
}

/**
 * Fetches full unfiltered REKAP SUSUT KROSOK data by combining GAS (unfiltered full history)
 * with Gviz (exact visible detail columns), preventing active Google Sheet filters from
 * truncating historical months (such as Agustus 2026).
 */
export async function fetchUnifiedRekapRecords(
  config: GASConfig,
  existingRecords: KrosokRecord[] = []
): Promise<KrosokRecord[]> {
  const baselineRef =
    existingRecords.length >= INITIAL_SEED_RECORDS.length
      ? existingRecords
      : INITIAL_SEED_RECORDS;

  const [gvizRows, gasRows] = await Promise.all([
    fetchFromGviz(config.spreadsheetId, config.sheetName),
    fetchFromGAS(config.gasUrl, baselineRef)
  ]);

  // Build detail lookup from Gviz (carries exact airKg, debuKg, gagangKg, jenisPerlakuan on visible rows)
  const gvizMap = new Map<string, KrosokRecord>();
  gvizRows.forEach((r) => {
    gvizMap.set(`${r.tanggal}|${r.baku.toFixed(1)}|${r.jenisKrosok.toLowerCase()}`, r);
  });

  if (gasRows.length > 0 && gasRows.length >= gvizRows.length) {
    return gasRows.map((r) => {
      const gMatch = gvizMap.get(
        `${r.tanggal}|${r.baku.toFixed(1)}|${r.jenisKrosok.toLowerCase()}`
      );
      if (!gMatch) return r;
      return {
        ...r,
        hasil: gMatch.hasil,
        susutKg: gMatch.susutKg,
        susutPct: gMatch.susutPct,
        jenisPerlakuan: gMatch.jenisPerlakuan || r.jenisPerlakuan,
        gagangKg: gMatch.gagangKg,
        gagangPct: gMatch.gagangPct,
        airKg: gMatch.airKg,
        debuKg: gMatch.debuKg,
        debuAirKg: gMatch.debuAirKg,
        debuAirPct: gMatch.debuAirPct
      };
    });
  }

  // If GAS was unreachable and Gviz returned only a filtered subset (e.g. Sept-Oct filter active),
  // merge Gviz updates into baselineRef instead of wiping out unfiltered historical months!
  if (gvizRows.length > 0 && gvizRows.length < baselineRef.length * 0.6) {
    const mergedMap = new Map<string, KrosokRecord>();
    baselineRef.forEach((r) => {
      mergedMap.set(`${r.tanggal}|${r.baku.toFixed(1)}|${r.jenisKrosok.toLowerCase()}`, r);
    });
    gvizRows.forEach((r) => {
      mergedMap.set(`${r.tanggal}|${r.baku.toFixed(1)}|${r.jenisKrosok.toLowerCase()}`, r);
    });
    return Array.from(mergedMap.values()).sort((a, b) =>
      a.tanggal !== b.tanggal ? a.tanggal.localeCompare(b.tanggal) : a.srcRow - b.srcRow
    );
  }

  return gvizRows;
}

let _lastMergeRekapRef: KrosokRecord[] | null = null;
let _lastMergeDhpRef: DhpKrosokItem[] | null = null;
let _lastMergeResult: KrosokRecord[] | null = null;

/**
 * Combines Rekap Proses Krosok with completed live DHP Krosok batches (hasil > 0)
 * as a unified Single Source of Truth (excluding unfinished hasil == 0 batches).
 */
export function mergeRekapWithCompletedDhp(
  rekapRecords: KrosokRecord[],
  dhpItems: DhpKrosokItem[]
): KrosokRecord[] {
  if (!dhpItems || dhpItems.length === 0) return rekapRecords;
  if (
    _lastMergeResult &&
    _lastMergeRekapRef === rekapRecords &&
    _lastMergeDhpRef === dhpItems
  ) {
    return _lastMergeResult;
  }

  const updateByRow = new Map<number, DhpKrosokItem>();
  const updateByKey = new Map<string, DhpKrosokItem>();
  for (let i = 0; i < dhpItems.length; i++) {
    const d = dhpItems[i];
    if (
      d.hasil > 0 &&
      !d.isRestoredFromRekap &&
      !d.isPhysicsAnomaly &&
      d.needsUpdateInRekap &&
      validateKrosokPhysics({
        baku: d.baku,
        hasil: d.hasil,
        gagangKg: d.gagangKg,
        airKg: d.airKg,
        debuKg: d.debuKg
      }).valid
    ) {
      if (d.matchedRow) updateByRow.set(d.matchedRow, d);
      updateByKey.set(
        `${d.tanggal}|${d.jenisTembakau.toLowerCase()}|${d.baku.toFixed(1)}`,
        d
      );
    }
  }

  const updatedRekap =
    updateByRow.size === 0 && updateByKey.size === 0
      ? rekapRecords
      : rekapRecords.map((r) => {
          const dhpUpdate =
            (r.srcRow ? updateByRow.get(r.srcRow) : undefined) ||
            updateByKey.get(
              `${r.tanggal}|${r.jenisKrosok.toLowerCase()}|${r.baku.toFixed(1)}`
            );
          // Layer 1 Non-Destructive Guard: never overwrite existing Hasil > 0 with <= 0 or invalid physics
          if (!dhpUpdate || dhpUpdate.hasil <= 0) return r;
          const susutKg = round2(dhpUpdate.baku - dhpUpdate.hasil);
          const debuAirKg = round2((dhpUpdate.airKg || 0) + (dhpUpdate.debuKg || 0));
          return {
            ...r,
            hasil: dhpUpdate.hasil,
            susutKg,
            susutPct: round2((susutKg / dhpUpdate.baku) * 100),
            gagangKg: dhpUpdate.gagangKg || 0,
            gagangPct: round2(((dhpUpdate.gagangKg || 0) / dhpUpdate.baku) * 100),
            airKg: dhpUpdate.airKg || 0,
            debuKg: dhpUpdate.debuKg || 0,
            debuAirKg,
            debuAirPct: round2((debuAirKg / dhpUpdate.baku) * 100)
          };
        });

  const existingKeys = new Set(
    updatedRekap.map(
      (r) => `${r.tanggal}|${r.jenisKrosok.toLowerCase()}|${r.baku.toFixed(1)}`
    )
  );

  const newCompletedFromDhp: KrosokRecord[] = [];
  dhpItems.forEach((d, idx) => {
    if (
      !d.hasil ||
      d.hasil <= 0 ||
      d.isMatchedInRekap ||
      d.isRestoredFromRekap ||
      d.isPhysicsAnomaly
    ) {
      return;
    }
    if (
      !validateKrosokPhysics({
        baku: d.baku,
        hasil: d.hasil,
        gagangKg: d.gagangKg,
        airKg: d.airKg,
        debuKg: d.debuKg
      }).valid
    ) {
      return;
    }
    const k = `${d.tanggal}|${d.jenisTembakau.toLowerCase()}|${d.baku.toFixed(1)}`;
    if (existingKeys.has(k)) return;
    existingKeys.add(k);

    const susutKg = round2(d.baku - d.hasil);
    const debuAirKg = round2((d.airKg || 0) + (d.debuKg || 0));
    newCompletedFromDhp.push({
      srcRow: 10000 + idx,
      tanggal: d.tanggal,
      tanggalDisplay: d.tanggalDisplay,
      bulan: d.bulan,
      tahun: d.tahun,
      jenisPerlakuan: `${d.jenisTembakau} ${d.jalurProses}`,
      jenisKrosok: d.jenisTembakau,
      jenisProses: d.jalurProses,
      baku: d.baku,
      hasil: d.hasil,
      susutKg,
      susutPct: round2((susutKg / d.baku) * 100),
      gagangKg: d.gagangKg || 0,
      gagangPct: round2(((d.gagangKg || 0) / d.baku) * 100),
      airKg: d.airKg || 0,
      debuKg: d.debuKg || 0,
      debuAirKg,
      debuAirPct: round2((debuAirKg / d.baku) * 100)
    });
  });

  const mergedResult =
    newCompletedFromDhp.length > 0
      ? [...updatedRekap, ...newCompletedFromDhp]
      : updatedRekap;

  _lastMergeRekapRef = rekapRecords;
  _lastMergeDhpRef = dhpItems;
  _lastMergeResult = mergedResult;
  return mergedResult;
}

/** Fetch and parse DHP Krosok items from Sheet DHP Krosok (Tab: INTEGRASI DATA) */
export async function fetchDhpKrosokRecords(
  dhpSpreadsheetId: string,
  dhpSheetName: string,
  rekapRecords: KrosokRecord[] = []
): Promise<DhpKrosokItem[]> {
  if (!dhpSpreadsheetId) return getCachedDhpItems();
  try {
    const encSheet = encodeURIComponent(dhpSheetName);
    const url = `https://docs.google.com/spreadsheets/d/${dhpSpreadsheetId}/gviz/tq?tqx=out:json&sheet=${encSheet}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`DHP Sheet request notice (Status: ${response.status})`);
      return getCachedDhpItems();
    }

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (isHtmlResponse(text, contentType) || text.trim().startsWith('<')) {
      return getCachedDhpItems();
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return getCachedDhpItems();
    }

    const json = JSON.parse(text.substring(start, end + 1));
    const rows = json.table?.rows || [];
    const items: DhpKrosokItem[] = [];

    // Extract active operational sheet date from top header rows (e.g. Row 0 Col C: "Senin, 26 Oktober 2026")
    let detectedSheetDateLabel = '';
    let detectedSheetIsoDate = '';
    for (let i = 0; i < Math.min(rows.length, 4); i++) {
      const cellDate = rows[i]?.c?.[2];
      if (!cellDate) continue;
      const rawVal = cellDate.v;
      const formattedVal = typeof cellDate.f === 'string' ? cellDate.f.trim() : '';
      if (typeof rawVal === 'string' && rawVal.startsWith('Date(')) {
        const parsedHeaderDate = parseGvizDate(rawVal);
        detectedSheetDateLabel = formattedVal || parsedHeaderDate.display;
        detectedSheetIsoDate = parsedHeaderDate.iso;
        break;
      }
    }

    // First pass: Build independent master Stock Code lookup from Columns Q & R (indices 16 & 17)
    // Note: Columns Q & R in INTEGRASI DATA are an alphabetical master lookup table, NOT aligned by row index!
    const stockCodeByVariant = new Map<string, { kodeStock?: string; masterName: string }>();
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i].c;
      if (!c) continue;
      const mName = c[17]?.v ? String(c[17].v).trim() : '';
      const mStock = c[16]?.v ? String(c[16].v).trim() : undefined;
      if (mName && mName.toUpperCase() !== 'JENIS KROSOK') {
        stockCodeByVariant.set(mName.toLowerCase(), {
          kodeStock: mStock,
          masterName: mName
        });
      }
    }

    // Second pass: Parse real DHP transaction rows (Columns C..M)
    const consumedRekapRows = new Set<number>();

    for (let i = 0; i < rows.length; i++) {
      const c = rows[i].c;
      if (!c || c.length < 5) continue;

      const rawTgl = c[2]?.v;
      const rawTembakau = c[3]?.v;
      const rawBaku = c[4]?.v;
      const rawWaktu = c[12]?.v ? String(c[12]?.v).trim() : '';

      // Filter: valid batch must have tobacco name (not header) and baku > 0
      if (
        rawTembakau &&
        String(rawTembakau).trim().toUpperCase() !== 'JENIS TEMBAKAU' &&
        typeof rawBaku === 'number' &&
        rawBaku > 0
      ) {
        const parsedDate = parseGvizDate(rawTgl);
        const baku = round2(rawBaku);
        let gagangKg = typeof c[5]?.v === 'number' ? round2(c[5]?.v) : 0;
        let airKg = typeof c[6]?.v === 'number' ? round2(c[6]?.v) : 0;
        let debuKg = typeof c[7]?.v === 'number' ? round2(c[7]?.v) : 0;

        // Kolom I (Index 8) adalah HASIL PROSES riil di DHP (bernilai boolean `false` jika belum selesai ditimbang / berganti hari =TODAY())
        const cellHasil = c[8]?.v;
        const rawHasil =
          typeof cellHasil === 'number'
            ? cellHasil
            : typeof cellHasil === 'string'
            ? parseFloat(cellHasil.replace(',', '.'))
            : NaN;
        const rawSusutKg =
          typeof c[9]?.v === 'number'
            ? c[9]?.v
            : typeof c[9]?.v === 'string'
            ? parseFloat(c[9]?.v.replace(',', '.'))
            : NaN;

        let susutKg = 0;
        let hasil = 0;

        if (!isNaN(rawHasil) && rawHasil > 0) {
          // Batch sudah ditimbang hasil prosesnya secara riil di DHP
          hasil = round2(rawHasil);
          susutKg = round2(baku - hasil);
        } else if (
          cellHasil !== false &&
          !isNaN(rawSusutKg) &&
          Math.abs(rawSusutKg - baku) > 0.05 &&
          Math.abs(rawSusutKg) < baku * 0.5
        ) {
          // Jika susut riil parsial terisi valid (bukan 100% akibat rumus E - FALSE)
          susutKg = round2(rawSusutKg);
          hasil = round2(baku - susutKg);
        } else {
          // Batch masih dalam proses pengolahan (Hasil = FALSE / 0): jangan anggap susut 100%!
          hasil = 0;
          susutKg = 0;
        }

        const tembakauStr = String(rawTembakau).trim();
        const jalurProses: 'SKT' | 'SKM' = tembakauStr.toUpperCase().includes('SKM')
          ? 'SKM'
          : 'SKT';

        // Match stock code from independent master table by exact tobacco name
        const cleanVariantLookup = tembakauStr
          .replace(/\b(skt|skm)\b/gi, '')
          .trim()
          .toLowerCase();
        const masterInfo =
          stockCodeByVariant.get(tembakauStr.toLowerCase()) ||
          stockCodeByVariant.get(cleanVariantLookup);

        // 1-to-1 Match against permanent Buku Besar Rekap (consumes matched srcRow)
        const match = rekapRecords.find((r) => {
          if (r.srcRow && consumedRekapRows.has(r.srcRow)) return false;
          const dateMatch = r.tanggal === parsedDate.iso;
          const tembakauMatch =
            r.jenisKrosok.toLowerCase() === tembakauStr.toLowerCase() ||
            (r.jenisPerlakuan &&
              r.jenisPerlakuan.toLowerCase().includes(tembakauStr.toLowerCase())) ||
            tembakauStr.toLowerCase().includes(r.jenisKrosok.toLowerCase());
          const bakuMatch = Math.abs(r.baku - baku) < 0.2;
          return dateMatch && tembakauMatch && bakuMatch;
        });

        if (match?.srcRow) {
          consumedRekapRows.add(match.srcRow);
        }

        // Layer 2 — Sanity Check & Physics Boundary on raw DHP values BEFORE fallback
        const rawPhysicsCheck = validateKrosokPhysics({
          baku,
          hasil,
          gagangKg,
          airKg,
          debuKg
        });

        let isRestoredFromRekap = false;

        // Safeguard 3 — Midnight Rollover (00:00 WIB) Visual Fallback:
        // Saat rumus =TODAY() di Sheet DHP berganti hari sehingga Kolom I menjadi FALSE (hasil === 0),
        // padahal batch tersebut SUDAH terverifikasi final (match.hasil > 0) di Buku Besar Rekap,
        // pulihkan tampilan bobot terverifikasi dari Rekap agar tidak tampak "0,0 (Proses)" palsu!
        if (hasil <= 0 && match && match.hasil > 0 && rawPhysicsCheck.valid) {
          hasil = round2(match.hasil);
          susutKg = round2(baku - hasil);
          if (gagangKg === 0 && match.gagangKg > 0) gagangKg = match.gagangKg;
          if (airKg === 0 && match.airKg > 0) airKg = match.airKg;
          if (debuKg === 0 && match.debuKg > 0) debuKg = match.debuKg;
          isRestoredFromRekap = true;
        }

        const susutPct = hasil > 0 && baku > 0 ? round2((susutKg / baku) * 100) : 0;

        // Re-verify final physics state; quarantine any anomalous DHP input from updating Rekap
        const finalPhysicsCheck = rawPhysicsCheck.valid
          ? validateKrosokPhysics({ baku, hasil, gagangKg, airKg, debuKg })
          : rawPhysicsCheck;
        const isPhysicsAnomaly = !finalPhysicsCheck.valid;

        const isMatched = Boolean(match);
        // Layer 1 & Layer 2 Guard: Never flag needsUpdate if restored from Rekap, hasil <= 0, or physics anomaly!
        const needsUpdate = Boolean(
          match &&
            !isRestoredFromRekap &&
            !isPhysicsAnomaly &&
            hasil > 0 &&
            Math.abs(match.hasil - hasil) >= 0.5
        );

        items.push({
          id: `dhp_${i + 1}_${parsedDate.iso}_${baku}`,
          rowIdx: i + 1,
          tanggal: parsedDate.iso,
          tanggalDisplay: parsedDate.display,
          bulan: parsedDate.bulan,
          tahun: parsedDate.tahun,
          jenisTembakau: tembakauStr,
          jenisKrosokMaster: masterInfo?.masterName,
          kodeStock: masterInfo?.kodeStock,
          waktu: rawWaktu,
          baku,
          hasil,
          gagangKg,
          airKg,
          debuKg,
          susutKg,
          susutPct,
          jalurProses,
          isMatchedInRekap: isMatched,
          matchedRow: match?.srcRow,
          needsUpdateInRekap: needsUpdate,
          rekapHasil: match?.hasil,
          isRestoredFromRekap,
          isPhysicsAnomaly,
          physicsAnomalyReason: finalPhysicsCheck.reason
        });
      }
    }

    if (!detectedSheetDateLabel && items.length > 0) {
      detectedSheetDateLabel = items[0].tanggalDisplay;
    }
    if (!detectedSheetIsoDate && items.length > 0) {
      detectedSheetIsoDate = items[0].tanggal;
    }
    if (detectedSheetDateLabel) {
      setDhpActiveSheetDateLabel(detectedSheetDateLabel);
    }
    if (detectedSheetIsoDate) {
      setDhpActiveSheetIsoDate(detectedSheetIsoDate);
    }

    // Always store and return the exact live state of Sheet DHP Krosok (even if 0 active batches)
    setCachedDhpItems(items);
    return items;
  } catch (err) {
    console.warn('fetchDhpKrosokRecords network notice (using cached):', err);
    return getCachedDhpItems();
  }
}

let _dhpActiveLabelCache: string | null = null;
let _dhpActiveIsoCache: string | null = null;

export function getDhpActiveSheetDateLabel(): string {
  if (_dhpActiveLabelCache !== null) return _dhpActiveLabelCache;
  try {
    _dhpActiveLabelCache = localStorage.getItem(STORAGE_KEYS.DHP_ACTIVE_DATE) || '';
    return _dhpActiveLabelCache;
  } catch {
    return '';
  }
}

function setDhpActiveSheetDateLabel(label: string): void {
  _dhpActiveLabelCache = label;
  try {
    localStorage.setItem(STORAGE_KEYS.DHP_ACTIVE_DATE, label);
  } catch {
    // ignore storage quota errors
  }
}

export function getDhpActiveSheetIsoDate(): string {
  if (_dhpActiveIsoCache !== null) return _dhpActiveIsoCache;
  try {
    _dhpActiveIsoCache = localStorage.getItem(STORAGE_KEYS.DHP_ACTIVE_ISO_DATE) || '';
    return _dhpActiveIsoCache;
  } catch {
    return '';
  }
}

function setDhpActiveSheetIsoDate(isoDate: string): void {
  _dhpActiveIsoCache = isoDate;
  try {
    localStorage.setItem(STORAGE_KEYS.DHP_ACTIVE_ISO_DATE, isoDate);
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Isolated Raw Active-Date Realization Audit Scanner:
 * Reads raw rows on the active operational date directly from REKAP SUSUT KROSOK
 * (including Hasil === 0 cancelled plans & Baku === 0 empty templates) WITHOUT
 * contaminating main Dashboard KPI records.
 */
export async function fetchRekapActiveDateAudit(
  config: GASConfig,
  dhpItems: DhpKrosokItem[]
): Promise<ActiveDateRealizationAudit | null> {
  const activeIsoDate =
    (dhpItems.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dhpItems[0].tanggal)
      ? dhpItems[0].tanggal
      : '') || getDhpActiveSheetIsoDate();

  if (!activeIsoDate || !/^\d{4}-\d{2}-\d{2}$/.test(activeIsoDate) || !config.spreadsheetId) {
    return null;
  }

  const activeDateDisplay =
    (dhpItems.length > 0 ? dhpItems[0].tanggalDisplay : '') ||
    getDhpActiveSheetDateLabel() ||
    formatTanggalIndo(activeIsoDate);

  try {
    const encSheet = encodeURIComponent(config.sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encSheet}`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;

    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (isHtmlResponse(text, contentType) || text.trim().startsWith('<')) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const json = JSON.parse(text.substring(start, end + 1));
    const rows = json.table?.rows || [];

    const rekapOnActiveDate: RekapRawDateRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const c = rows[i]?.c;
      if (!c) continue;
      const rawTgl = c[1]?.v;
      if (!rawTgl) continue;

      const parsedDate = parseGvizDate(rawTgl);
      if (parsedDate.iso !== activeIsoDate) continue;

      const rawKrosok = c[5]?.v ? String(c[5].v).trim() : '';
      if (rawKrosok.toUpperCase() === 'JENIS TEMBAKAU') continue;

      const rawProses = c[6]?.v ? String(c[6].v).trim() : 'SKT';
      const cellBaku = c[7]?.v;
      const cellHasil = c[8]?.v;

      const baku =
        typeof cellBaku === 'number'
          ? round2(cellBaku)
          : typeof cellBaku === 'string'
          ? round2(parseFloat(cellBaku.replace(',', '.')) || 0)
          : 0;

      const hasil =
        typeof cellHasil === 'number'
          ? round2(cellHasil)
          : typeof cellHasil === 'string'
          ? round2(parseFloat(cellHasil.replace(',', '.')) || 0)
          : 0;

      rekapOnActiveDate.push({
        srcRow: i + 1,
        tanggal: parsedDate.iso,
        tanggalDisplay: parsedDate.display,
        jenisKrosok: rawKrosok,
        jenisProses: rawProses || 'SKT',
        baku: Math.max(0, baku),
        hasil: Math.max(0, hasil)
      });
    }

    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/\b(skt|skm)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    const activeDhpOnDate = dhpItems.filter((d) => d.tanggal === activeIsoDate);
    const availableDhpPool = [...activeDhpOnDate];
    const matchedFlags = new Array<boolean>(rekapOnActiveDate.length).fill(false);

    // Pass 1: Exact Variant + Baku Match (1-to-1)
    for (let rIdx = 0; rIdx < rekapOnActiveDate.length; rIdx++) {
      const rRow = rekapOnActiveDate[rIdx];
      if (!rRow.jenisKrosok || rRow.baku <= 0) continue;
      const rNorm = norm(rRow.jenisKrosok);
      const poolIdx = availableDhpPool.findIndex((d) => {
        const dNorm = norm(d.jenisTembakau);
        const nameMatch =
          dNorm === rNorm ||
          (rNorm.length > 2 && (dNorm.includes(rNorm) || rNorm.includes(dNorm)));
        return nameMatch && Math.abs(d.baku - rRow.baku) < 0.5;
      });
      if (poolIdx !== -1) {
        matchedFlags[rIdx] = true;
        availableDhpPool.splice(poolIdx, 1);
      }
    }

    // Pass 2: Pre-filled Template Row Match by Variant Name (when planned Baku differed slightly and Hasil === 0)
    for (let rIdx = 0; rIdx < rekapOnActiveDate.length; rIdx++) {
      if (matchedFlags[rIdx]) continue;
      const rRow = rekapOnActiveDate[rIdx];
      if (!rRow.jenisKrosok || rRow.hasil > 0) continue;
      const rNorm = norm(rRow.jenisKrosok);
      const poolIdx = availableDhpPool.findIndex((d) => {
        const dNorm = norm(d.jenisTembakau);
        return (
          dNorm === rNorm ||
          (rNorm.length > 2 && (dNorm.includes(rNorm) || rNorm.includes(dNorm)))
        );
      });
      if (poolIdx !== -1) {
        matchedFlags[rIdx] = true;
        availableDhpPool.splice(poolIdx, 1);
      }
    }

    const emptyTemplateRows: RekapRawDateRow[] = [];
    const cancelledPlanRows: RekapRawDateRow[] = [];
    const protectedOrphanRows: RekapRawDateRow[] = [];

    for (let rIdx = 0; rIdx < rekapOnActiveDate.length; rIdx++) {
      if (matchedFlags[rIdx]) continue;
      const rRow = rekapOnActiveDate[rIdx];

      // Fail-Safe Mutlak: Baris dengan Netto Hasil > 0 TIDAK PERNAH masuk daftar hapus otomatis
      if (rRow.hasil > 0) {
        protectedOrphanRows.push(rRow);
      } else if (rRow.baku <= 0) {
        emptyTemplateRows.push(rRow);
      } else {
        cancelledPlanRows.push(rRow);
      }
    }

    return {
      activeIsoDate,
      activeDateDisplay,
      dhpActiveCount: activeDhpOnDate.length,
      rekapTotalOnDate: rekapOnActiveDate.length,
      emptyTemplateRows,
      cancelledPlanRows,
      protectedOrphanRows,
      purgeableRows: [...cancelledPlanRows, ...emptyTemplateRows]
    };
  } catch (err) {
    console.warn('Active-date realization audit notice:', err);
    return null;
  }
}

let _dhpCacheRaw: string | null | undefined = undefined;
let _dhpCacheVal: DhpKrosokItem[] | null = null;
let _recordsCacheRaw: string | null | undefined = undefined;
let _recordsCacheVal: KrosokRecord[] | null = null;

/** Get cached DHP items from localStorage (Zero dummy/hardcoded fallback, in-memory cached) */
export function getCachedDhpItems(): DhpKrosokItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DHP_CACHE);
    if (_dhpCacheVal && raw === _dhpCacheRaw) {
      return _dhpCacheVal;
    }
    _dhpCacheRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        _dhpCacheVal = parsed.map((item: DhpKrosokItem) => {
          const baku = Number(item.baku) || 0;
          const hasil = Number(item.hasil) || 0;
          const rawSusut = Number(item.susutKg) || 0;
          // Guard against legacy 100% shrinkage on unweighed batches
          const isUnfinished = hasil <= 0 && Math.abs(rawSusut - baku) < 0.05;
          const susutKg = hasil > 0 ? round2(baku - hasil) : isUnfinished ? 0 : round2(rawSusut);
          const susutPct = hasil > 0 && baku > 0 ? round2((susutKg / baku) * 100) : 0;

          // Sanitize any legacy misaligned jenisKrosokMaster from old column 17 index bug
          const validMaster =
            item.jenisKrosokMaster &&
            item.jenisTembakau &&
            item.jenisKrosokMaster.toLowerCase().includes(
              item.jenisTembakau.replace(/\b(skt|skm)\b/gi, '').trim().toLowerCase()
            )
              ? item.jenisKrosokMaster
              : undefined;

          return {
            ...item,
            jenisKrosokMaster: validMaster,
            baku,
            hasil,
            susutKg,
            susutPct
          };
        });
        return _dhpCacheVal;
      }
    }
  } catch (e) {
    console.warn('Error reading cached DHP items:', e);
  }
  _dhpCacheVal = [];
  return [];
}

/** Save DHP items to localStorage */
export function setCachedDhpItems(items: DhpKrosokItem[]): void {
  _dhpCacheVal = items;
  try {
    const raw = JSON.stringify(items);
    localStorage.setItem(STORAGE_KEYS.DHP_CACHE, raw);
    _dhpCacheRaw = raw;
  } catch (e) {
    console.warn('Error saving DHP cache:', e);
  }
}

/** Load records from localStorage cache or fallback to real Rekap snapshot (in-memory cached) */
export function getCachedRecords(): KrosokRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RAW_DATA);
    if (_recordsCacheVal && raw === _recordsCacheRaw) {
      return _recordsCacheVal;
    }
    _recordsCacheRaw = raw;
    if (raw) {
      const parsed: KrosokRecord[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Auto-heal if localStorage previously cached a partial filtered Gviz response (e.g. Sept-Oct only)
        if (parsed.length < INITIAL_SEED_RECORDS.length * 0.6) {
          const mergedMap = new Map<string, KrosokRecord>();
          INITIAL_SEED_RECORDS.forEach((r) => {
            mergedMap.set(`${r.tanggal}|${r.baku.toFixed(1)}|${r.jenisKrosok.toLowerCase()}`, r);
          });
          parsed.forEach((r) => {
            if (r.jenisKrosok) {
              mergedMap.set(`${r.tanggal}|${r.baku.toFixed(1)}|${r.jenisKrosok.toLowerCase()}`, r);
            }
          });
          _recordsCacheVal = Array.from(mergedMap.values()).sort((a, b) =>
            a.tanggal !== b.tanggal ? a.tanggal.localeCompare(b.tanggal) : a.srcRow - b.srcRow
          );
          return _recordsCacheVal;
        }
        _recordsCacheVal = parsed;
        return _recordsCacheVal;
      }
    }
  } catch (e) {
    console.error('Error reading cached records:', e);
  }
  _recordsCacheVal = INITIAL_SEED_RECORDS;
  return INITIAL_SEED_RECORDS;
}

/** Save records to localStorage */
export function setCachedRecords(records: KrosokRecord[]): void {
  _recordsCacheVal = records;
  try {
    const raw = JSON.stringify(records);
    localStorage.setItem(STORAGE_KEYS.RAW_DATA, raw);
    localStorage.setItem(STORAGE_KEYS.LAST_FETCH, Date.now().toString());
    _recordsCacheRaw = raw;
  } catch (e) {
    console.error('Error writing cached records to localStorage:', e);
  }
}

/** Compute available filter options */
export function computeFilterOptions(records: KrosokRecord[]): FilterOptions {
  const tahunSet = new Set<string>();
  const jenisKrosokSet = new Set<string>();
  const jenisProsesSet = new Set<string>();

  records.forEach((r) => {
    if (r.tahun && r.tahun !== 'undefined') tahunSet.add(r.tahun);
    if (r.jenisKrosok) jenisKrosokSet.add(r.jenisKrosok);
    if (r.jenisProses) jenisProsesSet.add(r.jenisProses);
  });

  return {
    tahun: Array.from(tahunSet).sort(),
    bulan: MONTH_ORDER,
    jenisKrosok: Array.from(jenisKrosokSet).sort((a, b) => a.localeCompare(b)),
    jenisProses: Array.from(jenisProsesSet).sort(),
  };
}

/** Format ISO date to long Indonesian string e.g. "8 Oktober 2026" */
export function formatTanggalIndo(isoDate: string): string {
  if (!isoDate) return '-';
  const parts = isoDate.split('-');
  if (parts.length < 3) return isoDate;
  const thn = parts[0];
  const blnIdx = parseInt(parts[1], 10) - 1;
  const tgl = parseInt(parts[2], 10);
  return `${tgl} ${MONTH_ORDER[blnIdx] || ''} ${thn}`;
}

export function getEntriTerkini(records: KrosokRecord[]): string | null {
  if (!records.length) return null;
  let maxDate = records[0].tanggal;
  records.forEach((r) => {
    if (r.tanggal > maxDate) maxDate = r.tanggal;
  });
  return formatTanggalIndo(maxDate);
}

/** Summarize an array of filtered records */
function summarize(filtered: KrosokRecord[]): RingkasanData {
  let sumBaku = 0;
  let sumHasil = 0;
  let sumSusut = 0;
  let sumGagang = 0;
  let sumDebuAir = 0;
  let minPct = Infinity;
  let maxPct = -Infinity;

  filtered.forEach((r) => {
    sumBaku += r.baku;
    sumHasil += r.hasil;
    sumSusut += r.susutKg;
    sumGagang += r.gagangKg;
    sumDebuAir += r.debuAirKg;
    if (r.susutPct < minPct) minPct = r.susutPct;
    if (r.susutPct > maxPct) maxPct = r.susutPct;
  });

  return {
    jumlahData: filtered.length,
    baku: round2(sumBaku),
    hasil: round2(sumHasil),
    susutKg: round2(sumSusut),
    susutPct: round2(sumBaku ? (sumSusut / sumBaku) * 100 : 0),
    susutMinPct: round2(minPct === Infinity ? 0 : minPct),
    susutMaxPct: round2(maxPct === -Infinity ? 0 : maxPct),
    gagangPct: round2(sumBaku ? (sumGagang / sumBaku) * 100 : 0),
    debuAirPct: round2(sumBaku ? (sumDebuAir / sumBaku) * 100 : 0),
    periodeLabel: '',
  };
}

/** Compute Ringkasan Tahunan or Bulanan */
export function computeRingkasan(
  rows: KrosokRecord[],
  tahun: string,
  bulan: string,
  jenisProses: string,
  mode: 'tahunan' | 'bulanan'
): RingkasanData {
  const filtered = rows.filter((r) => {
    if (tahun && tahun !== 'Semua' && r.tahun !== tahun) return false;
    if (mode === 'bulanan' && bulan && bulan !== 'Semua' && r.bulan !== bulan) return false;
    if (jenisProses && jenisProses !== 'Semua' && r.jenisProses !== jenisProses) return false;
    return true;
  });

  const s = summarize(filtered);
  const tahunLabel = tahun && tahun !== 'Semua' ? tahun : 'Semua Tahun';
  const jenisLabel = jenisProses && jenisProses !== 'Semua' ? ` · ${jenisProses}` : '';
  s.periodeLabel =
    (mode === 'tahunan'
      ? tahunLabel
      : `${bulan && bulan !== 'Semua' ? bulan : 'Semua Bulan'} ${tahunLabel}`) + jenisLabel;
  return s;
}

/** Filter records by custom date range: tahunMulai, bulanMulai to tahunAkhir, bulanAkhir */
export function filterByPeriode(
  rows: KrosokRecord[],
  tahunMulai: string,
  bulanMulai: string,
  tahunAkhir: string,
  bulanAkhir: string,
  jenisProses: string
): KrosokRecord[] {
  let startKey = monthKey(tahunMulai, bulanMulai);
  let endKey = monthKey(tahunAkhir, bulanAkhir);
  if (endKey < startKey) {
    const tmp = startKey;
    startKey = endKey;
    endKey = tmp;
  }
  return rows.filter((r) => {
    if (jenisProses && jenisProses !== 'Semua' && r.jenisProses !== jenisProses) return false;
    const k = monthKey(r.tahun, r.bulan);
    return k >= startKey && k <= endKey;
  });
}

export function computeRingkasanPeriode(
  rows: KrosokRecord[],
  tahunMulai: string,
  bulanMulai: string,
  tahunAkhir: string,
  bulanAkhir: string,
  jenisProses: string
): RingkasanData {
  const filtered = filterByPeriode(rows, tahunMulai, bulanMulai, tahunAkhir, bulanAkhir, jenisProses);
  const s = summarize(filtered);
  const labelMulai = `${bulanMulai} ${tahunMulai}`;
  const labelAkhir = `${bulanAkhir} ${tahunAkhir}`;
  const rangeStr = labelMulai === labelAkhir ? labelMulai : `${labelMulai} — ${labelAkhir}`;
  s.periodeLabel = rangeStr + (jenisProses && jenisProses !== 'Semua' ? ` · ${jenisProses}` : '');
  return s;
}

/** Agregasi pembantu */
function aggregateGroups(rows: KrosokRecord[], keyFn: (r: KrosokRecord) => string) {
  const map: Record<
    string,
    {
      key: string;
      baku: number;
      hasil: number;
      susutKg: number;
      gagangKg: number;
      debuAirKg: number;
      count: number;
      minPct: number;
      maxPct: number;
    }
  > = {};

  rows.forEach((r) => {
    const key = keyFn(r);
    if (!map[key]) {
      map[key] = {
        key,
        baku: 0,
        hasil: 0,
        susutKg: 0,
        gagangKg: 0,
        debuAirKg: 0,
        count: 0,
        minPct: Infinity,
        maxPct: -Infinity,
      };
    }
    const g = map[key];
    g.baku += r.baku;
    g.hasil += r.hasil;
    g.susutKg += r.susutKg;
    g.gagangKg += r.gagangKg;
    g.debuAirKg += r.debuAirKg;
    g.count += 1;
    if (r.susutPct < g.minPct) g.minPct = r.susutPct;
    if (r.susutPct > g.maxPct) g.maxPct = r.susutPct;
  });

  return map;
}

function finalizeGroups(map: ReturnType<typeof aggregateGroups>, totalBaku: number): RekapGroup[] {
  const list: RekapGroup[] = [];
  Object.keys(map).forEach((k) => {
    const g = map[k];
    list.push({
      label: k,
      jumlahData: g.count,
      baku: round2(g.baku),
      hasil: round2(g.hasil),
      susutKg: round2(g.susutKg),
      susutPct: round2(g.baku ? (g.susutKg / g.baku) * 100 : 0),
      minPct: round2(g.minPct === Infinity ? 0 : g.minPct),
      maxPct: round2(g.maxPct === -Infinity ? 0 : g.maxPct),
      gagangPct: round2(g.baku ? (g.gagangKg / g.baku) * 100 : 0),
      debuAirPct: round2(g.baku ? (g.debuAirKg / g.baku) * 100 : 0),
      kapasitasPct: round2(totalBaku ? (g.baku / totalBaku) * 100 : 0),
    });
  });
  return list;
}

/** Compute Rekap per Bulan */
export function computeRekapBulan(
  rows: KrosokRecord[],
  tahun: string,
  jenisProses: string,
  bulanAwal?: string,
  bulanAkhir?: string
): RekapGroup[] {
  const idxAwal = bulanAwal ? MONTH_ORDER.indexOf(bulanAwal) : -1;
  const idxAkhir = bulanAkhir ? MONTH_ORDER.indexOf(bulanAkhir) : -1;

  const filtered = rows.filter((r) => {
    if (tahun && tahun !== 'Semua' && r.tahun !== tahun) return false;
    if (jenisProses && jenisProses !== 'Semua' && r.jenisProses !== jenisProses) return false;

    if (idxAwal !== -1 && idxAkhir !== -1) {
      const idx = MONTH_ORDER.indexOf(r.bulan);
      if (idx !== -1) {
        if (idxAwal <= idxAkhir) {
          if (idx < idxAwal || idx > idxAkhir) return false;
        } else {
          // Cross-year range (e.g., November to Maret)
          if (idx < idxAwal && idx > idxAkhir) return false;
        }
      }
    }

    return true;
  });

  const totalBaku = filtered.reduce((s, r) => s + r.baku, 0);
  const map = aggregateGroups(filtered, (r) => `${r.bulan}||${r.tahun}`);
  const list = finalizeGroups(map, totalBaku);

  list.forEach((item) => {
    const parts = item.label.split('||');
    item.bulan = parts[0];
    item.tahun = parts[1];
    item.label = `${parts[0]} ${parts[1]}`;
  });

  list.sort((a, b) => {
    if (a.tahun !== b.tahun) return (a.tahun || '').localeCompare(b.tahun || '');
    return MONTH_ORDER.indexOf(a.bulan || '') - MONTH_ORDER.indexOf(b.bulan || '');
  });

  return list;
}

/** Compute Rekap per Jenis Krosok based on custom period range */
export function computeRekapJenisKrosokPeriode(
  rows: KrosokRecord[],
  tahunMulai: string,
  bulanMulai: string,
  tahunAkhir: string,
  bulanAkhir: string,
  jenisProses: string
): RekapGroup[] {
  const filtered = filterByPeriode(rows, tahunMulai, bulanMulai, tahunAkhir, bulanAkhir, jenisProses);
  const totalBaku = filtered.reduce((s, r) => s + r.baku, 0);
  const map = aggregateGroups(filtered, (r) => r.jenisKrosok || 'Tanpa Keterangan');
  const list = finalizeGroups(map, totalBaku);
  list.sort((a, b) => b.baku - a.baku); // sorted by largest Baku volume
  return list;
}

/** Compute trend for a specific selected Jenis Krosok across months */
export function computeTrendJenisKrosok(
  rows: KrosokRecord[],
  tahun: string,
  jenisKrosok: string,
  jenisProses: string
): TrendJenisData {
  const filtered = rows.filter((r) => {
    if (r.jenisKrosok !== jenisKrosok) return false;
    if (tahun && tahun !== 'Semua' && r.tahun !== tahun) return false;
    if (jenisProses && jenisProses !== 'Semua' && r.jenisProses !== jenisProses) return false;
    return true;
  });

  const totalBaku = filtered.reduce((s, r) => s + r.baku, 0);
  const map = aggregateGroups(filtered, (r) => `${r.bulan}||${r.tahun}`);
  const list = finalizeGroups(map, totalBaku);

  list.forEach((item) => {
    const parts = item.label.split('||');
    item.bulan = parts[0];
    item.tahun = parts[1];
    item.label = `${parts[0]?.substring(0, 3)} ${parts[1]}`;
  });

  list.sort((a, b) => {
    if (a.tahun !== b.tahun) return (a.tahun || '').localeCompare(b.tahun || '');
    return MONTH_ORDER.indexOf(a.bulan || '') - MONTH_ORDER.indexOf(b.bulan || '');
  });

  return { jenisKrosok, data: list };
}

let _lastDashCache: {
  records: KrosokRecord[];
  tahun: string;
  bulanRingkasan: string;
  jenisProses: string;
  pAwalBulan: string;
  pAwalTahun: string;
  pAkhirBulan: string;
  pAkhirTahun: string;
  selectedTrendJenis?: string;
  result: DashboardData;
} | null = null;

/** Complete Dashboard Assembler */
export function buildDashboardData(
  records: KrosokRecord[],
  tahun: string,
  bulanRingkasan: string,
  jenisProses: string,
  periodeAwal: { bulan: string; tahun: string },
  periodeAkhir: { bulan: string; tahun: string },
  selectedTrendJenis?: string
): DashboardData {
  if (
    _lastDashCache &&
    _lastDashCache.records === records &&
    _lastDashCache.tahun === tahun &&
    _lastDashCache.bulanRingkasan === bulanRingkasan &&
    _lastDashCache.jenisProses === jenisProses &&
    _lastDashCache.pAwalBulan === periodeAwal.bulan &&
    _lastDashCache.pAwalTahun === periodeAwal.tahun &&
    _lastDashCache.pAkhirBulan === periodeAkhir.bulan &&
    _lastDashCache.pAkhirTahun === periodeAkhir.tahun &&
    _lastDashCache.selectedTrendJenis === selectedTrendJenis
  ) {
    return _lastDashCache.result;
  }

  const filterOptions = computeFilterOptions(records);
  const rekapJenisPeriode = computeRekapJenisKrosokPeriode(
    records,
    periodeAwal.tahun,
    periodeAwal.bulan,
    periodeAkhir.tahun,
    periodeAkhir.bulan,
    jenisProses
  );

  const defaultJenis =
    selectedTrendJenis && filterOptions.jenisKrosok.includes(selectedTrendJenis)
      ? selectedTrendJenis
      : rekapJenisPeriode.length > 0
      ? rekapJenisPeriode[0].label
      : filterOptions.jenisKrosok[0] || 'Zambia M1L (2023)';

  const result: DashboardData = {
    filterOptions,
    entriTerkini: getEntriTerkini(records),
    lastUpdated: formatWibHHMMSS(),
    ringkasanTahunan: computeRingkasan(records, tahun, 'Semua', jenisProses, 'tahunan'),
    ringkasanBulanan: computeRingkasan(records, tahun, bulanRingkasan, jenisProses, 'bulanan'),
    ringkasanPeriode: computeRingkasanPeriode(
      records,
      periodeAwal.tahun,
      periodeAwal.bulan,
      periodeAkhir.tahun,
      periodeAkhir.bulan,
      jenisProses
    ),
    rekapBulan: computeRekapBulan(records, tahun, jenisProses),
    rekapJenisKrosokPeriode: rekapJenisPeriode,
    trendJenis: computeTrendJenisKrosok(records, tahun, defaultJenis, jenisProses),
  };

  _lastDashCache = {
    records,
    tahun,
    bulanRingkasan,
    jenisProses,
    pAwalBulan: periodeAwal.bulan,
    pAwalTahun: periodeAwal.tahun,
    pAkhirBulan: periodeAkhir.bulan,
    pAkhirTahun: periodeAkhir.tahun,
    selectedTrendJenis,
    result
  };

  return result;
}
