// ================= TUGAS TAMBAHAN =================
const DEFAULT_TUGAS_TAMBAHAN = [
  { nama: "Wakil Kepala Satuan Pendidikan", jenis: "Utama", jp: 12 },
  { nama: "Kepala Perpustakaan", jenis: "Utama", jp: 12 },
  { nama: "Kepala Laboratorium", jenis: "Utama", jp: 12 },
  { nama: "Koordinator Pengembangan Keprofesian Berkelanjutan (PKB)", jenis: "Utama", jp: 6 },
  { nama: "Koordinator Penilaian Kinerja Guru (PKG)", jenis: "Utama", jp: 6 },
  { nama: "Pembimbing Khusus pada Satuan Pendidikan Inklusif", jenis: "Utama", jp: 6 },
  { nama: "Wali Kelas", jenis: "Ekuivalen", jp: 2 },
  { nama: "Pembina Ekstrakurikuler", jenis: "Ekuivalen", jp: 2 },
  { nama: "Pembina OSIS", jenis: "Ekuivalen", jp: 2 },
  { nama: "Guru Piket", jenis: "Ekuivalen", jp: 2 },
  { nama: "Penilai Kinerja Guru", jenis: "Ekuivalen", jp: 2 },
  { nama: "Pengurus Organisasi/Asosiasi Profesi Tingkat Nasional", jenis: "Ekuivalen", jp: 3 },
  { nama: "Pengurus Organisasi/Asosiasi Profesi Tingkat Provinsi", jenis: "Ekuivalen", jp: 2 },
  { nama: "Pengurus Organisasi/Asosiasi Profesi Tingkat Kabupaten/Kota", jenis: "Ekuivalen", jp: 1 },
  { nama: "Tutor pada Pendidikan Jarak Jauh", jenis: "Ekuivalen", jp: 3 }
];
const FIXED_KEPALA_SEKOLAH_TASK_ID = "KS";
const FIXED_KEPALA_SEKOLAH_TASK_NAME = "Kepala Sekolah";
const FIXED_KEPALA_SEKOLAH_TASK_JP = 18;

let semuaDataTugasTambahan = [];
let semuaDataGuruTugasTambahan = [];
let semuaDataGuruTugasTambahanAssignments = [];
let semuaDataMengajarTugasTambahan = [];
let semuaDataMapelTugasTambahan = [];
let semuaDataKelasTugasTambahan = [];
let unsubscribeTugasTambahan = null;
let unsubscribeTugasTambahanGuru = null;
let unsubscribeTugasTambahanAssignments = null;
let unsubscribeTugasTambahanMengajar = null;
let unsubscribeTugasTambahanMapel = null;
let unsubscribeTugasTambahanKelas = null;
let isSeedingTugasTambahan = false;
let isSubmittingTugasTambahan = false;
let isSyncingWaliKelasTugasTambahan = false;
let tugasTambahanSyncReady = {
  tugas: false,
  guru: false,
  assignments: false,
  mengajar: false,
  mapel: false,
  kelas: false
};
let currentEditTugasTambahan = null;
let tugasTambahanActiveTab = "guru";
let isEnsuringFixedKepalaSekolahTask = false;
let isInteractingTugasTambahanUi = false;
let hasPendingTugasTambahanRender = false;
let tugasTambahanMatrixDrafts = {};
let tugasTambahanInputDraft = {
  nama: "",
  jenis: "Utama",
  jp: ""
};

function escapeTugasTambahanHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeTugasTambahanJs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function makeTugasTambahanId(nama, jenis) {
  return `${jenis}-${nama}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function isFixedKepalaSekolahTugasTambahan(item = {}) {
  return String(item.id || "").trim().toUpperCase() === FIXED_KEPALA_SEKOLAH_TASK_ID;
}

function sortTugasTambahan(data) {
  const jenisOrder = { Utama: 1, Ekuivalen: 2, Sekolah: 3 };
  return [...data].sort((a, b) => {
    if (isFixedKepalaSekolahTugasTambahan(a)) return -1;
    if (isFixedKepalaSekolahTugasTambahan(b)) return 1;
    const jenisResult = (jenisOrder[a.jenis] || 99) - (jenisOrder[b.jenis] || 99);
    if (jenisResult !== 0) return jenisResult;
    const jpResult = Number(b.jp || 0) - Number(a.jp || 0);
    if (jpResult !== 0) return jpResult;
    return String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" });
  });
}

function renderTugasTambahanPage() {
  return `
    <div class="card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Pembagian Tugas dan Mengajar</span>
          <h2>Tugas Tambahan</h2>
          <p>Daftar tugas tambahan utama dan ekuivalen beserta jumlah JP.</p>
        </div>
      </div>

      <div class="toolbar-info">
        <span id="jumlahDataTugasTambahan">0 tugas tambahan</span>
      </div>

      <div class="tugas-tabbar">
        <button class="${tugasTambahanActiveTab === "guru" ? "active" : ""}" onclick="setTugasTambahanTab('guru')">Guru</button>
        <button class="${tugasTambahanActiveTab === "tugas" ? "active" : ""}" onclick="setTugasTambahanTab('tugas')">Tugas Tambahan</button>
      </div>

      <div id="tugasTambahanTabContent">
        ${tugasTambahanActiveTab === "guru" ? renderTugasTambahanGuruTab() : renderTugasTambahanDaftarTab()}
      </div>
    </div>
  `;
}

function renderTugasTambahanGuruTab() {
  return `
    <div class="toolbar-info">
      <span id="jumlahGuruTugasTambahanInfo">0 guru x 0 slot</span>
      <button class="btn-primary" onclick="saveAllGuruTugasTambahan()">Simpan Semua</button>
    </div>
    <div id="guruTugasTambahanMatrixContainer"></div>
  `;
}

function getTugasTambahanMatrixRows() {
  return [
    { field: "utama_id", jenis: "Utama", label: "TTU" },
    { field: "ekuivalen_1_id", jenis: "Ekuivalen", label: "TTE 1" },
    { field: "ekuivalen_2_id", jenis: "Ekuivalen", label: "TTE 2" },
    { field: "ekuivalen_3_id", jenis: "Ekuivalen", label: "TTE 3" },
    { field: "sekolah_1_id", jenis: "Sekolah", label: "TTS 1" },
    { field: "sekolah_2_id", jenis: "Sekolah", label: "TTS 2" },
    { field: "sekolah_3_id", jenis: "Sekolah", label: "TTS 3" }
  ];
}

function getTugasTambahanJenisClass(jenis) {
  if (jenis === "Utama") return "is-ttu";
  if (jenis === "Ekuivalen") return "is-tte";
  if (jenis === "Sekolah") return "is-tts";
  return "";
}

function setTugasTambahanMatrixInteractionState(isActive) {
  isInteractingTugasTambahanUi = Boolean(isActive);
  if (!isInteractingTugasTambahanUi && hasPendingTugasTambahanRender) {
    hasPendingTugasTambahanRender = false;
    window.setTimeout(() => renderTugasTambahanViews(), 0);
  }
}

function handleTugasTambahanUiFocus() {
  setTugasTambahanMatrixInteractionState(true);
}

function handleTugasTambahanUiBlur() {
  window.setTimeout(() => setTugasTambahanMatrixInteractionState(false), 0);
}

function handleTugasTambahanUiButtonDown() {
  handleTugasTambahanUiFocus();
}

function requestRenderTugasTambahanViews() {
  if (isInteractingTugasTambahanUi) {
    hasPendingTugasTambahanRender = true;
    return;
  }
  renderTugasTambahanViews();
}

function updateTugasTambahanInputDraft(field, value) {
  if (!["nama", "jenis", "jp"].includes(field)) return;
  tugasTambahanInputDraft[field] = value;
}

function resetTugasTambahanInputDraft() {
  tugasTambahanInputDraft = {
    nama: "",
    jenis: "Utama",
    jp: ""
  };
}

function getGuruTugasTambahanBaseAssignment(guruKode) {
  return getGuruTugasTambahanAssignment(guruKode) || {};
}

function getGuruTugasTambahanDraft(guruKode) {
  return tugasTambahanMatrixDrafts[String(guruKode || "").trim()] || null;
}

function setGuruTugasTambahanDraft(guruKode, assignment) {
  const key = String(guruKode || "").trim();
  if (!key) return;
  tugasTambahanMatrixDrafts[key] = { ...assignment };
}

function clearGuruTugasTambahanDraft(guruKode) {
  const key = String(guruKode || "").trim();
  if (!key) return;
  delete tugasTambahanMatrixDrafts[key];
}

function getGuruTugasTambahanEffectiveAssignment(guruKode) {
  const key = String(guruKode || "").trim();
  const base = getGuruTugasTambahanBaseAssignment(key);
  const draft = getGuruTugasTambahanDraft(key);
  return normalizeGuruTugasTambahanAssignmentRules({ ...base, ...(draft || {}) }, key);
}

function getTugasTambahanSlotPairs(prefix) {
  if (prefix === "ekuivalen") {
    return [
      ["ekuivalen_1_id", "ekuivalen_1_nama"],
      ["ekuivalen_2_id", "ekuivalen_2_nama"],
      ["ekuivalen_3_id", "ekuivalen_3_nama"]
    ];
  }
  if (prefix === "sekolah") {
    return [
      ["sekolah_1_id", "sekolah_1_nama"],
      ["sekolah_2_id", "sekolah_2_nama"],
      ["sekolah_3_id", "sekolah_3_nama"]
    ];
  }
  return [];
}

function collectTugasTambahanSlotValues(assignment, prefix) {
  return getTugasTambahanSlotPairs(prefix)
    .map(([idField, nameField]) => ({
      id: String(assignment[idField] || "").trim(),
      nama: String(assignment[nameField] || "").trim()
    }))
    .filter(item => item.id);
}

function applyTugasTambahanSlotValues(assignment, prefix, values) {
  const pairs = getTugasTambahanSlotPairs(prefix);
  pairs.forEach(([idField, nameField], index) => {
    const item = values[index] || {};
    assignment[idField] = item.id || "";
    assignment[nameField] = item.nama || "";
  });
  if (prefix === "sekolah") {
    assignment.sekolah_id = assignment.sekolah_1_id || "";
    assignment.sekolah_nama = assignment.sekolah_1_nama || "";
  }
}

function getTugasTambahanMatrixState(assignment = {}) {
  const hasUtama = Boolean(String(assignment.utama_id || "").trim());
  const hasEkuivalen1 = Boolean(String(assignment.ekuivalen_1_id || "").trim());
  const hasEkuivalen2 = Boolean(String(assignment.ekuivalen_2_id || "").trim());
  const hasSekolah1 = Boolean(String(assignment.sekolah_1_id || assignment.sekolah_id || "").trim());
  const hasSekolah2 = Boolean(String(assignment.sekolah_2_id || "").trim());
  const hasAnyEkuivalen = hasEkuivalen1 || hasEkuivalen2 || Boolean(String(assignment.ekuivalen_3_id || "").trim());

  return {
    utama: !hasAnyEkuivalen,
    ekuivalen_1: !hasUtama,
    ekuivalen_2: !hasUtama && hasEkuivalen1,
    ekuivalen_3: !hasUtama && hasEkuivalen2,
    sekolah_1: true,
    sekolah_2: hasSekolah1,
    sekolah_3: hasSekolah2
  };
}

function isTugasTambahanFieldOpen(matrixState, field) {
  const keyMap = {
    utama_id: "utama",
    ekuivalen_1_id: "ekuivalen_1",
    ekuivalen_2_id: "ekuivalen_2",
    ekuivalen_3_id: "ekuivalen_3",
    sekolah_1_id: "sekolah_1",
    sekolah_2_id: "sekolah_2",
    sekolah_3_id: "sekolah_3"
  };
  return Boolean(matrixState[keyMap[field]]);
}

function getTugasTambahanFieldLockReason(field, assignment = {}) {
  if (field === "utama_id") return "TTU tertutup karena guru sudah memiliki TTE.";
  if (field.startsWith("ekuivalen_")) {
    if (String(assignment.utama_id || "").trim()) return "TTE tertutup karena guru sudah memiliki TTU.";
    if (field === "ekuivalen_2_id") return "TTE 2 terbuka setelah TTE 1 terisi.";
    if (field === "ekuivalen_3_id") return "TTE 3 terbuka setelah TTE 2 terisi.";
  }
  if (field === "sekolah_2_id") return "TTS 2 terbuka setelah TTS 1 terisi.";
  if (field === "sekolah_3_id") return "TTS 3 terbuka setelah TTS 2 terisi.";
  return "Slot ini belum aktif.";
}

function normalizeGuruTugasTambahanAssignmentRules(assignment, guruKode = "") {
  const normalized = { ...assignment };
  const waliItem = getWaliKelasTugasTambahanItem();
  const shouldHaveWali = guruKode ? getWaliKelasGuruCodes().has(String(guruKode || "").trim()) : false;

  let ekuivalenValues = collectTugasTambahanSlotValues(normalized, "ekuivalen")
    .filter(item => !waliItem || item.id !== waliItem.id);
  if (shouldHaveWali && waliItem) {
    ekuivalenValues.unshift({ id: waliItem.id, nama: waliItem.nama || "Wali Kelas" });
  }
  ekuivalenValues = ekuivalenValues.slice(0, 3);
  applyTugasTambahanSlotValues(normalized, "ekuivalen", ekuivalenValues);

  const sekolahValues = collectTugasTambahanSlotValues(normalized, "sekolah").slice(0, 3);
  applyTugasTambahanSlotValues(normalized, "sekolah", sekolahValues);

  if (String(normalized.ekuivalen_1_id || normalized.ekuivalen_2_id || normalized.ekuivalen_3_id || "").trim()) {
    normalized.utama_id = "";
    normalized.utama_nama = "";
  }

  if (String(normalized.utama_id || "").trim()) {
    applyTugasTambahanSlotValues(normalized, "ekuivalen", []);
  }

  normalized.jp_tugas_tambahan = calculateGuruTugasTambahanJpFromAssignment(normalized);
  normalized.updated_at = new Date();
  return normalized;
}

function updateGuruTugasTambahanDraft(guruKode, field, value) {
  const key = String(guruKode || "").trim();
  if (!key || !field) return;
  const baseAssignment = getGuruTugasTambahanEffectiveAssignment(key);
  const task = semuaDataTugasTambahan.find(item => String(item.id || "").trim() === String(value || "").trim()) || null;
  const nextAssignment = {
    ...baseAssignment,
    guru_kode: key,
    [field]: String(value || "").trim()
  };

  const nameFieldMap = {
    utama_id: "utama_nama",
    ekuivalen_1_id: "ekuivalen_1_nama",
    ekuivalen_2_id: "ekuivalen_2_nama",
    ekuivalen_3_id: "ekuivalen_3_nama",
    sekolah_1_id: "sekolah_1_nama",
    sekolah_2_id: "sekolah_2_nama",
    sekolah_3_id: "sekolah_3_nama"
  };
  const nameField = nameFieldMap[field];
  if (nameField) {
    nextAssignment[nameField] = task?.nama || "";
  }
  if (field === "sekolah_1_id") {
    nextAssignment.sekolah_id = String(value || "").trim();
    nextAssignment.sekolah_nama = task?.nama || "";
  }

  const normalized = normalizeGuruTugasTambahanAssignmentRules(nextAssignment, key);
  setGuruTugasTambahanDraft(key, normalized);
}

function renderGuruTugasTambahanMatrix() {
  const container = document.getElementById("guruTugasTambahanMatrixContainer");
  const info = document.getElementById("jumlahGuruTugasTambahanInfo");
  if (!container) return;

  const gurus = getSortedGuruTugasTambahan();
  const rows = getTugasTambahanMatrixRows();
  const waliCodes = getWaliKelasGuruCodes();
  const waliItem = getWaliKelasTugasTambahanItem();
  if (info) info.innerText = `${gurus.length} guru x ${rows.length} slot`;

  if (gurus.length === 0) {
    container.innerHTML = `<div class="empty-panel">Belum ada data guru.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-container matrix-table-wrap">
      <table class="matrix-table tugas-matrix-table">
        <thead>
          <tr>
            <th>Guru</th>
            ${rows.map(row => `<th class="tugas-matrix-head ${getTugasTambahanJenisClass(row.jenis)}">${escapeTugasTambahanHtml(row.label)}</th>`).join("")}
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${gurus.map(guru => {
            const kode = String(guru.kode_guru || "").trim();
            const assignment = getGuruTugasTambahanEffectiveAssignment(kode);
            const matrixState = getTugasTambahanMatrixState(assignment);
            const safeKode = escapeTugasTambahanJs(kode);
            const isWaliGuru = waliCodes.has(kode);
            return `
            <tr data-guru-tugas-kode="${escapeTugasTambahanHtml(kode)}">
              <td class="mengajar-mapel-cell" title="${escapeTugasTambahanHtml(getNamaGuruTugasTambahan(guru))}">
                <strong>${escapeTugasTambahanHtml(getGuruMatrixLabel(guru))}</strong>
              </td>
              ${rows.map(row => {
                const selectedValue = assignment[row.field] || (row.field === "sekolah_1_id" ? assignment.sekolah_id || "" : "");
                const isOpen = isTugasTambahanFieldOpen(matrixState, row.field);
                const isLockedWaliKelas = Boolean(
                  waliItem &&
                  isWaliGuru &&
                  row.field === "ekuivalen_1_id" &&
                  String(selectedValue || "").trim() === String(waliItem.id || "").trim()
                );
                const lockReason = isLockedWaliKelas
                  ? "Wali Kelas mengikuti penetapan pada Data Kelas."
                  : (isOpen ? "" : getTugasTambahanFieldLockReason(row.field, assignment));
                return `
                  <td class="mengajar-grid-cell">
                    <select
                      id="${getTugasTambahanSelectId(row.field, kode)}"
                      class="mengajar-cell-dropdown tugas-matrix-select ${getTugasTambahanJenisClass(row.jenis)} ${selectedValue ? "is-filled" : ""}"
                      onchange="handleGuruTugasTambahanSelectChange('${safeKode}', '${row.field}', this)"
                      onfocus="handleTugasTambahanUiFocus()"
                      onmousedown="handleTugasTambahanUiFocus()"
                      onblur="handleTugasTambahanUiBlur()"
                      ${isOpen && !isLockedWaliKelas ? "" : "disabled"}
                      title="${escapeTugasTambahanHtml(lockReason)}"
                    >
                      ${renderTugasTambahanOptions(row.jenis, selectedValue)}
                    </select>
                  </td>
                `;
              }).join("")}
              <td class="mengajar-grid-cell">
                <button class="btn-primary btn-table-compact" onclick="saveGuruTugasTambahan('${safeKode}')">Simpan</button>
              </td>
            </tr>
          `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTugasTambahanDaftarTab() {
  return `
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Tugas Tambahan</th>
              <th>Jenis Tugas Tambahan</th>
              <th>Jumlah JP</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="tbodyTugasTambahan"></tbody>
        </table>
        <div id="emptyStateTugasTambahan" class="empty-panel" style="display:none;">Belum ada data tugas tambahan.</div>
      </div>
  `;
}

function loadRealtimeTugasTambahan() {
  if (unsubscribeTugasTambahan) unsubscribeTugasTambahan();
  if (unsubscribeTugasTambahanGuru) unsubscribeTugasTambahanGuru();
  if (unsubscribeTugasTambahanAssignments) unsubscribeTugasTambahanAssignments();
  if (unsubscribeTugasTambahanMengajar) unsubscribeTugasTambahanMengajar();
  if (unsubscribeTugasTambahanMapel) unsubscribeTugasTambahanMapel();
  if (unsubscribeTugasTambahanKelas) unsubscribeTugasTambahanKelas();
  tugasTambahanSyncReady = {
    tugas: false,
    guru: false,
    assignments: false,
    mengajar: false,
    mapel: false,
    kelas: false
  };

  unsubscribeTugasTambahan = db.collection("tugas_tambahan").onSnapshot(snapshot => {
    semuaDataTugasTambahan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    tugasTambahanSyncReady.tugas = true;
    if (semuaDataTugasTambahan.length === 0) {
      seedDefaultTugasTambahan();
      return;
    }
    ensureFixedKepalaSekolahTugasTambahan();
    requestRenderTugasTambahanViews();
    syncWaliKelasTugasTambahanFromState();
  });

  unsubscribeTugasTambahanGuru = listenGuru(data => {
    semuaDataGuruTugasTambahan = data;
    tugasTambahanSyncReady.guru = true;
    requestRenderTugasTambahanViews();
    syncWaliKelasTugasTambahanFromState();
  });

  unsubscribeTugasTambahanAssignments = db.collection("guru_tugas_tambahan").onSnapshot(snapshot => {
    semuaDataGuruTugasTambahanAssignments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    tugasTambahanSyncReady.assignments = true;
    requestRenderTugasTambahanViews();
    syncWaliKelasTugasTambahanFromState();
  });

  unsubscribeTugasTambahanMengajar = listenMengajar(data => {
    semuaDataMengajarTugasTambahan = data;
    tugasTambahanSyncReady.mengajar = true;
    syncWaliKelasTugasTambahanFromState();
  });

  unsubscribeTugasTambahanMapel = listenMapel(data => {
    semuaDataMapelTugasTambahan = data;
    tugasTambahanSyncReady.mapel = true;
    syncWaliKelasTugasTambahanFromState();
  });

  unsubscribeTugasTambahanKelas = listenKelas(data => {
    semuaDataKelasTugasTambahan = data;
    tugasTambahanSyncReady.kelas = true;
    syncWaliKelasTugasTambahanFromState();
  });
}

function renderTugasTambahanViews() {
  renderTugasTambahanTable();
  renderGuruTugasTambahanMatrix();
}

function setTugasTambahanTab(tab) {
  tugasTambahanActiveTab = tab === "tugas" ? "tugas" : "guru";
  setTugasTambahanMatrixInteractionState(false);
  const content = document.getElementById("tugasTambahanTabContent");
  if (content) {
    content.innerHTML = tugasTambahanActiveTab === "guru" ? renderTugasTambahanGuruTab() : renderTugasTambahanDaftarTab();
  }
  requestRenderTugasTambahanViews();
  document.querySelectorAll(".tugas-tabbar button").forEach(button => {
    button.classList.toggle("active", button.textContent.trim() === (tugasTambahanActiveTab === "guru" ? "Guru" : "Tugas Tambahan"));
  });
}

async function seedDefaultTugasTambahan() {
  if (isSeedingTugasTambahan) return;
  isSeedingTugasTambahan = true;
  try {
    const batch = db.batch();
    batch.set(db.collection("tugas_tambahan").doc(FIXED_KEPALA_SEKOLAH_TASK_ID), {
      nama: FIXED_KEPALA_SEKOLAH_TASK_NAME,
      jenis: "Utama",
      jp: FIXED_KEPALA_SEKOLAH_TASK_JP,
      urutan: 0,
      created_at: new Date(),
      updated_at: new Date()
    }, { merge: true });
    DEFAULT_TUGAS_TAMBAHAN.forEach((item, index) => {
      const ref = db.collection("tugas_tambahan").doc(makeTugasTambahanId(item.nama, item.jenis));
      batch.set(ref, {
        ...item,
        urutan: index + 1,
        created_at: new Date(),
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Data awal tugas tambahan belum berhasil dibuat.", "error");
  } finally {
    isSeedingTugasTambahan = false;
  }
}

async function ensureFixedKepalaSekolahTugasTambahan() {
  if (isEnsuringFixedKepalaSekolahTask) return;
  const existing = semuaDataTugasTambahan.find(item => isFixedKepalaSekolahTugasTambahan(item));
  if (existing && String(existing.jenis || "").trim() === "Utama") return;

  isEnsuringFixedKepalaSekolahTask = true;
  try {
    await db.collection("tugas_tambahan").doc(FIXED_KEPALA_SEKOLAH_TASK_ID).set({
      nama: String(existing?.nama || "").trim() || FIXED_KEPALA_SEKOLAH_TASK_NAME,
      jenis: "Utama",
      jp: Number(existing?.jp ?? FIXED_KEPALA_SEKOLAH_TASK_JP),
      urutan: 0,
      created_at: existing?.created_at || new Date(),
      updated_at: new Date()
    }, { merge: true });
  } catch (error) {
    console.error("Gagal memastikan baris KS", error);
  } finally {
    isEnsuringFixedKepalaSekolahTask = false;
  }
}

function renderTugasTambahanTable() {
  const tbody = document.getElementById("tbodyTugasTambahan");
  const empty = document.getElementById("emptyStateTugasTambahan");
  const info = document.getElementById("jumlahDataTugasTambahan");

  const rows = sortTugasTambahan(semuaDataTugasTambahan);
  if (info) info.innerText = `${rows.length} tugas tambahan | ${semuaDataGuruTugasTambahan.length} guru`;
  if (!tbody) return;

  tbody.innerHTML = [
    ...rows.map(renderTugasTambahanRow),
    renderTugasTambahanInputRow()
  ].join("");

  if (empty) empty.style.display = rows.length ? "none" : "block";
}

function getTugasTambahanByJenis(jenis) {
  return sortTugasTambahan(semuaDataTugasTambahan).filter(item => item.jenis === jenis);
}

function getGuruTugasTambahanAssignment(guruKode) {
  return semuaDataGuruTugasTambahanAssignments.find(item => String(item.guru_kode || "") === String(guruKode || "")) || {};
}

function getNamaGuruTugasTambahan(guru) {
  return typeof formatNamaGuru === "function" ? formatNamaGuru(guru) : guru.nama || guru.kode_guru || "";
}

function getGuruMatrixLabel(guru) {
  const nama = getNamaGuruTugasTambahan(guru);
  const parts = nama.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return nama || guru.kode_guru || "-";
  return `${parts[0]} ${parts[1]}`;
}

function getSortedGuruTugasTambahan() {
  return [...semuaDataGuruTugasTambahan].sort((a, b) =>
    String(a.kode_guru || "").localeCompare(String(b.kode_guru || ""), undefined, { numeric: true, sensitivity: "base" })
  );
}

function renderTugasTambahanOptions(jenis, selectedValue = "") {
  const options = [`<option value="">Tidak ada</option>`];
  getTugasTambahanByJenis(jenis).forEach(item => {
    const selected = item.id === selectedValue ? "selected" : "";
    options.push(`<option value="${escapeTugasTambahanHtml(item.id)}" ${selected}>${escapeTugasTambahanHtml(item.nama)} (${Number(item.jp || 0)} JP)</option>`);
  });
  return options.join("");
}

function getTugasTambahanSelectId(field, guruKode) {
  return `tt-${field}-${String(guruKode || "").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function updateTugasTambahanSelectHighlight(selectEl) {
  if (!selectEl) return;
  selectEl.classList.toggle("is-filled", Boolean(selectEl.value));
}

function handleGuruTugasTambahanSelectChange(guruKode, field, selectEl) {
  if (!selectEl) return;
  updateTugasTambahanSelectHighlight(selectEl);
  updateGuruTugasTambahanDraft(guruKode, field, selectEl.value);
  setTugasTambahanMatrixInteractionState(false);
  requestRenderTugasTambahanViews();
}

function renderGuruTugasTambahanTable() {
  const tbody = document.getElementById("tbodyGuruTugasTambahan");
  const empty = document.getElementById("emptyStateGuruTugasTambahan");
  if (!tbody) return;

  const rows = [...semuaDataGuruTugasTambahan].sort((a, b) => {
    const namaA = typeof getGuruSortName === "function" ? getGuruSortName(a) : getNamaGuruTugasTambahan(a);
    const namaB = typeof getGuruSortName === "function" ? getGuruSortName(b) : getNamaGuruTugasTambahan(b);
    return namaA.localeCompare(namaB, undefined, { sensitivity: "base" }) ||
      getNamaGuruTugasTambahan(a).localeCompare(getNamaGuruTugasTambahan(b), undefined, { sensitivity: "base" });
  });

  tbody.innerHTML = rows.map(guru => {
    const kode = String(guru.kode_guru || "").trim();
    const safeKode = escapeTugasTambahanJs(kode);
    const assignment = getGuruTugasTambahanAssignment(kode);
    const namaGuru = typeof formatNamaGuru === "function" ? formatNamaGuru(guru) : guru.nama || kode;

    return `
      <tr>
        <td>${escapeTugasTambahanHtml(namaGuru || "-")}</td>
        <td><select id="ttUtama-${escapeTugasTambahanHtml(kode)}" class="kelas-inline-select">${renderTugasTambahanOptions("Utama", assignment.utama_id || "")}</select></td>
        <td><select id="ttEkuivalen1-${escapeTugasTambahanHtml(kode)}" class="kelas-inline-select">${renderTugasTambahanOptions("Ekuivalen", assignment.ekuivalen_1_id || "")}</select></td>
        <td><select id="ttEkuivalen2-${escapeTugasTambahanHtml(kode)}" class="kelas-inline-select">${renderTugasTambahanOptions("Ekuivalen", assignment.ekuivalen_2_id || "")}</select></td>
        <td><select id="ttEkuivalen3-${escapeTugasTambahanHtml(kode)}" class="kelas-inline-select">${renderTugasTambahanOptions("Ekuivalen", assignment.ekuivalen_3_id || "")}</select></td>
        <td><select id="ttSekolah1-${escapeTugasTambahanHtml(kode)}" class="kelas-inline-select">${renderTugasTambahanOptions("Sekolah", assignment.sekolah_1_id || assignment.sekolah_id || "")}</select></td>
        <td><select id="ttSekolah2-${escapeTugasTambahanHtml(kode)}" class="kelas-inline-select">${renderTugasTambahanOptions("Sekolah", assignment.sekolah_2_id || "")}</select></td>
        <td><select id="ttSekolah3-${escapeTugasTambahanHtml(kode)}" class="kelas-inline-select">${renderTugasTambahanOptions("Sekolah", assignment.sekolah_3_id || "")}</select></td>
        <td><button class="btn-primary" onclick="saveGuruTugasTambahan('${safeKode}')">Simpan</button></td>
      </tr>
    `;
  }).join("");

  if (empty) empty.style.display = rows.length ? "none" : "block";
}

function getSelectedTugasTambahan(guruKode, field) {
  const idPrefix = {
    utama_id: "ttUtama",
    ekuivalen_1_id: "ttEkuivalen1",
    ekuivalen_2_id: "ttEkuivalen2",
    ekuivalen_3_id: "ttEkuivalen3",
    sekolah_1_id: "ttSekolah1",
    sekolah_2_id: "ttSekolah2",
    sekolah_3_id: "ttSekolah3"
  }[field];
  const selectedId = document.getElementById(getTugasTambahanSelectId(field, guruKode))?.value || document.getElementById(`${idPrefix}-${guruKode}`)?.value || "";
  const item = semuaDataTugasTambahan.find(entry => entry.id === selectedId) || null;
  return { selectedId, item };
}

function calculateGuruTugasTambahanJpFromAssignment(assignment) {
  return ["utama_id", "ekuivalen_1_id", "ekuivalen_2_id", "ekuivalen_3_id", "sekolah_1_id", "sekolah_2_id", "sekolah_3_id"].reduce((sum, key) => {
    const item = semuaDataTugasTambahan.find(entry => entry.id === assignment[key]);
    return sum + Number(item?.jp || 0);
  }, 0);
}

function calculateMengajarJpForGuru(guruKode) {
  return semuaDataMengajarTugasTambahan.reduce((sum, item) => {
    if (String(item.guru_kode || "") !== String(guruKode || "")) return sum;
    const mapel = semuaDataMapelTugasTambahan.find(entry => String(entry.kode_mapel || "").trim().toUpperCase() === String(item.mapel_kode || "").trim().toUpperCase());
    return sum + Number(mapel?.jp || 0);
  }, 0);
}

function buildGuruJpTugasTambahanPayload(guruKode, assignment) {
  const mengajarJp = calculateMengajarJpForGuru(guruKode);
  const tugasJp = calculateGuruTugasTambahanJpFromAssignment(assignment);
  return {
    jp: mengajarJp + tugasJp,
    jp_mengajar: mengajarJp,
    jp_tugas_tambahan: tugasJp,
    updated_at: new Date()
  };
}

function updateLocalGuruJpCache(guruKode, payload) {
  semuaDataGuruTugasTambahan = semuaDataGuruTugasTambahan.map(item =>
    String(item.kode_guru || "").trim() === String(guruKode || "").trim()
      ? { ...item, ...payload }
      : item
  );
  if (typeof semuaDataGuru !== "undefined" && Array.isArray(semuaDataGuru)) {
    semuaDataGuru = semuaDataGuru.map(item =>
      String(item.kode_guru || "").trim() === String(guruKode || "").trim()
        ? { ...item, ...payload }
        : item
    );
  }
}

async function syncGuruJpWithTugasTambahan(guruKode, assignment) {
  const payload = buildGuruJpTugasTambahanPayload(guruKode, assignment);
  await db.collection("guru").doc(guruKode).set(payload, { merge: true });
  updateLocalGuruJpCache(guruKode, payload);
  return payload;
}

function buildGuruTugasTambahanAssignment(guruKode, guru) {
  const draft = getGuruTugasTambahanDraft(guruKode);
  if (draft) {
    return normalizeGuruTugasTambahanAssignmentRules({
      ...getGuruTugasTambahanBaseAssignment(guruKode),
      ...draft,
      guru_kode: guruKode,
      guru_nama: typeof formatNamaGuru === "function" ? formatNamaGuru(guru) : guru.nama || ""
    }, guruKode);
  }
  const utama = getSelectedTugasTambahan(guruKode, "utama_id");
  const ekuivalen1 = getSelectedTugasTambahan(guruKode, "ekuivalen_1_id");
  const ekuivalen2 = getSelectedTugasTambahan(guruKode, "ekuivalen_2_id");
  const ekuivalen3 = getSelectedTugasTambahan(guruKode, "ekuivalen_3_id");
  const sekolah1 = getSelectedTugasTambahan(guruKode, "sekolah_1_id");
  const sekolah2 = getSelectedTugasTambahan(guruKode, "sekolah_2_id");
  const sekolah3 = getSelectedTugasTambahan(guruKode, "sekolah_3_id");
  const assignment = {
    guru_kode: guruKode,
    guru_nama: typeof formatNamaGuru === "function" ? formatNamaGuru(guru) : guru.nama || "",
    utama_id: utama.selectedId,
    ekuivalen_1_id: ekuivalen1.selectedId,
    ekuivalen_2_id: ekuivalen2.selectedId,
    ekuivalen_3_id: ekuivalen3.selectedId,
    sekolah_1_id: sekolah1.selectedId,
    sekolah_2_id: sekolah2.selectedId,
    sekolah_3_id: sekolah3.selectedId,
    sekolah_id: sekolah1.selectedId,
    utama_nama: utama.item?.nama || "",
    ekuivalen_1_nama: ekuivalen1.item?.nama || "",
    ekuivalen_2_nama: ekuivalen2.item?.nama || "",
    ekuivalen_3_nama: ekuivalen3.item?.nama || "",
    sekolah_1_nama: sekolah1.item?.nama || "",
    sekolah_2_nama: sekolah2.item?.nama || "",
    sekolah_3_nama: sekolah3.item?.nama || "",
    sekolah_nama: sekolah1.item?.nama || "",
    jp_tugas_tambahan: 0,
    updated_at: new Date()
  };
  return normalizeGuruTugasTambahanAssignmentRules(assignment, guruKode);
}

function hasGuruTugasTambahanAssignmentChanged(existing = {}, next = {}) {
  const fields = [
    "utama_id", "ekuivalen_1_id", "ekuivalen_2_id", "ekuivalen_3_id",
    "sekolah_1_id", "sekolah_2_id", "sekolah_3_id", "sekolah_id",
    "utama_nama", "ekuivalen_1_nama", "ekuivalen_2_nama", "ekuivalen_3_nama",
    "sekolah_1_nama", "sekolah_2_nama", "sekolah_3_nama", "sekolah_nama",
    "jp_tugas_tambahan"
  ];
  return fields.some(field => String(existing[field] ?? "") !== String(next[field] ?? ""));
}

function assignmentUsesTugasTambahan(assignment = {}, taskId = "") {
  const id = String(taskId || "").trim();
  if (!id) return false;
  return [
    assignment.utama_id,
    assignment.ekuivalen_1_id,
    assignment.ekuivalen_2_id,
    assignment.ekuivalen_3_id,
    assignment.sekolah_1_id,
    assignment.sekolah_2_id,
    assignment.sekolah_3_id,
    assignment.sekolah_id
  ].some(value => String(value || "").trim() === id);
}

function syncAssignmentTaskNames(assignment, taskId, taskName) {
  const pairs = [
    ["utama_id", "utama_nama"],
    ["ekuivalen_1_id", "ekuivalen_1_nama"],
    ["ekuivalen_2_id", "ekuivalen_2_nama"],
    ["ekuivalen_3_id", "ekuivalen_3_nama"],
    ["sekolah_1_id", "sekolah_1_nama"],
    ["sekolah_2_id", "sekolah_2_nama"],
    ["sekolah_3_id", "sekolah_3_nama"],
    ["sekolah_id", "sekolah_nama"]
  ];
  pairs.forEach(([idField, nameField]) => {
    if (String(assignment[idField] || "").trim() === String(taskId || "").trim()) {
      assignment[nameField] = taskName;
    }
  });
}

async function propagateTugasTambahanChanges(taskId, taskName) {
  const affectedAssignments = semuaDataGuruTugasTambahanAssignments.filter(item => assignmentUsesTugasTambahan(item, taskId));
  if (affectedAssignments.length === 0) return 0;

  const batch = db.batch();
  const localAssignments = [];
  affectedAssignments.forEach(item => {
    const nextAssignment = { ...item };
    syncAssignmentTaskNames(nextAssignment, taskId, taskName);
    nextAssignment.jp_tugas_tambahan = calculateGuruTugasTambahanJpFromAssignment(nextAssignment);
    nextAssignment.updated_at = new Date();
    const guruKode = String(nextAssignment.guru_kode || nextAssignment.id || "").trim();
    if (!guruKode) return;
    localAssignments.push({ guruKode, assignment: nextAssignment });
    batch.set(db.collection("guru_tugas_tambahan").doc(guruKode), nextAssignment, { merge: true });
    batch.set(db.collection("guru").doc(guruKode), buildGuruJpTugasTambahanPayload(guruKode, nextAssignment), { merge: true });
  });

  if (localAssignments.length === 0) return 0;
  await batch.commit();

  semuaDataGuruTugasTambahanAssignments = semuaDataGuruTugasTambahanAssignments.map(item => {
    const found = localAssignments.find(entry => entry.guruKode === String(item.guru_kode || item.id || "").trim());
    return found ? found.assignment : item;
  });
  localAssignments.forEach(entry => {
    clearGuruTugasTambahanDraft(entry.guruKode);
    updateLocalGuruJpCache(entry.guruKode, buildGuruJpTugasTambahanPayload(entry.guruKode, entry.assignment));
  });
  requestRenderTugasTambahanViews();
  return localAssignments.length;
}

function getWaliKelasTugasTambahanItem() {
  return semuaDataTugasTambahan.find(item =>
    String(item.jenis || "") === "Ekuivalen" &&
    String(item.nama || "").trim().toLowerCase() === "wali kelas"
  ) || null;
}

function getWaliKelasGuruCodes() {
  return new Set(
    semuaDataKelasTugasTambahan
      .map(item => String(item.kode_guru || "").trim())
      .filter(Boolean)
  );
}

function normalizeGuruTugasTambahanAssignment(guru, existing = {}) {
  const guruKode = String(guru.kode_guru || "").trim();
  return {
    guru_kode: guruKode,
    guru_nama: getNamaGuruTugasTambahan(guru),
    utama_id: existing.utama_id || "",
    ekuivalen_1_id: existing.ekuivalen_1_id || "",
    ekuivalen_2_id: existing.ekuivalen_2_id || "",
    ekuivalen_3_id: existing.ekuivalen_3_id || "",
    sekolah_1_id: existing.sekolah_1_id || existing.sekolah_id || "",
    sekolah_2_id: existing.sekolah_2_id || "",
    sekolah_3_id: existing.sekolah_3_id || "",
    sekolah_id: existing.sekolah_1_id || existing.sekolah_id || "",
    utama_nama: existing.utama_nama || "",
    ekuivalen_1_nama: existing.ekuivalen_1_nama || "",
    ekuivalen_2_nama: existing.ekuivalen_2_nama || "",
    ekuivalen_3_nama: existing.ekuivalen_3_nama || "",
    sekolah_1_nama: existing.sekolah_1_nama || existing.sekolah_nama || "",
    sekolah_2_nama: existing.sekolah_2_nama || "",
    sekolah_3_nama: existing.sekolah_3_nama || "",
    sekolah_nama: existing.sekolah_1_nama || existing.sekolah_nama || "",
    updated_at: new Date()
  };
}

function applyWaliKelasToAssignment(assignment, waliItem, shouldHaveWali) {
  const before = JSON.stringify({
    utama_id: assignment.utama_id || "",
    utama_nama: assignment.utama_nama || "",
    ekuivalen_1_id: assignment.ekuivalen_1_id || "",
    ekuivalen_1_nama: assignment.ekuivalen_1_nama || "",
    ekuivalen_2_id: assignment.ekuivalen_2_id || "",
    ekuivalen_2_nama: assignment.ekuivalen_2_nama || "",
    ekuivalen_3_id: assignment.ekuivalen_3_id || "",
    ekuivalen_3_nama: assignment.ekuivalen_3_nama || "",
    jp_tugas_tambahan: assignment.jp_tugas_tambahan || 0
  });

  const guruKode = String(assignment.guru_kode || "").trim();
  const nextAssignment = normalizeGuruTugasTambahanAssignmentRules({
    ...assignment,
    ekuivalen_1_id: shouldHaveWali ? waliItem.id : assignment.ekuivalen_1_id,
    ekuivalen_1_nama: shouldHaveWali ? (waliItem.nama || "Wali Kelas") : assignment.ekuivalen_1_nama
  }, guruKode);

  Object.assign(assignment, nextAssignment);

  const after = JSON.stringify({
    utama_id: assignment.utama_id || "",
    utama_nama: assignment.utama_nama || "",
    ekuivalen_1_id: assignment.ekuivalen_1_id || "",
    ekuivalen_1_nama: assignment.ekuivalen_1_nama || "",
    ekuivalen_2_id: assignment.ekuivalen_2_id || "",
    ekuivalen_2_nama: assignment.ekuivalen_2_nama || "",
    ekuivalen_3_id: assignment.ekuivalen_3_id || "",
    ekuivalen_3_nama: assignment.ekuivalen_3_nama || "",
    jp_tugas_tambahan: assignment.jp_tugas_tambahan || 0
  });
  return before !== after;
}

async function syncWaliKelasTugasTambahanFromState() {
  if (isSyncingWaliKelasTugasTambahan) return;
  if (!Object.values(tugasTambahanSyncReady).every(Boolean)) return;
  const waliItem = getWaliKelasTugasTambahanItem();
  if (!waliItem || semuaDataGuruTugasTambahan.length === 0 || semuaDataKelasTugasTambahan.length === 0) return;

  isSyncingWaliKelasTugasTambahan = true;
  try {
    const waliCodes = getWaliKelasGuruCodes();
    const batch = db.batch();
    const guruUpdates = [];

    semuaDataGuruTugasTambahan.forEach(guru => {
      const guruKode = String(guru.kode_guru || "").trim();
      if (!guruKode) return;

      const existing = getGuruTugasTambahanAssignment(guruKode);
      const hasExisting = Boolean(existing.guru_kode || existing.id);
      const shouldHaveWali = waliCodes.has(guruKode);
      if (!hasExisting && !shouldHaveWali) return;

      const assignment = normalizeGuruTugasTambahanAssignment(guru, existing);
      const changed = applyWaliKelasToAssignment(assignment, waliItem, shouldHaveWali);
      if (!changed) return;

      batch.set(db.collection("guru_tugas_tambahan").doc(guruKode), assignment, { merge: true });
      batch.set(db.collection("guru").doc(guruKode), buildGuruJpTugasTambahanPayload(guruKode, assignment), { merge: true });
      guruUpdates.push({ guruKode, assignment });
    });

    if (guruUpdates.length === 0) return;

    await batch.commit();
    guruUpdates.forEach(update => updateLocalGuruJpCache(update.guruKode, buildGuruJpTugasTambahanPayload(update.guruKode, update.assignment)));
  } catch (error) {
    console.error("Gagal sinkron wali kelas ke tugas tambahan", error);
  } finally {
    isSyncingWaliKelasTugasTambahan = false;
  }
}

async function syncWaliKelasTugasTambahan() {
  try {
    const [tugasSnapshot, guruSnapshot, assignmentSnapshot, kelasSnapshot, mengajarSnapshot, mapelSnapshot] = await Promise.all([
      db.collection("tugas_tambahan").get(),
      db.collection("guru").get(),
      db.collection("guru_tugas_tambahan").get(),
      (typeof getSemesterCollectionQuery === "function" ? getSemesterCollectionQuery("kelas") : db.collection("kelas")).get(),
      db.collection("mengajar").get(),
      db.collection("mapel").get()
    ]);

    semuaDataTugasTambahan = tugasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    semuaDataGuruTugasTambahan = guruSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    semuaDataGuruTugasTambahanAssignments = assignmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    semuaDataKelasTugasTambahan = kelasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    semuaDataMengajarTugasTambahan = mengajarSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    semuaDataMapelTugasTambahan = mapelSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    tugasTambahanSyncReady = {
      tugas: true,
      guru: true,
      assignments: true,
      mengajar: true,
      mapel: true,
      kelas: true
    };

    await syncWaliKelasTugasTambahanFromState();
  } catch (error) {
    console.error("Gagal mengambil data sinkron wali kelas", error);
  }
}

async function saveGuruTugasTambahan(guruKode) {
  setTugasTambahanMatrixInteractionState(false);
  const guru = semuaDataGuruTugasTambahan.find(item => String(item.kode_guru || "") === String(guruKode || ""));
  if (!guru) {
    Swal.fire("Guru tidak ditemukan", "", "warning");
    return;
  }
  const assignment = buildGuruTugasTambahanAssignment(guruKode, guru);
  const existing = getGuruTugasTambahanAssignment(guruKode);
  if (hasGuruTugasTambahanAssignmentChanged(existing, assignment) === false) {
    if (typeof showInlineSaveNotificationForData === "function") {
      showInlineSaveNotificationForData("data-guru-tugas-kode", guruKode, "Tidak ada perubahan");
    }
    return;
  }

  try {
    const guruPayload = buildGuruJpTugasTambahanPayload(guruKode, assignment);
    await Promise.all([
      db.collection("guru_tugas_tambahan").doc(guruKode).set(assignment, { merge: true }),
      db.collection("guru").doc(guruKode).set(guruPayload, { merge: true })
    ]);
    updateLocalGuruJpCache(guruKode, guruPayload);
    clearGuruTugasTambahanDraft(guruKode);
    semuaDataGuruTugasTambahanAssignments = [
      ...semuaDataGuruTugasTambahanAssignments.filter(item => String(item.guru_kode || item.id || "").trim() !== String(guruKode || "").trim()),
      { id: guruKode, ...assignment }
    ];
    requestRenderTugasTambahanViews();
    if (typeof showInlineSaveNotificationForData === "function") {
      showInlineSaveNotificationForData("data-guru-tugas-kode", guruKode, "Tersimpan");
    }
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Tugas tambahan guru belum berhasil disimpan.", "error");
  }
}

async function saveAllGuruTugasTambahan() {
  setTugasTambahanMatrixInteractionState(false);
  const gurus = getSortedGuruTugasTambahan().filter(guru => String(guru.kode_guru || "").trim());
  if (gurus.length === 0) {
    Swal.fire("Belum ada guru", "", "info");
    return;
  }

  try {
    Swal.fire({ title: "Menyimpan matriks tugas tambahan...", didOpen: () => Swal.showLoading() });
    const batch = db.batch();
    const guruUpdates = [];

    gurus.forEach(guru => {
      const guruKode = String(guru.kode_guru || "").trim();
      const assignment = buildGuruTugasTambahanAssignment(guruKode, guru);

      batch.set(db.collection("guru_tugas_tambahan").doc(guruKode), assignment, { merge: true });
      batch.set(db.collection("guru").doc(guruKode), buildGuruJpTugasTambahanPayload(guruKode, assignment), { merge: true });
      guruUpdates.push({ guruKode, assignment });
    });

    await batch.commit();
    guruUpdates.forEach(update => {
      clearGuruTugasTambahanDraft(update.guruKode);
      updateLocalGuruJpCache(update.guruKode, buildGuruJpTugasTambahanPayload(update.guruKode, update.assignment));
    });
    Swal.fire("Berhasil", `${guruUpdates.length} guru diperbarui.`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Matriks tugas tambahan belum berhasil disimpan.", "error");
  }
}

function renderTugasTambahanRow(item) {
  const safeId = escapeTugasTambahanJs(item.id || "");
  const isFixedKs = isFixedKepalaSekolahTugasTambahan(item);

  if (currentEditTugasTambahan === item.id) {
    return `
      <tr class="table-edit-row mapel-edit-row" data-tugas-tambahan-id="${escapeTugasTambahanHtml(item.id || "")}">
        <td>
          <input value="${escapeTugasTambahanHtml(item.id || "")}" readonly>
        </td>
        <td>
          <input id="editNamaTugasTambahan" value="${escapeTugasTambahanHtml(item.nama || "")}" onfocus="handleTugasTambahanUiFocus()" onblur="handleTugasTambahanUiBlur()" onkeydown="handleTugasTambahanEditKey(event, '${safeId}')">
          <div id="err-editNamaTugasTambahan" class="error-text"></div>
        </td>
        <td>
          <select id="editJenisTugasTambahan" onfocus="handleTugasTambahanUiFocus()" onblur="handleTugasTambahanUiBlur()" onkeydown="handleTugasTambahanEditKey(event, '${safeId}')" ${isFixedKs ? "disabled" : ""}>
            <option value="Utama" ${item.jenis === "Utama" ? "selected" : ""}>Utama</option>
            <option value="Ekuivalen" ${item.jenis === "Ekuivalen" ? "selected" : ""}>Ekuivalen</option>
            <option value="Sekolah" ${item.jenis === "Sekolah" ? "selected" : ""}>Sekolah</option>
          </select>
        </td>
        <td>
          <input id="editJpTugasTambahan" type="number" min="0" value="${escapeTugasTambahanHtml(item.jp ?? "")}" onfocus="handleTugasTambahanUiFocus()" onblur="handleTugasTambahanUiBlur()" onkeydown="handleTugasTambahanEditKey(event, '${safeId}')">
          <div id="err-editJpTugasTambahan" class="error-text"></div>
        </td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn-primary btn-table-compact tugas-btn-compact" onmousedown="handleTugasTambahanUiButtonDown()" onclick="saveEditTugasTambahan('${safeId}')">Simpan</button>
            <button type="button" class="btn-secondary btn-table-compact tugas-btn-compact" onmousedown="handleTugasTambahanUiButtonDown()" onclick="cancelEditTugasTambahan()">Batal</button>
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr data-tugas-tambahan-id="${escapeTugasTambahanHtml(item.id || "")}">
      <td><strong>${escapeTugasTambahanHtml(item.id || "-")}</strong></td>
      <td>${escapeTugasTambahanHtml(item.nama || "-")}</td>
      <td><span class="kelas-bayangan-chip ${item.jenis === "Utama" ? "ok" : ""}">${escapeTugasTambahanHtml(item.jenis || "-")}</span></td>
      <td>${escapeTugasTambahanHtml(item.jp ?? "-")} JP</td>
      <td>
        <div class="table-actions">
          <button type="button" class="btn-secondary btn-table-compact tugas-btn-compact" onmousedown="handleTugasTambahanUiButtonDown()" onclick="editTugasTambahan('${safeId}')">Edit</button>
          ${isFixedKs ? "" : `<button type="button" class="btn-secondary btn-danger-lite btn-table-compact tugas-btn-compact" onmousedown="handleTugasTambahanUiButtonDown()" onclick="hapusTugasTambahan('${safeId}')">Hapus</button>`}
        </div>
      </td>
    </tr>
  `;
}

function renderTugasTambahanInputRow() {
  return `
    <tr class="mapel-input-row">
      <td>
        <input class="mapel-inline-input mapel-inline-input-center" value="Otomatis" readonly>
      </td>
      <td>
        <input id="namaTugasTambahan" class="mapel-inline-input" placeholder="Nama tugas tambahan" value="${escapeTugasTambahanHtml(tugasTambahanInputDraft.nama || "")}" onfocus="handleTugasTambahanUiFocus()" onblur="handleTugasTambahanUiBlur()" oninput="updateTugasTambahanInputDraft('nama', this.value)" onkeydown="handleTugasTambahanKey(event)">
        <div id="err-namaTugasTambahan" class="error-text"></div>
      </td>
      <td>
        <select id="jenisTugasTambahan" class="kelas-inline-select" onfocus="handleTugasTambahanUiFocus()" onblur="handleTugasTambahanUiBlur()" oninput="updateTugasTambahanInputDraft('jenis', this.value)" onkeydown="handleTugasTambahanKey(event)">
          <option value="Utama" ${tugasTambahanInputDraft.jenis === "Utama" ? "selected" : ""}>Utama</option>
          <option value="Ekuivalen" ${tugasTambahanInputDraft.jenis === "Ekuivalen" ? "selected" : ""}>Ekuivalen</option>
          <option value="Sekolah" ${tugasTambahanInputDraft.jenis === "Sekolah" ? "selected" : ""}>Sekolah</option>
        </select>
      </td>
      <td>
        <input id="jpTugasTambahan" class="mapel-inline-input mapel-inline-input-center" type="number" min="0" placeholder="0" value="${escapeTugasTambahanHtml(tugasTambahanInputDraft.jp || "")}" onfocus="handleTugasTambahanUiFocus()" onblur="handleTugasTambahanUiBlur()" oninput="updateTugasTambahanInputDraft('jp', this.value)" onkeydown="handleTugasTambahanKey(event)">
        <div id="err-jpTugasTambahan" class="error-text"></div>
      </td>
      <td>
        <button id="btnSimpanTugasTambahan" type="button" class="btn-primary btn-inline-mapel tugas-btn-compact" onmousedown="handleTugasTambahanUiButtonDown()" onclick="simpanTugasTambahan()">Tambah</button>
      </td>
    </tr>
  `;
}

function setTugasTambahanError(id, message) {
  const input = document.getElementById(id);
  const err = document.getElementById("err-" + id);
  if (!input || !err) return;
  input.classList.toggle("input-error", Boolean(message));
  err.innerText = message || "";
}

function validateTugasTambahanForm() {
  const nama = document.getElementById("namaTugasTambahan")?.value.trim() || "";
  const jp = document.getElementById("jpTugasTambahan")?.value.trim() || "";
  let valid = true;

  if (nama.length < 3) {
    setTugasTambahanError("namaTugasTambahan", "Nama minimal 3 karakter");
    valid = false;
  } else {
    setTugasTambahanError("namaTugasTambahan", "");
  }

  if (!/^[0-9]+$/.test(jp) || Number(jp) < 0) {
    setTugasTambahanError("jpTugasTambahan", "JP minimal 0");
    valid = false;
  } else if (Number(jp) > 99) {
    setTugasTambahanError("jpTugasTambahan", "JP maksimal 99");
    valid = false;
  } else {
    setTugasTambahanError("jpTugasTambahan", "");
  }

  return valid;
}

async function simpanTugasTambahan() {
  setTugasTambahanMatrixInteractionState(false);
  if (isSubmittingTugasTambahan) return;
  if (!validateTugasTambahanForm()) return;

  const namaEl = document.getElementById("namaTugasTambahan");
  const jenisEl = document.getElementById("jenisTugasTambahan");
  const jpEl = document.getElementById("jpTugasTambahan");
  const btn = document.getElementById("btnSimpanTugasTambahan");
  const nama = namaEl.value.trim();
  const jenis = jenisEl.value;
  const jp = Number(jpEl.value.trim());
  const id = makeTugasTambahanId(nama, jenis);

  const duplicate = semuaDataTugasTambahan.some(item => item.id === id);
  if (duplicate) {
    setTugasTambahanError("namaTugasTambahan", "Tugas tambahan sudah ada");
    return;
  }

  try {
    isSubmittingTugasTambahan = true;
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Menyimpan...";
    }

    await db.collection("tugas_tambahan").doc(id).set({
      nama,
      jenis,
      jp,
      urutan: semuaDataTugasTambahan.length + 1,
      created_at: new Date(),
      updated_at: new Date()
    });

    namaEl.value = "";
    jpEl.value = "";
    resetTugasTambahanInputDraft();
    setTugasTambahanError("namaTugasTambahan", "");
    setTugasTambahanError("jpTugasTambahan", "");
    Swal.fire("Berhasil", "Tugas tambahan ditambahkan.", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Tugas tambahan belum berhasil ditambahkan.", "error");
  } finally {
    isSubmittingTugasTambahan = false;
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Tambah";
    }
  }
}

function handleTugasTambahanKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    simpanTugasTambahan();
  }
}

function editTugasTambahan(id) {
  setTugasTambahanMatrixInteractionState(false);
  currentEditTugasTambahan = id;
  renderTugasTambahanTable();
}

function cancelEditTugasTambahan() {
  setTugasTambahanMatrixInteractionState(false);
  currentEditTugasTambahan = null;
  renderTugasTambahanTable();
}

function handleTugasTambahanEditKey(event, id) {
  if (event.key === "Enter") {
    event.preventDefault();
    saveEditTugasTambahan(id);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEditTugasTambahan();
  }
}

function validateTugasTambahanEditForm() {
  const nama = document.getElementById("editNamaTugasTambahan")?.value.trim() || "";
  const jp = document.getElementById("editJpTugasTambahan")?.value.trim() || "";
  let valid = true;

  if (nama.length < 3) {
    setTugasTambahanError("editNamaTugasTambahan", "Nama minimal 3 karakter");
    valid = false;
  } else {
    setTugasTambahanError("editNamaTugasTambahan", "");
  }

  if (!/^[0-9]+$/.test(jp) || Number(jp) < 0) {
    setTugasTambahanError("editJpTugasTambahan", "JP minimal 0");
    valid = false;
  } else if (Number(jp) > 99) {
    setTugasTambahanError("editJpTugasTambahan", "JP maksimal 99");
    valid = false;
  } else {
    setTugasTambahanError("editJpTugasTambahan", "");
  }

  return valid;
}

async function saveEditTugasTambahan(id) {
  setTugasTambahanMatrixInteractionState(false);
  if (!validateTugasTambahanEditForm()) return;

  const existing = semuaDataTugasTambahan.find(item => item.id === id);
  if (!existing) {
    Swal.fire("Data tidak ditemukan", "", "warning");
    return;
  }

  const nama = document.getElementById("editNamaTugasTambahan")?.value.trim() || "";
  const jenis = isFixedKepalaSekolahTugasTambahan(existing)
    ? "Utama"
    : (document.getElementById("editJenisTugasTambahan")?.value || "Utama");
  const jp = Number(document.getElementById("editJpTugasTambahan")?.value.trim() || 0);
  const duplicate = semuaDataTugasTambahan.some(item =>
    item.id !== id &&
    String(item.nama || "").trim().toLowerCase() === nama.toLowerCase() &&
    String(item.jenis || "") === jenis
  );

  if (duplicate) {
    setTugasTambahanError("editNamaTugasTambahan", "Tugas tambahan sudah ada");
    return;
  }

  try {
    const tugasPayload = {
      ...existing,
      nama,
      jenis,
      jp,
      updated_at: new Date()
    };
    await db.collection("tugas_tambahan").doc(id).set(tugasPayload, { merge: true });
    semuaDataTugasTambahan = semuaDataTugasTambahan.map(item =>
      item.id === id ? { ...item, ...tugasPayload } : item
    );
    await propagateTugasTambahanChanges(id, nama);

    currentEditTugasTambahan = null;
    renderTugasTambahanTable();
    if (typeof showInlineSaveNotificationForData === "function") {
      showInlineSaveNotificationForData("data-tugas-tambahan-id", id, "Tersimpan");
    }
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Tugas tambahan belum berhasil diperbarui.", "error");
  }
}

async function hapusTugasTambahan(id) {
  setTugasTambahanMatrixInteractionState(false);
  const item = semuaDataTugasTambahan.find(entry => entry.id === id);
  if (isFixedKepalaSekolahTugasTambahan(item)) {
    Swal.fire("Tidak bisa dihapus", "Baris KS adalah tugas tambahan tetap.", "info");
    return;
  }
  const confirm = await Swal.fire({
    title: "Hapus tugas tambahan?",
    text: item?.nama || "Data ini akan dihapus.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal"
  });

  if (!confirm.isConfirmed) return;

  try {
    await db.collection("tugas_tambahan").doc(id).delete();
    if (currentEditTugasTambahan === id) currentEditTugasTambahan = null;
    Swal.fire("Berhasil", "Tugas tambahan dihapus.", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Tugas tambahan belum berhasil dihapus.", "error");
  }
}
