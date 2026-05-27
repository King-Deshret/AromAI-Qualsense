# Dokumen Persyaratan — AromAI QC Platform

## Pendahuluan

AromAI QC adalah platform kontrol kualitas berbasis AI dua tahap untuk Sima Arome, produsen ekstrak alami. Platform ini memungkinkan operator membuat inspeksi bahan baku dan bubuk ekstrak, memanfaatkan layanan AI eksternal untuk deteksi cacat otomatis dan penilaian warna, serta menyediakan alur kerja peninjauan bagi manajer QC untuk lot yang ditandai.

Platform terdiri dari dua unit: Aplikasi BuildPad (platform utama: UI, data, RBAC, workflow, notifikasi) dan Microservice AI FastAPI (inferensi YOLOv11 dan analisis warna OpenCV).

## Glosarium

- **Platform**: Aplikasi AromAI QC BuildPad termasuk frontend Next.js dan backend DaaS
- **AI_Service**: Microservice FastAPI eksternal yang melakukan inspeksi kualitas berbasis gambar
- **Operator**: Pekerja lantai yang membuat lot, mengunggah gambar inspeksi, dan melihat hasil sendiri
- **QC_Manager**: Supervisor yang meninjau lot bermasalah, menyetujui/menolak, melihat semua hasil
- **Admin**: Administrator sistem dengan semua izin termasuk manajemen pengguna dan konfigurasi
- **Lot**: Batch bahan baku atau bubuk ekstrak yang dilacak melalui state machine siklus hidup
- **Inspeksi**: Pemeriksaan kualitas pada lot melalui unggah gambar dan analisis AI
- **Review**: Keputusan QC_Manager (setuju atau tolak) pada inspeksi yang ditandai
- **Grade**: Klasifikasi kualitas dari AI_Service: A, B, C, D, atau F (A tertinggi)
- **Confidence_Score**: Nilai desimal 0.0-1.0 yang mewakili kepastian AI dalam penilaian
- **QC_Threshold**: Parameter konfigurasi per jenis material untuk batas kelulusan
- **Lot_Number**: Identifikasi unik format LOT-YYYYMMDD-XXXX (XXXX counter harian)
- **State_Machine**: Kumpulan status lot dan transisi valid yang mengatur siklus hidup
- **Material_Type**: Klasifikasi lot: RAW_FRUIT, RAW_BOTANICAL, atau EXTRACT_POWDER

---

## Persyaratan

### Persyaratan 1: Registrasi Lot

**User Story:** Sebagai Operator, saya ingin mendaftarkan lot bahan baku baru, agar lot tersebut masuk ke pipeline kontrol kualitas.

#### Kriteria Penerimaan

1. KETIKA Operator mengirimkan registrasi lot baru, Platform HARUS membuat record lot dengan status PENDING_QC, Lot_Number unik format LOT-YYYYMMDD-XXXX, dan Operator dicatat sebagai created_by
2. Platform HARUS menghasilkan Lot_Number secara otomatis dengan menggabungkan tanggal (YYYYMMDD) dan counter sequential zero-padded (XXXX) yang reset setiap hari
3. KETIKA Operator mengirimkan registrasi lot, Platform HARUS mewajibkan field: material_type, material_name, supplier_name, dan quantity_kg
4. Platform HARUS memvalidasi bahwa quantity_kg adalah angka desimal positif
5. JIKA registrasi lot gagal validasi, MAKA Platform HARUS mengembalikan pesan error deskriptif

### Persyaratan 2: Pembuatan Inspeksi dan Unggah Gambar

**User Story:** Sebagai Operator, saya ingin mengunggah gambar lot untuk inspeksi AI, agar lot menerima grade kualitas otomatis.

#### Kriteria Penerimaan

1. KETIKA Operator memulai inspeksi untuk lot berstatus PENDING_QC, Platform HARUS mentransisi status lot ke QC_IN_PROGRESS dan membuat record inspeksi dengan status PENDING
2. KETIKA Operator mengunggah gambar inspeksi, Platform HARUS memvalidasi: format JPEG/PNG/WebP, ukuran maksimal 10 MB, dimensi minimal 640x480 piksel, dimensi maksimal 4096x3072 piksel
3. JIKA gambar gagal validasi, MAKA Platform HARUS menolak unggahan dan mengembalikan error spesifik
4. KETIKA gambar valid diunggah, Platform HARUS menyimpan gambar via DaaS Files API dan mencatat image_url pada inspeksi
5. Platform HARUS menetapkan inspection_type berdasarkan material_type lot: RAW_MATERIAL untuk RAW_FRUIT dan RAW_BOTANICAL, POWDER untuk EXTRACT_POWDER
6. KETIKA record inspeksi dibuat dengan gambar tersimpan, Platform HARUS mengirim gambar ke AI_Service dan mentransisi status inspeksi ke PROCESSING

