import React from 'react';
import {
  LayoutGrid,
  Calendar,
  Layers,
  FileSpreadsheet,
  PlusCircle,
  Database,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { UserRole } from '../types';

export type NavTab = 'overview' | 'bulan' | 'jenis' | 'data_log' | 'new_entry';

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentRole: UserRole;
  onOpenGasCenter: () => void;
  onOpenHelp: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
  currentRole,
  onOpenGasCenter,
  onOpenHelp,
  isOpenMobile,
  onCloseMobile
}) => {
  const canAddEntry = currentRole === 'Admin' || currentRole === 'Site Engineer';

  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'Dashboard Data Krosok',
      desc: 'Tahunan & Bulanan',
      icon: LayoutGrid,
      badge: 'Utama'
    },
    {
      id: 'bulan' as NavTab,
      label: 'Rekap per Bulan',
      desc: 'Tren & Tabel Bulanan',
      icon: Calendar
    },
    {
      id: 'jenis' as NavTab,
      label: 'Rekap Jenis Krosok',
      desc: 'Varian & Kapasitas',
      icon: Layers
    },
    {
      id: 'data_log' as NavTab,
      label: 'Log Data Mentah',
      desc: 'Semua Transaksi',
      icon: FileSpreadsheet
    },
  ];

  const handleNavClick = (tab: NavTab) => {
    onTabChange(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container matching Image 2 */}
      <aside
        className={`no-print fixed md:static top-0 h-full z-50 md:z-30 flex flex-col shrink-0 bg-[#0b1329] text-slate-200 border-r border-slate-800 transition-all duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'w-18' : 'w-64'}`}
      >
        {/* Toggle Collapse Button on top (as in Image 2) */}
        <div className="pt-3 px-3 flex items-center justify-between border-b border-slate-800/60 pb-3">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-blue-500/20">
                🌿
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs tracking-wider text-white uppercase">
                  Menu Utama
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate">
                  Proses Krosok
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <button
                onClick={onToggleCollapse}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-xs"
                title="Buka Sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Tutup Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <div className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={collapsed ? item.label : undefined}
                className={`flex items-center transition-all ${
                  collapsed
                    ? `w-11 h-11 mx-auto rounded-xl justify-center ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`
                    : `w-full gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                      }`
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform ${
                    isActive ? 'scale-105 text-white' : 'text-slate-400'
                  }`}
                />
                {!collapsed && (
                  <div className="text-left flex-1 min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div
                      className={`text-[10px] font-normal truncate ${
                        isActive ? 'text-blue-100' : 'text-slate-500'
                      }`}
                    >
                      {item.desc}
                    </div>
                  </div>
                )}
                {!collapsed && item.badge && !isActive && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Action: Add New Entry (Admin / Site Engineer only) */}
          {canAddEntry && (
            <button
              onClick={() => handleNavClick('new_entry')}
              title={collapsed ? 'Entri Data Baru' : undefined}
              className={`flex items-center transition-all ${
                collapsed
                  ? `w-11 h-11 mx-auto rounded-xl justify-center ${
                      activeTab === 'new_entry'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'text-emerald-400 hover:text-white hover:bg-emerald-950/40 border border-emerald-900/50'
                    }`
                  : `w-full gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold mt-2 ${
                      activeTab === 'new_entry'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : 'text-emerald-400 hover:text-white hover:bg-emerald-950/40 border border-emerald-900/40'
                    }`
              }`}
            >
              <PlusCircle className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <div className="text-left flex-1 min-w-0">
                  <div className="truncate">Entri Data Baru</div>
                  <div className="text-[10px] text-emerald-300/80 font-normal truncate">
                    Input Proses Krosok
                  </div>
                </div>
              )}
            </button>
          )}

          {/* Secondary Tools Section */}
          <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1.5">
            <button
              onClick={() => {
                onOpenGasCenter();
                onCloseMobile();
              }}
              title={collapsed ? 'Headless GAS Center' : undefined}
              className={`flex items-center transition-colors ${
                collapsed
                  ? 'w-11 h-11 mx-auto rounded-xl justify-center text-slate-400 hover:text-white hover:bg-slate-800/80'
                  : 'w-full gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`}
            >
              <Database className="w-5 h-5 text-indigo-400 shrink-0" />
              {!collapsed && (
                <div className="text-left flex-1 min-w-0">
                  <div className="truncate">Headless GAS Center</div>
                  <div className="text-[10px] text-slate-500 truncate">REST API & Testing</div>
                </div>
              )}
            </button>

            <button
              onClick={() => {
                onOpenHelp();
                onCloseMobile();
              }}
              title={collapsed ? 'Petunjuk & Bantuan' : undefined}
              className={`flex items-center transition-colors ${
                collapsed
                  ? 'w-11 h-11 mx-auto rounded-xl justify-center text-slate-400 hover:text-white hover:bg-slate-800/80'
                  : 'w-full gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`}
            >
              <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
              {!collapsed && (
                <div className="text-left flex-1 min-w-0">
                  <div className="truncate">Bantuan & Rumus</div>
                  <div className="text-[10px] text-slate-500 truncate">Petunjuk Kerja</div>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Footer Role Card when expanded */}
        {!collapsed && (
          <div className="p-3 border-t border-slate-800/80">
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="truncate">{currentRole}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {currentRole === 'Admin' && 'Akses Penuh + Edit Script'}
                {currentRole === 'Site Engineer' && 'Akses Teknik & Entri Data'}
                {currentRole === 'Project Manager' && 'Monitoring KPI & Target'}
                {currentRole === 'Vendor' && 'Pelacakan Pengiriman Lot'}
                {currentRole === 'Client' && 'Verifikasi Mutu & Laporan'}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
