# 💻 IT Support Helpdesk & Ticketing System

Sistem Manajemen Tiket Kendala Teknis (IT Helpdesk) modern, responsif, dan siap pakai yang dirancang khusus untuk pekerjaan **IT Support** yang berhadapan langsung dengan user/karyawan.

Dashboard telah **dipisahkan secara penuh menjadi dua halaman mandiri**:
1. 👤 **Portal User (Karyawan)**: Halaman khusus bagi karyawan untuk membuat tiket dan memantau status pengerjaan.
2. 🛠️ **Dashboard Admin (IT Support Console)**: Halaman khusus tim IT Support untuk mengelola tiket (**CRUD lengkap**), mengubah status, menugaskan teknisi, mengisi catatan solusi & catatan internal, melihat grafik analitik beban kerja, dan mengekspor CSV.

---

## 🌐 Tautan Halaman (Terpisah)

| Halaman | URL Akses | Deskripsi |
| :--- | :--- | :--- |
| 👤 **Portal User (Pelapor)** | **[http://localhost:8080/](http://localhost:8080/)** atau `/user` | Khusus karyawan: Form pengajuan tiket, pelacakan status, dan chat dengan IT |
| 🛠️ **Dashboard Admin IT** | **[http://localhost:8080/admin](http://localhost:8080/admin)** | Khusus IT Support: CRUD tiket, penugasan teknisi, analitik, dan ekspor CSV |

---

## 🚀 Cara Menjalankan Aplikasi

```bash
cd "c:\Users\Asus\Downloads\Website Ticketing"

# Jalankan server
npm start
```

---

## 🌟 Fitur Masing-Masing Halaman

### 1. 👤 Portal User (`/user` atau `/`)
- **Tampilan Khusus Pelapor**: Bersih dari kontrol administrasi atau tombol hapus yang membingungkan karyawan.
- **Ajukan Tiket Baru**:
  - Nama Karyawan, Departemen, No. WhatsApp/Telp, Ruangan/Lantai.
  - Kategori Masalah: *Hardware, Software, Jaringan, Akun & Hak Akses, Printer & Scanner, Email, Lain-lain*.
  - Tingkat Urgensi: *Low, Medium, High, Critical*.
  - Lampiran Foto/Screenshot bukti error (JPG, PNG, PDF).
- **Pantau Status & Filter**: Filter cepat `Semua`, `Antrian`, `Diproses`, `Selesai`, serta pencarian instan nomor tiket.
- **Detail & Chat**: Melihat perkembangan pengerjaan, membaca solusi resmi dari IT, dan membalas komentar jika masalah belum selesai.

### 2. 🛠️ Dashboard Admin IT (`/admin`)
- **Kendali Penuh CRUD**:
  - **Create**: Buat tiket manual (*Walk-in request* atau telepon).
  - **Read**: Tabel data responsif dengan filter status, prioritas, kategori, dan departemen.
  - **Quick Action**: Dropdown langsung di baris tabel untuk update status cepat (*Open, In Progress, Pending User, Resolved, Closed*).
  - **Update**: Modal kelola tiket untuk re-assign teknisi, ubah prioritas, input **Solusi Perbaikan** (dilihat user), dan **Catatan Internal IT** (rahasia).
  - **Delete**: Hapus tiket dengan konfirmasi dialog aman.
- **KPI Metrics & Grafik Analitik**:
  - Total Tiket, Baru, Sedang Diproses, Kritis, Selesai, dan Tingkat Solusi.
  - Grafik Distribusi Status (*Doughnut Chart*) & Grafik Beban per Kategori (*Bar Chart*).
- **Ekspor CSV**: Unduh rekapitulasi data tiket ke format Excel / CSV.
- **Reset Demo**: Kembalikan data sampel kapan pun dibutuhkan.