### Persyaratan 3: Integrasi AI Service

**User Story:** Sebagai Operator, saya ingin platform menganalisis gambar secara otomatis menggunakan AI, agar saya menerima grade kualitas objektif.

#### Kriteria Penerimaan

1. KETIKA inspection_type adalah RAW_MATERIAL, Platform HARUS memanggil endpoint AI_Service POST /api/inspect/fruit
2. KETIKA inspection_type adalah POWDER, Platform HARUS memanggil endpoint AI_Service POST /api/inspect/powder
3. KETIKA AI_Service mengembalikan respons sukses, Platform HARUS mencatat ai_grade, ai_confidence, ai_details, defects_found (untuk fruit), dan color_score (untuk powder) lalu mentransisi status inspeksi ke COMPLETED
4. JIKA AI_Service mengembalikan error atau tidak dapat dijangkau, MAKA Platform HARUS mentransisi status inspeksi ke ERROR, mencatat detail kegagalan, dan mengirim notifikasi ke semua Admin
5. Platform HARUS menyertakan mekanisme health check yang memanggil GET /api/health pada AI_Service

### Persyaratan 4: Penilaian Lot Otomatis Berdasarkan Threshold

**User Story:** Sebagai Operator, saya ingin sistem menentukan kelulusan/kegagalan lot secara otomatis berdasarkan threshold yang dapat dikonfigurasi.

#### Kriteria Penerimaan

1. KETIKA inspeksi selesai dengan status COMPLETED, Platform HARUS membandingkan ai_grade dan ai_confidence terhadap QC_Threshold yang dikonfigurasi untuk material_type lot tersebut
2. KETIKA ai_grade memenuhi atau melebihi pass_grade DAN ai_confidence memenuhi atau melebihi min_confidence, Platform HARUS mentransisi status lot ke QC_PASSED
3. KETIKA ai_grade di bawah pass_grade ATAU ai_confidence di bawah min_confidence, Platform HARUS mentransisi status lot ke QC_FAILED
4. KETIKA lot bertransisi ke QC_FAILED, Platform HARUS segera auto-eskalasi ke status MANAGER_REVIEW dan mengirim notifikasi ke semua QC_Manager
5. Platform HARUS menggunakan nilai default QC_Threshold: min_confidence 0.70, pass_grade C, max_color_delta 15.0

### Persyaratan 5: Alur Kerja Review Manager

**User Story:** Sebagai QC_Manager, saya ingin meninjau lot bermasalah dan membuat keputusan setuju/tolak dengan alasan terdokumentasi.

#### Kriteria Penerimaan

1. SELAMA lot berstatus MANAGER_REVIEW, Platform HARUS menampilkan lot di antrian review QC_Manager dengan detail inspeksi, grade AI, confidence score, dan gambar beranotasi
2. KETIKA QC_Manager menyetujui lot berstatus MANAGER_REVIEW, Platform HARUS mewajibkan catatan review minimal 10 karakter, membuat record review dengan keputusan APPROVED, dan mentransisi status lot ke APPROVED
3. KETIKA QC_Manager menolak lot berstatus MANAGER_REVIEW, Platform HARUS mewajibkan catatan review minimal 10 karakter, membuat record review dengan keputusan REJECTED, dan mentransisi status lot ke REJECTED
4. KETIKA lot bertransisi ke REJECTED, Platform HARUS segera auto-transisi lot ke status QUARANTINED
5. KETIKA lot disetujui atau ditolak, Platform HARUS mengirim notifikasi ke Operator yang membuat lot asli
6. KETIKA lot bertransisi ke QUARANTINED, Platform HARUS mengirim notifikasi ke semua Admin

### Persyaratan 6: Kontrol Akses Berbasis Peran (RBAC)

**User Story:** Sebagai Admin, saya ingin platform menerapkan izin berbasis peran, agar pengguna hanya mengakses fungsionalitas sesuai perannya.

#### Kriteria Penerimaan

