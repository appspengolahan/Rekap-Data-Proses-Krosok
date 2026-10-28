import { jsPDF } from 'jspdf';

export interface BlueprintCodeSnippet {
  title: string;
  language: 'typescript' | 'javascript';
  code: string;
}

export interface BlueprintPoint {
  subtitle: string;
  problem: string;
  solution: string;
  tips?: string[];
}

export interface BlueprintChapter {
  id: string;
  number: string;
  title: string;
  summary: string;
  points: BlueprintPoint[];
  snippets?: BlueprintCodeSnippet[];
}

export const BLUEPRINT_DOCUMENT_META = {
  title: 'Standar Arsitektur & Pengamanan Integrasi DHP ke Sheet Rekap',
  subtitle:
    'Panduan Referensi Lintas Web App Produksi (Sumber DHP -> Web App Integrasi DHP -> Buku Besar Rekap)',
  version: 'Standar Sistem 4-Layer Defense',
  fileName: 'Panduan_Arsitektur_Integrasi_DHP_Rekap_PP1.pdf'
};

export const BLUEPRINT_CHAPTERS: BlueprintChapter[] = [
  {
    id: 'arsitektur-aliran-data',
    number: '01',
    title: 'Arsitektur Aliran Data 3-Titik & Single Source of Truth',
    summary:
      'Memisahkan secara tegas fungsi Sheet DHP Harian sebagai buffer kerja transien (ephemeral) dari Sheet Rekap sebagai buku besar permanen (immutable audit ledger), dengan pembacaan hibrida tahan filter.',
    points: [
      {
        subtitle: 'Pemisahan Buffer Kerja Transien vs Buku Besar Permanen',
        problem:
          'Menyamakan proses sinkronisasi Sheet DHP ke Sheet Rekap seperti sistem mirroring mentah menyebabkan baris draft (Hasil = 0) atau rumus harian DHP ikut menimpa catatan historis yang sudah sah di Rekap.',
        solution:
          'Tetapkan 3 peran terpisah: (1) Sheet DHP hanya sebagai sumber pembacaan progres harian lantai produksi; (2) Web App Integrasi DHP sebagai gerbang validasi fisika, pencocokan status, dan pratinjau; (3) Sheet Rekap sebagai Buku Besar Permanen yang hanya menerima batch selesai (Netto Hasil > 0) yang lulus validasi.',
        tips: [
          'Jangan pernah menulis balik (write-back) dari Web App ke Sheet DHP sumber agar rumus operator lapangan tidak terganggu.',
          'Gunakan penggabungan memori di frontend (mergeRekapWithCompletedDhp) hanya untuk batch selesai (Hasil > 0) yang belum masuk Rekap agar KPI Dashboard selalu real-time tanpa mengotori data dengan batch setengah jadi.'
        ]
      },
      {
        subtitle: 'Strategi Dual-Read Hibrida (Anti-Potong saat Filter Google Sheet Aktif)',
        problem:
          'Endpoint Google Visualization API (Gviz) sangat cepat dan menampilkan detail kolom lengkap, tetapi jika seseorang mengaktifkan Filter di Google Sheet (misal hanya mencentang bulan Oktober), Gviz hanya mengembalikan baris yang tampak sehingga data bulan sebelumnya hilang dari Dashboard.',
        solution:
          'Gabungkan pembacaan paralel: tarik riwayat penuh tanpa terpengaruh filter melalui endpoint Google Apps Script (doGet readAll) sekaligus tarik detail presisi baris terbaru dari Gviz, lalu satukan dengan LocalStorage Cache sebagai cadangan offline.',
        tips: [
          'Jika endpoint GAS sedang lambat dan Gviz mengembalikan kurang dari 60% jumlah baris cache lokal, lakukan merge ke cache lokal (jangan langsung mengganti seluruh state) agar bulan historis tidak pernah hilang.'
        ]
      },
      {
        subtitle: 'Pembacaan Tabel Referensi Independen (Two-Pass Master Lookup)',
        problem:
          'Pada banyak Sheet DHP, kolom kanan (misal Kolom Q & R untuk Kode Stock / Master Varian) disusun urut abjad, sedangkan transaksi harian di Kolom C..M diinput sesuai urutan jam produksi. Membaca keduanya pada indeks baris yang sama menghasilkan Kode Stock yang salah pasang.',
        solution:
          'Gunakan algoritma 2-Pass: Pass Pertama memindai seluruh kolom master ke dalam Map<namaVarianNormalisasi, kodeStock>, lalu Pass Kedua memindai baris transaksi harian dan mencocokkan Kode Stock berdasarkan nama varian, bukan nomor baris.'
      }
    ],
    snippets: [
      {
        title: 'Pola Dual-Read Hibrida Tahan Filter Sheet (TypeScript)',
        language: 'typescript',
        code: `export async function fetchUnifiedRekapRecords(config: GASConfig, cached: RekapRecord[]) {
  const [gvizRows, gasRows] = await Promise.all([
    fetchFromGviz(config.spreadsheetId, config.sheetName),
    fetchFromGAS(config.gasUrl, cached)
  ]);

  const gvizMap = new Map(
    gvizRows.map((r) => [\`\${r.tanggal}|\${r.baku.toFixed(1)}|\${r.varian.toLowerCase()}\`, r])
  );

  // Prioritaskan kelengkapan baris GAS (bebas filter Sheet) + detail kolom Gviz
  if (gasRows.length > 0 && gasRows.length >= gvizRows.length) {
    return gasRows.map((r) => {
      const detail = gvizMap.get(\`\${r.tanggal}|\${r.baku.toFixed(1)}|\${r.varian.toLowerCase()}\`);
      return detail ? { ...r, ...detail } : r;
    });
  }

  // Proteksi jika GAS offline sementara Sheet sedang terfilter sebagian
  if (gvizRows.length > 0 && gvizRows.length < cached.length * 0.6) {
    const merged = new Map(cached.map((r) => [\`\${r.tanggal}|\${r.baku.toFixed(1)}|\${r.varian.toLowerCase()}\`, r]));
    gvizRows.forEach((r) => merged.set(\`\${r.tanggal}|\${r.baku.toFixed(1)}|\${r.varian.toLowerCase()}\`, r));
    return Array.from(merged.values());
  }
  return gvizRows;
}`
      }
    ]
  },
  {
    id: 'anti-duplikat',
    number: '02',
    title: 'Pengamanan Anti-Duplikat & Pencocokan 1-ke-1 (Idempotent Upsert)',
    summary:
      'Mencegah penggandaan baris saat tombol sinkronisasi diklik berulang kali bersamaan dengan Auto-Push 5 menit, termasuk saat terdapat dua batch varian yang sama di hari yang sama.',
    points: [
      {
        subtitle: 'Kunci Komposit 3-Dimensi + Normalisasi Nama Varian',
        problem:
          'Mencocokkan hanya berdasarkan Tanggal + Nama Varian gagal ketika satu varian diproses dalam 2 lot/batch pada hari yang sama, atau gagal cocok karena spasi ganda dan embel-embel jalur (SKT/SKM).',
        solution:
          'Gunakan fungsi normalisasi nama varian (lowercase, trim, hapus suffix jalur SKT/SKM dan spasi ganda) yang dikombinasikan dengan Tanggal ISO (yyyy-MM-dd) dan toleransi bobot Netto Baku (Math.abs(bakuDhp - bakuRekap) < 0.5 Kg).'
      },
      {
        subtitle: 'Mekanisme Consumed Pool 1-ke-1 (used = true / Set<srcRow>)',
        problem:
          'Jika pada tanggal yang sama terdapat 2 batch identik (misal Varian A 100 Kg selesai, dan Varian A 100 Kg kedua sedang diproses), pencarian .find() biasa akan selalu menunjuk ke baris pertama di Rekap sehingga batch kedua dianggap sudah masuk atau menimpa batch pertama.',
        solution:
          'Setiap baris Rekap yang sudah berpasangan dengan satu baris DHP langsung ditandai used = true (di GAS) atau dimasukkan ke consumedRekapRows.add(srcRow) (di Frontend). Pencocokan dibagi menjadi 2 tahap: Pass 1 mencocokkan Tanggal + Varian + Baku presisi; Pass 2 mencocokkan baris template kosong (Hasil === 0) dengan varian yang sama.',
        tips: [
          'Dengan pola Idempotent Upsert ini, meskipun operator menekan tombol Sinkronkan 10 kali berturut-turut, jumlah baris di Sheet Rekap tetap presisi (0 duplikat).'
        ]
      }
    ],
    snippets: [
      {
        title: 'Pencocokan 1-ke-1 Anti-Duplikat di GAS & Frontend',
        language: 'javascript',
        code: `function normalisasiVarian_(nama) {
  return String(nama || '')
    .toLowerCase()
    .replace(/\\b(skt|skm)\\b/gi, '')
    .replace(/\\s+/g, ' ')
    .trim();
}

// Pass 1: Cocokkan Tanggal + Varian + Bobot Baku (Toleransi 0.5 Kg)
for (var re = 0; re < rekapEntries.length; re++) {
  var cand = rekapEntries[re];
  if (cand.used || cand.isoDate !== dBatch.isoDate) continue;
  if (cand.normVarian === dBatch.normVarian && Math.abs(cand.curBaku - dBatch.baku) < 0.5) {
    matchEntry = cand;
    break;
  }
}
// Pass 2: Isi slot template tanggal aktif yang masih kosong (curHasil === 0)
if (!matchEntry) {
  for (var re2 = 0; re2 < rekapEntries.length; re2++) {
    var candT = rekapEntries[re2];
    if (candT.used || candT.isoDate !== dBatch.isoDate || candT.curHasil > 0) continue;
    if (candT.normVarian === dBatch.normVarian) {
      matchEntry = candT;
      break;
    }
  }
}
if (matchEntry) matchEntry.used = true; // Kunci agar tidak dipakai batch kembar berikutnya`
      }
    ]
  },
  {
    id: 'anti-hapus-dan-timpa-nol',
    number: '03',
    title: 'Pengamanan Anti-Hapus, Anti-Timpa Nol & Proteksi Rumus Sheet',
    summary:
      'Melindungi data final timbangan yang sudah terisi agar tidak pernah tertimpa angka 0 (terutama saat pergantian hari 00:00 WIB) dan tidak pernah terhapus saat pembersihan rencana produksi yang batal.',
    points: [
      {
        subtitle: 'Layer 1 — Non-Destructive Zero Guard & Jebakan =TODAY() Pukul 00:00 WIB',
        problem:
          'Banyak Sheet DHP menggunakan rumus =TODAY() di sel header tanggal. Tepat pukul 00:00 WIB, tanggal header berubah ke hari baru sedangkan tabel masih berisi transaksi kemarin; akibatnya rumus kolom Hasil di DHP berubah menjadi boolean FALSE (dibaca 0) dan Susut tampak melonjak 100%. Skrip tanpa pengaman akan menimpa Hasil final di Rekap menjadi 0 Kg!',
        solution:
          'Terapkan 3 lapis kunci: (1) Di parser DHP, jika sel Hasil bernilai boolean false atau <= 0, paksa hasil = 0 & susut = 0 (status Proses, bukan susut 100%); (2) Di GAS & Web App, blokir mutlak update jika curHasil > 0 dan dBatch.hasil <= 0; (3) Di Frontend (Midnight Rollover Fallback), jika hasil DHP <= 0 tetapi baris tersebut sudah memiliki match.hasil > 0 di Rekap, pulihkan tampilan angka dari Rekap agar operator tidak melihat "0,0 (Proses)" palsu di pagi hari.'
      },
      {
        subtitle: 'Reverse Scanning (Bottom-Up) & Fail-Safe Mutlak rHasil === 0',
        problem:
          'Saat rencana awal 13 varian dipangkas menjadi 5 varian riil, 8 baris rencana batal di Rekap perlu dibersihkan. Jika menghapus baris dari atas ke bawah (i = 0; i < len; i++), pemanggilan deleteRow() menggeser seluruh indeks baris di bawahnya sehingga baris yang salah ikut terhapus!',
        solution:
          'Wajib gunakan perulangan Bawah-ke-Atas (for k = rows.length - 1; k >= 0; k--) yang dikunci ketat HANYA pada Tanggal Aktif DAN hanya mengizinkan penghapusan jika Netto Hasil === 0. Setiap baris dengan rHasil > 0 dilindungi mutlak (Fail-Safe Protected).',
        tips: [
          'Jika baris yang akan dibersihkan adalah baris pertama tabel data (misal Baris 12) dan itu satu-satunya baris tersisa, JANGAN panggil deleteRow(12) agar master formula kolom tidak musnah! Gunakan clearContent() selektif hanya pada kolom input mentah.'
        ]
      },
      {
        subtitle: 'Proteksi Mutlak Kolom Rumus (Zero Formula Overwrite)',
        problem:
          'Menulis seluruh baris sekaligus menggunakan setValues([rowArray]) dari kolom A sampai N akan menimpa dan menghancurkan rumus otomatis Spreadsheet (seperti rumus Bulan, Tahun, Gabungan Nama Perlakuan, Susut Kg, dan Susut %).',
        solution:
          'Hanya tulis ke kolom input mentah (Tanggal, Varian, Jalur, Baku, Hasil, Gagang, Air, Debu). Saat menambah baris baru, salin rumus dari baris di atasnya khusus pada kolom ber-rumus menggunakan SpreadsheetApp.CopyPasteType.PASTE_FORMULA.'
      }
    ],
    snippets: [
      {
        title: 'Reverse Scanning Bottom-Up + Fail-Safe Hasil === 0 + Proteksi Master Formula',
        language: 'javascript',
        code: `// Penelusuran Bawah-ke-Atas (Bottom-Up): deleteRow aman tanpa menggeser indeks di atasnya
for (var k = activeRekapRows.length - 1; k >= 0; k--) {
  var item = activeRekapRows[k];
  var checkRow = item.rowNum;

  // FAIL-SAFE MUTLAK: Baris yang sudah memiliki Netto Hasil > 0 HARAM dihapus!
  if (item.rHasil > 0) continue;

  var isTemplateKosong = (item.rBaku <= 0 && item.rHasil <= 0 && !item.matched);
  var isRencanaBatal = (item.rBaku > 0 && item.rHasil <= 0 && !item.matched);

  if (isTemplateKosong || isRencanaBatal) {
    if (checkRow === FIRST_DATA_ROW && findActualLastRow_(shRekap) <= FIRST_DATA_ROW) {
      // Jaga master formula di baris pertama data: hapus hanya sel input non-rumus
      shRekap.getRange(FIRST_DATA_ROW, 2).clearContent();
      shRekap.getRange(FIRST_DATA_ROW, 6, 1, 4).clearContent();
      shRekap.getRange(FIRST_DATA_ROW, 12, 1, 3).clearContent();
    } else if (checkRow >= FIRST_DATA_ROW) {
      shRekap.deleteRow(checkRow);
    }
  }
}`
      }
    ]
  },
  {
    id: 'neraca-fisika',
    number: '04',
    title: 'Pengamanan Neraca Massa & Batas Fisika (Layer 2 Sanity Quarantine)',
    summary:
      'Menangkap anomali salah ketik timbangan atau kerusakan rumus sumber sebelum sempat mencemari Buku Besar Rekap.',
    points: [
      {
        subtitle: 'Validasi Hukum Kekekalan Massa & Karantina Otomatis',
        problem:
          'Salah ketik desimal oleh operator (misal Baku 726,6 Kg tetapi Hasil diketik 72,6 Kg sehingga Susut 90%) atau rumus selisih yang menghasilkan Debu minus ekstrem (misal Debu = -149,5 Kg) akan merusak rata-rata KPI bulanan dan tahunan jika langsung disimpan ke Rekap.',
        solution:
          'Pasang fungsi validasiFisika() kembar di Frontend dan GAS: tolak dan karantina setiap baris yang memiliki fraksi fisik negatif (Debu < 0, Gagang < 0, Air < 0) atau persentase susut di luar batas fisika proses normal (Susut > 35% atau Susut < -15%).',
        tips: [
          'PENTING untuk komoditas higroskopis (Tembakau/Krosok): Jangan memblokir susut negatif kecil (misal -0,05% s/d -5%) karena daun kering dapat menyerap uap air alami saat kelembapan pabrik tinggi. Blokir hanya fraksi limbah negatif (< 0 Kg) atau serap uap mustahil (< -15%).',
          'Pada skrip GAS, baris yang dikarantina tetap dimasukkan ke daftar allActiveDhp (agar Tahap Auto-Purge tidak salah mengira varian tersebut batal diproduksi), tetapi dikeluarkan dari completedDhp (agar angkanya yang salah tidak ditulis ke Sheet Rekap).'
        ]
      }
    ],
    snippets: [
      {
        title: 'Validator Batas Fisika & Karantina Neraca Massa',
        language: 'typescript',
        code: `export function validateProcessPhysics(params: {
  baku: number;
  hasil: number;
  gagangKg?: number;
  airKg?: number;
  debuKg?: number;
}): { valid: boolean; reason?: string } {
  const { baku, hasil, gagangKg = 0, airKg = 0, debuKg = 0 } = params;
  if (debuKg < 0 || gagangKg < 0 || airKg < 0) {
    return { valid: false, reason: 'Fraksi limbah fisik bernilai negatif (< 0 Kg)' };
  }
  if (hasil > 0 && baku > 0) {
    const susutPct = ((baku - hasil) / baku) * 100;
    if (susutPct > 35) {
      return { valid: false, reason: \`Susut ekstrem \${susutPct.toFixed(2)}% (> 35% indikasi salah ketik)\` };
    }
    if (susutPct < -15) {
      return { valid: false, reason: 'Hasil melampaui batas serap uap fisik (> 115% Baku)' };
    }
  }
  return { valid: true };
}`
      }
    ]
  },
  {
    id: 'anti-limit-gas',
    number: '05',
    title: 'Pengamanan Anti-Limit, Anti-Timeout & Anti-CORS Google Apps Script',
    summary:
      'Memastikan eksekusi GAS selesai dalam hitungan milidetik, bebas tabrakan proses (race condition), tidak terblokir CORS browser, dan kebal terhadap error JSON terpotong.',
    points: [
      {
        subtitle: 'Jebakan sheet.getLastRow() pada Sheet Ber-Formula & Solusi findActualLastRow_()',
        problem:
          'Di Google Sheets produksi, rumus pada kolom Bulan/Tahun/Susut sering sudah ditarik (drag) sampai baris 1.200+ walaupun data aktual baru sampai baris 185. Memanggil sheet.getLastRow() menyebabkan GAS membaca dan memproses >1.000 baris kosong setiap siklus, memicu Execution Timeout!',
        solution:
          'Buat helper findActualLastRow_(sheet) yang hanya membaca 1 kolom Tanggal (Kolom B) lalu menelusuri dari bawah ke atas hingga menemukan sel pertama yang benar-benar berisi Date/teks tanggal. Gunakan batas ini di SEMUA tahap (doGet, Auto-Purge, dan Upsert) untuk memangkas beban baca 85-90%.'
      },
      {
        subtitle: 'LockService Concurrency Guard + Blok try-catch-finally',
        problem:
          'Ketika pemicu waktu Auto-Push 5 Menit berjalan tepat bersamaan dengan klik manual tombol Sinkronkan dari Web App, dua instans GAS menulis ke baris yang sama secara paralel dan menimbulkan duplikasi atau sel rusak.',
        solution:
          'Selalu awali fungsi sinkronisasi dan doPost dengan LockService.getScriptLock().tryLock(15000). Jika kunci sedang dipakai proses lain, kembalikan JSON { skipped: true } secara sopan, dan wajib lepaskan kunci di dalam blok finally { try { lock.releaseLock(); } catch (e) {} }.'
      },
      {
        subtitle: 'Trik Anti-Blokir CORS POST & Safe Stream JSON Parser',
        problem:
          'Mengirim fetch POST dengan header application/json memicu browser mengirim request preflight OPTIONS yang ditolak oleh Google Apps Script (CORS error). Selain itu, memanggil langsung await res.json() akan meledak dengan error "Unexpected end of JSON input" bila koneksi terputus atau kuota GAS habis.',
        solution:
          'Saat POST ke GAS, gunakan headers: { "Content-Type": "text/plain;charset=utf-8" } dan redirect: "follow" dengan body JSON.stringify(payload). Saat membaca balasan, baca sebagai teks terlebih dahulu via await res.text(), periksa ketidak-kosongan & keutuhan kurung kurawal sebelum memanggil JSON.parse().',
        tips: [
          'Untuk interval Auto-Tarik di Frontend, tarik pembacaan ringan via Gviz setiap 12 detik saat pop-up dibuka, sedangkan pemicu tulis GAS (Auto-Push) cukup setiap 5 menit (288 eksekusi/hari, sangat jauh di bawah kuota harian Google 90 menit/hari).'
        ]
      }
    ],
    snippets: [
      {
        title: 'Optimasi findActualLastRow_() + CORS-Safe Fetch + Safe Stream JSON Parser',
        language: 'typescript',
        code: `// 1. Helper GAS: Abaikan ribuan baris rumus kosong di bawah data aktual
function findActualLastRow_(sheet) {
  var max = sheet.getLastRow();
  if (max < 12) return 11;
  var colB = sheet.getRange(12, 2, max - 11, 1).getValues();
  for (var idx = colB.length - 1; idx >= 0; idx--) {
    var v = colB[idx][0];
    if (v instanceof Date || (typeof v === 'string' && v.trim() !== '')) return 12 + idx;
  }
  return 11;
}

// 2. Helper Frontend: Kirim POST bebas CORS & parsing anti-"Unexpected end of JSON input"
export async function postToGasSafely(gasUrl: string, payload: unknown) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Wajib text/plain agar bebas preflight CORS!
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  const rawText = (await res.text()).trim();
  if (!rawText || rawText.startsWith('<!DOCTYPE') || rawText.toLowerCase().startsWith('<html')) {
    return { ok: false, data: null, error: 'Respons GAS kosong atau halaman kuota HTML' };
  }
  try {
    return { ok: res.ok, data: JSON.parse(rawText), error: null };
  } catch {
    return { ok: false, data: null, error: 'Aliran JSON terpotong sebelum selesai' };
  }
}`
      }
    ]
  },
  {
    id: 'isolasi-audit-ux',
    number: '06',
    title: 'Tips Tambahan: Audit Realisasi Terisolasi & Tata Letak Zero-Slider',
    summary:
      'Praktik desain operasional agar pendeteksian batch batal tetap akurat tanpa mengotori angka KPI utama, serta seluruh kolom tampil utuh dalam satu layar.',
    points: [
      {
        subtitle: 'Scanner Audit Tanggal Aktif yang Terisolasi dari State KPI Utama',
        problem:
          'Untuk mendeteksi adanya baris rencana batal (Hasil = 0) di Sheet Rekap, aplikasi harus membaca baris Hasil = 0. Namun jika baris Hasil = 0 masuk ke array records utama Dashboard, maka perhitungan rata-rata susut dan jumlah batch bulanan menjadi kacau.',
        solution:
          'Pisahkan secara total! Array records utama tetap memfilter ketat hasil > 0, sementara untuk mendeteksi baris batal/template kosong pada tanggal aktif, jalankan scanner khusus yang terisolasi (fetchRekapActiveDateAudit) yang hanya menyuplai banner peringatan di dalam pop-up Integrasi DHP.'
      },
      {
        subtitle: 'Tata Letak Tabel 10-Kolom Proporsional Tanpa Geser Horizontal (Zero-Slider)',
        problem:
          'Terlalu banyak kolom aksi terpisah (seperti tombol Quick Tag tersendiri, jam di samping tanggal, atau teks acuan menyamping) membuat tabel melebar keluar layar laptop 13-14 inci sehingga kolom Status Rekap di ujung kanan terpotong.',
        solution:
          'Susun vertikal informasi sekunder: letakkan Jam Proses tepat di bawah Tanggal, Kode Stock tepat di bawah Nama Varian, dan teks "(Acuan X%)" tepat di bawah angka Susut (%). Gabungkan aksi Quick Tag langsung ke klik lencana Status Deviasi dan tooltip Diagnosa Kilat saat hover.'
      }
    ]
  }
];

