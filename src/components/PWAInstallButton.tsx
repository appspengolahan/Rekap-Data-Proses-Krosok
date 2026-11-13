import React, { useState } from 'react';
import { Download, RefreshCw, Share, X, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall, usePWAUpdate } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { canInstall, isIOS, isInstalled, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canInstall) {
            void promptInstall();
          } else if (isIOS) {
            setShowIOSGuide(true);
          }
        }}
        className="flex items-center gap-1.5 min-h-[44px] lg:min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-400/35 text-emerald-200 hover:text-white text-xs font-semibold transition-colors shrink-0"
        title="Pasang Aplikasi ke Layar Utama (PWA)"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/75 sm:backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl border border-slate-200 max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 id="ios-install-title" className="text-base font-bold text-slate-900">
                Pasang di iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Tutup panduan instalasi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-slate-700 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-blue-600 shrink-0">1.</span>
                <span>
                  Ketuk ikon <strong className="inline-flex items-center gap-1">Share <Share className="w-4 h-4 text-blue-600 inline" /></strong> di bilah Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-blue-600 shrink-0">2.</span>
                <span>
                  Gulir ke bawah lalu pilih <strong>Add to Home Screen</strong> (Tambahkan ke Layar Utama).
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-blue-600 shrink-0">3.</span>
                <span>
                  Ketuk <strong>Add</strong> di pojok kanan atas untuk menjalankan aplikasi penuh tanpa address bar.
                </span>
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const PWAUpdateToast: React.FC = () => {
  const { needRefresh, applyUpdate, dismissUpdate } = usePWAUpdate();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5 right-4 z-50 max-w-[calc(100vw-2rem)] sm:max-w-sm bg-slate-900 text-white border border-slate-700 rounded-2xl shadow-xl p-3.5 flex items-center gap-3"
    >
      <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white">Pembaruan aplikasi tersedia</p>
        <p className="text-[11px] text-slate-300">Muat ulang untuk memakai versi terbaru.</p>
      </div>
      <button
        type="button"
        onClick={() => void applyUpdate()}
        className="min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
      >
        Perbarui
      </button>
      <button
        type="button"
        onClick={dismissUpdate}
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white"
        aria-label="Tutup notifikasi pembaruan"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5 left-4 z-50 max-w-[calc(100vw-2rem)] bg-amber-600 text-white px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Mode Offline — Menampilkan data tersimpan</span>
    </div>
  );
};