1. Platform HARUS menerapkan tiga peran: OPERATOR, QC_MANAGER, dan ADMIN dengan izin hierarkis
2. Platform HARUS membatasi Operator untuk: membuat lot, membuat inspeksi, mengunggah gambar, dan melihat lot/hasil inspeksi milik sendiri saja
3. Platform HARUS membatasi QC_Manager untuk: meninjau lot bermasalah, menyetujui/menolak, melihat semua lot/hasil, mengekspor laporan, dan mengakses dashboard analytics
4. Platform HARUS membatasi fungsi Admin (manajemen pengguna, konfigurasi sistem, manajemen QC_Threshold, akses audit log) hanya untuk pengguna dengan peran ADMIN
5. JIKA pengguna mencoba aksi yang tidak diizinkan oleh perannya, MAKA Platform HARUS menolak permintaan dan mengembalikan error otorisasi

### Persyaratan 7: Penegakan State Machine Siklus Hidup Lot

**User Story:** Sebagai pemangku kepentingan sistem, saya ingin platform menegakkan transisi status yang valid untuk lot.

#### Kriteria Penerimaan

1. Platform HARUS menegakkan transisi status lot yang valid: PENDING_QC→QC_IN_PROGRESS, QC_IN_PROGRESS→QC_PASSED, QC_IN_PROGRESS→QC_FAILED, QC_FAILED→MANAGER_REVIEW, MANAGER_REVIEW→APPROVED, MANAGER_REVIEW→REJECTED, REJECTED→QUARANTINED
2. JIKA transisi status yang tidak valid dicoba, MAKA Platform HARUS menolak transisi dan mengembalikan error
3. Platform HARUS mencatat timestamp setiap transisi status pada record lot
4. Platform HARUS mencatat pengguna yang memicu setiap transisi status di audit log

### Persyaratan 8: Pencatatan Audit

**User Story:** Sebagai Admin, saya ingin semua tindakan signifikan dicatat dalam audit log untuk kepatuhan dan penelusuran masalah.

#### Kriteria Penerimaan

1. Platform HARUS memanfaatkan pencatatan aktivitas bawaan DaaS untuk semua mutasi item
2. KETIKA transisi status lot terjadi, Platform HARUS mencatat user_id, aksi, entity_type, entity_id, detail transisi, dan timestamp
3. KETIKA Admin mengakses audit log, Platform HARUS menampilkan entri dengan filter berdasarkan pengguna, jenis aksi, jenis entitas, dan rentang tanggal
4. Platform HARUS menyimpan entri audit log tanpa batas waktu tanpa penghapusan otomatis

### Persyaratan 9: Konfigurasi QC Threshold

**User Story:** Sebagai Admin, saya ingin mengkonfigurasi threshold kualitas per jenis material.

#### Kriteria Penerimaan

1. KETIKA Admin memperbarui QC_Threshold, Platform HARUS mengizinkan modifikasi min_confidence, pass_grade, dan max_color_delta untuk setiap material_type secara independen
2. Platform HARUS memvalidasi: min_confidence desimal 0.0-1.0, pass_grade salah satu dari A/B/C/D/F, max_color_delta desimal positif
3. KETIKA QC_Threshold diperbarui, Platform HARUS mencatat Admin yang melakukan perubahan dan timestamp
4. Platform HARUS menerapkan threshold yang diperbarui hanya pada inspeksi berikutnya tanpa mempengaruhi inspeksi yang sudah selesai

### Persyaratan 10: Dashboard dan Analitik

**User Story:** Sebagai QC_Manager, saya ingin dashboard yang menampilkan metrik dan tren kontrol kualitas.

#### Kriteria Penerimaan

1. KETIKA QC_Manager mengakses dashboard, Platform HARUS menampilkan: total lot per status, tingkat kelulusan/kegagalan, rata-rata confidence score, dan lot menunggu review
2. KETIKA Operator mengakses dashboard, Platform HARUS menampilkan hanya metrik terkait lot dan inspeksi milik Operator tersebut
3. KETIKA Admin mengakses dashboard, Platform HARUS menampilkan semua metrik QC_Manager ditambah indikator kesehatan sistem termasuk status ketersediaan AI_Service
4. Platform HARUS memperbarui metrik dashboard secara near real-time saat status lot berubah

### Persyaratan 11: Sistem Notifikasi

**User Story:** Sebagai pengguna platform, saya ingin menerima notifikasi tepat waktu tentang event kualitas yang relevan dengan peran saya.

#### Kriteria Penerimaan

1. KETIKA lot bertransisi ke QC_FAILED, Platform HARUS mengirim notifikasi in-app dan email ke semua QC_Manager
2. KETIKA lot disetujui atau ditolak, Platform HARUS mengirim notifikasi in-app ke Operator yang membuat lot
3. KETIKA lot bertransisi ke QUARANTINED, Platform HARUS mengirim notifikasi in-app dan email ke semua Admin
4. JIKA AI_Service mengembalikan error atau tidak dapat dijangkau, MAKA Platform HARUS mengirim notifikasi in-app dan email ke semua Admin
5. Platform HARUS mengirim email ringkasan harian ke semua QC_Manager berisi jumlah lot yang diinspeksi, lulus, gagal, dan menunggu review hari itu

