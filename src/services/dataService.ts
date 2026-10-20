import {
  KrosokRecord,
  DashboardData,
  FilterOptions,
  RingkasanData,
  RekapGroup,
  TrendJenisData,
  GASConfig,
  DhpKrosokItem
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

/** Fetch data from GAS endpoint if exposed as headless JSON */
export async function fetchFromGAS(gasUrl: string): Promise<KrosokRecord[]> {
  if (!gasUrl || !gasUrl.startsWith('http')) {
    return [];
  }
  try {
    const urlWithAction = gasUrl.includes('?') ? `${gasUrl}&action=readAll` : `${gasUrl}?action=readAll`;
    const response = await fetch(urlWithAction, { redirect: 'follow' });
    if (!response.ok) {
      console.warn(`GAS Endpoint notice (Status: ${response.status})`);
      return [];
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data;
    }
    if (data && data.records && Array.isArray(data.records)) {
      return data.records;
    }
    return [];
  } catch (err) {
    console.warn('fetchFromGAS network notice (using offline/cached records):', err);
    return [];
  }
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

    for (let i = 0; i < rows.length; i++) {
      const c = rows[i].c;
      if (!c || c.length < 5) continue;

      const rawTgl = c[2]?.v;
      const rawTembakau = c[3]?.v;
      const rawBaku = c[4]?.v;
      const rawWaktu = c[12]?.v ? String(c[12]?.v).trim() : '';
      const rawKodeStock = c[16]?.v ? String(c[16]?.v).trim() : undefined;
      const rawKrosokMaster = c[17]?.v ? String(c[17]?.v).trim() : undefined;

      // Filter: valid batch must have tobacco name and baku > 0
      if (rawTembakau && typeof rawBaku === 'number' && rawBaku > 0) {
        const parsedDate = parseGvizDate(rawTgl);
        const baku = round2(rawBaku);
        const gagangKg = typeof c[5]?.v === 'number' ? round2(c[5]?.v) : 0;
        const airKg = typeof c[6]?.v === 'number' ? round2(c[6]?.v) : 0;
        const debuKg = typeof c[7]?.v === 'number' ? round2(c[7]?.v) : 0;
        
        // Kolom I (Index 8) adalah HASIL PROSES riil di DHP
        const rawHasil = typeof c[8]?.v === 'number' ? c[8]?.v : (typeof c[8]?.v === 'string' ? parseFloat(c[8]?.v.replace(',', '.')) : NaN);
        const rawSusutKg = typeof c[9]?.v === 'number' ? c[9]?.v : (typeof c[9]?.v === 'string' ? parseFloat(c[9]?.v.replace(',', '.')) : NaN);
        const rawSusutPct = typeof c[10]?.v === 'number' ? c[10]?.v : (typeof c[10]?.v === 'string' ? parseFloat(c[10]?.v.replace('%', '').replace(',', '.')) : NaN);

        // Susut (%) dari DHP
        let susutPct = !isNaN(rawSusutPct)
          ? round2(rawSusutPct > 1 ? rawSusutPct : rawSusutPct * 100)
          : 0;

        let hasil = 0;
        let susutKg = 0;

        if (!isNaN(rawHasil) && rawHasil > 0) {
          // 1. Jika Kolom I memiliki nilai riil > 0
          hasil = round2(rawHasil);
          susutKg = !isNaN(rawSusutKg) && rawSusutKg !== 0 ? round2(rawSusutKg) : round2(baku - hasil);
          if (susutPct === 0 && baku > 0) {
            susutPct = round2((susutKg / baku) * 100);
          }
        } else if (susutPct !== 0 && Math.abs(susutPct) < 100) {
          // 2. Jika Hasil di DHP masih 0 / kosong tetapi Susut (%) sudah terisi (misal 8.25%)
          susutKg = round2(baku * (susutPct / 100));
          hasil = round2(baku - susutKg);
        } else if (!isNaN(rawSusutKg) && rawSusutKg > 0 && rawSusutKg < baku) {
          // 3. Jika Susut (Kg) tersedia
          susutKg = round2(rawSusutKg);
          hasil = round2(baku - susutKg);
          susutPct = round2((susutKg / baku) * 100);
        } else if ((gagangKg + airKg + debuKg) > 0 && (gagangKg + airKg + debuKg) < baku) {
          // 4. Jika pecahan proses (gagang, air, debu) terisi
          susutKg = round2(gagangKg + airKg + debuKg);
          hasil = round2(baku - susutKg);
          susutPct = round2((susutKg / baku) * 100);
        } else {
          // 5. Batch belum selesai / baru terdaftar
          hasil = 0;
          susutKg = baku;
          susutPct = 100;
        }

        const tembakauStr = String(rawTembakau).trim();
        const jalurProses: 'SKT' | 'SKM' = tembakauStr.toUpperCase().includes('SKM') ? 'SKM' : 'SKT';

        // Check if matched in rekap records
        const match = rekapRecords.find((r) => {
          const dateMatch = r.tanggal === parsedDate.iso;
          const tembakauMatch =
            r.jenisKrosok.toLowerCase() === tembakauStr.toLowerCase() ||
            (r.jenisPerlakuan && r.jenisPerlakuan.toLowerCase().includes(tembakauStr.toLowerCase())) ||
            tembakauStr.toLowerCase().includes(r.jenisKrosok.toLowerCase());
          const bakuMatch = Math.abs(r.baku - baku) < 0.2;
          return dateMatch && tembakauMatch && bakuMatch;
        });

        items.push({
          id: `dhp_${i + 1}_${parsedDate.iso}_${baku}`,
          rowIdx: i + 1,
          tanggal: parsedDate.iso,
          tanggalDisplay: parsedDate.display,
          bulan: parsedDate.bulan,
          tahun: parsedDate.tahun,
          jenisTembakau: tembakauStr,
          jenisKrosokMaster: rawKrosokMaster,
          kodeStock: rawKodeStock,
          waktu: rawWaktu,
          baku,
          hasil,
          gagangKg,
          airKg,
          debuKg,
          susutKg,
          susutPct,
          jalurProses,
          isMatchedInRekap: Boolean(match),
          matchedRow: match?.srcRow
        });
      }
    }

    if (items.length > 0) {
      setCachedDhpItems(items);
    }
    return items.length > 0 ? items : getCachedDhpItems();
  } catch (err) {
    console.warn('fetchDhpKrosokRecords network notice (using cached):', err);
    return getCachedDhpItems();
  }
}

