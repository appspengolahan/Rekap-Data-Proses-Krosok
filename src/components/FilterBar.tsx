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
  entriTerkini: string | null;
  lastUpdated: string;
  isSyncing: boolean;
  totalRecordsCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filterOptions,
  selectedTahun,
  onTahunChange,
  selectedJenisProses,
  onJenisProsesChange,
  onRefresh,
  onExportSummaryPdf,
  isSyncing
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left Filter Inputs */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Filter Global Icon & Label */}
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
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
              className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 cursor-pointer"
            >
              <option value="Semua">Semua Tahun</option>
              {filterOptions.tahun.map((t) => (
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
              className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 cursor-pointer"
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

        {/* Right Action Buttons matching Image 2 */}
        <div className="flex items-center gap-2.5 flex-wrap ml-auto">
          {/* Tarik Datasheet */}
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Tarik Datasheet</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Export Ringkasan PDF */}
          <button
            onClick={onExportSummaryPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Ringkasan (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
