import React, { useState } from 'react';
import { Layers, FileText, TrendingUp, Search, Maximize2 } from 'lucide-react';
import { RekapGroup, TrendJenisData, FilterOptions } from '../types';
import { formatNum, formatPct, getPctClass } from '../services/dataService';
import { InteractiveLineChart } from './charts/InteractiveLineChart';
import { ChartModal } from './ChartModal';

interface TabJenisProps {
  rekapJenisPeriode: RekapGroup[];
  trendJenis: TrendJenisData;
  filterOptions: FilterOptions;
  selectedJenisKrosok: string;
  onJenisKrosokChange: (jenis: string) => void;
  periodeLabel: string;
  onExportTabPdf: () => void;
  onScrollToPeriodePicker: () => void;
}

export const TabJenis: React.FC<TabJenisProps> = ({
  rekapJenisPeriode,
  trendJenis,
  filterOptions,
  selectedJenisKrosok,
  onJenisKrosokChange,
  periodeLabel,
  onExportTabPdf,
  onScrollToPeriodePicker
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  // Modal state for maximized chart: 'trend' | 'comparison' | null
  const [maximizedChart, setMaximizedChart] = useState<'trend' | 'comparison' | null>(null);

  // Trend line chart data
  const trendLineData = trendJenis.data.map((r) => ({
    label: r.label,
    value: r.susutPct,
  }));

  // Filtered table rows
  const filteredList = rekapJenisPeriode.filter((r) =>
    r.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Totals
  const totalBaku = rekapJenisPeriode.reduce((s, r) => s + r.baku, 0);
  const totalHasil = rekapJenisPeriode.reduce((s, r) => s + r.hasil, 0);
  const totalCount = rekapJenisPeriode.reduce((s, r) => s + r.jumlahData, 0);
  const totalSusutKg = totalBaku - totalHasil;
  const totalSusutPct = totalBaku ? (totalSusutKg / totalBaku) * 100 : 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Sub-filter & Period Info */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            Periode: {periodeLabel || 'Semua'}
          </span>
          <button
            onClick={onScrollToPeriodePicker}
            className="no-print text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline ml-1"
          >
            <span>⚙️ Atur rentang periode di atas ↑</span>
          </button>
        </div>

        <button
          onClick={onExportTabPdf}
          className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 ml-auto"
        >
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>Export Tab Ini (PDF)</span>
        </button>
      </div>

      {/* Visual Analytics Grid with Expandable Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Trend Line Chart for Selected Krosok Variant */}
        <div
          onClick={() => setMaximizedChart('trend')}
          className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Trend Kesusutan per Jenis Krosok</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Riwayat bulanan varian {trendJenis.jenisKrosok}
                </p>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <select
                  value={selectedJenisKrosok}
                  onChange={(e) => onJenisKrosokChange(e.target.value)}
                  className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1 max-w-[190px] truncate focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {filterOptions.jenisKrosok.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setMaximizedChart('trend')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Perbesar</span>
                </button>
              </div>
            </div>

            <InteractiveLineChart
              data={trendLineData}
              color="#059669"
              unit="%"
              height={260}
              showDataLabels={true}
            />
          </div>

          {/* Footer Callout matching reference Image 3 */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-emerald-700 transition-colors">
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Maximize2 className="w-3 h-3" />
              <span>Klik kartu ini untuk perbesar ke tengah layar</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold group-hover:bg-emerald-100 group-hover:text-emerald-800">
              Maximize
            </span>
          </div>
        </div>

        {/* Card 2: Top Variants Susut (%) Comparison */}
        <div
          onClick={() => setMaximizedChart('comparison')}
          className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Perbandingan Susut Rata-rata (%) Antar Varian</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Varian volume terbesar pada periode aktif ({rekapJenisPeriode.slice(0, 8).length} teratas)
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMaximizedChart('comparison');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Perbesar</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {rekapJenisPeriode.slice(0, 8).map((item, idx) => (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    onJenisKrosokChange(item.label);
                  }}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    selectedJenisKrosok === item.label
                      ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-400'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-800 truncate max-w-[240px]">
                      {item.label}
                    </span>
                    <span className={`font-bold ${getPctClass(item.susutPct)}`}>
                      {formatPct(item.susutPct)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.susutPct >= 10
                          ? 'bg-rose-500'
                          : item.susutPct <= 4
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(5, (item.susutPct / 15) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                    <span>Baku: {formatNum(item.baku)} Kg</span>
                    <span>Kapasitas: {formatPct(item.kapasitasPct)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Callout matching reference Image 3 */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 group-hover:text-indigo-600 transition-colors">
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Maximize2 className="w-3 h-3" />
              <span>Klik kartu ini untuk perbesar ke tengah layar</span>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold group-hover:bg-indigo-100 group-hover:text-indigo-700">
              Maximize
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Table Rekap per Jenis Krosok */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Tabel Rekap per Jenis Krosok ({filteredList.length} Varian)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Diurutkan otomatis dari volume Bahan Baku terbesar
            </p>
          </div>

          {/* Table Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari varian krosok..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none w-52"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10.5px] tracking-wider">
                <th className="py-3 px-4 text-left">Jenis Krosok</th>
                <th className="py-3 px-3 text-right">Jumlah Data</th>
                <th className="py-3 px-3 text-right">Baku (Kg)</th>
                <th className="py-3 px-3 text-right">Hasil (Kg)</th>
                <th className="py-3 px-3 text-right">Susut (%)</th>
                <th className="py-3 px-3 text-right">Gagang (%)</th>
                <th className="py-3 px-3 text-right">Air+Debu (%)</th>
                <th className="py-3 px-4 text-right">Kapasitas (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Tidak ditemukan jenis krosok dengan kata kunci tersebut.
                  </td>
                </tr>
              ) : (
                filteredList.map((r, idx) => (
                  <tr
                    key={idx}
                    onClick={() => onJenisKrosokChange(r.label)}
                    className={`cursor-pointer transition-colors ${
                      selectedJenisKrosok === r.label
                        ? 'bg-blue-50/60 font-semibold'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{r.label}</span>
                      {selectedJenisKrosok === r.label && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                          Dipilih
                        </span>
                      )}
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
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-semibold text-slate-900">
                          {formatPct(r.kapasitasPct)}%
                        </span>
                        <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full"
                            style={{ width: `${Math.min(100, r.kapasitasPct)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td className="py-3 px-4">TOTAL KESELURUHAN</td>
                  <td className="py-3 px-3 text-right">
                    {totalCount.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-3 text-right">{formatNum(totalBaku)}</td>
                  <td className="py-3 px-3 text-right text-emerald-900">{formatNum(totalHasil)}</td>
                  <td className={`py-3 px-3 text-right ${getPctClass(totalSusutPct)}`}>
                    {formatPct(totalSusutPct)}%
                  </td>
                  <td className="py-3 px-3 text-right">-</td>
                  <td className="py-3 px-3 text-right">-</td>
                  <td className="py-3 px-4 text-right">100.00%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Maximized Modal for Trend Jenis Line Chart */}
      <ChartModal
        isOpen={maximizedChart === 'trend'}
        onClose={() => setMaximizedChart(null)}
        title={`Trend Kesusutan per Bulan — ${trendJenis.jenisKrosok}`}
        subtitle="Visualisasi grafik skala penuh riwayat kesusutan bulanan varian terpilih"
        badge={trendJenis.jenisKrosok}
      >
        <InteractiveLineChart
          data={trendLineData}
          color="#059669"
          unit="%"
          height={440}
          showDataLabels={true}
        />
      </ChartModal>

      {/* Maximized Modal for Top Variants Comparison */}
      <ChartModal
        isOpen={maximizedChart === 'comparison'}
        onClose={() => setMaximizedChart(null)}
        title="Perbandingan Susut Rata-rata (%) Antar Varian Krosok"
        subtitle="Visualisasi skala penuh perbandingan susut 8 varian volume bahan baku terbesar"
        badge="Analisis Mutu Varian"
      >
        <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-2">
          {rekapJenisPeriode.slice(0, 15).map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl border transition-all ${
                selectedJenisKrosok === item.label
                  ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800 text-sm">
                  {item.label}
                </span>
                <span className={`text-sm font-black ${getPctClass(item.susutPct)}`}>
                  {formatPct(item.susutPct)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    item.susutPct >= 10
                      ? 'bg-rose-500'
                      : item.susutPct <= 4
                      ? 'bg-emerald-500'
                      : 'bg-blue-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(5, (item.susutPct / 15) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                <span>Baku: <b>{formatNum(item.baku)} Kg</b></span>
                <span>Hasil: <b>{formatNum(item.hasil)} Kg</b></span>
                <span>Kapasitas: <b>{formatPct(item.kapasitasPct)}%</b></span>
              </div>
            </div>
          ))}
        </div>
      </ChartModal>
    </div>
  );
};
