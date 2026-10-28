import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Code2,
  ArrowRight
} from 'lucide-react';
import {
  BLUEPRINT_CHAPTERS,
  BLUEPRINT_DOCUMENT_META,
  BLUEPRINT_VERIFICATION_CHECKLIST,
  buildMasterBlueprintMarkdown,
  downloadArchitectureBlueprintPdf
} from '../utils/blueprintPdfGenerator';

interface DeveloperBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperBlueprintModal: React.FC<DeveloperBlueprintModalProps> = ({
  isOpen,
  onClose
}) => {
  const [selectedTab, setSelectedTab] = useState<string>(BLUEPRINT_CHAPTERS[0].id);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [copiedSnippetKey, setCopiedSnippetKey] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfSuccessNotice, setPdfSuccessNotice] = useState(false);

  if (!isOpen) return null;

  const activeChapter = BLUEPRINT_CHAPTERS.find((c) => c.id === selectedTab);

  const handleDownloadPdf = () => {
    setDownloadingPdf(true);
    try {
      downloadArchitectureBlueprintPdf();
      setPdfSuccessNotice(true);
      setTimeout(() => setPdfSuccessNotice(false), 4500);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyMasterMarkdown = () => {
    const md = buildMasterBlueprintMarkdown();
    navigator.clipboard.writeText(md);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 2500);
  };

  const handleCopySnippet = (key: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetKey(key);
    setTimeout(() => setCopiedSnippetKey(null), 2000);
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[92vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0b1329] text-white border-b border-slate-800 flex items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                {BLUEPRINT_DOCUMENT_META.title}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Menu Khusus Developer / Engineer</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300 font-medium">
                  {BLUEPRINT_DOCUMENT_META.version}
                </span>
                <span aria-hidden="true">·</span>
                <span>Siap dijadikan referensi ke thread Web App lain</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panduan arsitektur"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Action Strip: Architecture Flow + Direct PDF Download & Master Prompt Copy */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-700 flex-wrap">
            <span className="font-semibold text-slate-900">Alur Referensi:</span>
            <span className="font-mono text-[11px] text-slate-700">1. Sheet DHP Harian</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono text-[11px] text-blue-700 font-semibold">
              2. Web App Integrasi DHP
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-mono text-[11px] text-emerald-700 font-semibold">
              3. Buku Besar Sheet Rekap
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyMasterMarkdown}
              className="min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Salin seluruh panduan + kode dalam format Markdown untuk ditempelkan ke thread lain"
            >
              {copiedMaster ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700">Tersalin untuk Thread Lain</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>Salin Master Teks / Prompt</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="min-h-[38px] px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>
                {downloadingPdf ? 'Menyusun PDF...' : 'Unduh Panduan Lengkap (.PDF)'}
              </span>
            </button>
          </div>
        </div>

        {pdfSuccessNotice && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              File <strong>{BLUEPRINT_DOCUMENT_META.fileName}</strong> berhasil diunduh. Anda
              dapat langsung melampirkan file PDF ini ke thread pengerjaan Web App lainnya.
            </span>
          </div>
        )}

        {/* Body: Left Chapter Index + Right Detailed Content */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Chapter Sidebar */}
          <nav
            aria-label="Daftar Bab Panduan Arsitektur"
            className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/70 p-2.5 sm:p-3 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-1 shrink-0"
          >
            {BLUEPRINT_CHAPTERS.map((ch) => {
              const active = selectedTab === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedTab(ch.id)}
                  className={`min-h-[40px] md:w-full text-left px-3 py-2 rounded-lg text-xs transition-colors shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200/70 font-medium'
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-mono text-[11px] ${
                        active ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      {ch.number}.
                    </span>
                    <span className="leading-snug line-clamp-2">{ch.title}</span>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setSelectedTab('checklist')}
              className={`min-h-[40px] md:w-full text-left px-3 py-2 rounded-lg text-xs transition-colors shrink-0 cursor-pointer ${
                selectedTab === 'checklist'
                  ? 'bg-emerald-800 text-white font-semibold shadow-xs'
                  : 'text-emerald-800 hover:bg-emerald-50 font-medium'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={`font-mono text-[11px] ${
                    selectedTab === 'checklist' ? 'text-emerald-200' : 'text-emerald-600'
                  }`}
                >
                  07.
                </span>
                <span className="leading-snug">Checklist Audit 12 Pengaman Wajib</span>
              </div>
            </button>
          </nav>

          {/* Main Reader Pane */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-white">
            {activeChapter ? (
              <>
                <div className="border-b border-slate-200 pb-4">
                  <div className="text-xs font-mono text-blue-700 font-semibold">
                    Bab {activeChapter.number} dari 07
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                    {activeChapter.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    {activeChapter.summary}
                  </p>
                </div>

                <div className="space-y-4">
                  {activeChapter.points.map((pt, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2.5"
                    >
                      <h4 className="text-sm font-bold text-slate-900">{pt.subtitle}</h4>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs leading-relaxed">
                        <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200/80 text-rose-950">
                          <div className="font-bold text-rose-800 flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Risiko / Celah Umum di Web App Lain</span>
                          </div>
                          <p>{pt.problem}</p>
                        </div>

                        <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-emerald-950">
                          <div className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Arsitektur Pengaman yang Diterapkan</span>
                          </div>
                          <p>{pt.solution}</p>
                        </div>
                      </div>

                      {pt.tips && pt.tips.length > 0 && (
                        <ul className="pt-1 space-y-1 text-xs text-slate-700 list-disc pl-5 leading-relaxed">
                          {pt.tips.map((tip, tIdx) => (
                            <li key={tIdx}>{tip}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                {activeChapter.snippets && activeChapter.snippets.length > 0 && (
                  <div className="space-y-3 pt-1">
                    {activeChapter.snippets.map((snip, sIdx) => {
                      const snipKey = `${activeChapter.id}_${sIdx}`;
                      const isCopied = copiedSnippetKey === snipKey;
                      return (
                        <div
                          key={snipKey}
                          className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100"
                        >
                          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 min-w-0">
                              <Code2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">{snip.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopySnippet(snipKey, snip.code)}
                              className="min-h-[30px] px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-300">Disalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Salin Kode</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-4 text-[11.5px] font-mono leading-relaxed overflow-x-auto text-slate-200">
                            <code>{snip.code}</code>
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* Checklist View */
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-4">
                  <div className="text-xs font-mono text-emerald-700 font-semibold">
                    Bab 07 dari 07 · Standar Kelayakan Produksi
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                    Checklist Audit 12 Pengaman Wajib Sebelum Deploy
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                    Pastikan ke-12 poin di bawah ini seluruhnya terpenuhi pada setiap Web App
                    baru maupun eksisting yang menghubungkan Sheet DHP ke Sheet Rekap.
                  </p>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {BLUEPRINT_VERIFICATION_CHECKLIST.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white hover:bg-slate-50/80 flex items-start gap-3 text-xs sm:text-sm text-slate-800 leading-relaxed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono text-xs font-semibold text-slate-400 mr-1.5">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <span>{item}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
          <span>
            Seluruh 7 bab &amp; cuplikan kode disertakan lengkap di dalam file PDF hasil unduhan.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-colors cursor-pointer shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
