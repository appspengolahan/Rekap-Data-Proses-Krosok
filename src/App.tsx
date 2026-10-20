import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  KrosokRecord,
  DashboardData,
  GASConfig,
  UserRole,
  SyncStatus,
  SwitchAppModule,
  DhpKrosokItem
} from './types';
import {
  getCachedRecords,
  setCachedRecords,
  loadConfig,
  saveConfig,
  fetchFromGviz,
  fetchFromGAS,
  fetchDhpKrosokRecords,
  getCachedDhpItems,
  setCachedDhpItems,
  buildDashboardData,
  MONTH_ORDER
} from './services/dataService';
import { loadSwitchApps, saveSwitchApps } from './data/switchAppDefault';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { QuickTabNav } from './components/QuickTabNav';
import { FilterBar } from './components/FilterBar';
import { SummaryCards } from './components/SummaryCards';
import { TabBulan } from './components/TabBulan';
import { TabJenis } from './components/TabJenis';
import { DataLogView } from './components/DataLogView';
import { TabSwitchApp } from './components/TabSwitchApp';
import { GasCenterModal } from './components/GasCenterModal';
import { ModalDhpIntegrasi } from './components/ModalDhpIntegrasi';
import { NewEntryModal } from './components/NewEntryModal';
import { HelpModal } from './components/HelpModal';

