import {
  BaselineConfigMeta,
  BatchFieldNote,
  DeviasiStatus,
  DhpKrosokItem,
  ExecutiveSignatories,
  FactoryWeatherData,
  KrosokRecord,
  KrosokStandarAcuan,
  MonthlyEvaluationSummary,
  MonthlyVariantEvaluation,
  TacticalBatchEvaluation
} from '../types';
import { MONTH_ORDER, round2 } from './dataService';
import { getBatchHourlyWeather } from './weatherService';

export const QUICK_TAG_OPTIONS: string[] = [
  'Kadar Air Awal Tinggi',
  'Krosok Kering / Rapuh',
  'Ubah Setting Mesin',
  'Dominan Gagang Tebal',
  'Efek Cuaca Lembab / Hujan',
  'Kapasitas Batch Kecil',
  'Penyesuaian Spray / Air',
  'Line Clearance / Sisa Mesin'
];

const ACUAN_STORAGE_KEYS = {
  STANDAR_LIST: 'krosok_standar_acuan_list_v1',
  BASELINE_META: 'krosok_baseline_meta_v1',
  BATCH_NOTES: 'krosok_batch_field_notes_v1',
  SIGNATORIES: 'krosok_exec_signatories_v1'
};

export const DEFAULT_BASELINE_META: BaselineConfigMeta = {
  bulanMulai: 'Agustus',
  bulanAkhir: 'September',
  tahunAcuan: '2026',
  bulanBerlaku: 'Oktober',
  tahunBerlaku: '2026',
  globalWaspadaPct: 0.15,
  globalOosPct: 0.30,
  periodeLabel: 'Agustus – September 2026',
  berlakuLabel: 'Oktober 2026',
  appliedAt: '2026-10-01'
};

export const DEFAULT_SIGNATORIES: ExecutiveSignatories = {
  dibuatNama: 'Mandor / Admin Pengolahan Krosok',
  dibuatJabatan: 'Unit Pengolahan Krosok',
  diperiksaNama: 'Asisten Manajer Produksi I',
  diperiksaJabatan: 'Pengendalian Proses & Mutu PP1',
  disetujuiNama: 'Manajer Divisi Produksi I',
  disetujuiJabatan: 'PT Batu Karang — Wagir',
  nomorDokumen: 'LAP-EVAL/PP1-KRS/X/2026',
  catatanTambahan: ''
};

function normalizeVariantName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(skt|skm)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function makeBatchNoteKey(
  tanggal: string,
  jenisKrosok: string,
  baku: number
): string {
  return `${tanggal}_${normalizeVariantName(jenisKrosok)}_${Number(baku || 0).toFixed(1)}`;
}

