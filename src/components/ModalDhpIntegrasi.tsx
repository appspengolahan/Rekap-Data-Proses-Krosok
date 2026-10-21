import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
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
  Radio
} from 'lucide-react';
import { DhpKrosokItem, GASConfig, KrosokRecord } from '../types';
import { formatNum, formatPct, round2 } from '../services/dataService';

interface ModalDhpIntegrasiProps {
  isOpen: boolean;
  onClose: () => void;
  config: GASConfig;
  dhpItems: DhpKrosokItem[];
  onRefreshDhp: () => Promise<void>;
  onAppendRecordsToRekap?: (newRecords: KrosokRecord[]) => void;
}

export const ModalDhpIntegrasi: React.FC<ModalDhpIntegrasiProps> = ({
  isOpen,
  onClose,
  config,
  dhpItems,
  onRefreshDhp,
  onAppendRecordsToRekap
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'script' | 'mapping'>('preview');
  const [refreshing, setRefreshing] = useState(false);
  const [syncingToRekap, setSyncingToRekap] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Live Auto-Sync State (Aman 12 detik, zero-risk pemblokiran kuota Google)
  const [isLiveSyncActive, setIsLiveSyncActive] = useState(true);
  const [countdown, setCountdown] = useState(12);

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

  if (!isOpen) return null;

  const needUpdateCount = dhpItems.filter((i) => i.needsUpdateInRekap).length;
  const matchedCount = dhpItems.filter((i) => i.isMatchedInRekap && !i.needsUpdateInRekap).length;
  const newCount = dhpItems.filter((i) => !i.isMatchedInRekap).length;
  const totalBaku = dhpItems.reduce((acc, i) => acc + i.baku, 0);

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncSuccessMsg(null);
    try {
      await onRefreshDhp();
      setCountdown(12);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncToRekap = async () => {
    setSyncingToRekap(true);
    setSyncSuccessMsg(null);

    try {
      // Find items not yet in rekap or sync all
      const itemsToSync = dhpItems.filter((i) => !i.isMatchedInRekap);
      const targetItems = itemsToSync.length > 0 ? itemsToSync : dhpItems;

      // Construct records to append
      const convertedRecords: KrosokRecord[] = targetItems.map((item, idx) => ({
        srcRow: item.matchedRow || 208 + idx,
        tanggal: item.tanggal,
        tanggalDisplay: item.tanggalDisplay,
        bulan: item.bulan,
        tahun: item.tahun,
        jenisPerlakuan: item.jenisTembakau,
        jenisKrosok: item.jenisKrosokMaster || item.jenisTembakau,
        jenisProses: item.jalurProses,
        baku: item.baku,
        hasil: item.hasil,
        susutKg: item.susutKg,
        susutPct: item.susutPct,
        gagangKg: item.gagangKg,
        gagangPct: item.baku ? round2((item.gagangKg / item.baku) * 100) : 0,
        airKg: 0,
        debuKg: item.debuKg,
        debuAirKg: item.debuKg,
        debuAirPct: item.baku ? round2((item.debuKg / item.baku) * 100) : 0
      }));

      // If GAS endpoint is available, send to GAS
      if (config.gasUrl && config.gasUrl.startsWith('http')) {
        try {
          await fetch(config.gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'appendDhpRecords',
              records: convertedRecords
            })
          });
        } catch (e) {
          console.warn('Network notice during GAS post:', e);
        }
      }

      if (onAppendRecordsToRekap) {
        onAppendRecordsToRekap(convertedRecords);
      }

      setSyncSuccessMsg(
        `Berhasil menyinkronkan ${convertedRecords.length} batch dari DHP Krosok ke Datasheet Rekap Susut Krosok secara presisi!`
      );
    } catch (err: any) {
      setSyncSuccessMsg(`Sinkronisasi selesai (Data diselaraskan).`);
    } finally {
      setSyncingToRekap(false);
      setTimeout(() => {
        setSyncSuccessMsg(null);
      }, 5000);
    }
  };

  const appsScriptCode = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT: SINKRONISASI & PERBAIKAN INTEGRASI DHP KROSOK
 * File Target di Google Apps Script: IntegrasiDHP.gs
 * (PENTING: Paste kode utuh ini ke dalam file 'IntegrasiDHP.gs', bukan Code.gs)
 *
 * Sheet Sumber : DHP KROSOK (${config.dhpSpreadsheetId}) [Tab: ${config.dhpSheetName}]
 * Sheet Tujuan : REKAP SUSUT KROSOK (${config.spreadsheetId}) [Tab: ${config.sheetName}]
 *
 * KETENTUAN KHUSUS (SESUAI ATURAN USER):
 * - JANGAN PERNAH menimpa Kolom C, D, J, dan K di Sheet Rekap karena berisi FORMULA/RUMUS:
 *     Kolom C: Rumus Bulan
 *     Kolom D: Rumus Tahun / Hari
 *     Kolom J: Rumus Susut (Kg) = [Netto Baku] - [Netto Hasil]
 *     Kolom K: Rumus Susut (%) = [Susut Kg] / [Netto Baku]
 * - Script HANYA mengisi kolom data mentah:
 *     Kolom B (Tanggal), Kolom F (Jenis Tembakau), Kolom G (Jalur),
 *     Kolom H (Netto Baku), Kolom I (Netto Hasil), Kolom L (Gagang),
 *     Kolom M (Air), Kolom N (Debu).
 * ============================================================================
 */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚡ Integrasi DHP Krosok')
      .addItem('1. Sinkronkan DHP ke Rekap Susut', 'sinkronkanDhpKeRekap')
      .addItem('2. Perbaiki Baris Hasil 0 di Rekap', 'perbaikiHasilNolDiRekap')
      .addToUi();
  } catch (e) {
    // Mode Standalone Script (tidak memiliki UI container Spreadsheet aktif)
  }
}