export default function App() {
  // 1. Initial State from Cache (Loads in 0.01s)
  const [records, setRecords] = useState<KrosokRecord[]>(() => getCachedRecords());
  const [config, setConfig] = useState<GASConfig>(() => loadConfig());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    return (localStorage.getItem('krosok_user_role_v1') as UserRole) || 'Project Manager';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('krosok_sidebar_collapsed_v1') === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active Main Navigation Tab
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  // Filter States (Default active year: 2026)
  const [selectedTahun, setSelectedTahun] = useState<string>('2026');
  const [selectedJenisProses, setSelectedJenisProses] = useState<string>('Semua');
  const [bulanRingkasan, setBulanRingkasan] = useState<string>('Semua');

  // Period Range (Default: Last 3 months ending in current data month)
  const [periodeAwal, setPeriodeAwal] = useState({ bulan: 'Agustus', tahun: '2026' });
  const [periodeAkhir, setPeriodeAkhir] = useState({ bulan: 'Oktober', tahun: '2026' });

  // Selected Jenis Krosok for Trend Graph
  const [selectedTrendJenis, setSelectedTrendJenis] = useState<string>('Zambia M1L (2023)');

  // Modals
  const [isGasCenterOpen, setIsGasCenterOpen] = useState(false);
  const [isDhpModalOpen, setIsDhpModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);

  // DHP Krosok Items State
  const [dhpItems, setDhpItems] = useState<DhpKrosokItem[]>(() => getCachedDhpItems());

  // Switch App Modules State (Synchronized across Header dropdown, Sidebar, and Tab Hub)
  const [switchApps, setSwitchApps] = useState<SwitchAppModule[]>(() => loadSwitchApps());

  const handleUpdateSwitchApps = (newApps: SwitchAppModule[]) => {
    setSwitchApps(newApps);
    saveSwitchApps(newApps);
  };

  // Refresh DHP Krosok records from Sheet DHP Krosok
  const refreshDhpData = useCallback(async () => {
    try {
      const items = await fetchDhpKrosokRecords(
        config.dhpSpreadsheetId,
        config.dhpSheetName,
        records
      );
      if (items && items.length > 0) {
        setDhpItems(items);
        setCachedDhpItems(items);
      }
    } catch (e) {
      console.warn('DHP sync notice:', e);
    }
  }, [config.dhpSpreadsheetId, config.dhpSheetName, records]);

  // Save Role change to localStorage
  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem('krosok_user_role_v1', role);
  };

  // Toggle Sidebar Collapse
  const handleToggleCollapse = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('krosok_sidebar_collapsed_v1', String(next));
  };

  // Append new records from DHP into local Rekap data
  const handleAppendRecordsToRekap = (newRecords: KrosokRecord[]) => {
    setRecords((prev) => {
      const existingKeys = new Set(
        prev.map((r) => `${r.tanggal}_${r.jenisKrosok.toLowerCase()}_${r.baku.toFixed(1)}`)
      );
      const toAdd = newRecords.filter(
        (nr) => !existingKeys.has(`${nr.tanggal}_${nr.jenisKrosok.toLowerCase()}_${nr.baku.toFixed(1)}`)
      );
      const updated = [...prev, ...toAdd];
      setCachedRecords(updated);
      return updated;
    });

    setDhpItems((prev) =>
      prev.map((item) => ({
        ...item,
        isMatchedInRekap: true
      }))
    );
  };

  // Sync Logic (Silent Background or Manual)
  const performSync = useCallback(async (isManual: boolean = false) => {
    setSyncStatus('syncing');
    try {
      let freshData: KrosokRecord[] = await fetchFromGviz(config.spreadsheetId, config.sheetName);

      // If Gviz didn't return data, try GAS fallback if configured
      if ((!freshData || freshData.length === 0) && config.gasUrl) {
        freshData = await fetchFromGAS(config.gasUrl);
      }

      if (freshData && freshData.length > 0) {
        setRecords(freshData);
        setCachedRecords(freshData);
        const updatedConfig = { ...config, lastSyncTimestamp: Date.now() };
        setConfig(updatedConfig);
        saveConfig(updatedConfig);
        setSyncStatus('synced');
      } else {
        // Retain existing records smoothly
        setSyncStatus('idle');
      }

      // Concurrently refresh DHP active items
      refreshDhpData();
    } catch (err) {
      console.warn('Sync notice (using cached/offline data):', err);
      setSyncStatus('idle');
    } finally {
      setTimeout(() => {
        setSyncStatus((prev) => (prev === 'syncing' ? 'idle' : prev));
      }, 2000);
    }
  }, [config, refreshDhpData]);

  // Initial Background Sync on App Mount
  useEffect(() => {
    // Initial silent sync after 300ms to let initial UI paint instantly
    const timer = setTimeout(() => {
      performSync(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [performSync]);

  // AutoSync Background Timer Interval
  useEffect(() => {
    if (!config.autoSyncEnabled) return;
    const intervalMs = (config.autoSyncIntervalSeconds || 60) * 1000;
    const interval = setInterval(() => {
      performSync(false);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [config.autoSyncEnabled, config.autoSyncIntervalSeconds, performSync]);

  // Build complete Dashboard Data locally (Zero Latency)
  const dashboardData: DashboardData = useMemo(() => {
    return buildDashboardData(
      records,
      selectedTahun,
      bulanRingkasan,
      selectedJenisProses,
      periodeAwal,
      periodeAkhir,
      selectedTrendJenis
    );
  }, [
    records,
    selectedTahun,
    bulanRingkasan,
    selectedJenisProses,
    periodeAwal,
    periodeAkhir,
    selectedTrendJenis
  ]);

  // Adjust default selected trend variant if needed
  useEffect(() => {
    if (
      dashboardData.filterOptions.jenisKrosok.length > 0 &&
      !dashboardData.filterOptions.jenisKrosok.includes(selectedTrendJenis)
    ) {
      setSelectedTrendJenis(dashboardData.filterOptions.jenisKrosok[0]);
    }
  }, [dashboardData.filterOptions.jenisKrosok, selectedTrendJenis]);

  // Handle New Record Entry
  const handleAddRecord = (newRec: KrosokRecord) => {
    const updated = [newRec, ...records];
    setRecords(updated);
    setCachedRecords(updated);
  };

  // Save GAS Config
  const handleSaveConfig = (newCfg: GASConfig) => {
    setConfig(newCfg);
    saveConfig(newCfg);
  };

  // Toggle AutoSync
  const handleToggleAutoSync = () => {
    const next = !config.autoSyncEnabled;
    const newCfg = { ...config, autoSyncEnabled: next };
    setConfig(newCfg);
    saveConfig(newCfg);
  };

  // PDF Print Handlers
  const handleExportSummaryPdf = () => {
    document.body.classList.add('print-summary-only');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-summary-only');
    }, 1000);
  };

  const handleExportTabPdf = () => {
    document.body.classList.add('print-tab-only');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-tab-only');
    }, 1000);
  };

  const scrollToPeriodePicker = () => {
    const el = document.getElementById('periodeCardAnchor');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans antialiased overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        syncStatus={syncStatus}
        autoSyncEnabled={config.autoSyncEnabled}
        onToggleAutoSync={handleToggleAutoSync}
        onOpenGasCenter={() => setIsGasCenterOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
        selectedJenisProses={selectedJenisProses}
        onJenisProsesChange={setSelectedJenisProses}
        entriTerkini={dashboardData.entriTerkini}
        switchApps={switchApps}
        onOpenSwitchAppTab={() => setActiveTab('switch_app')}
        onOpenDhpIntegrasi={() => setIsDhpModalOpen(true)}
        dhpCount={dhpItems.length}
      />

      <div className="flex-1 flex w-full min-h-0 overflow-hidden">
        {/* Collapsible Sidebar (Locked in place) */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            if (tab === 'new_entry') {
              setIsNewEntryOpen(true);
            } else {
              setActiveTab(tab);
            }
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          currentRole={currentRole}
          onOpenGasCenter={() => setIsGasCenterOpen(true)}
          onOpenDhpIntegrasi={() => setIsDhpModalOpen(true)}
          dhpCount={dhpItems.length}
          onOpenHelp={() => setIsHelpOpen(true)}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          switchAppsCount={switchApps.length}
        />

        {/* Main Content Area (Independent scroll) */}
        <main className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-5 lg:p-6 pb-24 md:pb-10">
          {/* Global Filter Bar (Shown on dashboard data tabs) */}
          {activeTab !== 'switch_app' && (
            <FilterBar
              filterOptions={dashboardData.filterOptions}
              selectedTahun={selectedTahun}
              onTahunChange={setSelectedTahun}
              selectedJenisProses={selectedJenisProses}
              onJenisProsesChange={setSelectedJenisProses}
              onRefresh={() => performSync(true)}
              onExportSummaryPdf={handleExportSummaryPdf}
              entriTerkini={dashboardData.entriTerkini}
              lastUpdated={dashboardData.lastUpdated}
              isSyncing={syncStatus === 'syncing'}
              totalRecordsCount={records.length}
              autoSyncEnabled={config.autoSyncEnabled}
              onToggleAutoSync={handleToggleAutoSync}
            />
          )}

          {/* Tab Content Rendering */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="summary-cards-section">
                <SummaryCards
                  ringkasanTahunan={dashboardData.ringkasanTahunan}
                  ringkasanBulanan={dashboardData.ringkasanBulanan}
                  ringkasanPeriode={dashboardData.ringkasanPeriode}
                  filterOptions={dashboardData.filterOptions}
                  bulanRingkasan={bulanRingkasan}
                  onBulanRingkasanChange={setBulanRingkasan}
                  selectedTahun={selectedTahun}
                  onTahunChange={setSelectedTahun}
                  periodeAwal={periodeAwal}
                  periodeAkhir={periodeAkhir}
                  onPeriodeAwalChange={setPeriodeAwal}
                  onPeriodeAkhirChange={setPeriodeAkhir}
                  onApplyPeriode={() => {}}
                  onNavigateToJenisTab={() => setActiveTab('jenis')}
                />
              </div>

              {/* In Overview Mode, show Bulan Tab as primary detailed section */}
              <div className="tab-detail-section">
                <TabBulan
                  records={records}
                  selectedTahun={selectedTahun}
                  onTahunChange={setSelectedTahun}
                  selectedJenisProses={selectedJenisProses}
                  availableYears={dashboardData.filterOptions.tahun}
                  rekapBulan={dashboardData.rekapBulan}
                  onExportTabPdf={handleExportTabPdf}
                />
              </div>
            </div>
          )}

          {activeTab === 'bulan' && (
            <div className="tab-detail-section">
              <TabBulan
                records={records}
                selectedTahun={selectedTahun}
                onTahunChange={setSelectedTahun}
                selectedJenisProses={selectedJenisProses}
                availableYears={dashboardData.filterOptions.tahun}
                rekapBulan={dashboardData.rekapBulan}
                onExportTabPdf={handleExportTabPdf}
              />
            </div>
          )}

          {activeTab === 'jenis' && (
            <div className="space-y-6">
              {/* Top Summary Cards to allow period range tweaking */}
              <div className="summary-cards-section">
                <SummaryCards
                  ringkasanTahunan={dashboardData.ringkasanTahunan}
                  ringkasanBulanan={dashboardData.ringkasanBulanan}
                  ringkasanPeriode={dashboardData.ringkasanPeriode}
                  filterOptions={dashboardData.filterOptions}
                  bulanRingkasan={bulanRingkasan}
                  onBulanRingkasanChange={setBulanRingkasan}
                  selectedTahun={selectedTahun}
                  onTahunChange={setSelectedTahun}
                  periodeAwal={periodeAwal}
                  periodeAkhir={periodeAkhir}
                  onPeriodeAwalChange={setPeriodeAwal}
                  onPeriodeAkhirChange={setPeriodeAkhir}
                  onApplyPeriode={() => {}}
                  onNavigateToJenisTab={() => {}}
                />
              </div>

              <div className="tab-detail-section">
                <TabJenis
                  rekapJenisPeriode={dashboardData.rekapJenisKrosokPeriode}
                  trendJenis={dashboardData.trendJenis}
                  filterOptions={dashboardData.filterOptions}
                  selectedJenisKrosok={selectedTrendJenis}
                  onJenisKrosokChange={setSelectedTrendJenis}
                  periodeLabel={dashboardData.ringkasanPeriode.periodeLabel}
                  onExportTabPdf={handleExportTabPdf}
                  onScrollToPeriodePicker={scrollToPeriodePicker}
                />
              </div>
            </div>
          )}

          {activeTab === 'data_log' && <DataLogView records={records} dhpItems={dhpItems} />}

          {activeTab === 'switch_app' && (
            <TabSwitchApp
              switchApps={switchApps}
              onUpdateApps={handleUpdateSwitchApps}
            />
          )}

          {/* Footer inside scrollable content */}
          <footer className="no-print border-t border-slate-200/80 bg-white/70 py-4 text-center text-xs text-slate-500 mt-10 rounded-2xl">
            Monitoring Board — Rekap Data Proses Krosok All Rights Reserved · Divisi Produksi I · Developed by Lalu Mahendra
          </footer>
        </main>
      </div>

      {/* Quick Tab Nav for Mobile & Tablet */}
      <QuickTabNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'new_entry') {
            setIsNewEntryOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        currentRole={currentRole}
      />

      {/* Modals */}
      <GasCenterModal
        isOpen={isGasCenterOpen}
        onClose={() => setIsGasCenterOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onTriggerSync={() => performSync(true)}
      />

      <ModalDhpIntegrasi
        isOpen={isDhpModalOpen}
        onClose={() => setIsDhpModalOpen(false)}
        config={config}
        dhpItems={dhpItems}
        onRefreshDhp={refreshDhpData}
        onAppendRecordsToRekap={handleAppendRecordsToRekap}
      />

      <NewEntryModal
        isOpen={isNewEntryOpen}
        onClose={() => setIsNewEntryOpen(false)}
        onAddRecord={handleAddRecord}
        filterOptions={dashboardData.filterOptions}
        gasUrl={config.gasUrl}
      />

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