export function loadBaselineMeta(): BaselineConfigMeta {
  try {
    const raw = localStorage.getItem(ACUAN_STORAGE_KEYS.BASELINE_META);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_BASELINE_META, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_BASELINE_META;
}

export function saveBaselineMeta(meta: BaselineConfigMeta): void {
  try {
    localStorage.setItem(ACUAN_STORAGE_KEYS.BASELINE_META, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function loadBatchNotes(): Record<string, BatchFieldNote> {
  try {
    const raw = localStorage.getItem(ACUAN_STORAGE_KEYS.BATCH_NOTES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function saveBatchNote(
  note: BatchFieldNote,
  existingMap?: Record<string, BatchFieldNote>
): Record<string, BatchFieldNote> {
  const current = existingMap ? { ...existingMap } : loadBatchNotes();
  if (note.tags.length === 0 && !note.catatan.trim()) {
    delete current[note.batchKey];
  } else {
    current[note.batchKey] = {
      ...note,
      updatedAt: new Date().toISOString()
    };
  }
  try {
    localStorage.setItem(ACUAN_STORAGE_KEYS.BATCH_NOTES, JSON.stringify(current));
  } catch {
    // ignore
  }
  return current;
}

export function loadSignatories(): ExecutiveSignatories {
  try {
    const raw = localStorage.getItem(ACUAN_STORAGE_KEYS.SIGNATORIES);
    if (raw) {
      return { ...DEFAULT_SIGNATORIES, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SIGNATORIES;
}

export function saveSignatories(sig: ExecutiveSignatories): void {
  try {
    localStorage.setItem(ACUAN_STORAGE_KEYS.SIGNATORIES, JSON.stringify(sig));
  } catch {
    // ignore
  }
}

/**
 * Calculates weighted baseline per Jenis Krosok + Jalur Proses from real KrosokRecord[]
 */
export function calculateBaselineFromPeriod(
  records: KrosokRecord[],
  bulanMulai: string,
  bulanAkhir: string,
  tahunAcuan: string,
  globalWaspadaPct: number = 0.15,
  globalOosPct: number = 0.30,
  periodeLabelOverride?: string
): KrosokStandarAcuan[] {
  const idxStart = MONTH_ORDER.indexOf(bulanMulai);
  const idxEnd = MONTH_ORDER.indexOf(bulanAkhir);
  const minIdx = idxStart !== -1 && idxEnd !== -1 ? Math.min(idxStart, idxEnd) : 0;
  const maxIdx = idxStart !== -1 && idxEnd !== -1 ? Math.max(idxStart, idxEnd) : 11;

  const labelPeriode =
    periodeLabelOverride ||
    (bulanMulai === bulanAkhir
      ? `${bulanMulai} ${tahunAcuan}`
      : `${bulanMulai} – ${bulanAkhir} ${tahunAcuan}`);

  const filtered = records.filter((r) => {
    if (tahunAcuan !== 'Semua' && String(r.tahun) !== String(tahunAcuan)) return false;
    const mIdx = MONTH_ORDER.indexOf(r.bulan);
    if (idxStart !== -1 && idxEnd !== -1 && (mIdx < minIdx || mIdx > maxIdx)) return false;
    return r.baku > 0 && r.hasil > 0;
  });

  // Fallback to all records if selected baseline period has 0 rows
  const sourceRows = filtered.length > 0 ? filtered : records.filter((r) => r.baku > 0 && r.hasil > 0);

  const groupMap = new Map<
    string,
    {
      jenisKrosok: string;
      jenisProses: string;
      baku: number;
      hasil: number;
      susutKg: number;
      gagangKg: number;
      debuAirKg: number;
      batchCount: number;
      pctList: number[];
    }
  >();

  sourceRows.forEach((r) => {
    const jalur = r.jenisProses === 'SKM' ? 'SKM' : 'SKT';
    const key = `${r.jenisKrosok}|${jalur}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        jenisKrosok: r.jenisKrosok,
        jenisProses: jalur,
        baku: 0,
        hasil: 0,
        susutKg: 0,
        gagangKg: 0,
        debuAirKg: 0,
        batchCount: 0,
        pctList: []
      });
    }
    const g = groupMap.get(key)!;
    g.baku += r.baku;
    g.hasil += r.hasil;
    g.susutKg += r.susutKg;
    g.gagangKg += r.gagangKg || 0;
    g.debuAirKg += r.debuAirKg || 0;
    g.batchCount += 1;
    g.pctList.push(r.susutPct);
  });

  const sortedGroups = Array.from(groupMap.values()).sort((a, b) => b.baku - a.baku);
  const todayIso = new Date().toISOString().split('T')[0];
  const result: KrosokStandarAcuan[] = [];

  sortedGroups.forEach((g, idx) => {
    if (g.baku <= 0) return;
    const weightedSusutPct = round2((g.susutKg / g.baku) * 100);
    const avgGagangPct = round2((g.gagangKg / g.baku) * 100);
    const avgDebuAirPct = round2((g.debuAirKg / g.baku) * 100);
    const avgBatchBakuKg = round2(g.baku / g.batchCount);

    // Compute empirical spread so high-variance trial variants get proportional tolerance
    const meanPct =
      g.pctList.reduce((acc, v) => acc + v, 0) / (g.pctList.length || 1);
    const variance =
      g.pctList.reduce((acc, v) => acc + Math.pow(v - meanPct, 2), 0) /
      Math.max(1, g.pctList.length);
    const stdDev = Math.sqrt(variance);

    const waspada = round2(Math.max(globalWaspadaPct, Math.min(0.6, stdDev * 1.1)));
    const oos = round2(Math.max(globalOosPct, waspada * 1.85));

    result.push({
      id: `acuan_${idx + 1}_${normalizeVariantName(g.jenisKrosok).replace(/[^a-z0-9]/g, '_')}_${g.jenisProses}`,
      jenisKrosok: g.jenisKrosok,
      jenisProses: g.jenisProses,
      standarSusutPct: weightedSusutPct,
      toleransiWaspadaPct: waspada,
      toleransiOosPct: oos,
      periodeAcuan: labelPeriode,
      totalBakuKg: round2(g.baku),
      batchCount: g.batchCount,
      avgGagangPct,
      avgDebuAirPct,
      avgBatchBakuKg,
      keterangan: `Rata-rata tertimbang ${g.batchCount} batch (${Math.round(g.baku).toLocaleString('id-ID')} Kg) periode ${labelPeriode}`,
      updatedAt: todayIso
    });
  });

  // Add general fallback standard ("Semua / Umum")
  const sumBakuAll = sourceRows.reduce((s, r) => s + r.baku, 0);
  const sumSusutAll = sourceRows.reduce((s, r) => s + r.susutKg, 0);
  const sumGagangAll = sourceRows.reduce((s, r) => s + (r.gagangKg || 0), 0);
  const sumDebuAirAll = sourceRows.reduce((s, r) => s + (r.debuAirKg || 0), 0);

  if (sumBakuAll > 0) {
    result.push({
      id: 'acuan_fallback_umum',
      jenisKrosok: 'Semua / Umum',
      jenisProses: 'Semua',
      standarSusutPct: round2((sumSusutAll / sumBakuAll) * 100),
      toleransiWaspadaPct: round2(globalWaspadaPct),
      toleransiOosPct: round2(globalOosPct),
      periodeAcuan: labelPeriode,
      totalBakuKg: round2(sumBakuAll),
      batchCount: sourceRows.length,
      avgGagangPct: round2((sumGagangAll / sumBakuAll) * 100),
      avgDebuAirPct: round2((sumDebuAirAll / sumBakuAll) * 100),
      avgBatchBakuKg: round2(sumBakuAll / Math.max(1, sourceRows.length)),
      keterangan: `Acuan agregat seluruh krosok (${sourceRows.length} batch, ${Math.round(sumBakuAll).toLocaleString('id-ID')} Kg) periode ${labelPeriode}`,
      updatedAt: todayIso
    });
  }

  return result;
}

export function loadStandarAcuanList(records: KrosokRecord[]): KrosokStandarAcuan[] {
  try {
    const raw = localStorage.getItem(ACUAN_STORAGE_KEYS.STANDAR_LIST);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const meta = loadBaselineMeta();
  const computed = calculateBaselineFromPeriod(
    records,
    meta.bulanMulai,
    meta.bulanAkhir,
    meta.tahunAcuan,
    meta.globalWaspadaPct,
    meta.globalOosPct,
    meta.periodeLabel
  );
  saveStandarAcuanList(computed);
  return computed;
}

export function saveStandarAcuanList(list: KrosokStandarAcuan[]): void {
  try {
    localStorage.setItem(ACUAN_STORAGE_KEYS.STANDAR_LIST, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function findStandarForVariant(
  jenisKrosok: string,
  jalurProses: string,
  standarList: KrosokStandarAcuan[]
): KrosokStandarAcuan {
  const normTarget = normalizeVariantName(jenisKrosok);
  const jalurUpper = (jalurProses || 'SKT').toUpperCase();

  // 1. Exact normalized name + exact jalur
  const exact = standarList.find(
    (s) =>
      s.jenisKrosok !== 'Semua / Umum' &&
      normalizeVariantName(s.jenisKrosok) === normTarget &&
      (s.jenisProses.toUpperCase() === jalurUpper || s.jenisProses === 'Semua')
  );
  if (exact) return exact;

  // 2. Exact normalized name across any jalur
  const sameName = standarList.find(
    (s) =>
      s.jenisKrosok !== 'Semua / Umum' &&
      normalizeVariantName(s.jenisKrosok) === normTarget
  );
  if (sameName) return sameName;

  // 3. Substring fuzzy match for DHP naming differences
  const fuzzy = standarList.find((s) => {
    if (s.jenisKrosok === 'Semua / Umum') return false;
    const cand = normalizeVariantName(s.jenisKrosok);
    return (
      cand.length > 4 &&
      normTarget.length > 4 &&
      (cand.includes(normTarget) || normTarget.includes(cand))
    );
  });
  if (fuzzy) return fuzzy;

  // 4. Aggregate fallback
  const fallback = standarList.find((s) => s.jenisKrosok === 'Semua / Umum');
  if (fallback) return fallback;

  return {
    id: 'default_fallback',
    jenisKrosok: jenisKrosok || 'Umum',
    jenisProses: jalurProses || 'SKT',
    standarSusutPct: 0.08,
    toleransiWaspadaPct: 0.15,
    toleransiOosPct: 0.30,
    periodeAcuan: 'Standar Umum',
    totalBakuKg: 0,
    batchCount: 0,
    avgGagangPct: 0,
    avgDebuAirPct: 0,
    avgBatchBakuKg: 500,
    keterangan: 'Standar toleransi umum pengolahan krosok',
    updatedAt: new Date().toISOString().split('T')[0]
  };
}

/**
 * Core diagnostic engine tailored for Krosok mass-balance, batch capacity, weather, and Mandor tags
 */
export function diagnoseKrosokDeviation(params: {
  susutPct: number;
  acuanPct: number;
  waspadaPct: number;
  oosPct: number;
  gagangPct: number;
  debuPct: number;
  uapAirPct: number;
  bakuKg: number;
  avgBatchRefKg: number;
  jalurProses: string;
  humidity?: number;
  temperature?: number;
  tags?: string[];
}): {
  status: Exclude<DeviasiStatus, 'proses'>;
  faktorDominan: string;
  penjelasan: string;
} {
  const {
    susutPct,
    acuanPct,
    waspadaPct,
    oosPct,
    gagangPct,
    debuPct,
    uapAirPct,
    bakuKg,
    avgBatchRefKg,
    jalurProses,
    humidity,
    temperature,
    tags = []
  } = params;

  const delta = round2(susutPct - acuanPct);
  const absDelta = Math.abs(delta);

  let status: Exclude<DeviasiStatus, 'proses'> = 'normal';
  if (absDelta > oosPct) {
    status = 'oos';
  } else if (absDelta > waspadaPct) {
    status = 'waspada';
  }

  // If Mandor explicitly attached field tags, incorporate them into primary explanation
  const tagNote = tags.length > 0 ? ` [Tag Lapangan: ${tags.join(', ')}]` : '';

  if (status === 'normal') {
    return {
      status,
      faktorDominan:
        tags.length > 0 ? tags[0] : 'Terkendali Sesuai Acuan',
      penjelasan: `Susut riil ${susutPct.toFixed(2)}% berada dalam rentang toleransi wajar (±${waspadaPct.toFixed(2)}%) terhadap acuan ${acuanPct.toFixed(2)}%.${tagNote}`
    };
  }

  // Case A: Negative deviation (Actual shrinkage significantly LOWER / weight gain / moisture absorption)
  if (delta < 0) {
    if (humidity !== undefined && humidity >= 76) {
      return {
        status,
        faktorDominan: tags[0] || 'Serapan Kelembaban Udara (Higroskopis)',
        penjelasan: `Susut lebih rendah ${Math.abs(delta).toFixed(2)}% dari acuan (${susutPct.toFixed(2)}% vs ${acuanPct.toFixed(2)}%) seiring RH pabrik tinggi (${Math.round(humidity)}%) yang memicu serapan uap air pada daun krosok.${tagNote}`
      };
    }
    return {
      status,
      faktorDominan: tags[0] || 'Penambahan Kadar Air / Conditioning',
      penjelasan: `Susut berada ${Math.abs(delta).toFixed(2)}% di bawah acuan (${susutPct.toFixed(2)}% vs ${acuanPct.toFixed(2)}%), mengindikasikan penyerapan kelembaban/air (${Math.abs(uapAirPct).toFixed(2)}%) atau efisiensi rendemen tinggi.${tagNote}`
    };
  }

  // Case B: Positive deviation (Over-shrinkage: delta > 0)
  if (gagangPct >= 0.5 && gagangPct >= debuPct && gagangPct >= Math.abs(uapAirPct) * 0.6) {
    return {
      status,
      faktorDominan: tags[0] || 'Dominasi Fraksi Gagang Kasar',
      penjelasan: `Kenaikan susut +${delta.toFixed(2)}% dari acuan dipicu proporsi pemisahan gagang (${gagangPct.toFixed(2)}%) dari karakteristik anatomi tulang daun krosok.${tagNote}`
    };
  }

  if (debuPct >= 0.25 && debuPct >= gagangPct) {
    return {
      status,
      faktorDominan: tags[0] || 'Pelepasan Fraksi Debu / Daun Rapuh',
      penjelasan: `Fraksi debu tercatat ${debuPct.toFixed(2)}% menyebabkan deviasi +${delta.toFixed(2)}%; krosok cenderung kering/getas atau tarikan hisapan pemisah tinggi.${tagNote}`
    };
  }

  if (bakuKg > 0 && (bakuKg < 220 || (avgBatchRefKg > 350 && bakuKg < avgBatchRefKg * 0.45))) {
    return {
      status,
      faktorDominan: tags[0] || 'Efek Kapasitas Batch Kecil',
      penjelasan: `Volume olah kecil (${bakuKg.toFixed(1)} Kg dibanding rata-rata referensi ${avgBatchRefKg.toFixed(0)} Kg) membuat sisa tertahan mekanis di jalur ${jalurProses} menaikkan rasio % susut (+${delta.toFixed(2)}%).${tagNote}`
    };
  }

  if (temperature !== undefined && humidity !== undefined && (temperature >= 29.5 || humidity <= 60)) {
    return {
      status,
      faktorDominan: tags[0] || 'Penguapan Kadar Air & Cuaca Kering',
      penjelasan: `Deviasi +${delta.toFixed(2)}% didominasi penguapan kadar air (${uapAirPct.toFixed(2)}%) yang dipercepat suhu pabrik ${temperature.toFixed(1)}°C & RH ${Math.round(humidity)}%.${tagNote}`
    };
  }

  return {
    status,
    faktorDominan: tags[0] || 'Penguapan Kadar Air Awal / Perlakuan Proses',
    penjelasan: `Susut riil ${susutPct.toFixed(2)}% melampaui acuan ${acuanPct.toFixed(2)}% (Δ +${delta.toFixed(2)}%), didominasi pelepasan kadar air/uap sebesar ${uapAirPct.toFixed(2)}% pada jalur ${jalurProses}.${tagNote}`
  };
}

/**
 * Lapis 1 — Tactical evaluation for a single DHP Krosok batch
 */
export function evaluateDhpBatch(
  item: DhpKrosokItem,
  standarList: KrosokStandarAcuan[],
  batchNotes: Record<string, BatchFieldNote>,
  weatherData?: FactoryWeatherData | null
): TacticalBatchEvaluation {
  const variantName = item.jenisKrosokMaster || item.jenisTembakau;
  const standar = findStandarForVariant(variantName, item.jalurProses, standarList);
  const batchKey = makeBatchNoteKey(item.tanggal, variantName, item.baku);
  const note = batchNotes[batchKey];
  const tags = note?.tags || [];
  const catatan = note?.catatan || '';

  const weatherAtBatch = getBatchHourlyWeather(weatherData, item.tanggal, item.waktu);

  if (!item.hasil || item.hasil <= 0) {
    return {
      batchKey,
      status: 'proses',
      acuanPct: standar.standarSusutPct,
      toleransiWaspadaPct: standar.toleransiWaspadaPct,
      toleransiOosPct: standar.toleransiOosPct,
      periodeAcuan: standar.periodeAcuan,
      deviasiPct: 0,
      dampakKg: 0,
      gagangKg: item.gagangKg || 0,
      gagangPct: 0,
      debuKg: item.debuKg || 0,
      debuPct: 0,
      uapAirKg: 0,
      uapAirPct: 0,
      isSmallBatch: item.baku > 0 && item.baku < 220,
      avgBatchRefKg: standar.avgBatchBakuKg || 500,
      weatherAtBatch,
      tags,
      catatan,
      diagnosaUtama: 'Menunggu Penimbangan Hasil',
      penjelasanKilat:
        'Batch sedang dalam proses pengolahan. Perbandingan deviasi otomatis aktif setelah bobot Netto Hasil terinput di DHP.'
    };
  }

  const baku = item.baku || 0;
  const susutKg = round2(baku - item.hasil);
  const susutPct = baku > 0 ? round2((susutKg / baku) * 100) : 0;
  const gagangKg = round2(item.gagangKg || 0);
  const debuKg = round2(item.debuKg || 0);
  // Mass-balance moisture loss/gain = Total Susut - (Gagang + Debu)
  const uapAirKg = round2(susutKg - (gagangKg + debuKg));

  const gagangPct = baku > 0 ? round2((gagangKg / baku) * 100) : 0;
  const debuPct = baku > 0 ? round2((debuKg / baku) * 100) : 0;
  const uapAirPct = baku > 0 ? round2((uapAirKg / baku) * 100) : 0;

  const deviasiPct = round2(susutPct - standar.standarSusutPct);
  const dampakKg = round2((deviasiPct / 100) * baku);

  const diag = diagnoseKrosokDeviation({
    susutPct,
    acuanPct: standar.standarSusutPct,
    waspadaPct: standar.toleransiWaspadaPct,
    oosPct: standar.toleransiOosPct,
    gagangPct,
    debuPct,
    uapAirPct,
    bakuKg: baku,
    avgBatchRefKg: standar.avgBatchBakuKg || 500,
    jalurProses: item.jalurProses,
    humidity: weatherAtBatch?.humidity,
    temperature: weatherAtBatch?.temperature,
    tags
  });

  return {
    batchKey,
    status: diag.status,
    acuanPct: standar.standarSusutPct,
    toleransiWaspadaPct: standar.toleransiWaspadaPct,
    toleransiOosPct: standar.toleransiOosPct,
    periodeAcuan: standar.periodeAcuan,
    deviasiPct,
    dampakKg,
    gagangKg,
    gagangPct,
    debuKg,
    debuPct,
    uapAirKg,
    uapAirPct,
    isSmallBatch:
      baku > 0 &&
      (baku < 220 || (standar.avgBatchBakuKg > 350 && baku < standar.avgBatchBakuKg * 0.45)),
    avgBatchRefKg: standar.avgBatchBakuKg || 500,
    weatherAtBatch,
    tags,
    catatan,
    diagnosaUtama: diag.faktorDominan,
    penjelasanKilat: diag.penjelasan
  };
}

/**
 * Lapis 2 — Strategic monthly evaluation across all Krosok variants + Executive Summary Narrative
 */
export function computeEvaluasiBulananKrosok(params: {
  records: KrosokRecord[];
  bulanEvaluasi: string;
  tahunEvaluasi: string;
  jalurFilter: string;
  standarList: KrosokStandarAcuan[];
  baselineMeta: BaselineConfigMeta;
  batchNotes: Record<string, BatchFieldNote>;
  weatherData?: FactoryWeatherData | null;
}): MonthlyEvaluationSummary {
  const {
    records,
    bulanEvaluasi,
    tahunEvaluasi,
    jalurFilter,
    standarList,
    baselineMeta,
    batchNotes,
    weatherData
  } = params;

  const filtered = records.filter((r) => {
    const matchTahun =
      tahunEvaluasi === 'Semua' || String(r.tahun) === String(tahunEvaluasi);
    const matchBulan =
      bulanEvaluasi === 'Semua' ||
      String(r.bulan).toLowerCase() === String(bulanEvaluasi).toLowerCase();
    const matchJalur =
      jalurFilter === 'Semua' || String(r.jenisProses) === String(jalurFilter);
    return matchTahun && matchBulan && matchJalur && r.baku > 0 && r.hasil > 0;
  });

  if (filtered.length === 0) {
    return {
      bulan: bulanEvaluasi,
      tahun: tahunEvaluasi,
      jalurFilter,
      periodeAcuanLabel: baselineMeta.periodeLabel,
      totalBatch: 0,
      totalBakuKg: 0,
      totalHasilKg: 0,
      totalSusutKg: 0,
      susutRiilWeightedPct: 0,
      acuanWeightedPct: 0,
      deviasiAgregatPct: 0,
      dampakAgregatKg: 0,
      statusAgregat: 'normal',
      totalGagangKg: 0,
      totalDebuKg: 0,
      totalUapAirKg: 0,
      normalCount: 0,
      waspadaCount: 0,
      oosCount: 0,
      topTags: [],
      items: [],
      executiveNarrative: `Belum terdapat data transaksi pengolahan krosok untuk periode ${bulanEvaluasi} ${tahunEvaluasi}${jalurFilter !== 'Semua' ? ` (Jalur ${jalurFilter})` : ''}.`,
      rekomendasiManajerial: [
        'Pastikan transaksi DHP Krosok pada periode evaluasi telah diverifikasi dan disinkronkan ke Sheet Rekap.'
      ]
    };
  }

  const groupMap = new Map<
    string,
    {
      jenisKrosok: string;
      jenisProses: string;
      batchCount: number;
      bakuKg: number;
      hasilKg: number;
      susutKg: number;
      gagangKg: number;
      debuKg: number;
      tagCounts: Record<string, number>;
      catatanList: string[];
    }
  >();

  const globalTagCounts: Record<string, number> = {};

  filtered.forEach((r) => {
    const jalur = r.jenisProses || 'SKT';
    const key = `${r.jenisKrosok}|${jalur}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        jenisKrosok: r.jenisKrosok,
        jenisProses: jalur,
        batchCount: 0,
        bakuKg: 0,
        hasilKg: 0,
        susutKg: 0,
        gagangKg: 0,
        debuKg: 0,
        tagCounts: {},
        catatanList: []
      });
    }
    const g = groupMap.get(key)!;
    g.batchCount += 1;
    g.bakuKg += r.baku;
    g.hasilKg += r.hasil;
    g.susutKg += r.susutKg;
    g.gagangKg += r.gagangKg || 0;
    g.debuKg += r.debuKg || 0;

    // Match any field note attached to this batch
    const bKey = makeBatchNoteKey(r.tanggal, r.jenisKrosok, r.baku);
    const note = batchNotes[bKey];
    if (note) {
      note.tags.forEach((t) => {
        g.tagCounts[t] = (g.tagCounts[t] || 0) + 1;
        globalTagCounts[t] = (globalTagCounts[t] || 0) + 1;
      });
      if (note.catatan && !g.catatanList.includes(note.catatan)) {
        g.catatanList.push(note.catatan);
      }
    }
  });

  // Also check notes stored for the target evaluation month/year by variant name if synced via GAS
  Object.values(batchNotes).forEach((note) => {
    if (!note.tanggal) return;
    const parts = note.tanggal.split('-');
    if (parts.length < 2) return;
    const noteYear = parts[0];
    const noteMonth = MONTH_ORDER[parseInt(parts[1], 10) - 1] || '';
    const matchY = tahunEvaluasi === 'Semua' || noteYear === tahunEvaluasi;
    const matchM =
      bulanEvaluasi === 'Semua' ||
      noteMonth.toLowerCase() === bulanEvaluasi.toLowerCase();
    if (!matchY || !matchM) return;

    groupMap.forEach((g) => {
      if (
        normalizeVariantName(g.jenisKrosok) === normalizeVariantName(note.jenisKrosok) &&
        Object.keys(g.tagCounts).length === 0
      ) {
        note.tags.forEach((t) => {
          g.tagCounts[t] = (g.tagCounts[t] || 0) + 1;
          globalTagCounts[t] = (globalTagCounts[t] || 0) + 1;
        });
        if (note.catatan && !g.catatanList.includes(note.catatan)) {
          g.catatanList.push(note.catatan);
        }
      }
    });
  });

  let sumBaku = 0;
  let sumHasil = 0;
  let sumSusut = 0;
  let sumGagang = 0;
  let sumDebu = 0;
  let sumUapAir = 0;
  let weightedAcuanNumerator = 0;

  const items: MonthlyVariantEvaluation[] = [];

  groupMap.forEach((g, key) => {
    if (g.bakuKg <= 0) return;
    const susutPct = round2((g.susutKg / g.bakuKg) * 100);
    const gagangPct = round2((g.gagangKg / g.bakuKg) * 100);
    const debuPct = round2((g.debuKg / g.bakuKg) * 100);
    const uapAirKg = round2(g.susutKg - (g.gagangKg + g.debuKg));
    const uapAirPct = round2((uapAirKg / g.bakuKg) * 100);

    const standar = findStandarForVariant(
      g.jenisKrosok,
      g.jenisProses,
      standarList
    );
    const deviasiPct = round2(susutPct - standar.standarSusutPct);
    const dampakDeviasiKg = round2((deviasiPct / 100) * g.bakuKg);

    const tagsSummary = Object.entries(g.tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    const avgBatchInEval = g.bakuKg / Math.max(1, g.batchCount);

    const diag = diagnoseKrosokDeviation({
      susutPct,
      acuanPct: standar.standarSusutPct,
      waspadaPct: standar.toleransiWaspadaPct,
      oosPct: standar.toleransiOosPct,
      gagangPct,
      debuPct,
      uapAirPct,
      bakuKg: avgBatchInEval,
      avgBatchRefKg: standar.avgBatchBakuKg || 500,
      jalurProses: g.jenisProses,
      humidity: weatherData?.humidity,
      temperature: weatherData?.temperature,
      tags: tagsSummary.map((t) => t.tag)
    });

    items.push({
      key,
      jenisKrosok: g.jenisKrosok,
      jenisProses: g.jenisProses,
      batchCount: g.batchCount,
      bakuKg: round2(g.bakuKg),
      hasilKg: round2(g.hasilKg),
      susutKg: round2(g.susutKg),
      susutPct,
      standarAcuanPct: standar.standarSusutPct,
      toleransiWaspadaPct: standar.toleransiWaspadaPct,
      toleransiOosPct: standar.toleransiOosPct,
      deviasiPct,
      dampakDeviasiKg,
      status: diag.status,
      gagangKg: round2(g.gagangKg),
      gagangPct,
      debuKg: round2(g.debuKg),
      debuPct,
      uapAirKg,
      uapAirPct,
      tagsSummary,
      catatanList: g.catatanList,
      faktorDominan: diag.faktorDominan,
      penjelasan: diag.penjelasan
    });

    sumBaku += g.bakuKg;
    sumHasil += g.hasilKg;
    sumSusut += g.susutKg;
    sumGagang += g.gagangKg;
    sumDebu += g.debuKg;
    sumUapAir += uapAirKg;
    weightedAcuanNumerator += standar.standarSusutPct * g.bakuKg;
  });

  // Sort by largest absolute deviation magnitude so critical variants stand out first
  items.sort((a, b) => Math.abs(b.deviasiPct) - Math.abs(a.deviasiPct));

  const susutRiilWeightedPct = sumBaku > 0 ? round2((sumSusut / sumBaku) * 100) : 0;
  const acuanWeightedPct =
    sumBaku > 0 ? round2(weightedAcuanNumerator / sumBaku) : 0;
  const deviasiAgregatPct = round2(susutRiilWeightedPct - acuanWeightedPct);
  const dampakAgregatKg = round2((deviasiAgregatPct / 100) * sumBaku);

  let statusAgregat: Exclude<DeviasiStatus, 'proses'> = 'normal';
  if (Math.abs(deviasiAgregatPct) > baselineMeta.globalOosPct) {
    statusAgregat = 'oos';
  } else if (Math.abs(deviasiAgregatPct) > baselineMeta.globalWaspadaPct) {
    statusAgregat = 'waspada';
  }

  const normalCount = items.filter((i) => i.status === 'normal').length;
  const waspadaCount = items.filter((i) => i.status === 'waspada').length;
  const oosCount = items.filter((i) => i.status === 'oos').length;

  const topTags = Object.entries(globalTagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  // Build rich, data-grounded Executive Summary Narrative
  const periodeStr =
    bulanEvaluasi === 'Semua'
      ? `Tahun ${tahunEvaluasi}`
      : `bulan ${bulanEvaluasi} ${tahunEvaluasi}`;
  const signStr = deviasiAgregatPct >= 0 ? '+' : '';

  const overShrinkItems = [...items]
    .filter((i) => i.deviasiPct > 0)
    .sort((a, b) => b.deviasiPct - a.deviasiPct);
  const underShrinkItems = [...items]
    .filter((i) => i.deviasiPct < 0)
    .sort((a, b) => a.deviasiPct - b.deviasiPct);

  let narrative = `Pada ${periodeStr}, total volume krosok yang diolah mencapai ${formatIdNum(sumBaku)} Kg (${filtered.length} batch) dengan rata-rata susut riil tertimbang sebesar ${formatIdPct(susutRiilWeightedPct)}% (Deviasi ${signStr}${formatIdPct(deviasiAgregatPct)}% atau setara ${dampakAgregatKg >= 0 ? '+' : ''}${formatIdNum(dampakAgregatKg)} Kg terhadap acuan standar ${formatIdPct(acuanWeightedPct)}% periode ${baselineMeta.periodeLabel}). `;

  if (overShrinkItems.length > 0 && overShrinkItems[0].deviasiPct > baselineMeta.globalWaspadaPct) {
    const top1 = overShrinkItems[0];
    const top2 = overShrinkItems[1];
    narrative += `Penyumbang kenaikan susut terbesar adalah varian ${top1.jenisKrosok} (Riil ${formatIdPct(top1.susutPct)}% vs Acuan ${formatIdPct(top1.standarAcuanPct)}%, deviasi +${formatIdPct(top1.deviasiPct)}% / +${formatIdNum(top1.dampakDeviasiKg)} Kg)${
      top2 && top2.deviasiPct > baselineMeta.globalWaspadaPct
        ? ` diikuti ${top2.jenisKrosok} (+${formatIdPct(top2.deviasiPct)}%)`
        : ''
    }, yang terutama dipicu oleh ${top1.faktorDominan.toLowerCase()}. `;
  } else if (
    underShrinkItems.length > 0 &&
    Math.abs(underShrinkItems[0].deviasiPct) > baselineMeta.globalWaspadaPct
  ) {
    const low1 = underShrinkItems[0];
    narrative += `Deviasi negatif (pertambahan bobot/efisiensi rendemen) paling menonjol terjadi pada varian ${low1.jenisKrosok} (Riil ${formatIdPct(low1.susutPct)}% vs Acuan ${formatIdPct(low1.standarAcuanPct)}%, deviasi ${formatIdPct(low1.deviasiPct)}%) akibat ${low1.faktorDominan.toLowerCase()}. `;
  } else {
    narrative += `Secara keseluruhan, ${normalCount} dari ${items.length} varian krosok berjalan terkendali dalam koridor toleransi standar acuan. `;
  }

  if (topTags.length > 0) {
    const tagSummaryText = topTags
      .slice(0, 2)
      .map((t) => `"${t.tag}" (${t.count}x)`)
      .join(' dan ');
    narrative += `Berdasarkan pencatatan taktis lapangan oleh Mandor, faktor operasional yang tercatat meliputi ${tagSummaryText}. `;
  }

  if (weatherData) {
    narrative += `Integrasi mikroklimat lokasi pabrik ${weatherData.location.name} mencatat suhu aktual ${weatherData.temperature.toFixed(1)}°C dengan kelembaban udara (RH) ${Math.round(weatherData.humidity)}% (${weatherData.weatherDesc}; rata-rata RH 14 hari terakhir ${weatherData.avgHumidityLast14d}% dengan ${weatherData.rainyDaysLast14d} hari bercurah hujan) — dikategorikan "${weatherData.hygroIndex.status}".`;
  }

  // Build Managerial Recommendations (RTL)
  const rekomendasi: string[] = [];
  if (oosCount > 0) {
    const oosNames = items
      .filter((i) => i.status === 'oos')
      .slice(0, 3)
      .map((i) => i.jenisKrosok)
      .join(', ');
    rekomendasi.push(
      `Prioritaskan audit perlakuan proses & pengecekan kadar air awal (MC%) pada ${oosCount} varian berstatus OOS (${oosNames}).`
    );
  }
  if (
    underShrinkItems.some(
      (i) => i.susutPct <= -0.20 && Math.abs(i.deviasiPct) > i.toleransiWaspadaPct
    )
  ) {
    rekomendasi.push(
      'Kendalikan penyerapan kelembaban/penambahan spray air pada varian bersusut negatif tinggi guna mencegah over-moisture selama penyimpanan hasil krosok.'
    );
  }
  if (items.some((i) => i.bakuKg / Math.max(1, i.batchCount) < 220 && i.deviasiPct > 0.12)) {
    rekomendasi.push(
      'Konsolidasikan penjadwalan batch berkapasitas kecil (< 220 Kg) dan optimalkan prosedur line-clearance mesin untuk menekan persentase sisa tertahan.'
    );
  }
  if (weatherData) {
    rekomendasi.push(weatherData.hygroIndex.rekomendasiOperasional);
  }
  if (rekomendasi.length === 0) {
    rekomendasi.push(
      `Pertahankan parameter standar pengolahan periode ${baselineMeta.periodeLabel} dan lakukan evaluasi berkala menjelang penetapan acuan bulan berikutnya.`
    );
  }

  return {
    bulan: bulanEvaluasi,
    tahun: tahunEvaluasi,
    jalurFilter,
    periodeAcuanLabel: baselineMeta.periodeLabel,
    totalBatch: filtered.length,
    totalBakuKg: round2(sumBaku),
    totalHasilKg: round2(sumHasil),
    totalSusutKg: round2(sumSusut),
    susutRiilWeightedPct,
    acuanWeightedPct,
    deviasiAgregatPct,
    dampakAgregatKg,
    statusAgregat,
    totalGagangKg: round2(sumGagang),
    totalDebuKg: round2(sumDebu),
    totalUapAirKg: round2(sumUapAir),
    normalCount,
    waspadaCount,
    oosCount,
    topTags,
    items,
    executiveNarrative: narrative,
    rekomendasiManajerial: rekomendasi
  };
}

function formatIdNum(n: number): string {
  return Number(n || 0).toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function formatIdPct(n: number): string {
  return Number(n || 0).toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
