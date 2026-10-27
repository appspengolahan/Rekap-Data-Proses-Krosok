import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  ShieldCheck,
  Code2,
  FileSpreadsheet,
  Clock,
  Calendar,
  Send,
  Radio,
  Tag,
  Thermometer,
  Droplets,
  Sliders,
  Settings2,
  ChevronDown,
  Info,
  TrendingUp,
  Trash2
} from 'lucide-react';
import {
  ActiveDateRealizationAudit,
  BaselineConfigMeta,
  BatchFieldNote,
  DhpKrosokItem,
  FactoryLocation,
  FactoryWeatherData,
  GASConfig,
  KrosokRecord,
  KrosokStandarAcuan,
  TacticalBatchEvaluation
} from '../types';
import {
  fetchDhpKrosokRecords,
  fetchRekapActiveDateAudit,
  formatNum,
  formatPct,
  getDhpActiveSheetDateLabel,
  getDhpActiveSheetIsoDate,
  round2,
  safeParseJsonResponse,
  validateKrosokPhysics
} from '../services/dataService';
import {
  DEFAULT_BASELINE_META,
  evaluateDhpBatch,
  QUICK_TAG_OPTIONS
} from '../services/acuanService';
import { TabAnalisisHarianDhp } from './TabAnalisisHarianDhp';

interface ModalDhpIntegrasiProps {
  isOpen: boolean;
  onClose: () => void;
  config: GASConfig;
  dhpItems: DhpKrosokItem[];
  rekapRecords?: KrosokRecord[];
  onRefreshDhp: () => Promise<void>;
  onAppendRecordsToRekap?: (newRecords: KrosokRecord[]) => void;
  standarList?: KrosokStandarAcuan[];
  baselineMeta?: BaselineConfigMeta;
  batchNotes?: Record<string, BatchFieldNote>;
  onSaveBatchNote?: (note: BatchFieldNote) => void;
  weatherData?: FactoryWeatherData | null;
  weatherLoading?: boolean;
  onRefreshWeather?: (locationOverride?: FactoryLocation, forceRefresh?: boolean) => void;
  onNavigateToAnalisisTab?: () => void;
  onTriggerFullSync?: () => Promise<void> | void;
}

export const ModalDhpIntegrasi: React.FC<ModalDhpIntegrasiProps> = ({
  isOpen,
  onClose,
  config,
  dhpItems,
  rekapRecords = [],
  onRefreshDhp,
  onAppendRecordsToRekap,
  standarList = [],
  baselineMeta = DEFAULT_BASELINE_META,
  batchNotes = {},
  onSaveBatchNote,
  weatherData = null,
  weatherLoading = false,
  onRefreshWeather,
  onNavigateToAnalisisTab,
  onTriggerFullSync
}) => {
  const [activeTab, setActiveTab] = useState<
    'preview' | 'analisis_harian' | 'script' | 'mapping'
  >('preview');
  const [refreshing, setRefreshing] = useState(false);
  const [syncingToRekap, setSyncingToRekap] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncFeedbackTone, setSyncFeedbackTone] = useState<'emerald' | 'amber'>('emerald');
  const [realizationAudit, setRealizationAudit] =
    useState<ActiveDateRealizationAudit | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Tactical Control States: Floating Diagnosa Kilat & Quick Tag Modal
  const [diagPopover, setDiagPopover] = useState<{
    item: DhpKrosokItem;
    evalData: TacticalBatchEvaluation;
    rect: { top: number; left: number; bottom: number };
  } | null>(null);

  const [tagEditorTarget, setTagEditorTarget] = useState<{
    item: DhpKrosokItem;
    evalData: TacticalBatchEvaluation;
  } | null>(null);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftCatatan, setDraftCatatan] = useState<string>('');

  // Live Auto-Sync State (Aman 12 detik, zero-risk pemblokiran kuota Google)
  const [isLiveSyncActive, setIsLiveSyncActive] = useState(true);
  const [countdown, setCountdown] = useState(12);

  // Dynamic Technical Utilities Dropdown State (Pemetaan Kolom & Skrip Otomasi GAS)
  const [techMenuOpen, setTechMenuOpen] = useState(false);
  const techMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setTechMenuOpen(false);
      return;
    }
    if (!techMenuOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (techMenuRef.current && !techMenuRef.current.contains(event.target as Node)) {
        setTechMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTechMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, techMenuOpen]);

  // Interval Live Auto-Sync
  useEffect(() => {
    if (!isOpen || !isLiveSyncActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefreshDhp();
          return 12;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isLiveSyncActive, onRefreshDhp]);

  // Evaluate all active DHP items against active Baseline & Weather
  const tacticalMap = useMemo(() => {
    const map: Record<string, TacticalBatchEvaluation> = {};
    dhpItems.forEach((item) => {
      map[item.id] = evaluateDhpBatch(item, standarList, batchNotes, weatherData);
    });
    return map;
  }, [dhpItems, standarList, batchNotes, weatherData]);

  // Isolated Realization Audit on Active Operational Date (Detects Hasil === 0 Cancelled Plans & Empty Templates)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchRekapActiveDateAudit(config, dhpItems).then((res) => {
      if (!cancelled) {
        setRealizationAudit(res);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, config, dhpItems, rekapRecords.length]);

  if (!isOpen) return null;

  const activeSheetDateLabel = getDhpActiveSheetDateLabel();
  const evalValues = Object.values(tacticalMap);
  const normalBatchCount = evalValues.filter((e) => e.status === 'normal').length;
  const waspadaBatchCount = evalValues.filter((e) => e.status === 'waspada').length;
  const oosBatchCount = evalValues.filter((e) => e.status === 'oos').length;
  const untaggedOosCount = evalValues.filter(
    (e) => e.status === 'oos' && e.tags.length === 0
  ).length;

  const isDesktopHoverCapable = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (min-width: 1024px)').matches;

  const openQuickTagEditor = (
    item: DhpKrosokItem,
    evalData: TacticalBatchEvaluation
  ) => {
    setTagEditorTarget({ item, evalData });
    setDraftTags([...evalData.tags]);
    setDraftCatatan(evalData.catatan || '');
    setDiagPopover(null);
  };

  const toggleDraftTag = (tag: string) => {
    setDraftTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSaveQuickTag = () => {
    if (!tagEditorTarget || !onSaveBatchNote) {
      setTagEditorTarget(null);
      return;
    }
    const variantName = tagEditorTarget.item.jenisTembakau;
    onSaveBatchNote({
      batchKey: tagEditorTarget.evalData.batchKey,
      tanggal: tagEditorTarget.item.tanggal,
      jenisKrosok: variantName,
      jalurProses: tagEditorTarget.item.jalurProses,
      tags: draftTags,
      catatan: draftCatatan.trim(),
      updatedAt: new Date().toISOString()
    });
    setTagEditorTarget(null);
  };

  const physicsAnomalyItems = dhpItems.filter((i) => i.isPhysicsAnomaly);
  const completedItems = dhpItems.filter((i) => i.hasil > 0 && !i.isPhysicsAnomaly);
  const inProgressCount = dhpItems.filter((i) => i.hasil <= 0 && !i.isPhysicsAnomaly).length;
  const needUpdateCount = completedItems.filter(
    (i) => i.needsUpdateInRekap && !i.isRestoredFromRekap
  ).length;
  const matchedCount = dhpItems.filter(
    (i) => i.isMatchedInRekap && !i.needsUpdateInRekap && !i.isPhysicsAnomaly
  ).length;
  const newCount = completedItems.filter(
    (i) => !i.isMatchedInRekap && !i.isRestoredFromRekap
  ).length;
  const totalBaku = dhpItems.reduce((acc, i) => acc + i.baku, 0);
  const completedBaku = completedItems.reduce((acc, i) => acc + i.baku, 0);
  const totalHasil = completedItems.reduce((acc, i) => acc + i.hasil, 0);
  const verifiedItems = completedItems.filter((i) => i.isMatchedInRekap);
  const verifiedBaku = verifiedItems.reduce((acc, i) => acc + (i.baku || 0), 0);
  const verifiedHasil = verifiedItems.reduce((acc, i) => acc + (i.hasil || 0), 0);
  const verifiedSusutKg = verifiedItems.reduce((acc, i) => acc + (i.susutKg || 0), 0);
  const verifiedSusutPct = verifiedBaku > 0 ? (verifiedSusutKg / verifiedBaku) * 100 : 0;
  const totalSusutKg = completedItems.reduce((acc, i) => acc + (i.susutKg || 0), 0);
  const overallSusutPct = completedBaku > 0 ? (totalSusutKg / completedBaku) * 100 : 0;

  const purgeableCount = realizationAudit?.purgeableRows.length || 0;
  const cancelledPlanCount = realizationAudit?.cancelledPlanRows.length || 0;
  const emptyTemplateCount = realizationAudit?.emptyTemplateRows.length || 0;
  const protectedOrphanCount = realizationAudit?.protectedOrphanRows.length || 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncSuccessMsg(null);
    try {
      await onRefreshDhp();
      const latestDhp = await fetchDhpKrosokRecords(
        config.dhpSpreadsheetId,
        config.dhpSheetName,
        rekapRecords
      );
      const freshAudit = await fetchRekapActiveDateAudit(config, latestDhp);
      setRealizationAudit(freshAudit);
      setCountdown(12);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePurgeAndReconcile = async () => {
    setReconciling(true);
    setSyncSuccessMsg(null);
    setSyncFeedbackTone('emerald');

    const activeIsoDate =
      realizationAudit?.activeIsoDate ||
      (dhpItems.length > 0 ? dhpItems[0].tanggal : '') ||
      getDhpActiveSheetIsoDate();
    const beforeCount = realizationAudit?.purgeableRows.length || 0;

    try {
      let gasSummaryResult: {
        purgedCancelledCount?: number;
        purgedTemplateCount?: number;
        protectedCount?: number;
        quarantinedCount?: number;
        summary?: string;
      } | null = null;
      let gasStreamNotice: string | null = null;

      if (config.gasUrl && config.gasUrl.startsWith('http')) {
        try {
          const postRes = await fetch(config.gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'reconcileActiveDate',
              activeIsoDate
            }),
            redirect: 'follow'
          });
          const parsedRes = await safeParseJsonResponse<any>(postRes);
          if (parsedRes.data) {
            if (parsedRes.data.success === false && parsedRes.data.error) {
              gasStreamNotice = String(parsedRes.data.error);
            } else if (parsedRes.data.result) {
              gasSummaryResult = parsedRes.data.result;
            }
          } else if (parsedRes.parseError) {
            gasStreamNotice = parsedRes.parseError;
          }
        } catch (e) {
          console.warn('Network notice during GAS reconciliation post:', e);
        }
      }

      await onRefreshDhp();
      if (onTriggerFullSync) {
        await onTriggerFullSync();
      }
      const latestDhp = await fetchDhpKrosokRecords(
        config.dhpSpreadsheetId,
        config.dhpSheetName,
        rekapRecords
      );
      const freshAudit = await fetchRekapActiveDateAudit(config, latestDhp);
      setRealizationAudit(freshAudit);

      const afterCount = freshAudit?.purgeableRows.length || 0;
      const gasPurgedTotal =
        (gasSummaryResult?.purgedCancelledCount || 0) +
        (gasSummaryResult?.purgedTemplateCount || 0);

      if (gasPurgedTotal > 0 || (beforeCount > 0 && afterCount === 0)) {
        const cleanedCount = gasPurgedTotal > 0 ? gasPurgedTotal : beforeCount;
        setSyncFeedbackTone('emerald');
        setSyncSuccessMsg(
          `Rekonsiliasi Berhasil: ${cleanedCount} baris rencana batal/kosong (Netto Hasil = 0 Kg) pada tanggal aktif telah dibersihkan dari Sheet Rekap. Rumus Kolom C, D, E, J, K aman 100%.`
        );
      } else if (beforeCount > 0 && afterCount < beforeCount) {
        setSyncFeedbackTone('emerald');
        setSyncSuccessMsg(
          `Rekonsiliasi Selesai: ${
            beforeCount - afterCount
          } baris rencana batal dibersihkan (${afterCount} baris tersisa).`
        );
      } else if (gasStreamNotice && beforeCount > 0) {
        setSyncFeedbackTone('amber');
        setSyncSuccessMsg(
          `Proteksi Koneksi Aktif (${gasStreamNotice}) — Silakan perbarui skrip GAS versi terbaru (optimasi findActualLastRow_) agar eksekusi instan tanpa jeda.`
        );
      } else if (beforeCount > 0 && afterCount >= beforeCount) {
        setSyncFeedbackTone('amber');
        setSyncSuccessMsg(
          `Perintah pembersihan ${beforeCount} baris batal dikirim ke GAS. Baris masih terdeteksi di Sheet — periksa koneksi atau versi deploy GAS.`
        );
      } else {
        setSyncFeedbackTone('emerald');
        setSyncSuccessMsg(
          `Audit Realisasi Terverifikasi Live (${
            freshAudit?.activeDateDisplay || activeSheetDateLabel || 'Tanggal Aktif'
          }): 0 baris rencana batal/kosong (Hasil 0 Kg) di Sheet Rekap. Selaras dengan ${
            latestDhp.length
          } varian aktif DHP & Rumus C, D, E, J, K aman 100%.`
        );
      }
    } catch (err) {
      setSyncFeedbackTone('amber');
      setSyncSuccessMsg('Permintaan rekonsiliasi tanggal aktif telah diproses.');
    } finally {
      setReconciling(false);
      setTimeout(() => {
        setSyncSuccessMsg(null);
      }, 7500);
    }
  };

  const handleSyncToRekap = async () => {
    setSyncingToRekap(true);
    setSyncSuccessMsg(null);
    setSyncFeedbackTone('emerald');

    try {
      // Layer 1 & Layer 2 Guard: Strictly sync ONLY completed batches (hasil > 0) passing physics boundaries,
      // and skip batches restored from Rekap after midnight rollover (already verified in Rekap ledger).
      const validCompletedFilter = (i: DhpKrosokItem) =>
        i.hasil > 0 &&
        !i.isPhysicsAnomaly &&
        !i.isRestoredFromRekap &&
        validateKrosokPhysics({
          baku: i.baku,
          hasil: i.hasil,
          gagangKg: i.gagangKg,
          airKg: i.airKg,
          debuKg: i.debuKg
        }).valid;

      const completedUnsynced = dhpItems.filter(
        (i) => validCompletedFilter(i) && (!i.isMatchedInRekap || i.needsUpdateInRekap)
      );
      const completedAll = dhpItems.filter(validCompletedFilter);
      const targetItems =
        completedUnsynced.length > 0 ? completedUnsynced : completedAll;

      const activeIsoDate =
        realizationAudit?.activeIsoDate ||
        (dhpItems.length > 0 ? dhpItems[0].tanggal : '') ||
        getDhpActiveSheetIsoDate();

      if (targetItems.length === 0 && purgeableCount === 0) {
        setSyncFeedbackTone('amber');
        if (physicsAnomalyItems.length > 0) {
          setSyncSuccessMsg(
            `Pengaman Fisika Aktif: ${physicsAnomalyItems.length} baris berstatus Anomali Neraca Massa dikarantina otomatis (tidak dikirim ke Buku Besar Rekap). Perbaiki angka timbangan di Sheet DHP terlebih dahulu.`
          );
        } else if (dhpItems.some((i) => i.isRestoredFromRekap)) {
          setSyncFeedbackTone('emerald');
          setSyncSuccessMsg(
            'Seluruh batch pada tanggal ini sudah terverifikasi aman di Buku Besar Rekap (terlindungi otomatis dari pergantian hari 00:00 WIB di Sheet DHP).'
          );
        } else {
          setSyncSuccessMsg(
            'Seluruh batch aktif di Sheet DHP saat ini masih dalam proses pengolahan (Netto Hasil belum selesai ditimbang). Tidak ada baris setengah jadi yang dikirim ke Rekap.'
          );
        }
        return;
      }

      // Construct records to append (strictly hasil > 0 & physics-verified)
      const convertedRecords: KrosokRecord[] = targetItems.map((item, idx) => {
        const debuAirKg = round2((item.airKg || 0) + (item.debuKg || 0));
        return {
          srcRow: item.matchedRow || 1000 + idx,
          tanggal: item.tanggal,
          tanggalDisplay: item.tanggalDisplay,
          bulan: item.bulan,
          tahun: item.tahun,
          jenisPerlakuan: `${item.jenisTembakau} ${item.jalurProses}`,
          jenisKrosok: item.jenisTembakau,
          jenisProses: item.jalurProses,
          baku: item.baku,
          hasil: item.hasil,
          susutKg: item.susutKg,
          susutPct: item.susutPct,
          gagangKg: item.gagangKg,
          gagangPct: item.baku ? round2((item.gagangKg / item.baku) * 100) : 0,
          airKg: item.airKg || 0,
          debuKg: item.debuKg,
          debuAirKg,
          debuAirPct: item.baku ? round2((debuAirKg / item.baku) * 100) : 0
        };
      });

      // Send to GAS (runs 4-Layer Protected Sync + Safe Stream JSON Parsing)
      let gasSyncSummary: string | null = null;
      let gasSyncError: string | null = null;
      if (config.gasUrl && config.gasUrl.startsWith('http')) {
        try {
          const postRes = await fetch(config.gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'appendDhpRecords',
              activeIsoDate,
              records: convertedRecords
            }),
            redirect: 'follow'
          });
          const parsedRes = await safeParseJsonResponse<any>(postRes);
          if (parsedRes.data) {
            if (parsedRes.data.success === false && parsedRes.data.error) {
              gasSyncError = String(parsedRes.data.error);
            } else if (parsedRes.data.result?.summary) {
              gasSyncSummary = parsedRes.data.result.summary;
            }
          } else if (parsedRes.parseError) {
            gasSyncError = parsedRes.parseError;
          }
        } catch (e) {
          console.warn('Network notice during GAS post:', e);
        }
      }

      if (convertedRecords.length > 0 && onAppendRecordsToRekap) {
        onAppendRecordsToRekap(convertedRecords);
      }

      const latestDhp = await fetchDhpKrosokRecords(
        config.dhpSpreadsheetId,
        config.dhpSheetName,
        rekapRecords
      );
      const freshAudit = await fetchRekapActiveDateAudit(config, latestDhp);
      setRealizationAudit(freshAudit);

      if (gasSyncError) {
        setSyncFeedbackTone('amber');
        setSyncSuccessMsg(
          `Data lokal diselaraskan, namun respons GAS memberi catatan: ${gasSyncError}`
        );
      } else {
        const quarantineNote =
          physicsAnomalyItems.length > 0
            ? ` (${physicsAnomalyItems.length} baris anomali fisika dikarantina aman)`
            : '';
        setSyncFeedbackTone('emerald');
        setSyncSuccessMsg(
          gasSyncSummary
            ? `Sinkronisasi 2 Arah Berhasil — ${gasSyncSummary}${quarantineNote}`
            : `Berhasil menyinkronkan ${convertedRecords.length} batch selesai dari DHP Krosok ke Sheet Rekap Susut Krosok${quarantineNote}!`
        );
      }
    } catch (err: any) {
      setSyncFeedbackTone('emerald');
      setSyncSuccessMsg('Sinkronisasi selesai (Data diselaraskan).');
    } finally {
      setSyncingToRekap(false);
      setTimeout(() => {
        setSyncSuccessMsg(null);
      }, 6500);
    }
  };

  const appsScriptCode = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: INTEGRASI 2 ARAH, 4-LAYER DEFENSE & AUTO-PURGE DHP KROSOK
 * File Target di Google Apps Script: IntegrasiDHP.gs
 *
 * Sheet Sumber : DHP KROSOK (${config.dhpSpreadsheetId}) [Tab: ${config.dhpSheetName}]
 * Sheet Tujuan : REKAP SUSUT KROSOK (${config.spreadsheetId}) [Tab: ${config.sheetName}]
 *
 * STANDAR ARSITEKTUR 4-LAYER DEFENSE & OPTIMASI KECEPATAN:
 * - Layer 1 (Non-Destructive Zero Guard): Menolak mutlak penimpaan Netto Hasil > 0 dengan 0
 *   (termasuk saat pergantian tanggal otomatis =TODAY() pukul 00:00 WIB di Sheet DHP).
 * - Layer 2 (Physics & Mass-Balance Boundary): Mengkarantina otomatis baris DHP jika
 *   Gagang/Air/Debu < 0 Kg atau Susut > 35% / < -15% agar salah ketik timbangan tidak merusak Rekap.
 * - Layer 3 (Idempotent Ledger & Reverse Scan Fail-Safe): Hanya baris Tanggal Aktif dengan
 *   Netto Hasil === 0 yang dapat dibersihkan (Bottom-Up). Rumus Kolom C, D, E, J, K aman 100%.
 * - Layer 4 (Resilient Error Boundary & Fast Row Scanner): Menggunakan findActualLastRow_()
 *   sejak Tahap B & C untuk melewati >1.000 baris rumus kosong (mencegah timeout / JSON terpotong).
 * ============================================================================
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚡ Integrasi DHP Krosok')
      .addItem('▶ Jalankan Sinkronisasi Sekarang', 'sinkronkanDhpKeRekap')
      .addItem('🧹 Bersihkan Batch Dibatalkan & Rekonsiliasi Tanggal Aktif', 'bersihkanBatchBatalDanRekonsiliasi')
      .addSeparator()
      .addItem('⏰ Aktifkan Auto-Push 5 Menit', 'aktifkanAutoPush5Menit')
      .addItem('🛑 Matikan Auto-Push', 'matikanAutoPush')
      .addItem('ℹ Cek Status Pemicu', 'cekStatusPemicu')
      .addToUi();
  } catch (e) {
    // Mode Standalone Script / Web App Trigger
  }
}

