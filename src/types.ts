export type UserRole = 'Project Manager' | 'Site Engineer' | 'Vendor' | 'Client' | 'Admin';

export interface KrosokRecord {
  srcRow: number;
  tanggal: string; // yyyy-MM-dd
  tanggalDisplay: string; // e.g. 12 Nov 2025
  bulan: string; // e.g. November
  tahun: string; // e.g. 2025
  jenisPerlakuan?: string;
  jenisKrosok: string; // e.g. Zambia M1L (2023)
  jenisProses: 'SKT' | 'SKM' | string;
  baku: number; // Netto Baku (Kg)
  hasil: number; // Netto Hasil (Kg)
  susutKg: number; // Baku - Hasil (Kg)
  susutPct: number; // (SusutKg / Baku) * 100
  gagangKg: number;
  gagangPct: number;
  airKg: number;
  debuKg: number;
  debuAirKg: number;
  debuAirPct: number;
}

export interface RingkasanData {
  jumlahData: number;
  baku: number;
  hasil: number;
  susutKg: number;
  susutPct: number;
  susutMinPct: number;
  susutMaxPct: number;
  gagangPct: number;
  debuAirPct: number;
  periodeLabel: string;
}

export interface RekapGroup {
  label: string;
  bulan?: string;
  tahun?: string;
  jumlahData: number;
  baku: number;
  hasil: number;
  susutKg: number;
  susutPct: number;
  minPct: number;
  maxPct: number;
  gagangPct: number;
  debuAirPct: number;
  kapasitasPct: number;
}

export interface TrendJenisData {
  jenisKrosok: string;
  data: RekapGroup[];
}

export interface FilterOptions {
  tahun: string[];
  bulan: string[];
  jenisKrosok: string[];
  jenisProses: string[];
}

export interface DashboardData {
  filterOptions: FilterOptions;
  entriTerkini: string | null;
  lastUpdated: string;
  ringkasanTahunan: RingkasanData;
  ringkasanBulanan: RingkasanData;
  ringkasanPeriode: RingkasanData;
  rekapBulan: RekapGroup[];
  rekapJenisKrosokPeriode: RekapGroup[];
  trendJenis: TrendJenisData;
}

