let semuaDataAdminGuru = [];
let semuaDataAdminUser = [];
let semuaDataAdminSiswa = [];
let semuaDataAdminKoordinator = {};
let unsubscribeAdminGuru = null;
let unsubscribeAdminUser = null;
let unsubscribeAdminSiswa = null;
let unsubscribeAdminKoordinator = null;
let currentEditAdminUser = null;
let adminKoordinatorDraft = null;
let isInteractingAdminHierarchyUi = false;
let pendingAdminUsersRender = false;
let isSyncingGuruDerivedUsernames = false;
let hasSyncedGuruDerivedUsernames = false;

const DEFAULT_USER_PASSWORD = "kurikulumspenturi";
const USER_ROLES = ["admin", "guru", "koordinator", "urusan", "siswa"];
const KOORDINATOR_LEVELS = [
  { key: "kelas_7", label: "Kelas 7" },
  { key: "kelas_8", label: "Kelas 8" },
  { key: "kelas_9", label: "Kelas 9" }
];

function escapeAdminHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function makeUsernameFromName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function getAdminGuruName(guru) {
  if (typeof formatNamaGuru === "function") return formatNamaGuru(guru);
  return [guru?.gelar_depan, guru?.nama, guru?.gelar_belakang].filter(Boolean).join(" ") || guru?.nama || "";
}