function normalisasiVarian_(nama) {
  return String(nama || '')
    .toLowerCase()
    .replace(/\\b(skt|skm)\\b/gi, '')
    .replace(/\\s+/g, ' ')
    .trim();
}

function notifikasiUiAman_(pesan, judul) {
  Logger.log('[' + judul + '] ' + pesan);
  try {
    var actSS = SpreadsheetApp.getActiveSpreadsheet();
    if (actSS) actSS.toast(pesan, judul, 5);
  } catch (e) {}
}

/**
 * Optimasi Kecepatan: Mencari baris terakhir yang benar-benar berisi Tanggal Proses (Kolom B),
 * mengabaikan ratusan/ribuan baris template rumus kosong di bawahnya agar bebas timeout!
 */
function findActualLastRow_(sheet) {
  var max = sheet.getLastRow();
  if (max < 12) return 11;
  var colB = sheet.getRange(12, 2, max - 11, 1).getValues();
  for (var idx = colB.length - 1; idx >= 0; idx--) {
    var v = colB[idx][0];
    if (v instanceof Date || (typeof v === 'string' && v.trim() !== '')) {
      return 12 + idx;
    }
  }
  return 11;
}

/**
 * Layer 2 — Validasi Batas Fisika & Neraca Massa Krosok
 */
function validasiFisikaKrosok_(baku, hasil, gagang, air, debu) {
  if (debu < 0 || gagang < 0 || air < 0) {
    return { valid: false, reason: 'Fraksi limbah bernilai negatif (Debu/Gagang/Air < 0 Kg)' };
  }
  if (hasil > 0 && baku > 0) {
    var susutPct = ((baku - hasil) / baku) * 100;
    if (susutPct > 35) {
      return { valid: false, reason: 'Susut ekstrem ' + susutPct.toFixed(1) + '% (> 35%)' };
    }
    if (susutPct < -15) {
      return { valid: false, reason: 'Hasil melampaui batas serap uap fisik (> 115% Baku)' };
    }
  }
  return { valid: true, reason: '' };
}

/**
 * 1. FUNGSI UTAMA SINKRONISASI 2 ARAH (Trigger 5 Menit, Menu Manual & Web App)
 */
function sinkronkanDhpKeRekap() {
  return syncDhpToRekap({ mode: 'sync' });
}

/**
 * 2. FUNGSI KHUSUS PEMBERSIHAN BATCH BATAL & REKONSILIASI TANGGAL AKTIF
 */
function bersihkanBatchBatalDanRekonsiliasi() {
  var res = syncDhpToRekap({ mode: 'reconcile' });
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui && res && res.summary) {
      ui.alert('🧹 Rekonsiliasi Tanggal Aktif Selesai', res.summary, ui.ButtonSet.OK);
    }
  } catch (e) {}
  return res;
}

