import React, { useState } from 'react';
import { X, PlusCircle, Scale, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { KrosokRecord, FilterOptions } from '../types';
import { formatNum, formatPct, round2, MONTH_ORDER } from '../services/dataService';

interface NewEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (record: KrosokRecord) => void;
  filterOptions: FilterOptions;
  gasUrl: string;
}

export const NewEntryModal: React.FC<NewEntryModalProps> = ({
  isOpen,
  onClose,
  onAddRecord,
  filterOptions,
  gasUrl
}) => {
  const today = new Date().toISOString().split('T')[0];

  const [tanggal, setTanggal] = useState(today);
  const [jenisKrosok, setJenisKrosok] = useState(filterOptions.jenisKrosok[0] || 'Zambia M1L (2023)');
  const [customJenis, setCustomJenis] = useState('');
  const [jenisProses, setJenisProses] = useState<'SKT' | 'SKM'>('SKT');
  const [baku, setBaku] = useState<number | ''>(800);
  const [hasil, setHasil] = useState<number | ''>(798.5);
  const [gagangKg, setGagangKg] = useState<number | ''>(0);
  const [airKg, setAirKg] = useState<number | ''>(0);
  const [debuKg, setDebuKg] = useState<number | ''>(0);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  if (!isOpen) return null;

  const numBaku = typeof baku === 'number' ? baku : 0;
  const numHasil = typeof hasil === 'number' ? hasil : 0;
  const numGagang = typeof gagangKg === 'number' ? gagangKg : 0;
  const numAir = typeof airKg === 'number' ? airKg : 0;
  const numDebu = typeof debuKg === 'number' ? debuKg : 0;

  const susutKg = round2(numBaku - numHasil);
  const susutPct = round2(numBaku ? (susutKg / numBaku) * 100 : 0);
  const gagangPct = round2(numBaku ? (numGagang / numBaku) * 100 : 0);
  const debuAirKg = round2(numAir + numDebu);
  const debuAirPct = round2(numBaku ? (debuAirKg / numBaku) * 100 : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numBaku || numBaku <= 0) return;

    setSubmitting(true);

    const d = new Date(tanggal);
    const bln = MONTH_ORDER[d.getMonth()] || 'Oktober';
    const thn = String(d.getFullYear());
    const display = `${d.getDate()} ${bln} ${thn}`;
    const selectedKrosokName = jenisKrosok === '__custom__' ? customJenis.trim() : jenisKrosok;

    const newRec: KrosokRecord = {
      srcRow: Date.now(),
      tanggal,
      tanggalDisplay: display,
      bulan: bln,
      tahun: thn,
      jenisPerlakuan: `${selectedKrosokName} ${jenisProses}`,
      jenisKrosok: selectedKrosokName || 'Lainnya',
      jenisProses,
      baku: numBaku,
      hasil: numHasil,
      susutKg,
      susutPct,
      gagangKg: numGagang,
      gagangPct,
      airKg: numAir,
      debuKg: numDebu,
      debuAirKg,
      debuAirPct
    };

    // Try posting to GAS if URL configured
    if (gasUrl && gasUrl.startsWith('http')) {
      try {
        await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRec)
        });
      } catch (err) {
        console.warn('Silent fallback: saved to local buffer', err);
      }
    }

    onAddRecord(newRec);
    setSubmitting(false);
    setSuccessMsg(true);

    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <PlusCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Entri Data Proses Krosok Baru</h3>
              <p className="text-xs text-slate-500">
                Pencatatan real-time penimbangan & susut proses krosok
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">Data proses krosok berhasil disimpan!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tanggal Proses</label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jalur Proses</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setJenisProses('SKT')}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    jenisProses === 'SKT'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  SKT (Tangan)
                </button>
                <button
                  type="button"
                  onClick={() => setJenisProses('SKM')}
                  className={`flex-1 py-2 rounded-xl font-bold border transition-all ${
                    jenisProses === 'SKM'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  SKM (Mesin)
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jenis Krosok</label>
            <select
              value={jenisKrosok}
              onChange={(e) => setJenisKrosok(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {filterOptions.jenisKrosok.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
              <option value="__custom__">+ Input Varian Baru...</option>
            </select>
          </div>

          {jenisKrosok === '__custom__' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Varian Krosok Baru</label>
              <input
                type="text"
                required
                value={customJenis}
                onChange={(e) => setCustomJenis(e.target.value)}
                placeholder="mis. Zambia M1L (2024)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {/* Bobot Netto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Netto Baku (Kg)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                value={baku}
                onChange={(e) => setBaku(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-blue-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Netto Hasil (Kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={hasil}
                onChange={(e) => setHasil(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-emerald-900"
              />
            </div>
          </div>

          {/* Fraksi Kesusutan Fisik */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Gagang (Kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={gagangKg}
                onChange={(e) => setGagangKg(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Air (Kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={airKg}
                onChange={(e) => setAirKg(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Debu (Kg)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={debuKg}
                onChange={(e) => setDebuKg(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* Live Calculated Preview Banner */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2">
            <div className="font-bold text-slate-800 mb-1">Hasil Perhitungan Otomatis:</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500">Susut Fisik</div>
                <div className="font-bold text-slate-900">{formatNum(susutKg)} Kg</div>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                <div className="text-[10px] text-blue-700">Susut Rasio</div>
                <div className="font-bold text-blue-900">{formatPct(susutPct)}%</div>
              </div>
              <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                <div className="text-[10px] text-emerald-700">Debu + Air</div>
                <div className="font-bold text-emerald-900">{formatPct(debuAirPct)}%</div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !numBaku}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