export const BLUEPRINT_VERIFICATION_CHECKLIST: string[] = [
  'Sheet DHP diperlakukan murni sebagai sumber baca (Read-Only Buffer); Sheet Rekap sebagai Buku Besar Permanen (hanya menerima Netto Hasil > 0).',
  'Parser DHP memeriksa boolean FALSE pada kolom Hasil (akibat rumus =TODAY() lewat pukul 00:00 WIB) dan memetakan ke status Proses (0 Kg), bukan Susut 100%.',
  'Midnight Rollover Fallback aktif: jika hasil DHP = 0 tetapi batch tersebut sudah tercatat Hasil > 0 di Rekap, tampilkan bobot terverifikasi dari Rekap.',
  'Pencocokan DHP ke Rekap menggunakan kunci komposit (Tanggal ISO + Varian ternormalisasi + Toleransi Baku) dengan penanda 1-ke-1 (used = true) anti-duplikat.',
  'Layer 1 Non-Destructive Guard aktif di Frontend & GAS: melarang keras nilai baru <= 0 menimpa nilai lama > 0.',
  'Layer 2 Physics Sanity Guard aktif: mengkarantina otomatis baris dengan fraksi limbah < 0 Kg atau Susut > 35% / < -15%.',
  'Auto-Purge varian batal menggunakan Reverse Scanning (Bottom-Up: k = len - 1; k >= 0; k--) khusus Tanggal Aktif dan wajib melewati baris dengan Hasil > 0.',
  'Penulisan ke Sheet Rekap hanya menyentuh sel input mentah dan menyalin kolom rumus menggunakan PASTE_FORMULA (plus proteksi baris pertama data dari deleteRow).',
  'Seluruh pembacaan Sheet Rekap di GAS menggunakan findActualLastRow_(sheet) pada kolom Tanggal untuk melewati ribuan baris rumus kosong.',
  'Fungsi sinkronisasi GAS dibungkus LockService.getScriptLock().tryLock(15000) dan selalu melepas kunci di dalam blok finally.',
  'Pengiriman POST dari browser ke GAS memakai Content-Type: text/plain;charset=utf-8 + redirect: follow agar bebas blokir preflight CORS.',
  'Pembacaan respons HTTP dari GAS selalu melalui response.text() sebelum JSON.parse() agar bebas crash "Unexpected end of JSON input".'
];