### Persyaratan 12: Hasil Inspeksi dan Pelaporan

**User Story:** Sebagai QC_Manager, saya ingin melihat, memfilter, dan mengekspor hasil inspeksi untuk analisis tren dan laporan kepatuhan.

#### Kriteria Penerimaan

1. KETIKA pengguna mengakses daftar hasil inspeksi, Platform HARUS menampilkan inspeksi dengan filter: nomor lot, jenis material, grade, status, rentang tanggal, dan inspektor
2. KETIKA pengguna memilih inspeksi, Platform HARUS menampilkan detail lengkap: gambar asli, gambar beranotasi, grade, confidence, defects, analisis warna, dan riwayat review
3. KETIKA QC_Manager meminta ekspor laporan, Platform HARUS menghasilkan file yang dapat diunduh berisi data inspeksi yang difilter
4. Platform HARUS membatasi Operator untuk melihat hanya inspeksi yang mereka buat, sementara QC_Manager dan Admin dapat melihat semua inspeksi

### Persyaratan 13: Manajemen Pengguna

**User Story:** Sebagai Admin, saya ingin mengelola akun pengguna dan penetapan peran.

#### Kriteria Penerimaan

1. KETIKA Admin membuat pengguna baru, Platform HARUS mewajibkan email, nama, dan peran (OPERATOR, QC_MANAGER, atau ADMIN)
2. KETIKA Admin memperbarui pengguna, Platform HARUS mengizinkan modifikasi nama, peran, dan status is_active
3. KETIKA Admin menonaktifkan pengguna, Platform HARUS mencegah pengguna tersebut login sambil mempertahankan data historis dan jejak audit
4. Platform HARUS menegakkan alamat email unik di semua akun pengguna

### Persyaratan 14: Antarmuka Pengambilan dan Unggah Gambar

**User Story:** Sebagai Operator, saya ingin mengambil gambar langsung dari kamera perangkat atau mengunggah dari file.

#### Kriteria Penerimaan

1. KETIKA Operator memulai inspeksi, Platform HARUS menyediakan opsi pengambilan kamera dan opsi unggah file
2. KETIKA Operator menggunakan pengambilan kamera, Platform HARUS mengakses kamera perangkat, menampilkan preview langsung, dan mengizinkan Operator mengambil foto
3. KETIKA Operator menggunakan unggah file, Platform HARUS menerima drag-and-drop atau pemilihan file browser
4. Platform HARUS menampilkan preview gambar yang diambil/dipilih sebelum pengiriman dan mengizinkan pengambilan ulang atau pemilihan ulang

### Persyaratan 15: Autentikasi dan Manajemen Sesi

**User Story:** Sebagai pengguna platform, saya ingin autentikasi aman dengan manajemen sesi.

#### Kriteria Penerimaan

1. Platform HARUS mengautentikasi pengguna via Supabase Auth melalui route proxy server-side mengikuti pola autentikasi BuildPad
2. KETIKA pengguna memberikan kredensial valid, Platform HARUS membuat sesi terotentikasi dan mengarahkan ke tampilan dashboard sesuai peran
3. JIKA pengguna memberikan kredensial tidak valid, MAKA Platform HARUS menampilkan pesan error tanpa mengungkapkan apakah email atau password yang salah
4. KETIKA sesi pengguna berakhir atau pengguna logout, Platform HARUS menghapus semua data sesi dan mengarahkan ke halaman login
5. Platform HARUS menegakkan bahwa hanya pengguna dengan is_active bernilai true yang dapat berhasil login

---

## Algoritma

### A. Algoritma Sistem/Program

Algoritma berikut menggambarkan proses yang dijalankan secara otomatis oleh sistem tanpa intervensi pengguna.

---

#### A1. Algoritma Generate Lot Number

1. MULAI
2. Ambil tanggal hari ini dalam format YYYYMMDD
3. Query database untuk lot terakhir yang dibuat pada tanggal yang sama
4. JIKA tidak ada lot pada tanggal tersebut:
   - Set counter = 1
5. JIKA ada lot pada tanggal tersebut:
   - Ambil counter tertinggi dari lot terakhir
   - Set counter = counter tertinggi + 1