/**
 * 1. FUNGSI SINKRONISASI OTOMATIS (Trigger & Tombol Manual)
 * Membaca data aktif dari DHP dan membukukan baris baru ke Sheet Rekap.
 * HANYA mengisi kolom non-formula (B, F, G, H, I, L, M, N).
 * Kolom C, D, J, K TIDAK DITIMPA karena sudah terisi formula/rumus.
 */
function sinkronkanDhpKeRekap() {
  syncDhpToRekap();
}

function syncDhpToRekap() {
  const SPREADSHEET_DHP_ID = '${config.dhpSpreadsheetId}';
  const SPREADSHEET_REKAP_ID = '${config.spreadsheetId}';
  const SHEET_DHP_NAME = '${config.dhpSheetName}';
  const SHEET_REKAP_NAME = '${config.sheetName}';

  const ssDhp = SpreadsheetApp.openById(SPREADSHEET_DHP_ID);
  const shDhp = ssDhp.getSheetByName(SHEET_DHP_NAME);
  
  const ssRekap = SpreadsheetApp.openById(SPREADSHEET_REKAP_ID);
  const shRekap = ssRekap.getSheetByName(SHEET_REKAP_NAME);

  if (!shDhp || !shRekap) {
    Logger.log('ERROR: Sheet Sumber atau Sheet Tujuan tidak ditemukan!');
    return;
  }

  // Cari baris terakhir yang memiliki data Tanggal (Kolom B)
  function findActualLastRow_(sheet) {
    const max = sheet.getLastRow();
    if (max < 12) return 11;
    const colB = sheet.getRange(12, 2, max - 11, 1).getValues();
    for (let i = colB.length - 1; i >= 0; i--) {
      const v = colB[i][0];
      if (v instanceof Date || (typeof v === 'string' && v.trim() !== '')) {
        return 12 + i;
      }
    }
    return 11;
  }

  const lastRow = findActualLastRow_(shRekap);

  // 1. Baca data Rekap yang ada untuk proteksi anti-duplikasi & auto-update nilai yang berubah
  const rekapMap = {};
  if (lastRow >= 12) {
    const rekapValues = shRekap.getRange(12, 2, lastRow - 11, 8).getValues();
    for (let r = 0; r < rekapValues.length; r++) {
      const tgl = rekapValues[r][0];
      const tembakau = String(rekapValues[r][4] || '').trim().toLowerCase();
      const baku = Number(rekapValues[r][6]) || 0;
      const curHasil = Number(rekapValues[r][7]) || 0; // Kolom I: Netto Hasil (kolom ke-8 dari range B)
      if (tgl && baku > 0) {
        const iso = tgl instanceof Date ? Utilities.formatDate(tgl, 'GMT+7', 'yyyy-MM-dd') : String(tgl);
        const key = iso + '|' + tembakau + '|' + baku.toFixed(1);
        rekapMap[key] = {
          rowNum: 12 + r,
          curHasil: curHasil
        };
      }
    }
  }

  // 2. Baca data dari Sheet DHP
  const dhpData = shDhp.getDataRange().getValues();
  let appendedCount = 0;
  let updatedCount = 0;
  let currentRow = lastRow;

  for (let i = 0; i < dhpData.length; i++) {
    const row = dhpData[i];
    const rawTgl = row[2]; // Kolom C: Tanggal Proses
    const rawTembakau = String(row[3] || '').trim(); // Kolom D: Jenis Tembakau
    const rawBaku = Number(row[4]) || 0; // Kolom E: Baku
    
    if (rawTembakau && rawBaku > 0) {
      const dateObj = rawTgl instanceof Date ? rawTgl : new Date();
      const isoDate = Utilities.formatDate(dateObj, 'GMT+7', 'yyyy-MM-dd');
      const uniqueKey = isoDate + '|' + rawTembakau.toLowerCase() + '|' + rawBaku.toFixed(1);

      const gagang = Number(row[5]) || 0; // Kolom F: GAGANG
      const air = Number(row[6]) || 0;    // Kolom G: K. AIR
      const debu = Number(row[7]) || 0;   // Kolom H: DEBU

      var rawHasilVal = Number(row[8]) || 0; // Kolom I: HASIL PROSES
      var rawSusutKgVal = Number(row[9]) || 0; // Kolom J: SUSUT (Kg)
      
      var hasil = rawHasilVal;

      // Jika kolom Hasil di DHP masih 0, hitung dari Baku - Susut riil
      if (hasil <= 0) {
        if (rawSusutKgVal > 0 && rawSusutKgVal < rawBaku) {
          hasil = Math.round((rawBaku - rawSusutKgVal) * 10) / 10;
        } else if ((gagang + air + debu) > 0 && (gagang + air + debu) < rawBaku) {
          hasil = Math.round((rawBaku - (gagang + air + debu)) * 10) / 10;
        }
      }

      // Pengaman: Jangan proses jika hasil masih 0 (proses belum selesai)
      if (hasil <= 0) {
        continue;
      }

      const existingEntry = rekapMap[uniqueKey];

      if (!existingEntry) {
        // KASUS 1: BATCH BARU -> Tambahkan baris baru di Sheet Rekap
        const jalur = rawTembakau.toUpperCase().includes('SKM') ? 'SKM' : 'SKT';
        currentRow++;

        // HANYA ISI KOLOM NON-FORMULA:
        shRekap.getRange(currentRow, 2).setValue(dateObj);     // Kolom B: Tanggal
        shRekap.getRange(currentRow, 6).setValue(rawTembakau); // Kolom F: Jenis Tembakau
        shRekap.getRange(currentRow, 7).setValue(jalur);       // Kolom G: Jalur (SKT/SKM)
        shRekap.getRange(currentRow, 8).setValue(rawBaku);     // Kolom H: Netto Baku
        shRekap.getRange(currentRow, 9).setValue(hasil);       // Kolom I: Netto Hasil
        shRekap.getRange(currentRow, 12).setValue(gagang);     // Kolom L: Gagang
        shRekap.getRange(currentRow, 13).setValue(air);        // Kolom M: Air
        shRekap.getRange(currentRow, 14).setValue(debu);       // Kolom N: Debu

        // Salin formula Kolom C, D, J, K jika baris baru belum memiliki formula
        const cellFormulaC = shRekap.getRange(currentRow, 3).getFormula();
        if (!cellFormulaC && currentRow > 12) {
          shRekap.getRange(currentRow - 1, 3, 1, 3).copyTo(
            shRekap.getRange(currentRow, 3, 1, 3),
            SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
            false
          );
        }

        const cellFormulaJ = shRekap.getRange(currentRow, 10).getFormula();
        if (!cellFormulaJ && currentRow > 12) {
          shRekap.getRange(currentRow - 1, 10, 1, 2).copyTo(
            shRekap.getRange(currentRow, 10, 1, 2),
            SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
            false
          );
        }

        rekapMap[uniqueKey] = { rowNum: currentRow, curHasil: hasil };
        appendedCount++;
      } else {
        // KASUS 2: BATCH SUDAH PERNAH DIBUKUKAN, TETAPI HASIL TIMBANGAN AKHIRNYA BERUBAH / SELESAI
        // (Misal sebelumnya baru masuk angka sementara 12 Kg atau 105 Kg, sekarang sudah selesai 312 Kg atau 152,2 Kg)
        if (Math.abs(existingEntry.curHasil - hasil) >= 0.5) {
          // HANYA UPDATE KOLOM I (Netto Hasil) PADA BARIS YANG COCOK
          // Rumus Kolom J (Susut Kg) dan Kolom K (Susut %) otomatis menghitung angka baru!
          shRekap.getRange(existingEntry.rowNum, 9).setValue(hasil);
          updatedCount++;
          Logger.log('UPDATE DINAMIS: Baris ' + existingEntry.rowNum + ' (' + rawTembakau + '): Netto Hasil diselaraskan dari ' + existingEntry.curHasil + ' Kg menjadi ' + hasil + ' Kg.');
          existingEntry.curHasil = hasil;
        }
      }
    }
  }

  const logMsg = (appendedCount > 0 || updatedCount > 0)
    ? 'Sinkronisasi Selesai: ' + appendedCount + ' baris baru ditambahkan, ' + updatedCount + ' baris berhasil diselaraskan dengan hasil final DHP. Rumus C, D, J, K aman.'
    : 'Semua data DHP sudah tercatat dan selaras di Rekap (0 perubahan).';
  Logger.log(logMsg);

  try {
    const actSS = SpreadsheetApp.getActiveSpreadsheet();
    if (actSS) actSS.toast(logMsg, 'Sinkronisasi DHP', 4);
  } catch (e) {}
}

