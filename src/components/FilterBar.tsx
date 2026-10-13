import React from 'react';
import { Filter, FileSpreadsheet, RefreshCw, FileText } from 'lucide-react';
import { FilterOptions } from '../types';

interface FilterBarProps {
  filterOptions: FilterOptions;
  selectedTahun: string;
  onTahunChange: (tahun: string) => void;
  selectedJenisProses: string;
  onJenisProsesChange: (proses: string) => void;
  onRefresh: () => void;
  onExportSummaryPdf: () => void;
  entriTerkini?: string | null;
  lastUpdated?: string;
  isSyncing: boolean;
  totalRecordsCount?: number;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filterOptions,
  selectedTahun,
  onTahunChange,
  selectedJenisProses,
  onJenisProsesChange,
  onRefresh,
  onExportSummaryPdf,
  isSyncing,
  autoSyncEnabled,
  onToggleAutoSync
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:px-4 sm:py-3 mb-5 transition-all">
      <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        {/* Left Filter Inputs */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
          {/* Filter Global Icon & Label */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-100/90 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
            <Filter className="w-3.5 h-3.5 text-blue-600" />
            <span>Filter Global:</span>
          </div>

          {/* Dropdown Tahun */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filterTahun" className="text-xs font-medium text-slate-600">
              Tahun:
            </label>
            <select
              id="filterTahun"
              value={selectedTahun}
              onChange={(e) => onTahunChange(e.target.value)}
              className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 cursor-pointer shadow-2xs"
            >
              <option value="2026">2026 (Tahun Berjalan)</option>
              <option value="2025">2025</option>
              <option value="Semua">Semua Tahun</option>
              {filterOptions.tahun
                .filter((t) => t !== '2026' && t !== '2025')
                .map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>

          {/* Dropdown Jalur (SKT & SKM) */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="filterJenisProses" className="text-xs font-medium text-slate-600">
              Jalur:
            </label>
            <select
              id="filterJenisProses"
              value={selectedJenisProses}
              onChange={(e) => onJenisProsesChange(e.target.value)}
              className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 cursor-pointer shadow-2xs"
            >
              <option value="Semua">Semua Jalur (SKT & SKM)</option>
              {filterOptions.jenisProses.map((jp) => (
                <option key={jp} value={jp}>
                  {jp === 'SKT'
                    ? 'SKT (Sigaret Kretek Tangan)'
                    : jp === 'SKM'
                    ? 'SKM (Sigaret Kretek Mesin)'
                    : jp}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Action Buttons: Sejajar / Horizontal dengan Filter Global */}
        <div className="no-print flex items-center gap-2 sm:gap-2.5 flex-wrap ml-auto">
          {/* Tarik Datasheet Button */}
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
            title="Tarik pembaruan datasheet terbaru dari spreadsheet Google Apps Script"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Tarik Datasheet</span>
          </button>

          {/* Toggle Horizontal Auto Tarik Datasheet */}
          {onToggleAutoSync && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 transition-colors">
              <button
                type="button"
                onClick={onToggleAutoSync}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 ${
                  autoSyncEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={autoSyncEnabled}
                title={autoSyncEnabled ? 'Auto Tarik Datasheet Aktif (otomatis sinkron berkala)' : 'Auto Tarik Datasheet Nonaktif'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    autoSyncEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-[11px] font-semibold text-slate-700 select-none whitespace-nowrap">
                Auto Tarik{' '}
                {autoSyncEnabled ? (
                  <span className="text-emerald-700 font-bold">(On)</span>
                ) : (
                  <span className="text-slate-400 font-normal">(Off)</span>
                )}
              </span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 disabled:opacity-50 cursor-pointer"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Export Ringkasan PDF */}
          <button
            onClick={onExportSummaryPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer"
            title="Export ringkasan dashboard ke format PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Ringkasan (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
