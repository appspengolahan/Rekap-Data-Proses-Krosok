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

export function loadConfig(): GASConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Automatically migrate to new standalone URL if user has older URL in localStorage
      if (!parsed.gasUrl || parsed.gasUrl.includes('AKfycbxe') || parsed.gasUrl.includes('AKfycbw')) {
        parsed.gasUrl = DEFAULT_CONFIG.gasUrl;
      }
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        gasUrl: parsed.gasUrl || DEFAULT_CONFIG.gasUrl,
        dhpSpreadsheetId: parsed.dhpSpreadsheetId || DEFAULT_CONFIG.dhpSpreadsheetId,
        dhpSheetName: parsed.dhpSheetName || DEFAULT_CONFIG.dhpSheetName,
      };
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(cfg: GASConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(cfg));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Number(n).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Number(n).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getPctClass(v: number): string {
  if (v >= 10) return 'text-rose-600 font-bold';
  if (v <= 4) return 'text-emerald-600 font-bold';
  return 'text-slate-700';
}

function monthKey(tahun: string | number, bulan: string): number {
  return Number(tahun) * 12 + MONTH_ORDER.indexOf(bulan);
}

/** Parses Google Visualization query Date string e.g. "Date(2025,10,12)" or string date */
function parseGvizDate(v: any): { iso: string; display: string; bulan: string; tahun: string } {
  if (typeof v === 'string' && v.startsWith('Date(')) {
    const parts = v.replace('Date(', '').replace(')', '').split(',').map(s => parseInt(s.trim(), 10));
    const year = parts[0];
    const month = parts[1]; // 0-indexed in JS/Gviz
    const day = parts[2];
    const d = new Date(year, month, day);
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const display = `${day} ${MONTH_ORDER[month]} ${year}`;
    return {
      iso,
      display,
      bulan: MONTH_ORDER[month],
      tahun: String(year)
    };
  }
  
  if (v instanceof Date) {
    const year = v.getFullYear();
    const month = v.getMonth();
    const day = v.getDate();
    return {
      iso: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      display: `${day} ${MONTH_ORDER[month]} ${year}`,
      bulan: MONTH_ORDER[month],
      tahun: String(year)
    };
  }

  // fallback to string format
  const s = String(v || '');
  return {
    iso: s,
    display: s,
    bulan: 'Oktober',
    tahun: '2026'
  };
}

