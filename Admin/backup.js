const BACKUP_COLLECTIONS = [
  "guru",
  "siswa",
  "siswa_lulus",
  "kelas",
  "mapel",
  "mapel_bayangan",
  "mengajar",
  "mengajar_bayangan",
  "tugas_tambahan",
  "guru_tugas_tambahan",
  "nilai",
  "kehadiran_siswa",
  "kehadiran_rekap_siswa",
  "users",
  "settings"
];

const CLEAN_COLLECTIONS = [...BACKUP_COLLECTIONS];

let selectedBackupRestoreFile = null;

function renderAdminBackupPage() {
  return `
    <section class="backup-page">
      <div class="nilai-page-head">
        <div>
          <span class="dashboard-eyebrow">Migrasi Data</span>
          <h2>Backup dan Restore</h2>
          <p>Unduh cadangan data sebelum memindahkan aplikasi atau memperbaiki data semester.</p>
        </div>
      </div>

      <div class="backup-grid">
        <article class="backup-panel">
          <h3>Backup</h3>
          <p>File backup berisi data utama, user, nilai, kehadiran, pengaturan, dan data per semester.</p>
          <div class="backup-actions">
            <button class="btn-primary" onclick="downloadFullBackup()">Download Backup JSON</button>
          </div>
          <div id="backupExportStatus" class="backup-status">Siap membuat backup.</div>
        </article>

        <article class="backup-panel backup-panel-danger">
          <h3>Restore</h3>
          <p>Restore akan menulis ulang dokumen yang ada di file backup. Gunakan hanya untuk migrasi atau pemulihan.</p>
          <label class="backup-file-picker">
            <span>Pilih file backup JSON</span>
            <input type="file" accept="application/json,.json" onchange="handleBackupRestoreFile(event)">
          </label>
          <div id="backupRestoreFileName" class="backup-status">Belum ada file dipilih.</div>
          <div class="backup-actions">
            <button class="btn-danger" onclick="restoreFullBackup()">Restore Backup</button>
          </div>
          <div id="backupRestoreStatus" class="backup-status">Restore membutuhkan password admin.</div>
        </article>
      </div>

      <section class="backup-panel backup-wide">
        <h3>Isi Backup</h3>
        <div class="backup-chip-list">
          ${BACKUP_COLLECTIONS.map(name => `<span>${escapeBackupHtml(name)}</span>`).join("")}
          <span>data semester/{semester}/siswa</span>
          <span>data semester/{semester}/kelas</span>
        </div>
      </section>

      <section class="backup-panel backup-panel-danger backup-wide">
        <h3>Reset Semua Data</h3>
        <p>
          Menghapus semua data yang dikenal aplikasi, termasuk data semester, nilai, siswa, guru, kelas, mapel,
          pembagian mengajar, user, dan pengaturan. Jalankan backup dulu sebelum memakai tombol ini.
        </p>
        <div class="backup-chip-list">
          <span>Dihapus: semua collection aplikasi</span>
          <span>Dihapus: mengajar</span>
          <span>Dihapus: mengajar_bayangan</span>
          <span>Dihapus: data semester/*/siswa</span>
          <span>Dihapus: data semester/*/kelas</span>
          <span>Dibersihkan: cache login lokal</span>
        </div>
        <div class="backup-actions">
          <button class="btn-danger" onclick="resetAllApplicationData()">Reset Semua Data</button>
        </div>
        <div id="backupCleanStatus" class="backup-status">Menunggu aksi admin.</div>
      </section>
    </section>
  `;
}

function escapeBackupHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setBackupStatus(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function serializeBackupValue(value) {
  if (!value || typeof value !== "object") return value;
  if (typeof value.toDate === "function") {
    return { __type: "timestamp", value: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeBackupValue);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeBackupValue(item)]));
}

function restoreBackupValue(value) {
  if (!value || typeof value !== "object") return value;
  if (value.__type === "timestamp" && value.value) {
    return firebase.firestore.Timestamp.fromDate(new Date(value.value));
  }
  if (Array.isArray(value)) return value.map(restoreBackupValue);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, restoreBackupValue(item)]));
}

async function readBackupCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    data: serializeBackupValue(doc.data())
  }));
}