6. Format counter menjadi 4 digit zero-padded (XXXX)
7. Gabungkan: "LOT-" + YYYYMMDD + "-" + XXXX
8. Validasi bahwa Lot_Number belum ada di database
9. JIKA sudah ada, ulangi langkah 5-8
10. Kembalikan Lot_Number yang unik
11. SELESAI

---

#### A2. Algoritma Validasi Gambar

1. MULAI
2. Terima file gambar dari pengguna
3. Periksa format file (header/MIME type)
4. JIKA format bukan JPEG, PNG, atau WebP:
   - Kembalikan error "Format tidak didukung. Gunakan JPEG, PNG, atau WebP"
   - SELESAI
5. Periksa ukuran file
6. JIKA ukuran > 10 MB:
   - Kembalikan error "Ukuran file melebihi batas 10 MB"
   - SELESAI
7. Baca dimensi gambar (lebar x tinggi)
8. JIKA lebar < 640 ATAU tinggi < 480:
   - Kembalikan error "Dimensi minimal 640x480 piksel"
   - SELESAI
9. JIKA lebar > 4096 ATAU tinggi > 3072:
   - Kembalikan error "Dimensi maksimal 4096x3072 piksel"
   - SELESAI
10. Gambar valid, lanjutkan proses
11. SELESAI

---

#### A3. Algoritma Penentuan Inspection Type

1. MULAI
2. Ambil material_type dari lot yang akan diinspeksi
3. JIKA material_type = "RAW_FRUIT" ATAU material_type = "RAW_BOTANICAL":
   - Set inspection_type = "RAW_MATERIAL"
4. JIKA material_type = "EXTRACT_POWDER":
   - Set inspection_type = "POWDER"
5. Kembalikan inspection_type
6. SELESAI

---

#### A4. Algoritma Pemanggilan AI Service

1. MULAI
2. Ambil inspection_type dan image_url dari record inspeksi
3. JIKA inspection_type = "RAW_MATERIAL":
   - Set endpoint = POST /api/inspect/fruit
4. JIKA inspection_type = "POWDER":
   - Set endpoint = POST /api/inspect/powder
5. Kirim request HTTP POST ke AI_Service dengan gambar
6. Tunggu respons dengan timeout
7. JIKA respons sukses (HTTP 200):
   - Parse respons JSON
   - Simpan ai_grade, ai_confidence, ai_details ke record inspeksi
   - JIKA inspection_type = "RAW_MATERIAL": simpan defects_found
   - JIKA inspection_type = "POWDER": simpan color_score
   - Set status inspeksi = "COMPLETED"
8. JIKA respons error ATAU timeout:
   - Set status inspeksi = "ERROR"
   - Catat detail error di log
   - Kirim notifikasi ke semua Admin
9. SELESAI

---

#### A5. Algoritma Evaluasi Grade Terhadap Threshold

1. MULAI
2. Ambil ai_grade dan ai_confidence dari inspeksi yang COMPLETED
3. Ambil material_type dari lot terkait
4. Query QC_Threshold untuk material_type tersebut
5. Ambil pass_grade dan min_confidence dari threshold
6. Definisikan hierarki grade: A=5, B=4, C=3, D=2, F=1
7. Konversi ai_grade ke nilai numerik (grade_value)
8. Konversi pass_grade ke nilai numerik (pass_value)
9. JIKA grade_value >= pass_value DAN ai_confidence >= min_confidence:
   - Transisi status lot ke QC_PASSED
10. JIKA grade_value < pass_value ATAU ai_confidence < min_confidence:
    - Transisi status lot ke QC_FAILED
    - Jalankan Algoritma A6 (Auto-Eskalasi)
11. SELESAI

---

#### A6. Algoritma Auto-Eskalasi ke Manager Review

1. MULAI
2. Terima lot dengan status QC_FAILED
3. Transisi status lot ke MANAGER_REVIEW (segera, tanpa delay)
4. Catat transisi di audit log
5. Ambil daftar semua pengguna dengan peran QC_MANAGER
6. Untuk setiap QC_Manager:
   - Buat notifikasi in-app: "Lot [Lot_Number] memerlukan review"
   - Kirim email notifikasi dengan detail lot dan hasil inspeksi
7. SELESAI

---

#### A7. Algoritma Auto-Transisi ke Quarantined

1. MULAI
2. Terima lot dengan status REJECTED
3. Transisi status lot ke QUARANTINED (segera, tanpa delay)
4. Catat transisi di audit log
5. Ambil daftar semua pengguna dengan peran ADMIN
6. Untuk setiap Admin:
   - Buat notifikasi in-app: "Lot [Lot_Number] telah dikarantina"
   - Kirim email notifikasi dengan detail lot dan alasan penolakan
