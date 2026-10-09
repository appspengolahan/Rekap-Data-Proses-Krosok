import React, { useState, useRef, useEffect } from 'react';
import {
  RotateCw,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  Layers,
  Database,
  Shield,
  Menu,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { UserRole, SyncStatus } from '../types';

interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  syncStatus: SyncStatus;
  autoSyncEnabled: boolean;
  onToggleAutoSync: () => void;
  onManualRefresh: () => void;
  onOpenGasCenter: () => void;
  onOpenHelp: () => void;
  onToggleMobileMenu: () => void;
  selectedJenisProses: string;
  onJenisProsesChange: (proses: string) => void;
  entriTerkini: string | null;
  onExportPdf: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  syncStatus,
  autoSyncEnabled,
  onToggleAutoSync,
  onManualRefresh,
  onOpenGasCenter,
  onOpenHelp,
  onToggleMobileMenu,
  selectedJenisProses,
  onJenisProsesChange,
  entriTerkini,
  onExportPdf
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

          {/* Tarik Datasheet (green button) */}
          <button
            onClick={onManualRefresh}
            disabled={syncStatus === 'syncing'}
            title="Tarik data terbaru dari Spreadsheet"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tarik Datasheet</span>
          </button>

          {/* Refresh Icon Button with spin */}
          <button
            onClick={onManualRefresh}
            disabled={syncStatus === 'syncing'}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Export PDF Button */}
          <button
            onClick={onExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold shadow-sm transition-all"
            title="Export ke PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>

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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
              title="Pindah ke Monitoring Board lain"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Switch App</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {switchOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Monitoring Board Terkait
                </div>

                <div className="flex items-center gap-2 px-3 py-2 bg-blue-600/30 text-blue-300 font-bold text-xs border-l-2 border-blue-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Rekap Susut Krosok</span>
                  <span className="ml-auto text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-normal">
                    Aktif
                  </span>
                </div>

                <a
                  href="https://rekap-data-proses-blend-pro-api-eng.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span>Rekap Susut Blend</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                <a
                  href="https://rekap-data-proses-cengkeh-pro-api-l.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span>Rekap Susut Cengkeh</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                <a
                  href="https://rekap-dataproses-tembakau-pro.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span>Rekap Susut Tembakau</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>

                <div className="my-1 border-t border-slate-800"></div>

                <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Sistem Gudang & Logistik
                </div>

                <a
                  href="https://script.google.com/macros/s/AKfycbywAsu-wvbBxWwl2P9YojeZgR13U3BR9cS8THDCGE9EMINUXIIcR1HjoAK59W1Aqm1lYQ/exec"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <span>Monitoring Stock Persediaan PP1</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
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