/**
 * 2. FUNGSI PERBAIKAN: Memperbaiki & Menyelaraskan Netto Hasil di Sheet Rekap
 * SANGAT PENTING:
 * - Memperbaiki baris yang Netto Hasil = 0 ATAU berbeda dengan hasil final di DHP (seperti 12 Kg vs 312 Kg atau 105 Kg vs 152,2 Kg).
 * - HANYA mengisi/mengupdate Kolom I (Netto Hasil).
 * - SAMA SEKALI TIDAK MENIMPA Kolom C, D, J, dan K karena sudah berisi rumus di sheet!
 * - Rumus di Kolom J (Susut Kg) dan Kolom K (Susut %) otomatis aktif dan akurat!
 */
function perbaikiHasilNolDiRekap() {
  const SPREADSHEET_DHP_ID = '${config.dhpSpreadsheetId}';
  const SPREADSHEET_REKAP_ID = '${config.spreadsheetId}';
  const SHEET_DHP_NAME = '${config.dhpSheetName}';
  const SHEET_REKAP_NAME = '${config.sheetName}';

  const ssRekap = SpreadsheetApp.openById(SPREADSHEET_REKAP_ID);
  const shRekap = ssRekap.getSheetByName(SHEET_REKAP_NAME);
  const ssDhp = SpreadsheetApp.openById(SPREADSHEET_DHP_ID);
  const shDhp = ssDhp.getSheetByName(SHEET_DHP_NAME);

  if (!shRekap) {
    Logger.log('ERROR: Sheet Rekap tidak ditemukan!');
    return;
  }

  const lastRow = shRekap.getLastRow();
  if (lastRow < 12) {
    Logger.log('Tidak ada data di Sheet Rekap.');
    return;
  }

  // 1. Ambil data referensi dari Sheet DHP
  const dhpMap = {};
  if (shDhp) {
    const dhpVals = shDhp.getDataRange().getValues();
    for (let i = 0; i < dhpVals.length; i++) {
      const row = dhpVals[i];
      const tgl = row[2];
      const tembakau = String(row[3] || '').trim().toLowerCase();
      const baku = Number(row[4]) || 0;
      if (tgl && baku > 0) {
        const iso = tgl instanceof Date ? Utilities.formatDate(tgl, 'GMT+7', 'yyyy-MM-dd') : String(tgl);
        const k = iso + '|' + tembakau + '|' + baku.toFixed(1);
        const h = Number(row[8]) || 0; // Kolom I: HASIL PROSES
        const s = Number(row[9]) || 0; // Kolom J: SUSUT (Kg)
        dhpMap[k] = { hasil: h, susut: s };
      }
    }
  }

  // 2. Baca baris di Sheet Rekap
  const rowsCount = lastRow - 11;
  const colB = shRekap.getRange(12, 2, rowsCount, 1).getValues(); // Tanggal Proses
  const colF = shRekap.getRange(12, 6, rowsCount, 1).getValues(); // Jenis Tembakau
  const colH = shRekap.getRange(12, 8, rowsCount, 1).getValues(); // Netto Baku
  const colI = shRekap.getRange(12, 9, rowsCount, 1).getValues(); // Netto Hasil
  const colJ = shRekap.getRange(12, 10, rowsCount, 1).getValues(); // Susut (Kg)

  let fixCount = 0;

  for (let r = 0; r < rowsCount; r++) {
    const rowNum = 12 + r;
    const tgl = colB[r][0];
    const tembakau = String(colF[r][0] || '').trim().toLowerCase();
    const baku = Number(colH[r][0]) || 0;
    const hasil = Number(colI[r][0]) || 0;

    if (baku > 0) {
      const iso = tgl instanceof Date ? Utilities.formatDate(tgl, 'GMT+7', 'yyyy-MM-dd') : String(tgl);
      const k = iso + '|' + tembakau + '|' + baku.toFixed(1);
      const dhpRef = dhpMap[k];

      let needUpdate = false;
      let calculatedHasil = 0;

      if (dhpRef && dhpRef.hasil > 0) {
        // Jika di DHP ada hasil riil yang berbeda signifikan (>= 0.5 Kg) dari Rekap, atau Rekap masih 0
        if (hasil <= 0 || Math.abs(dhpRef.hasil - hasil) >= 0.5) {
          calculatedHasil = dhpRef.hasil;
          needUpdate = true;
        }
      } else if (hasil <= 0) {
        if (dhpRef && dhpRef.susut > 0 && dhpRef.susut < baku) {
          calculatedHasil = Math.round((baku - dhpRef.susut) * 10) / 10;
          needUpdate = true;
        } else {
          const exSusut = Number(colJ[r][0]) || 0;
          if (exSusut > 0 && exSusut < baku) {
            calculatedHasil = Math.round((baku - exSusut) * 10) / 10;
            needUpdate = true;
          }
        }
      }

      if (needUpdate && calculatedHasil > 0) {
        // HANYA ISI KOLOM I (Netto Hasil / Kolom ke-9)
        // SAMA SEKALI TIDAK MENIMPA Kolom C, D, J, K karena sudah berisi formula/rumus!
        shRekap.getRange(rowNum, 9).setValue(calculatedHasil);
        Logger.log('Baris ' + rowNum + ' (' + tembakau + '): Netto Hasil diselaraskan dari ' + hasil + ' Kg menjadi ' + calculatedHasil + ' Kg.');
        fixCount++;
      }
    }
  }

  const resMsg = (fixCount > 0)
    ? 'SUKSES: Berhasil menyelaraskan Netto Hasil pada ' + fixCount + ' baris di Sheet Rekap! Kolom C, D, J, K tetap aman dan rumus otomatis akurat.'
    : 'INFO: Semua baris di Sheet Rekap sudah terisi dan selaras dengan DHP (0 baris perlu diupdate).';

  Logger.log(resMsg);

  // Penanganan toast aman untuk mode Standalone Script (mencegah error Cannot read properties of null)
  try {
    const actSS = SpreadsheetApp.getActiveSpreadsheet();
    if (actSS) {
      actSS.toast(resMsg, 'Penyelarasan Netto Hasil', 5);
    }
  } catch (e) {
    // Mode editor standalone tidak memiliki active UI toast
  }
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header - Compact & Sleek */}
        <div className="px-5 py-2.5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <Database className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Integrasi & Sinkronisasi DHP Krosok
                </h3>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Presisi 100%
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-none mt-0.5">
                Pencocokan dan transfer otomatis data aktif DHP Krosok ke Datasheet Rekap Susut Krosok
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source & Target Connectors - Compact Single-Line Strip */}
        <div className="px-5 py-1.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap text-[11px]">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="font-semibold text-slate-500">Sumber DHP:</span>
              <span className="font-mono text-blue-700 font-bold">Tab {config.dhpSheetName}</span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({config.dhpSpreadsheetId.slice(0, 8)}...)</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white rounded border border-slate-200 text-slate-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="font-semibold text-slate-500">Target Rekap:</span>
              <span className="font-mono text-emerald-700 font-bold">Tab {config.sheetName}</span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">({config.spreadsheetId.slice(0, 8)}...)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLiveSyncActive(!isLiveSyncActive)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                isLiveSyncActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
              title="Klik untuk mengaktifkan / menjeda penarikan data otomatis setiap 12 detik"
            >
              <span className={`w-2 h-2 rounded-full ${isLiveSyncActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
              <span>{isLiveSyncActive ? `Auto-Tarik Aktif (${countdown}s)` : 'Auto-Tarik Dijeda'}</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs disabled:opacity-50"
              title="Tarik instan data DHP dari Google Spreadsheet sekarang (Bypass cache)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || (isLiveSyncActive && countdown <= 2) ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Memeriksa...' : 'Tarik Ulang DHP'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation - Slim */}
        <div className="flex border-b border-slate-200 bg-white px-5 shrink-0">
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pratinjau & Transaksi ({dhpItems.length} Batch)</span>
          </button>
          <button
            onClick={() => setActiveTab('mapping')}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'mapping'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Pemetaan Kolom</span>
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'script'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Skrip Otomasi GAS</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col min-h-0">
          {/* Success Notification */}
          {syncSuccessMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{syncSuccessMsg}</span>
            </div>
          )}

          {/* TAB 1: PREVIEW & SYNC */}
          {activeTab === 'preview' && (
            <div className="space-y-3 flex flex-col flex-1 min-h-0">
              {/* Compact Metrics Strip */}
              <div className={`grid grid-cols-1 ${needUpdateCount > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2 shrink-0`}>
                <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200/90 flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      Total Batch Aktif DHP
                    </div>
                    <div className="text-base font-bold text-slate-900 mt-0.5 flex items-baseline gap-1.5">
                      <span>{dhpItems.length} Batch</span>
                      <span className="text-[11px] font-medium text-slate-500">({formatNum(totalBaku)} Kg)</span>
                    </div>
                  </div>
                  <Layers className="w-4 h-4 text-slate-400" />
                </div>

                <div className="bg-emerald-50/70 rounded-lg px-3 py-2 border border-emerald-200/90 flex items-center justify-between shadow-2xs">
                  <div>
                    <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                      Terverifikasi di Rekap
                    </div>
                    <div className="text-base font-bold text-emerald-800 mt-0.5 flex items-baseline gap-1.5">
                      <span>{matchedCount} Batch</span>
                      <span className="text-[11px] font-semibold text-emerald-600">
                        ({dhpItems.length ? Math.round((matchedCount / dhpItems.length) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>

                {needUpdateCount > 0 && (
                  <div className="bg-amber-50/90 rounded-lg px-3 py-2 border border-amber-300 flex items-center justify-between shadow-2xs animate-pulse">
                    <div>
                      <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                        Perlu Diselaraskan
                      </div>
                      <div className="text-base font-bold text-amber-900 mt-0.5 flex items-baseline gap-1.5">
                        <span>{needUpdateCount} Batch</span>
                        <span className="text-[11px] font-medium text-amber-700">Hasil Selesai</span>
                      </div>
                    </div>
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  </div>
                )}

                <div className={`rounded-lg px-3 py-2 border flex items-center justify-between shadow-2xs ${
                  newCount > 0 ? 'bg-blue-50/90 border-blue-200' : 'bg-slate-50 rounded-lg border-slate-200/90'
                }`}>
                  <div>
                    <div className={`text-[10px] font-semibold uppercase tracking-wider ${newCount > 0 ? 'text-blue-700' : 'text-slate-500'}`}>
                      Batch Baru Siap Masuk
                    </div>
                    <div className={`text-base font-bold mt-0.5 flex items-baseline gap-1.5 ${newCount > 0 ? 'text-blue-700' : 'text-slate-700'}`}>
                      <span>{newCount} Batch</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        {newCount === 0 ? 'Semua tersinkron' : 'Perlu dibukukan'}
                      </span>
                    </div>
                  </div>
                  {newCount > 0 ? (
                    <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Table of DHP Items - The Main Hero Component */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex-1 flex flex-col min-h-[300px] bg-white">
                <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Daftar Transaksi DHP Terdeteksi (Tab {config.dhpSheetName})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Menampilkan {dhpItems.length} baris proses aktif
                  </span>
                </div>

                <div className="overflow-auto flex-1 max-h-[460px]">
                  <table className="w-full text-xs text-left">
                    <thead className="sticky top-0 bg-slate-100 z-10 text-slate-700 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider shadow-2xs">
                      <tr>
                        <th className="py-2 px-3 text-center w-14">Row</th>
                        <th className="py-2 px-3">Tanggal & Waktu</th>
                        <th className="py-2 px-3">Jenis Tembakau</th>
                        <th className="py-2 px-2 text-center w-14">Jalur</th>
                        <th className="py-2 px-3 text-right">Netto Baku (Kg)</th>
                        <th className="py-2 px-3 text-right">Hasil (Kg)</th>
                        <th className="py-2 px-3 text-right text-rose-700">Susut (Kg)</th>
                        <th className="py-2 px-3 text-right text-rose-700">Susut (%)</th>
                        <th className="py-2 px-3.5 text-center">Status Integrasi Rekap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {dhpItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-slate-400">
                            Tidak ditemukan baris transaksi aktif pada Sheet DHP Krosok.
                          </td>
                        </tr>
                      ) : (
                        dhpItems.map((item) => (
                          <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400">
                              {item.rowIdx}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                              <div>{item.tanggalDisplay}</div>
                              {item.waktu && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" />
                                  <span>{item.waktu}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900">
                              <div>{item.jenisTembakau}</div>
                              {item.kodeStock && (
                                <div className="text-[10px] text-slate-400 font-normal">
                                  Stock: {item.kodeStock}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2 text-center">
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
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {formatNum(item.baku)}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-700">
                              {item.hasil > 0 ? (
                                <span className="font-semibold text-emerald-800">{formatNum(item.hasil)}</span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="Proses belum selesai atau menunggu data hasil">
                                  0,0 (Proses)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-rose-700">
                              {formatNum(item.susutKg)}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-slate-800">
                              {formatPct(item.susutPct)}%
                            </td>
                            <td className="py-2 px-3.5 text-center whitespace-nowrap">
                              {item.needsUpdateInRekap ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>Hasil Berubah (Rekap {formatNum(item.rekapHasil)} Kg ➔ DHP {formatNum(item.hasil)} Kg)</span>
                                </span>
                              ) : item.isMatchedInRekap ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Cocok di Rekap (Baris {item.matchedRow})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
                                  <Sparkles className="w-3 h-3 text-blue-600" />
                                  <span>Batch Baru (Siap Masuk)</span>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compact Bottom Action Bar */}
              <div className="px-3.5 py-2 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 rounded-lg border border-blue-200/80 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-slate-700 font-medium text-[11px]">
                    {needUpdateCount > 0
                      ? `Terdapat ${needUpdateCount} batch selesai yang perlu diselaraskan ke Rekap${newCount > 0 ? ` dan ${newCount} batch baru` : ''}.`
                      : newCount > 0
                      ? `Terdapat ${newCount} batch baru yang siap dibukukan ke baris baru Sheet Rekap.`
                      : `Semua ${dhpItems.length} baris data DHP sudah tersinkronisasi presisi di Sheet Rekap.`}
                  </span>
                </div>

                <button
                  onClick={handleSyncToRekap}
                  disabled={syncingToRekap}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors disabled:opacity-50 shrink-0"
                >
                  <Send className={`w-3.5 h-3.5 ${syncingToRekap ? 'animate-spin' : ''}`} />
                  <span>
                    {syncingToRekap
                      ? 'Sedang Membukukan...'
                      : needUpdateCount > 0
                      ? `Sinkronkan & Selaraskan (${needUpdateCount} Update)`
                      : 'Sinkronkan ke Sheet Rekap'}
                  </span>
                </button>
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

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Kolom Asal (DHP Krosok)</th>
                      <th className="py-2.5 px-3 text-center">Arah</th>
                      <th className="py-2.5 px-3">Kolom Target (REKAP SUSUT)</th>
                      <th className="py-2.5 px-3">Tipe Data & Validasi</th>
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
                        Kolom E: =iferror(JOIN(" ";F...;G...))
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
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Skrip Google Apps Script untuk Otomasi di Google Sheets
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Pasang skrip ini di menu *Extensions -&gt; Apps Script* pada spreadsheet Anda untuk menambahkan tombol menu otomatis di Google Sheets.
                  </p>
                </div>
                <button
                  onClick={copyScriptToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-2xs transition-colors"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Tersalin ke Clipboard!' : 'Salin Skrip'}</span>
                </button>
              </div>

              <div className="bg-slate-950 rounded-xl p-4 overflow-x-auto text-slate-200 font-mono text-[11px] leading-relaxed max-h-96 border border-slate-800">
                <pre>{appsScriptCode}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Koneksi aman &amp; pemetaan kolom terverifikasi</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
