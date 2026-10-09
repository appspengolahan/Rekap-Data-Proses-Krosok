import React, { useState } from 'react';
import { FileText, Calendar, Maximize2 } from 'lucide-react';
import { RekapGroup } from '../types';
import { formatNum, formatPct, getPctClass, MONTH_ORDER } from '../services/dataService';
import { InteractiveLineChart } from './charts/InteractiveLineChart';
import { DualBarChart } from './charts/DualBarChart';
import { ChartModal } from './ChartModal';

interface TabBulanProps {
  rekapBulan: RekapGroup[];
  onExportTabPdf: () => void;
}

export const TabBulan: React.FC<TabBulanProps> = ({ rekapBulan, onExportTabPdf }) => {
  // Modal state for maximized chart: 'line' | 'bar' | null
  const [maximizedChart, setMaximizedChart] = useState<'line' | 'bar' | null>(null);

  // Table rows sorted with newest month at top (terbaru paling atas, terlama paling bawah)
  const sortedTableBulan = [...rekapBulan].sort((a, b) => {
    const yearA = parseInt(a.tahun || '0', 10);
    const yearB = parseInt(b.tahun || '0', 10);
    if (yearA !== yearB) return yearB - yearA;
    return MONTH_ORDER.indexOf(b.bulan || '') - MONTH_ORDER.indexOf(a.bulan || '');
  });

  // Line chart data
  const lineChartData = rekapBulan.map((r) => ({
    label: r.label.replace(' ', '\n'),
    value: r.susutPct,
  }));

  // Dual bar chart data
  const dualBarData = rekapBulan.map((r) => ({
    label: r.label.substring(0, 3) + ' ' + (r.tahun?.substring(2) || ''),
    series1: r.baku,
    series2: r.hasil,
  }));

  // Totals for table
  const totalDataCount = rekapBulan.reduce((s, r) => s + r.jumlahData, 0);
  const totalBaku = rekapBulan.reduce((s, r) => s + r.baku, 0);
  const totalHasil = rekapBulan.reduce((s, r) => s + r.hasil, 0);
  const totalSusutKg = totalBaku - totalHasil;
  const totalSusutPct = totalBaku ? (totalSusutKg / totalBaku) * 100 : 0;
  const avgGagangPct = rekapBulan.length
    ? rekapBulan.reduce((s, r) => s + r.gagangPct, 0) / rekapBulan.length
    : 0;
  const avgDebuAirPct = rekapBulan.length
    ? rekapBulan.reduce((s, r) => s + r.debuAirPct, 0) / rekapBulan.length
    : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Sub-filter & Export Action */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Calendar className="w-4 h-4 text-blue-600" />
          <span>Analisis Rekapitulasi Tren Bulanan ({rekapBulan.length} Bulan Terdata)</span>
        </div>
        <button
          onClick={onExportTabPdf}
          className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
        >
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>Export Tab Ini (PDF)</span>
        </button>
      </div>

      {/* Visual Analytics Grid with Expandable Cards matching reference screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Tren Susut Line Chart */}
        <div
          onClick={() => setMaximizedChart('line')}
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

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMaximizedChart('line');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Perbesar</span>
              </button>
            </div>

            <InteractiveLineChart
              data={lineChartData}
              color="#2563eb"
              unit="%"
              height={260}
              showDataLabels={true}
            />
          </div>

          {/* Footer Callout matching reference Image 3 */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Maximize2 className="w-3 h-3" />
              <span>Klik kartu ini untuk perbesar ke tengah layar</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold group-hover:bg-blue-100 group-hover:text-blue-700">
              Maximize
            </span>
          </div>
        </div>

        {/* Card 2: Dual Bar Baku vs Hasil */}
        <div
          onClick={() => setMaximizedChart('bar')}
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

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMaximizedChart('bar');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Perbesar</span>
                </button>
              </div>
            </div>

            <DualBarChart
              data={dualBarData}
              label1="Bahan Baku"
              label2="Hasil Bersih"
              height={260}
              showDataLabels={true}
            />
          </div>

          {/* Footer Callout matching reference Image 3 */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-blue-600 transition-colors">
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Maximize2 className="w-3 h-3" />
              <span>Klik kartu ini untuk perbesar ke tengah layar</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold group-hover:bg-blue-100 group-hover:text-blue-700">
              Maximize
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Table Rekap per Bulan */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Tabel Rekapitulasi per Bulan</h3>
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
                    Tidak ada data untuk filter bulan/tahun ini.
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
            {rekapBulan.length > 0 && (
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
        subtitle="Visualisasi grafik skala penuh ke tengah layar untuk evaluasi presisi"
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
        subtitle="Visualisasi skala penuh perbandingan kuantitas netto baku dan hasil bersih"
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
