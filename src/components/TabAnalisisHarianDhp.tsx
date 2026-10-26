import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  CloudRain,
  Droplets,
  Info,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sun,
  Tag,
  Thermometer,
  Wind
} from 'lucide-react';
import {
  BaselineConfigMeta,
  BatchFieldNote,
  DeviasiStatus,
  DhpKrosokItem,
  FactoryLocation,
  FactoryWeatherData,
  KrosokRecord,
  KrosokStandarAcuan,
  TacticalBatchEvaluation
} from '../types';
import { formatNum, formatPct, round2 } from '../services/dataService';
import {
  diagnoseKrosokDeviation,
  evaluateDhpBatch,
  findStandarForVariant,
  makeBatchNoteKey
} from '../services/acuanService';
import {
  getSelectedFactoryLocation,
  OFFICIAL_FACTORY_ADDRESS,
  PP1_FACTORY_LOCATIONS
} from '../services/weatherService';

interface TabAnalisisHarianDhpProps {
  dhpItems: DhpKrosokItem[];
  rekapRecords: KrosokRecord[];
  standarList: KrosokStandarAcuan[];
  baselineMeta: BaselineConfigMeta;
  batchNotes: Record<string, BatchFieldNote>;
  weatherData: FactoryWeatherData | null;
  weatherLoading?: boolean;
  onRefreshWeather?: (locationOverride?: FactoryLocation, forceRefresh?: boolean) => void;
  activeSheetDateLabel?: string;
  onOpenQuickTag?: (item: DhpKrosokItem, evalData: TacticalBatchEvaluation) => void;
  onNavigateToMonthlyAnalisis?: () => void;
}

interface DailyVariantComparisonRow {
  key: string;
  jenisKrosok: string;
  jalurProses: string;
  batchCount: number;
  bakuKg: number;
  hasilKg: number;
  susutKg: number;
  susutPct: number;
  gagangKg: number;
  gagangPct: number;
  debuKg: number;
  debuPct: number;
  uapAirKg: number;
  uapAirPct: number;
  acuanPct: number;
  waspadaPct: number;
  oosPct: number;
  deviasiPct: number;
  dampakKg: number;
  status: Exclude<DeviasiStatus, 'proses'>;
  faktorDominan: string;
  autoDiagnosaSingkat: string;
  tags: string[];
  catatan: string;
  sourceDhpItem?: DhpKrosokItem;
  sourceEvalData?: TacticalBatchEvaluation;
}

function buildAutoDiagnosaHarian(params: {
  status: Exclude<DeviasiStatus, 'proses'>;
  deviasiPct: number;
  susutPct: number;
  acuanPct: number;
  gagangPct: number;
  debuPct: number;
  uapAirPct: number;
  standar: KrosokStandarAcuan;
  bakuKg: number;
  jalurProses: string;
  weatherData: FactoryWeatherData | null;
  tags: string[];
  fallbackPenjelasan: string;
}): string {
  const {
    status,
    deviasiPct,
    susutPct,
    acuanPct,
    gagangPct,
    debuPct,
    uapAirPct,
    standar,
    bakuKg,
    jalurProses,
    weatherData,
    tags,
    fallbackPenjelasan
  } = params;

  const tagSuffix = tags.length > 0 ? ` [Konfirmasi Lapangan: ${tags.join(', ')}]` : '';

  if (status === 'normal') {
    return `Susut riil ${formatPct(susutPct)}% terkendali dalam batas wajar terhadap acuan ${formatPct(acuanPct)}%.${tagSuffix}`;
  }

  // Negative deviation (Susut riil lebih rendah dari acuan / penambahan bobot uap air)
  if (deviasiPct < 0) {
    const rhInfo =
      weatherData && weatherData.humidity >= 75
        ? ` seiring kelembaban udara pabrik tinggi (RH ${Math.round(weatherData.humidity)}%)`
        : '';
    return `Susut lebih rendah ${formatPct(Math.abs(deviasiPct))}% dari acuan${rhInfo}; indikasi serapan uap air / penambahan air conditioning (${formatPct(Math.abs(uapAirPct))}% baku).${tagSuffix}`;
  }

  // Positive deviation (Susut riil melampaui acuan: analisis delta komponen terhadap histori varian)
  const deltaGagang = round2(gagangPct - (standar.avgGagangPct || 0));
  const currentDebuAir = round2(debuPct + uapAirPct);
  const deltaDebuAir = round2(currentDebuAir - (standar.avgDebuAirPct || 0));

  // 1. Cek kenaikan kadar air / uap dominan
  if (uapAirPct > gagangPct && uapAirPct > debuPct && uapAirPct >= 0.35) {
    const airRise = deltaDebuAir > 0.1 ? `+${formatPct(deltaDebuAir)}%` : `${formatPct(uapAirPct)}%`;
    const weatherHint =
      weatherData && (weatherData.humidity >= 76 || weatherData.precipitation > 0)
        ? 'kemungkinan bahan baku masuk lembab/hujan'
        : weatherData && weatherData.temperature >= 29.5
        ? `dipicu penguapan ruang suhu ${weatherData.temperature.toFixed(1)}°C`
        : 'kemungkinan bahan masuk lembab atau penguapan kadar air awal tinggi';
    return `Terjadi pelepasan susut air/uap ${airRise} (${weatherHint}), memicu deviasi total +${formatPct(deviasiPct)}% di atas acuan.${tagSuffix}`;
  }

  // 2. Cek kenaikan fraksi gagang
  if (gagangPct >= 0.5 && (deltaGagang >= 0.25 || gagangPct >= uapAirPct)) {
    const gagangInfo =
      deltaGagang > 0.1
        ? `kenaikan fraksi gagang +${formatPct(deltaGagang)}% dari histori varian`
        : `proporsi pemisahan gagang ${formatPct(gagangPct)}%`;
    return `Terdeteksi ${gagangInfo} (karakter tulang daun krosok tebal), menyumbang deviasi +${formatPct(deviasiPct)}%.${tagSuffix}`;
  }

  // 3. Cek pelepasan debu
  if (debuPct >= 0.25) {
    return `Terjadi pelepasan fraksi debu ${formatPct(debuPct)}% dari baku (indikasi daun krosok kering/getas atau tarikan hisapan pemisah jalur ${jalurProses}).${tagSuffix}`;
  }

  // 4. Cek kapasitas batch kecil
  if (standar.avgBatchBakuKg > 350 && bakuKg < standar.avgBatchBakuKg * 0.45) {
    return `Kapasitas olah kecil (${formatNum(bakuKg)} Kg vs rata-rata ${formatNum(standar.avgBatchBakuKg)} Kg) menaikkan rasio sisa mekanis jalur ${jalurProses} (+${formatPct(deviasiPct)}%).${tagSuffix}`;
  }

  return fallbackPenjelasan;
}