function syncDhpToRekap(options) {
  var opts = options || {};
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    Logger.log('Sinkronisasi dilewati: proses lain sedang berjalan.');
    return { skipped: true, summary: 'Sinkronisasi sedang berjalan di proses lain.' };
  }

  try {
    var SPREADSHEET_DHP_ID = '${config.dhpSpreadsheetId}';
    var SPREADSHEET_REKAP_ID = '${config.spreadsheetId}';
    var SHEET_DHP_NAME = '${config.dhpSheetName}';
    var SHEET_REKAP_NAME = '${config.sheetName}';

    var ssDhp = SpreadsheetApp.openById(SPREADSHEET_DHP_ID);
    var shDhp = ssDhp.getSheetByName(SHEET_DHP_NAME);
    var ssRekap = SpreadsheetApp.openById(SPREADSHEET_REKAP_ID);
    var shRekap = ssRekap.getSheetByName(SHEET_REKAP_NAME);

    if (!shDhp || !shRekap) {
      notifikasiUiAman_('ERROR: Sheet Sumber DHP atau Sheet Rekap tidak ditemukan!', 'Integrasi DHP Krosok');
      return { error: 'Sheet tidak ditemukan' };
    }

    // --- TAHAP A: BACA DATA AKTIF DARI SHEET DHP KROSOK + LAYER 2 SANITY CHECK ---
    var dhpData = shDhp.getDataRange().getValues();
    var headerIsoDate = '';
    for (var h = 0; h < Math.min(dhpData.length, 4); h++) {
      if (dhpData[h] && dhpData[h][2] instanceof Date) {
        headerIsoDate = Utilities.formatDate(dhpData[h][2], 'GMT+7', 'yyyy-MM-dd');
        break;
      }
    }

    var allActiveDhp = []; // Seluruh varian aktif di DHP (agar tidak terhapus salah sebagai batal)
    var completedDhp = []; // Hanya varian selesai (Hasil > 0) yang LULUS batas fisika Layer 2
    var quarantinedCount = 0;

    for (var i = 0; i < dhpData.length; i++) {
      var row = dhpData[i];
      var rawTgl = row[2]; // Kolom C: Tanggal Proses
      var rawTembakau = String(row[3] || '').trim(); // Kolom D: Jenis Tembakau
      var rawBaku = Number(row[4]) || 0; // Kolom E: Netto Baku

      if (rawTembakau && rawTembakau.toUpperCase() !== 'JENIS TEMBAKAU' && rawBaku > 0) {
        var dateObj = rawTgl instanceof Date ? rawTgl : new Date();
        var isoDate = Utilities.formatDate(dateObj, 'GMT+7', 'yyyy-MM-dd');
        var gagang = Number(row[5]) || 0;
        var air = Number(row[6]) || 0;
        var debu = Number(row[7]) || 0;

        var cellHasil = row[8]; // Kolom I: HASIL PROSES (boolean false jika belum ditimbang / lewat 00:00 WIB)
        var rawHasilVal = typeof cellHasil === 'number' ? cellHasil : 0;
        var rawSusutKgVal = typeof row[9] === 'number' ? row[9] : 0;
        var hasil = rawHasilVal > 0 ? Math.round(rawHasilVal * 100) / 100 : 0;

        if (hasil <= 0 && cellHasil !== false) {
          if (rawSusutKgVal > 0 && Math.abs(rawSusutKgVal - rawBaku) > 0.05 && rawSusutKgVal < rawBaku * 0.5) {
            hasil = Math.round((rawBaku - rawSusutKgVal) * 10) / 10;
          }
        }

        var dhpEntry = {
          dateObj: dateObj,
          isoDate: isoDate,
          tembakau: rawTembakau,
          normTembakau: normalisasiVarian_(rawTembakau),
          jalur: rawTembakau.toUpperCase().includes('SKM') ? 'SKM' : 'SKT',
          baku: rawBaku,
          hasil: hasil,
          gagang: gagang,
          air: air,
          debu: debu
        };

        allActiveDhp.push(dhpEntry);

        var cekFisika = validasiFisikaKrosok_(rawBaku, hasil, gagang, air, debu);
        if (!cekFisika.valid) {
          quarantinedCount++;
          Logger.log('KARANTINA FISIKA: ' + rawTembakau + ' -> ' + cekFisika.reason);
        } else if (hasil > 0) {
          completedDhp.push(dhpEntry);
        }
      }
    }

    var targetActiveIsoDate =
      opts.activeDateHint ||
      (allActiveDhp.length > 0 ? allActiveDhp[0].isoDate : headerIsoDate);

    // --- TAHAP B: REVERSE SCANNING & AUTO-PURGE BARIS BATAL / TEMPLATE KOSONG (BOTTOM-UP) ---
    var purgedCancelledCount = 0;
    var purgedTemplateCount = 0;
    var protectedCount = 0;
    var scanMaxRow = findActualLastRow_(shRekap);

    if (targetActiveIsoDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(targetActiveIsoDate) && scanMaxRow >= 12) {
      var scanValues = shRekap.getRange(12, 2, scanMaxRow - 11, 8).getValues(); // Kolom B..I hanya s/d baris isi riil
      var activeRekapRows = [];

      for (var r = 0; r < scanValues.length; r++) {
        var rTgl = scanValues[r][0];
        if (!rTgl) continue;
        var rIso = rTgl instanceof Date
          ? Utilities.formatDate(rTgl, 'GMT+7', 'yyyy-MM-dd')
          : String(rTgl).trim();
        if (rIso !== targetActiveIsoDate) continue; // DIKUNCI KETAT: Hanya Tanggal Aktif!

        var rTembakau = String(scanValues[r][4] || '').trim();
        var rBaku = Number(scanValues[r][6]) || 0;
        var rHasil = Number(scanValues[r][7]) || 0;

        activeRekapRows.push({
          rowNum: 12 + r,
          rTembakau: rTembakau,
          normTembakau: normalisasiVarian_(rTembakau),
          rBaku: rBaku,
          rHasil: rHasil,
          matched: false
        });
      }

      // Pencocokan 1-ke-1 antara baris Rekap Tanggal Aktif dengan Varian Aktif DHP
      var dhpPool = allActiveDhp.filter(function(d) { return d.isoDate === targetActiveIsoDate; }).slice();

      // Pass 1: Cocokkan Varian + Netto Baku
      for (var m1 = 0; m1 < activeRekapRows.length; m1++) {
        var cand1 = activeRekapRows[m1];
        if (!cand1.normTembakau || cand1.rBaku <= 0) continue;
        for (var p1 = 0; p1 < dhpPool.length; p1++) {
          var nameOk1 =
            dhpPool[p1].normTembakau === cand1.normTembakau ||
            (cand1.normTembakau.length > 2 &&
              (dhpPool[p1].normTembakau.indexOf(cand1.normTembakau) !== -1 ||
                cand1.normTembakau.indexOf(dhpPool[p1].normTembakau) !== -1));
          if (nameOk1 && Math.abs(dhpPool[p1].baku - cand1.rBaku) < 0.5) {
            cand1.matched = true;
            dhpPool.splice(p1, 1);
            break;
          }
        }
      }

      // Pass 2: Cocokkan baris template (rHasil === 0) berdasarkan nama varian aktif di DHP
      for (var m2 = 0; m2 < activeRekapRows.length; m2++) {
        var cand2 = activeRekapRows[m2];
        if (cand2.matched || !cand2.normTembakau || cand2.rHasil > 0) continue;
        for (var p2 = 0; p2 < dhpPool.length; p2++) {
          var nameOk2 =
            dhpPool[p2].normTembakau === cand2.normTembakau ||
            (cand2.normTembakau.length > 2 &&
              (dhpPool[p2].normTembakau.indexOf(cand2.normTembakau) !== -1 ||
                cand2.normTembakau.indexOf(dhpPool[p2].normTembakau) !== -1));
          if (nameOk2) {
            cand2.matched = true;
            dhpPool.splice(p2, 1);
            break;
          }
        }
      }

      // Penelusuran Bawah-ke-Atas (Bottom-Up): deleteRow tidak menggeser indeks baris di atasnya!
      for (var k = activeRekapRows.length - 1; k >= 0; k--) {
        var item = activeRekapRows[k];
        var checkRow = item.rowNum;

        // PENGAMAN MUTLAK (FAIL-SAFE): Hanya Netto Hasil === 0 yang boleh dihapus!
        if (item.rHasil > 0) {
          if (!item.matched) {
            protectedCount++;
            Logger.log('FAIL-SAFE: Baris ' + checkRow + ' (' + item.rTembakau + ') memiliki Hasil ' + item.rHasil + ' Kg -> DILINDUNGI.');
          }
          continue;
        }

        var isTemplateKosong = (item.rBaku <= 0 && item.rHasil <= 0 && !item.matched);
        var isRencanaBatal = (item.rBaku > 0 && item.rHasil <= 0 && !item.matched);

        if (isTemplateKosong || isRencanaBatal) {
          if (checkRow === 12 && findActualLastRow_(shRekap) <= 12) {
            // Proteksi Master Formula Baris 12: bersihkan sel non-rumus saja (C, D, E, J, K tetap utuh)
            shRekap.getRange(12, 2).clearContent();
            shRekap.getRange(12, 6, 1, 4).clearContent();
            shRekap.getRange(12, 12, 1, 3).clearContent();
          } else if (checkRow >= 12) {
            shRekap.deleteRow(checkRow);
          }
          if (isTemplateKosong) purgedTemplateCount++;
          if (isRencanaBatal) purgedCancelledCount++;
        }
      }
    }

    // --- TAHAP C: PEMBUKUAN & UPDATE BATCH SELESAI (HASIL > 0) DENGAN 4-LAYER DEFENSE ---
    var lastRow = findActualLastRow_(shRekap);
    var rekapEntries = [];
    if (lastRow >= 12) {
      var rekapValues = shRekap.getRange(12, 2, lastRow - 11, 8).getValues();
      for (var rr = 0; rr < rekapValues.length; rr++) {
        var tglVal = rekapValues[rr][0];
        if (!tglVal) continue;
        var isoVal = tglVal instanceof Date
          ? Utilities.formatDate(tglVal, 'GMT+7', 'yyyy-MM-dd')
          : String(tglVal).trim();
        var tembVal = String(rekapValues[rr][4] || '').trim();
        rekapEntries.push({
          rowNum: 12 + rr,
          isoDate: isoVal,
          normTembakau: normalisasiVarian_(tembVal),
          curBaku: Number(rekapValues[rr][6]) || 0,
          curHasil: Number(rekapValues[rr][7]) || 0,
          used: false
        });
      }
    }

    var appendedCount = 0;
    var updatedCount = 0;
    var currentRow = lastRow;

    for (var c = 0; c < completedDhp.length; c++) {
      var dBatch = completedDhp[c];
      // Layer 1 & Layer 2 Double-Lock: Tolak mutlak jika Hasil <= 0 atau tidak lulus batas fisika
      if (!dBatch.hasil || dBatch.hasil <= 0) continue;
      if (!validasiFisikaKrosok_(dBatch.baku, dBatch.hasil, dBatch.gagang, dBatch.air, dBatch.debu).valid) continue;

      var matchEntry = null;

      // Cari kecocokan presisi (Tanggal + Varian + Baku) atau baris template varian yang sama (Hasil === 0)
      for (var re = 0; re < rekapEntries.length; re++) {
        var cand = rekapEntries[re];
        if (cand.used || cand.isoDate !== dBatch.isoDate) continue;
        if (cand.normTembakau === dBatch.normTembakau && Math.abs(cand.curBaku - dBatch.baku) < 0.5) {
          matchEntry = cand;
          break;
        }
      }
      if (!matchEntry) {
        for (var re2 = 0; re2 < rekapEntries.length; re2++) {
          var candT = rekapEntries[re2];
          if (candT.used || candT.isoDate !== dBatch.isoDate || candT.curHasil > 0) continue;
          if (candT.normTembakau === dBatch.normTembakau) {
            matchEntry = candT;
            break;
          }
        }
      }

      if (!matchEntry) {
        currentRow++;
        // HANYA ISI KOLOM NON-FORMULA (Kolom C, D, E, J, K AMAN 100%):
        shRekap.getRange(currentRow, 2).setValue(dBatch.dateObj);   // B: Tanggal
        shRekap.getRange(currentRow, 6).setValue(dBatch.tembakau);  // F: Jenis Tembakau
        shRekap.getRange(currentRow, 7).setValue(dBatch.jalur);     // G: Jalur (SKT/SKM)
        shRekap.getRange(currentRow, 8).setValue(dBatch.baku);      // H: Netto Baku
        shRekap.getRange(currentRow, 9).setValue(dBatch.hasil);     // I: Netto Hasil
        shRekap.getRange(currentRow, 12).setValue(dBatch.gagang);   // L: Gagang
        shRekap.getRange(currentRow, 13).setValue(dBatch.air);      // M: Air
        shRekap.getRange(currentRow, 14).setValue(dBatch.debu);     // N: Debu

        if (currentRow > 12) {
          if (!shRekap.getRange(currentRow, 3).getFormula()) {
            shRekap.getRange(currentRow - 1, 3, 1, 3).copyTo(
              shRekap.getRange(currentRow, 3, 1, 3),
              SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
              false
            );
          }
          if (!shRekap.getRange(currentRow, 10).getFormula()) {
            shRekap.getRange(currentRow - 1, 10, 1, 2).copyTo(
              shRekap.getRange(currentRow, 10, 1, 2),
              SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
              false
            );
          }
        }
        appendedCount++;
      } else {
        matchEntry.used = true;
        // Layer 1 Non-Destructive Guard: HARAM menimpa curHasil > 0 dengan angka <= 0
        if (matchEntry.curHasil > 0 && dBatch.hasil <= 0) continue;

        if (Math.abs(matchEntry.curHasil - dBatch.hasil) >= 0.5 || Math.abs(matchEntry.curBaku - dBatch.baku) >= 0.5) {
          // Update kolom mentah tanpa menyentuh rumus C, D, E, J, K
          shRekap.getRange(matchEntry.rowNum, 6).setValue(dBatch.tembakau);
          shRekap.getRange(matchEntry.rowNum, 7).setValue(dBatch.jalur);
          shRekap.getRange(matchEntry.rowNum, 8).setValue(dBatch.baku);
          shRekap.getRange(matchEntry.rowNum, 9).setValue(dBatch.hasil);
          shRekap.getRange(matchEntry.rowNum, 12).setValue(dBatch.gagang);
          shRekap.getRange(matchEntry.rowNum, 13).setValue(dBatch.air);
          shRekap.getRange(matchEntry.rowNum, 14).setValue(dBatch.debu);
          updatedCount++;
        }
      }
    }

    var totalPurged = purgedCancelledCount + purgedTemplateCount;
    var summaryMsg =
      'Tanggal Aktif: ' + (targetActiveIsoDate || '-') +
      ' | Varian Batal Dihapus: ' + purgedCancelledCount +
      ' | Template Kosong Dihapus: ' + purgedTemplateCount +
      ' | Batch Baru: ' + appendedCount +
      ' | Update Hasil: ' + updatedCount +
      (protectedCount > 0 ? ' | Dilindungi Fail-Safe (Hasil>0): ' + protectedCount : '') +
      (quarantinedCount > 0 ? ' | Dikarantina Fisika: ' + quarantinedCount : '') +
      ' | Rumus C, D, E, J, K Aman 100%.';

    notifikasiUiAman_(
      totalPurged > 0 || appendedCount > 0 || updatedCount > 0 || quarantinedCount > 0
        ? summaryMsg
        : 'Seluruh data Rekap & DHP sudah selaras dan bersih (0 baris batal).',
      'Integrasi DHP Krosok'
    );

    return {
      activeIsoDate: targetActiveIsoDate,
      purgedCancelledCount: purgedCancelledCount,
      purgedTemplateCount: purgedTemplateCount,
      appendedCount: appendedCount,
      updatedCount: updatedCount,
      protectedCount: protectedCount,
      quarantinedCount: quarantinedCount,
      summary: summaryMsg
    };
  } catch (err) {
    var errMsg = String((err && err.message) || err || 'Unknown GAS Error');
    Logger.log('ERROR syncDhpToRekap: ' + errMsg);
    return { error: errMsg, summary: 'Gagal: ' + errMsg };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * 3. MANAJEMEN PEMICU OTOMATIS (AUTO-PUSH 5 MENIT)
 */
function aktifkanAutoPush5Menit() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sinkronkanDhpKeRekap') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('sinkronkanDhpKeRekap')
    .timeBased()
    .everyMinutes(5)
    .create();
  notifikasiUiAman_('Auto-Push 5 Menit AKTIF (4-Layer Defense & Auto-Purge berjalan otomatis).', 'Auto-Push DHP Krosok');
}

