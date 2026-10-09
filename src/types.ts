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
  autoSyncEnabled: boolean;
  autoSyncIntervalSeconds: number;
  lastSyncTimestamp: number | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
