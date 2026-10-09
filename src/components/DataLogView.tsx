import React, { useState, useMemo } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { KrosokRecord } from '../types';
import { formatNum, formatPct, getPctClass } from '../services/dataService';

interface DataLogViewProps {
  records: KrosokRecord[];
}

export const DataLogView: React.FC<DataLogViewProps> = ({ records }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProses, setFilterProses] = useState('Semua');
  const [filterTahun, setFilterTahun] = useState('Semua');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const availableYears = useMemo(() => {
    return Array.from(new Set(records.map((r) => r.tahun))).filter(Boolean).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.jenisKrosok.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.tanggal.includes(searchTerm) ||
        r.tanggalDisplay.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.jenisPerlakuan && r.jenisPerlakuan.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchProses = filterProses === 'Semua' || r.jenisProses === filterProses;
      const matchTahun = filterTahun === 'Semua' || r.tahun === filterTahun;
      return matchSearch && matchProses && matchTahun;
    });
  }, [records, searchTerm, filterProses, filterTahun]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPageRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);

  // Export CSV handler
  const handleExportCsv = () => {
    const headers = [
      'Baris_Sheet',
      'Tanggal_Proses',
      'Bulan',
      'Tahun',
      'Jenis_Krosok',
      'Jalur_Proses',
      'Netto_Baku_Kg',
      'Netto_Hasil_Kg',
      'Susut_Kg',
      'Susut_Pct',
      'Gagang_Kg',
      'Gagang_Pct',
      'Debu_Air_Kg',
      'Debu_Air_Pct'
    ];

    const rows = filteredRecords.map((r) => [
      r.srcRow,
      r.tanggal,
      `"${r.bulan}"`,
      r.tahun,
      `"${r.jenisKrosok}"`,
      r.jenisProses,
      r.baku,
      r.hasil,
      r.susutKg,
      r.susutPct,
      r.gagangKg,
      r.gagangPct,
      r.debuAirKg,
      r.debuAirPct
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_proses_krosok_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari varian, tanggal..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="text-xs pl-8.5 pr-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none w-52 sm:w-64"
            />
          </div>

          {/* Jalur Filter */}
          <select
            value={filterProses}
            onChange={(e) => {
              setFilterProses(e.target.value);
              setPage(1);
            }}
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
          >
            <option value="Semua">Semua Jalur (SKT + SKM)</option>
            <option value="SKT">SKT</option>
            <option value="SKM">SKM</option>
          </select>

          {/* Tahun Filter */}
          <select
            value={filterTahun}
            onChange={(e) => {
              setFilterTahun(e.target.value);
              setPage(1);
            }}
            className="text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
          >
            <option value="Semua">Semua Tahun</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-500 font-medium">
            Menampilkan {filteredRecords.length.toLocaleString('id-ID')} dari {records.length.toLocaleString('id-ID')} entri
          </span>
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[10.5px] tracking-wider">
                <th className="py-3 px-3 text-center">Row</th>
                <th className="py-3 px-3 text-left">Tanggal Proses</th>
                <th className="py-3 px-3 text-left">Bulan / Thn</th>
                <th className="py-3 px-4 text-left">Jenis Krosok</th>
                <th className="py-3 px-2.5 text-center">Jalur</th>
                <th className="py-3 px-3 text-right">Baku (Kg)</th>
                <th className="py-3 px-3 text-right">Hasil (Kg)</th>
                <th className="py-3 px-3 text-right">Susut (Kg)</th>
                <th className="py-3 px-3 text-right">Susut (%)</th>
                <th className="py-3 px-3 text-right">Gagang (%)</th>
                <th className="py-3 px-4 text-right">Debu/Air (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {currentPageRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    Tidak ditemukan data yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                currentPageRecords.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {r.srcRow}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                      {r.tanggalDisplay}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {r.bulan} {r.tahun}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      <div>{r.jenisKrosok}</div>
                      {r.jenisPerlakuan && r.jenisPerlakuan !== r.jenisKrosok && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {r.jenisPerlakuan}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          r.jenisProses === 'SKT'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {r.jenisProses}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                      {formatNum(r.baku)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-800">
                      {formatNum(r.hasil)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600">
                      {formatNum(r.susutKg)}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${getPctClass(r.susutPct)}`}>
                      {formatPct(r.susutPct)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500">
                      {formatPct(r.gagangPct)}%
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">
                      {formatPct(r.debuAirPct)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 sm:p-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              Halaman {page} dari {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