export const TabAnalisisHarianDhp: React.FC<TabAnalisisHarianDhpProps> = ({
  dhpItems,
  rekapRecords,
  standarList,
  baselineMeta,
  batchNotes,
  weatherData,
  weatherLoading = false,
  onRefreshWeather,
  activeSheetDateLabel = '',
  onOpenQuickTag,
  onNavigateToMonthlyAnalisis
}) => {
  const completedDhpItems = useMemo(
    () => dhpItems.filter((i) => i.baku > 0 && i.hasil > 0),
    [dhpItems]
  );
  const inProgressDhpItems = useMemo(
    () => dhpItems.filter((i) => i.baku > 0 && i.hasil <= 0),
    [dhpItems]
  );

  // Identify latest real production day in Rekap Susut Krosok (Single Source of Truth)
  const latestRekapBundle = useMemo(() => {
    const valid = rekapRecords.filter((r) => r.baku > 0 && r.hasil > 0 && r.tanggal);
    if (valid.length === 0) {
      return {
        tanggalIso: '',
        tanggalDisplay: '',
        rows: [] as KrosokRecord[]
      };
    }
    let maxIso = valid[0].tanggal;
    for (let i = 1; i < valid.length; i++) {
      if (valid[i].tanggal > maxIso) {
        maxIso = valid[i].tanggal;
      }
    }
    const rows = valid.filter((r) => r.tanggal === maxIso);
    return {
      tanggalIso: maxIso,
      tanggalDisplay: rows[0]?.tanggalDisplay || maxIso,
      rows
    };
  }, [rekapRecords]);

  // Default to Live DHP whenever completed DHP batches exist; allow switching cleanly
  const [sourceMode, setSourceMode] = useState<'dhp_live' | 'rekap_terakhir'>(() =>
    completedDhpItems.length > 0 || latestRekapBundle.rows.length === 0
      ? 'dhp_live'
      : 'rekap_terakhir'
  );

  // Automatically promote to Live DHP as soon as live completed batches arrive
  useEffect(() => {
    if (completedDhpItems.length > 0) {
      setSourceMode('dhp_live');
    }
  }, [completedDhpItems.length]);

  // Build daily variant comparison rows strictly from selected real data source
  const dailyAnalysis = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        jenisKrosok: string;
        jalurProses: string;
        batchCount: number;
        bakuKg: number;
        hasilKg: number;
        susutKg: number;
        gagangKg: number;
        debuKg: number;
        uapAirKg: number;
        tagsSet: Set<string>;
        catatanList: string[];
        firstDhpItem?: DhpKrosokItem;
        firstEvalData?: TacticalBatchEvaluation;
      }
    >();

    if (sourceMode === 'dhp_live') {
      completedDhpItems.forEach((item) => {
        const evalData = evaluateDhpBatch(item, standarList, batchNotes, weatherData);
        const jalur = item.jalurProses || 'SKT';
        const key = `${item.jenisTembakau.toLowerCase()}|${jalur}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            jenisKrosok: item.jenisTembakau,
            jalurProses: jalur,
            batchCount: 0,
            bakuKg: 0,
            hasilKg: 0,
            susutKg: 0,
            gagangKg: 0,
            debuKg: 0,
            uapAirKg: 0,
            tagsSet: new Set<string>(),
            catatanList: [],
            firstDhpItem: item,
            firstEvalData: evalData
          });
        }
        const g = groupMap.get(key)!;
        const susut = round2(item.baku - item.hasil);
        const gagang = round2(item.gagangKg || 0);
        const debu = round2(item.debuKg || 0);
        const uapAir = round2(susut - (gagang + debu));

        g.batchCount += 1;
        g.bakuKg = round2(g.bakuKg + item.baku);
        g.hasilKg = round2(g.hasilKg + item.hasil);
        g.susutKg = round2(g.susutKg + susut);
        g.gagangKg = round2(g.gagangKg + gagang);
        g.debuKg = round2(g.debuKg + debu);
        g.uapAirKg = round2(g.uapAirKg + uapAir);
        evalData.tags.forEach((t) => g.tagsSet.add(t));
        if (evalData.catatan) g.catatanList.push(evalData.catatan);
      });
    } else {
      latestRekapBundle.rows.forEach((rec) => {
        const jalur = rec.jenisProses || 'SKT';
        const key = `${rec.jenisKrosok.toLowerCase()}|${jalur}`;
        const noteKey = makeBatchNoteKey(rec.tanggal, rec.jenisKrosok, rec.baku);
        const note = batchNotes[noteKey];

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            jenisKrosok: rec.jenisKrosok,
            jalurProses: jalur,
            batchCount: 0,
            bakuKg: 0,
            hasilKg: 0,
            susutKg: 0,
            gagangKg: 0,
            debuKg: 0,
            uapAirKg: 0,
            tagsSet: new Set<string>(),
            catatanList: []
          });
        }
        const g = groupMap.get(key)!;
        const susut = round2(rec.baku - rec.hasil);
        const gagang = round2(rec.gagangKg || 0);
        const debu = round2(rec.debuKg || 0);
        // Physical mass balance: moisture evaporation / gain is exact residual after weighed stem & dust
        const uapAir = round2(susut - (gagang + debu));

        g.batchCount += 1;
        g.bakuKg = round2(g.bakuKg + rec.baku);
        g.hasilKg = round2(g.hasilKg + rec.hasil);
        g.susutKg = round2(g.susutKg + susut);
        g.gagangKg = round2(g.gagangKg + gagang);
        g.debuKg = round2(g.debuKg + debu);
        g.uapAirKg = round2(g.uapAirKg + uapAir);
        if (note?.tags) note.tags.forEach((t) => g.tagsSet.add(t));
        if (note?.catatan) g.catatanList.push(note.catatan);
      });
    }

    const rows: DailyVariantComparisonRow[] = [];
    let totalBaku = 0;
    let totalHasil = 0;
    let totalSusut = 0;
    let totalGagang = 0;
    let totalDebu = 0;
    let totalUapAir = 0;
    let weightedAcuanKg = 0;

    Array.from(groupMap.entries()).forEach(([key, g]) => {
      if (g.bakuKg <= 0) return;
      const standar = findStandarForVariant(g.jenisKrosok, g.jalurProses, standarList);
      const susutPct = round2((g.susutKg / g.bakuKg) * 100);
      const gagangPct = round2((g.gagangKg / g.bakuKg) * 100);
      const debuPct = round2((g.debuKg / g.bakuKg) * 100);
      const uapAirPct = round2((g.uapAirKg / g.bakuKg) * 100);
      const deviasiPct = round2(susutPct - standar.standarSusutPct);
      const dampakKg = round2((deviasiPct / 100) * g.bakuKg);
      const tags = Array.from(g.tagsSet);

      const diag = diagnoseKrosokDeviation({
        susutPct,
        acuanPct: standar.standarSusutPct,
        waspadaPct: standar.toleransiWaspadaPct,
        oosPct: standar.toleransiOosPct,
        gagangPct,
        debuPct,
        uapAirPct,
        bakuKg: round2(g.bakuKg / Math.max(1, g.batchCount)),
        avgBatchRefKg: standar.avgBatchBakuKg || 0,
        jalurProses: g.jalurProses,
        humidity: weatherData?.humidity,
        temperature: weatherData?.temperature,
        tags
      });

      const autoDiagnosaSingkat = buildAutoDiagnosaHarian({
        status: diag.status,
        deviasiPct,
        susutPct,
        acuanPct: standar.standarSusutPct,
        gagangPct,
        debuPct,
        uapAirPct,
        standar,
        bakuKg: round2(g.bakuKg / Math.max(1, g.batchCount)),
        jalurProses: g.jalurProses,
        weatherData,
        tags,
        fallbackPenjelasan: diag.penjelasan
      });

      totalBaku = round2(totalBaku + g.bakuKg);
      totalHasil = round2(totalHasil + g.hasilKg);
      totalSusut = round2(totalSusut + g.susutKg);
      totalGagang = round2(totalGagang + g.gagangKg);
      totalDebu = round2(totalDebu + g.debuKg);
      totalUapAir = round2(totalUapAir + g.uapAirKg);
      weightedAcuanKg += (standar.standarSusutPct / 100) * g.bakuKg;

      rows.push({
        key,
        jenisKrosok: g.jenisKrosok,
        jalurProses: g.jalurProses,
        batchCount: g.batchCount,
        bakuKg: g.bakuKg,
        hasilKg: g.hasilKg,
        susutKg: g.susutKg,
        susutPct,
        gagangKg: g.gagangKg,
        gagangPct,
        debuKg: g.debuKg,
        debuPct,
        uapAirKg: g.uapAirKg,
        uapAirPct,
        acuanPct: standar.standarSusutPct,
        waspadaPct: standar.toleransiWaspadaPct,
        oosPct: standar.toleransiOosPct,
        deviasiPct,
        dampakKg,
        status: diag.status,
        faktorDominan: diag.faktorDominan,
        autoDiagnosaSingkat,
        tags,
        catatan: g.catatanList.join('; '),
        sourceDhpItem: g.firstDhpItem,
        sourceEvalData: g.firstEvalData
      });
    });

    // Sort: OOS first, then Waspada, then highest absolute deviation impact
    const rank = { oos: 0, waspada: 1, normal: 2 };
    rows.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return Math.abs(b.dampakKg) - Math.abs(a.dampakKg);
    });

    const overallSusutPct = totalBaku > 0 ? round2((totalSusut / totalBaku) * 100) : 0;
    const overallAcuanPct = totalBaku > 0 ? round2((weightedAcuanKg / totalBaku) * 100) : 0;
    const overallDeviasiPct = round2(overallSusutPct - overallAcuanPct);
    const gagangPctBaku = totalBaku > 0 ? round2((totalGagang / totalBaku) * 100) : 0;
    const debuPctBaku = totalBaku > 0 ? round2((totalDebu / totalBaku) * 100) : 0;
    const uapAirPctBaku = totalBaku > 0 ? round2((totalUapAir / totalBaku) * 100) : 0;

    // Share of shrinkage (safe against negative or zero susut)
    const absSumParts =
      Math.abs(totalGagang) + Math.abs(totalUapAir) + Math.abs(totalDebu);
    const gagangSharePct =
      absSumParts > 0 ? round2((Math.abs(totalGagang) / absSumParts) * 100) : 0;
    const uapAirSharePct =
      absSumParts > 0 ? round2((Math.abs(totalUapAir) / absSumParts) * 100) : 0;
    const debuSharePct =
      absSumParts > 0 ? round2((Math.abs(totalDebu) / absSumParts) * 100) : 0;

    const oosRows = rows.filter((r) => r.status === 'oos');
    const waspadaRows = rows.filter((r) => r.status === 'waspada');
    const primaryAlertRow = oosRows[0] || waspadaRows[0] || null;

    return {
      rows,
      totalBaku,
      totalHasil,
      totalSusut,
      totalGagang,
      totalDebu,
      totalUapAir,
      overallSusutPct,
      overallAcuanPct,
      overallDeviasiPct,
      gagangPctBaku,
      debuPctBaku,
      uapAirPctBaku,
      gagangSharePct,
      uapAirSharePct,
      debuSharePct,
      oosCount: oosRows.length,
      waspadaCount: waspadaRows.length,
      normalCount: rows.length - oosRows.length - waspadaRows.length,
      primaryAlertRow
    };
  }, [
    sourceMode,
    completedDhpItems,
    latestRekapBundle.rows,
    standarList,
    batchNotes,
    weatherData
  ]);

  const activeDateText =
    sourceMode === 'dhp_live'
      ? completedDhpItems[0]?.tanggalDisplay ||
        inProgressDhpItems[0]?.tanggalDisplay ||
        activeSheetDateLabel ||
        'Hari Ini (Live DHP)'
      : latestRekapBundle.tanggalDisplay || 'Hari Terakhir Rekap';

  const inProgressBakuTotal = useMemo(
    () => round2(inProgressDhpItems.reduce((acc, i) => acc + i.baku, 0)),
    [inProgressDhpItems]
  );

  // Live Telemetry Location & Auto-Poll Lifecycle (Open-Meteo Real-Time — Locked to PT BATU KARANG Wagir)
  const [showHourlyTrend, setShowHourlyTrend] = useState<boolean>(false);

  // Immediately pull telemetry if missing on mount, plus 5-minute live background refresh
  useEffect(() => {
    if (!onRefreshWeather) return;
    if (!weatherData && !weatherLoading) {
      onRefreshWeather(PP1_FACTORY_LOCATIONS[0], false);
    }
    const liveInterval = setInterval(() => {
      onRefreshWeather(PP1_FACTORY_LOCATIONS[0], true);
    }, 300_000);
    return () => clearInterval(liveInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefreshWeather]);

  const activeFactoryLocation = useMemo(
    () => weatherData?.location || getSelectedFactoryLocation(),
    [weatherData?.location]
  );

  const fetchedTimeWib = useMemo(() => {
    if (!weatherData?.fetchedAt) return '';
    try {
      const d = new Date(weatherData.fetchedAt);
      if (isNaN(d.getTime())) return '';
      return `${new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
      }).format(d)} WIB`;
    } catch {
      return '';
    }
  }, [weatherData?.fetchedAt]);

  const hygroCardTheme = useMemo(() => {
    const st = weatherData?.hygroIndex.status;
    if (!st || st === 'Optimal') {
      return {
        box: 'bg-emerald-950/45 border-emerald-700/60',
        label: 'text-emerald-300/90',
        value: 'text-emerald-400',
        code: 'STABIL',
        sub: 'text-emerald-300/75'
      };
    }
    if (st === 'Lembab / Hujan') {
      return {
        box: 'bg-sky-950/50 border-sky-700/60',
        label: 'text-sky-300/90',
        value: 'text-sky-300',
        code: 'LEMBAB',
        sub: 'text-sky-300/75'
      };
    }
    if (st === 'Panas Ekstrem') {
      return {
        box: 'bg-rose-950/50 border-rose-700/60',
        label: 'text-rose-300/90',
        value: 'text-rose-400',
        code: 'UAP TINGGI',
        sub: 'text-rose-300/75'
      };
    }
    return {
      box: 'bg-amber-950/45 border-amber-700/60',
      label: 'text-amber-300/90',
      value: 'text-amber-400',
      code: 'WASPADA UAP',
      sub: 'text-amber-300/75'
    };
  }, [weatherData?.hygroIndex.status]);

  // Extract 6-hour microclimate telemetry window centered around current WIB hour
  const hourlySlots = useMemo(() => {
    const list = weatherData?.hourly || [];
    if (list.length === 0) return [];
    const nowWib = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 13);
    const currentIdx = list.findIndex((pt) => pt.timeIso.startsWith(nowWib));
    const startIdx =
      currentIdx >= 0
        ? Math.max(0, Math.min(list.length - 6, currentIdx - 2))
        : Math.max(0, list.length - 6);
    return list.slice(startIdx, startIdx + 6);
  }, [weatherData?.hourly]);

  const handleManualTelemetryRefresh = () => {
    if (!onRefreshWeather) return;
    onRefreshWeather(activeFactoryLocation, true);
  };

  // Dedicated Live Telemetry Console (Upper Viewport Priority)
  const liveTelemetriPanel = (
    <div className="rounded-xl bg-slate-950 text-white p-3.5 sm:p-4 border border-slate-800 space-y-3 shadow-xs">
      {/* Header Row: Title + Live Telemetry Status on Left | Factory Location Selector + Refresh + Address on Right */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-2.5 border-b border-slate-800/90 pb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/35 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
            <Thermometer className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold tracking-wide uppercase text-white">
                Iklim Lingkungan Pabrik &amp; Indeks Higroskopis Real-Time
              </h4>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-emerald-400 tabular-nums">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    weatherLoading ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <span>
                  {weatherLoading
                    ? 'MENYINKRONKAN TELEMETRI...'
                    : `LIVE TELEMETRI${fetchedTimeWib ? ` · ${fetchedTimeWib}` : ''}`}
                </span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Menganalisis pengaruh suhu &amp; kelembaban (RH%) terhadap laju penguapan air dan
              kerapuhan debu krosok
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:items-end gap-1.5 shrink-0 lg:max-w-[54%]">
          <div className="flex flex-wrap items-center lg:justify-end gap-1.5 w-full">
            <div
              className="min-h-[34px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-semibold text-slate-100"
              title="Titik koordinat sensor satelit dikunci pada lokasi resmi pabrik PT BATU KARANG"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">PT BATU KARANG — Wagir, Kab. Malang</span>
              <span className="hidden sm:inline font-mono text-[10px] text-sky-400">
                ({activeFactoryLocation.lat.toFixed(4)}, {activeFactoryLocation.lon.toFixed(4)})
              </span>
            </div>

            {onRefreshWeather && (
              <button
                type="button"
                onClick={handleManualTelemetryRefresh}
                disabled={weatherLoading}
                aria-label="Segarkan telemetri cuaca pabrik"
                title="Tarik ulang telemetri cuaca aktual dari sensor satelit lokasi pabrik PT BATU KARANG"
                className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-sky-400 ${weatherLoading ? 'animate-spin' : ''}`}
                />
              </button>
            )}

            {hourlySlots.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHourlyTrend((prev) => !prev)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[10.5px] font-semibold transition-colors cursor-pointer shrink-0 ${
                  showHourlyTrend
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
                title="Tampilkan tren mikroklimat 6 jam"
              >
                6 Jam
              </button>
            )}
          </div>

          <div className="text-[10.5px] text-slate-300 lg:text-right leading-snug">
            {activeFactoryLocation.address || OFFICIAL_FACTORY_ADDRESS}
          </div>
        </div>
      </div>

      {weatherData ? (
        <>
          {/* 4 Live Telemetry Readout Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 tabular-nums">
            {/* 1. Suhu Udara */}
            <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2.5">
              <div className="text-[10.5px] text-slate-400 flex items-center justify-between gap-1">
                <span>Suhu Udara</span>
                <Thermometer className="w-3 h-3 text-amber-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-base sm:text-lg font-bold text-white">
                  {weatherData.temperature.toFixed(1)}°C
                </span>
                <span className="text-[10.5px] text-slate-400">Ambien</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Elevasi {weatherData.location.elevationM ?? 444}m dpl
              </div>
            </div>

            {/* 2. Kelembaban (RH) */}
            <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2.5">
              <div className="text-[10.5px] text-slate-400 flex items-center justify-between gap-1">
                <span>Kelembaban (RH)</span>
                <Droplets className="w-3 h-3 text-sky-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-mono text-base sm:text-lg font-bold text-sky-400">
                  {Math.round(weatherData.humidity)}%
                </span>
                <span className="text-[10.5px] text-slate-400">Relatif</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Presipitasi {weatherData.precipitation.toFixed(1)} mm
              </div>
            </div>

            {/* 3. Kondisi Cuaca */}
            <div className="rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2.5">
              <div className="text-[10.5px] text-slate-400 flex items-center justify-between gap-1">
                <span>Kondisi Cuaca</span>
                {weatherData.precipitation > 0 ? (
                  <CloudRain className="w-3 h-3 text-sky-300 shrink-0" />
                ) : (
                  <Sun className="w-3 h-3 text-amber-300 shrink-0" />
                )}
              </div>
              <div
                className="text-xs sm:text-sm font-bold text-white mt-1 truncate"
                title={weatherData.weatherDesc}
              >
                {weatherData.weatherDesc}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-mono">
                <Wind className="w-3 h-3 text-slate-500 shrink-0" />
                <span>{Math.round(weatherData.windSpeed)} km/j</span>
                <span className="text-slate-600">·</span>
                <span>{weatherData.isDay ? 'Siang' : 'Malam'}</span>
              </div>
            </div>

            {/* 4. Indeks Higroskopis */}
            <div className={`rounded-lg border px-3 py-2.5 ${hygroCardTheme.box}`}>
              <div className={`text-[10.5px] font-medium ${hygroCardTheme.label}`}>
                Indeks Higroskopis
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                <span className={`text-xs sm:text-sm font-bold ${hygroCardTheme.value}`}>
                  {weatherData.hygroIndex.status}
                </span>
                <span className="font-mono text-[10px] font-semibold tracking-wider opacity-85 text-white">
                  {hygroCardTheme.code}
                </span>
              </div>
              <div className={`text-[10px] mt-0.5 font-mono ${hygroCardTheme.sub}`}>
                Uap: {weatherData.hygroIndex.potensiPenguapan} · Debu:{' '}
                {weatherData.hygroIndex.resikoDebu}
              </div>
            </div>
          </div>

          {/* Optional 6-Hour Microclimate Telemetry Strip */}
          {showHourlyTrend && hourlySlots.length > 0 && (
            <div className="rounded-lg bg-slate-900/95 border border-slate-800 px-3 py-2 space-y-1.5 tabular-nums">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
                <span className="font-semibold text-sky-300">
                  Tren Telemetri Jam-Jaman ({activeFactoryLocation.region})
                </span>
                <span className="font-mono">
                  Koordinat {activeFactoryLocation.lat.toFixed(4)},{' '}
                  {activeFactoryLocation.lon.toFixed(4)} · 14 Hari Terakhir:{' '}
                  {weatherData.rainyDaysLast14d} hari hujan
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {hourlySlots.map((slot) => (
                  <div
                    key={slot.timeIso}
                    className="rounded bg-slate-950/80 border border-slate-800/80 px-2 py-1 text-center font-mono text-[10.5px]"
                  >
                    <div className="text-slate-400 text-[10px]">
                      {slot.timeIso.slice(11, 16) || slot.timeIso}
                    </div>
                    <div className="font-bold text-white mt-0.5">
                      {slot.temperature.toFixed(1)}°C
                    </div>
                    <div className="text-sky-400 text-[10px]">
                      RH {Math.round(slot.humidity)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom 2-Column Correlation & Process Control Recommendation */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5 text-[11px]">
            <div className="lg:col-span-2 rounded-lg bg-slate-900/85 border border-slate-800 p-3 leading-relaxed text-slate-300">
              <div className="font-bold text-sky-300 mb-1">
                Korelasi Cuaca &amp; Susut Krosok Hari Ini ({activeDateText}):
              </div>
              <p>
                Pada suhu <strong className="font-mono text-white">{weatherData.temperature.toFixed(1)}°C</strong>{' '}
                &amp; RH <strong className="font-mono text-sky-300">{Math.round(weatherData.humidity)}%</strong>:{' '}
                {weatherData.hygroIndex.analisisKorelasi}
                {dailyAnalysis.rows.length > 0 && (
                  <>
                    {' '}
                    Neraca fisik hari ini mencatat{' '}
                    {dailyAnalysis.totalUapAir >= 0 ? 'penguapan air' : 'serapan uap air'}{' '}
                    <strong className="text-sky-300 font-mono">
                      {dailyAnalysis.totalUapAir < 0 ? '+' : ''}
                      {formatNum(Math.abs(dailyAnalysis.totalUapAir))} Kg (
                      {formatPct(Math.abs(dailyAnalysis.uapAirPctBaku))}% dari baku)
                    </strong>
                    , pemisahan debu{' '}
                    <strong className="text-amber-300 font-mono">
                      {formatNum(dailyAnalysis.totalDebu)} Kg (
                      {formatPct(dailyAnalysis.debuPctBaku)}%)
                    </strong>
                    , serta fraksi gagang{' '}
                    <strong className="text-slate-100 font-mono">
                      {formatNum(dailyAnalysis.totalGagang)} Kg (
                      {formatPct(dailyAnalysis.gagangPctBaku)}%)
                    </strong>
                    .
                  </>
                )}
              </p>
            </div>

            <div className="rounded-lg bg-slate-900/85 border border-slate-800 p-3 leading-relaxed text-slate-300 flex flex-col justify-between gap-2">
              <div>
                <div className="font-bold text-amber-300 uppercase tracking-wide text-[10.5px] mb-1">
                  Rekomendasi Kontrol Mesin / Proses:
                </div>
                <p>{weatherData.hygroIndex.rekomendasiOperasional}</p>
              </div>
              {onNavigateToMonthlyAnalisis && (
                <button
                  type="button"
                  onClick={onNavigateToMonthlyAnalisis}
                  className="min-h-[32px] self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10.5px] font-semibold text-sky-300 transition-colors cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>Buka Evaluasi Bulanan &amp; Acuan</span>
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="py-5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
          <span>
            Menghubungkan telemetri cuaca aktual {activeFactoryLocation.name}...
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Top Bar: Active Evaluation Date & Source Mode Switcher */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 flex-wrap">
            <span>Alarm Dini &amp; Evaluasi Susut Harian</span>
            <span className="text-slate-400 font-normal" aria-hidden="true">
              ·
            </span>
            <span className="text-blue-700 font-semibold">{activeDateText}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Standar Acuan Aktif:{' '}
            <strong className="text-slate-700">{baselineMeta.periodeLabel}</strong> · Sumber
            kebenaran tunggal Data Krosok
          </p>
        </div>

        {/* Clean Segmented Toggle: Live DHP vs Hari Proses Terakhir (Rekap) */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/75 rounded-lg self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setSourceMode('dhp_live')}
            className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
              sourceMode === 'dhp_live'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live DHP ({completedDhpItems.length} Selesai)
          </button>
          {latestRekapBundle.rows.length > 0 && (
            <button
              type="button"
              onClick={() => setSourceMode('rekap_terakhir')}
              className={`min-h-[32px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                sourceMode === 'rekap_terakhir'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hari Terakhir Rekap ({latestRekapBundle.tanggalDisplay})
            </button>
          )}
        </div>
      </div>

      {/* Contextual Notice when morning DHP is 0 and viewing Latest Rekap Day, OR when DHP has unfinished batches */}
      {sourceMode === 'rekap_terakhir' && completedDhpItems.length === 0 && (
        <div className="px-3 py-2 rounded-lg bg-blue-50/80 border border-blue-200 text-[11px] text-blue-900 flex flex-wrap items-center justify-between gap-2">
          <span>
            Sheet DHP hari ini{activeSheetDateLabel ? ` (${activeSheetDateLabel})` : ''} belum
            memiliki batch selesai ditimbang — menampilkan evaluasi{' '}
            <strong>Hari Proses Terakhir ({latestRekapBundle.tanggalDisplay})</strong> dari
            Rekap Susut Krosok. Begitu timbangan hasil DHP hari ini masuk, tab otomatis
            beralih ke <strong>Live DHP</strong>.
          </span>
        </div>
      )}

      {sourceMode === 'dhp_live' && inProgressDhpItems.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            <strong>{inProgressDhpItems.length} batch aktif</strong> (
            <span className="font-mono font-semibold">{formatNum(inProgressBakuTotal)} Kg</span>{' '}
            Baku) sedang dalam proses pengolahan dan dikecualikan dari rata-rata susut harian
            hingga Netto Hasil selesai ditimbang.
          </span>
        </div>
      )}

      {/* Empty State when Live DHP is selected and has 0 completed batches */}
      {dailyAnalysis.rows.length === 0 ? (
        <div className="space-y-3">
          {/* Live Telemetry remains visible in morning shift before first batch completes */}
          {liveTelemetriPanel}

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-7 text-center space-y-2">
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-blue-600">
              <Info className="w-4 h-4" />
            </div>
            <div className="text-xs sm:text-sm font-semibold text-slate-800">
              Belum ada batch selesai ditimbang pada Sheet DHP hari ini
              {activeSheetDateLabel ? ` (${activeSheetDateLabel})` : ''}.
            </div>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Begitu timbangan Netto Hasil batch pertama diinput ke Sheet DHP Krosok, sistem
              Alarm Dini otomatis menghitung dekomposisi susut Air, Gagang, dan Debu terhadap
              standar acuan.
            </p>
            {latestRekapBundle.rows.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setSourceMode('rekap_terakhir')}
                  className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                >
                  <span>
                    Tinjau Hari Proses Terakhir ({latestRekapBundle.tanggalDisplay})
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* SECTION 1 (TOP PRIORITY): EARLY WARNING AUTO-DIAGNOSA BANNER */}
          <div
            className={`p-3.5 rounded-xl border ${
              dailyAnalysis.oosCount > 0
                ? 'bg-rose-50/80 border-rose-200 text-rose-950'
                : dailyAnalysis.waspadaCount > 0
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-emerald-50/75 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold flex-wrap">
                  {dailyAnalysis.oosCount > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : dailyAnalysis.waspadaCount > 0 ? (
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>
                    {dailyAnalysis.oosCount > 0
                      ? `Alarm Dini Harian: ${dailyAnalysis.oosCount} Varian OOS${
                          dailyAnalysis.waspadaCount > 0
                            ? ` & ${dailyAnalysis.waspadaCount} Waspada`
                            : ''
                        } dari ${dailyAnalysis.rows.length} Jenis Krosok`
                      : dailyAnalysis.waspadaCount > 0
                      ? `Peringatan Dini: ${dailyAnalysis.waspadaCount} Varian Waspada dari ${dailyAnalysis.rows.length} Jenis Krosok`
                      : `Proses Harian Terkendali: Seluruh ${dailyAnalysis.rows.length} Jenis Krosok Sesuai Standar Acuan`}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-800">
                  {dailyAnalysis.primaryAlertRow ? (
                    <>
                      <strong>
                        {dailyAnalysis.primaryAlertRow.jenisKrosok} (
                        {dailyAnalysis.primaryAlertRow.jalurProses}):
                      </strong>{' '}
                      {dailyAnalysis.primaryAlertRow.autoDiagnosaSingkat}
                    </>
                  ) : (
                    <>
                      Rata-rata susut tertimbang harian tercatat{' '}
                      <strong className="font-mono">
                        {formatPct(dailyAnalysis.overallSusutPct)}%
                      </strong>{' '}
                      terhadap acuan{' '}
                      <strong className="font-mono">
                        {formatPct(dailyAnalysis.overallAcuanPct)}%
                      </strong>{' '}
                      (Δ{' '}
                      <span className="font-mono font-semibold">
                        {dailyAnalysis.overallDeviasiPct >= 0 ? '+' : ''}
                        {formatPct(dailyAnalysis.overallDeviasiPct)}%
                      </span>
                      ). Tidak ditemukan lonjakan fraksi air, gagang, maupun debu di luar batas
                      kendali.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3 sm:text-right shrink-0 pt-1 sm:pt-0 border-t border-black/5 sm:border-0 tabular-nums">
                <div>
                  <div className="text-[10px] font-semibold opacity-75">Susut Harian vs Acuan</div>
                  <div className="font-mono text-xs sm:text-sm font-bold">
                    {formatPct(dailyAnalysis.overallSusutPct)}%{' '}
                    <span className="text-[11px] font-normal opacity-80">
                      / {formatPct(dailyAnalysis.overallAcuanPct)}%
                    </span>
                  </div>
                </div>
                <div className="h-6 w-px bg-black/10" aria-hidden="true"></div>
                <div>
                  <div className="text-[10px] font-semibold opacity-75">Selisih Harian (Δ)</div>
                  <div
                    className={`font-mono text-xs sm:text-sm font-bold ${
                      dailyAnalysis.oosCount > 0
                        ? 'text-rose-700'
                        : dailyAnalysis.waspadaCount > 0
                        ? 'text-amber-800'
                        : 'text-emerald-700'
                    }`}
                  >
                    {dailyAnalysis.overallDeviasiPct >= 0 ? '+' : ''}
                    {formatPct(dailyAnalysis.overallDeviasiPct)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: 3 KARTU DEKOMPOSISI NERACA FRAKSI HARIAN (MURNI TANPA BUG 100% DEBU) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Fraksi Gagang */}
            <div className="rounded-xl bg-slate-900 text-white px-3.5 py-2.5 border border-slate-800 flex items-center justify-between gap-2 tabular-nums">
              <div className="min-w-0">
                <div className="text-[10.5px] font-medium text-slate-400">
                  Total Fraksi Gagang
                </div>
                <div className="font-mono text-sm sm:text-base font-bold text-white mt-0.5">
                  {formatNum(dailyAnalysis.totalGagang)} Kg
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Porsi {formatPct(dailyAnalysis.gagangSharePct)}% dari total susut
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xs sm:text-sm font-bold text-slate-200">
                  {formatPct(dailyAnalysis.gagangPctBaku)}%
                </div>
                <div className="text-[10px] text-slate-400">dari Baku</div>
              </div>
            </div>

            {/* Penguapan / Serapan Air */}
            <div className="rounded-xl bg-slate-900 text-white px-3.5 py-2.5 border border-sky-900/70 flex items-center justify-between gap-2 tabular-nums">
              <div className="min-w-0">
                <div className="text-[10.5px] font-medium text-sky-300 flex items-center gap-1">
                  <Droplets className="w-3 h-3 shrink-0" />
                  <span>
                    {dailyAnalysis.totalUapAir >= 0
                      ? 'Total Penguapan Air (Uap)'
                      : 'Serapan Air / Conditioning'}
                  </span>
                </div>
                <div className="font-mono text-sm sm:text-base font-bold text-white mt-0.5">
                  {dailyAnalysis.totalUapAir < 0 ? '+' : ''}
                  {formatNum(Math.abs(dailyAnalysis.totalUapAir))} Kg
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {dailyAnalysis.totalUapAir >= 0
                    ? `Porsi ${formatPct(dailyAnalysis.uapAirSharePct)}% dari total susut`
                    : 'Penambahan bobot lembab / air'}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xs sm:text-sm font-bold text-sky-300">
                  {dailyAnalysis.uapAirPctBaku >= 0 ? '' : '+'}
                  {formatPct(Math.abs(dailyAnalysis.uapAirPctBaku))}%
                </div>
                <div className="text-[10px] text-slate-400">dari Baku</div>
              </div>
            </div>

            {/* Pemisahan Debu */}
            <div className="rounded-xl bg-slate-900 text-white px-3.5 py-2.5 border border-amber-900/60 flex items-center justify-between gap-2 tabular-nums">
              <div className="min-w-0">
                <div className="text-[10.5px] font-medium text-amber-300">
                  Total Pemisahan Debu
                </div>
                <div className="font-mono text-sm sm:text-base font-bold text-white mt-0.5">
                  {formatNum(dailyAnalysis.totalDebu)} Kg
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Porsi {formatPct(dailyAnalysis.debuSharePct)}% dari total susut
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-xs sm:text-sm font-bold text-amber-300">
                  {formatPct(dailyAnalysis.debuPctBaku)}%
                </div>
                <div className="text-[10px] text-slate-400">dari Baku</div>
              </div>
            </div>
          </div>

          {/* SECTION 3 (UPPER VIEWPORT): LIVE TELEMETRI IKLIM LINGKUNGAN PABRIK & INDEKS HIGROSKOPIS */}
          {liveTelemetriPanel}

          {/* SECTION 4: RINCIAN KOMPARASI SELURUH BAHAN YANG DIPROSES HARI INI */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="px-3.5 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold tracking-tight text-white">
                  Rincian Komparasi Seluruh Bahan Krosok yang Diproses ({activeDateText})
                </h4>
                <p className="text-[10.5px] text-slate-400 mt-0.5">
                  Setiap varian dibandingkan langsung terhadap standar acuan spesifik periode{' '}
                  {baselineMeta.periodeLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums">
                <span className="text-slate-300">
                  {dailyAnalysis.rows.length} Jenis Krosok
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-300">{dailyAnalysis.normalCount} Normal</span>
                {dailyAnalysis.waspadaCount > 0 && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-amber-300">
                      {dailyAnalysis.waspadaCount} Waspada
                    </span>
                  </>
                )}
                {dailyAnalysis.oosCount > 0 && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="text-rose-300 font-bold">
                      {dailyAnalysis.oosCount} OOS
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Mobile Cards (< 768px) */}
            <div className="md:hidden divide-y divide-slate-200">
              {dailyAnalysis.rows.map((row) => (
                <div
                  key={row.key}
                  className={`p-3 space-y-2 ${
                    row.status === 'oos'
                      ? 'bg-rose-50/35'
                      : row.status === 'waspada'
                      ? 'bg-amber-50/25'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">
                          {row.jenisKrosok}
                        </span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                          {row.jalurProses}
                        </span>
                        {row.batchCount > 1 && (
                          <span className="text-[10.5px] text-slate-500">
                            · {row.batchCount} batch
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 tabular-nums">
                        Baku {formatNum(row.bakuKg)} Kg · Hasil {formatNum(row.hasilKg)} Kg
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md border text-[10.5px] font-bold shrink-0 tabular-nums ${
                        row.status === 'oos'
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : row.status === 'waspada'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {row.status === 'oos'
                        ? 'OOS'
                        : row.status === 'waspada'
                        ? 'Waspada'
                        : 'Normal'}{' '}
                      ({row.deviasiPct >= 0 ? '+' : ''}
                      {formatPct(row.deviasiPct)}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5 border border-slate-200/70 text-[11px] font-mono tabular-nums">
                    <div>
                      <div className="text-[9.5px] font-sans text-slate-500">Susut Riil</div>
                      <div className="font-bold text-slate-900">{formatPct(row.susutPct)}%</div>
                    </div>
                    <div>
                      <div className="text-[9.5px] font-sans text-slate-500">Acuan</div>
                      <div className="font-bold text-emerald-700">
                        {formatPct(row.acuanPct)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[9.5px] font-sans text-slate-500">Air / Gagang</div>
                      <div className="font-semibold text-slate-700">
                        {formatPct(row.uapAirPct)}% / {formatPct(row.gagangPct)}%
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-700 leading-snug">
                    <strong className="text-slate-900">{row.faktorDominan}:</strong>{' '}
                    {row.autoDiagnosaSingkat}
                  </div>

                  {sourceMode === 'dhp_live' &&
                    onOpenQuickTag &&
                    row.sourceDhpItem &&
                    row.sourceEvalData && (
                      <div className="pt-0.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenQuickTag(row.sourceDhpItem!, row.sourceEvalData!)
                          }
                          className="min-h-[34px] px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Tag className="w-3 h-3 text-blue-600" />
                          <span>
                            {row.tags.length > 0 ? 'Ubah Tag Mandor' : '+ Quick Tag Mandor'}
                          </span>
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>

            {/* Tablet & Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2 px-3 sticky left-0 z-10 bg-slate-100 shadow-[1px_0_0_0_rgba(203,213,225,0.8)]">
                      Jenis Krosok
                    </th>
                    <th className="py-2 px-2 text-center">Jalur</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Baku (Kg)</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Hasil (Kg)</th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Susut Riil</th>
                    <th className="py-2 px-2.5 text-right text-emerald-700 whitespace-nowrap">
                      Acuan
                    </th>
                    <th className="py-2 px-2.5 text-right whitespace-nowrap">Deviasi (Δ)</th>
                    <th className="py-2 px-2.5 text-center">Status</th>
                    <th className="py-2 px-3 min-w-[270px]">
                      Faktor Dominan &amp; Auto-Diagnosa Singkat
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dailyAnalysis.rows.map((row) => {
                    const isOos = row.status === 'oos';
                    return (
                      <tr
                        key={row.key}
                        className={`group hover:bg-blue-50/40 transition-colors ${
                          isOos ? 'bg-rose-50/25' : 'bg-white'
                        }`}
                      >
                        <td
                          className={`py-2.5 px-3 font-semibold text-slate-900 sticky left-0 z-10 shadow-[1px_0_0_0_rgba(226,232,240,0.9)] ${
                            isOos
                              ? 'bg-rose-50 group-hover:bg-blue-50'
                              : 'bg-white group-hover:bg-blue-50'
                          }`}
                        >
                          <div className="whitespace-nowrap">{row.jenisKrosok}</div>
                          {row.batchCount > 1 && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              {row.batchCount} batch digabung
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.jalurProses === 'SKT'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {row.jalurProses}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatNum(row.bakuKg)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono text-emerald-800 font-semibold tabular-nums">
                          {formatNum(row.hasilKg)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          <div>{formatPct(row.susutPct)}%</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {formatNum(row.susutKg)} Kg
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                          {formatPct(row.acuanPct)}%
                        </td>
                        <td
                          className={`py-2.5 px-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                            row.status === 'oos'
                              ? 'text-rose-700'
                              : row.status === 'waspada'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          <div>
                            {row.deviasiPct >= 0 ? '+' : ''}
                            {formatPct(row.deviasiPct)}%
                          </div>
                          <div className="text-[10px] font-normal opacity-80">
                            {row.dampakKg >= 0 ? '+' : ''}
                            {formatNum(row.dampakKg)} Kg
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                              row.status === 'oos'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : row.status === 'waspada'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {row.status === 'oos' && <AlertTriangle className="w-3 h-3" />}
                            {row.status === 'waspada' && <Info className="w-3 h-3" />}
                            {row.status === 'normal' && <Check className="w-3 h-3" />}
                            <span>
                              {row.status === 'oos'
                                ? 'OOS'
                                : row.status === 'waspada'
                                ? 'Waspada'
                                : 'Normal'}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] leading-snug">
                          <div className="font-semibold text-slate-900">
                            {row.faktorDominan}
                          </div>
                          <div className="text-slate-600 mt-0.5">{row.autoDiagnosaSingkat}</div>
                          {sourceMode === 'dhp_live' &&
                            onOpenQuickTag &&
                            row.sourceDhpItem &&
                            row.sourceEvalData && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenQuickTag(row.sourceDhpItem!, row.sourceEvalData!)
                                }
                                className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-blue-600 hover:underline cursor-pointer"
                              >
                                <Tag className="w-3 h-3" />
                                <span>
                                  {row.tags.length > 0
                                    ? 'Ubah Quick Tag Mandor'
                                    : '+ Tandai Alasan Lapangan'}
                                </span>
                              </button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