/**
 * Menghasilkan teks Markdown lengkap siap salin untuk ditempelkan ke thread AI lain
 * yang sedang membangun/memperbaiki Web App berarsitektur DHP -> Integrasi DHP -> Rekap.
 */
export function buildMasterBlueprintMarkdown(): string {
  const lines: string[] = [
    `# ${BLUEPRINT_DOCUMENT_META.title}`,
    `> ${BLUEPRINT_DOCUMENT_META.subtitle}`,
    '',
    'Gunakan panduan arsitektur dan standar pengamanan ini sebagai **referensi wajib** dalam membangun atau menyempurnakan Web App dengan alur:',
    '1. **Sumber Data**: Spreadsheet DHP Harian (buffer kerja dinamis lantai produksi).',
    '2. **Orkestrator**: Modul Pop-up **Integrasi DHP** di Web App (validasi fisika, pratinjau real-time, deteksi deviasi & audit realisasi).',
    '3. **Tujuan Akhir**: Spreadsheet **Rekap** (Buku Besar Permanen / Immutable Audit Ledger via Google Apps Script 2-arah).',
    ''
  ];

  for (const ch of BLUEPRINT_CHAPTERS) {
    lines.push(`## ${ch.number}. ${ch.title}`);
    lines.push(ch.summary);
    lines.push('');
    for (const pt of ch.points) {
      lines.push(`### - ${pt.subtitle}`);
      lines.push(`- **Risiko / Celah Umum**: ${pt.problem}`);
      lines.push(`- **Solusi Standar**: ${pt.solution}`);
      if (pt.tips && pt.tips.length > 0) {
        for (const tip of pt.tips) {
          lines.push(`  - *Tips*: ${tip}`);
        }
      }
      lines.push('');
    }
    if (ch.snippets && ch.snippets.length > 0) {
      for (const snip of ch.snippets) {
        lines.push(`**Contoh Implementasi — ${snip.title}:**`);
        lines.push(`\`\`\`${snip.language}`);
        lines.push(snip.code);
        lines.push('```');
        lines.push('');
      }
    }
  }

  lines.push('## 07. Checklist Audit 12 Pengaman Wajib Sebelum Deploy');
  BLUEPRINT_VERIFICATION_CHECKLIST.forEach((item, idx) => {
    lines.push(`${idx + 1}. [x] ${item}`);
  });
  lines.push('');

  return lines.join('\n');
}

