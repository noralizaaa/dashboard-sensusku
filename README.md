# Sistem Pendataan Desa Pendem

Website dashboard pendataan desa berbasis web yang digunakan untuk mengelola, memantau, dan menganalisis data keluarga, penduduk, kesehatan, kondisi rumah, serta lokasi rumah warga secara real-time.

---

# Deskripsi Sistem

Sistem ini dikembangkan untuk membantu perangkat desa dalam melakukan pendataan warga secara digital dan terpusat.

Data yang tersimpan dapat digunakan untuk:

- Monitoring jumlah keluarga dan penduduk
- Monitoring balita, lansia, WUS, dan PUS
- Monitoring ibu hamil
- Monitoring penyakit kronis dan disabilitas
- Monitoring aktivitas posyandu
- Monitoring kondisi rumah warga
- Menampilkan lokasi rumah warga pada peta
- Menghasilkan laporan dalam format CSV
- Menampilkan statistik secara real-time

---

# Fitur Utama

## 1. Dashboard Statistik

Menampilkan ringkasan data desa secara otomatis:

- Total KK
- Total Penduduk
- Total Balita
- Total Lansia
- Wanita Usia Subur (WUS)
- Pria Usia Subur (PUS)

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 2. Grafik Kategori Usia

Menampilkan distribusi penduduk berdasarkan kelompok usia:

- 0–5 tahun
- 6–12 tahun
- 13–17 tahun
- 18–25 tahun
- 26–45 tahun
- 46–59 tahun
- ≥60 tahun

Teknologi:

- Chart.js

Lokasi Implementasi:

```text
public/script.js
```

---

## 3. Grafik Jenis Kelamin

Menampilkan:

- Jumlah laki-laki
- Jumlah perempuan
- Persentase masing-masing kategori

Teknologi:

- Chart.js

Lokasi Implementasi:

```text
public/script.js
```

---

## 4. Rekap Kesehatan

Menampilkan:

- Ibu Hamil
- Posyandu Aktif
- Balita Pengguna Pampers
- Disabilitas
- Penyakit Kronis

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 5. Data Keluarga

Menampilkan tabel keluarga yang berisi:

- Nama Kepala Keluarga
- RT
- RW
- Jumlah Anggota
- Status Pendataan
- Kategori Keluarga
- Tanggal Input

Fitur:

- Pencarian data
- Detail keluarga
- Modal detail

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 6. Data Penduduk

Menampilkan:

- Total Penduduk
- Laki-laki
- Perempuan
- Balita
- Lansia

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 7. Rekap Rumah

Menampilkan informasi terkait rumah warga yang telah didata.

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 8. Peta Lokasi Rumah

Menampilkan lokasi rumah warga berdasarkan koordinat GPS.

Fitur:

- Marker lokasi rumah
- Popup informasi keluarga
- Peta penuh
- Integrasi Google Maps

Teknologi:

- Leaflet.js
- OpenStreetMap

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 9. Detail Data Warga

Menampilkan:

- Nama Kepala Keluarga
- Nomor KK
- RT/RW
- Alamat
- Jumlah Anggota
- Foto Rumah
- Lokasi Rumah

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 10. Sistem Notifikasi Real-Time

Memberikan notifikasi ketika terdapat perubahan data.

Teknologi:

- Socket.IO

Lokasi Implementasi:

```text
public/script.js
server.js
```

---

## 11. Filter Periode

Filter data berdasarkan:

- Bulan
- Tahun

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 12. Export Laporan

Mengunduh data pendataan dalam format CSV.

Jenis laporan:

- Laporan Lengkap
- Data Keluarga
- Data Penduduk
- Rekap Kesehatan
- Data Lokasi Rumah

Lokasi Implementasi:

```text
public/index.html
public/script.js
```

---

## 13. Sistem Realtime Dashboard

Dashboard akan diperbarui secara otomatis ketika data baru masuk.

Teknologi:

- Socket.IO

Lokasi Implementasi:

