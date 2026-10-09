import React from 'react';
import { X, HelpCircle, Check, Info } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <HelpCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                📦 Monitoring Board — Rekap Data Proses Krosok
              </h3>
              <p className="text-xs text-slate-500">
                Versi build engine: <span className="font-semibold text-blue-700">v1.2 (Pro API Edition 2026)</span>
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

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
          <div>
            <h4 className="font-bold text-slate-900 text-xs mb-1.5 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Cara Penggunaan Aplikasi</span>
            </h4>
            <ol className="list-decimal pl-4.5 space-y-1.5 text-slate-600">
              <li>
                Pilih <strong>Tahun</strong> dan <strong>Jenis Jalur Proses (SKT/SKM)</strong> di filter atas — kedua filter ini berlaku untuk seluruh card & tabel di halaman.
              </li>
              <li>
                Gunakan dropdown <strong>Bulan</strong> di card Rekap Bulanan untuk melihat data satu bulan tertentu.
              </li>
              <li>
                Di card <strong>Rekap Rentang Periode</strong>, atur "Dari Bulan/Tahun – Sampai Bulan/Tahun" lalu klik <strong>Terapkan</strong> untuk melihat rekap kuartalan atau rentang bebas — rentang ini otomatis juga mengatur tabel di tab Rekap per Jenis Krosok.
              </li>
              <li>
                Klik tab <strong>Rekap per Bulan</strong> untuk tren & tabel bulanan, atau tab <strong>Rekap per Jenis Krosok</strong> untuk rincian per varian beserta grafik tren (pilih varian dari dropdown).
              </li>
              <li>
                Klik <strong>📄 Export Ringkasan (PDF)</strong> di atas untuk mencetak ringkasan, atau <strong>📄 Export Tab Ini (PDF)</strong> di dalam tab untuk mencetak isi tab aktif.
              </li>
              <li>
                Klik <strong>🔄 Refresh Data</strong> kapan saja atau biarkan <strong>AutoSync</strong> terus berjalan di latar belakang untuk menarik pembaruan sheet.
              </li>
              <li>
                Gunakan tombol <strong>🔀 Switch App</strong> di pojok kanan atas untuk berpindah ke Monitoring Board komoditas lain (Blend, Cengkeh, Tembakau, Gudang PP1).
              </li>
            </ol>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-1">Rumus Metrik Kesusutan (Krosok)</h4>
            <ul className="space-y-1 text-slate-600">
              <li>• <strong>Susut Fisik (Kg)</strong> = Netto Baku (Kg) - Netto Hasil (Kg)</li>
              <li>• <strong>Susut (%)</strong> = (Susut Kg / Netto Baku) × 100%</li>
              <li>• <strong>Gagang (%)</strong> = (Gagang Kg / Netto Baku) × 100%</li>
              <li>• <strong>Air + Debu (%)</strong> = ((Air Kg + Debu Kg) / Netto Baku) × 100%</li>
              <li>• <strong>Kapasitas (%)</strong> = (Volume Baku Varian / Total Baku Periode) × 100%</li>
              <li>• <strong>Indikator Warna</strong>: <span className="text-emerald-600 font-bold">≤ 4.0% (Hijau/Efisien)</span> · <span className="text-rose-600 font-bold">≥ 10.0% (Merah/Perlu Evaluasi)</span></li>
            </ul>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 text-center">
            Monitoring Board — Rekap Data Proses Krosok All Rights Reserved<br />
            Divisi Produksi I · Developed by Lalu Mahendra
          </div>
        </div>
      </div>
    </div>
  );
};
