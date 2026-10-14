import React, { useState } from 'react';
import {
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Search,
  Layers,
  ArrowUpRight,
  Globe,
  Radio,
  Sparkles,
  AlertCircle,
  X
} from 'lucide-react';
import { SwitchAppModule } from '../types';
import { DEFAULT_SWITCH_APPS } from '../data/switchAppDefault';

interface TabSwitchAppProps {
  switchApps: SwitchAppModule[];
  onUpdateApps: (apps: SwitchAppModule[]) => void;
}

export const TabSwitchApp: React.FC<TabSwitchAppProps> = ({
  switchApps,
  onUpdateApps
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<SwitchAppModule | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    category: 'Monitoring Board Proses PP1',
    customCategory: '',
    description: '',
    color: 'blue',
    isActive: false
  });
  const [formError, setFormError] = useState('');

  // Extract unique categories
  const categories = ['Semua', ...Array.from(new Set(switchApps.map((a) => a.category)))];

  // Filter modules
  const filteredApps = switchApps.filter((app) => {
    const matchSearch =
      app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.description && app.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCategory = selectedCategory === 'Semua' || app.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  // Handle Copy URL
  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingModule(null);
    setFormData({
      title: '',
      url: 'https://',
      category: 'Monitoring Board Proses PP1',
      customCategory: '',
      description: '',
      color: 'blue',
      isActive: false
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (app: SwitchAppModule) => {
    setEditingModule(app);
    const isExistingCat = categories.includes(app.category) && app.category !== 'Semua';
    setFormData({
      title: app.title,
      url: app.url,
      category: isExistingCat ? app.category : 'custom',
      customCategory: isExistingCat ? '' : app.category,
      description: app.description || '',
      color: app.color || 'blue',
      isActive: !!app.isActive
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Save Modal
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Nama modul tidak boleh kosong');
      return;
    }
    if (!formData.url.trim() || !formData.url.startsWith('http')) {
      setFormError('URL harus valid dan diawali dengan http:// atau https://');
      return;
    }

    const finalCategory =
      formData.category === 'custom'
        ? formData.customCategory.trim() || 'Kategori Lain'
        : formData.category;

    if (editingModule) {
      // Update existing
      const updated = switchApps.map((item) => {
        if (item.id === editingModule.id) {
          return {
            ...item,
            title: formData.title.trim(),
            url: formData.url.trim(),
            category: finalCategory,
            description: formData.description.trim(),
            color: formData.color,
            isActive: formData.isActive,
            updatedAt: new Date().toISOString()
          };
        }
        // If this one is marked as active, unmark other active modules if user toggled it
        if (formData.isActive && item.id !== editingModule.id && item.isActive) {
          return { ...item, isActive: false };
        }
        return item;
      });
      onUpdateApps(updated);
    } else {
      // Add new
      const newId = 'app_' + Date.now();
      const newModule: SwitchAppModule = {
        id: newId,
        title: formData.title.trim(),
        url: formData.url.trim(),
        category: finalCategory,
        description: formData.description.trim(),
        color: formData.color,
        isActive: formData.isActive,
        isCustom: true,
        updatedAt: new Date().toISOString()
      };

      let nextApps = [...switchApps];
      if (formData.isActive) {
        nextApps = nextApps.map((a) => ({ ...a, isActive: false }));
      }
      nextApps.push(newModule);
      onUpdateApps(nextApps);
    }

    setIsModalOpen(false);
  };

  // Delete Module
  const handleDelete = (id: string, title: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus modul "${title}" dari daftar Switch App?`)) {
      const updated = switchApps.filter((a) => a.id !== id);
      onUpdateApps(updated);
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    if (confirm('Kembalikan seluruh daftar modul Switch App ke pengaturan URL default pabrik?')) {
      onUpdateApps(DEFAULT_SWITCH_APPS);
    }
  };

  // Color theme helper
  const getColorClasses = (color?: string, isActive?: boolean) => {
    if (isActive) {
      return {
        badgeBg: 'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:border-emerald-700 dark:text-emerald-300',
        cardBorder: 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/20',
        iconBg: 'bg-emerald-600 text-white',
        btnPrimary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
      };
    }

    switch (color) {
      case 'amber':
        return {
          badgeBg: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:border-amber-700 dark:text-amber-300',
          cardBorder: 'border-slate-200 hover:border-amber-400 dark:border-slate-800 dark:hover:border-amber-500',
          iconBg: 'bg-amber-500 text-white',
          btnPrimary: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
        };
      case 'rose':
        return {
          badgeBg: 'bg-rose-500/10 text-rose-700 border-rose-300 dark:border-rose-700 dark:text-rose-300',
          cardBorder: 'border-slate-200 hover:border-rose-400 dark:border-slate-800 dark:hover:border-rose-500',
          iconBg: 'bg-rose-500 text-white',
          btnPrimary: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
        };
      case 'indigo':
        return {
          badgeBg: 'bg-indigo-500/10 text-indigo-700 border-indigo-300 dark:border-indigo-700 dark:text-indigo-300',
          cardBorder: 'border-slate-200 hover:border-indigo-400 dark:border-slate-800 dark:hover:border-indigo-500',
          iconBg: 'bg-indigo-600 text-white',
          btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
        };
      case 'purple':
        return {
          badgeBg: 'bg-purple-500/10 text-purple-700 border-purple-300 dark:border-purple-700 dark:text-purple-300',
          cardBorder: 'border-slate-200 hover:border-purple-400 dark:border-slate-800 dark:hover:border-purple-500',
          iconBg: 'bg-purple-600 text-white',
          btnPrimary: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20'
        };
      case 'blue':
      default:
        return {
          badgeBg: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:border-blue-700 dark:text-blue-300',
          cardBorder: 'border-slate-200 hover:border-blue-400 dark:border-slate-800 dark:hover:border-blue-500',
          iconBg: 'bg-blue-600 text-white',
          btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
        };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Hub Controls */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-slate-800 text-white p-6 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none flex items-center pr-6">
          <Layers className="w-64 h-64 text-blue-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-500/30 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Portal Terpadu Ekosistem PP1</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Switch App Board & Modul Produksi</span>
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Pusat navigasi dan peluncur seluruh aplikasi monitoring operasional, rekapitulasi susut proses, dan sistem persediaan gudang Divisi Produksi I. Tersinkronisasi otomatis dengan dropdown header.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Modul / Link</span>
            </button>

            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all border border-slate-700"
              title="Kembalikan daftar ke URL default awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
              {cat === 'Semua' && ` (${switchApps.length})`}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama modul atau URL..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApps.map((app) => {
          const colors = getColorClasses(app.color, app.isActive);
          const isCopied = copiedId === app.id;

          return (
            <div
              key={app.id}
              className={`group relative bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between p-5 ${colors.cardBorder}`}
            >
              <div>
                {/* Header card: Category & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {app.category}
                  </span>

                  {app.isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Aktif (Sistem Ini)
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                      Modul Eksternal
                    </span>
                  )}
                </div>

                {/* Title & Icon */}
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${colors.iconBg}`}
                  >
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {app.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {app.description || 'Tidak ada deskripsi'}
                    </p>
                  </div>
                </div>

                {/* URL Container with Copy */}
                <div className="mt-3.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 text-slate-600 dark:text-slate-300 text-[11px]">
                    <span className="truncate font-mono">{app.url}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(app.id, app.url)}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
                    title="Salin Link URL"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(app)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                    title="Edit Nama Modul & URL"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(app.id, app.title)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors"
                    title="Hapus Modul"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {app.isActive ? (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-3 py-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    Sedang Terbuka
                  </span>
                ) : (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all shadow-xs ${colors.btnPrimary}`}
                  >
                    <span>Buka Sistem</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredApps.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8">
          <Layers className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Tidak ada modul ditemukan
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Coba sesuaikan kata kunci pencarian atau kategori filter Anda.
          </p>
        </div>
      )}

      {/* Modal Tambah / Edit Modul */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold">
                  {editingModule ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {editingModule ? `Edit Modul: ${editingModule.title}` : 'Tambah Modul / Link Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Modul Aplikasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rekap Proses Cengkeh"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  URL Tujuan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Pastikan menyertakan awalan https://
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kategori Modul
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  >
                    <option value="Monitoring Board Proses PP1">Monitoring Board Proses PP1</option>
                    <option value="Sistem Gudang & Logistik">Sistem Gudang & Logistik</option>
                    <option value="Laboratorium & QC">Laboratorium & QC</option>
                    <option value="custom">+ Kategori Kustom...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Warna Aksen
                  </label>
                  <select
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  >
                    <option value="blue">Biru (Blue)</option>
                    <option value="emerald">Hijau (Emerald)</option>
                    <option value="amber">Kuning (Amber)</option>
                    <option value="rose">Merah (Rose)</option>
                    <option value="indigo">Indigo</option>
                    <option value="purple">Ungu (Purple)</option>
                  </select>
                </div>
              </div>

              {formData.category === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Kategori Kustom
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Modul Maintenance"
                    value={formData.customCategory}
                    onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Deskripsi / Catatan Singkat
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat fungsi sistem ini..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label
                  htmlFor="isActiveCheck"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Tandai sebagai sistem yang sedang aktif saat ini
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30"
                >
                  {editingModule ? 'Simpan Perubahan' : 'Tambah Modul'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