/** Get cached DHP items from localStorage */
export function getCachedDhpItems(): DhpKrosokItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DHP_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading cached DHP items:', e);
  }
  return [
    {
      id: 'dhp_7_2026-10-19_1097.7',
      rowIdx: 7,
      tanggal: '2026-10-19',
      tanggalDisplay: '19 Oktober 2026',
      bulan: 'Oktober',
      tahun: '2026',
      jenisTembakau: 'Zimbabwe B1L (2023)',
      waktu: '14:52 - 14:53',
      baku: 1097.7,
      hasil: 1007.1,
      gagangKg: 72.4,
      debuKg: 18.2,
      susutKg: 90.6,
      susutPct: 8.25,
      jalurProses: 'SKT',
      isMatchedInRekap: true,
      matchedRow: 143
    },
    {
      id: 'dhp_8_2026-10-19_802.9',
      rowIdx: 8,
      tanggal: '2026-10-19',
      tanggalDisplay: '19 Oktober 2026',
      bulan: 'Oktober',
      tahun: '2026',
      jenisTembakau: 'Zimbabwe 2025 (HR) L1OF',
      waktu: '14:53 - 14:53',
      baku: 802.9,
      hasil: 738.7,
      gagangKg: 52.8,
      debuKg: 11.4,
      susutKg: 64.2,
      susutPct: 8.0,
      jalurProses: 'SKT',
      isMatchedInRekap: true,
      matchedRow: 144
    },
    {
      id: 'dhp_9_2026-10-19_1046.7',
      rowIdx: 9,
      tanggal: '2026-10-19',
      tanggalDisplay: '19 Oktober 2026',
      bulan: 'Oktober',
      tahun: '2026',
      jenisTembakau: 'Zimbabwe M1L (2023)',
      waktu: '14:54 - 14:54',
      baku: 1046.7,
      hasil: 960.9,
      gagangKg: 68.3,
      debuKg: 17.5,
      susutKg: 85.8,
      susutPct: 8.2,
      jalurProses: 'SKT',
      isMatchedInRekap: true,
      matchedRow: 145
    },
    {
      id: 'dhp_10_2026-10-19_699.7',
      rowIdx: 10,
      tanggal: '2026-10-19',
      tanggalDisplay: '19 Oktober 2026',
      bulan: 'Oktober',
      tahun: '2026',
      jenisTembakau: 'Brazil 2025 (BOA)',
      waktu: '14:54 - 14:55',
      baku: 699.7,
      hasil: 642.3,
      gagangKg: 45.2,
      debuKg: 12.2,
      susutKg: 57.4,
      susutPct: 8.2,
      jalurProses: 'SKT',
      isMatchedInRekap: true,
      matchedRow: 146
    }
  ];
}

/** Save DHP items to localStorage */
export function setCachedDhpItems(items: DhpKrosokItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DHP_CACHE, JSON.stringify(items));
  } catch (e) {
    console.warn('Error saving DHP cache:', e);
  }
}

/** Load records from localStorage cache or fallback to initial seed */
export function getCachedRecords(): KrosokRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RAW_DATA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
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
