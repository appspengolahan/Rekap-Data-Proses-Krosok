import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Droplets,
  Edit3,
  FileText,
  Info,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Sliders,
  Thermometer,
  Wind,
  X
} from 'lucide-react';
import {
  BaselineConfigMeta,
  BatchFieldNote,
  ExecutiveSignatories,
  FactoryLocation,
  FactoryWeatherData,
  KrosokRecord,
  KrosokStandarAcuan
} from '../types';
import { formatNum, formatPct, MONTH_ORDER, round2 } from '../services/dataService';
import {
  calculateBaselineFromPeriod,
  computeEvaluasiBulananKrosok,
  DEFAULT_BASELINE_META,
  loadSignatories,
  saveSignatories
} from '../services/acuanService';
import { PP1_FACTORY_LOCATIONS } from '../services/weatherService';

interface TabAnalisisDeviasiProps {
  records: KrosokRecord[];
  availableYears: string[];
  standarList: KrosokStandarAcuan[];
  baselineMeta: BaselineConfigMeta;
  onApplyBaseline: (newList: KrosokStandarAcuan[], newMeta: BaselineConfigMeta) => void;
  onUpdateStandarList: (newList: KrosokStandarAcuan[]) => void;
  batchNotes: Record<string, BatchFieldNote>;
  weatherData: FactoryWeatherData | null;
  weatherLoading: boolean;
  onRefreshWeather: (locationOverride?: FactoryLocation) => void;
}