function getBackupSemesterIds(settingsRows) {
  const semesterDoc = settingsRows.find(item => item.id === "semester")?.data || {};
  const ids = new Set();
  if (semesterDoc.active_id) ids.add(semesterDoc.active_id);
  if (semesterDoc.live_id) ids.add(semesterDoc.live_id);
  (semesterDoc.list || []).forEach(item => {
    if (item?.id) ids.add(item.id);
  });
  return [...ids].filter(Boolean);
}

async function readBackupSemesterData(semesterIds) {
  const result = {};
  for (const termId of semesterIds) {
    result[termId] = {
      siswa: await readBackupSemesterCollection(termId, "siswa"),
      kelas: await readBackupSemesterCollection(termId, "kelas")
    };
  }
  return result;
}

async function readBackupSemesterCollection(termId, collectionName) {
  const snapshot = await db.collection("semester_data").doc(termId).collection(collectionName).get();
  return snapshot.docs.map(doc => ({
    id: doc.id,
    data: serializeBackupValue(doc.data())
  }));
}

async function downloadFullBackup() {
  try {
    setBackupStatus("backupExportStatus", "Membaca data...");
    Swal.fire({ title: "Membuat backup...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    const collections = {};
    for (const name of BACKUP_COLLECTIONS) {
      setBackupStatus("backupExportStatus", `Membaca ${name}...`);
      collections[name] = await readBackupCollection(name);
    }
    const semesterIds = getBackupSemesterIds(collections.settings || []);
    const semesterData = await readBackupSemesterData(semesterIds);
    const payload = {
      app: "DATA SISWA",
      version: 1,
      exported_at: new Date().toISOString(),
      collections,
      semester_data: semesterData
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `backup-data-siswa-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupStatus("backupExportStatus", `Backup selesai. ${BACKUP_COLLECTIONS.length} collection dibaca.`);
    Swal.fire("Backup selesai", "File JSON sudah diunduh.", "success");
  } catch (error) {
    console.error(error);
    setBackupStatus("backupExportStatus", "Backup gagal.");
    Swal.fire("Backup gagal", error.message || "", "error");
  }
}

function handleBackupRestoreFile(event) {
  selectedBackupRestoreFile = event.target.files?.[0] || null;
  setBackupStatus(
    "backupRestoreFileName",
    selectedBackupRestoreFile ? `${selectedBackupRestoreFile.name} (${Math.ceil(selectedBackupRestoreFile.size / 1024)} KB)` : "Belum ada file dipilih."
  );
}

function readSelectedBackupFile() {
  return new Promise((resolve, reject) => {
    if (!selectedBackupRestoreFile) {
      reject(new Error("Pilih file backup JSON terlebih dahulu."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(new Error("File backup tidak valid."));
      }
    };
    reader.onerror = () => reject(new Error("File backup gagal dibaca."));
    reader.readAsText(selectedBackupRestoreFile);
  });
}

async function restoreFullBackup() {
  try {
    const payload = await readSelectedBackupFile();
    if (!payload?.collections || payload.app !== "DATA SISWA") {
      Swal.fire("File tidak cocok", "File ini bukan backup aplikasi Data Siswa.", "error");
      return;
    }

    const confirm = await Swal.fire({
      title: "Restore backup?",
      html: "Masukkan password admin. Dokumen dari file backup akan ditulis ulang ke Supabase.",
      input: "password",
      inputPlaceholder: "Password admin",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Restore",
      cancelButtonText: "Batal",
      inputValidator: value => !value ? "Password wajib diisi" : undefined
    });
    if (!confirm.isConfirmed) return;

    const validPassword = typeof verifyAdminSemesterPassword === "function"
      ? await verifyAdminSemesterPassword(confirm.value)
      : confirm.value === "admin123" || confirm.value === "kurikulumspenturi";
    if (!validPassword) {
      Swal.fire("Password salah", "Restore dibatalkan.", "error");
      return;
    }

    Swal.fire({ title: "Restore berjalan...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    let count = 0;
    for (const [collectionName, rows] of Object.entries(payload.collections || {})) {
      setBackupStatus("backupRestoreStatus", `Restore ${collectionName}...`);
      count += await writeBackupCollection(collectionName, rows);
    }
    for (const [termId, termData] of Object.entries(payload.semester_data || {})) {
      count += await writeBackupSemesterCollection(termId, "siswa", termData.siswa || []);
      count += await writeBackupSemesterCollection(termId, "kelas", termData.kelas || []);
    }
    setBackupStatus("backupRestoreStatus", `Restore selesai. ${count} dokumen ditulis.`);
    await Swal.fire("Restore selesai", `${count} dokumen ditulis. Silakan logout dan login ulang.`, "success");
  } catch (error) {
    console.error(error);
    setBackupStatus("backupRestoreStatus", "Restore gagal.");
    Swal.fire("Restore gagal", error.message || "", "error");
  }
}

async function writeBackupCollection(collectionName, rows = []) {
  let count = 0;
  for (let index = 0; index < rows.length; index += 450) {
    const batch = db.batch();
    rows.slice(index, index + 450).forEach(row => {
      if (!row?.id) return;
      count++;
      batch.set(db.collection(collectionName).doc(row.id), restoreBackupValue(row.data || {}));
    });
    await batch.commit();
  }
  return count;
}

async function writeBackupSemesterCollection(termId, collectionName, rows = []) {
  let count = 0;
  for (let index = 0; index < rows.length; index += 450) {
    const batch = db.batch();
    rows.slice(index, index + 450).forEach(row => {
      if (!row?.id) return;
      count++;
      batch.set(
        db.collection("semester_data").doc(termId).collection(collectionName).doc(row.id),
        restoreBackupValue(row.data || {})
      );
    });
    await batch.commit();
  }
  return count;
}

async function resetAllApplicationData() {
  const settingsRows = await readBackupCollection("settings").catch(() => []);
  const semesterIds = getBackupSemesterIds(settingsRows);
  const confirmText = "HAPUS DATA";

  const confirm = await Swal.fire({
    title: "Reset semua data?",
    html: `
      <p>Aksi ini akan menghapus semua data aplikasi, termasuk siswa, guru, kelas, mapel, nilai, kehadiran, pembagian mengajar, user, settings, dan data per semester.</p>
      <p>Setelah selesai, aplikasi kembali kosong dan login memakai fallback admin.</p>
      <p>Ketik <b>${confirmText}</b> untuk melanjutkan.</p>
    `,
    input: "text",
    inputPlaceholder: confirmText,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Lanjut",
    cancelButtonText: "Batal",
    inputValidator: value => value !== confirmText ? `Ketik ${confirmText} dengan benar` : undefined
  });
  if (!confirm.isConfirmed) return;

  const password = await Swal.fire({
    title: "Password admin",
    input: "password",
    inputPlaceholder: "Password admin",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal",
    inputValidator: value => !value ? "Password wajib diisi" : undefined
  });
  if (!password.isConfirmed) return;

  const validPassword = typeof verifyAdminSemesterPassword === "function"
    ? await verifyAdminSemesterPassword(password.value)
    : password.value === "admin123" || password.value === "kurikulumspenturi";
  if (!validPassword) {
    Swal.fire("Password salah", "Pembersihan dibatalkan.", "error");
    return;
  }

  try {
    Swal.fire({ title: "Membersihkan data...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    let deleted = 0;
    for (const collectionName of CLEAN_COLLECTIONS) {
      setBackupStatus("backupCleanStatus", `Menghapus ${collectionName}...`);
      deleted += await deleteBackupCollection(db.collection(collectionName));
    }
    for (const termId of semesterIds) {
      setBackupStatus("backupCleanStatus", `Menghapus data semester ${termId}...`);
      deleted += await deleteBackupCollection(db.collection("semester_data").doc(termId).collection("siswa"));
      deleted += await deleteBackupCollection(db.collection("semester_data").doc(termId).collection("kelas"));
      await db.collection("semester_data").doc(termId).delete();
    }
    localStorage.clear();
    setBackupStatus("backupCleanStatus", `Selesai. ${deleted} dokumen dihapus. Cache lokal dibersihkan.`);
    await Swal.fire("Selesai", `${deleted} dokumen dihapus. Aplikasi siap diisi dari awal.`, "success");
    window.location.href = "login.html";
  } catch (error) {
    console.error(error);
    setBackupStatus("backupCleanStatus", "Pembersihan gagal.");
    Swal.fire("Pembersihan gagal", error.message || "", "error");
  }
}

async function deleteBackupCollection(collectionRef) {
  let count = 0;
  while (true) {
    const snapshot = await collectionRef.limit(450).get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      count++;
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
  return count;
}
