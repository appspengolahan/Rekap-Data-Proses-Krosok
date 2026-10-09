import React, { useState } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Send,
  Zap,
  RefreshCw,
  Code2,
  FileSpreadsheet
} from 'lucide-react';
import { GASConfig } from '../types';

interface GasCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GASConfig;
  onSaveConfig: (cfg: GASConfig) => void;
  onTriggerSync: () => void;
}

export const GasCenterModal: React.FC<GasCenterModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onTriggerSync
}) => {
  const [formData, setFormData] = useState<GASConfig>({ ...config });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
    raw?: any;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'test' | 'code'>('config');

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig(formData);
    onClose();
  };

  const handleTestPing = async () => {
    setTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      // First test Google Sheet Visualization API connection
      const encSheet = encodeURIComponent(formData.sheetName);
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${formData.spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encSheet}`;
      
      const res = await fetch(sheetUrl);
      const latency = Math.round(performance.now() - start);

      if (res.ok) {
        const text = await res.text();
        if (text.includes('google.visualization.Query.setResponse')) {
          setTestResult({
            success: true,
            latencyMs: latency,
            message: `Koneksi Google Sheet BERHASIL! Ditemukan sheet "${formData.sheetName}" via Gviz API (Latensi: ${latency}ms).`,
            raw: { status: res.status, headers: 'OK' }
          });
        } else {
          setTestResult({
            success: false,
            latencyMs: latency,
            message: 'Sheet merespon tapi konten tidak sesuai format Google Sheets.'
          });
        }
      } else {
        setTestResult({
          success: false,
          latencyMs: latency,
          message: `Gagal mengakses Spreadsheet (HTTP ${res.status}). Pastikan hak akses sheet terbuka "Siapa saja yang memiliki link".`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Koneksi gagal: ${err.message || 'Network Error'}. Periksa URL atau koneksi internet.`
      });
    } finally {
      setTesting(false);
    }
  };

  // Google Apps Script REST snippet for user copy-paste
  const gasHeadlessScriptSnippet = `/**
 * HEADLESS REST API GOOGLE APPS SCRIPT
 * Untuk Web App Monitoring Rekap Proses Krosok
 * Deploy sebagai: Web App -> Execute as: Me -> Who has access: Anyone
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'readAll';
  var ss = SpreadsheetApp.openById('${formData.spreadsheetId}');
  var sheet = ss.getSheetByName('${formData.sheetName}');
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Sheet ${formData.sheetName} tidak ditemukan'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Baris data mulai baris 12 (Header di baris 10)
  var lastRow = sheet.getLastRow();
  if (lastRow < 12) {
    return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
  }

  var values = sheet.getRange(12, 1, lastRow - 11, 14).getValues();
  var records = [];

  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    var tgl = r[1]; // B: TANGGAL PROSES
    var baku = r[7]; // H: BAKU
    var hasil = r[8]; // I: HASIL

    if (tgl && typeof baku === 'number' && typeof hasil === 'number' && baku > 0) {
      var isoDate = (tgl instanceof Date) ? Utilities.formatDate(tgl, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(tgl);
      var susutKg = typeof r[9] === 'number' ? r[9] : (baku - hasil);
      var susutPct = typeof r[10] === 'number' ? r[10] : (susutKg / baku * 100);
      var gagangKg = typeof r[11] === 'number' ? r[11] : 0;
      var airKg = typeof r[12] === 'number' ? r[12] : 0;
      var debuKg = typeof r[13] === 'number' ? r[13] : 0;

      records.push({
        srcRow: 12 + i,
        tanggal: isoDate,
        bulan: String(r[2]),
        tahun: String(r[3]),
        jenisKrosok: String(r[5]),
        jenisProses: String(r[6] || 'SKT'),
        baku: baku,
        hasil: hasil,
        susutKg: susutKg,
        susutPct: susutPct,
        gagangKg: gagangKg,
        debuAirKg: airKg + debuKg
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    total: records.length,
    records: records
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById('${formData.spreadsheetId}');
    var sheet = ss.getSheetByName('${formData.sheetName}');
    
    // Append row
    sheet.appendRow([
      '', // A
      new Date(data.tanggal), // B
      data.bulan, // C
      data.tahun, // D
      data.jenisKrosok + ' ' + data.jenisProses, // E
      data.jenisKrosok, // F
      data.jenisProses, // G
      data.baku, // H
      data.hasil, // I
      data.baku - data.hasil, // J
      ((data.baku - data.hasil) / data.baku) * 100, // K
      data.gagangKg || 0, // L
      data.airKg || 0, // M
      data.debuKg || 0  // N
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gasHeadlessScriptSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Database className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Headless GAS REST API Center</h3>
              <p className="text-xs text-slate-500">
                Pusat Integrasi Backend Google Apps Script & Google Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-5 gap-4 bg-slate-50/30 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Konfigurasi Endpoint
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'test'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Uji Latensi & Ping
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`py-2.5 border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Script Headless JSON (GAS)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'config' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  ID Google Spreadsheet Sumber
                </label>
                <input
                  type="text"
                  value={formData.spreadsheetId}
                  onChange={(e) => setFormData({ ...formData, spreadsheetId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="ID Spreadsheet..."
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Sheet ID sumber data: 1A9GgHirYSNN26fG4emsFNOM4pod8xjn4gleWzCaTVzM
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Tab Sheet
                </label>
                <input
                  type="text"
                  value={formData.sheetName}
                  onChange={(e) => setFormData({ ...formData, sheetName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="REKAP SUSUT KROSOK"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Harus persis sama: <b>REKAP SUSUT KROSOK</b>
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  URL Web App Google Apps Script (GAS)
                </label>
                <input
                  type="text"
                  value={formData.gasUrl}
                  onChange={(e) => setFormData({ ...formData, gasUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="https://script.google.com/macros/s/.../exec"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Endpoint doGet/doPost untuk sinkronisasi REST API langsung.
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">AutoSync Otomatis</div>
                    <div className="text-[11px] text-slate-500">
                      Sinkronisasi latar belakang periodik tanpa membebani browser
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.autoSyncEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, autoSyncEnabled: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>

                {formData.autoSyncEnabled && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-600">Interval Sinkronisasi:</span>
                    <select
                      value={formData.autoSyncIntervalSeconds}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          autoSyncIntervalSeconds: Number(e.target.value)
                        })
                      }
                      className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      <option value={30}>30 Detik</option>
                      <option value={60}>60 Detik (Disarankan)</option>
                      <option value={120}>2 Menit</option>
                      <option value={300}>5 Menit</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900">Uji Koneksi & Latensi Real-Time</h4>
                    <p className="text-[11px] text-slate-500">
                      Mengirim permintaan ping ke Google Spreadsheet & backend
                    </p>
                  </div>
                  <button
                    onClick={handleTestPing}
                    disabled={testing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'Menguji...' : 'Mulai Ping Test'}</span>
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <span>
                        {testResult.success ? 'Koneksi Berhasil' : 'Koneksi Bermasalah'}
                      </span>
                      {testResult.latencyMs !== undefined && (
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-white/80 font-mono">
                          {testResult.latencyMs} ms
                        </span>
                      )}
                    </div>
                    <p className="text-[11px]">{testResult.message}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Template Script Headless GAS</h4>
                  <p className="text-[11px] text-slate-500">
                    Salin dan tempel ke Apps Script editor spreadsheet jika ingin API mandiri
                  </p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Tersalin!' : 'Salin Script'}</span>
                </button>
              </div>

              <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto text-[11px] font-mono max-h-64 border border-slate-800">
                {gasHeadlessScriptSnippet}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
};