7. SELESAI

---

#### A8. Algoritma Validasi Transisi State Machine

1. MULAI
2. Terima: status_saat_ini, status_target
3. Definisikan tabel transisi valid:
   - PENDING_QC → [QC_IN_PROGRESS]
   - QC_IN_PROGRESS → [QC_PASSED, QC_FAILED]
   - QC_FAILED → [MANAGER_REVIEW]
   - MANAGER_REVIEW → [APPROVED, REJECTED]
   - REJECTED → [QUARANTINED]
   - QC_PASSED → [] (terminal)
   - APPROVED → [] (terminal)
   - QUARANTINED → [] (terminal)
4. Cari status_saat_ini di tabel transisi
5. JIKA status_target ada dalam daftar transisi valid untuk status_saat_ini:
   - Izinkan transisi
   - Catat timestamp transisi
   - Catat user_id di audit log
   - Kembalikan sukses
6. JIKA status_target TIDAK ada dalam daftar transisi valid:
   - Tolak transisi
   - Kembalikan error: "Transisi dari [status_saat_ini] ke [status_target] tidak valid"
7. SELESAI

---

#### A9. Algoritma Health Check AI Service

1. MULAI
2. Kirim request HTTP GET ke AI_Service /api/health
3. Tunggu respons dengan timeout 5 detik
4. JIKA respons sukses (HTTP 200):
   - Set ai_service_status = "AVAILABLE"
   - Catat timestamp terakhir sukses
5. JIKA respons error ATAU timeout:
   - Set ai_service_status = "UNAVAILABLE"
   - JIKA status sebelumnya = "AVAILABLE":
     - Kirim notifikasi ke semua Admin: "AI Service tidak tersedia"
6. Kembalikan ai_service_status
7. SELESAI

---

#### A10. Algoritma Pengiriman Notifikasi

1. MULAI
2. Terima: event_type, target_role, lot_data
3. Tentukan channel berdasarkan event_type:
   - QC_FAILED → in-app + email ke QC_MANAGER
   - APPROVED/REJECTED → in-app ke Operator pembuat lot
   - QUARANTINED → in-app + email ke ADMIN
   - AI_ERROR → in-app + email ke ADMIN
4. Query pengguna berdasarkan target_role dan is_active = true
5. Untuk setiap pengguna target:
   - JIKA channel termasuk "in-app":
     - Buat record notifikasi in-app dengan pesan dan link ke lot
   - JIKA channel termasuk "email":
     - Kirim email dengan template sesuai event_type
6. SELESAI

---

#### A11. Algoritma Daily Summary Email

1. MULAI (dipicu oleh cron job setiap hari pukul 23:59)
2. Ambil tanggal hari ini
3. Query semua inspeksi yang dibuat pada tanggal hari ini
4. Hitung: total_inspected, total_passed, total_failed, total_pending_review
5. Ambil daftar semua pengguna dengan peran QC_MANAGER dan is_active = true
6. Untuk setiap QC_Manager:
   - Compose email dengan template ringkasan harian
   - Isi data: tanggal, total_inspected, total_passed, total_failed, total_pending_review
   - Kirim email
7. SELESAI

---

### B. Algoritma Pengguna (User Algorithms)

Algoritma berikut menggambarkan alur interaksi pengguna dengan sistem langkah demi langkah.

---

#### B1. Algoritma Pengguna: Login

1. MULAI
2. Pengguna membuka halaman login (/login)
3. Pengguna memasukkan email dan password
4. Pengguna menekan tombol "Login"
5. Sistem memvalidasi kredensial via Supabase Auth
6. JIKA kredensial valid DAN is_active = true:
   - Sistem membuat sesi
   - Sistem mengarahkan ke dashboard sesuai peran
7. JIKA kredensial tidak valid ATAU is_active = false:
   - Sistem menampilkan pesan error generik
   - Pengguna kembali ke langkah 3
8. SELESAI

---

#### B2. Algoritma Pengguna: Operator Mendaftarkan Lot Baru

1. MULAI
2. Operator login ke sistem (lihat B1)
3. Operator navigasi ke halaman "New Inspection" (/inspect)
4. Operator mengisi form registrasi lot:
   - Pilih material_type (RAW_FRUIT / RAW_BOTANICAL / EXTRACT_POWDER)
   - Masukkan material_name
   - Masukkan supplier_name
   - Masukkan quantity_kg
5. Operator menekan tombol "Daftarkan Lot"
6. Sistem memvalidasi input
7. JIKA validasi gagal:
   - Sistem menampilkan pesan error pada field yang bermasalah
   - Operator memperbaiki input, kembali ke langkah 5