/**
 * Menghasilkan dan mengunduh file PDF A4 profesional multi-halaman secara langsung
 * menggunakan jsPDF (bebas blokir pop-up / iframe print).
 */
export function downloadArchitectureBlueprintPdf(): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  const bottomLimit = pageHeight - 16;

  let cursorY = 16;

  const drawRunningHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 0, pageWidth, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(
      'BLUEPRINT ARSITEKTUR & PENGAMANAN: INTEGRASI DHP -> WEB APP -> SHEET REKAP',
      marginX,
      7
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Standar 4-Layer Defense PP1', pageWidth - marginX, 7, { align: 'right' });
    cursorY = 17;
  };

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > bottomLimit) {
      doc.addPage();
      drawRunningHeader();
    }
  };

  // --- COVER BANNER ON PAGE 1 ---
  doc.setFillColor(11, 19, 41); // #0b1329
  doc.roundedRect(marginX, 12, contentWidth, 34, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(251, 191, 36); // amber-400
  doc.text('DOKUMEN REFERENSI REKAYASA SISTEM · DIVISI PRODUKSI I', marginX + 6, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(BLUEPRINT_DOCUMENT_META.title, contentWidth - 12);
  doc.text(titleLines, marginX + 6, 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  const subLines = doc.splitTextToSize(BLUEPRINT_DOCUMENT_META.subtitle, contentWidth - 12);
  doc.text(subLines, marginX + 6, 38);

  cursorY = 52;

  // --- ALUR ARSITEKTUR RINGKAS ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, cursorY, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Pola Aliran Data Standar (3-Tier Single Source of Truth):', marginX + 4, cursorY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const flowDesc =
    '[1] Sheet DHP Harian (Buffer Kerja Transien / Read-Only)  --->  [2] Modul Web App Integrasi DHP (Validasi Fisika, Anti-Duplikat & Fallback 00:00 WIB)  --->  [3] Sheet Rekap via GAS 2-Arah (Buku Besar Permanen: Upsert Hasil > 0, Reverse Auto-Purge Batal & Proteksi Rumus 100%)';
  const flowLines = doc.splitTextToSize(flowDesc, contentWidth - 8);
  doc.text(flowLines, marginX + 4, cursorY + 11.5);

  cursorY += 28;

  // --- RENDER CHAPTERS ---
  for (const chapter of BLUEPRINT_CHAPTERS) {
    ensureSpace(24);

    // Chapter Header Bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(marginX, cursorY, contentWidth, 8.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${chapter.number}. ${chapter.title}`, marginX + 3.5, cursorY + 5.7);
    cursorY += 11.5;

    // Chapter Summary
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    const sumLines = doc.splitTextToSize(chapter.summary, contentWidth);
    ensureSpace(sumLines.length * 4 + 3);
    doc.text(sumLines, marginX, cursorY);
    cursorY += sumLines.length * 3.9 + 3;

    // Points
    for (const pt of chapter.points) {
      const probLines = doc.splitTextToSize(`Celah / Risiko: ${pt.problem}`, contentWidth - 6);
      const solLines = doc.splitTextToSize(`Solusi Pengaman: ${pt.solution}`, contentWidth - 6);
      let tipLinesTotal: string[][] = [];
      let tipHeight = 0;
      if (pt.tips && pt.tips.length > 0) {
        tipLinesTotal = pt.tips.map((t) =>
          doc.splitTextToSize(`• Tips Praktis: ${t}`, contentWidth - 8)
        );
        tipHeight = tipLinesTotal.reduce((acc, l) => acc + l.length * 3.6 + 1, 1);
      }

      const blockHeight =
        6.5 + probLines.length * 3.7 + 2 + solLines.length * 3.7 + tipHeight + 4;
      ensureSpace(Math.min(blockHeight, 85));

      // Subtitle
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${pt.subtitle}`, marginX, cursorY);
      cursorY += 4.5;

      // Problem
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(159, 18, 57); // rose-800
      ensureSpace(probLines.length * 3.8 + 2);
      doc.text(probLines, marginX + 3, cursorY);
      cursorY += probLines.length * 3.7 + 1.5;

      // Solution
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(6, 95, 70); // emerald-800
      ensureSpace(solLines.length * 3.8 + 2);
      doc.text(solLines, marginX + 3, cursorY);
      cursorY += solLines.length * 3.7 + 1.5;

      // Tips
      if (tipLinesTotal.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(51, 65, 85);
        for (const tLines of tipLinesTotal) {
          ensureSpace(tLines.length * 3.7 + 1.5);
          doc.text(tLines, marginX + 5, cursorY);
          cursorY += tLines.length * 3.6 + 1;
        }
      }

      cursorY += 2.5;
    }

    // Code Snippets
    if (chapter.snippets && chapter.snippets.length > 0) {
      for (const snip of chapter.snippets) {
        const rawCodeLines = snip.code.split('\n');
        const wrappedCodeLines: string[] = [];
        doc.setFont('courier', 'normal');
        doc.setFontSize(7.1);
        for (const cl of rawCodeLines) {
          const split = doc.splitTextToSize(cl || ' ', contentWidth - 6);
          wrappedCodeLines.push(...split);
        }

        const boxH = wrappedCodeLines.length * 3.35 + 9;
        ensureSpace(Math.min(boxH + 4, 110));

        // If box is taller than remaining space even after page break, render cleanly line-by-line
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        const currentPageBoxH = Math.min(boxH, bottomLimit - cursorY);
        doc.roundedRect(marginX, cursorY, contentWidth, currentPageBoxH, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(30, 64, 175); // blue-800
        doc.text(`Kode Referensi: ${snip.title}`, marginX + 3, cursorY + 4.5);
        cursorY += 8;

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.1);
        doc.setTextColor(15, 23, 42);

        for (const wLine of wrappedCodeLines) {
          if (cursorY + 3.6 > bottomLimit) {
            doc.addPage();
            drawRunningHeader();
          }
          doc.text(wLine, marginX + 3, cursorY);
          cursorY += 3.35;
        }
        cursorY += 4;
      }
    }

    cursorY += 3;
  }

  // --- CHECKLIST SECTION ---
  ensureSpace(45);
  doc.setFillColor(11, 19, 41);
  doc.roundedRect(marginX, cursorY, contentWidth, 8.5, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text('07. Checklist Verifikasi 12 Pengaman Wajib Sebelum Deploy', marginX + 3.5, cursorY + 5.7);
  cursorY += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  BLUEPRINT_VERIFICATION_CHECKLIST.forEach((chk, index) => {
    const chkLines = doc.splitTextToSize(`[V] ${index + 1}. ${chk}`, contentWidth - 4);
    ensureSpace(chkLines.length * 3.9 + 2);
    doc.text(chkLines, marginX + 2, cursorY);
    cursorY += chkLines.length * 3.8 + 1.8;
  });

  // --- STAMP FOOTER PAGE NUMBERS ACROSS ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'Referensi Standar Web App Rekap Proses Krosok — Divisi Produksi I',
      marginX,
      pageHeight - 6.5
    );
    doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - marginX, pageHeight - 6.5, {
      align: 'right'
    });
  }

  doc.save(BLUEPRINT_DOCUMENT_META.fileName);
}