export const TabAnalisisDeviasi: React.FC<TabAnalisisDeviasiProps> = ({
  records,
  availableYears,
  standarList,
  baselineMeta,
  onApplyBaseline,
  onUpdateStandarList,
  batchNotes,
  weatherData,
  weatherLoading,
  onRefreshWeather
}) => {
  // Panel 1: Draft Baseline Controls (initialized from active baselineMeta)
  const [draftBulanMulai, setDraftBulanMulai] = useState<string>(baselineMeta.bulanMulai);
  const [draftBulanAkhir, setDraftBulanAkhir] = useState<string>(baselineMeta.bulanAkhir);
  const [draftTahunAcuan, setDraftTahunAcuan] = useState<string>(baselineMeta.tahunAcuan);
  const [draftBulanBerlaku, setDraftBulanBerlaku] = useState<string>(
    baselineMeta.bulanBerlaku
  );
  const [draftTahunBerlaku, setDraftTahunBerlaku] = useState<string>(
    baselineMeta.tahunBerlaku
  );
  const [draftWaspadaPct, setDraftWaspadaPct] = useState<string>(
    baselineMeta.globalWaspadaPct.toFixed(2)
  );
  const [draftOosPct, setDraftOosPct] = useState<string>(
    baselineMeta.globalOosPct.toFixed(2)
  );
  const [showBaselineMatrix, setShowBaselineMatrix] = useState<boolean>(false);
  const [baselineSearch, setBaselineSearch] = useState<string>('');
  const [baselineJalurFilter, setBaselineJalurFilter] = useState<string>('Semua');
  const [applyFeedback, setApplyFeedback] = useState<string | null>(null);

  // Modal for Editing / Creating Individual Variant Standard
  const [editingItem, setEditingItem] = useState<KrosokStandarAcuan | null>(null);
  const [isAddingNewStandard, setIsAddingNewStandard] = useState<boolean>(false);
  const [editJenisName, setEditJenisName] = useState<string>('');
  const [editJalur, setEditJalur] = useState<string>('SKT');
  const [editStandarVal, setEditStandarVal] = useState<string>('0.10');
  const [editWaspadaVal, setEditWaspadaVal] = useState<string>('0.15');
  const [editOosVal, setEditOosVal] = useState<string>('0.30');
  const [editKeterangan, setEditKeterangan] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  // Panel 2: Evaluation Period Controls
  const [evalBulan, setEvalBulan] = useState<string>(baselineMeta.bulanBerlaku || 'Oktober');
  const [evalTahun, setEvalTahun] = useState<string>(baselineMeta.tahunBerlaku || '2026');
  const [evalJalur, setEvalJalur] = useState<string>('Semua');
  const [evalSearch, setEvalSearch] = useState<string>('');
  const [chartShowAll, setChartShowAll] = useState<boolean>(false);
  const [hoveredVariantKey, setHoveredVariantKey] = useState<string | null>(null);

  // Panel 3 & 4: Signatories & Custom Executive Notes
  const [signatories, setSignatories] = useState<ExecutiveSignatories>(() =>
    loadSignatories()
  );
  const [showPdfConfig, setShowPdfConfig] = useState<boolean>(false);

  const yearList = useMemo(() => {
    const base = new Set<string>(['2026', '2025', ...availableYears]);
    return Array.from(base).sort((a, b) => b.localeCompare(a));
  }, [availableYears]);

  // Preview calculation for Panel 1 draft period
  const draftPreviewList = useMemo(() => {
    const w = Math.max(0.05, parseFloat(draftWaspadaPct.replace(',', '.')) || 0.15);
    const o = Math.max(w + 0.05, parseFloat(draftOosPct.replace(',', '.')) || 0.30);
    return calculateBaselineFromPeriod(
      records,
      draftBulanMulai,
      draftBulanAkhir,
      draftTahunAcuan,
      w,
      o
    );
  }, [
    records,
    draftBulanMulai,
    draftBulanAkhir,
    draftTahunAcuan,
    draftWaspadaPct,
    draftOosPct
  ]);

  // Filtered active standards for Panel 1 expandable matrix
  const filteredStandarList = useMemo(() => {
    return standarList.filter((s) => {
      if (baselineJalurFilter !== 'Semua' && s.jenisProses !== baselineJalurFilter) {
        return false;
      }
      if (baselineSearch.trim()) {
        return s.jenisKrosok.toLowerCase().includes(baselineSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [standarList, baselineJalurFilter, baselineSearch]);

  // Panel 2 & 3 Monthly Evaluation Computation
  const evaluation = useMemo(() => {
    return computeEvaluasiBulananKrosok({
      records,
      bulanEvaluasi: evalBulan,
      tahunEvaluasi: evalTahun,
      jalurFilter: evalJalur,
      standarList,
      baselineMeta,
      batchNotes,
      weatherData
    });
  }, [records, evalBulan, evalTahun, evalJalur, standarList, baselineMeta, batchNotes, weatherData]);

  const filteredEvalItems = useMemo(() => {
    if (!evalSearch.trim()) return evaluation.items;
    const q = evalSearch.trim().toLowerCase();
    return evaluation.items.filter(
      (i) =>
        i.jenisKrosok.toLowerCase().includes(q) ||
        i.faktorDominan.toLowerCase().includes(q)
    );
  }, [evaluation.items, evalSearch]);

  const chartItems = useMemo(() => {
    const list = filteredEvalItems;
    return chartShowAll ? list : list.slice(0, 10);
  }, [filteredEvalItems, chartShowAll]);

  // Compute chart symmetric/proportional Y-scale supporting negative & positive % values
  const chartScale = useMemo(() => {
    if (chartItems.length === 0) {
      return { minVal: -0.2, maxVal: 0.5, span: 0.7 };
    }
    let minV = 0;
    let maxV = 0.25;
    chartItems.forEach((item) => {
      minV = Math.min(minV, item.susutPct, item.standarAcuanPct);
      maxV = Math.max(maxV, item.susutPct, item.standarAcuanPct);
    });
    const paddedMin = minV < 0 ? round2(minV * 1.25 - 0.05) : 0;
    const paddedMax = round2(Math.max(0.2, maxV * 1.2 + 0.05));
    return {
      minVal: paddedMin,
      maxVal: paddedMax,
      span: Math.max(0.2, paddedMax - paddedMin)
    };
  }, [chartItems]);

  const handleApplyStandardAction = () => {
    const w = Math.max(0.05, parseFloat(draftWaspadaPct.replace(',', '.')) || 0.15);
    const o = Math.max(w + 0.05, parseFloat(draftOosPct.replace(',', '.')) || 0.30);
    const periodeLabel =
      draftBulanMulai === draftBulanAkhir
        ? `${draftBulanMulai} ${draftTahunAcuan}`
        : `${draftBulanMulai} – ${draftBulanAkhir} ${draftTahunAcuan}`;
    const berlakuLabel = `${draftBulanBerlaku} ${draftTahunBerlaku}`;

    const newMeta: BaselineConfigMeta = {
      bulanMulai: draftBulanMulai,
      bulanAkhir: draftBulanAkhir,
      tahunAcuan: draftTahunAcuan,
      bulanBerlaku: draftBulanBerlaku,
      tahunBerlaku: draftTahunBerlaku,
      globalWaspadaPct: round2(w),
      globalOosPct: round2(o),
      periodeLabel,
      berlakuLabel,
      appliedAt: new Date().toISOString().split('T')[0]
    };

    const computed = calculateBaselineFromPeriod(
      records,
      draftBulanMulai,
      draftBulanAkhir,
      draftTahunAcuan,
      newMeta.globalWaspadaPct,
      newMeta.globalOosPct,
      periodeLabel
    );

    onApplyBaseline(computed, newMeta);
    setEvalBulan(draftBulanBerlaku);
    setEvalTahun(draftTahunBerlaku);
    setApplyFeedback(
      `Standar acuan dari rata-rata tertimbang ${periodeLabel} (${computed.length - 1} varian krosok) aktif diterapkan untuk evaluasi ${berlakuLabel}.`
    );
    setTimeout(() => setApplyFeedback(null), 5000);
  };

  const handleResetDefaultBaseline = () => {
    setDraftBulanMulai(DEFAULT_BASELINE_META.bulanMulai);
    setDraftBulanAkhir(DEFAULT_BASELINE_META.bulanAkhir);
    setDraftTahunAcuan(DEFAULT_BASELINE_META.tahunAcuan);
    setDraftBulanBerlaku(DEFAULT_BASELINE_META.bulanBerlaku);
    setDraftTahunBerlaku(DEFAULT_BASELINE_META.tahunBerlaku);
    setDraftWaspadaPct(DEFAULT_BASELINE_META.globalWaspadaPct.toFixed(2));
    setDraftOosPct(DEFAULT_BASELINE_META.globalOosPct.toFixed(2));

    const computed = calculateBaselineFromPeriod(
      records,
      DEFAULT_BASELINE_META.bulanMulai,
      DEFAULT_BASELINE_META.bulanAkhir,
      DEFAULT_BASELINE_META.tahunAcuan,
      DEFAULT_BASELINE_META.globalWaspadaPct,
      DEFAULT_BASELINE_META.globalOosPct,
      DEFAULT_BASELINE_META.periodeLabel
    );
    onApplyBaseline(computed, {
      ...DEFAULT_BASELINE_META,
      appliedAt: new Date().toISOString().split('T')[0]
    });
    setEvalBulan(DEFAULT_BASELINE_META.bulanBerlaku);
    setEvalTahun(DEFAULT_BASELINE_META.tahunBerlaku);
    setApplyFeedback(
      'Standar acuan dikembalikan ke konfigurasi default (Agustus – September 2026 untuk Oktober 2026).'
    );
    setTimeout(() => setApplyFeedback(null), 4000);
  };

  const openEditModal = (item: KrosokStandarAcuan) => {
    setIsAddingNewStandard(false);
    setEditingItem(item);
    setEditJenisName(item.jenisKrosok);
    setEditJalur(item.jenisProses);
    setEditStandarVal(item.standarSusutPct.toFixed(2));
    setEditWaspadaVal(item.toleransiWaspadaPct.toFixed(2));
    setEditOosVal(item.toleransiOosPct.toFixed(2));
    setEditKeterangan(item.keterangan || '');
    setEditError(null);
  };

  const openAddStandardModal = () => {
    setIsAddingNewStandard(true);
    setEditingItem({
      id: `manual_${Date.now()}`,
      jenisKrosok: '',
      jenisProses: 'SKT',
      standarSusutPct: 0.1,
      toleransiWaspadaPct: baselineMeta.globalWaspadaPct,
      toleransiOosPct: baselineMeta.globalOosPct,
      periodeAcuan: `Penetapan Manual (${baselineMeta.berlakuLabel})`,
      totalBakuKg: 0,
      batchCount: 0,
      avgGagangPct: 0,
      avgDebuAirPct: 0,
      avgBatchBakuKg: 500,
      keterangan: '',
      updatedAt: new Date().toISOString().split('T')[0],
      isManualOverride: true
    });
    setEditJenisName('');
    setEditJalur('SKT');
    setEditStandarVal('0.10');
    setEditWaspadaVal(baselineMeta.globalWaspadaPct.toFixed(2));
    setEditOosVal(baselineMeta.globalOosPct.toFixed(2));
    setEditKeterangan('Penetapan standar acuan manual varian krosok baru');
    setEditError(null);
  };

  const handleSaveEditedStandard = () => {
    if (!editingItem) return;
    const trimmedName = editJenisName.trim();
    if (!trimmedName) {
      setEditError('Nama jenis krosok wajib diisi.');
      return;
    }
    const parsedStd = parseFloat(editStandarVal.replace(',', '.'));
    const parsedWaspada = parseFloat(editWaspadaVal.replace(',', '.'));
    const parsedOos = parseFloat(editOosVal.replace(',', '.'));

    if (isNaN(parsedStd)) {
      setEditError('Nilai standar susut (%) harus berupa angka valid (contoh: 0.18 atau -0.05).');
      return;
    }
    if (isNaN(parsedWaspada) || parsedWaspada <= 0 || isNaN(parsedOos) || parsedOos <= 0) {
      setEditError('Batas toleransi Waspada dan OOS harus lebih besar dari 0.');
      return;
    }

    const updatedObj: KrosokStandarAcuan = {
      ...editingItem,
      jenisKrosok: trimmedName,
      jenisProses: editJalur,
      standarSusutPct: round2(parsedStd),
      toleransiWaspadaPct: round2(parsedWaspada),
      toleransiOosPct: round2(Math.max(parsedOos, parsedWaspada + 0.05)),
      keterangan: editKeterangan.trim() || 'Penyesuaian standar oleh pimpinan produksi',
      updatedAt: new Date().toISOString().split('T')[0],
      isManualOverride: true
    };

    if (isAddingNewStandard) {
      onUpdateStandarList([updatedObj, ...standarList]);
    } else {
      onUpdateStandarList(
        standarList.map((s) => (s.id === editingItem.id ? updatedObj : s))
      );
    }
    setEditingItem(null);
  };

  const handleSignatoryChange = (
    field: keyof ExecutiveSignatories,
    value: string
  ) => {
    const next = { ...signatories, [field]: value };
    setSignatories(next);
    saveSignatories(next);
  };

  const handleExportPdfReport = () => {
    document.body.classList.add('print-evaluasi-pdf');
    window.print();
    setTimeout(() => {
      document.body.classList.remove('print-evaluasi-pdf');
    }, 1200);
  };

  const statusBadgeRender = (status: 'normal' | 'waspada' | 'oos') => {
    if (status === 'oos') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>OOS</span>
        </span>
      );
    }
    if (status === 'waspada') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          <Info className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Waspada</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>Normal</span>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* =====================================================================
          WORKSPACE ON-SCREEN VIEW (Hidden during Official PDF Print)
      ===================================================================== */}
      <div className="screen-workspace-content space-y-5">
        {/* TOP STATION BAR: Cuaca Riil Lokasi Pabrik PT Batu Karang */}
        <section className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="font-semibold text-slate-200">
                  Integrasi Mikroklimat Pabrik
                </span>
                <span aria-hidden="true">·</span>
                <select
                  value={weatherData?.location.id || 'batu-karang-wagir'}
                  onChange={(e) => {
                    const loc = PP1_FACTORY_LOCATIONS.find(
                      (l) => l.id === e.target.value
                    );
                    if (loc) onRefreshWeather(loc);
                  }}
                  className="bg-slate-800 text-sky-300 border border-slate-700 rounded-md px-2 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {PP1_FACTORY_LOCATIONS.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRefreshWeather(weatherData?.location)}
                  disabled={weatherLoading}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title="Perbarui kondisi cuaca riil lokasi pabrik"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${weatherLoading ? 'animate-spin text-sky-400' : ''}`}
                  />
                  <span>Perbarui Cuaca</span>
                </button>
              </div>

              <div className="text-xs text-slate-400">
                {weatherData?.location.address ||
                  'Jl. Parangargo No.153, Genengan, Parangargo, Kec. Wagir, Kabupaten Malang, Jawa Timur 65158'}
              </div>

              {weatherData && (
                <p className="text-xs text-slate-300 leading-relaxed pt-1">
                  <strong className="text-white">
                    Status Higroskopis ({weatherData.hygroIndex.status}):
                  </strong>{' '}
                  {weatherData.hygroIndex.analisisKorelasi}
                </p>
              )}
            </div>

            {/* Live Weather Telemetry Numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Suhu Aktual</span>
                </div>
                <div className="text-lg font-bold font-mono text-white mt-0.5">
                  {weatherData ? `${weatherData.temperature.toFixed(1)}°C` : '--'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  14h: {weatherData ? `${weatherData.avgTempLast14d}°C` : '-'}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5 text-sky-400" />
                  <span>Kelembaban (RH)</span>
                </div>
                <div className="text-lg font-bold font-mono text-sky-300 mt-0.5">
                  {weatherData ? `${Math.round(weatherData.humidity)}%` : '--'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  14h: {weatherData ? `${weatherData.avgHumidityLast14d}%` : '-'}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Kondisi Langit</span>
                </div>
                <div className="text-xs font-bold text-white mt-1 truncate max-w-[130px]">
                  {weatherData?.weatherDesc || 'Memuat...'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {weatherData ? `${weatherData.rainyDaysLast14d} hr hujan/14h` : '-'}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3.5 py-2.5">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Efek Penguapan</span>
                </div>
                <div className="text-xs font-bold text-emerald-300 mt-1">
                  {weatherData?.hygroIndex.potensiPenguapan || 'Normal'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  Angin {weatherData ? `${weatherData.windSpeed.toFixed(1)} km/j` : '-'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            PANEL 1: KONTROL ACUAN (BASELINE SETTING)
        ===================================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-blue-600">
                01. Kontrol Standar Acuan (Baseline Setting)
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                Penetapan Referensi Susut Tertimbang per Jenis Krosok
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acuan Aktif Sistem:{' '}
                <strong className="text-slate-800">{baselineMeta.periodeLabel}</strong>{' '}
                · Berlaku efektif mulai{' '}
                <strong className="text-blue-700">{baselineMeta.berlakuLabel}</strong> ·
                Toleransi Waspada{' '}
                <strong className="font-mono text-slate-800">
                  ±{formatPct(baselineMeta.globalWaspadaPct)}%
                </strong>{' '}
                / OOS{' '}
                <strong className="font-mono text-rose-700">
                  &gt;±{formatPct(baselineMeta.globalOosPct)}%
                </strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowBaselineMatrix((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span>
                  Tabel Acuan Varian ({standarList.filter((s) => s.jenisKrosok !== 'Semua / Umum').length})
                </span>
                {showBaselineMatrix ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleResetDefaultBaseline}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Kembalikan ke standar acuan Agustus – September 2026"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>
            </div>
          </div>

          {/* Selector Sentence & Apply Button */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Bulan Dasar Mulai
                </label>
                <select
                  value={draftBulanMulai}
                  onChange={(e) => setDraftBulanMulai(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MONTH_ORDER.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Sampai Bulan Dasar
                </label>
                <select
                  value={draftBulanAkhir}
                  onChange={(e) => setDraftBulanAkhir(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MONTH_ORDER.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tahun Dasar
                </label>
                <select
                  value={draftTahunAcuan}
                  onChange={(e) => setDraftTahunAcuan(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {yearList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Acuan Aktif Bulan
                </label>
                <select
                  value={draftBulanBerlaku}
                  onChange={(e) => setDraftBulanBerlaku(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-blue-300 bg-blue-50/40 text-xs font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MONTH_ORDER.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Batas Waspada (±%)
                </label>
                <input
                  type="text"
                  value={draftWaspadaPct}
                  onChange={(e) => setDraftWaspadaPct(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Batas OOS (±%)
                </label>
                <input
                  type="text"
                  value={draftOosPct}
                  onChange={(e) => setDraftOosPct(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-bold text-rose-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between xl:justify-end gap-3 shrink-0 pt-1 xl:pt-0">
              <div className="text-[11px] text-slate-500 font-mono">
                Pratinjau: {Math.max(0, draftPreviewList.length - 1)} varian terhitung
              </div>
              <button
                type="button"
                onClick={handleApplyStandardAction}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Terapkan Standar Acuan</span>
              </button>
            </div>
          </div>

          {applyFeedback && (
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{applyFeedback}</span>
              </div>
              <button
                type="button"
                onClick={() => setApplyFeedback(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold px-1"
              >
                ×
              </button>
            </div>
          )}

          {/* Expandable Baseline Matrix per Variant */}
          {showBaselineMatrix && (
            <div className="pt-2 space-y-3 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={baselineSearch}
                      onChange={(e) => setBaselineSearch(e.target.value)}
                      placeholder="Cari varian krosok..."
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60"
                    />
                  </div>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                    {['Semua', 'SKT', 'SKM'].map((j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setBaselineJalurFilter(j)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          baselineJalurFilter === j
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {j}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openAddStandardModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Acuan Varian Baru</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Jenis Krosok</th>
                      <th className="py-2.5 px-3 text-center">Jalur</th>
                      <th className="py-2.5 px-3 text-right">Standar Acuan (%)</th>
                      <th className="py-2.5 px-3 text-right">Waspada (±%)</th>
                      <th className="py-2.5 px-3 text-right">OOS (±%)</th>
                      <th className="py-2.5 px-3 text-right">Basis Baku (Kg)</th>
                      <th className="py-2.5 px-3 text-center">Batch</th>
                      <th className="py-2.5 px-3">Keterangan Dasar</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStandarList.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          <span>{s.jenisKrosok}</span>
                          {s.isManualOverride && (
                            <span className="ml-1.5 text-[10px] font-medium text-blue-600">
                              · Manual
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-700">
                          {s.jenisProses}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatPct(s.standarSusutPct)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-amber-700">
                          ±{formatPct(s.toleransiWaspadaPct)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-rose-700">
                          ±{formatPct(s.toleransiOosPct)}%
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {s.totalBakuKg > 0 ? formatNum(s.totalBakuKg) : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600">
                          {s.batchCount > 0 ? s.batchCount : '-'}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500 max-w-xs truncate">
                          {s.keterangan}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-blue-50 text-blue-600 border border-slate-200 hover:border-blue-300 transition-colors whitespace-nowrap cursor-pointer"
                          >
                            Ubah
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* =====================================================================
            PANEL 2: DASHBOARD KOMPARASI MULTI-VARIAN (GRAFIK & MATRIKS)
        ===================================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-5">
          {/* Header & Period Evaluation Filter */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="text-xs font-semibold text-blue-600">
                02. Dashboard Komparasi Multi-Varian
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                Perbandingan Standar Acuan vs Realisasi Susut Bulanan
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Bulan Evaluasi:</span>
                <select
                  value={evalBulan}
                  onChange={(e) => setEvalBulan(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Semua">Semua Bulan</option>
                  {MONTH_ORDER.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Tahun:</span>
                <select
                  value={evalTahun}
                  onChange={(e) => setEvalTahun(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Semua">Semua</option>
                  {yearList.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                {['Semua', 'SKT', 'SKM'].map((j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setEvalJalur(j)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      evalJalur === j
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 KPI Evaluation Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="text-xs font-medium text-slate-500">
                Volume Krosok Diolah
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 mt-1">
                {formatNum(evaluation.totalBakuKg)}{' '}
                <span className="text-xs font-normal text-slate-500">Kg</span>
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                Hasil: {formatNum(evaluation.totalHasilKg)} Kg · {evaluation.totalBatch} batch
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="text-xs font-medium text-slate-500">
                Susut Riil Tertimbang
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-blue-700 mt-1">
                {formatPct(evaluation.susutRiilWeightedPct)}%
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                Netto Susut: {formatNum(evaluation.totalSusutKg)} Kg
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
              <div className="text-xs font-medium text-slate-500">
                Standar Acuan Tertimbang
              </div>
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-700 mt-1">
                {formatPct(evaluation.acuanWeightedPct)}%
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                Basis: {evaluation.periodeAcuanLabel}
              </div>
            </div>

            <div
              className={`p-3.5 rounded-xl border ${
                evaluation.statusAgregat === 'oos'
                  ? 'bg-rose-50/60 border-rose-200'
                  : evaluation.statusAgregat === 'waspada'
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-emerald-50/60 border-emerald-200'
              }`}
            >
              <div className="text-xs font-medium text-slate-600 flex items-center justify-between">
                <span>Net Deviasi Agregat</span>
                {statusBadgeRender(evaluation.statusAgregat)}
              </div>
              <div
                className={`text-lg sm:text-xl font-bold font-mono mt-1 ${
                  evaluation.statusAgregat === 'oos'
                    ? 'text-rose-700'
                    : evaluation.statusAgregat === 'waspada'
                    ? 'text-amber-800'
                    : 'text-emerald-800'
                }`}
              >
                {evaluation.deviasiAgregatPct >= 0 ? '+' : ''}
                {formatPct(evaluation.deviasiAgregatPct)}%
              </div>
              <div className="text-xs text-slate-600 mt-1 font-mono">
                Dampak: {evaluation.dampakAgregatKg >= 0 ? '+' : ''}
                {formatNum(evaluation.dampakAgregatKg)} Kg · OOS: {evaluation.oosCount} varian
              </div>
            </div>
          </div>

          {/* SIDE-BY-SIDE BAR CHART: Bar Hijau (Acuan) vs Bar Biru (Riil Bulanan) */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>
                    Grafik Batang Bersanding: Acuan Standar vs Realisasi ({evalBulan}{' '}
                    {evalTahun})
                  </span>
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                    <span>Bar Hijau: Standar Acuan ({baselineMeta.periodeLabel})</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                    <span>Bar Biru: Realisasi Bulanan (Normal/Waspada)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-xs bg-rose-600 inline-block" />
                    <span>Outline Merah: Realisasi OOS</span>
                  </span>
                </div>
              </div>

              {filteredEvalItems.length > 10 && (
                <button
                  type="button"
                  onClick={() => setChartShowAll((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {chartShowAll
                    ? 'Tampilkan Top 10 Deviasi'
                    : `Tampilkan Semua (${filteredEvalItems.length} Varian)`}
                </button>
              )}
            </div>

            {chartItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Belum ada data realisasi varian untuk ditampilkan pada periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div
                  className="min-w-[680px]"
                  style={{ width: `${Math.max(100, chartItems.length * 7.5)}%` }}
                >
                  <div className="relative h-64 pt-6 pb-8 px-2 border-b border-slate-200 flex items-stretch gap-3">
                    {/* Zero (0.00%) Horizontal Reference Line */}
                    {(() => {
                      const zeroRatio =
                        (chartScale.maxVal - 0) / chartScale.span;
                      const zeroTopPct = Math.max(0, Math.min(100, zeroRatio * 100));
                      return (
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-slate-300 pointer-events-none z-0"
                          style={{ top: `${zeroTopPct}%` }}
                        >
                          <span className="absolute right-1 -top-4 text-[10px] font-mono text-slate-400 bg-white px-1">
                            0,00%
                          </span>
                        </div>
                      );
                    })()}

                    {chartItems.map((item) => {
                      const zeroPosPct =
                        ((chartScale.maxVal - 0) / chartScale.span) * 100;

                      const calcBarGeometry = (val: number) => {
                        const valPosPct =
                          ((chartScale.maxVal - val) / chartScale.span) * 100;
                        if (val >= 0) {
                          return {
                            top: `${Math.max(0, valPosPct)}%`,
                            height: `${Math.max(1.5, zeroPosPct - valPosPct)}%`
                          };
                        }
                        return {
                          top: `${zeroPosPct}%`,
                          height: `${Math.max(1.5, valPosPct - zeroPosPct)}%`
                        };
                      };

                      const acuanGeo = calcBarGeometry(item.standarAcuanPct);
                      const riilGeo = calcBarGeometry(item.susutPct);
                      const isHovered = hoveredVariantKey === item.key;

                      return (
                        <div
                          key={item.key}
                          onMouseEnter={() => setHoveredVariantKey(item.key)}
                          onMouseLeave={() => setHoveredVariantKey(null)}
                          className="relative flex-1 min-w-[64px] h-full flex flex-col justify-end group"
                        >
                          {/* Hover Tooltip Card */}
                          {isHovered && (
                            <div className="absolute z-30 bottom-full mb-1 left-1/2 -translate-x-1/2 w-56 p-2.5 rounded-xl bg-slate-900 text-white text-[11px] shadow-lg pointer-events-none">
                              <div className="font-bold text-white truncate">
                                {item.jenisKrosok}
                              </div>
                              <div className="text-[10px] text-slate-400 mb-1.5">
                                Jalur {item.jenisProses} · Baku {formatNum(item.bakuKg)} Kg
                              </div>
                              <div className="flex justify-between font-mono">
                                <span className="text-emerald-300">Acuan:</span>
                                <span>{formatPct(item.standarAcuanPct)}%</span>
                              </div>
                              <div className="flex justify-between font-mono">
                                <span className="text-sky-300">Riil:</span>
                                <span>{formatPct(item.susutPct)}%</span>
                              </div>
                              <div className="flex justify-between font-mono font-bold border-t border-slate-700 mt-1 pt-1">
                                <span>Deviasi:</span>
                                <span
                                  className={
                                    item.status === 'oos'
                                      ? 'text-rose-400'
                                      : item.status === 'waspada'
                                      ? 'text-amber-300'
                                      : 'text-emerald-300'
                                  }
                                >
                                  {item.deviasiPct >= 0 ? '+' : ''}
                                  {formatPct(item.deviasiPct)}% (
                                  {item.dampakDeviasiKg >= 0 ? '+' : ''}
                                  {formatNum(item.dampakDeviasiKg)} Kg)
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Bar Track Area */}
                          <div className="relative w-full h-full">
                            {/* Bar 1: Acuan (Emerald Green) */}
                            <div
                              className="absolute left-[14%] w-[32%] bg-emerald-500 hover:bg-emerald-600 rounded-xs transition-opacity"
                              style={acuanGeo}
                            />
                            {/* Bar 2: Riil Bulanan (Blue, with Crimson ring if OOS) */}
                            <div
                              className={`absolute right-[14%] w-[32%] rounded-xs transition-opacity ${
                                item.status === 'oos'
                                  ? 'bg-blue-600 ring-2 ring-rose-500'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                              style={riilGeo}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X-Axis Labels */}
                  <div className="flex items-start gap-3 pt-2 px-2">
                    {chartItems.map((item) => (
                      <div key={item.key} className="flex-1 min-w-[64px] text-center">
                        <div
                          className="text-[10px] font-semibold text-slate-700 truncate"
                          title={item.jenisKrosok}
                        >
                          {item.jenisKrosok}
                        </div>
                        <div
                          className={`text-[10px] font-mono font-bold mt-0.5 ${
                            item.status === 'oos'
                              ? 'text-rose-600'
                              : item.status === 'waspada'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.deviasiPct >= 0 ? '+' : ''}
                          {formatPct(item.deviasiPct)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Waste Decomposition & Field Quick Tags Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  Fraksi Gagang
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {formatNum(evaluation.totalGagangKg)} Kg
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600">
                {evaluation.totalBakuKg > 0
                  ? formatPct((evaluation.totalGagangKg / evaluation.totalBakuKg) * 100)
                  : '0,00'}
                %
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  Fraksi Debu Ayakan
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                  {formatNum(evaluation.totalDebuKg)} Kg
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-600">
                {evaluation.totalBakuKg > 0
                  ? formatPct((evaluation.totalDebuKg / evaluation.totalBakuKg) * 100)
                  : '0,00'}
                %
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-slate-500">
                  Net Uap Air (Penguapan/Serapan)
                </div>
                <div className="text-sm font-bold font-mono text-sky-800 mt-0.5">
                  {evaluation.totalUapAirKg >= 0 ? '+' : ''}
                  {formatNum(evaluation.totalUapAirKg)} Kg
                </div>
              </div>
              <span className="text-xs font-mono font-semibold text-sky-700">
                {evaluation.totalBakuKg > 0
                  ? formatPct((evaluation.totalUapAirKg / evaluation.totalBakuKg) * 100)
                  : '0,00'}
                %
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-medium text-slate-500">
                Rekap Quick Tag Mandor (DHP)
              </div>
              <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
                {evaluation.topTags.length > 0
                  ? evaluation.topTags
                      .slice(0, 2)
                      .map((t) => `${t.tag} (${t.count})`)
                      .join(' · ')
                  : 'Belum ada tag khusus pada periode ini'}
              </div>
            </div>
          </div>

          {/* MULTI-VARIANT DEVIATION MATRIX TABLE */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-600">
                Matriks Komparasi{' '}
                <strong className="text-slate-900">{filteredEvalItems.length}</strong>{' '}
                varian krosok · Normal: {evaluation.normalCount} · Waspada:{' '}
                {evaluation.waspadaCount} · OOS: {evaluation.oosCount}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={evalSearch}
                  onChange={(e) => setEvalSearch(e.target.value)}
                  placeholder="Filter varian atau diagnosa..."
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 sm:w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Jenis Krosok</th>
                    <th className="py-2.5 px-2 text-center">Jalur</th>
                    <th className="py-2.5 px-3 text-right">Baku (Kg)</th>
                    <th className="py-2.5 px-3 text-right">Hasil (Kg)</th>
                    <th className="py-2.5 px-3 text-right">Susut Riil (%)</th>
                    <th className="py-2.5 px-3 text-right">Acuan (%)</th>
                    <th className="py-2.5 px-3 text-right">Deviasi (Δ%)</th>
                    <th className="py-2.5 px-3 text-right">Dampak (Kg)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Diagnosa Faktor & Tag Lapangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvalItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-8 text-center text-slate-400 text-xs"
                      >
                        Tidak terdapat varian krosok yang sesuai filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredEvalItems.map((item, idx) => (
                      <tr
                        key={item.key}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          item.status === 'oos' ? 'bg-rose-50/25' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{item.jenisKrosok}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.batchCount} batch olah
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-[11px] text-slate-700">
                          {item.jenisProses}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                          {formatNum(item.bakuKg)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {formatNum(item.hasilKg)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                          {formatPct(item.susutPct)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                          {formatPct(item.standarAcuanPct)}%
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            item.status === 'oos'
                              ? 'text-rose-600'
                              : item.status === 'waspada'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.deviasiPct >= 0 ? '+' : ''}
                          {formatPct(item.deviasiPct)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {item.dampakDeviasiKg >= 0 ? '+' : ''}
                          {formatNum(item.dampakDeviasiKg)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {statusBadgeRender(item.status)}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <div className="font-semibold text-slate-800 text-[11px]">
                            {item.faktorDominan}
                          </div>
                          <div
                            className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2"
                            title={item.penjelasan}
                          >
                            {item.penjelasan}
                          </div>
                          {item.tagsSummary.length > 0 && (
                            <div className="text-[10px] text-blue-700 font-medium mt-1">
                              Mandor:{' '}
                              {item.tagsSummary
                                .map((t) => `${t.tag} (${t.count}x)`)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredEvalItems.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 text-right text-slate-600">
                        Total / Tertimbang ({evaluation.totalBatch} Batch):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                        {formatNum(evaluation.totalBakuKg)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                        {formatNum(evaluation.totalHasilKg)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-700">
                        {formatPct(evaluation.susutRiilWeightedPct)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">
                        {formatPct(evaluation.acuanWeightedPct)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                        {evaluation.deviasiAgregatPct >= 0 ? '+' : ''}
                        {formatPct(evaluation.deviasiAgregatPct)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                        {evaluation.dampakAgregatKg >= 0 ? '+' : ''}
                        {formatNum(evaluation.dampakAgregatKg)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {statusBadgeRender(evaluation.statusAgregat)}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-normal text-slate-500">
                        Acuan {evaluation.periodeAcuanLabel}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>

        {/* =====================================================================
            PANEL 3: EXECUTIVE SUMMARY NARATIF (OTOMATIS + CATATAN RTL)
        ===================================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-blue-600">
                03. Executive Summary Naratif (Otomatis)
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Sintesis Evaluasi Kesusutan Krosok — {evalBulan} {evalTahun}
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                {evaluation.executiveNarrative}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Catatan Tambahan Pimpinan / Keputusan Rapat Evaluasi (Opsional):</span>
              </label>
              <textarea
                rows={2}
                value={signatories.catatanTambahan}
                onChange={(e) =>
                  handleSignatoryChange('catatanTambahan', e.target.value)
                }
                placeholder="Tambahkan kesimpulan rapat atau instruksi khusus pimpinan untuk dicantumkan ke dalam dokumen PDF..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-emerald-700">
                Rekomendasi Tindakan Manajerial (Continuous Improvement)
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Rencana Tindak Lanjut (RTL) Berbasis Faktor Dominan
              </h3>
              <ol className="space-y-2.5 text-xs text-slate-700 pt-1">
                {evaluation.rekomendasiManajerial.map((rek, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-mono font-bold text-slate-400 shrink-0 mt-0.5">
                      0{idx + 1}.
                    </span>
                    <span className="leading-relaxed">{rek}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              Disusun otomatis dari kombinasi neraca massa (gagang, debu, uap air),
              kapasitas batch, Quick Tag Mandor DHP, dan mikroklimat PT Batu Karang.
            </div>
          </div>
        </section>

        {/* =====================================================================
            PANEL 4: EXPORT LAPORAN EVALUASI BULANAN (PDF RESMI)
        ===================================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-blue-600">
                04. Dokumen Pengesahan Evaluasi Bulanan
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Cetak Laporan Resmi Divisi Produksi I (Format A4 Siap Rapat)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mencakup Kop Resmi PT Batu Karang, Executive Summary, Grafik Batang
                Bersanding, Matriks Deviasi Varian, dan Kolom Tanda Tangan Pengesahan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowPdfConfig((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Atur Pejabat Pengesahan</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdfReport}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Export Laporan Evaluasi Bulanan (PDF)</span>
              </button>
            </div>
          </div>

          {showPdfConfig && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Dokumen Laporan
                </label>
                <input
                  type="text"
                  value={signatories.nomorDokumen}
                  onChange={(e) =>
                    handleSignatoryChange('nomorDokumen', e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Dibuat Oleh (Nama / Jabatan)
                </label>
                <input
                  type="text"
                  value={signatories.dibuatNama}
                  onChange={(e) =>
                    handleSignatoryChange('dibuatNama', e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Diperiksa Oleh (Asisten Manajer)
                </label>
                <input
                  type="text"
                  value={signatories.diperiksaNama}
                  onChange={(e) =>
                    handleSignatoryChange('diperiksaNama', e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Disetujui Oleh (Manajer Divisi)
                </label>
                <input
                  type="text"
                  value={signatories.disetujuiNama}
                  onChange={(e) =>
                    handleSignatoryChange('disetujuiNama', e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* =====================================================================
          MODAL UBAH / TAMBAH STANDAR ACUAN VARIAN
      ===================================================================== */}
      {editingItem && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isAddingNewStandard
                    ? 'Tambah Acuan Varian Krosok Baru'
                    : 'Ubah Standar Acuan Susut'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mendukung nilai positif maupun negatif (serapan air higroskopis)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Jenis Krosok
                </label>
                <input
                  type="text"
                  value={editJenisName}
                  disabled={!isAddingNewStandard}
                  onChange={(e) => setEditJenisName(e.target.value)}
                  placeholder="Contoh: Zambia M1L (2025)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jalur
                  </label>
                  <select
                    value={editJalur}
                    disabled={!isAddingNewStandard}
                    onChange={(e) => setEditJalur(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold disabled:bg-slate-100"
                  >
                    <option value="SKT">SKT</option>
                    <option value="SKM">SKM</option>
                    <option value="Semua">Semua</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Acuan (%)
                  </label>
                  <input
                    type="text"
                    value={editStandarVal}
                    onChange={(e) => setEditStandarVal(e.target.value)}
                    placeholder="0.15"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Waspada (±%)
                  </label>
                  <input
                    type="text"
                    value={editWaspadaVal}
                    onChange={(e) => setEditWaspadaVal(e.target.value)}
                    placeholder="0.15"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono font-bold text-amber-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Batas OOS (±%)
                  </label>
                  <input
                    type="text"
                    value={editOosVal}
                    onChange={(e) => setEditOosVal(e.target.value)}
                    placeholder="0.30"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 font-mono font-bold text-rose-700"
                  />
                </div>
                <div className="flex items-end text-[11px] text-slate-500 pb-1">
                  OOS aktif jika |Δ| melampaui batas ini.
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Dasar Penetapan / Keterangan SK
                </label>
                <textarea
                  rows={2}
                  value={editKeterangan}
                  onChange={(e) => setEditKeterangan(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800"
                />
              </div>

              {editError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                  {editError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEditedStandard}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Simpan Standar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          OFFICIAL A4 PRINT DOCUMENT (Visible ONLY when exporting PDF)
      ===================================================================== */}
      <div
        id="official-evaluasi-pdf-document"
        className="official-pdf-only bg-white text-slate-900 p-6 space-y-5 text-[11px]"
      >
        {/* KOP SURAT RESMI DIVISI PRODUKSI I - PT BATU KARANG */}
        <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-extrabold tracking-tight text-slate-900">
              PT BATU KARANG — DIVISI PRODUKSI I
            </div>
            <div className="text-xs font-bold text-slate-700">
              UNIT PENGOLAHAN TEMBAKAU KROSOK (SKT &amp; SKM)
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5">
              Jl. Parangargo No.153, Genengan, Parangargo, Kec. Wagir, Kabupaten
              Malang, Jawa Timur 65158
            </div>
          </div>
          <div className="text-right font-mono text-[10px] text-slate-700 shrink-0">
            <div className="font-bold text-slate-900">{signatories.nomorDokumen}</div>
            <div>
              Periode Evaluasi: {evalBulan} {evalTahun}
            </div>
            <div>Basis Acuan: {evaluation.periodeAcuanLabel}</div>
            <div>
              Tanggal Cetak:{' '}
              {new Date().toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          </div>
        </div>

        <div className="text-center py-1">
          <h1 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
            LAPORAN EVALUASI DEVIASI KESUSUTAN PENGOLAHAN KROSOK
          </h1>
          <p className="text-[10px] text-slate-600">
            Komparasi Realisasi Produksi terhadap Standar Acuan Tertimbang &amp;
            Analisis Mikroklimat Pabrik
          </p>
        </div>

        {/* KPI RINGKASAN CETAK */}
        <div className="grid grid-cols-4 gap-2.5 avoid-break">
          <div className="border border-slate-300 rounded-lg p-2.5">
            <div className="text-[9px] text-slate-500 font-semibold">
              TOTAL VOLUME OLAH
            </div>
            <div className="text-sm font-bold font-mono mt-0.5">
              {formatNum(evaluation.totalBakuKg)} Kg
            </div>
            <div className="text-[9px] text-slate-600 font-mono">
              Hasil: {formatNum(evaluation.totalHasilKg)} Kg ({evaluation.totalBatch}{' '}
              batch)
            </div>
          </div>
          <div className="border border-slate-300 rounded-lg p-2.5">
            <div className="text-[9px] text-slate-500 font-semibold">
              SUSUT RIIL TERTIMBANG
            </div>
            <div className="text-sm font-bold font-mono text-blue-800 mt-0.5">
              {formatPct(evaluation.susutRiilWeightedPct)}%
            </div>
            <div className="text-[9px] text-slate-600 font-mono">
              Total Susut: {formatNum(evaluation.totalSusutKg)} Kg
            </div>
          </div>
          <div className="border border-slate-300 rounded-lg p-2.5">
            <div className="text-[9px] text-slate-500 font-semibold">
              ACUAN STANDAR AKTIF
            </div>
            <div className="text-sm font-bold font-mono text-emerald-800 mt-0.5">
              {formatPct(evaluation.acuanWeightedPct)}%
            </div>
            <div className="text-[9px] text-slate-600">
              {evaluation.periodeAcuanLabel}
            </div>
          </div>
          <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50">
            <div className="text-[9px] text-slate-700 font-bold">
              NET DEVIASI AGREGAT
            </div>
            <div className="text-sm font-extrabold font-mono mt-0.5">
              {evaluation.deviasiAgregatPct >= 0 ? '+' : ''}
              {formatPct(evaluation.deviasiAgregatPct)}% (
              {evaluation.statusAgregat.toUpperCase()})
            </div>
            <div className="text-[9px] text-slate-600 font-mono">
              Dampak: {evaluation.dampakAgregatKg >= 0 ? '+' : ''}
              {formatNum(evaluation.dampakAgregatKg)} Kg
            </div>
          </div>
        </div>

        {/* EXECUTIVE SUMMARY CETAK */}
        <div className="border border-slate-300 rounded-lg p-3 space-y-2 avoid-break">
          <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>I. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)</span>
          </div>
          <p className="text-[10.5px] leading-relaxed text-slate-800">
            {evaluation.executiveNarrative}
          </p>
          {signatories.catatanTambahan.trim() && (
            <div className="pt-1.5 border-t border-slate-200 text-[10.5px] text-slate-900">
              <strong>Catatan Pimpinan / Keputusan Evaluasi:</strong>{' '}
              {signatories.catatanTambahan}
            </div>
          )}
        </div>

        {/* GRAFIK KOMPARASI CETAK (TOP 12 VARIAN) */}
        {evaluation.items.length > 0 && (
          <div className="border border-slate-300 rounded-lg p-3 space-y-2 avoid-break">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">
                II. GRAFIK KOMPARASI STANDAR ACUAN VS REALISASI PER VARIAN
              </span>
              <span className="text-[9.5px] text-slate-600">
                Hijau: Acuan Standar · Biru: Realisasi Bulanan
              </span>
            </div>
            <div className="space-y-1.5 pt-1">
              {evaluation.items.slice(0, 12).map((it) => {
                const maxAbs = Math.max(
                  0.4,
                  ...evaluation.items
                    .slice(0, 12)
                    .map((x) =>
                      Math.max(Math.abs(x.susutPct), Math.abs(x.standarAcuanPct))
                    )
                );
                const acuanWidth = Math.min(
                  100,
                  Math.max(3, (Math.abs(it.standarAcuanPct) / maxAbs) * 100)
                );
                const riilWidth = Math.min(
                  100,
                  Math.max(3, (Math.abs(it.susutPct) / maxAbs) * 100)
                );
                return (
                  <div
                    key={it.key}
                    className="grid grid-cols-12 items-center gap-2 text-[9.5px]"
                  >
                    <div className="col-span-4 font-semibold truncate">
                      {it.jenisKrosok} ({it.jenisProses})
                    </div>
                    <div className="col-span-6 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2 bg-emerald-600 rounded-xs"
                          style={{ width: `${acuanWidth}%` }}
                        />
                        <span className="font-mono text-[9px] text-slate-600">
                          Acuan {formatPct(it.standarAcuanPct)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`h-2 rounded-xs ${
                            it.status === 'oos' ? 'bg-rose-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${riilWidth}%` }}
                        />
                        <span className="font-mono text-[9px] font-bold text-slate-900">
                          Riil {formatPct(it.susutPct)}%
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 text-right font-mono font-bold">
                      {it.deviasiPct >= 0 ? '+' : ''}
                      {formatPct(it.deviasiPct)}% ({it.status.toUpperCase()})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TABEL MATRIKS DEVIASI CETAK */}
        <div className="space-y-1.5">
          <div className="font-bold text-xs text-slate-900">
            III. MATRIKS DEVIASI VOLUME &amp; KESUSUTAN PER JENIS KROSOK
          </div>
          <table className="w-full border-collapse border border-slate-300 text-[9.5px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold">
                <th className="border border-slate-300 py-1.5 px-2 text-left">No</th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">
                  Jenis Krosok
                </th>
                <th className="border border-slate-300 py-1.5 px-1.5 text-center">
                  Jalur
                </th>
                <th className="border border-slate-300 py-1.5 px-2 text-right">
                  Baku (Kg)
                </th>
                <th className="border border-slate-300 py-1.5 px-2 text-right">
                  Hasil (Kg)
                </th>
                <th className="border border-slate-300 py-1.5 px-2 text-right">
                  Riil (%)
                </th>
                <th className="border border-slate-300 py-1.5 px-2 text-right">
                  Acuan (%)
                </th>
                <th className="border border-slate-300 py-1.5 px-2 text-right">
                  Δ (%)
                </th>
                <th className="border border-slate-300 py-1.5 px-2 text-right">
                  Dampak (Kg)
                </th>
                <th className="border border-slate-300 py-1.5 px-1.5 text-center">
                  Status
                </th>
                <th className="border border-slate-300 py-1.5 px-2 text-left">
                  Analisis Faktor Pemicu
                </th>
              </tr>
            </thead>
            <tbody>
              {evaluation.items.map((it, idx) => (
                <tr key={it.key}>
                  <td className="border border-slate-300 py-1 px-2 font-mono">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 py-1 px-2 font-semibold">
                    {it.jenisKrosok}
                  </td>
                  <td className="border border-slate-300 py-1 px-1.5 text-center font-mono">
                    {it.jenisProses}
                  </td>
                  <td className="border border-slate-300 py-1 px-2 text-right font-mono">
                    {formatNum(it.bakuKg)}
                  </td>
                  <td className="border border-slate-300 py-1 px-2 text-right font-mono">
                    {formatNum(it.hasilKg)}
                  </td>
                  <td className="border border-slate-300 py-1 px-2 text-right font-mono font-bold">
                    {formatPct(it.susutPct)}%
                  </td>
                  <td className="border border-slate-300 py-1 px-2 text-right font-mono">
                    {formatPct(it.standarAcuanPct)}%
                  </td>
                  <td className="border border-slate-300 py-1 px-2 text-right font-mono font-bold">
                    {it.deviasiPct >= 0 ? '+' : ''}
                    {formatPct(it.deviasiPct)}%
                  </td>
                  <td className="border border-slate-300 py-1 px-2 text-right font-mono">
                    {it.dampakDeviasiKg >= 0 ? '+' : ''}
                    {formatNum(it.dampakDeviasiKg)}
                  </td>
                  <td className="border border-slate-300 py-1 px-1.5 text-center font-bold uppercase">
                    {it.status}
                  </td>
                  <td className="border border-slate-300 py-1 px-2">
                    <span className="font-semibold">{it.faktorDominan}</span>
                    {it.tagsSummary.length > 0 &&
                      ` (Tag: ${it.tagsSummary.map((t) => t.tag).join(', ')})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* REKOMENDASI TINDAK LANJUT CETAK */}
        <div className="border border-slate-300 rounded-lg p-3 space-y-1.5 avoid-break">
          <div className="font-bold text-xs text-slate-900">
            IV. REKOMENDASI &amp; RENCANA TINDAK LANJUT (RTL)
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[10px] text-slate-800">
            {evaluation.rekomendasiManajerial.map((rek, idx) => (
              <li key={idx}>{rek}</li>
            ))}
          </ol>
        </div>

        {/* BLOK TANDA TANGAN PENGESAHAN */}
        <div className="pt-4 avoid-break">
          <div className="text-right text-[10px] text-slate-700 mb-3">
            Malang (Wagir),{' '}
            {new Date().toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
          <div className="grid grid-cols-3 gap-6 text-center text-[10.5px]">
            <div className="border border-slate-300 rounded-lg p-3">
              <div className="font-semibold text-slate-600">Dibuat Oleh,</div>
              <div className="h-16" />
              <div className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                {signatories.dibuatNama}
              </div>
              <div className="text-[9.5px] text-slate-500">
                {signatories.dibuatJabatan}
              </div>
            </div>

            <div className="border border-slate-300 rounded-lg p-3">
              <div className="font-semibold text-slate-600">Diperiksa Oleh,</div>
              <div className="h-16" />
              <div className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                {signatories.diperiksaNama}
              </div>
              <div className="text-[9.5px] text-slate-500">
                {signatories.diperiksaJabatan}
              </div>
            </div>

            <div className="border border-slate-300 rounded-lg p-3">
              <div className="font-semibold text-slate-600">Disetujui Oleh,</div>
              <div className="h-16" />
              <div className="font-bold text-slate-900 border-t border-slate-400 pt-1">
                {signatories.disetujuiNama}
              </div>
              <div className="text-[9.5px] text-slate-500">
                {signatories.disetujuiJabatan}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