8. JIKA validasi berhasil:
   - Sistem membuat lot dengan status PENDING_QC
   - Sistem menampilkan Lot_Number yang dihasilkan
   - Sistem menampilkan opsi untuk langsung memulai inspeksi
9. SELESAI

---

#### B3. Algoritma Pengguna: Operator Melakukan Inspeksi

1. MULAI
2. Operator memilih lot berstatus PENDING_QC
3. Operator menekan tombol "Mulai Inspeksi"
4. Sistem menampilkan antarmuka pengambilan gambar:
   - Opsi A: Kamera (live preview)
   - Opsi B: Unggah file (drag-and-drop atau file browser)
5. JIKA Operator memilih Kamera:
   - Sistem mengaktifkan kamera perangkat
   - Operator melihat preview langsung
   - Operator menekan tombol "Ambil Foto"
   - Sistem menangkap gambar
6. JIKA Operator memilih Unggah File:
   - Operator memilih file dari perangkat
7. Sistem menampilkan preview gambar
8. Operator memeriksa preview:
   - JIKA tidak puas: menekan "Ambil Ulang" → kembali ke langkah 4
   - JIKA puas: menekan "Kirim untuk Inspeksi"
9. Sistem memvalidasi gambar (format, ukuran, dimensi)
10. JIKA validasi gagal:
    - Sistem menampilkan error spesifik
    - Operator kembali ke langkah 4
11. JIKA validasi berhasil:
    - Sistem menyimpan gambar
    - Sistem mentransisi lot ke QC_IN_PROGRESS
    - Sistem mengirim gambar ke AI_Service
    - Sistem menampilkan indikator "Sedang diproses..."
12. KETIKA AI_Service mengembalikan hasil:
    - Sistem menampilkan grade, confidence, dan detail hasil
    - Sistem menampilkan gambar beranotasi (jika tersedia)
13. SELESAI

---

#### B4. Algoritma Pengguna: QC_Manager Meninjau Lot

1. MULAI
2. QC_Manager login ke sistem (lihat B1)
3. QC_Manager navigasi ke halaman "Review Queue" (/reviews)
4. Sistem menampilkan daftar lot berstatus MANAGER_REVIEW
5. QC_Manager memilih lot untuk ditinjau
6. Sistem menampilkan detail inspeksi:
   - Gambar asli dan gambar beranotasi
   - Grade AI dan confidence score
   - Detail defects/color analysis
   - Informasi lot (material, supplier, quantity)
7. QC_Manager mengevaluasi hasil
8. QC_Manager memilih keputusan:
   - Opsi A: "Setujui" (APPROVE)
   - Opsi B: "Tolak" (REJECT)
9. Sistem menampilkan field catatan review (wajib)
10. QC_Manager memasukkan catatan (minimal 10 karakter)
11. JIKA catatan < 10 karakter:
    - Sistem menampilkan error "Catatan minimal 10 karakter"
    - QC_Manager memperbaiki catatan, kembali ke langkah 10
12. QC_Manager menekan tombol konfirmasi
13. JIKA keputusan = APPROVE:
    - Sistem mentransisi lot ke APPROVED
    - Sistem mengirim notifikasi ke Operator pembuat lot
14. JIKA keputusan = REJECT:
    - Sistem mentransisi lot ke REJECTED
    - Sistem auto-transisi lot ke QUARANTINED
    - Sistem mengirim notifikasi ke Operator pembuat lot
    - Sistem mengirim notifikasi ke semua Admin
15. Sistem menampilkan konfirmasi keputusan
16. QC_Manager kembali ke daftar review queue
17. SELESAI

---

#### B5. Algoritma Pengguna: Admin Mengelola Pengguna

1. MULAI
2. Admin login ke sistem (lihat B1)
3. Admin navigasi ke halaman "User Management" (/users)
4. Sistem menampilkan daftar semua pengguna
5. Admin memilih aksi:
   - Opsi A: Buat pengguna baru → langkah 6
   - Opsi B: Edit pengguna → langkah 10
   - Opsi C: Nonaktifkan pengguna → langkah 13
6. [BUAT PENGGUNA BARU]
7. Admin mengisi form: email, nama, peran
8. Admin menekan "Simpan"
9. JIKA email sudah ada: tampilkan error, kembali ke langkah 7
10. JIKA valid: buat pengguna, tampilkan konfirmasi → SELESAI
11. [EDIT PENGGUNA]
12. Admin mengubah nama, peran, atau status
13. Admin menekan "Simpan" → sistem memperbarui record → SELESAI
14. [NONAKTIFKAN PENGGUNA]
15. Admin menekan "Nonaktifkan" pada pengguna
16. Sistem menampilkan konfirmasi: "Pengguna tidak akan bisa login"
17. Admin mengkonfirmasi
18. Sistem set is_active = false
19. SELESAI