/** Fetch data via Google Visualization API query endpoint */
export async function fetchFromGviz(spreadsheetId: string, sheetName: string): Promise<KrosokRecord[]> {
  if (!spreadsheetId) return [];
  try {
    const encSheet = encodeURIComponent(sheetName);
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encSheet}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Google Sheet request notice (Status: ${response.status})`);
      return [];
    }
    
    const text = await response.text();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.warn('Respon Google Sheet bukan JSON valid.');
      return [];
    }
    
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

      // Filter valid data rows: must have Netto Baku > 0 and Netto Hasil as numbers
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

    return records;
  } catch (err) {
    console.warn('fetchFromGviz network notice (using offline/cached records):', err);
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

/** Fetch data from GAS endpoint (reads full unfiltered REKAP SUSUT KROSOK sheet) */
export async function fetchFromGAS(
  gasUrl: string,
  referenceRecords: KrosokRecord[] = []
): Promise<KrosokRecord[]> {
  if (!gasUrl || !gasUrl.startsWith('http')) {
    return [];
  }
  try {
    const urlWithAction = gasUrl.includes('?')
      ? `${gasUrl}&action=readAll`
      : `${gasUrl}?action=readAll`;
    const response = await fetch(urlWithAction, { redirect: 'follow' });
    if (!response.ok) {
      console.warn(`GAS Endpoint notice (Status: ${response.status})`);
      return [];
    }
    const data = await response.json();
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
    console.warn('fetchFromGAS network notice (using offline/cached records):', err);
    return [];
  }
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

/**
 * Combines Rekap Proses Krosok with completed live DHP Krosok batches (hasil > 0)
 * as a unified Single Source of Truth (excluding unfinished hasil == 0 batches).
 */
export function mergeRekapWithCompletedDhp(
  rekapRecords: KrosokRecord[],
  dhpItems: DhpKrosokItem[]
): KrosokRecord[] {
  if (!dhpItems || dhpItems.length === 0) return rekapRecords;

  const updatedRekap = rekapRecords.map((r) => {
    const dhpUpdate = dhpItems.find(
      (d) =>
        d.hasil > 0 &&
        d.needsUpdateInRekap &&
        (d.matchedRow === r.srcRow ||
          (d.tanggal === r.tanggal &&
            Math.abs(d.baku - r.baku) < 0.2 &&
            d.jenisTembakau.toLowerCase() === r.jenisKrosok.toLowerCase()))
    );
    if (!dhpUpdate) return r;
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
    if (!d.hasil || d.hasil <= 0 || d.isMatchedInRekap) return;
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

  return newCompletedFromDhp.length > 0
    ? [...updatedRekap, ...newCompletedFromDhp]
    : updatedRekap;
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
        const gagangKg = typeof c[5]?.v === 'number' ? round2(c[5]?.v) : 0;
        const airKg = typeof c[6]?.v === 'number' ? round2(c[6]?.v) : 0;
        const debuKg = typeof c[7]?.v === 'number' ? round2(c[7]?.v) : 0;

        // Kolom I (Index 8) adalah HASIL PROSES riil di DHP (bernilai boolean `false` jika belum selesai ditimbang)
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
          // Batch sudah ditimbang hasil prosesnya secara riil
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

        const susutPct = hasil > 0 && baku > 0 ? round2((susutKg / baku) * 100) : 0;

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

        // Check if matched in rekap records
        const match = rekapRecords.find((r) => {
          const dateMatch = r.tanggal === parsedDate.iso;
          const tembakauMatch =
            r.jenisKrosok.toLowerCase() === tembakauStr.toLowerCase() ||
            (r.jenisPerlakuan &&
              r.jenisPerlakuan.toLowerCase().includes(tembakauStr.toLowerCase())) ||
            tembakauStr.toLowerCase().includes(r.jenisKrosok.toLowerCase());
          const bakuMatch = Math.abs(r.baku - baku) < 0.2;
          return dateMatch && tembakauMatch && bakuMatch;
        });

        const isMatched = Boolean(match);
        const needsUpdate = Boolean(
          match && hasil > 0 && Math.abs(match.hasil - hasil) >= 0.5
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
          rekapHasil: match?.hasil
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

export function getDhpActiveSheetDateLabel(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.DHP_ACTIVE_DATE) || '';
  } catch {
    return '';
  }
}

function setDhpActiveSheetDateLabel(label: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DHP_ACTIVE_DATE, label);
  } catch {
    // ignore storage quota errors
  }
}

export function getDhpActiveSheetIsoDate(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.DHP_ACTIVE_ISO_DATE) || '';
  } catch {
    return '';
  }
}

function setDhpActiveSheetIsoDate(isoDate: string): void {
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

/** Get cached DHP items from localStorage (Zero dummy/hardcoded fallback) */
export function getCachedDhpItems(): DhpKrosokItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DHP_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: DhpKrosokItem) => {
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
      }
    }
  } catch (e) {
    console.warn('Error reading cached DHP items:', e);
  }
  return [];
}

/** Save DHP items to localStorage */
export function setCachedDhpItems(items: DhpKrosokItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DHP_CACHE, JSON.stringify(items));
  } catch (e) {
    console.warn('Error saving DHP cache:', e);
  }
}

/** Load records from localStorage cache or fallback to real Rekap snapshot */
export function getCachedRecords(): KrosokRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RAW_DATA);
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
          return Array.from(mergedMap.values()).sort((a, b) =>
            a.tanggal !== b.tanggal ? a.tanggal.localeCompare(b.tanggal) : a.srcRow - b.srcRow
          );
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading cached records:', e);
  }
  return INITIAL_SEED_RECORDS;
}

/** Save records to localStorage */
export function setCachedRecords(records: KrosokRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.RAW_DATA, JSON.stringify(records));
    localStorage.setItem(STORAGE_KEYS.LAST_FETCH, Date.now().toString());
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

  return {
    filterOptions,
    entriTerkini: getEntriTerkini(records),
    lastUpdated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
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
}
