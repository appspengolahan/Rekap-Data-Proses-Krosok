import { SwitchAppModule } from '../types';

export function getCurrentKrosokOriginUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/`;
  }
  return 'https://rekap-proses-krosok.workers.dev/';
}

export const DEFAULT_SWITCH_APPS: SwitchAppModule[] = [
  {
    id: 'krosok',
    title: 'Rekap Proses Krosok',
    url: getCurrentKrosokOriginUrl(),
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

let _switchAppsRaw: string | null | undefined = undefined;
let _switchAppsVal: SwitchAppModule[] | null = null;

export function loadSwitchApps(): SwitchAppModule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (_switchAppsVal && raw === _switchAppsRaw) {
      return _switchAppsVal;
    }
    _switchAppsRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const currentOrigin = getCurrentKrosokOriginUrl();
        let mutated = false;
        const healed = parsed.map((item: SwitchAppModule) => {
          if (item.id === 'krosok' && item.url && item.url.includes('.vercel.app')) {
            mutated = true;
            return { ...item, url: currentOrigin };
          }
          return item;
        });
        if (mutated) {
          const healedRaw = JSON.stringify(healed);
          localStorage.setItem(STORAGE_KEY, healedRaw);
          _switchAppsRaw = healedRaw;
        }
        _switchAppsVal = healed;
        return healed;
      }
    }
  } catch (err) {
    console.error('Failed to load switch apps from localStorage', err);
  }
  _switchAppsVal = DEFAULT_SWITCH_APPS;
  return DEFAULT_SWITCH_APPS;
}

export function saveSwitchApps(apps: SwitchAppModule[]): void {
  _switchAppsVal = apps;
  try {
    const raw = JSON.stringify(apps);
    localStorage.setItem(STORAGE_KEY, raw);
    _switchAppsRaw = raw;
  } catch (err) {
    console.error('Failed to save switch apps to localStorage', err);
  }
}
