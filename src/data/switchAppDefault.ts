import { SwitchAppModule } from '../types';

export const DEFAULT_SWITCH_APPS: SwitchAppModule[] = [
  {
    id: 'krosok',
    title: 'Rekap Proses Krosok',
    url: 'https://rekap-data-krosok-api-phi.vercel.app/',
    category: 'Monitoring Board Proses PP1',
    description: 'Dashboard Analitik & Rekap Susut Krosok Harian/Bulanan',
    isActive: true,
    color: 'emerald'
  },
  {
    id: 'cengkeh',
    title: 'Rekap Proses Cengkeh',
    url: 'https://rekap-data-proses-cengkeh-pro-api-l.vercel.app/',
    category: 'Monitoring Board Proses PP1',
    description: 'Monitoring & Rekap Data Proses Produksi Cengkeh',
    isActive: false,
    color: 'amber'
  },
  {
    id: 'tembakau',
    title: 'Rekap Proses Tembakau',
    url: 'https://rekap-dataproses-tembakau-pro.vercel.app/',
    category: 'Monitoring Board Proses PP1',
    description: 'Monitoring & Rekap Data Proses Produksi Tembakau',
    isActive: false,
    color: 'rose'
  },
  {
    id: 'blend',
    title: 'Rekap Proses Blend',
    url: 'https://rekap-data-proses-blend-pro-api-eng.vercel.app/',
    category: 'Monitoring Board Proses PP1',
    description: 'Monitoring & Rekap Data Proses Formula Blending',
    isActive: false,
    color: 'indigo'
  },
  {
    id: 'stock_pp1',
    title: 'Monitoring Stock Persediaan PP1',
    url: 'https://monitoring-stock-pp-1-pro-api.vercel.app/',
    category: 'Sistem Gudang & Logistik',
    description: 'Informasi Real-Time Stock & Mutasi Bahan Baku PP1',
    isActive: false,
    color: 'blue'
  }
];

const STORAGE_KEY = 'krosok_switch_apps_v2';

export function loadSwitchApps(): SwitchAppModule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load switch apps from localStorage', err);
  }
  return DEFAULT_SWITCH_APPS;
}

export function saveSwitchApps(apps: SwitchAppModule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  } catch (err) {
    console.error('Failed to save switch apps to localStorage', err);
  }
}
