# Migrasi Supabase

## 1. Buat schema

Jalankan isi `supabase-schema.sql` di Supabase SQL Editor.

Schema ini memakai satu table dokumen generik, `app_documents`, agar kode aplikasi yang sebelumnya memakai pola Firestore seperti `db.collection("siswa").doc(nipd).set(data)` tetap bisa berjalan lewat adapter `supabase-firestore-compat.js`.

## 2. Isi konfigurasi

Edit `supabase-config.js`:

```js
window.supabaseConfig = {
  url: "https://PROJECT-REF.supabase.co",
  anonKey: "SUPABASE_ANON_PUBLIC_KEY",
  documentsTable: "app_documents"
};
```

Nilai `url` dan `anonKey` ada di Supabase Dashboard, menu Project Settings > API.

## 3. Migrasi data lama

Jika data lama masih ada di Firebase/Firestore, ekspor dulu lewat menu Admin > Backup & Restore pada versi lama aplikasi. Setelah Supabase aktif, buka aplikasi versi baru lalu gunakan menu yang sama untuk restore file JSON backup tersebut.

## Catatan keamanan

Karena aplikasi ini masih berupa static HTML tanpa Supabase Auth, policy di `supabase-schema.sql` membuka akses `anon` agar perilaku aplikasi lama tetap jalan. Untuk produksi, sebaiknya lanjutkan migrasi berikutnya ke Supabase Auth dan Row Level Security yang lebih ketat.
