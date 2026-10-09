import React from 'react';
import { Calendar, Layers, Scale, Sparkles, Droplets, Wind, ArrowRight, TrendingDown } from 'lucide-react';
import { RingkasanData, FilterOptions } from '../types';
import { formatNum, formatPct, getPctClass, MONTH_ORDER } from '../services/dataService';

interface SummaryCardsProps {
  ringkasanTahunan: RingkasanData;
  ringkasanBulanan: RingkasanData;
  ringkasanPeriode: RingkasanData;
  filterOptions: FilterOptions;
  bulanRingkasan: string;
  onBulanRingkasanChange: (bulan: string) => void;
  selectedTahun: string;
  onTahunChange: (tahun: string) => void;
  periodeAwal: { bulan: string; tahun: string };
  periodeAkhir: { bulan: string; tahun: string };
  onPeriodeAwalChange: (val: { bulan: string; tahun: string }) => void;
  onPeriodeAkhirChange: (val: { bulan: string; tahun: string }) => void;
  onApplyPeriode: () => void;
  onNavigateToJenisTab: () => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  ringkasanTahunan,
  ringkasanBulanan,
  ringkasanPeriode,
  filterOptions,
  bulanRingkasan,
  onBulanRingkasanChange,
  selectedTahun,
  onTahunChange,
  periodeAwal,
  periodeAkhir,
  onPeriodeAwalChange,
  onPeriodeAkhirChange,
  onApplyPeriode,
  onNavigateToJenisTab
}) => {
  /**
   * 3 Columns x 2 Rows Grid Layout matching the reference Tembakau app!
   * Guarantees ample space for numbers (up to millions) without ellipsis or cutoff.
   */
  const renderKpiGrid3x2 = (r: RingkasanData) => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
        {/* ROW 1 - CARD 1: JUMLAH DATA */}
        <div className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
            <span>JUMLAH DATA</span>
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {r.jumlahData.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium">Batch terproses</div>
        </div>

        {/* ROW 1 - CARD 2: BAHAN BAKU */}
        <div className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
            <span>BAHAN BAKU</span>
          </div>
          <div className="my-1.5">
            <span className="text-lg sm:text-xl font-bold text-blue-700 tracking-tight whitespace-nowrap">
              {formatNum(r.baku)} Kg
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium">Netto awal (1 dec)</div>
        </div>

        {/* ROW 1 - CARD 3: HASIL JADI */}
        <div className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase flex items-center justify-between">
            <span>HASIL JADI</span>
          </div>
          <div className="my-1.5">
            <span className="text-lg sm:text-xl font-bold text-emerald-700 tracking-tight whitespace-nowrap">
              {formatNum(r.hasil)} Kg
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium">Hasil proses (1 dec)</div>
        </div>

        {/* ROW 2 - CARD 4: SUSUT RATA² */}
        <div className="bg-rose-50/40 hover:bg-rose-50/70 transition-colors p-3.5 sm:p-4 rounded-2xl border border-rose-200/70 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold tracking-wider text-slate-600 uppercase">
              SUSUT RATA²
            </span>
            <span className="text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 uppercase">
              MIN/MAX
            </span>
          </div>
          <div className="my-1.5 flex items-center gap-1.5">
            <TrendingDown className={`w-4 h-4 shrink-0 ${r.susutPct >= 10 ? 'text-rose-600' : 'text-slate-700'}`} />
            <span className={`text-xl sm:text-2xl font-bold tracking-tight ${getPctClass(r.susutPct)}`}>
              {formatPct(r.susutPct)}%
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium whitespace-nowrap">
            {formatNum(r.susutKg)} Kg
          </div>
        </div>

        {/* ROW 2 - CARD 5: GAGANG (%) */}
        <div className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
            <span>⚖ GAGANG (%)</span>
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-bold text-amber-600 tracking-tight">
              {formatPct(r.gagangPct)}%
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium whitespace-nowrap">
            {formatNum((r.baku * r.gagangPct) / 100)} Kg terpisah
          </div>
        </div>

        {/* ROW 2 - CARD 6: AIR + DEBU (%) */}
        <div className="bg-slate-50/70 hover:bg-slate-100/70 transition-colors p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
          <div className="text-[10.5px] font-bold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
            <span>💧 AIR + DEBU (%)</span>
          </div>
          <div className="my-1.5">
            <span className="text-xl sm:text-2xl font-bold text-cyan-700 tracking-tight">
              {formatPct(r.debuAirPct)}%
            </span>
          </div>
          <div className="text-[11.5px] text-slate-500 font-medium whitespace-nowrap">
            {formatNum((r.baku * r.debuAirPct) / 100)} Kg evaporasi
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 mb-6">
      {/* Top 2 Cards: Rekap Tahunan & Rekap Bulanan in 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Rekap Tahunan */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
                <Calendar className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-base text-slate-900">Rekap Tahunan</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                {selectedTahun === 'Semua' ? 'Semua Tahun' : selectedTahun}
              </span>

              <select
                value={selectedTahun}
                onChange={(e) => onTahunChange(e.target.value)}
                className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Semua">Semua Tahun</option>
                {filterOptions.tahun.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {renderKpiGrid3x2(ringkasanTahunan)}
        </div>

        {/* Card 2: Rekap Bulanan */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2.5 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
                <Calendar className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-base text-slate-900">Rekap Bulanan</h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {bulanRingkasan === 'Semua' ? 'Semua Bulan' : bulanRingkasan} {selectedTahun === 'Semua' ? 'Semua Tahun' : selectedTahun}
              </span>

              <select
                value={bulanRingkasan}
                onChange={(e) => onBulanRingkasanChange(e.target.value)}
                className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Semua">Semua Bulan</option>
                {filterOptions.bulan.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>

              <select
                value={selectedTahun}
                onChange={(e) => onTahunChange(e.target.value)}
                className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Semua">Semua Tahun</option>
                {filterOptions.tahun.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {renderKpiGrid3x2(ringkasanBulanan)}
        </div>
      </div>

      {/* Card 3: Rekap Rentang Periode (Full Width) */}
      <div id="periodeCardAnchor" className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
              <Calendar className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Rekap Rentang Periode{' '}
                <span className="font-normal text-slate-500 text-xs">(mis. Januari–Maret)</span>
              </h3>
            </div>
          </div>

          {/* Period Range Picker */}
          <div className="no-print flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Dari:</span>
            <select
              value={periodeAwal.bulan}
              onChange={(e) => onPeriodeAwalChange({ ...periodeAwal, bulan: e.target.value })}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5"
            >
              {MONTH_ORDER.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={periodeAwal.tahun}
              onChange={(e) => onPeriodeAwalChange({ ...periodeAwal, tahun: e.target.value })}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5"
            >
              {filterOptions.tahun.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <span className="text-xs text-slate-500 font-medium px-1">sampai:</span>
            <select
              value={periodeAkhir.bulan}
              onChange={(e) => onPeriodeAkhirChange({ ...periodeAkhir, bulan: e.target.value })}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5"
            >
              {MONTH_ORDER.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={periodeAkhir.tahun}
              onChange={(e) => onPeriodeAkhirChange({ ...periodeAkhir, tahun: e.target.value })}
              className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5"
            >
              {filterOptions.tahun.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <button
              onClick={onApplyPeriode}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors ml-1"
            >
              Terapkan
            </button>
          </div>
        </div>

        {/* Info & Period Badge */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            {ringkasanPeriode.periodeLabel}
          </span>
          <button
            onClick={onNavigateToJenisTab}
            className="no-print text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
          >
            <span>🔗 Rentang ini juga mengatur tabel Rekap per Jenis Krosok</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {renderKpiGrid3x2(ringkasanPeriode)}
      </div>
    </div>
  );
};