---

#### B6. Algoritma Pengguna: Admin Mengkonfigurasi QC Threshold

1. MULAI
2. Admin login ke sistem (lihat B1)
3. Admin navigasi ke halaman "Settings" (/settings)
4. Sistem menampilkan QC_Threshold saat ini untuk setiap material_type:
   - RAW_FRUIT: min_confidence, pass_grade, max_color_delta
   - RAW_BOTANICAL: min_confidence, pass_grade, max_color_delta
   - EXTRACT_POWDER: min_confidence, pass_grade, max_color_delta
5. Admin memilih material_type yang ingin diubah
6. Admin mengubah nilai threshold:
   - min_confidence (0.0 - 1.0)
   - pass_grade (A / B / C / D / F)
   - max_color_delta (angka positif)
7. Admin menekan "Simpan Perubahan"
8. Sistem memvalidasi input
9. JIKA validasi gagal:
   - Sistem menampilkan error pada field yang bermasalah
   - Admin memperbaiki input, kembali ke langkah 7
10. JIKA validasi berhasil:
    - Sistem menyimpan threshold baru
    - Sistem mencatat perubahan di audit log
    - Sistem menampilkan konfirmasi
11. SELESAI

---

#### B7. Algoritma Pengguna: QC_Manager Melihat Dashboard

1. MULAI
2. QC_Manager login ke sistem (lihat B1)
3. Sistem mengarahkan ke halaman Dashboard (/dashboard)
4. Sistem menampilkan metrik:
   - Kartu ringkasan: Total Lot, Lulus, Gagal, Menunggu Review
   - Grafik tren: Pass/Fail rate per hari/minggu/bulan
   - Rata-rata confidence score per material_type
   - Daftar lot yang memerlukan perhatian segera
5. QC_Manager dapat:
   - Klik kartu "Menunggu Review" → navigasi ke /reviews
   - Klik lot spesifik → navigasi ke detail lot
   - Ubah rentang waktu untuk grafik tren
6. SELESAI

---

#### B8. Algoritma Pengguna: Operator Melihat Hasil Inspeksi

1. MULAI
2. Operator login ke sistem (lihat B1)
3. Operator navigasi ke halaman "Inspection Results" (/results)
4. Sistem menampilkan daftar inspeksi milik Operator (hanya milik sendiri)
5. Operator dapat memfilter berdasarkan:
   - Nomor lot
   - Jenis material
   - Grade
   - Status
   - Rentang tanggal
6. Operator memilih inspeksi untuk melihat detail
7. Sistem menampilkan halaman detail (/results/:id):
   - Gambar asli dan gambar beranotasi
   - Grade dan confidence score
   - Detail defects atau color analysis
   - Status lot saat ini
   - Riwayat review (jika ada)
8. SELESAI

---

#### B9. Algoritma Pengguna: Admin Melihat Audit Log

1. MULAI
2. Admin login ke sistem (lihat B1)
3. Admin navigasi ke halaman "Audit Log" (/audit)
4. Sistem menampilkan daftar entri audit terbaru
5. Admin dapat memfilter berdasarkan:
   - Pengguna (siapa yang melakukan aksi)
   - Jenis aksi (create, update, delete, transition)
   - Jenis entitas (lot, inspection, review, user, threshold)
   - Rentang tanggal
6. Admin memilih entri untuk melihat detail
7. Sistem menampilkan detail lengkap:
   - Timestamp
   - Pengguna yang melakukan aksi
   - Aksi yang dilakukan
   - Entitas yang terpengaruh
   - Detail perubahan (before/after jika applicable)
   - IP address
8. SELESAI

---

#### B10. Algoritma Pengguna: QC_Manager Mengekspor Laporan

1. MULAI
2. QC_Manager login ke sistem (lihat B1)
3. QC_Manager navigasi ke halaman "Inspection Results" (/results)
4. QC_Manager menerapkan filter yang diinginkan:
   - Rentang tanggal
   - Jenis material
   - Grade
   - Status
5. QC_Manager menekan tombol "Ekspor"
6. Sistem menampilkan opsi format ekspor
7. QC_Manager memilih format
8. Sistem menghasilkan file berisi data inspeksi yang difilter
9. Sistem memulai unduhan file
10. SELESAI