```text
public/script.js
server.js
```

---

# Teknologi yang Digunakan

## Frontend

- HTML5
- CSS3
- JavaScript (Vanilla JS)

## Backend

- Node.js
- Express.js

## Realtime

- Socket.IO

## Database

- JSON Local Storage

## Mapping

- Leaflet.js
- OpenStreetMap

## Visualisasi Data

- Chart.js

---

# Struktur Folder

```text
project/
│
├── data/
│   ├── submission_LOCAL_*.json
│   ├── submission_LOCAL_*.json
│   └── ...
│
├── node_modules/
│
├── public/
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── routes/
│
├── uploads/
│
├── xampp/
│
├── backup_server.js
├── db.js
├── package.json
├── package-lock.json
├── script_2.js
├── server.js
│
└── README.md
```

---

# Penjelasan Folder

## data/

Menyimpan seluruh data hasil pendataan warga dalam format JSON.

Contoh:

```text
submission_LOCAL_xxxxxxxxx.json
```

---

## public/

Berisi seluruh file frontend.

### index.html

Tampilan dashboard utama.

### script.js

Seluruh logika frontend:

- Load data
- Statistik
- Grafik
- Filter
- Pencarian
- Modal
- Export CSV
- Peta
- Notifikasi

### style.css

Seluruh styling dashboard.

---

## routes/

Berisi endpoint API Express.

Contoh:

```text
GET /api/submissions
GET /api/submissions/:id
```

---

## uploads/

Menyimpan file upload dari pengguna.

Contoh:

- Foto rumah
- Dokumen pendukung

---

## db.js

Utility untuk membaca dan menyimpan data JSON.

---

## server.js

Server utama aplikasi.

Fungsi:

- Menjalankan Express Server
- Menyediakan API
- Socket.IO
- Pengiriman data dashboard

---

## backup_server.js

Backup server apabila terjadi perubahan atau kerusakan pada server utama.

---

# Instalasi

## 1. Clone Repository

```bash
git clone https://github.com/username/repository.git
```

## 2. Masuk Folder Project

```bash
cd repository
```

## 3. Install Dependency

```bash
npm install
```

## 4. Jalankan Server

```bash
node server.js
```

atau

```bash
npm start
```

---

# Menjalankan Secara Lokal

Buka browser:

```text
http://localhost:3000
```

atau port yang digunakan pada server.

---

# API Endpoint

## Ambil Semua Data

```http
GET /api/submissions
```

Parameter:

```text
period=YYYY-MM
```

Contoh:

```http
GET /api/submissions?period=2026-06
```

---

## Ambil Detail Data

```http
GET /api/submissions/:id
```

Contoh:

```http
GET /api/submissions/12345
```

---

# Alur Sistem

```text
Petugas Pendataan
        │
        ▼
    Input Data
        │
        ▼
     File JSON
        │
        ▼
    Node.js API
        │
        ▼
 Dashboard Web
        │
        ├── Statistik
        ├── Grafik
        ├── Kesehatan
        ├── Rumah
        ├── Lokasi
        └── Laporan
```

---

# Screenshot Sistem

## Dashboard Utama

Tambahkan screenshot dashboard pada folder:

```text
screenshots/dashboard.png
```

Contoh:

```md
![Dashboard](screenshots/dashboard.png)
```

---

# Pengembangan Selanjutnya

Rencana pengembangan:

- Login Admin Desa
- Hak akses berdasarkan role
- Integrasi Firebase
- Integrasi Database MySQL
- Export PDF
- Export Excel
- PWA (Progressive Web App)
- Dashboard RT/RW
- Dashboard Kecamatan
- Dashboard Kabupaten

---

# Author

Noraliza Putri Nabila
Nur Fitrah Wahyuni
Felda Mufarihati

Program Studi Teknik Informatika

Universitas Muhammadiyah Malang

---

# License

Proyek ini dibuat untuk keperluan penelitian, pengabdian masyarakat, dan pengembangan sistem informasi desa.