export interface GASConfig {
  gasUrl: string;
  spreadsheetId: string;
  sheetName: string;
  dhpSpreadsheetId: string;
  dhpSheetName: string;
  autoSyncEnabled: boolean;
  autoSyncIntervalSeconds: number;
  lastSyncTimestamp: number | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface DhpKrosokItem {
  id: string;
  rowIdx: number;
  tanggal: string; // YYYY-MM-DD
  tanggalDisplay: string; // e.g. Senin, 19 Oktober 2026
  bulan: string;
  tahun: string;
  jenisTembakau: string;
  jenisKrosokMaster?: string;
  kodeStock?: string;
  waktu?: string;
  baku: number;
  hasil: number;
  gagangKg: number;
  airKg?: number;
  debuKg: number;
  susutKg: number;
  susutPct: number;
  jalurProses: 'SKT' | 'SKM' | string;
  isMatchedInRekap: boolean;
  matchedRow?: number;
  needsUpdateInRekap?: boolean;
  rekapHasil?: number;
}

export interface RekapRawDateRow {
  srcRow: number;
  tanggal: string; // YYYY-MM-DD
  tanggalDisplay: string;
  jenisKrosok: string;
  jenisProses: string;
  baku: number;
  hasil: number;
}

export interface ActiveDateRealizationAudit {
  activeIsoDate: string;
  activeDateDisplay: string;
  dhpActiveCount: number;
  rekapTotalOnDate: number;
  emptyTemplateRows: RekapRawDateRow[];
  cancelledPlanRows: RekapRawDateRow[];
  protectedOrphanRows: RekapRawDateRow[];
  purgeableRows: RekapRawDateRow[];
}

export interface SwitchAppModule {
  id: string;
  title: string;
  url: string;
  category: string;
  description?: string;
  isActive?: boolean;
  isCustom?: boolean;
  color?: string;
  updatedAt?: string;
}

export type DeviasiStatus = 'normal' | 'waspada' | 'oos' | 'proses';

export interface KrosokStandarAcuan {
  id: string;
  jenisKrosok: string;
  jenisProses: 'SKT' | 'SKM' | 'Semua' | string;
  standarSusutPct: number;
  toleransiWaspadaPct: number;
  toleransiOosPct: number;
  periodeAcuan: string;
  totalBakuKg: number;
  batchCount: number;
  avgGagangPct: number;
  avgDebuAirPct: number;
  avgBatchBakuKg: number;
  keterangan: string;
  updatedAt: string;
  isManualOverride?: boolean;
}

export interface BaselineConfigMeta {
  bulanMulai: string;
  bulanAkhir: string;
  tahunAcuan: string;
  bulanBerlaku: string;
  tahunBerlaku: string;
  globalWaspadaPct: number;
  globalOosPct: number;
  periodeLabel: string;
  berlakuLabel: string;
  appliedAt: string;
}

export interface BatchFieldNote {
  batchKey: string;
  tanggal: string;
  jenisKrosok: string;
  jalurProses: string;
  tags: string[];
  catatan: string;
  updatedAt: string;
}

export interface FactoryLocation {
  id: string;
  name: string;
  region: string;
  address: string;
  lat: number;
  lon: number;
  elevationM?: number;
  isDefault?: boolean;
}

export interface HygroAnalysis {
  status: 'Panas Ekstrem' | 'Kering & Panas' | 'Lembab / Hujan' | 'Optimal';
  potensiPenguapan: 'Tinggi' | 'Normal' | 'Rendah';
  resikoDebu: 'Tinggi' | 'Normal' | 'Rendah';
  analisisKorelasi: string;
  rekomendasiOperasional: string;
}

export interface HourlyWeatherPoint {
  timeIso: string; // e.g. 2026-10-20T14:00
  temperature: number;
  humidity: number;
  weatherCode: number;
  precipitation: number;
  weatherDesc: string;
}

export interface FactoryWeatherData {
  location: FactoryLocation;
  temperature: number;
  humidity: number;
  weatherCode: number;
  weatherDesc: string;
  windSpeed: number;
  precipitation: number;
  isDay: boolean;
  fetchedAt: string;
  hygroIndex: HygroAnalysis;
  hourly: HourlyWeatherPoint[];
  rainyDaysLast14d: number;
  avgHumidityLast14d: number;
  avgTempLast14d: number;
}

export interface TacticalBatchEvaluation {
  batchKey: string;
  status: DeviasiStatus;
  acuanPct: number;
  toleransiWaspadaPct: number;
  toleransiOosPct: number;
  periodeAcuan: string;
  deviasiPct: number;
  dampakKg: number;
  gagangKg: number;
  gagangPct: number;
  debuKg: number;
  debuPct: number;
  uapAirKg: number;
  uapAirPct: number;
  isSmallBatch: boolean;
  avgBatchRefKg: number;
  weatherAtBatch: HourlyWeatherPoint | null;
  tags: string[];
  catatan: string;
  diagnosaUtama: string;
  penjelasanKilat: string;
}

export interface MonthlyVariantEvaluation {
  key: string;
  jenisKrosok: string;
  jenisProses: string;
  batchCount: number;
  bakuKg: number;
  hasilKg: number;
  susutKg: number;
  susutPct: number;
  standarAcuanPct: number;
  toleransiWaspadaPct: number;
  toleransiOosPct: number;
  deviasiPct: number;
  dampakDeviasiKg: number;
  status: Exclude<DeviasiStatus, 'proses'>;
  gagangKg: number;
  gagangPct: number;
  debuKg: number;
  debuPct: number;
  uapAirKg: number;
  uapAirPct: number;
  tagsSummary: { tag: string; count: number }[];
  catatanList: string[];
  faktorDominan: string;
  penjelasan: string;
}

export interface ExecutiveSignatories {
  dibuatNama: string;
  dibuatJabatan: string;
  diperiksaNama: string;
  diperiksaJabatan: string;
  disetujuiNama: string;
  disetujuiJabatan: string;
  nomorDokumen: string;
  catatanTambahan: string;
}

export interface MonthlyEvaluationSummary {
  bulan: string;
  tahun: string;
  jalurFilter: string;
  periodeAcuanLabel: string;
  totalBatch: number;
  totalBakuKg: number;
  totalHasilKg: number;
  totalSusutKg: number;
  susutRiilWeightedPct: number;
  acuanWeightedPct: number;
  deviasiAgregatPct: number;
  dampakAgregatKg: number;
  statusAgregat: Exclude<DeviasiStatus, 'proses'>;
  totalGagangKg: number;
  totalDebuKg: number;
  totalUapAirKg: number;
  normalCount: number;
  waspadaCount: number;
  oosCount: number;
  topTags: { tag: string; count: number }[];
  items: MonthlyVariantEvaluation[];
  executiveNarrative: string;
  rekomendasiManajerial: string[];
}
