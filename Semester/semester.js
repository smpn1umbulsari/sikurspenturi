let semesterAdminState = {
  active_id: "20252026_genap",
  live_id: "20252026_genap",
  semester: "GENAP",
  tahun: "2025/2026",
  list: []
};
let unsubscribeAdminSemesterSettings = null;

function getDefaultSemesterContext() {
  return {
    id: "20252026_genap",
    semester: "GENAP",
    tahun: "2025/2026",
    label: "GENAP - 2025/2026",
    legacy: true,
    is_active: true
  };
}

function normalizeSemesterText(value) {
  const text = String(value || "").trim().toUpperCase();
  return text === "GANJIL" ? "GANJIL" : "GENAP";
}

function normalizeTahunPelajaran(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function makeSemesterId(semester, tahun) {
  return `${normalizeTahunPelajaran(tahun).replace(/[^0-9]/g, "")}_${normalizeSemesterText(semester).toLowerCase()}`;
}

function makeSemesterLabel(semester, tahun) {
  return `${normalizeSemesterText(semester)} - ${normalizeTahunPelajaran(tahun) || "-"}`;
}

function getActiveSemesterContext() {
  try {
    const stored = JSON.parse(localStorage.getItem("appSemester") || "null");
    if (stored?.id) return stored;
  } catch {
    // keep default fallback
  }
  return getDefaultSemesterContext();
}

function getActiveTermId() {
  return getActiveSemesterContext().id || "legacy";
}

function isLegacySemesterActive() {
  return getActiveTermId() === "legacy";
}

function isActiveTermDoc(item = {}) {
  const active = getActiveSemesterContext();
  if (!item.term_id) return active.legacy === true || active.id === "legacy";
  return String(item.term_id || "") === String(active.id || "");
}

function getLiveSemesterId(settings = semesterAdminState) {
  const list = getSemesterSettingsList(settings);
  return [...list].sort(compareSemesterEntries).at(-1)?.id || settings.live_id || getDefaultSemesterContext().id;
}

function compareSemesterEntries(a, b) {
  const yearA = Number(String(a?.tahun || "").match(/\d{4}/)?.[0] || 0);
  const yearB = Number(String(b?.tahun || "").match(/\d{4}/)?.[0] || 0);
  if (yearA !== yearB) return yearA - yearB;
  const order = { GANJIL: 1, GENAP: 2 };
  return (order[normalizeSemesterText(a?.semester)] || 0) - (order[normalizeSemesterText(b?.semester)] || 0);
}

function shouldUseSemesterSnapshot() {
  const active = getActiveSemesterContext();
  return Boolean(active.id && active.id !== "legacy");
}

function getSemesterCollectionRef(collectionName, termId = getActiveTermId()) {
  if (termId && termId !== "legacy") {
    return db.collection("semester_data").doc(termId).collection(collectionName);
  }
  return db.collection(collectionName);
}

function getSemesterDocRef(collectionName, docId, termId = getActiveTermId()) {
  return getSemesterCollectionRef(collectionName, termId).doc(docId);
}

function getSemesterCollectionQuery(collectionName, orderField = "") {
  const ref = getSemesterCollectionRef(collectionName);
  return orderField ? ref.orderBy(orderField) : ref;
}

function getSemesterSettingsList(settings = semesterAdminState) {
  const list = Array.isArray(settings.list) ? settings.list : [];
  if (list.length > 0) return list;
  return [getDefaultSemesterContext()];
}

function getNextSemesterContext(current = semesterAdminState) {
  const semester = normalizeSemesterText(current.semester);
  const tahun = normalizeTahunPelajaran(current.tahun || "2025/2026");
  if (semester === "GANJIL") {
    return {
      id: makeSemesterId("GENAP", tahun),
      semester: "GENAP",
      tahun,
      label: makeSemesterLabel("GENAP", tahun),
      previous_id: current.active_id || current.id || "legacy"
    };
  }

  const match = tahun.match(/^(\d{4})\/(\d{4})$/);
  const nextTahun = match ? `${Number(match[1]) + 1}/${Number(match[2]) + 1}` : tahun;
  return {
    id: makeSemesterId("GANJIL", nextTahun),
    semester: "GANJIL",
    tahun: nextTahun,
    label: makeSemesterLabel("GANJIL", nextTahun),
    previous_id: current.active_id || current.id || "legacy"
  };
}

function mergeSemesterList(list, item) {
  const next = getSemesterSettingsList({ list }).filter(entry => entry.id !== item.id);
  next.push({ ...item, label: item.label || makeSemesterLabel(item.semester, item.tahun) });
  return next.sort((a, b) => String(a.tahun || "").localeCompare(String(b.tahun || ""), undefined, { numeric: true }) || String(a.semester || "").localeCompare(String(b.semester || "")));
}

function renderAdminSemesterPage() {
  const active = getSemesterSettingsList().find(item => item.id === semesterAdminState.active_id) || getDefaultSemesterContext();
  const next = getNextSemesterContext({
    ...active,
    active_id: active.id,
    semester: semesterAdminState.semester || active.semester,
    tahun: semesterAdminState.tahun || active.tahun
  });

  return `
    <div class="card">
      <div class="kelas-bayangan-head nilai-page-head">
        <div>
          <span class="dashboard-eyebrow">Admin</span>
          <h2>Semester dan Tahun Pelajaran</h2>
          <p>Atur semester aktif yang dipilih pengguna saat login dan proses perpindahan semester.</p>
        </div>
      </div>

      <div class="semester-admin-grid">
        <section class="semester-admin-panel">
          <span class="dashboard-eyebrow">Semester Aktif</span>
          <h3>${escapeSemesterHtml(active.label || makeSemesterLabel(active.semester, active.tahun))}</h3>
          <p>Data nilai dan kehadiran akan mengikuti semester aktif yang dipilih saat login.</p>
          <label class="form-group">
            <span>Pilih semester aktif</span>
            <select id="adminSemesterActiveSelect">
              ${getSemesterSettingsList().map(item => `<option value="${escapeSemesterHtml(item.id)}" ${item.id === active.id ? "selected" : ""}>${escapeSemesterHtml(item.label || makeSemesterLabel(item.semester, item.tahun))}</option>`).join("")}
            </select>
          </label>
          <button class="btn-secondary" onclick="setAdminActiveSemester()">Set Aktif</button>
        </section>

        <section class="semester-admin-panel">
          <span class="dashboard-eyebrow">Semester Berikutnya</span>
          <h3>${escapeSemesterHtml(next.label)}</h3>
          <p>${normalizeSemesterText(active.semester) === "GENAP"
            ? "Transisi Genap ke Ganjil akan menaikkan kelas siswa dan mengosongkan wali kelas."
            : "Transisi Ganjil ke Genap mempertahankan siswa dan wali kelas."}</p>
          <button class="btn-primary" onclick="createNextSemester()">Tambah Semester Berikutnya</button>
        </section>

        <section class="semester-admin-panel">
          <span class="dashboard-eyebrow">Perbaikan Data</span>
          <h3>Turunkan Kelas</h3>
          <p>Gunakan jika kenaikan kelas perlu dibatalkan: 8 ke 7, 9 ke 8, dan siswa lulus dikembalikan ke kelas 9.</p>
          <button class="btn-danger" onclick="rollbackStudentPromotion()">Turunkan Kelas Sekarang</button>
        </section>

        <section class="semester-admin-panel">
          <span class="dashboard-eyebrow">Jalur Database</span>
          <h3>Data Per Semester</h3>
          <p>Siswa dan kelas disimpan di jalur semester masing-masing. Semester lama tidak ikut berubah saat semester baru dibuat.</p>
        </section>
      </div>

      <div class="table-container mapel-table-container">
        <table class="mapel-table semester-admin-table">
          <thead>
            <tr>
              <th>Semester</th>
              <th>Tahun Pelajaran</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${getSemesterSettingsList().map(item => `
              <tr>
                <td>${escapeSemesterHtml(item.semester || "-")}</td>
                <td>${escapeSemesterHtml(item.tahun || "-")}</td>
                <td>${item.id === active.id ? "<span class=\"status-pill status-active\">Aktif</span>" : "-"}</td>
                <td>
                  ${item.id === active.id
                    ? `<button class="btn-secondary btn-table-compact" disabled>Aktif</button>`
                    : `<button class="btn-danger btn-table-compact" onclick="deleteSemester('${escapeSemesterJs(item.id)}')">Hapus</button>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function escapeSemesterHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeSemesterJs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function loadRealtimeAdminSemester() {
  clearAdminSemesterListeners();
  unsubscribeAdminSemesterSettings = db.collection("settings").doc("semester").onSnapshot(snapshot => {
    const data = snapshot.exists ? snapshot.data() : {};
    semesterAdminState = {
      ...semesterAdminState,
      ...data,
      list: getSemesterSettingsList(data)
    };
    if (!semesterAdminState.live_id) {
      semesterAdminState.live_id = getLiveSemesterId(semesterAdminState);
    }
    const content = document.getElementById("content");
    if (content) content.innerHTML = renderAdminSemesterPage();
  });
}

function clearAdminSemesterListeners() {
  if (unsubscribeAdminSemesterSettings) {
    unsubscribeAdminSemesterSettings();
    unsubscribeAdminSemesterSettings = null;
  }
}

async function setAdminActiveSemester() {
  const id = document.getElementById("adminSemesterActiveSelect")?.value || "";
  const selected = getSemesterSettingsList().find(item => item.id === id);
  if (!selected) {
    Swal.fire("Pilih semester", "", "warning");
    return;
  }

  await ensureSemesterDataExists(selected);
  await db.collection("settings").doc("semester").set({
    active_id: selected.id,
    semester: selected.semester,
    tahun: selected.tahun,
    live_id: getLiveSemesterId(),
    list: getSemesterSettingsList(),
    updated_at: new Date()
  }, { merge: true });
  const liveId = getLiveSemesterId();
  localStorage.setItem("appSemester", JSON.stringify({
    ...selected,
    is_active: selected.id === liveId,
    use_snapshot: false,
    active_id: selected.id,
    live_id: liveId
  }));
  Swal.fire("Diset", `Semester aktif: ${selected.label || makeSemesterLabel(selected.semester, selected.tahun)}`, "success");
}

async function createNextSemester() {
  const active = getSemesterSettingsList().find(item => item.id === semesterAdminState.active_id) || getDefaultSemesterContext();
  const next = getNextSemesterContext({
    ...active,
    active_id: active.id,
    semester: semesterAdminState.semester || active.semester,
    tahun: semesterAdminState.tahun || active.tahun
  });
  const isYearChange = normalizeSemesterText(active.semester) === "GENAP";
  const confirm = await Swal.fire({
    title: `Tambah ${next.label}?`,
    html: isYearChange
      ? "Siswa akan dinaikkan kelas. Wali kelas dikosongkan. Nilai dan kehadiran semester baru mulai kosong."
      : "Data siswa dan wali kelas tetap. Nilai dan kehadiran semester baru mulai kosong.",
    input: "password",
    inputPlaceholder: "Password admin",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Proses",
    cancelButtonText: "Batal",
    inputValidator: value => !value ? "Password wajib diisi" : undefined
  });
  if (!confirm.isConfirmed) return;

  const validPassword = await verifyAdminSemesterPassword(confirm.value);
  if (!validPassword) {
    Swal.fire("Password salah", "Semester baru tidak dibuat.", "error");
    return;
  }

  try {
    Swal.fire({ title: "Memproses semester...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    await createNextSemesterData(active, next, isYearChange);

    const nextList = mergeSemesterList(getSemesterSettingsList(), next);
    await markSemesterDataInitialized(next.id);
    await db.collection("settings").doc("semester").set({
      active_id: next.id,
      live_id: next.id,
      semester: next.semester,
      tahun: next.tahun,
      list: nextList,
      updated_at: new Date()
    }, { merge: true });
    await db.collection("settings").doc("rapor").set({
      semester: next.semester,
      tahun: next.tahun,
      updated_at: new Date()
    }, { merge: true });
    await Swal.fire("Berhasil", `${next.label} sudah dibuat dan dijadikan aktif. Silakan login ulang.`, "success");
    localStorage.removeItem("login");
    localStorage.removeItem("appUser");
    localStorage.removeItem("appSemester");
    window.location.href = "login.html";
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal memproses semester", error.message || "", "error");
  }
}

async function verifyAdminSemesterPassword(password) {
  const user = typeof getCurrentAppUser === "function" ? getCurrentAppUser() : {};
  const username = String(user.username || "").trim().toLowerCase();
  if (!password) return false;
  if (!user.id && username === "admin") {
    return password === "admin123" || password === "kurikulumspenturi";
  }
  if (!username) return false;
  const snapshot = await db.collection("users").where("username", "==", username).limit(1).get();
  if (snapshot.empty) {
    return username === "admin" && (password === "admin123" || password === "kurikulumspenturi");
  }
  const adminUser = snapshot.docs[0].data();
  return (adminUser.role || "") === "admin" && String(adminUser.password || "") === password;
}

async function ensureActiveSemesterDataAvailable() {
  const active = getActiveSemesterContext();
  if (!active?.id || active.id === "legacy") return;
  await ensureSemesterDataExists(active);
}

async function ensureSemesterDataExists(term) {
  const termId = term?.id || "";
  if (!termId || termId === "legacy") return;
  const metaRef = db.collection("semester_data").doc(termId);
  const meta = await metaRef.get();
  if (meta.exists && meta.data()?.initialized === true) return;

  const siswaCheck = await getSemesterCollectionRef("siswa", termId).limit(1).get();
  const kelasCheck = await getSemesterCollectionRef("kelas", termId).limit(1).get();
  if (siswaCheck.empty) await copyMainCollectionToSemester(termId, "siswa");
  if (kelasCheck.empty) await copyMainCollectionToSemester(termId, "kelas");
  await markSemesterDataInitialized(termId);
}

async function markSemesterDataInitialized(termId) {
  if (!termId || termId === "legacy") return;
  await db.collection("semester_data").doc(termId).set({
    initialized: true,
    initialized_at: new Date()
  }, { merge: true });
}

async function copyMainCollectionToSemester(termId, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 450).forEach(doc => {
      batch.set(getSemesterDocRef(collectionName, doc.id, termId), {
        ...doc.data(),
        id_asli: doc.id,
        term_id: termId,
        initialized_from_main_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
  }
}

async function deleteSemester(id) {
  const target = getSemesterSettingsList().find(item => item.id === id);
  if (!target) {
    Swal.fire("Semester tidak ditemukan", "", "warning");
    return;
  }
  if (target.id === semesterAdminState.active_id) {
    Swal.fire("Tidak bisa dihapus", "Semester aktif tidak bisa dihapus.", "warning");
    return;
  }

  const label = target.label || makeSemesterLabel(target.semester, target.tahun);
  const confirm = await Swal.fire({
    title: `Hapus ${label}?`,
    html: "Masukkan password admin untuk menghapus semester dari daftar. Data nilai/kehadiran tidak ikut dihapus.",
    input: "password",
    inputPlaceholder: "Password admin",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal",
    inputValidator: value => !value ? "Password wajib diisi" : undefined
  });
  if (!confirm.isConfirmed) return;

  const validPassword = await verifyAdminSemesterPassword(confirm.value);
  if (!validPassword) {
    Swal.fire("Password salah", "Semester tidak dihapus.", "error");
    return;
  }

  const nextList = getSemesterSettingsList().filter(item => item.id !== target.id);
  await db.collection("settings").doc("semester").set({
    list: nextList,
    updated_at: new Date()
  }, { merge: true });
  Swal.fire("Dihapus", `${label} dihapus dari daftar semester.`, "success");
}

function promoteKelasValue(kelasValue) {
  const raw = String(kelasValue || "").trim().toUpperCase().replace(/\s+/g, "");
  const match = raw.match(/^([7-9])([A-Z]+)$/);
  if (!match) return kelasValue || "";
  const nextLevel = Number(match[1]) + 1;
  if (nextLevel > 9) return "";
  return `${nextLevel} ${match[2]}`;
}

function demoteKelasValue(kelasValue) {
  const raw = String(kelasValue || "").trim().toUpperCase().replace(/\s+/g, "");
  const match = raw.match(/^([7-9])([A-Z]+)$/);
  if (!match) return kelasValue || "";
  const previousLevel = Number(match[1]) - 1;
  if (previousLevel < 7) return "";
  return `${previousLevel} ${match[2]}`;
}

function getPreviousTahunPelajaran(value) {
  const tahun = normalizeTahunPelajaran(value || "2026/2027");
  const match = tahun.match(/^(\d{4})\/(\d{4})$/);
  if (!match) return "2025/2026";
  return `${Number(match[1]) - 1}/${Number(match[2]) - 1}`;
}

function getSemesterKelasParts(kelasValue = "") {
  const raw = String(kelasValue || "").trim().toUpperCase().replace(/\s+/g, "");
  const match = raw.match(/^([7-9])([A-Z]+)$/);
  return {
    tingkat: match ? match[1] : "",
    rombel: match ? match[2] : "",
    kelas: match ? `${match[1]} ${match[2]}` : String(kelasValue || "").trim().toUpperCase()
  };
}

function makeSiswaLulusDocId(tahunPelajaran, nipd) {
  return `${normalizeTahunPelajaran(tahunPelajaran).replace(/[^0-9]/g, "")}_${String(nipd || "").trim()}`;
}

async function getSemesterSourceSnapshot(term, collectionName) {
  const termId = term?.id || getActiveTermId();
  if (termId && termId !== "legacy") {
    const semesterSnapshot = await getSemesterCollectionRef(collectionName, termId).get();
    if (!semesterSnapshot.empty) return semesterSnapshot;
  }
  return db.collection(collectionName).get();
}

async function createNextSemesterData(active, next, isYearChange) {
  await cloneKelasForNextSemester(active, next, isYearChange);
  await cloneSiswaForNextSemester(active, next, isYearChange);
}

async function cloneKelasForNextSemester(active, next, clearWali) {
  const snapshot = await getSemesterSourceSnapshot(active, "kelas");
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 450).forEach(doc => {
      const data = doc.data();
      batch.set(getSemesterDocRef("kelas", data.kelas || doc.id, next.id), {
        ...data,
        kode_guru: clearWali ? "" : data.kode_guru || "",
        wali_kelas: clearWali ? "" : data.wali_kelas || "",
        term_id: next.id,
        previous_term_id: active.id || "",
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
  }
}

async function cloneSiswaForNextSemester(active, next, promote) {
  const tahunLulus = normalizeTahunPelajaran(active.tahun || semesterAdminState.tahun || "2025/2026");
  const snapshot = await getSemesterSourceSnapshot(active, "siswa");
  for (let index = 0; index < snapshot.docs.length; index += 225) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 225).forEach(doc => {
      const data = doc.data();
      const nipd = data.nipd || doc.id;
      if (!nipd) return;
      const kelasParts = getSemesterKelasParts(data.kelas);
      if (promote && kelasParts.tingkat === "9") {
        batch.set(db.collection("siswa_lulus").doc(makeSiswaLulusDocId(tahunLulus, nipd)), {
          ...data,
          nipd,
          kelas_lulus: kelasParts.kelas || data.kelas || "",
          kelas_bayangan_lulus: data.kelas_bayangan || "",
          tahun_pelajaran_lulus: tahunLulus,
          term_id: next.id,
          lulus_at: new Date()
        }, { merge: true });
        return;
      }
      batch.set(getSemesterDocRef("siswa", nipd, next.id), {
        ...data,
        nipd,
        kelas: promote ? promoteKelasValue(data.kelas) : data.kelas || "",
        kelas_bayangan: promote ? promoteKelasValue(data.kelas_bayangan) : data.kelas_bayangan || "",
        term_id: next.id,
        previous_term_id: active.id || "",
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
  }
}

async function promoteStudentsForNewYear() {
  const active = getSemesterSettingsList().find(item => item.id === semesterAdminState.active_id) || getDefaultSemesterContext();
  const tahunLulus = normalizeTahunPelajaran(active.tahun || semesterAdminState.tahun || "2025/2026");
  const snapshot = await db.collection("siswa").get();
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 450).forEach(doc => {
      const data = doc.data();
      const kelasParts = getSemesterKelasParts(data.kelas);
      if (kelasParts.tingkat === "9") {
        const lulusRef = db.collection("siswa_lulus").doc(makeSiswaLulusDocId(tahunLulus, data.nipd || doc.id));
        batch.set(lulusRef, {
          ...data,
          nipd: data.nipd || doc.id,
          kelas_lulus: kelasParts.kelas || data.kelas || "",
          kelas_bayangan_lulus: data.kelas_bayangan || "",
          tahun_pelajaran_lulus: tahunLulus,
          lulus_at: new Date()
        }, { merge: true });
      }
      batch.set(doc.ref, {
        kelas: kelasParts.tingkat === "9" ? "" : promoteKelasValue(data.kelas),
        kelas_bayangan: kelasParts.tingkat === "9" ? "" : promoteKelasValue(data.kelas_bayangan),
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
  }
}

async function rollbackStudentPromotion() {
  const active = getSemesterSettingsList().find(item => item.id === semesterAdminState.active_id) || getDefaultSemesterContext();
  const defaultTahunLulus = normalizeSemesterText(active.semester) === "GANJIL"
    ? getPreviousTahunPelajaran(active.tahun)
    : normalizeTahunPelajaran(active.tahun || "2025/2026");
  const confirm = await Swal.fire({
    title: "Turunkan kelas siswa?",
    html: "Masukkan password admin. Siswa kelas 8 turun ke kelas 7, kelas 9 turun ke kelas 8, dan siswa lulus tahun pelajaran yang dipilih dikembalikan ke kelas 9.",
    input: "password",
    inputPlaceholder: "Password admin",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Lanjut",
    cancelButtonText: "Batal",
    inputValidator: value => !value ? "Password wajib diisi" : undefined
  });
  if (!confirm.isConfirmed) return;

  const validPassword = await verifyAdminSemesterPassword(confirm.value);
  if (!validPassword) {
    Swal.fire("Password salah", "Data siswa tidak diubah.", "error");
    return;
  }

  const tahunPrompt = await Swal.fire({
    title: "Tahun pelajaran siswa lulus",
    input: "text",
    inputValue: defaultTahunLulus,
    inputPlaceholder: "2025/2026",
    showCancelButton: true,
    confirmButtonText: "Turunkan",
    cancelButtonText: "Batal",
    inputValidator: value => !value ? "Tahun pelajaran wajib diisi" : undefined
  });
  if (!tahunPrompt.isConfirmed) return;

  const tahunLulus = normalizeTahunPelajaran(tahunPrompt.value);
  try {
    Swal.fire({ title: "Menurunkan kelas...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    const siswaCount = await demoteActiveStudents();
    const lulusCount = await restoreGraduatedStudents(tahunLulus);
    Swal.fire("Selesai", `${siswaCount} siswa aktif diturunkan. ${lulusCount} siswa lulus dikembalikan ke kelas 9.`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal menurunkan kelas", error.message || "", "error");
  }
}

async function demoteActiveStudents() {
  const active = getSemesterSettingsList().find(item => item.id === semesterAdminState.active_id) || getDefaultSemesterContext();
  const snapshot = await getSemesterSourceSnapshot(active, "siswa");
  let count = 0;
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 450).forEach(doc => {
      const data = doc.data();
      const kelasParts = getSemesterKelasParts(data.kelas);
      if (!["8", "9"].includes(kelasParts.tingkat)) return;
      count++;
      batch.set(getSemesterDocRef("siswa", data.nipd || doc.id, active.id), {
        kelas: demoteKelasValue(data.kelas),
        kelas_bayangan: demoteKelasValue(data.kelas_bayangan),
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
  }
  return count;
}

async function restoreGraduatedStudents(tahunLulus) {
  const snapshot = await db.collection("siswa_lulus")
    .where("tahun_pelajaran_lulus", "==", tahunLulus)
    .get();
  let count = 0;
  for (let index = 0; index < snapshot.docs.length; index += 225) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 225).forEach(doc => {
      const data = doc.data();
      const nipd = data.nipd || doc.id;
      if (!nipd) return;
      count++;
      batch.set(getSemesterDocRef("siswa", nipd), {
        ...data,
        kelas: data.kelas_lulus || data.kelas || "",
        kelas_bayangan: data.kelas_bayangan_lulus || data.kelas_bayangan || data.kelas_lulus || "",
        restored_from_lulus: tahunLulus,
        updated_at: new Date()
      }, { merge: true });
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
  return count;
}

function getPreviousSemesterContext(current = semesterAdminState) {
  const semester = normalizeSemesterText(current.semester);
  const tahun = normalizeTahunPelajaran(current.tahun || "2026/2027");
  if (semester === "GENAP") {
    return {
      id: makeSemesterId("GANJIL", tahun),
      semester: "GANJIL",
      tahun,
      label: makeSemesterLabel("GANJIL", tahun)
    };
  }
  const previousTahun = getPreviousTahunPelajaran(tahun);
  return {
    id: makeSemesterId("GENAP", previousTahun),
    semester: "GENAP",
    tahun: previousTahun,
    label: makeSemesterLabel("GENAP", previousTahun)
  };
}

function cloneStudentForPreviousSnapshot(data) {
  const kelasParts = getSemesterKelasParts(data.kelas);
  if (!["8", "9"].includes(kelasParts.tingkat)) return null;
  return {
    ...data,
    kelas: demoteKelasValue(data.kelas),
    kelas_bayangan: demoteKelasValue(data.kelas_bayangan),
    restored_snapshot_from: data.kelas || "",
    snapshotted_at: new Date()
  };
}

async function repairPreviousSemesterSnapshot() {
  const active = getSemesterSettingsList().find(item => item.id === semesterAdminState.active_id) || getDefaultSemesterContext();
  const previous = getPreviousSemesterContext(active);
  const confirm = await Swal.fire({
    title: `Perbaiki ${previous.label}?`,
    html: "Masukkan password admin. Snapshot siswa dan kelas semester sebelumnya akan dibuat ulang tanpa mengubah data semester aktif.",
    input: "password",
    inputPlaceholder: "Password admin",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Perbaiki",
    cancelButtonText: "Batal",
    inputValidator: value => !value ? "Password wajib diisi" : undefined
  });
  if (!confirm.isConfirmed) return;

  const validPassword = await verifyAdminSemesterPassword(confirm.value);
  if (!validPassword) {
    Swal.fire("Password salah", "Snapshot tidak diperbaiki.", "error");
    return;
  }

  try {
    Swal.fire({ title: "Memperbaiki snapshot...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    const siswaCount = await rebuildPreviousSiswaSnapshot(previous, active);
    const kelasCount = await snapshotSemesterCollection(previous.id, "kelas");
    Swal.fire("Selesai", `Snapshot ${previous.label} diperbaiki. Siswa: ${siswaCount}. Kelas: ${kelasCount}.`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal memperbaiki snapshot", error.message || "", "error");
  }
}

async function rebuildPreviousSiswaSnapshot(previous, active) {
  let count = 0;
  const siswaSnapshot = await db.collection("siswa").get();
  for (let index = 0; index < siswaSnapshot.docs.length; index += 450) {
    const batch = db.batch();
    siswaSnapshot.docs.slice(index, index + 450).forEach(doc => {
      const previousData = cloneStudentForPreviousSnapshot({ id: doc.id, ...doc.data() });
      if (!previousData) return;
      count++;
      batch.set(
        db.collection("semester_data").doc(previous.id).collection("siswa").doc(doc.id),
        {
          ...previousData,
          id_asli: doc.id,
          term_id: previous.id
        },
        { merge: true }
      );
    });
    await batch.commit();
  }

  if (normalizeSemesterText(previous.semester) === "GENAP") {
    const tahunLulus = normalizeTahunPelajaran(previous.tahun || active.tahun || "");
    const lulusSnapshot = await db.collection("siswa_lulus")
      .where("tahun_pelajaran_lulus", "==", tahunLulus)
      .get();
    for (let index = 0; index < lulusSnapshot.docs.length; index += 450) {
      const batch = db.batch();
      lulusSnapshot.docs.slice(index, index + 450).forEach(doc => {
        const data = doc.data();
        const nipd = data.nipd || doc.id;
        if (!nipd) return;
        count++;
        batch.set(
          db.collection("semester_data").doc(previous.id).collection("siswa").doc(nipd),
          {
            ...data,
            nipd,
            kelas: data.kelas_lulus || data.kelas || "",
            kelas_bayangan: data.kelas_bayangan_lulus || data.kelas_bayangan || data.kelas_lulus || "",
            id_asli: nipd,
            term_id: previous.id,
            snapshotted_at: new Date()
          },
          { merge: true }
        );
      });
      await batch.commit();
    }
  }
  return count;
}

async function snapshotSemesterData(term) {
  if (!term?.id) return;
  await snapshotSemesterCollection(term.id, "siswa");
  await snapshotSemesterCollection(term.id, "kelas");
}

async function snapshotSemesterCollection(termId, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  let count = 0;
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 450).forEach(doc => {
      count++;
      batch.set(
        db.collection("semester_data").doc(termId).collection(collectionName).doc(doc.id),
        {
          ...doc.data(),
          id_asli: doc.id,
          term_id: termId,
          snapshotted_at: new Date()
        },
        { merge: true }
      );
    });
    await batch.commit();
  }
  return count;
}

async function clearAllWaliKelas() {
  const snapshot = await db.collection("kelas").get();
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 450).forEach(doc => {
      batch.set(doc.ref, {
        kode_guru: "",
        wali_kelas: "",
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
  }
}