function stripAdminGuruTitles(value = "") {
  if (typeof stripGuruTitlesFromName === "function") return stripGuruTitlesFromName(value);
  return String(value || "")
    .replace(/\b(Drs?|Dra|Prof|Hj?|Ir)\.?(?=\s|,|$)/gi, " ")
    .replace(/\b(S|M|D)\.?\s?(Pd|Si|Ag|Kom|H|E|Ak|Ikom|Hum|Kes|Kep|Farm|T|Sc|A)\.?(?=\s|,|$)/gi, " ")
    .replace(/,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAdminGuruUsernameName(guru = {}) {
  const nama = String(guru?.nama || "").trim();
  if (nama) return nama;
  return stripAdminGuruTitles(guru?.nama_lengkap || getAdminGuruName(guru));
}

function makeGuruUsername(guru) {
  const nip = String(guru?.nip || "").trim();
  return nip || makeUsernameFromName(getAdminGuruUsernameName(guru));
}

function makeUserDocId(username) {
  return makeUsernameFromName(username);
}

function getUserByUsername(username) {
  const target = makeUserDocId(username);
  return semuaDataAdminUser.find(item => makeUserDocId(item.username || item.id) === target) || null;
}

function getGuruByKode(kodeGuru) {
  return semuaDataAdminGuru.find(item => String(item.kode_guru || "") === String(kodeGuru || "")) || null;
}

function getSiswaByNipd(nipd) {
  return semuaDataAdminSiswa.find(item => String(item.nipd || "") === String(nipd || "")) || null;
}

function getKoordinatorDocRef() {
  return db.collection("informasi_urusan").doc("koordinator_kelas");
}

function sortAdminGuruList(list = []) {
  return [...list].sort((a, b) =>
    String(getAdminGuruName(a) || a.kode_guru || "").localeCompare(
      String(getAdminGuruName(b) || b.kode_guru || ""),
      undefined,
      { sensitivity: "base" }
    )
  );
}

function getAdminKoordinatorSnapshot() {
  return {
    kelas_7: String(semuaDataAdminKoordinator.kelas_7 || "").trim(),
    kelas_8: String(semuaDataAdminKoordinator.kelas_8 || "").trim(),
    kelas_9: String(semuaDataAdminKoordinator.kelas_9 || "").trim()
  };
}

function getAdminKoordinatorEffectiveData() {
  return adminKoordinatorDraft ? { ...getAdminKoordinatorSnapshot(), ...adminKoordinatorDraft } : getAdminKoordinatorSnapshot();
}

function getAdminKoordinatorGuru(code) {
  return getGuruByKode(code) || null;
}

function getAdminKoordinatorName(code) {
  const guru = getAdminKoordinatorGuru(code);
  return guru ? getAdminGuruName(guru) : "-";
}

function getAdminKoordinatorDisplayName(levelKey, code) {
  const guru = getAdminKoordinatorGuru(code);
  if (guru) return getAdminGuruName(guru);
  const storedName = String(semuaDataAdminKoordinator?.[`${levelKey}_nama`] || "").trim();
  return storedName || "-";
}

function showAdminFloatingToast(message = "Tersimpan", type = "success") {
  if (typeof showFloatingToast === "function") {
    return showFloatingToast(message, type);
  }
  document.querySelectorAll(".admin-floating-toast").forEach(item => item.remove());
  const toast = document.createElement("div");
  toast.className = `admin-floating-toast ${type === "error" ? "is-error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("is-visible");
  }, 10);

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 260);
  }, 3000);
}

function getAdminKoordinatorFormDataFromDom() {
  return KOORDINATOR_LEVELS.reduce((result, item) => {
    result[item.key] = String(document.getElementById(`koordinator-${item.key}`)?.value || "").trim();
    return result;
  }, {});
}

function requestRenderAdminUsersState() {
  const hierarchyVisible = document.getElementById("adminHierarchySections");
  if (hierarchyVisible && isInteractingAdminHierarchyUi) {
    pendingAdminUsersRender = true;
    return;
  }
  pendingAdminUsersRender = false;
  renderAdminUsersState();
}

async function ensureGuruDerivedUsernames() {
  if (isSyncingGuruDerivedUsernames || hasSyncedGuruDerivedUsernames || semuaDataAdminGuru.length === 0 || semuaDataAdminUser.length === 0) return;

  const updates = semuaDataAdminUser
    .filter(user => ["guru", "koordinator", "admin", "urusan"].includes(String(user.role || "").trim().toLowerCase()))
    .filter(user => String(user.sumber || "").trim().toLowerCase() === "guru")
    .filter(user => !String(user.nip || "").trim())
    .map(user => {
      const guru = getGuruByKode(user.kode_guru) || null;
      if (!guru) return null;
      const nextUsername = makeGuruUsername(guru);
      const currentId = String(user.id || makeUserDocId(user.username)).trim();
      const nextId = makeUserDocId(nextUsername);
      if (!nextUsername || currentId === nextId) return null;
      if (semuaDataAdminUser.some(item => String(item.id || makeUserDocId(item.username)).trim() === nextId)) return null;
      return { user, guru, nextUsername, currentId, nextId };
    })
    .filter(Boolean);

  if (updates.length === 0) {
    hasSyncedGuruDerivedUsernames = true;
    return;
  }

  isSyncingGuruDerivedUsernames = true;
  try {
    const batch = db.batch();
    updates.forEach(({ user, nextUsername, nextId, currentId }) => {
      batch.set(db.collection("users").doc(nextId), {
        ...user,
        username: nextUsername,
        updated_at: new Date()
      }, { merge: true });
      batch.delete(db.collection("users").doc(currentId));
    });
    await batch.commit();
    hasSyncedGuruDerivedUsernames = true;
  } catch (error) {
    console.error("Gagal sinkron username guru turunan", error);
  } finally {
    isSyncingGuruDerivedUsernames = false;
  }
}

function hasAdminKoordinatorDraftSelection(draft = adminKoordinatorDraft) {
  return KOORDINATOR_LEVELS.some(item => String(draft?.[item.key] || "").trim());
}

function handleAdminHierarchyUiFocus() {
  isInteractingAdminHierarchyUi = true;
}

function handleAdminHierarchyUiBlur() {
  window.setTimeout(() => {
    const active = document.activeElement;
    if (active?.closest?.(".admin-koordinator-card")) return;
    isInteractingAdminHierarchyUi = false;
    if (pendingAdminUsersRender) requestRenderAdminUsersState();
  }, 90);
}

function handleAdminHierarchyUiButtonDown() {
  isInteractingAdminHierarchyUi = true;
}

function prepareGuruUser(guru, role = "guru") {
  const nama = getAdminGuruName(guru);
  const username = makeGuruUsername(guru);
  return {
    nama,
    username,
    password: DEFAULT_USER_PASSWORD,
    role,
    sumber: "guru",
    kode_guru: guru.kode_guru || "",
    nip: guru.nip || "",
    aktif: true,
    updated_at: new Date()
  };
}

function prepareSiswaUser(siswa) {
  const username = makeUsernameFromName(siswa.nisn || siswa.nipd || siswa.nama);
  return {
    nama: siswa.nama || username,
    username,
    password: DEFAULT_USER_PASSWORD,
    role: "siswa",
    sumber: "siswa",
    nipd: siswa.nipd || "",
    nisn: siswa.nisn || "",
    aktif: true,
    updated_at: new Date()
  };
}

function renderAdminUserPage() {
  return `
    <div class="card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Admin</span>
          <h2>Daftar User</h2>
          <p>Username dibuat otomatis dari NIP guru atau nama lengkap tanpa spasi.</p>
        </div>
        <div class="kelas-bayangan-actions">
          <button class="btn-secondary" onclick="syncGuruUsers()">Tambah dari Data Guru</button>
          <button class="btn-primary" onclick="resetAllUserPasswords()">Reset Password</button>
        </div>
      </div>

      <div class="matrix-toolbar-note">Password default pengguna baru: <strong>${DEFAULT_USER_PASSWORD}</strong></div>

      <div class="table-container mapel-table-container admin-user-table-wrap">
        <table class="mapel-table admin-user-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Username</th>
              <th>Password</th>
              <th>Role</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="adminUserBody"></tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAdminHierarchyPage() {
  return `
    <div class="card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Admin</span>
          <h2>Pengguna Hierarki</h2>
          <p>Kelola pengguna berdasarkan role admin, guru, urusan, dan siswa.</p>
        </div>
      </div>

      <div class="kelas-form-grid admin-hierarchy-form-grid">
        <label class="form-group admin-hierarchy-form-group">
          <span>Role</span>
          <select id="newUserRole" onchange="handleAdminRoleSourceChange()">
            ${USER_ROLES.map(role => `<option value="${role}">${role}</option>`).join("")}
          </select>
        </label>
        <label class="form-group admin-hierarchy-form-group">
          <span>Sumber Data</span>
          <select id="newUserSource" onchange="fillAdminUserFromSource()"></select>
        </label>
        <label class="form-group admin-hierarchy-form-group">
          <span>Nama</span>
          <input id="newUserName" placeholder="Nama pengguna">
        </label>
        <label class="form-group admin-hierarchy-form-group">
          <span>Username</span>
          <input id="newUserUsername" placeholder="Username">
        </label>
        <label class="form-group admin-hierarchy-form-group">
          <span>Password</span>
          <input id="newUserPassword" value="${DEFAULT_USER_PASSWORD}">
        </label>
        <div class="form-group admin-hierarchy-form-group">
          <span>&nbsp;</span>
          <button class="btn-primary" onclick="addHierarchyUser()">Tambah Pengguna</button>
        </div>
      </div>

      <div id="adminHierarchySections" class="dashboard-grid"></div>
    </div>
  `;
}

function loadRealtimeAdminUsers(includeSiswa = false) {
  if (unsubscribeAdminGuru) unsubscribeAdminGuru();
  if (unsubscribeAdminUser) unsubscribeAdminUser();
  if (unsubscribeAdminSiswa) unsubscribeAdminSiswa();
  if (unsubscribeAdminKoordinator) unsubscribeAdminKoordinator();

  unsubscribeAdminGuru = db.collection("guru").orderBy("kode_guru").onSnapshot(snapshot => {
    semuaDataAdminGuru = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    hasSyncedGuruDerivedUsernames = false;
    ensureGuruDerivedUsernames();
    requestRenderAdminUsersState();
  });

  unsubscribeAdminUser = db.collection("users").orderBy("role").onSnapshot(snapshot => {
    semuaDataAdminUser = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    ensureGuruDerivedUsernames();
    requestRenderAdminUsersState();
  });

  if (includeSiswa) {
    const siswaQuery = typeof getSemesterCollectionQuery === "function"
      ? getSemesterCollectionQuery("siswa", "nama")
      : db.collection("siswa").orderBy("nama");
    unsubscribeAdminSiswa = siswaQuery.onSnapshot(snapshot => {
      semuaDataAdminSiswa = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      requestRenderAdminUsersState();
    });
  }

  unsubscribeAdminKoordinator = getKoordinatorDocRef().onSnapshot(snapshot => {
    semuaDataAdminKoordinator = snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : {};
    if (!isInteractingAdminHierarchyUi || !hasAdminKoordinatorDraftSelection()) {
      adminKoordinatorDraft = null;
      requestRenderAdminUsersState();
    }
  });
}

function renderAdminUsersState() {
  const userBody = document.getElementById("adminUserBody");
  if (userBody) userBody.innerHTML = renderAdminUserRows();

  const hierarchy = document.getElementById("adminHierarchySections");
  if (hierarchy) {
    if (isInteractingAdminHierarchyUi) captureAdminKoordinatorDraft();
    handleAdminRoleSourceChange(false);
    hierarchy.innerHTML = [
      renderAdminKoordinatorPanel(),
      ...USER_ROLES.map(renderAdminHierarchySection)
    ].join("");
  }
}

function renderAdminUserRows() {
  const rows = [...semuaDataAdminUser].sort((a, b) =>
    String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" })
  );

  if (rows.length === 0) {
    return `<tr><td colspan="5" class="empty-cell">Belum ada pengguna. Klik Tambah dari Data Guru.</td></tr>`;
  }

  return rows.map(user => {
    const safeId = escapeAdminHtml(user.id || makeUserDocId(user.username));
    const safeIdJs = String(user.id || makeUserDocId(user.username)).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const isEditing = currentEditAdminUser === (user.id || makeUserDocId(user.username));
    return `
      <tr class="${isEditing ? "table-edit-row admin-user-edit-row" : ""}" data-admin-user-id="${safeId}">
        <td class="admin-user-name">
          <strong>${escapeAdminHtml(user.nama || "-")}</strong>
          <small>${escapeAdminHtml(user.sumber || user.role || "-")}</small>
        </td>
        <td><input class="admin-user-input" value="${escapeAdminHtml(user.username || user.id || "")}" readonly></td>
        <td><input class="admin-user-input" id="userPassword-${safeId}" value="${escapeAdminHtml(user.password || "")}" ${isEditing ? "" : "readonly"}></td>
        <td>
          <select class="admin-user-select" id="userRole-${safeId}" ${isEditing ? "" : "disabled"}>
            ${USER_ROLES.map(role => `<option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}
          </select>
        </td>
        <td>
          <div class="admin-user-actions">
            ${isEditing ? `
              <button class="btn-primary btn-table-compact" onclick="saveUser('${safeIdJs}')">Simpan</button>
              <button class="btn-secondary btn-table-compact" onclick="cancelEditAdminUser()">Batal</button>
            ` : `
              <button class="btn-secondary btn-table-compact" onclick="editAdminUser('${safeIdJs}')">Edit</button>
            `}
            <button class="btn-secondary btn-table-compact" onclick="resetSingleUserPassword('${safeIdJs}')">Reset</button>
            <button class="btn-danger btn-table-compact" onclick="deleteUser('${safeIdJs}')">Hapus</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function editAdminUser(userId) {
  currentEditAdminUser = userId;
  renderAdminUsersState();
}

function cancelEditAdminUser() {
  currentEditAdminUser = null;
  renderAdminUsersState();
}

function renderAdminHierarchySection(role) {
  const users = semuaDataAdminUser.filter(item => item.role === role)
    .sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" }));
  return `
    <article class="dashboard-card-lite admin-role-summary-card">
      <span class="dashboard-card-label">${escapeAdminHtml(role)}</span>
      <h3>${users.length} pengguna</h3>
      <div class="dashboard-mini-list">
        <span><strong>Total akun ${escapeAdminHtml(role)}</strong><b>${users.length}</b></span>
        <span><strong>Password default</strong><b>${escapeAdminHtml(DEFAULT_USER_PASSWORD)}</b></span>
      </div>
    </article>
  `;
}

function renderAdminKoordinatorPanel() {
  const data = getAdminKoordinatorEffectiveData();
  return `
    <article class="dashboard-card-lite admin-koordinator-card">
      <div class="admin-koordinator-head">
        <div>
          <span class="dashboard-card-label">Koordinator</span>
          <h3>Informasi Urusan</h3>
          <p>Pilih guru koordinator untuk tiap jenjang dan simpan langsung ke informasi urusan.</p>
        </div>
        <div class="admin-koordinator-badge">3 Jenjang</div>
      </div>

      <div class="admin-koordinator-grid">
        ${KOORDINATOR_LEVELS.map(item => `
          <label class="admin-koordinator-row">
            <span class="admin-koordinator-label">${item.label}</span>
            <span class="admin-koordinator-meta">${escapeAdminHtml(data[item.key] ? `Aktif: ${getAdminKoordinatorDisplayName(item.key, data[item.key])}` : "Belum dipilih")}</span>
            <div class="admin-koordinator-select-wrap">
              <select id="koordinator-${item.key}" onchange="handleAdminKoordinatorChange()" onfocus="handleAdminHierarchyUiFocus()" onblur="handleAdminHierarchyUiBlur()">
                <option value="">Pilih guru</option>
                ${sortAdminGuruList(semuaDataAdminGuru).map(guru => {
                  const value = String(guru.kode_guru || guru.id || "");
                  return `<option value="${escapeAdminHtml(value)}" ${value === String(data[item.key] || "") ? "selected" : ""}>${escapeAdminHtml(getAdminGuruName(guru) || guru.kode_guru || "-")}</option>`;
                }).join("")}
              </select>
            </div>
          </label>
        `).join("")}
      </div>

      <div class="dashboard-mini-list admin-koordinator-summary">
        ${KOORDINATOR_LEVELS.map(item => `
          <span><strong>${item.label}</strong><b>${escapeAdminHtml(data[item.key] ? getAdminKoordinatorDisplayName(item.key, data[item.key]) : "Belum dipilih")}</b></span>
        `).join("")}
      </div>

      <div class="admin-koordinator-actions" data-admin-koordinator-panel="koordinator">
        <button class="btn-primary btn-table-compact" type="button" onmousedown="handleAdminHierarchyUiButtonDown()" onclick="saveAdminKoordinator()">Simpan Koordinator</button>
      </div>
    </article>
  `;
}

function captureAdminKoordinatorDraft() {
  const fields = {};
  let hasAnyField = false;
  KOORDINATOR_LEVELS.forEach(item => {
    const value = document.getElementById(`koordinator-${item.key}`)?.value;
    if (typeof value === "string") {
      fields[item.key] = value.trim();
      hasAnyField = true;
    }
  });
  if (!hasAnyField) return;
  if (Object.values(fields).some(Boolean) || isInteractingAdminHierarchyUi) {
    adminKoordinatorDraft = fields;
  } else {
    adminKoordinatorDraft = null;
  }
}

function handleAdminKoordinatorChange() {
  captureAdminKoordinatorDraft();
  KOORDINATOR_LEVELS.forEach(item => {
    const meta = document.querySelector(`#koordinator-${item.key}`)?.closest(".admin-koordinator-row")?.querySelector(".admin-koordinator-meta");
    if (meta) {
      const data = getAdminKoordinatorEffectiveData();
      meta.textContent = data[item.key] ? `Aktif: ${getAdminKoordinatorDisplayName(item.key, data[item.key])}` : "Belum dipilih";
    }
  });
  const summary = document.querySelector(".admin-koordinator-summary");
  if (!summary) return;
  const data = getAdminKoordinatorEffectiveData();
  summary.innerHTML = KOORDINATOR_LEVELS.map(item => `
    <span><strong>${item.label}</strong><b>${escapeAdminHtml(data[item.key] ? getAdminKoordinatorDisplayName(item.key, data[item.key]) : "Belum dipilih")}</b></span>
  `).join("");
}

function handleAdminRoleSourceChange(shouldClear = true) {
  const role = document.getElementById("newUserRole")?.value || "admin";
  const source = document.getElementById("newUserSource");
  if (!source) return;

  let options = [`<option value="">Manual</option>`];
  if (role === "guru" || role === "admin" || role === "koordinator" || role === "urusan") {
    options = options.concat(semuaDataAdminGuru.map(guru =>
      `<option value="guru:${escapeAdminHtml(guru.kode_guru || guru.id)}">${escapeAdminHtml(getAdminGuruName(guru) || guru.kode_guru || "-")}</option>`
    ));
  }
  if (role === "siswa") {
    options = options.concat(semuaDataAdminSiswa.map(siswa =>
      `<option value="siswa:${escapeAdminHtml(siswa.nipd || siswa.id)}">${escapeAdminHtml(siswa.nama || siswa.nipd || "-")}</option>`
    ));
  }

  const previous = source.value;
  source.innerHTML = options.join("");
  if (!shouldClear && previous) source.value = previous;
}

function fillAdminUserFromSource() {
  const role = document.getElementById("newUserRole")?.value || "admin";
  const value = document.getElementById("newUserSource")?.value || "";
  const nameEl = document.getElementById("newUserName");
  const usernameEl = document.getElementById("newUserUsername");
  const passwordEl = document.getElementById("newUserPassword");
  if (!nameEl || !usernameEl || !passwordEl) return;

  if (!value) {
    usernameEl.value = makeUsernameFromName(nameEl.value);
    return;
  }

  const [type, id] = value.split(":");
  if (type === "guru") {
    const guru = getGuruByKode(id) || semuaDataAdminGuru.find(item => item.id === id);
    const payload = prepareGuruUser(guru || {}, role);
    nameEl.value = payload.nama;
    usernameEl.value = payload.username;
    passwordEl.value = DEFAULT_USER_PASSWORD;
  }
  if (type === "siswa") {
    const siswa = getSiswaByNipd(id) || semuaDataAdminSiswa.find(item => item.id === id);
    const payload = prepareSiswaUser(siswa || {});
    nameEl.value = payload.nama;
    usernameEl.value = payload.username;
    passwordEl.value = DEFAULT_USER_PASSWORD;
  }
}

async function syncGuruUsers() {
  const candidates = semuaDataAdminGuru
    .map(guru => prepareGuruUser(guru))
    .filter(user => user.username && !getUserByUsername(user.username));

  if (candidates.length === 0) {
    Swal.fire("Sudah lengkap", "Semua guru sudah memiliki user.", "info");
    return;
  }

  const batch = db.batch();
  candidates.forEach(user => {
    batch.set(db.collection("users").doc(makeUserDocId(user.username)), { ...user, created_at: new Date() }, { merge: true });
  });
  await batch.commit();
  Swal.fire("Selesai", `${candidates.length} user guru ditambahkan.`, "success");
}

async function resetAllUserPasswords() {
  const { value } = await Swal.fire({
    title: "Reset semua password",
    input: "text",
    inputValue: DEFAULT_USER_PASSWORD,
    inputLabel: "Password default baru",
    showCancelButton: true,
    confirmButtonText: "Reset"
  });
  if (!value) return;

  const batch = db.batch();
  semuaDataAdminUser.forEach(user => {
    batch.update(db.collection("users").doc(user.id), { password: value, updated_at: new Date() });
  });
  await batch.commit();
  Swal.fire("Selesai", "Semua password pengguna sudah diganti.", "success");
}

async function resetSingleUserPassword(userId) {
  await db.collection("users").doc(userId).update({ password: DEFAULT_USER_PASSWORD, updated_at: new Date() });
  Swal.fire("Selesai", "Password pengguna sudah direset.", "success");
}

async function saveUser(userId) {
  const password = document.getElementById(`userPassword-${userId}`)?.value || DEFAULT_USER_PASSWORD;
  const role = document.getElementById(`userRole-${userId}`)?.value || "guru";
  await db.collection("users").doc(userId).update({ password, role, updated_at: new Date() });
  currentEditAdminUser = null;
  renderAdminUsersState();
  if (typeof showInlineSaveNotificationForData === "function") {
    showInlineSaveNotificationForData("data-admin-user-id", userId, "Tersimpan");
  }
}

async function deleteUser(userId) {
  const result = await Swal.fire({
    title: "Hapus user?",
    text: userId,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus"
  });
  if (!result.isConfirmed) return;
  await db.collection("users").doc(userId).delete();
  Swal.fire("Terhapus", "User sudah dihapus.", "success");
}

async function addHierarchyUser() {
  const role = document.getElementById("newUserRole")?.value || "guru";
  const name = document.getElementById("newUserName")?.value.trim() || "";
  const username = document.getElementById("newUserUsername")?.value.trim() || "";
  const password = document.getElementById("newUserPassword")?.value || DEFAULT_USER_PASSWORD;

  if (!name || !username) {
    Swal.fire("Lengkapi data", "Nama dan username wajib diisi.", "warning");
    return;
  }

  const payload = {
    nama: name,
    username,
    password,
    role,
    aktif: true,
    updated_at: new Date(),
    created_at: new Date()
  };

  await db.collection("users").doc(makeUserDocId(username)).set(payload, { merge: true });
  Swal.fire("Tersimpan", "Pengguna sudah ditambahkan.", "success");
}

async function saveAdminKoordinator() {
  const saveButton = document.querySelector("[data-admin-koordinator-panel='koordinator'] button");
  const domData = getAdminKoordinatorFormDataFromDom();
  adminKoordinatorDraft = domData;
  const data = { ...getAdminKoordinatorSnapshot(), ...domData };
  const payload = KOORDINATOR_LEVELS.reduce((result, item) => {
    const kodeGuru = String(data[item.key] || "").trim();
    const guru = getAdminKoordinatorGuru(kodeGuru);
    result[item.key] = kodeGuru;
    result[`${item.key}_nama`] = guru ? getAdminGuruName(guru) : "";
    result[`${item.key}_nip`] = String(guru?.nip || "").trim();
    return result;
  }, { updated_at: new Date() });

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Menyimpan...";
    }

    await getKoordinatorDocRef().set(payload, { merge: true });
    const verifySnapshot = await getKoordinatorDocRef().get();
    const verifiedData = verifySnapshot.exists ? verifySnapshot.data() : {};
    const hasMismatch = KOORDINATOR_LEVELS.some(item =>
      String(verifiedData[item.key] || "") !== String(payload[item.key] || "")
    );
    if (hasMismatch) {
      throw new Error("Verifikasi simpan koordinator tidak cocok dengan data yang dibaca ulang.");
    }
    semuaDataAdminKoordinator = { ...semuaDataAdminKoordinator, ...verifiedData, ...payload };
    adminKoordinatorDraft = null;
    isInteractingAdminHierarchyUi = false;
    pendingAdminUsersRender = false;
    renderAdminUsersState();
    showAdminFloatingToast("Koordinator berhasil disimpan");
  } catch (error) {
    console.error("Gagal menyimpan koordinator", error);
    showAdminFloatingToast("Gagal menyimpan koordinator", "error");
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = "Simpan Koordinator";
    }
  }
}
