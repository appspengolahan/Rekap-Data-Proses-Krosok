import React, { useState, useRef, useEffect } from 'react';
import {
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Layers,
  Database,
  Shield,
  Menu
} from 'lucide-react';
import { UserRole, SyncStatus, SwitchAppModule } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  syncStatus: SyncStatus;
  autoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  onManualRefresh?: () => void;
  onOpenGasCenter: () => void;
  onOpenHelp: () => void;
  onToggleMobileMenu: () => void;
  selectedJenisProses: string;
  onJenisProsesChange: (proses: string) => void;
  entriTerkini: string | null;
  onExportPdf?: () => void;
  switchApps: SwitchAppModule[];
  onOpenSwitchAppTab: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  syncStatus,
  autoSyncEnabled,
  onToggleAutoSync,
  onOpenGasCenter,
  onOpenHelp,
  onToggleMobileMenu,
  selectedJenisProses,
  onJenisProsesChange,
  entriTerkini,
  switchApps,
  onOpenSwitchAppTab
}) => {
  const [switchOpen, setSwitchOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const switchRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) {
        setSwitchOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roles: UserRole[] = [
    'Project Manager',
    'Site Engineer',
    'Vendor',
    'Client',
    'Admin'
  ];

  return (
    <header className="no-print sticky top-0 z-40 bg-[#0b1329] text-white border-b border-slate-800/80 px-4 py-2.5 sm:px-6 shadow-md">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left Branding / Title with PP1 badge */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm tracking-tighter shadow-md shadow-amber-600/30">
              PP1
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                  Monitoring Board — Rekap Data Proses Krosok
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>PT Batu Karang</span>
                <span className="text-slate-600">·</span>
                <span>Divisi Produksi I</span>
                {entriTerkini && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-amber-400 font-semibold">📅 Entri: {entriTerkini}</span>
                  </>
                )}
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{syncStatus === 'syncing' ? 'Sinkron...' : 'Live Data'}</span>
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Right Actions matching Tembakau reference */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap ml-auto">
          {/* Jalur Filter Select */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-400 font-medium">Jalur:</span>
            <select
              value={selectedJenisProses}
              onChange={(e) => onJenisProsesChange(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="Semua" className="bg-slate-900 text-white">Semua Jalur</option>
              <option value="SKT" className="bg-slate-900 text-white">SKT (Tangan)</option>
              <option value="SKM" className="bg-slate-900 text-white">SKM (Mesin)</option>
            </select>
          </div>

          {/* Role Badge Dropdown */}
          <div className="relative" ref={roleRef}>
            <button
              onClick={() => setRoleOpen(!roleOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
              title="Ganti Role Hak Akses"
            >
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>{currentRole === 'Project Manager' ? 'PM: Lalu M.' : currentRole}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {roleOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Pilih Role Pengguna (RBAC)
                </div>
                {roles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      onRoleChange(role);
                      setRoleOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                      currentRole === role
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{role}</span>
                    {currentRole === role && (
                      <span className="w-2 h-2 rounded-full bg-white"></span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Headless GAS Center Trigger */}
          <button
            onClick={onOpenGasCenter}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            title="Pengaturan Headless GAS REST API"
          >
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden xl:inline">GAS Center</span>
          </button>

          {/* Switch App Menu */}
          <div className="relative" ref={switchRef}>
            <button
              onClick={() => setSwitchOpen(!switchOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-xs"
              title="Pindah ke Monitoring Board lain atau buka Switch App Board"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Switch App</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${switchOpen ? 'rotate-180' : ''}`} />
            </button>

            {switchOpen && (
              <div className="absolute right-0 mt-1.5 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-1 max-h-[80vh] overflow-y-auto">
                <div className="px-3 py-1 flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                  <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Switch App Board PP1
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-medium">
                    {switchApps.length} Modul
                  </span>
                </div>

                {/* Group by category */}
                {Array.from(new Set(switchApps.map((a) => a.category))).map((cat, catIdx) => {
                  const appsInCat = switchApps.filter((a) => a.category === cat);
                  return (
                    <div key={cat} className={catIdx > 0 ? 'mt-2 pt-2 border-t border-slate-800/80' : ''}>
                      <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        {cat}
                      </div>

                      {appsInCat.map((app) => {
                        if (app.isActive) {
                          return (
                            <div
                              key={app.id}
                              className="flex items-center gap-2 px-3 py-2 bg-emerald-950/40 text-emerald-300 font-bold text-xs border-l-2 border-emerald-500 my-0.5"
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                              <span className="truncate">{app.title}</span>
                              <span className="ml-auto text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-normal shrink-0">
                                Aktif
                              </span>
                            </div>
                          );
                        }

                        return (
                          <a
                            key={app.id}
                            href={app.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-colors group"
                            title={app.description || app.url}
                          >
                            <span className="truncate pr-2 group-hover:translate-x-0.5 transition-transform">
                              {app.title}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors shrink-0" />
                          </a>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Footer Link to open Switch App Tab in Sidebar / Content */}
                <div className="mt-2 pt-2 border-t border-slate-800 px-2">
                  <button
                    onClick={() => {
                      setSwitchOpen(false);
                      onOpenSwitchAppTab();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 transition-all"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Kelola & Buka Switch App Board</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Help Modal Trigger */}
          <button
            onClick={onOpenHelp}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-700 transition-colors"
            title="Bantuan & Petunjuk Penggunaan"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