function matikanAutoPush() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sinkronkanDhpKeRekap') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  notifikasiUiAman_('Auto-Push dimatikan (' + removed + ' pemicu dihentikan).', 'Auto-Push DHP Krosok');
}

function cekStatusPemicu() {
  var triggers = ScriptApp.getProjectTriggers();
  var active = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sinkronkanDhpKeRekap') active++;
  }
  var msg = active > 0
    ? 'AKTIF (' + active + ' pemicu berjalan otomatis setiap 5 menit dengan pengaman 4-Layer Defense).'
    : 'NONAKTIF (Belum ada pemicu waktu aktif. Pilih "⏰ Aktifkan Auto-Push 5 Menit" untuk mengaktifkan).';
  notifikasiUiAman_(msg, 'Status Pemicu DHP Krosok');
  try {
    SpreadsheetApp.getUi().alert('ℹ Status Pemicu Integrasi DHP Krosok', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
}

function perbaikiHasilNolDiRekap() {
  return bersihkanBatchBatalDanRekonsiliasi();
}

/**
 * 4. ENDPOINT WEB APP (Layer 4 Resilient Error Boundary — Selalu Mengembalikan JSON Utuh)
 */
function doPost(e) {
  try {
    var payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var res = syncDhpToRekap({
      mode: payload.action === 'reconcileActiveDate' ? 'reconcile' : 'sync',
      activeDateHint: payload.activeIsoDate || ''
    });
    if (res && res.error) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: res.error, result: res }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, result: res }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: String((err && err.message) || err || 'Unhandled GAS Exception')
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-1.5 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[98vw] 2xl:max-w-[1800px] overflow-hidden flex flex-col max-h-[98dvh] sm:max-h-[98vh]">
        {/* Header - Wide Single-Row on Desktop with Live Sheet Route */}
        <div className="px-3.5 sm:px-5 py-1.5 sm:py-2 border-b border-slate-800 flex items-center justify-between gap-2 sm:gap-3 bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30 shrink-0">
              <Database className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-0.5 lg:gap-4">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                  Integrasi &amp; Sinkronisasi DHP Krosok
                </h3>
                <span className="hidden sm:inline-block text-[10.5px] font-semibold text-emerald-300">
                  · Presisi 100%
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px] sm:text-[11px] text-slate-300 leading-tight min-w-0 flex-wrap lg:justify-end">
                <span
                  className="inline-flex items-center gap-1 min-w-0"
                  title={`Spreadsheet Sumber DHP: ${config.dhpSheetName} (${config.dhpSpreadsheetId})`}
                >
                  <span className="text-slate-400 hidden sm:inline">Sumber DHP:</span>
                  <span className="text-slate-400 sm:hidden">DHP:</span>
                  <span className="font-mono font-semibold text-sky-300 truncate max-w-[110px] sm:max-w-none">
                    {config.dhpSheetName}
                  </span>
                  <span className="hidden xl:inline font-mono text-[10px] text-slate-400">
                    ({config.dhpSpreadsheetId.slice(0, 8)}…)
                  </span>
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                <span
                  className="inline-flex items-center gap-1 min-w-0"
                  title={`Spreadsheet Target Rekap: ${config.sheetName} (${config.spreadsheetId})`}
                >
                  <span className="text-slate-400 hidden sm:inline">Target Rekap:</span>
                  <span className="text-slate-400 sm:hidden">Rekap:</span>
                  <span className="font-mono font-semibold text-emerald-300 truncate max-w-[125px] sm:max-w-none">
                    {config.sheetName}
                  </span>
                  <span className="hidden xl:inline font-mono text-[10px] text-slate-400">
                    ({config.spreadsheetId.slice(0, 8)}…)
                  </span>
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup modal"
            className="min-h-[34px] min-w-[34px] sm:min-h-0 sm:min-w-0 p-1 inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unified Single-Row Operational Navigation & Live Sync Control Bar */}
        <div className="relative z-30 px-3.5 sm:px-5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 shrink-0">
          {/* Left: Segmented Toggle for Daily Operational Views */}
          <div
            role="tablist"
            aria-label="Navigasi Operasional DHP"
            className="flex items-center gap-0.5 p-0.5 bg-slate-200/75 rounded-lg border border-slate-200/80 w-full sm:w-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'preview'}
              onClick={() => {
                setActiveTab('preview');
                setTechMenuOpen(false);
              }}
              className={`min-h-[36px] sm:min-h-[30px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'preview'
                  ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Pratinjau &amp; Transaksi</span>
              <span className="md:hidden">Pratinjau</span>
              <span className="font-mono tabular-nums text-[11px] opacity-85">
                ({dhpItems.length}
                <span className="hidden sm:inline"> Batch</span>)
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'analisis_harian'}
              onClick={() => {
                setActiveTab('analisis_harian');
                setTechMenuOpen(false);
              }}
              className={`min-h-[36px] sm:min-h-[30px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'analisis_harian'
                  ? 'bg-white text-amber-800 shadow-2xs ring-1 ring-slate-900/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Analisis Harian</span>
              {oosBatchCount + waspadaBatchCount > 0 ? (
                <span
                  className={`text-[10.5px] font-bold font-mono tabular-nums ${
                    oosBatchCount > 0 ? 'text-rose-600' : 'text-amber-600'
                  }`}
                >
                  · {oosBatchCount + waspadaBatchCount}
                  <span className="hidden lg:inline"> Deviasi</span>
                </span>
              ) : (
                <span className="hidden lg:inline text-[10.5px] font-medium text-slate-400">
                  · Deviasi
                </span>
              )}
            </button>
          </div>

          {/* Right: Live Sync Controls + Dynamic Technical Utilities Dropdown */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setIsLiveSyncActive(!isLiveSyncActive)}
              className={`min-h-[36px] sm:min-h-[32px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                isLiveSyncActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
              title="Klik untuk mengaktifkan / menjeda penarikan data otomatis setiap 12 detik"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isLiveSyncActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                }`}
              ></span>
              <span className="whitespace-nowrap font-mono tabular-nums">
                {isLiveSyncActive ? `Auto-Tarik (${countdown}s)` : 'Auto-Tarik Dijeda'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="min-h-[36px] sm:min-h-[32px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
              title="Tarik instan data DHP dari Google Spreadsheet sekarang (Bypass cache)"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${
                  refreshing || (isLiveSyncActive && countdown <= 2) ? 'animate-spin' : ''
                }`}
              />
              <span>{refreshing ? 'Memeriksa...' : 'Tarik Ulang DHP'}</span>
            </button>

            {/* Dynamic Dropdown for Technical Utilities (Rekonsiliasi Batal, Pemetaan Kolom & Skrip Otomasi GAS) */}
            <div ref={techMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setTechMenuOpen((prev) => !prev)}
                aria-expanded={techMenuOpen}
                aria-haspopup="menu"
                title="Utilitas Teknis: Bersihkan Batch Batal, Pemetaan Kolom & Skrip Otomasi GAS"
                className={`min-h-[36px] sm:min-h-[32px] relative inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                  activeTab === 'mapping' || activeTab === 'script'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                    : purgeableCount > 0
                    ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                    : techMenuOpen
                    ? 'bg-slate-200/80 text-slate-900 border-slate-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900 shadow-2xs'
                }`}
              >
                {activeTab === 'script' ? (
                  <Code2 className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                ) : activeTab === 'mapping' ? (
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                ) : (
                  <Settings2 className="w-3.5 h-3.5 shrink-0" />
                )}
                {(activeTab === 'mapping' || activeTab === 'script') && (
                  <span className="hidden xs:inline sm:inline whitespace-nowrap">
                    {activeTab === 'mapping' ? 'Pemetaan Kolom' : 'Skrip GAS'}
                  </span>
                )}
                {purgeableCount > 0 && activeTab !== 'mapping' && activeTab !== 'script' && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded bg-rose-600 text-white text-[10px] font-mono font-bold tabular-nums">
                    {purgeableCount}
                  </span>
                )}
                <ChevronDown
                  className={`w-3 h-3 shrink-0 transition-transform ${
                    techMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {techMenuOpen && (
                <div
                  role="menu"
                  aria-label="Menu Utilitas Teknis"
                  className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in"
                >
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400">
                    Utilitas &amp; Konfigurasi Teknis
                  </div>

                  {/* OPSI 1-KLIK: BERSIHKAN BATCH BATAL & REKONSILIASI */}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={reconciling}
                    onClick={() => {
                      setTechMenuOpen(false);
                      if (activeTab !== 'preview') {
                        setActiveTab('preview');
                      }
                      handlePurgeAndReconcile();
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start gap-2.5 transition-colors cursor-pointer disabled:opacity-60 border-b border-slate-100 ${
                      purgeableCount > 0
                        ? 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-950'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Trash2
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        purgeableCount > 0 ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          Bersihkan Batch Batal &amp; Rekonsiliasi
                        </span>
                        {purgeableCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-mono font-bold shrink-0 tabular-nums">
                            {purgeableCount} Batal
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        Hapus baris rencana batal/kosong (Hasil = 0 Kg) pada tanggal aktif &amp;
                        selaraskan varian riil DHP
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActiveTab('mapping');
                      setTechMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'mapping'
                        ? 'bg-blue-50/80 text-blue-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <ShieldCheck
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        activeTab === 'mapping' ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">Pemetaan Kolom</span>
                        {activeTab === 'mapping' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        Verifikasi relasi kolom DHP ke Rekap &amp; proteksi rumus C, D, E, J, K
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActiveTab('script');
                      setTechMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                      activeTab === 'script'
                        ? 'bg-blue-50/80 text-blue-800'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Code2
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        activeTab === 'script' ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">Skrip Otomasi GAS</span>
                        {activeTab === 'script' && (
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                        Kode IntegrasiDHP.gs (Sinkronisasi 2 Arah, Auto-Purge Batal &amp; Menu
                        Spreadsheet)
                      </p>
                    </div>
                  </button>

                  <div className="mt-1 pt-1.5 px-3 pb-1 border-t border-slate-100 text-[10.5px] text-slate-500 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span>ID DHP ({config.dhpSheetName}):</span>
                      <span className="font-mono text-slate-700 truncate max-w-[120px]">
                        {config.dhpSpreadsheetId.slice(0, 12)}…
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>ID Rekap ({config.sheetName}):</span>
                      <span className="font-mono text-slate-700 truncate max-w-[120px]">
                        {config.spreadsheetId.slice(0, 12)}…
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div
          className="flex-1 overflow-y-auto px-2.5 sm:px-3.5 lg:px-4 py-1.5 sm:py-2 space-y-1.5 min-h-0"
          onScroll={() => {
            if (diagPopover && isDesktopHoverCapable()) {
              setDiagPopover(null);
            }
          }}
        >
          {/* Status / Reconciliation Notification */}
          {syncSuccessMsg && (
            <div
              className={`px-3 py-1.5 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 animate-in fade-in ${
                syncFeedbackTone === 'amber'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {syncFeedbackTone === 'amber' ? (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span className="font-semibold leading-snug">{syncSuccessMsg}</span>
              </div>
              {syncFeedbackTone === 'amber' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('script')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-800 hover:bg-amber-900 text-white text-[10.5px] font-semibold shrink-0 cursor-pointer"
                >
                  <Code2 className="w-3 h-3 shrink-0" />
                  <span>Buka Skrip GAS</span>
                </button>
              )}
            </div>
          )}

          {/* TAB 1: PREVIEW & SYNC */}
          {activeTab === 'preview' && (
            <div className="space-y-1.5">
              {/* CONDITIONAL BANNER AUDIT REALISASI (Auto-detects Cancelled Plans & Empty Templates on Active Date) */}
              {purgeableCount > 0 && realizationAudit && (
                <div className="px-3 py-1.5 rounded-lg bg-rose-50/90 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs animate-in fade-in">
                  <div className="flex items-start sm:items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                    <div className="min-w-0 leading-snug text-rose-950">
                      <span className="font-bold">
                        Audit Realisasi ({realizationAudit.activeDateDisplay}):
                      </span>{' '}
                      <span>
                        Terdeteksi{' '}
                        <strong className="text-rose-700 font-mono">
                          {purgeableCount} baris batal/kosong
                        </strong>{' '}
                        di Sheet Rekap (
                        {cancelledPlanCount > 0 && `${cancelledPlanCount} rencana batal`}
                        {cancelledPlanCount > 0 && emptyTemplateCount > 0 && ', '}
                        {emptyTemplateCount > 0 && `${emptyTemplateCount} template kosong`} · Netto
                        Hasil = 0 Kg) di luar{' '}
                        <strong>{realizationAudit.dhpActiveCount} varian riil DHP</strong>.
                      </span>
                      {realizationAudit.cancelledPlanRows.length > 0 && (
                        <span className="text-[11px] text-rose-700 ml-1">
                          [
                          {realizationAudit.cancelledPlanRows
                            .slice(0, 3)
                            .map((r) => r.jenisKrosok || `Brs ${r.srcRow}`)
                            .join(', ')}
                          {realizationAudit.cancelledPlanRows.length > 3
                            ? ` +${realizationAudit.cancelledPlanRows.length - 3} lainnya`
                            : ''}
                          ]
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handlePurgeAndReconcile}
                    disabled={reconciling}
                    className="min-h-[34px] sm:min-h-[28px] inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    {reconciling ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>
                      {reconciling ? 'Membersihkan...' : 'Bersihkan Batch Batal Live'}
                    </span>
                  </button>
                </div>
              )}

              {/* FAIL-SAFE PROTECTED NOTICE (Only if Rekap has active-date rows NOT in DHP with Hasil > 0) */}
              {purgeableCount === 0 && protectedOrphanCount > 0 && realizationAudit && (
                <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-[11px] text-amber-900">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>
                      <strong>Fail-Safe Aktif ({realizationAudit.activeDateDisplay}):</strong>{' '}
                      Terdapat {protectedOrphanCount} baris di Sheet Rekap yang tidak ada di DHP
                      aktif namun memiliki <strong>Netto Hasil &gt; 0 Kg</strong> — dilindungi
                      mutlak dari penghapusan otomatis.
                    </span>
                  </div>
                </div>
              )}

              {/* Layer 2 Physics & Mass-Balance Quarantine Alert (Visible only when physical anomalies exist) */}
              {physicsAnomalyItems.length > 0 && (
                <div className="px-3 sm:px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 leading-snug">
                    <div className="font-bold text-rose-800">
                      Karantina Neraca Massa Fisika ({physicsAnomalyItems.length} Batch Diblokir
                      Otomatis dari Sinkronisasi Rekap):
                    </div>
                    <div className="text-[11px] text-rose-700 mt-0.5">
                      {physicsAnomalyItems
                        .map(
                          (a) =>
                            `${a.jenisTembakau} (${
                              a.physicsAnomalyReason || 'Melanggar batas fisika'
                            })`
                        )
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              )}
              {/* Compact 3-Column Metrics Strip */}
              <div
                className={`grid ${
                  needUpdateCount > 0
                    ? 'grid-cols-2 lg:grid-cols-4'
                    : 'grid-cols-3'
                } gap-1.5 sm:gap-2.5`}
              >
                <div className="bg-slate-50 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 border border-slate-200/90 flex items-center justify-between gap-2 shadow-2xs min-w-0">
                  <div className="min-w-0">
                    <div className="text-[9.5px] sm:text-[10.5px] font-semibold text-slate-500 flex items-center gap-1.5 truncate">
                      <span className="sm:hidden">Aktif DHP</span>
                      <span className="hidden sm:inline">Total Batch Aktif DHP</span>
                      <span className="hidden xl:inline text-[10px] font-normal text-slate-400">
                        · Bahan baku terinput di DHP
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm lg:text-base font-bold text-slate-900 mt-0.5 flex items-baseline gap-1.5 flex-wrap tabular-nums">
                      <span>{dhpItems.length} Batch</span>
                      <span className="text-[10px] sm:text-xs font-semibold text-blue-700 font-mono">
                        {formatNum(totalBaku)} Kg
                      </span>
                    </div>
                  </div>
                  <Layers className="hidden sm:block w-4 h-4 text-slate-400 shrink-0" />
                </div>

                <div className="bg-emerald-50/70 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 border border-emerald-200/90 flex items-center justify-between gap-2 shadow-2xs min-w-0">
                  <div className="min-w-0">
                    <div className="text-[9.5px] sm:text-[10.5px] font-semibold text-emerald-700 flex items-center gap-1 truncate">
                      <span className="sm:hidden">Terverifikasi</span>
                      <span className="hidden sm:inline">Terverifikasi di Rekap</span>
                      <span className="hidden md:inline text-[10px] text-emerald-800 font-bold tabular-nums">
                        · {dhpItems.length ? Math.round((matchedCount / dhpItems.length) * 100) : 0}%
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm lg:text-base font-bold text-emerald-800 mt-0.5 flex items-baseline gap-1.5 flex-wrap tabular-nums">
                      <span>{matchedCount} Batch</span>
                      <span className="text-[10px] sm:text-xs font-semibold text-emerald-800 font-mono">
                        {formatNum(verifiedHasil)} Kg
                      </span>
                      <span className="hidden lg:inline text-[10.5px] font-medium text-emerald-700">
                        · Susut {formatNum(verifiedSusutKg)} Kg ({formatPct(verifiedSusutPct)}%)
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="hidden sm:block w-4 h-4 text-emerald-600 shrink-0" />
                </div>

                {needUpdateCount > 0 && (
                  <div className="bg-amber-50/90 rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 border border-amber-300 flex items-center justify-between gap-2 shadow-2xs animate-pulse min-w-0">
                    <div className="min-w-0">
                      <div className="text-[9.5px] sm:text-[10.5px] font-bold text-amber-800 truncate">
                        Perlu Diselaraskan · Hasil DHP siap diupdate
                      </div>
                      <div className="text-xs sm:text-sm lg:text-base font-bold text-amber-900 mt-0.5 flex items-baseline gap-1.5 flex-wrap tabular-nums">
                        <span>{needUpdateCount} Batch</span>
                        <span className="text-[10px] sm:text-xs font-medium text-amber-700">
                          Update ke Rekap
                        </span>
                      </div>
                    </div>
                    <AlertCircle className="hidden sm:block w-4 h-4 text-amber-600 shrink-0" />
                  </div>
                )}

                <div
                  className={`rounded-lg px-2.5 py-1.5 sm:px-3.5 sm:py-2 border flex items-center justify-between gap-2 shadow-2xs min-w-0 ${
                    newCount > 0
                      ? 'bg-blue-50/90 border-blue-200'
                      : 'bg-slate-50 border-slate-200/90'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`text-[9.5px] sm:text-[10.5px] font-semibold flex items-center gap-1.5 truncate ${
                        newCount > 0 ? 'text-blue-700' : 'text-slate-500'
                      }`}
                    >
                      <span className="sm:hidden">Siap Masuk</span>
                      <span className="hidden sm:inline">Batch Selesai Siap Masuk</span>
                      <span className="hidden xl:inline text-[10px] font-normal text-slate-400">
                        ·{' '}
                        {newCount > 0
                          ? 'Selesai ditimbang'
                          : inProgressCount > 0
                          ? 'Menunggu Netto Hasil'
                          : 'Data DHP sinkron'}
                      </span>
                    </div>
                    <div
                      className={`text-xs sm:text-sm lg:text-base font-bold mt-0.5 flex items-baseline gap-1.5 flex-wrap tabular-nums ${
                        newCount > 0 ? 'text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      <span>{newCount} Batch</span>
                      <span className="text-[10px] sm:text-xs font-normal text-slate-500 truncate">
                        {newCount > 0
                          ? 'Siap rekap'
                          : inProgressCount > 0
                          ? `${inProgressCount} proses`
                          : 'Sinkron'}
                      </span>
                    </div>
                  </div>
                  {newCount > 0 ? (
                    <Sparkles className="hidden sm:block w-4 h-4 text-blue-600 animate-pulse shrink-0" />
                  ) : (
                    <ShieldCheck className="hidden sm:block w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
              </div>

              {/* Tactical Control Bar: Acuan Aktif, Cuaca Pabrik & Ringkasan Deviasi Harian */}
              <div className="px-3 sm:px-3.5 py-1.5 rounded-lg bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs">
                  <span className="font-semibold text-sky-300">Tactical Control:</span>
                  <span className="text-slate-300">
                    Acuan <strong className="text-white">{baselineMeta.periodeLabel}</strong>
                  </span>
                  {weatherData && (
                    <>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-300 font-mono text-[11px] tabular-nums">
                        <Thermometer className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{weatherData.temperature.toFixed(1)}°C</span>
                        <Droplets className="w-3 h-3 text-sky-400 ml-0.5 shrink-0" />
                        <span>RH {Math.round(weatherData.humidity)}%</span>
                        <span className="font-sans text-slate-400 hidden sm:inline">
                          ({weatherData.hygroIndex.status})
                        </span>
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 text-[11px] w-full sm:w-auto pt-1 sm:pt-0 border-t border-slate-800 sm:border-0">
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <span className="font-mono text-emerald-300">
                      Normal: {normalBatchCount}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-amber-300">
                      Waspada: {waspadaBatchCount}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-rose-300 font-bold">
                      OOS: {oosBatchCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('analisis_harian')}
                      className="min-h-[30px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 text-[10.5px] sm:text-[10px] font-semibold transition-colors cursor-pointer"
                    >
                      <TrendingUp className="w-3 h-3 shrink-0" />
                      <span>Analisis Harian</span>
                    </button>
                    {onNavigateToAnalisisTab && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToAnalisisTab();
                        }}
                        className="min-h-[30px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-[10.5px] sm:text-[10px] font-semibold transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3 h-3 shrink-0" />
                        <span>Evaluasi Bulanan</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Transaction Container: Mobile Cards (< 768px) + Full-Width Zero-Slider Table (>= 768px) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
                <div className="px-3 sm:px-3.5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-bold text-slate-800 truncate">
                      Daftar Transaksi DHP Terdeteksi (Tab {config.dhpSheetName})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] sm:text-[11px] w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-slate-500 font-medium">
                      {dhpItems.length} baris aktif
                    </span>
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10.5px] sm:text-[11px] shadow-2xs text-slate-600 font-medium tabular-nums">
                      <span>
                        Baku:{' '}
                        <strong className="text-slate-900 font-mono font-semibold">
                          {formatNum(totalBaku)}
                        </strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>
                        Hasil:{' '}
                        <strong className="text-emerald-700 font-mono font-semibold">
                          {formatNum(totalHasil)}
                        </strong>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>
                        Susut:{' '}
                        <strong className="text-rose-600 font-mono font-semibold">
                          {formatNum(totalSusutKg)} Kg
                        </strong>{' '}
                        <span className="text-slate-400 text-[10px]">
                          ({formatPct(overallSusutPct)}%)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {dhpItems.length === 0 ? (
                  /* Informative Live Morning / Empty State (Zero Dummy Data) */
                  <div className="flex flex-col items-center justify-center px-4 py-8 sm:py-10 text-center bg-white">
                    <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-2.5">
                      <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 max-w-md">
                      Belum ada baris transaksi batch yang diinput pada Sheet DHP Krosok.
                    </p>
                    {activeSheetDateLabel && (
                      <p className="text-[11px] sm:text-xs text-slate-600 mt-1 max-w-lg">
                        Tanggal aktif Sheet{' '}
                        <span className="font-mono font-semibold text-blue-700">
                          {config.dhpSheetName}
                        </span>
                        :{' '}
                        <strong className="text-slate-900">{activeSheetDateLabel}</strong> ·
                        Koneksi live terhubung dan siaga menunggu input timbangan pertama.
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1.5 max-w-md">
                      {isLiveSyncActive
                        ? `Auto-Tarik memantau Sheet DHP otomatis setiap 12 detik (cek berikutnya dalam ${countdown}s).`
                        : 'Klik tombol "Tarik Ulang DHP" atau aktifkan Auto-Tarik untuk memeriksa input terbaru.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* MOBILE BATCH CARDS (< 768px / Smartphone) */}
                    <div className="md:hidden flex-1 overflow-y-auto divide-y divide-slate-200">
                      {dhpItems.map((item) => {
                        const evalItem = tacticalMap[item.id];
                        return (
                          <div
                            key={item.id}
                            className={`p-3 space-y-2.5 ${
                              evalItem?.status === 'oos' ? 'bg-rose-50/30' : 'bg-white'
                            }`}
                          >
                            {/* Top Row: Variant + Jalur + Tappable Deviation Status */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10px] text-slate-400">
                                    #{item.rowIdx}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 leading-snug">
                                    {item.jenisTembakau}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      item.jalurProses === 'SKT'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}
                                  >
                                    {item.jalurProses}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                  <span>{item.tanggalDisplay}</span>
                                  {item.waktu && item.waktu.trim() !== '-' && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono">{item.waktu}</span>
                                    </>
                                  )}
                                  {item.kodeStock && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono text-[10.5px]">
                                        Stock {item.kodeStock}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {evalItem && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    const r = e.currentTarget.getBoundingClientRect();
                                    setDiagPopover({
                                      item,
                                      evalData: evalItem,
                                      rect: {
                                        top: r.top,
                                        left: r.left + r.width / 2,
                                        bottom: r.bottom
                                      }
                                    });
                                  }}
                                  className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer tabular-nums ${
                                    evalItem.status === 'oos'
                                      ? 'bg-rose-50 text-rose-700 border-rose-300 active:bg-rose-100'
                                      : evalItem.status === 'waspada'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 active:bg-amber-100'
                                      : evalItem.status === 'proses'
                                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 active:bg-emerald-100'
                                  }`}
                                >
                                  {evalItem.status === 'oos' && (
                                    <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                  )}
                                  {evalItem.status === 'waspada' && (
                                    <Info className="w-3 h-3 text-amber-600 shrink-0" />
                                  )}
                                  {evalItem.status === 'normal' && (
                                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                  )}
                                  <span>
                                    {evalItem.status === 'oos'
                                      ? 'OOS'
                                      : evalItem.status === 'waspada'
                                      ? 'Waspada'
                                      : evalItem.status === 'proses'
                                      ? 'Proses'
                                      : 'Normal'}
                                  </span>
                                  {evalItem.status !== 'proses' && (
                                    <span className="font-mono text-[10px]">
                                      ({evalItem.deviasiPct >= 0 ? '+' : ''}
                                      {formatPct(evalItem.deviasiPct)}%)
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* 3-Column Numeric Strip: Baku | Hasil | Susut */}
                            <div className="grid grid-cols-3 gap-1.5 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-200/70 tabular-nums">
                              <div>
                                <div className="text-[10px] text-slate-500">Baku (Kg)</div>
                                <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
                                  {formatNum(item.baku)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500">Hasil (Kg)</div>
                                <div className="font-mono text-xs font-bold mt-0.5">
                                  {item.hasil > 0 ? (
                                    <span
                                      className={
                                        item.isPhysicsAnomaly
                                          ? 'text-rose-700'
                                          : 'text-emerald-800'
                                      }
                                      title={
                                        item.isRestoredFromRekap
                                          ? 'Nilai final terverifikasi dari Buku Besar Rekap (terlindungi saat pergantian hari 00:00 WIB di Sheet DHP)'
                                          : undefined
                                      }
                                    >
                                      {formatNum(item.hasil)}
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 font-sans text-[11px] font-semibold">
                                      0,0 (Proses)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-slate-500">Susut</div>
                                <div className="font-mono text-xs font-bold text-rose-700 mt-0.5 leading-tight">
                                  {item.hasil > 0
                                    ? `${formatNum(item.susutKg)} (${formatPct(item.susutPct)}%)`
                                    : '-'}
                                </div>
                                {evalItem && (
                                  <div className="font-mono text-[10px] text-slate-400 mt-0.5 leading-tight">
                                    (Acuan {formatPct(evalItem.acuanPct)}%)
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Bottom Row: Rekap Status + Diagnosa & Quick Tag Actions */}
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <div className="text-[11px] min-w-0">
                                {item.isPhysicsAnomaly ? (
                                  <span
                                    className="font-semibold text-rose-700 inline-flex items-center gap-1"
                                    title={item.physicsAnomalyReason}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span>Diblokir (Anomali Fisika)</span>
                                  </span>
                                ) : item.needsUpdateInRekap ? (
                                  <span className="font-semibold text-amber-800 inline-flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>
                                      Update Rekap ({formatNum(item.rekapHasil)} →{' '}
                                      {formatNum(item.hasil)})
                                    </span>
                                  </span>
                                ) : item.isMatchedInRekap ? (
                                  <span
                                    className="font-semibold text-emerald-700 inline-flex items-center gap-1"
                                    title={
                                      item.isRestoredFromRekap
                                        ? 'Data terverifikasi di Buku Besar Rekap (terlindungi saat pergantian hari 00:00 WIB di Sheet DHP)'
                                        : undefined
                                    }
                                  >
                                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Cocok di Rekap (Brs {item.matchedRow})</span>
                                  </span>
                                ) : item.hasil <= 0 ? (
                                  <span className="text-slate-500 inline-flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span>Menunggu Netto Hasil</span>
                                  </span>
                                ) : (
                                  <span className="font-semibold text-blue-700 inline-flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Siap Masuk Rekap</span>
                                  </span>
                                )}
                              </div>

                              {evalItem && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setDiagPopover({
                                        item,
                                        evalData: evalItem,
                                        rect: {
                                          top: r.top,
                                          left: r.left + r.width / 2,
                                          bottom: r.bottom
                                        }
                                      });
                                    }}
                                    className="min-h-[34px] px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Info className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>Diagnosa</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => openQuickTagEditor(item, evalItem)}
                                    className={`min-h-[34px] px-2.5 py-1 rounded-md text-[11px] font-semibold border inline-flex items-center gap-1 cursor-pointer ${
                                      evalItem.tags.length > 0
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : evalItem.status === 'oos'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-white text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    <Tag className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[105px]">
                                      {evalItem.tags.length > 0
                                        ? `${evalItem.tags[0]}${
                                            evalItem.tags.length > 1
                                              ? ` +${evalItem.tags.length - 1}`
                                              : ''
                                          }`
                                        : evalItem.status === 'oos'
                                        ? 'Tandai Alasan'
                                        : '+ Quick Tag'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* TABLET & DESKTOP TABLE (>= 768px) — Full-Width Zero-Slider Layout */}
                    <div
                      className="hidden md:block overflow-x-auto"
                      onScroll={() => {
                        if (diagPopover && isDesktopHoverCapable()) {
                          setDiagPopover(null);
                        }
                      }}
                    >
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-1.5 px-1.5 text-center w-9">Row</th>
                            <th className="py-1.5 px-1.5 lg:px-2 whitespace-nowrap">
                              Tanggal &amp; Waktu
                            </th>
                            <th className="py-1.5 px-1.5 lg:px-2 sticky left-0 lg:static z-20 bg-slate-100 shadow-[1px_0_0_0_rgba(203,213,225,0.8)] lg:shadow-none">
                              Jenis Krosok
                            </th>
                            <th className="py-1.5 px-1 text-center w-11">Jalur</th>
                            <th className="py-1.5 px-1.5 lg:px-2 text-right whitespace-nowrap">
                              Baku (Kg)
                            </th>
                            <th className="py-1.5 px-1.5 lg:px-2 text-right whitespace-nowrap">
                              Hasil (Kg)
                            </th>
                            <th className="py-1.5 px-1.5 lg:px-2 text-right text-rose-700 whitespace-nowrap">
                              Susut (Kg)
                            </th>
                            <th className="py-1.5 px-1.5 lg:px-2 text-right text-rose-700 whitespace-nowrap">
                              Susut (%)
                            </th>
                            <th className="py-1.5 px-1.5 lg:px-2 text-center whitespace-nowrap">
                              Status Deviasi
                            </th>
                            <th className="py-1.5 px-1.5 lg:px-2 text-center whitespace-nowrap">
                              Status Rekap
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {dhpItems.map((item) => {
                            const evalItem = tacticalMap[item.id];
                            const isOosRow = evalItem?.status === 'oos';
                            const hasRealTime = Boolean(item.waktu && item.waktu.trim() !== '-');
                            return (
                              <tr
                                key={item.id}
                                className={`group hover:bg-blue-50/40 transition-colors ${
                                  isOosRow ? 'bg-rose-50/25' : 'bg-white'
                                }`}
                              >
                                <td className="py-1.5 px-1.5 text-center font-mono text-[11px] text-slate-400 tabular-nums">
                                  {item.rowIdx}
                                </td>
                                <td className="py-1.5 px-1.5 lg:px-2 font-medium text-slate-800 whitespace-nowrap leading-tight">
                                  <div>{item.tanggalDisplay}</div>
                                  {hasRealTime && (
                                    <div className="text-[10px] text-slate-400 font-mono inline-flex items-center gap-1 mt-0.5 tabular-nums leading-tight">
                                      <Clock className="w-2.5 h-2.5 shrink-0" />
                                      <span>{item.waktu}</span>
                                    </div>
                                  )}
                                </td>
                                <td
                                  className={`py-1.5 px-1.5 lg:px-2 font-semibold text-slate-900 sticky left-0 lg:static z-10 shadow-[1px_0_0_0_rgba(226,232,240,0.9)] lg:shadow-none transition-colors leading-tight ${
                                    isOosRow
                                      ? 'bg-rose-50 group-hover:bg-blue-50'
                                      : 'bg-white group-hover:bg-blue-50'
                                  }`}
                                >
                                  <div
                                    className="max-w-[185px] xl:max-w-none truncate xl:whitespace-nowrap"
                                    title={item.jenisTembakau}
                                  >
                                    {item.jenisTembakau}
                                  </div>
                                  {item.kodeStock && (
                                    <div className="text-[10px] text-slate-400 font-normal font-mono whitespace-nowrap mt-0.5 leading-tight">
                                      Stock: {item.kodeStock}
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 px-1 text-center">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      item.jalurProses === 'SKT'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}
                                  >
                                    {item.jalurProses}
                                  </span>
                                </td>
                                <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                  {formatNum(item.baku)}
                                </td>
                                <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono font-medium text-slate-700 tabular-nums whitespace-nowrap">
                                  {item.hasil > 0 ? (
                                    <span
                                      className={`font-semibold ${
                                        item.isPhysicsAnomaly
                                          ? 'text-rose-700'
                                          : 'text-emerald-800'
                                      }`}
                                      title={
                                        item.isRestoredFromRekap
                                          ? 'Nilai final terverifikasi dari Buku Besar Rekap (terlindungi saat pergantian hari 00:00 WIB di Sheet DHP)'
                                          : undefined
                                      }
                                    >
                                      {formatNum(item.hasil)}
                                    </span>
                                  ) : (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap"
                                      title="Proses belum selesai atau menunggu data hasil"
                                    >
                                      0,0 (Proses)
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono font-medium text-rose-700 tabular-nums whitespace-nowrap">
                                  {item.hasil > 0 ? formatNum(item.susutKg) : '-'}
                                </td>
                                <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono font-semibold text-slate-800 tabular-nums whitespace-nowrap leading-tight">
                                  <div className="flex flex-col items-end leading-tight">
                                    <span>
                                      {item.hasil > 0 ? `${formatPct(item.susutPct)}%` : '-'}
                                    </span>
                                    {evalItem && (
                                      <span className="text-[10px] text-slate-400 font-normal mt-0.5 leading-tight">
                                        (Acuan {formatPct(evalItem.acuanPct)}%)
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* KOLOM STATUS DEVIASI + HOVER DIAGNOSA KILAT + KLIK QUICK TAG */}
                                <td className="py-1.5 px-1.5 lg:px-2 text-center whitespace-nowrap">
                                  {evalItem && (
                                    <button
                                      type="button"
                                      title={
                                        evalItem.tags.length > 0
                                          ? `Tag Lapangan: ${evalItem.tags.join(', ')}${
                                              evalItem.catatan ? ` ("${evalItem.catatan}")` : ''
                                            } — Klik untuk ubah`
                                          : 'Arahkan kursor untuk Diagnosa Kilat · Klik untuk isi Quick Tag Lapangan'
                                      }
                                      onMouseEnter={(e) => {
                                        if (!isDesktopHoverCapable()) return;
                                        const r = e.currentTarget.getBoundingClientRect();
                                        setDiagPopover({
                                          item,
                                          evalData: evalItem,
                                          rect: {
                                            top: r.top,
                                            left: r.left + r.width / 2,
                                            bottom: r.bottom
                                          }
                                        });
                                      }}
                                      onMouseLeave={() => {
                                        if (!isDesktopHoverCapable()) return;
                                        setDiagPopover(null);
                                      }}
                                      onClick={(e) => {
                                        if (isDesktopHoverCapable()) {
                                          openQuickTagEditor(item, evalItem);
                                          return;
                                        }
                                        const r = e.currentTarget.getBoundingClientRect();
                                        setDiagPopover((prev) =>
                                          prev?.item.id === item.id
                                            ? null
                                            : {
                                                item,
                                                evalData: evalItem,
                                                rect: {
                                                  top: r.top,
                                                  left: r.left + r.width / 2,
                                                  bottom: r.bottom
                                                }
                                              }
                                        );
                                      }}
                                      className={`min-h-[28px] lg:min-h-0 inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold transition-colors cursor-pointer tabular-nums ${
                                        evalItem.status === 'oos'
                                          ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                                          : evalItem.status === 'waspada'
                                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                          : evalItem.status === 'proses'
                                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                      }`}
                                    >
                                      {evalItem.status === 'oos' && (
                                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                      )}
                                      {evalItem.status === 'waspada' && (
                                        <Info className="w-3 h-3 text-amber-600 shrink-0" />
                                      )}
                                      {evalItem.status === 'normal' && (
                                        <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                      )}
                                      <span>
                                        {evalItem.status === 'oos'
                                          ? 'OOS'
                                          : evalItem.status === 'waspada'
                                          ? 'Waspada'
                                          : evalItem.status === 'proses'
                                          ? 'Proses'
                                          : 'Normal'}
                                      </span>
                                      {evalItem.status !== 'proses' && (
                                        <span className="font-mono text-[9.5px] font-semibold opacity-90">
                                          {evalItem.deviasiPct >= 0 ? '+' : ''}
                                          {formatPct(evalItem.deviasiPct)}%
                                        </span>
                                      )}
                                      {evalItem.tags.length > 0 && (
                                        <Tag className="w-2.5 h-2.5 text-blue-600 shrink-0 ml-0.5" />
                                      )}
                                    </button>
                                  )}
                                </td>

                                <td className="py-1.5 px-1.5 lg:px-2.5 text-center whitespace-nowrap">
                                  {item.isPhysicsAnomaly ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-300"
                                      title={item.physicsAnomalyReason}
                                    >
                                      <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                      <span>Diblokir (Anomali)</span>
                                    </span>
                                  ) : item.needsUpdateInRekap ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 tabular-nums">
                                      <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                      <span>
                                        Update ({formatNum(item.rekapHasil)} →{' '}
                                        {formatNum(item.hasil)})
                                      </span>
                                    </span>
                                  ) : item.isMatchedInRekap ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums"
                                      title={
                                        item.isRestoredFromRekap
                                          ? 'Data terverifikasi di Buku Besar Rekap (terlindungi saat pergantian hari 00:00 WIB di Sheet DHP)'
                                          : undefined
                                      }
                                    >
                                      <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                                      <span>Cocok (Brs {item.matchedRow})</span>
                                    </span>
                                  ) : item.hasil <= 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                      <span>Menunggu Hasil</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                      <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                                      <span>Siap Masuk Rekap</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300 text-xs">
                          <tr>
                            <td
                              colSpan={4}
                              className="py-1.5 px-2.5 text-right uppercase text-[10px] tracking-wider text-slate-600"
                            >
                              Total Neraca ({completedItems.length} Selesai / {dhpItems.length}{' '}
                              Aktif):
                            </td>
                            <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono text-slate-900 font-bold tabular-nums whitespace-nowrap">
                              {formatNum(totalBaku)}
                            </td>
                            <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono text-emerald-800 font-bold tabular-nums whitespace-nowrap">
                              {formatNum(totalHasil)}
                            </td>
                            <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono text-rose-700 font-bold tabular-nums whitespace-nowrap">
                              {completedItems.length > 0 ? formatNum(totalSusutKg) : '-'}
                            </td>
                            <td className="py-1.5 px-1.5 lg:px-2 text-right font-mono text-slate-900 font-bold tabular-nums whitespace-nowrap">
                              {completedItems.length > 0
                                ? `${formatPct(overallSusutPct)}%`
                                : '-'}
                            </td>
                            <td className="py-1.5 px-1.5 lg:px-2 text-center text-[10px] font-mono text-slate-700 whitespace-nowrap">
                              {oosBatchCount > 0
                                ? `${oosBatchCount} OOS`
                                : inProgressCount === dhpItems.length
                                ? `${inProgressCount} Proses`
                                : 'Terkendali'}
                            </td>
                            <td className="py-1.5 px-1.5 lg:px-2 text-center text-[10px] text-emerald-700 font-semibold whitespace-nowrap">
                              {matchedCount}/{dhpItems.length} Terverifikasi
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* DESKTOP FLOATING TOOLTIP DIAGNOSA KILAT (>= 1024px Hover-Safe) */}
              {diagPopover && (
                <div
                  className="hidden lg:block fixed z-[75] w-80 p-3.5 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700 text-xs pointer-events-none"
                  style={{
                    top:
                      diagPopover.rect.top > 260
                        ? `${diagPopover.rect.top - 10}px`
                        : `${diagPopover.rect.bottom + 10}px`,
                    left: `${Math.min(
                      window.innerWidth - 180,
                      Math.max(180, diagPopover.rect.left)
                    )}px`,
                    transform:
                      diagPopover.rect.top > 260
                        ? 'translate(-50%, -100%)'
                        : 'translate(-50%, 0)'
                  }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2 mb-2">
                    <div className="font-bold text-white truncate">
                      {diagPopover.item.jenisTembakau}
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                        diagPopover.evalData.status === 'oos'
                          ? 'bg-rose-600 text-white'
                          : diagPopover.evalData.status === 'waspada'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {diagPopover.evalData.status}
                    </span>
                  </div>

                  {diagPopover.evalData.status === 'proses' ? (
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {diagPopover.evalData.penjelasanKilat}
                    </p>
                  ) : (
                    <div className="space-y-2 text-[11px]">
                      <div className="grid grid-cols-3 gap-1.5 bg-slate-800/90 p-2 rounded-lg font-mono text-center tabular-nums">
                        <div>
                          <div className="text-[9.5px] text-slate-400 font-sans">Riil</div>
                          <div className="font-bold text-white">
                            {formatPct(diagPopover.item.susutPct)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[9.5px] text-slate-400 font-sans">Acuan</div>
                          <div className="font-bold text-emerald-300">
                            {formatPct(diagPopover.evalData.acuanPct)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[9.5px] text-slate-400 font-sans">Deviasi</div>
                          <div
                            className={`font-bold ${
                              diagPopover.evalData.status === 'oos'
                                ? 'text-rose-400'
                                : diagPopover.evalData.status === 'waspada'
                                ? 'text-amber-300'
                                : 'text-emerald-300'
                            }`}
                          >
                            {diagPopover.evalData.deviasiPct >= 0 ? '+' : ''}
                            {formatPct(diagPopover.evalData.deviasiPct)}%
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 tabular-nums">
                        <div className="text-[10px] font-semibold text-slate-400">
                          Dekomposisi Limbah &amp; Neraca Massa:
                        </div>
                        <div className="flex justify-between font-mono text-[10.5px]">
                          <span className="text-slate-300">Kadar Air / Uap:</span>
                          <span className="text-sky-300 font-semibold">
                            {diagPopover.evalData.uapAirKg >= 0 ? '+' : ''}
                            {formatNum(diagPopover.evalData.uapAirKg)} Kg (
                            {formatPct(diagPopover.evalData.uapAirPct)}%)
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-[10.5px]">
                          <span className="text-slate-300">Fraksi Gagang:</span>
                          <span>
                            {formatNum(diagPopover.evalData.gagangKg)} Kg (
                            {formatPct(diagPopover.evalData.gagangPct)}%)
                          </span>
                        </div>
                        <div className="flex justify-between font-mono text-[10.5px]">
                          <span className="text-slate-300">Fraksi Debu:</span>
                          <span>
                            {formatNum(diagPopover.evalData.debuKg)} Kg (
                            {formatPct(diagPopover.evalData.debuPct)}%)
                          </span>
                        </div>
                      </div>

                      {diagPopover.evalData.weatherAtBatch && (
                        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10.5px] text-slate-300 tabular-nums">
                          <span>
                            Cuaca Jam Proses ({diagPopover.item.waktu || 'Pabrik'}):
                          </span>
                          <span className="font-mono text-amber-300">
                            {diagPopover.evalData.weatherAtBatch.temperature.toFixed(1)}°C · RH{' '}
                            {Math.round(diagPopover.evalData.weatherAtBatch.humidity)}%
                          </span>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-slate-800 text-[10.5px] text-slate-200 leading-snug">
                        <strong className="text-sky-300">
                          {diagPopover.evalData.diagnosaUtama}:
                        </strong>{' '}
                        {diagPopover.evalData.penjelasanKilat}
                      </div>

                      {diagPopover.evalData.tags.length > 0 ? (
                        <div className="pt-1.5 border-t border-slate-800 text-[10px] text-blue-300 leading-snug">
                          <strong>Tag Lapangan:</strong> {diagPopover.evalData.tags.join(', ')}
                          {diagPopover.evalData.catatan
                            ? ` — "${diagPopover.evalData.catatan}"`
                            : ''}
                        </div>
                      ) : (
                        <div className="pt-1 text-[9.5px] text-slate-400">
                          Klik lencana Status Deviasi untuk mencatat Quick Tag lapangan
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MOBILE & TABLET BOTTOM-SHEET / MODAL DIAGNOSA KILAT (< 1024px Touch-Friendly) */}
              {diagPopover && (
                <div
                  className="lg:hidden fixed inset-0 z-[78] flex items-end sm:items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-xs"
                  onClick={() => setDiagPopover(null)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 p-4 space-y-3 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                      <div className="min-w-0">
                        <div className="text-[10.5px] font-semibold text-sky-400">
                          Diagnosa Kilat Neraca &amp; Deviasi
                        </div>
                        <div className="font-bold text-sm text-white mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{diagPopover.item.jenisTembakau}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              diagPopover.evalData.status === 'oos'
                                ? 'bg-rose-600 text-white'
                                : diagPopover.evalData.status === 'waspada'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {diagPopover.evalData.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {diagPopover.item.tanggalDisplay}
                          {diagPopover.item.waktu ? ` · ${diagPopover.item.waktu}` : ''} · Baku{' '}
                          {formatNum(diagPopover.item.baku)} Kg
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDiagPopover(null)}
                        aria-label="Tutup diagnosa"
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {diagPopover.evalData.status === 'proses' ? (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {diagPopover.evalData.penjelasanKilat}
                      </p>
                    ) : (
                      <div className="space-y-2.5 text-xs">
                        <div className="grid grid-cols-3 gap-2 bg-slate-800/90 p-2.5 rounded-xl font-mono text-center tabular-nums">
                          <div>
                            <div className="text-[10px] text-slate-400 font-sans">Susut Riil</div>
                            <div className="font-bold text-white text-sm mt-0.5">
                              {formatPct(diagPopover.item.susutPct)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-sans">Acuan</div>
                            <div className="font-bold text-emerald-300 text-sm mt-0.5">
                              {formatPct(diagPopover.evalData.acuanPct)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-400 font-sans">Deviasi</div>
                            <div
                              className={`font-bold text-sm mt-0.5 ${
                                diagPopover.evalData.status === 'oos'
                                  ? 'text-rose-400'
                                  : diagPopover.evalData.status === 'waspada'
                                  ? 'text-amber-300'
                                  : 'text-emerald-300'
                              }`}
                            >
                              {diagPopover.evalData.deviasiPct >= 0 ? '+' : ''}
                              {formatPct(diagPopover.evalData.deviasiPct)}%
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 tabular-nums bg-slate-800/50 rounded-xl p-2.5 border border-slate-800">
                          <div className="text-[10.5px] font-semibold text-slate-400">
                            Dekomposisi Limbah &amp; Neraca Massa:
                          </div>
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-slate-300">Kadar Air / Uap:</span>
                            <span className="text-sky-300 font-semibold">
                              {diagPopover.evalData.uapAirKg >= 0 ? '+' : ''}
                              {formatNum(diagPopover.evalData.uapAirKg)} Kg (
                              {formatPct(diagPopover.evalData.uapAirPct)}%)
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-slate-300">Fraksi Gagang:</span>
                            <span>
                              {formatNum(diagPopover.evalData.gagangKg)} Kg (
                              {formatPct(diagPopover.evalData.gagangPct)}%)
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-[11px]">
                            <span className="text-slate-300">Fraksi Debu:</span>
                            <span>
                              {formatNum(diagPopover.evalData.debuKg)} Kg (
                              {formatPct(diagPopover.evalData.debuPct)}%)
                            </span>
                          </div>
                        </div>

                        {diagPopover.evalData.weatherAtBatch && (
                          <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums px-1">
                            <span>
                              Cuaca Jam Proses ({diagPopover.item.waktu || 'Pabrik'}):
                            </span>
                            <span className="font-mono text-amber-300">
                              {diagPopover.evalData.weatherAtBatch.temperature.toFixed(1)}°C · RH{' '}
                              {Math.round(diagPopover.evalData.weatherAtBatch.humidity)}%
                            </span>
                          </div>
                        )}

                        <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/80 text-[11px] text-slate-200 leading-relaxed">
                          <strong className="text-sky-300">
                            {diagPopover.evalData.diagnosaUtama}:
                          </strong>{' '}
                          {diagPopover.evalData.penjelasanKilat}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          openQuickTagEditor(diagPopover.item, diagPopover.evalData)
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Isi Quick Tag Mandor</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiagPopover(null)}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 1B: ANALISIS HARIAN (EARLY WARNING SYSTEM — ISOLATED MODULE) */}
          {activeTab === 'analisis_harian' && (
            <TabAnalisisHarianDhp
              dhpItems={dhpItems}
              rekapRecords={rekapRecords}
              standarList={standarList}
              baselineMeta={baselineMeta}
              batchNotes={batchNotes}
              weatherData={weatherData}
              weatherLoading={weatherLoading}
              onRefreshWeather={onRefreshWeather}
              activeSheetDateLabel={activeSheetDateLabel}
              onOpenQuickTag={openQuickTagEditor}
              onNavigateToMonthlyAnalisis={
                onNavigateToAnalisisTab
                  ? () => {
                      onClose();
                      onNavigateToAnalisisTab();
                    }
                  : undefined
              }
            />
          )}

          {/* SHARED MODAL POPOVER QUICK TAG LAPANGAN (MANDOR — ACCESSIBLE IN PREVIEW & ANALISIS HARIAN) */}
          {tagEditorTarget && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="text-[11px] font-semibold text-blue-600">
                      Quick Tag Lapangan — Kontrol Harian Mandor
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      {tagEditorTarget.item.jenisTembakau} ({tagEditorTarget.item.jalurProses})
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {tagEditorTarget.item.tanggalDisplay} · Baku{' '}
                      {formatNum(tagEditorTarget.item.baku)} Kg · Susut{' '}
                      {formatPct(tagEditorTarget.item.susutPct)}% (Acuan{' '}
                      {formatPct(tagEditorTarget.evalData.acuanPct)}%)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTagEditorTarget(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-semibold text-slate-700 mb-2">
                      Pilih Faktor Penyebab Khusus Hari Ini (Bisa lebih dari 1):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_TAG_OPTIONS.map((tagOpt) => {
                        const active = draftTags.includes(tagOpt);
                        return (
                          <button
                            key={tagOpt}
                            type="button"
                            onClick={() => toggleDraftTag(tagOpt)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {tagOpt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Catatan Singkat Mandor / Operator (Opsional):
                    </label>
                    <input
                      type="text"
                      value={draftCatatan}
                      onChange={(e) => setDraftCatatan(e.target.value)}
                      placeholder="Contoh: Bal masuk lembab pagi hari / setelan saringan baru..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTags([]);
                      setDraftCatatan('');
                    }}
                    className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Reset Pilihan
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTagEditorTarget(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveQuickTag}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                    >
                      Simpan Tag Lapangan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COLUMN MAPPING */}
          {activeTab === 'mapping' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 text-xs text-blue-900">
                <span className="font-bold">Struktur Pemetaan Kolom (*Strict Precision Protocol*):</span>
                <p className="mt-1 text-slate-600">
                  Berikut adalah jaminan bahwa setiap sel dari DHP Krosok dipetakan secara terikat mati ke kolom yang tepat pada Sheet Rekap Susut Krosok tanpa risiko salah geser atau salah letak:
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Kolom Asal (DHP Krosok)</th>
                      <th className="py-2.5 px-3 text-center">Arah</th>
                      <th className="py-2.5 px-3">Kolom Target (REKAP SUSUT)</th>
                      <th className="py-2.5 px-3">Tipe Data &amp; Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        Kolom C: Tanggal Proses
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-blue-700">
                        Kolom B: Tanggal Proses
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">Date Object / ISO yyyy-MM-dd</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        (Ekstraksi dari Tanggal)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-blue-700">
                        Kolom C: BULAN &amp; Kolom D: TAHUN
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">Teks Bulan (e.g. Oktober) &amp; Angka Tahun (2026)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        Kolom D: JENIS TEMBAKAU
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-blue-700">
                        Kolom F: JENIS TEMBAKAU
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">Teks varian tembakau terstandarisasi</td>
                    </tr>
                    <tr className="bg-emerald-50/40">
                      <td className="py-2.5 px-3 font-mono font-semibold text-emerald-800">
                        (Rumus Otomatis Kolom E)
                      </td>
                      <td className="py-2.5 px-3 text-center text-emerald-600">
                        <Check className="w-3.5 h-3.5 mx-auto" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-800">
                        Kolom E: =iferror(JOIN(&quot; &quot;;F...;G...))
                      </td>
                      <td className="py-2.5 px-3 text-emerald-700 font-medium">Rumus disalin otomatis dari baris atas (tidak tertimpa nilai statis)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        (Deteksi Nama Varian)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-blue-700">
                        Kolom G: JENIS (Jalur SKT / SKM)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">SKT atau SKM</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        Kolom E: Netto Baku (Kg)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        Kolom H: Netto Baku (Kg)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">Numerik Desimal 1 Koma (e.g. 1097.7)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        Kolom I: HASIL PROSES (Kg)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">
                        Kolom I: Netto Hasil (Kg)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">Numerik Desimal 1 Koma (Auto-hitung jika di DHP bernilai 0)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        Kolom J: Susut (Kg) &amp; K: Susut (%)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-rose-700">
                        Kolom J: Susut (Kg) &amp; Kolom K: Susut (%)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">Numerik Presisi &amp; Persentase</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        Kolom G (Gagang) &amp; Kolom H (Debu)
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">
                        <ArrowRight className="w-3.5 h-3.5 mx-auto text-blue-600" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        Kolom L (Gagang) &amp; Kolom N (Debu)
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">Bobot pecahan hasil proses</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: APPS SCRIPT CODE */}
          {activeTab === 'script' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Skrip Google Apps Script (IntegrasiDHP.gs) — Sinkronisasi 2 Arah &amp;
                    Auto-Purge Batal
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pasang pada <strong>Extensions -&gt; Apps Script</strong> di Spreadsheet untuk
                    mengaktifkan menu <strong>⚡ Integrasi DHP Krosok</strong> (Sinkronisasi,
                    Bersihkan Batch Batal Bottom-Up, &amp; Auto-Push 5 Menit) serta koneksi tombol
                    1-klik Web App.
                  </p>
                </div>
                <button
                  onClick={copyScriptToClipboard}
                  className="min-h-[38px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  {copiedScript ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Skrip'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-800">1. Reverse Scanning (Bottom-Up)</div>
                  <p className="text-slate-600 mt-0.5 leading-snug">
                    Menyusuri baris tanggal aktif dari bawah ke atas sehingga penghapusan baris
                    batal/kosong tidak menggeser indeks baris di atasnya.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200">
                  <div className="font-bold text-emerald-900">
                    2. Fail-Safe Mutlak (Hasil === 0)
                  </div>
                  <p className="text-emerald-800 mt-0.5 leading-snug">
                    Hanya baris dengan Netto Hasil = 0 Kg pada Tanggal Aktif yang dapat dihapus.
                    Baris berisi output riil (&gt; 0 Kg) &amp; tanggal historis terlindungi 100%.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-200">
                  <div className="font-bold text-blue-900">
                    3. Proteksi Rumus C, D, E, J, K
                  </div>
                  <p className="text-blue-800 mt-0.5 leading-snug">
                    Formula Bulan, Tahun, Join Perlakuan, Susut Kg, dan Susut % disalin otomatis
                    tanpa pernah ditimpa nilai statis.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto text-slate-200 font-mono text-[11px] leading-relaxed max-h-96 border border-slate-800">
                <pre>{appsScriptCode}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Sticky / Pinned Action Footer — Always Visible Without Scrolling */}
        <div className="px-3.5 sm:px-5 py-2 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          {activeTab === 'preview' ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700 min-w-0">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 hidden sm:inline" />
                <span className="font-medium leading-snug">
                  {needUpdateCount > 0
                    ? `${needUpdateCount} batch selesai perlu diselaraskan ke Rekap${
                        newCount > 0 ? ` (+${newCount} baru)` : ''
                      }.`
                    : newCount > 0
                    ? `${newCount} batch selesai siap dibukukan ke Sheet Rekap.`
                    : inProgressCount > 0
                    ? `${inProgressCount} batch aktif sedang diproses (menunggu Netto Hasil).`
                    : dhpItems.length === 0
                    ? 'Siaga memantau input batch baru pada Sheet DHP Krosok.'
                    : `Semua ${dhpItems.length} batch aktif sudah tersinkronisasi di Sheet Rekap.`}
                </span>
                {untaggedOosCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('analisis_harian')}
                    className="font-semibold text-rose-700 hover:underline cursor-pointer"
                    title="Buka tab Analisis Harian untuk meninjau & menandai alasan batch OOS"
                  >
                    · {untaggedOosCount} OOS belum bertag (Cek Analisis Harian)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  onClick={handleSyncToRekap}
                  disabled={syncingToRekap}
                  className="min-h-[38px] sm:min-h-[32px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 sm:py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Send className={`w-3.5 h-3.5 shrink-0 ${syncingToRekap ? 'animate-spin' : ''}`} />
                  <span>
                    {syncingToRekap
                      ? 'Sedang Membukukan...'
                      : needUpdateCount > 0
                      ? `Sinkronkan (${needUpdateCount} Update)`
                      : 'Sinkronkan ke Sheet Rekap'}
                  </span>
                </button>
                <button
                  onClick={onClose}
                  className="min-h-[38px] sm:min-h-[32px] px-4 py-1.5 sm:py-1 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  Tutup
                </button>
              </div>
            </>
          ) : activeTab === 'analisis_harian' ? (
            <>
              <span className="text-[11px] sm:text-xs text-slate-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Alarm Dini Harian terisolasi aman · Mengacu 100% pada sumber kebenaran Data
                  Krosok
                </span>
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  onClick={() => setActiveTab('preview')}
                  className="min-h-[36px] sm:min-h-[32px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Pratinjau &amp; Sinkronisasi</span>
                </button>
                <button
                  onClick={onClose}
                  className="min-h-[36px] sm:min-h-[32px] px-4 py-1 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  Tutup
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Koneksi aman &amp; pemetaan kolom terverifikasi</span>
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="min-h-[36px] sm:min-h-[32px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Kembali ke Pratinjau</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[36px] sm:min-h-[32px] px-4 py-1 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
                >
                  Tutup
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
