import React, { useState, useMemo } from 'react';
import { FileText, Calendar, Maximize2, RotateCcw, Filter, CheckCircle2 } from 'lucide-react';
import { KrosokRecord, RekapGroup } from '../types';
import {
  formatNum,
  formatPct,
  getPctClass,
  MONTH_ORDER,
  computeRekapBulan
} from '../services/dataService';
import { InteractiveLineChart } from './charts/InteractiveLineChart';
import { DualBarChart } from './charts/DualBarChart';
import { ChartModal } from './ChartModal';

interface TabBulanProps {
  records: KrosokRecord[];
  selectedTahun: string;
  onTahunChange: (tahun: string) => void;
  selectedJenisProses: string;
  availableYears?: string[];
  rekapBulan?: RekapGroup[];
  onExportTabPdf: () => void;
}

export const TabBulan: React.FC<TabBulanProps> = ({
  records,
  selectedTahun,
  onTahunChange,
  selectedJenisProses,
  availableYears,
  onExportTabPdf
}) => {
  // Modal state for maximized chart: 'line' | 'bar' | null
  const [maximizedChart, setMaximizedChart] = useState<'line' | 'bar' | null>(null);

  // Filter Panel States for Tab Rekap per Bulan (Default: Januari – Oktober 2026)
  const [bulanAwal, setBulanAwal] = useState<string>('Januari');
  const [bulanAkhir, setBulanAkhir] = useState<string>('Oktober');

  // Instant Reset to Default: Januari – Oktober 2026
  const handleResetDefault = () => {
    setBulanAwal('Januari');
    setBulanAkhir('Oktober');
    onTahunChange('2026');
  };

  // Synchronized computation of monthly recap based on selected period
  const activeRekapBulan = useMemo(() => {
    return computeRekapBulan(
      records,
      selectedTahun,
      selectedJenisProses,
      bulanAwal,
      bulanAkhir
    );
  }, [records, selectedTahun, selectedJenisProses, bulanAwal, bulanAkhir]);

  // Table rows sorted with newest month at top (terbaru paling atas, terlama paling bawah)
  const sortedTableBulan = useMemo(() => {
    return [...activeRekapBulan].sort((a, b) => {
      const yearA = parseInt(a.tahun || '0', 10);
      const yearB = parseInt(b.tahun || '0', 10);
      if (yearA !== yearB) return yearB - yearA;
      return MONTH_ORDER.indexOf(b.bulan || '') - MONTH_ORDER.indexOf(a.bulan || '');
    });
  }, [activeRekapBulan]);

  // Line chart data (chronological timeline)
  const lineChartData = useMemo(() => {
    return activeRekapBulan.map((r) => ({
      label: r.label.replace(' ', '\n'),
      value: r.susutPct,
    }));
  }, [activeRekapBulan]);

  // Dual bar chart data (chronological timeline)
  const dualBarData = useMemo(() => {
    return activeRekapBulan.map((r) => ({
      label: r.label.substring(0, 3) + ' ' + (r.tahun?.substring(2) || ''),
      series1: r.baku,
      series2: r.hasil,
    }));
  }, [activeRekapBulan]);

  // Totals for table and KPI overview
  const totalDataCount = activeRekapBulan.reduce((s, r) => s + r.jumlahData, 0);
  const totalBaku = activeRekapBulan.reduce((s, r) => s + r.baku, 0);
  const totalHasil = activeRekapBulan.reduce((s, r) => s + r.hasil, 0);
  const totalSusutKg = totalBaku - totalHasil;
  const totalSusutPct = totalBaku ? (totalSusutKg / totalBaku) * 100 : 0;
  const avgGagangPct = activeRekapBulan.length
    ? activeRekapBulan.reduce((s, r) => s + r.gagangPct, 0) / activeRekapBulan.length
    : 0;
  const avgDebuAirPct = activeRekapBulan.length
    ? activeRekapBulan.reduce((s, r) => s + r.debuAirPct, 0) / activeRekapBulan.length
    : 0;

  // Years list for dropdown options
  const yearOptions = useMemo(() => {
    const list = availableYears ? [...availableYears] : ['2026', '2025'];
    if (!list.includes('2026')) list.unshift('2026');
    if (!list.includes('2025')) list.push('2025');
    // Ensure 2026 is at top, then 2025
    return Array.from(new Set(list)).sort((a, b) => b.localeCompare(a));
  }, [availableYears]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Panel Kontrol Filter Periode */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Panel Kontrol Filter Periode — Rekap per Bulan
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sesuaikan rentang bulan awal, bulan akhir, dan tahun untuk sinkronisasi otomatis seluruh grafik & tabel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportTabPdf}
              className="no-print inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Tab Ini (PDF)</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="bg-slate-50/80 rounded-2xl border border-slate-200/80 p-3 sm:p-4 flex items-center justify-between gap-3.5 flex-wrap">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            {/* Bulan Awal */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filterBulanAwal" className="text-xs font-semibold text-slate-600">
                Bulan Awal:
              </label>
              <select
                id="filterBulanAwal"
                value={bulanAwal}
                onChange={(e) => setBulanAwal(e.target.value)}
                className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 cursor-pointer shadow-2xs"
              >
                {MONTH_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs font-bold text-slate-400">s/d</span>

            {/* Bulan Akhir */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filterBulanAkhir" className="text-xs font-semibold text-slate-600">
                Bulan Akhir:
              </label>
              <select
                id="filterBulanAkhir"
                value={bulanAkhir}
                onChange={(e) => setBulanAkhir(e.target.value)}
                className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 cursor-pointer shadow-2xs"
              >
                {MONTH_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown Tahun */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="filterTahunBulan" className="text-xs font-semibold text-slate-600">
                Tahun:
              </label>
              <select
                id="filterTahunBulan"
                value={selectedTahun}
                onChange={(e) => onTahunChange(e.target.value)}
                className="text-xs font-bold bg-white hover:bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 cursor-pointer shadow-2xs"
              >
                <option value="2026">2026 (Tahun Berjalan)</option>
                <option value="2025">2025</option>
                <option value="Semua">Semua Tahun</option>
                {yearOptions
                  .filter((y) => y !== '2026' && y !== '2025')
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>

            {/* Tombol Reset Default (2026) */}
            <button
              onClick={handleResetDefault}
              className="no-print inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer ml-1"
              title="Kembalikan seluruh filter ke periode tahun berjalan: Januari – Oktober 2026"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default (2026)</span>
            </button>
          </div>

          {/* Active Status Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Periode: {bulanAwal} – {bulanAkhir} {selectedTahun === 'Semua' ? '(Semua Tahun)' : selectedTahun}
              </span>
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200/80 text-slate-700">
              {activeRekapBulan.length} Bulan ({totalDataCount.toLocaleString('id-ID')} Batch)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Visual Analytics Grid: Grafik Tren Susut & Perbandingan Baku vs Hasil */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Tren Susut Line Chart */}
        <div
          onClick={() => {
            if (activeRekapBulan.length > 0) setMaximizedChart('line');
          }}
          className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            {/* Header with Title, Badge, and Perbesar Button */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Tren Susut Rata-rata (%) per Bulan
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  Total Susut (%)
                </span>
              </div>

              {activeRekapBulan.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMaximizedChart('line');
                  }}
                  className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Perbesar</span>
                </button>
              )}
            </div>

            {activeRekapBulan.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <Calendar className="w-8 h-8 mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">Tidak ada data untuk periode terpilih</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ({bulanAwal} – {bulanAkhir} {selectedTahun})
                </p>
              </div>
            ) : (
              <InteractiveLineChart
                data={lineChartData}
                color="#2563eb"
                unit="%"
                height={260}
                showDataLabels={true}
              />
            )}
          </div>

          {/* Footer Callout */}
          {activeRekapBulan.length > 0 && (
            <div className="no-print mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
              <span className="flex items-center gap-1 text-[11px] font-medium">
                <Maximize2 className="w-3 h-3" />
                <span>Klik kartu ini untuk perbesar ke tengah layar</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold group-hover:bg-blue-100 group-hover:text-blue-700">
                Maximize
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Dual Bar Baku vs Hasil */}
        <div
          onClick={() => {
            if (activeRekapBulan.length > 0) setMaximizedChart('bar');
          }}
          className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            {/* Header with Title, Badge, and Perbesar Button */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Perbandingan Bahan Baku vs Hasil per Bulan (Kg)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-xs font-medium mr-1">
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded bg-blue-600"></span>
                    <span>Baku</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-600"></span>
                    <span>Hasil</span>
                  </span>
                </div>

                {activeRekapBulan.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMaximizedChart('bar');
                    }}
                    className="no-print inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Perbesar</span>
                  </button>
                )}
              </div>
            </div>

            {activeRekapBulan.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-slate-400 text-xs bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <Calendar className="w-8 h-8 mb-2 text-slate-300" />
                <p className="font-semibold text-slate-600">Tidak ada data untuk periode terpilih</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ({bulanAwal} – {bulanAkhir} {selectedTahun})
                </p>
              </div>
            ) : (
              <DualBarChart
                data={dualBarData}
                label1="Bahan Baku"
                label2="Hasil Bersih"
                height={260}
                showDataLabels={true}
              />
            )}
          </div>

          {/* Footer Callout */}
          {activeRekapBulan.length > 0 && (
            <div className="no-print mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
              <span className="flex items-center gap-1 text-[11px] font-medium">
                <Maximize2 className="w-3 h-3" />
                <span>Klik kartu ini untuk perbesar ke tengah layar</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold group-hover:bg-blue-100 group-hover:text-blue-700">
                Maximize
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Card 3: Table Rekap per Bulan */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Tabel Rekapitulasi per Bulan ({activeRekapBulan.length} Periode Bulan)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rincian kuantitas, rasio kesusutan, fraksi gagang, dan susut air/debu
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Nilai hijau: ≤ 4.0% · Merah: ≥ 10.0%
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10.5px] tracking-wider">
                <th className="py-3 px-4 text-left">Bulan</th>
                <th className="py-3 px-3 text-right">Jumlah Data</th>
                <th className="py-3 px-3 text-right">Baku (Kg)</th>
                <th className="py-3 px-3 text-right">Hasil (Kg)</th>
                <th className="py-3 px-3 text-right">Susut (%)</th>
                <th className="py-3 px-3 text-right">Gagang (%)</th>
                <th className="py-3 px-3 text-right">Air+Debu (%)</th>
                <th className="py-3 px-3 text-right">Min (%)</th>
                <th className="py-3 px-4 text-right">Max (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedTableBulan.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Tidak ditemukan data proses pada periode {bulanAwal} – {bulanAkhir} {selectedTahun}. Silakan sesuaikan filter periode di atas atau klik tombol <strong>Reset Default (2026)</strong>.
                  </td>
                </tr>
              ) : (
                sortedTableBulan.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>{r.label}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium">
                      {r.jumlahData.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                      {formatNum(r.baku)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-800">
                      {formatNum(r.hasil)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${getPctClass(r.susutPct)}`}>
                      {formatPct(r.susutPct)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                      {formatPct(r.gagangPct)}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                      {formatPct(r.debuAirPct)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {formatPct(r.minPct)}%
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">
                      {formatPct(r.maxPct)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {activeRekapBulan.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3 px-4">TOTAL / RATA-RATA</td>
                  <td className="py-3 px-3 text-right">
                    {totalDataCount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-3 text-right">{formatNum(totalBaku)}</td>
                  <td className="py-3 px-3 text-right text-emerald-900">{formatNum(totalHasil)}</td>
                  <td className={`py-3 px-3 text-right ${getPctClass(totalSusutPct)}`}>
                    {formatPct(totalSusutPct)}%
                  </td>
                  <td className="py-3 px-3 text-right">{formatPct(avgGagangPct)}%</td>
                  <td className="py-3 px-3 text-right">{formatPct(avgDebuAirPct)}%</td>
                  <td className="py-3 px-3 text-right text-slate-500">-</td>
                  <td className="py-3 px-4 text-right text-slate-500">-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Maximized Modal for Line Chart */}
      <ChartModal
        isOpen={maximizedChart === 'line'}
        onClose={() => setMaximizedChart(null)}
        title="Tren Susut Rata-rata (%) per Bulan"
        subtitle={`Visualisasi skala penuh periode ${bulanAwal} – ${bulanAkhir} ${selectedTahun}`}
        badge="Total Susut (%)"
      >
        <InteractiveLineChart
          data={lineChartData}
          color="#2563eb"
          unit="%"
          height={440}
          showDataLabels={true}
        />
      </ChartModal>

      {/* Maximized Modal for Bar Chart */}
      <ChartModal
        isOpen={maximizedChart === 'bar'}
        onClose={() => setMaximizedChart(null)}
        title="Perbandingan Bahan Baku vs Hasil per Bulan (Kg)"
        subtitle={`Visualisasi skala penuh periode ${bulanAwal} – ${bulanAkhir} ${selectedTahun}`}
        badge="Baku vs Hasil"
      >
        <DualBarChart
          data={dualBarData}
          label1="Bahan Baku"
          label2="Hasil Bersih"
          height={440}
          showDataLabels={true}
        />
      </ChartModal>
    </div>
  );
};
