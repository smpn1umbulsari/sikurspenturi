// ================= KELAS BAYANGAN =================
let semuaDataKelasBayanganSiswa = [];
let semuaDataKelasBayanganKelas = [];
let unsubscribeKelasBayanganSiswa = null;
let unsubscribeKelasBayanganKelas = null;
let isKelasBayanganSiswaLoaded = false;
let kelasBayanganSearch = "";
let kelasBayanganTingkat = "";
let kelasBayanganRombel = "";
let kelasBayanganSourceByLevel = JSON.parse(localStorage.getItem("kelasBayanganSourceByLevel") || "{}");
let kelasBayanganAnggotaDraft = null;
let semuaDataMengajarBayangan = [];
let semuaDataMengajarBayanganAsli = [];
let unsubscribeMengajarBayangan = null;
let unsubscribeMengajarBayanganAsli = null;
let unsubscribeMengajarBayanganMapel = null;
let unsubscribeMengajarBayanganGuru = null;
let kelasBayanganMengajarTingkat = "7";
let mengajarBayanganSearchDraft = "";
let mengajarBayanganSearchQuery = "";
let pendingMengajarBayanganChanges = {};
let isCloningMapelBayangan = false;
let isCloningMengajarBayangan = false;

function escapeKelasBayanganHtml(value) {
  if (typeof escapeSiswaHtml === "function") return escapeSiswaHtml(value);
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeKelasBayanganJs(value) {
  if (typeof escapeSiswaJs === "function") return escapeSiswaJs(value);
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function normalizeKelasBayanganAgama(value = "") {
  if (typeof normalizeMengajarAgama === "function") return normalizeMengajarAgama(value);
  const text = String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const aliases = {
    islam: "Islam",
    kristen: "Kristen",
    protestan: "Kristen",
    kristenprotestan: "Kristen",
    katolik: "Katolik",
    katholik: "Katolik",
    hindu: "Hindu",
    buddha: "Buddha",
    budha: "Buddha",
    konghucu: "Konghucu",
    khonghucu: "Konghucu"
  };
  return aliases[text] || "";
}

function getKelasBayanganMapelAgama(mapel = {}) {
  if (typeof getMengajarMapelAgama === "function") return getMengajarMapelAgama(mapel);
  const explicit = normalizeKelasBayanganAgama(mapel.agama);
  if (explicit) return explicit;
  const text = `${mapel.kode_mapel || ""} ${mapel.nama_mapel || ""}`.toLowerCase();
  return ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"]
    .find(agama => text.includes(agama.toLowerCase())) || "";
}

function isKelasBayanganMapelPabp(mapel = {}) {
  if (typeof isMengajarMapelPabp === "function") return isMengajarMapelPabp(mapel);
  if (typeof getMapelIndukKode === "function" && getMapelIndukKode(mapel) === "PABP") return true;
  return /pabp|agama|budi pekerti/i.test(`${mapel.kode_mapel || ""} ${mapel.nama_mapel || ""}`);
}

function getKelasBayanganAgamaSetForClass(tingkat, rombel) {
  const kelasValue = buildKelasName(tingkat, rombel);
  return new Set(
    getKelasBayanganMembers(kelasValue)
      .map(siswa => normalizeKelasBayanganAgama(siswa.agama))
      .filter(Boolean)
  );
}

function isKelasBayanganMapelApplicableForClass(mapel, tingkat, rombel) {
  if (!isKelasBayanganMapelPabp(mapel)) return true;
  const agamaMapel = getKelasBayanganMapelAgama(mapel);
  if (!agamaMapel) return true;
  if (!isKelasBayanganSiswaLoaded) return true;
  return getKelasBayanganAgamaSetForClass(tingkat, rombel).has(agamaMapel);
}

function getKelasBayanganMapelDisabledReason(mapel, tingkat, rombel) {
  const agamaMapel = getKelasBayanganMapelAgama(mapel);
  const kelas = buildKelasName(tingkat, rombel);
  if (!agamaMapel) return "";
  return `Tidak ada siswa beragama ${agamaMapel} di kelas real ${kelas}`;
}

function getKelasBayanganParts(kelasValue = "") {
  const normalized = String(kelasValue || "").trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/([7-9])([A-Z]+)$/);
  return {
    tingkat: match ? match[1] : "",
    rombel: match ? match[2] : "",
    kelas: match ? `${match[1]} ${match[2]}` : String(kelasValue || "").trim().toUpperCase()
  };
}

function isRombelBayanganUtama(rombel) {
  return /^[A-H]$/.test(String(rombel || "").trim().toUpperCase());
}

function getKelasBayanganSavedParts(siswa) {
  const asliParts = getKelasBayanganParts(siswa?.kelas);
  const savedParts = getKelasBayanganParts(siswa?.kelas_bayangan);
  if (savedParts.tingkat === asliParts.tingkat && isRombelBayanganUtama(savedParts.rombel)) {
    return savedParts;
  }
  return { tingkat: asliParts.tingkat, rombel: "", kelas: "" };
}

function getKelasBayanganEfektif(siswa) {
  const asliParts = getKelasBayanganParts(siswa.kelas);
  const savedParts = getKelasBayanganSavedParts(siswa);

  if (savedParts.kelas) return savedParts.kelas;
  if (isRombelBayanganUtama(asliParts.rombel)) return asliParts.kelas;
  return "";
}

function getKelasBayanganSourceForLevel(level) {
  return getKelasBayanganParts(kelasBayanganSourceByLevel[String(level)] || "").kelas;
}

function setKelasBayanganSource(kelasValue) {
  const parts = getKelasBayanganParts(kelasValue);
  if (!parts.tingkat || !parts.rombel) {
    Swal.fire("Kelas belum valid", "Pilih kelas yang valid terlebih dahulu.", "warning");
    return;
  }

  if (!canSetKelasBayanganSource(parts.kelas)) {
    Swal.fire("Belum bisa diset", "Kelas real hanya bisa diset dari kelas abjad terakhir yang masih punya sisa siswa belum terdistribusi.", "warning");
    return;
  }

  kelasBayanganSourceByLevel[String(parts.tingkat)] = parts.kelas;
  localStorage.setItem("kelasBayanganSourceByLevel", JSON.stringify(kelasBayanganSourceByLevel));
  renderKelasBayanganKelasTable();
  renderMengajarBayanganMatrix();
  Swal.fire("Kelas real aktif", `${parts.kelas} menjadi sumber kelas real untuk tingkat ${parts.tingkat}.`, "success");
}

function getKelasBayanganSourceRemainingCount(kelasValue) {
  return getKelasBayanganAvailableSourceMembers(kelasValue).length;
}

function getEligibleKelasBayanganSourceForLevel(level) {
  return sortKelasBayanganItems(semuaDataKelasBayanganKelas)
    .map(item => getKelasBayanganParts(item.kelas || `${item.tingkat || ""}${item.rombel || ""}`))
    .filter(parts => parts.tingkat === String(level || "") && parts.rombel)
    .sort((a, b) => b.rombel.localeCompare(a.rombel, undefined, { numeric: true, sensitivity: "base" }))
    .find(parts => getKelasBayanganSourceRemainingCount(parts.kelas) > 0) || null;
}

function canSetKelasBayanganSource(kelasValue) {
  const parts = getKelasBayanganParts(kelasValue);
  const eligible = getEligibleKelasBayanganSourceForLevel(parts.tingkat);
  return Boolean(eligible && eligible.kelas === parts.kelas);
}

function sortKelasBayanganItems(data) {
  return [...data].sort((a, b) => {
    const aParts = getKelasBayanganParts(a.kelas || `${a.tingkat || ""}${a.rombel || ""}`);
    const bParts = getKelasBayanganParts(b.kelas || `${b.tingkat || ""}${b.rombel || ""}`);
    const kelasResult = `${aParts.tingkat}${aParts.rombel}`.localeCompare(`${bParts.tingkat}${bParts.rombel}`, undefined, {
      numeric: true,
      sensitivity: "base"
    });
    if (kelasResult !== 0) return kelasResult;
    return String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" });
  });
}

function renderKelasBayanganDataKelasPage() {
  return `
    <div class="card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Kelas Real</span>
          <h2>Data Kelas Real</h2>
          <p>Daftar ini mengambil kelas asli sebagai acuan. Gunakan anggota dan set kelas real untuk memindahkan siswa ke kelas real lain.</p>
        </div>
      </div>

      <div class="toolbar-info">
        <span id="jumlahDataKelasBayangan">0 kelas</span>
        <span id="kelasBayanganSourceInfo" class="kelas-bayangan-active-info">Belum ada kelas sumber aktif</span>
        <button class="btn-secondary" onclick="refreshKelasBayangan()">Refresh</button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Tingkat</th>
              <th>Kelas</th>
              <th>Anggota Real</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="kelasBayanganKelasBody"></tbody>
        </table>
        <div id="kelasBayanganKelasEmpty" class="empty-panel" style="display:none;">Tidak ada data kelas.</div>
      </div>
    </div>
  `;
}

function renderKelasBayanganSiswaPage() {
  return `
    <div class="card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Kelas Real</span>
          <h2>Data Siswa Kelas Real</h2>
          <p>Kelas asli A-H menjadi acuan otomatis. Siswa dari kelas I dibagi manual ke kelas real A-H.</p>
        </div>
        <button class="btn-primary" onclick="syncKelasBayanganUtama()">Sinkronkan A-H</button>
      </div>

      <div class="matrix-toolbar-note">
        Gunakan menu ini sebagai acuan Pembagian Ruang. Siswa kelas I yang belum dipilih belum ikut masuk susunan ruang ujian.
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <input id="kelasBayanganSearch" placeholder="Cari nama atau NIPD..." oninput="setKelasBayanganSearch(this.value)">
        </div>
        <div class="toolbar-right">
          <select id="kelasBayanganTingkat" onchange="setKelasBayanganTingkat(this.value)">
            <option value="">Semua Tingkat</option>
            <option value="7">Tingkat 7</option>
            <option value="8">Tingkat 8</option>
            <option value="9">Tingkat 9</option>
          </select>
          <select id="kelasBayanganRombel" onchange="setKelasBayanganRombel(this.value)">
            <option value="">Semua Rombel Asli</option>
            ${"ABCDEFGHI".split("").map(rombel => `<option value="${rombel}">Kelas ${rombel}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="kelas-bayangan-summary" id="kelasBayanganSummary"></div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>NIPD</th>
              <th>Nama</th>
              <th>Kelas Asli</th>
              <th>Kelas Real</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="kelasBayanganBody"></tbody>
        </table>
        <div id="kelasBayanganEmpty" class="empty-panel" style="display:none;">Tidak ada data siswa.</div>
      </div>
    </div>
  `;
}

function renderKelasBayanganMengajarPage() {
  return `
    <div class="card">
      <h2>Pembagian Mengajar Kelas Real</h2>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="page-size-control">
            <label for="tingkatMengajarBayangan">Tingkat</label>
            <select id="tingkatMengajarBayangan" onchange="setMengajarBayanganTingkat(this.value)">
              <option value="7" ${kelasBayanganMengajarTingkat === "7" ? "selected" : ""}>7</option>
              <option value="8" ${kelasBayanganMengajarTingkat === "8" ? "selected" : ""}>8</option>
              <option value="9" ${kelasBayanganMengajarTingkat === "9" ? "selected" : ""}>9</option>
            </select>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn-primary" onclick="saveAllMengajarBayangan()">Simpan Semua</button>
        </div>
      </div>

      <div class="toolbar-info">
        <span id="jumlahMengajarBayanganInfo">0 mapel x 0 kelas</span>
        <div class="page-size-control">
          <span id="pendingMengajarBayanganInfo">0 perubahan belum disimpan</span>
          <button class="btn-secondary" onclick="refreshMengajarBayanganPage()">Refresh</button>
        </div>
      </div>

      <div class="matrix-search-bar">
        <select id="mengajarBayanganSearchInput" class="matrix-search-input" onchange="handleMengajarBayanganSearchInput(this.value)" onkeydown="handleMengajarBayanganSearchKeydown(event)">
          ${typeof getMengajarSearchGuruOptions === "function" ? getMengajarSearchGuruOptions(true, mengajarBayanganSearchDraft) : '<option value="">Pilih guru untuk dicari</option>'}
        </select>
        <button class="btn-secondary" onclick="submitMengajarBayanganSearch()">Cari</button>
        <button class="btn-secondary" onclick="clearMengajarBayanganSearch()">Reset</button>
        <small id="mengajarBayanganSearchInfo" class="matrix-search-info">Pilih nama guru untuk menyorot posisinya di matriks.</small>
      </div>

      <div class="matrix-toolbar-note">
        Nilai awal mengikuti Pembagian Mengajar kelas asli. PABP yang tidak sesuai agama siswa di kelas real akan disamarkan.
      </div>

      <div id="mengajarBayanganMatrixContainer"></div>
    </div>
  `;
}

function renderKelasBayanganPage() {
  return renderKelasBayanganSiswaPage();
}

function loadRealtimeKelasBayangan() {
  if (unsubscribeKelasBayanganSiswa) unsubscribeKelasBayanganSiswa();
  if (unsubscribeKelasBayanganKelas) unsubscribeKelasBayanganKelas();
  isKelasBayanganSiswaLoaded = false;

  unsubscribeKelasBayanganSiswa = listenSiswa(data => {
    semuaDataKelasBayanganSiswa = data;
    isKelasBayanganSiswaLoaded = true;
    renderKelasBayanganViews();
    renderMengajarBayanganMatrix();
  });

  unsubscribeKelasBayanganKelas = listenKelas(data => {
    semuaDataKelasBayanganKelas = data;
    renderKelasBayanganViews();
    renderMengajarBayanganMatrix();
  });
}

function refreshKelasBayangan() {
  loadRealtimeKelasBayangan();
  renderKelasBayanganViews();
}

function renderKelasBayanganViews() {
  renderKelasBayanganTable();
  renderKelasBayanganKelasTable();
}

function setKelasBayanganSearch(value) {
  kelasBayanganSearch = String(value || "").toLowerCase();
  renderKelasBayanganTable();
}

function setKelasBayanganTingkat(value) {
  kelasBayanganTingkat = String(value || "");
  renderKelasBayanganTable();
}

function setKelasBayanganRombel(value) {
  kelasBayanganRombel = String(value || "").toUpperCase();
  renderKelasBayanganTable();
}

function getFilteredKelasBayanganRows() {
  return semuaDataKelasBayanganSiswa
    .map(siswa => ({
      ...siswa,
      kelasAsliParts: getKelasBayanganParts(siswa.kelas),
      kelasBayanganEfektif: getKelasBayanganEfektif(siswa)
    }))
    .filter(siswa => {
      const keyword = `${siswa.nipd || ""} ${siswa.nisn || ""} ${siswa.nama || ""}`.toLowerCase();
      if (kelasBayanganSearch && !keyword.includes(kelasBayanganSearch)) return false;
      if (kelasBayanganTingkat && siswa.kelasAsliParts.tingkat !== kelasBayanganTingkat) return false;
      if (kelasBayanganRombel && siswa.kelasAsliParts.rombel !== kelasBayanganRombel) return false;
      return true;
    })
    .sort((a, b) => {
      const kelasA = `${a.kelasAsliParts.tingkat}${a.kelasAsliParts.rombel}`;
      const kelasB = `${b.kelasAsliParts.tingkat}${b.kelasAsliParts.rombel}`;
      const kelasResult = kelasA.localeCompare(kelasB, undefined, { numeric: true, sensitivity: "base" });
      if (kelasResult !== 0) return kelasResult;
      return String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" });
    });
}

function renderKelasBayanganSummary(rows) {
  const container = document.getElementById("kelasBayanganSummary");
  if (!container) return;

  const otomatis = rows.filter(siswa => isRombelBayanganUtama(siswa.kelasAsliParts.rombel)).length;
  const manualSelesai = rows.filter(siswa => !isRombelBayanganUtama(siswa.kelasAsliParts.rombel) && siswa.kelasBayanganEfektif).length;
  const manualBelum = rows.filter(siswa => siswa.kelasAsliParts.tingkat && !isRombelBayanganUtama(siswa.kelasAsliParts.rombel) && !siswa.kelasBayanganEfektif).length;

  container.innerHTML = `
    <span>${rows.length} siswa tampil</span>
    <span>${otomatis} otomatis A-H</span>
    <span>${manualSelesai} manual selesai</span>
    <span>${manualBelum} belum dibagi</span>
  `;
}

function renderKelasBayanganOptions(tingkat, selectedValue = "") {
  const selectedParts = getKelasBayanganParts(selectedValue);
  return "ABCDEFGH".split("").map(rombel => {
    const value = `${tingkat} ${rombel}`;
    const selected = selectedParts.kelas === value ? "selected" : "";
    return `<option value="${value}" ${selected}>${value}</option>`;
  }).join("");
}

function renderKelasBayanganStatus(siswa) {
  const isOtomatis = isRombelBayanganUtama(siswa.kelasAsliParts.rombel);
  const savedParts = getKelasBayanganSavedParts(siswa);
  if (savedParts.kelas && savedParts.kelas !== siswa.kelasAsliParts.kelas) {
    return `<span class="kelas-bayangan-chip ok">Manual</span>`;
  }
  if (isOtomatis) return `<span class="kelas-bayangan-chip ok">Otomatis</span>`;
  if (siswa.kelasBayanganEfektif) return `<span class="kelas-bayangan-chip ok">Manual</span>`;
  return `<span class="kelas-bayangan-chip warn">Belum dibagi</span>`;
}

function renderKelasBayanganRow(siswa) {
  const nipd = String(siswa.nipd || "");
  const safeNipdJs = escapeKelasBayanganJs(nipd);
  const isOtomatis = isRombelBayanganUtama(siswa.kelasAsliParts.rombel);
  const canAssign = siswa.kelasAsliParts.tingkat && !isOtomatis;
  const selectId = `kelas-bayangan-${String(nipd).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const savedParts = getKelasBayanganSavedParts(siswa);

  const bayanganCell = isOtomatis
    ? `<strong>${escapeKelasBayanganHtml(savedParts.kelas || siswa.kelasAsliParts.kelas)}</strong>`
    : canAssign
      ? `
        <select id="${escapeKelasBayanganHtml(selectId)}" class="kelas-inline-select">
          <option value="">Pilih kelas real</option>
          ${renderKelasBayanganOptions(siswa.kelasAsliParts.tingkat, siswa.kelasBayanganEfektif)}
        </select>
      `
      : `<span class="muted-text">Kelas asli belum valid</span>`;

  const actionCell = isOtomatis
    ? `<button class="btn-secondary" disabled>Otomatis</button>`
    : canAssign
      ? `<button class="btn-primary" onclick="saveKelasBayanganManual('${safeNipdJs}', '${escapeKelasBayanganJs(selectId)}')">Simpan</button>`
      : `<button class="btn-secondary" disabled>Simpan</button>`;

  return `
    <tr>
      <td>${escapeKelasBayanganHtml(siswa.nipd || "-")}</td>
      <td>${escapeKelasBayanganHtml(siswa.nama || "-")}</td>
      <td>${escapeKelasBayanganHtml(siswa.kelasAsliParts.kelas || siswa.kelas || "-")}</td>
      <td>${bayanganCell}</td>
      <td>${renderKelasBayanganStatus(siswa)}</td>
      <td>${actionCell}</td>
    </tr>
  `;
}

function renderKelasBayanganTable() {
  const body = document.getElementById("kelasBayanganBody");
  const empty = document.getElementById("kelasBayanganEmpty");
  if (!body) return;

  const rows = getFilteredKelasBayanganRows();
  renderKelasBayanganSummary(rows);

  body.innerHTML = rows.map(renderKelasBayanganRow).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
}

function getKelasBayanganMembers(kelasValue) {
  const targetParts = getKelasBayanganParts(kelasValue);
  const target = targetParts.kelas.toUpperCase();
  const rows = semuaDataKelasBayanganSiswa
    .map(siswa => ({
      ...siswa,
      kelasAsliParts: getKelasBayanganParts(siswa.kelas),
      kelasBayanganSavedParts: getKelasBayanganSavedParts(siswa),
      kelasBayanganEfektif: getKelasBayanganEfektif(siswa)
    }))
    .filter(siswa => {
      const effectiveMatch = getKelasBayanganParts(siswa.kelasBayanganEfektif).kelas.toUpperCase() === target;
      const belumDipindah = !siswa.kelasBayanganSavedParts.kelas;
      const originalSourceMatch = siswa.kelasAsliParts.kelas.toUpperCase() === target && belumDipindah;

      if (!targetParts.rombel) return false;
      if (isRombelBayanganUtama(targetParts.rombel)) return effectiveMatch;
      return originalSourceMatch;
    });

  const byName = (a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" });

  if (!isRombelBayanganUtama(targetParts.rombel)) {
    return rows.sort(byName);
  }

  const anggotaAsli = rows
    .filter(siswa => siswa.kelasAsliParts.kelas.toUpperCase() === target)
    .sort(byName);
  const anggotaTambahan = rows
    .filter(siswa => siswa.kelasAsliParts.kelas.toUpperCase() !== target)
    .sort(byName);

  return [...anggotaAsli, ...anggotaTambahan];
}

function getKelasBayanganOriginalMembers(kelasValue) {
  const target = getKelasBayanganParts(kelasValue).kelas.toUpperCase();
  if (!target) return [];

  return semuaDataKelasBayanganSiswa
    .map(siswa => ({
      ...siswa,
      kelasAsliParts: getKelasBayanganParts(siswa.kelas),
      kelasBayanganSavedParts: getKelasBayanganSavedParts(siswa),
      kelasBayanganEfektif: getKelasBayanganEfektif(siswa)
    }))
    .filter(siswa => siswa.kelasAsliParts.kelas.toUpperCase() === target)
    .sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" }));
}

function getKelasBayanganAvailableSourceMembers(sourceKelas) {
  return getKelasBayanganOriginalMembers(sourceKelas).filter(siswa => {
    const saved = siswa.kelasBayanganSavedParts;
    return !saved.kelas || saved.kelas === getKelasBayanganParts(sourceKelas).kelas;
  });
}

function getKelasBayanganDestinationText(siswa) {
  const saved = siswa.kelasBayanganSavedParts || getKelasBayanganSavedParts(siswa);
  const asli = siswa.kelasAsliParts || getKelasBayanganParts(siswa.kelas);

  if (saved.kelas) return saved.kelas;
  if (isRombelBayanganUtama(asli.rombel)) return `${asli.kelas} (otomatis)`;
  return "Belum ditambahkan";
}

function renderKelasBayanganKelasTable() {
  const body = document.getElementById("kelasBayanganKelasBody");
  const empty = document.getElementById("kelasBayanganKelasEmpty");
  if (!body) return;

  const rows = sortKelasBayanganItems(semuaDataKelasBayanganKelas);
  body.innerHTML = rows.map(item => {
    const parts = getKelasBayanganParts(item.kelas || `${item.tingkat || ""}${item.rombel || ""}`);
    const kelasValue = parts.kelas;
    const kelasJs = escapeKelasBayanganJs(kelasValue);
    const memberCount = getKelasBayanganMembers(kelasValue).length;
    const sourceKelas = getKelasBayanganSourceForLevel(parts.tingkat);
    const isSource = sourceKelas === kelasValue;
    const canSetSource = canSetKelasBayanganSource(kelasValue);
    const sourceRemaining = getKelasBayanganSourceRemainingCount(kelasValue);
    const rowClass = isSource ? "kelas-bayangan-row-active" : "";
    const sourceButton = isSource
      ? `<button class="btn-secondary" disabled>Aktif sebagai sumber</button>`
      : canSetSource
        ? `<button class="btn-primary" onclick="setKelasBayanganSource('${kelasJs}')">Set sebagai kelas real</button>`
        : `<button class="btn-secondary" disabled>${sourceRemaining > 0 ? "Menunggu kelas terakhir" : "Sisa 0"}</button>`;

    return `
      <tr class="${rowClass}">
        <td>${escapeKelasBayanganHtml(parts.tingkat || "-")}</td>
        <td>${escapeKelasBayanganHtml(parts.rombel || "-")}</td>
        <td>${memberCount} siswa</td>
        <td>
          <div class="table-actions">
            <button class="btn-secondary" onclick="showAnggotaKelasBayangan('${kelasJs}')">Anggota</button>
            ${sourceButton}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  const info = document.getElementById("jumlahDataKelasBayangan");
  if (info) info.innerText = `${rows.length} kelas`;
  const sourceInfo = document.getElementById("kelasBayanganSourceInfo");
  if (sourceInfo) {
    const activeSources = Object.entries(kelasBayanganSourceByLevel)
      .map(([level, kelas]) => `${level}: ${kelas}`)
      .join(" | ");
    sourceInfo.innerText = activeSources ? `Sumber aktif ${activeSources}` : "Belum ada kelas sumber aktif";
  }
  if (empty) empty.style.display = rows.length ? "none" : "block";
}

function getKelasBayanganTargetOptions(sourceKelas, selectedValue = "") {
  const sourceParts = getKelasBayanganParts(sourceKelas);
  const selectedParts = getKelasBayanganParts(selectedValue);
  return sortKelasBayanganItems(semuaDataKelasBayanganKelas)
    .map(item => getKelasBayanganParts(item.kelas || `${item.tingkat || ""}${item.rombel || ""}`))
    .filter(parts => parts.tingkat === sourceParts.tingkat && isRombelBayanganUtama(parts.rombel))
    .map(parts => {
      const selected = parts.kelas === selectedParts.kelas ? "selected" : "";
      return `<option value="${parts.kelas}" ${selected}>${parts.kelas}</option>`;
    })
    .join("");
}

function renderAnggotaKelasBayanganList(kelasValue) {
  const members = getKelasBayanganMembers(kelasValue);
  if (members.length === 0) {
    return `<div class="empty-panel">Belum ada anggota kelas real ini.</div>`;
  }

  return members.map(siswa => `
    <div class="anggota-option">
      <strong>${escapeKelasBayanganHtml(siswa.nama || "-")}</strong>
      <small>${escapeKelasBayanganHtml(siswa.nipd || "-")} | Asli: ${escapeKelasBayanganHtml(siswa.kelas || "-")}${siswa.kelasAsliParts?.kelas !== getKelasBayanganParts(kelasValue).kelas ? " | Tambahan" : ""}</small>
    </div>
  `).join("");
}

function renderAnggotaKelasBayanganSourceList(kelasValue) {
  const members = getKelasBayanganOriginalMembers(kelasValue);
  if (members.length === 0) {
    return `<div class="empty-panel">Belum ada anggota kelas sumber ini.</div>`;
  }

  return `
    <div class="kelas-bayangan-member-table">
      ${members.map(siswa => `
        <div class="kelas-bayangan-member-row">
          <span>
            <strong>${escapeKelasBayanganHtml(siswa.nama || "-")}</strong>
            <small>${escapeKelasBayanganHtml(siswa.nipd || "-")} | Asli: ${escapeKelasBayanganHtml(siswa.kelas || "-")}</small>
          </span>
          <span class="kelas-bayangan-member-destination">${escapeKelasBayanganHtml(getKelasBayanganDestinationText(siswa))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function getKelasBayanganDraftLists() {
  if (!kelasBayanganAnggotaDraft) {
    return { unassigned: [], members: [] };
  }

  const sourceKelas = kelasBayanganAnggotaDraft.sourceKelas;
  const targetKelas = kelasBayanganAnggotaDraft.targetKelas;
  const targetSet = kelasBayanganAnggotaDraft.targetNipds;
  const originalMembers = getKelasBayanganMembers(targetKelas)
    .filter(siswa => siswa.kelasAsliParts?.kelas === targetKelas);
  const sourceRows = getKelasBayanganOriginalMembers(sourceKelas);
  const sourceCandidates = sourceRows.filter(siswa => {
    const nipd = String(siswa.nipd || "").trim();
    const saved = siswa.kelasBayanganSavedParts;
    return nipd && (!saved.kelas || saved.kelas === targetKelas || saved.kelas === sourceKelas);
  });

  const sourceMembers = sourceCandidates.filter(siswa => targetSet.has(String(siswa.nipd || "").trim()));
  const unassigned = sourceCandidates.filter(siswa => !targetSet.has(String(siswa.nipd || "").trim()));
  const byName = (a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" });

  return {
    unassigned: unassigned.sort(byName),
    members: [...originalMembers.sort(byName), ...sourceMembers.sort(byName)]
  };
}

function renderKelasBayanganDraftList(items, emptyText, actionLabel, actionName, targetKelas = "") {
  if (items.length === 0) {
    return `<div class="empty-panel">${escapeKelasBayanganHtml(emptyText)}</div>`;
  }

  return items.map(siswa => {
    const nipd = String(siswa.nipd || "").trim();
    const isOriginalTarget = targetKelas && siswa.kelasAsliParts?.kelas === targetKelas;
    return `
      <div class="anggota-option anggota-option-row">
        <span>
          <strong>${escapeKelasBayanganHtml(siswa.nama || "-")}</strong>
          <small>${escapeKelasBayanganHtml(nipd)} | Asli: ${escapeKelasBayanganHtml(siswa.kelas || "-")}${isOriginalTarget ? " | Anggota asli" : ""}</small>
        </span>
        ${isOriginalTarget
          ? `<button type="button" class="btn-secondary" disabled>Asli</button>`
          : `<button type="button" class="btn-secondary" onclick="${actionName}('${escapeKelasBayanganJs(nipd)}')">${escapeKelasBayanganHtml(actionLabel)}</button>`
        }
      </div>
    `;
  }).join("");
}

function renderKelasBayanganAnggotaDraftOptions() {
  if (!kelasBayanganAnggotaDraft) return "";
  const lists = getKelasBayanganDraftLists();
  const sourceKelas = kelasBayanganAnggotaDraft.sourceKelas;
  const targetKelas = kelasBayanganAnggotaDraft.targetKelas;

  return `
    <div class="anggota-panels">
      <section class="anggota-panel">
        <div class="anggota-panel-head">
          <strong>Belum Memiliki Kelas Real</strong>
          <span>${lists.unassigned.length} siswa dari ${escapeKelasBayanganHtml(sourceKelas)}</span>
        </div>
        <div class="anggota-list">
          ${renderKelasBayanganDraftList(lists.unassigned, "Tidak ada siswa yang belum memiliki kelas real.", "Tambah", "addAnggotaKelasBayanganDraft")}
        </div>
      </section>

      <section class="anggota-panel">
        <div class="anggota-panel-head">
          <strong>Anggota ${escapeKelasBayanganHtml(targetKelas)}</strong>
          <span>${lists.members.length} siswa</span>
        </div>
        <div class="anggota-list anggota-list-members">
          ${renderKelasBayanganDraftList(lists.members, "Belum ada anggota kelas real.", "Keluarkan", "removeAnggotaKelasBayanganDraft", targetKelas)}
        </div>
      </section>
    </div>
  `;
}

function refreshAnggotaKelasBayanganDraft() {
  const container = document.getElementById("anggotaKelasBayanganModalBody");
  if (!container || !kelasBayanganAnggotaDraft) return;
  container.innerHTML = renderKelasBayanganAnggotaDraftOptions();
}

function addAnggotaKelasBayanganDraft(nipd) {
  if (!kelasBayanganAnggotaDraft) return;
  kelasBayanganAnggotaDraft.targetNipds.add(String(nipd || "").trim());
  refreshAnggotaKelasBayanganDraft();
}

function removeAnggotaKelasBayanganDraft(nipd) {
  if (!kelasBayanganAnggotaDraft) return;
  kelasBayanganAnggotaDraft.targetNipds.delete(String(nipd || "").trim());
  refreshAnggotaKelasBayanganDraft();
}

async function showAnggotaKelasBayangan(kelasValue) {
  const targetParts = getKelasBayanganParts(kelasValue);
  const sourceKelas = getKelasBayanganSourceForLevel(targetParts.tingkat);
  const sourceParts = getKelasBayanganParts(sourceKelas);
  const isSource = sourceParts.kelas === targetParts.kelas;

  if (isSource) {
    Swal.fire({
      title: `Anggota ${escapeKelasBayanganHtml(kelasValue)}`,
      width: 860,
      html: `
        <div class="anggota-modal-note">Daftar siswa kelas sumber dan keterangan kelas real tujuan.</div>
        <div class="anggota-list">${renderAnggotaKelasBayanganSourceList(kelasValue)}</div>
      `,
      confirmButtonText: "Tutup"
    });
    return;
  }

  if (!sourceParts.kelas || sourceParts.tingkat !== targetParts.tingkat) {
    Swal.fire("Belum ada kelas sumber", "Klik Set sebagai kelas real pada kelas sumber di jenjang yang sama terlebih dahulu.", "warning");
    return;
  }

  kelasBayanganAnggotaDraft = {
    sourceKelas: sourceParts.kelas,
    targetKelas: targetParts.kelas,
    targetNipds: new Set(
      getKelasBayanganOriginalMembers(sourceParts.kelas)
        .filter(siswa => siswa.kelasBayanganSavedParts?.kelas === targetParts.kelas)
        .map(siswa => String(siswa.nipd || "").trim())
        .filter(Boolean)
    )
  };

  const result = await Swal.fire({
    title: `Anggota ${escapeKelasBayanganHtml(targetParts.kelas)}`,
    width: 920,
    html: `
      <div class="anggota-modal-note">
        Pindahkan siswa dari panel kiri ke panel kanan seperti pengaturan anggota kelas asli.
      </div>
      <div id="anggotaKelasBayanganModalBody">
        ${renderKelasBayanganAnggotaDraftOptions()}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan Anggota",
    cancelButtonText: "Batal",
    preConfirm: () => Array.from(kelasBayanganAnggotaDraft?.targetNipds || [])
  });

  const selectedNipds = result.value || [];
  const draft = kelasBayanganAnggotaDraft;
  kelasBayanganAnggotaDraft = null;

  if (!result.isConfirmed || !draft) return;
  await simpanAnggotaKelasBayangan(draft.sourceKelas, draft.targetKelas, selectedNipds);
}

async function simpanAnggotaKelasBayangan(sourceKelas, targetKelas, selectedNipds) {
  const sourceParts = getKelasBayanganParts(sourceKelas);
  const targetParts = getKelasBayanganParts(targetKelas);
  const selectedSet = new Set(selectedNipds.map(value => String(value || "").trim()).filter(Boolean));
  const sourceRows = getKelasBayanganOriginalMembers(sourceParts.kelas);
  const changes = new Map();

  if (!sourceParts.kelas || !targetParts.kelas || sourceParts.tingkat !== targetParts.tingkat) {
    Swal.fire("Belum valid", "Kelas sumber dan tujuan harus berada pada jenjang yang sama.", "warning");
    return;
  }

  sourceRows.forEach(siswa => {
    const nipd = String(siswa.nipd || "").trim();
    if (!nipd) return;
    const savedKelas = siswa.kelasBayanganSavedParts?.kelas || "";

    if (selectedSet.has(nipd) && savedKelas !== targetParts.kelas) {
      changes.set(nipd, { kelas_bayangan: targetParts.kelas });
    }

    if (!selectedSet.has(nipd) && savedKelas === targetParts.kelas) {
      changes.set(nipd, { kelas_bayangan: "" });
    }
  });

  if (changes.size === 0) {
    Swal.fire("Tidak ada perubahan", "", "info");
    return;
  }

  try {
    Swal.fire({ title: "Menyimpan anggota kelas real...", didOpen: () => Swal.showLoading() });
    const batch = db.batch();
    changes.forEach((payload, nipd) => {
      batch.set(
        typeof getSemesterDocRef === "function"
          ? getSemesterDocRef("siswa", nipd)
          : db.collection("siswa").doc(nipd),
        {
          ...payload,
          updated_at: new Date()
        },
        { merge: true }
      );
    });
    await batch.commit();
    Swal.fire("Berhasil", `${selectedSet.size} anggota kelas real tersimpan`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Anggota kelas real belum berhasil disimpan", "error");
  }
}

function makeMengajarBayanganDocId(tingkat, rombel, mapelKode) {
  return `${String(tingkat || "").trim()}_${String(rombel || "").trim().toUpperCase()}_${String(mapelKode || "").trim().toUpperCase()}`;
}

function listenMengajarBayangan(callback) {
  return db.collection("mengajar_bayangan").onSnapshot(snapshot => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}

async function ensureMapelBayanganClone() {
  if (isCloningMapelBayangan || semuaDataMapel.length > 0) return;
  isCloningMapelBayangan = true;
  try {
    const [originalSnapshot, bayanganSnapshot] = await Promise.all([
      db.collection("mapel").get(),
      db.collection("mapel_bayangan").get()
    ]);
    if (!bayanganSnapshot.empty) return;
    if (originalSnapshot.empty) return;

    const batch = db.batch();
    originalSnapshot.docs.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      const kode = String(data.kode_mapel || doc.id || "").trim().toUpperCase();
      if (!kode) return;
      batch.set(db.collection("mapel_bayangan").doc(kode), {
        ...data,
        kode_mapel: kode,
        sumber_clone: "mapel",
        cloned_at: new Date(),
        updated_at: new Date()
      });
    });
    await batch.commit();
  } catch (error) {
    console.error("Gagal clone mapel bayangan", error);
  } finally {
    isCloningMapelBayangan = false;
  }
}

function ensureKelasBayanganClones() {
  ensureMapelBayanganClone();
}

function loadRealtimeKelasBayanganMengajar() {
  loadRealtimeKelasBayangan();

  if (unsubscribeMengajarBayangan) unsubscribeMengajarBayangan();
  if (unsubscribeMengajarBayanganAsli) unsubscribeMengajarBayanganAsli();
  if (unsubscribeMengajarBayanganMapel) unsubscribeMengajarBayanganMapel();
  if (unsubscribeMengajarBayanganGuru) unsubscribeMengajarBayanganGuru();

  unsubscribeMengajarBayangan = listenMengajarBayangan(data => {
    semuaDataMengajarBayangan = data;
    ensureKelasBayanganClones();
    renderMengajarBayanganMatrix();
  });

  unsubscribeMengajarBayanganMapel = listenMapelBayangan(data => {
    semuaDataMapel = data;
    ensureKelasBayanganClones();
    renderMengajarBayanganMatrix();
  });

  unsubscribeMengajarBayanganGuru = listenGuru(data => {
    semuaDataGuru = data;
    renderMengajarBayanganMatrix();
  });
}

function getMengajarBayanganRombels() {
  const sourceKelas = getKelasBayanganSourceForLevel(kelasBayanganMengajarTingkat);
  return sortKelasBayanganItems(semuaDataKelasBayanganKelas)
    .map(item => getKelasBayanganParts(item.kelas || `${item.tingkat || ""}${item.rombel || ""}`))
    .filter(parts => {
      if (parts.tingkat !== kelasBayanganMengajarTingkat || !parts.rombel) return false;
      if (sourceKelas && parts.kelas === sourceKelas) return false;
      if (!isRombelBayanganUtama(parts.rombel)) return false;
      return getKelasBayanganMembers(parts.kelas).length > 0;
    })
    .sort((a, b) => compareValues(a.rombel, b.rombel, "asc"));
}

function getMengajarBayanganAssignment(tingkat, rombel, mapelKode) {
  return semuaDataMengajarBayangan.find(item =>
    String(item.tingkat || "") === String(tingkat || "") &&
    String(item.rombel || "").toUpperCase() === String(rombel || "").toUpperCase() &&
    String(item.mapel_kode || "").toUpperCase() === String(mapelKode || "").toUpperCase()
  ) || null;
}

function getMengajarBayanganSelectValue(tingkat, rombel, mapelKode) {
  const docId = makeMengajarBayanganDocId(tingkat, rombel, mapelKode);
  if (Object.prototype.hasOwnProperty.call(pendingMengajarBayanganChanges, docId)) {
    return pendingMengajarBayanganChanges[docId].guru_kode ?? "";
  }
  return getMengajarBayanganAssignment(tingkat, rombel, mapelKode)?.guru_kode || "";
}

function getMengajarBayanganSearchMatchCount() {
  if (!mengajarBayanganSearchQuery) return 0;
  const rombels = getMengajarBayanganRombels();
  const mapels = getMengajarMapels();
  return mapels.reduce((total, mapel) =>
    total + rombels.reduce((rowTotal, parts) => {
      const guruKode = getMengajarBayanganSelectValue(kelasBayanganMengajarTingkat, parts.rombel, mapel.kode_mapel);
      return rowTotal + (typeof matchesMengajarGuruSearch === "function" && matchesMengajarGuruSearch(guruKode, mengajarBayanganSearchQuery) ? 1 : 0);
    }, 0), 0);
}

function updateMengajarBayanganSearchStatus() {
  const info = document.getElementById("mengajarBayanganSearchInfo");
  if (!info) return;

  if (!mengajarBayanganSearchQuery) {
    info.innerText = "Cari nama atau kode guru untuk menyorot posisi di matriks.";
    return;
  }

  const count = getMengajarBayanganSearchMatchCount();
  info.innerText = count > 0
    ? `${count} posisi ditemukan untuk ${typeof getMengajarSearchGuruName === "function" ? getMengajarSearchGuruName(mengajarBayanganSearchQuery) : mengajarBayanganSearchQuery}.`
    : `Tidak ada posisi untuk ${typeof getMengajarSearchGuruName === "function" ? getMengajarSearchGuruName(mengajarBayanganSearchQuery) : mengajarBayanganSearchQuery}.`;
}

function focusFirstMengajarBayanganSearchMatch() {
  if (!mengajarBayanganSearchQuery) return;
  requestAnimationFrame(() => {
    const firstMatch = document.querySelector("#mengajarBayanganMatrixContainer .mengajar-grid-search-match");
    if (!firstMatch) return;
    firstMatch.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  });
}

function handleMengajarBayanganSearchInput(value) {
  mengajarBayanganSearchDraft = String(value || "");
}

function handleMengajarBayanganSearchKeydown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  submitMengajarBayanganSearch();
}

function submitMengajarBayanganSearch() {
  mengajarBayanganSearchQuery = String(mengajarBayanganSearchDraft || "").trim();
  renderMengajarBayanganMatrix();
  focusFirstMengajarBayanganSearchMatch();
}

function clearMengajarBayanganSearch() {
  mengajarBayanganSearchDraft = "";
  mengajarBayanganSearchQuery = "";
  const input = document.getElementById("mengajarBayanganSearchInput");
  if (input) input.value = "";
  renderMengajarBayanganMatrix();
}

function buildMengajarBayanganPayload(tingkat, rombel, mapelKode, guruKode) {
  const mapel = semuaDataMapel.find(item => item.kode_mapel === mapelKode);
  const guru = semuaDataGuru.find(item => item.kode_guru === guruKode);

  if (!guruKode) {
    return { __delete: true, tingkat, rombel, mapel_kode: mapelKode };
  }

  if (mapel && !isKelasBayanganMapelApplicableForClass(mapel, tingkat, rombel)) {
    return { __error: getKelasBayanganMapelDisabledReason(mapel, tingkat, rombel) };
  }

  if (!guru) {
    return { __error: `Guru tidak dikenali untuk ${mapel?.nama_mapel || mapelKode} kelas ${buildKelasName(tingkat, rombel)}.` };
  }

  return {
    tingkat,
    rombel,
    kelas: buildKelasName(tingkat, rombel),
    mapel_kode: mapelKode,
    mapel_nama: mapel?.nama_mapel || "",
    guru_kode: guru.kode_guru,
    guru_nama: formatNamaGuru(guru),
    guru_nip: guru.nip || "",
    sumber: "kelas_bayangan",
    updated_at: new Date()
  };
}

function projectMengajarBayanganAssignments(preparedChanges = []) {
  const assignmentMap = new Map();

  semuaDataMengajarBayangan.forEach(item => {
    assignmentMap.set(makeMengajarBayanganDocId(item.tingkat, item.rombel, item.mapel_kode), { ...item, sumber: "kelas_bayangan" });
  });

  preparedChanges.forEach(item => {
    const docId = makeMengajarBayanganDocId(item.tingkat, item.rombel, item.mapel_kode);
    if (item.__delete) {
      assignmentMap.delete(docId);
      return;
    }
    assignmentMap.set(docId, { ...assignmentMap.get(docId), ...item });
  });

  return Array.from(assignmentMap.values()).filter(item => {
    const mapel = semuaDataMapel.find(entry =>
      String(entry.kode_mapel || entry.id || "").trim().toUpperCase() === String(item.mapel_kode || "").trim().toUpperCase()
    );
    return !mapel || isKelasBayanganMapelApplicableForClass(mapel, item.tingkat, item.rombel);
  });
}

function updateMengajarBayanganInfo() {
  const mapelCount = getMengajarMapels().length;
  const kelasCount = getMengajarBayanganRombels().length;
  const info = document.getElementById("jumlahMengajarBayanganInfo");
  const pending = document.getElementById("pendingMengajarBayanganInfo");
  if (info) info.innerText = `${mapelCount} mapel x ${kelasCount} kelas`;
  if (pending) pending.innerText = `${Object.keys(pendingMengajarBayanganChanges).length} perubahan belum disimpan`;
}

function handleMengajarBayanganSelectChange(tingkat, rombel, mapelKode, guruKode) {
  const mapel = semuaDataMapel.find(item => String(item.kode_mapel || "").trim().toUpperCase() === String(mapelKode || "").trim().toUpperCase());
  if (mapel && !isKelasBayanganMapelApplicableForClass(mapel, tingkat, rombel)) return;

  const docId = makeMengajarBayanganDocId(tingkat, rombel, mapelKode);
  pendingMengajarBayanganChanges[docId] = {
    tingkat,
    rombel,
    mapel_kode: mapelKode,
    guru_kode: guruKode
  };
  renderMengajarBayanganMatrix();
}

function getProjectedGuruJPTotalsBayangan(assignments = []) {
  const totals = new Map();

  assignments.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    const mapelKode = String(item.mapel_kode || "").trim().toUpperCase();
    if (!guruKode || !mapelKode) return;

    const mapel = semuaDataMapel.find(entry =>
      String(entry.kode_mapel || entry.id || "").trim().toUpperCase() === mapelKode
    );
    if (mapel && !isKelasBayanganMapelApplicableForClass(mapel, item.tingkat, item.rombel)) return;
    totals.set(guruKode, (totals.get(guruKode) || 0) + Number(mapel?.jp || 0));
  });

  return totals;
}

function getProjectedGuruOwnMapelJPTotalsBayangan(assignments = []) {
  const totals = new Map();

  assignments.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    const mapelKode = String(item.mapel_kode || "").trim().toUpperCase();
    if (!guruKode || !mapelKode) return;

    const guru = semuaDataGuru.find(entry => String(entry.kode_guru || "").trim() === guruKode);
    const mapel = semuaDataMapel.find(entry =>
      String(entry.kode_mapel || entry.id || "").trim().toUpperCase() === mapelKode
    );
    if (mapel && !isKelasBayanganMapelApplicableForClass(mapel, item.tingkat, item.rombel)) return;
    const guruMapel = String(guru?.mata_pelajaran || "").trim().toLowerCase();
    const isOwnMapel = guruMapel && (
      guruMapel === mapelKode.toLowerCase() ||
      guruMapel === String(mapel?.nama_mapel || "").trim().toLowerCase()
    );
    if (!isOwnMapel) return;

    totals.set(guruKode, (totals.get(guruKode) || 0) + Number(mapel?.jp || 0));
  });

  return totals;
}

function buildMengajarBayanganSummaryHtml(assignments = []) {
  const totals = getProjectedGuruJPTotalsBayangan(assignments);
  const ownMapelTotals = getProjectedGuruOwnMapelJPTotalsBayangan(assignments);
  const summary = getMengajarGurus()
    .map(guru => ({
      nama: formatNamaGuru(guru),
      jp: totals.get(guru.kode_guru || "") || 0,
      ownMapelJp: ownMapelTotals.get(guru.kode_guru || "") || 0,
      status: getGuruJPStatus(totals.get(guru.kode_guru || "") || 0)
    }))
    .sort((a, b) => {
      if (b.jp !== a.jp) return b.jp - a.jp;
      return compareValues(a.nama, b.nama, "asc");
    });

  const overloadCount = summary.filter(item => item.jp >= MENGAJAR_DANGER_MIN_JP).length;
  const warningCount = summary.filter(item => item.jp >= MENGAJAR_WARN_MIN_JP && item.jp <= MENGAJAR_WARN_MAX_JP).length;
  const greenCount = summary.filter(item => item.jp >= MENGAJAR_GREEN_MIN_JP && item.jp <= MENGAJAR_GREEN_MAX_JP).length;
  const items = summary.map(item => `
    <div class="mengajar-jp-item mengajar-jp-${item.status}">
      <div class="mengajar-jp-head">
        <strong>${escapeKelasBayanganHtml(item.nama || "-")}</strong>
        <span>${item.jp} JP | ${item.ownMapelJp} JP</span>
      </div>
    </div>
  `).join("");

  return `
    <section class="mengajar-summary-panel">
      <div class="mengajar-summary-header">
        <div>
          <h3>Rekap JP Guru Kelas Real</h3>
          <p>Perhitungan hanya dari pembagian mengajar kelas real dan data mapel kelas real.</p>
        </div>
        <div class="mengajar-summary-badges">
          <span class="mengajar-summary-badge is-green">${greenCount} aman</span>
          <span class="mengajar-summary-badge is-warning">${warningCount} kuning</span>
          <span class="mengajar-summary-badge is-danger">${overloadCount} merah</span>
        </div>
      </div>
      <div class="mengajar-summary-rules">
        Format rekap: total JP kelas real | JP sesuai mapel guru. Tugas tambahan tidak dihitung di kelas real.
      </div>
      <div class="mengajar-jp-grid">
        ${items || '<div class="empty-panel">Belum ada guru yang bisa ditampilkan.</div>'}
      </div>
    </section>
  `;
}

function renderMengajarBayanganMatrix() {
  const container = document.getElementById("mengajarBayanganMatrixContainer");
  if (!container) return;

  const rombels = getMengajarBayanganRombels();
  const mapels = getMengajarMapels();
  const projectedAssignments = projectMengajarBayanganAssignments(
    Object.values(pendingMengajarBayanganChanges)
      .map(item => buildMengajarBayanganPayload(item.tingkat, item.rombel, item.mapel_kode, item.guru_kode))
      .filter(item => !item.__error)
  );
  const projectedTotals = getProjectedGuruJPTotalsBayangan(projectedAssignments);
  const sourceKelas = getKelasBayanganSourceForLevel(kelasBayanganMengajarTingkat);

  updateMengajarBayanganInfo();
  const summaryHtml = buildMengajarBayanganSummaryHtml(projectedAssignments);

  if (rombels.length === 0) {
    container.innerHTML = `
      <div class="empty-panel">Belum ada kelas real aktif untuk tingkat ${kelasBayanganMengajarTingkat}.</div>
      ${summaryHtml}
    `;
    return;
  }

  if (mapels.length === 0) {
    container.innerHTML = `
      <div class="empty-panel">Belum ada data mapel.</div>
      ${summaryHtml}
    `;
    return;
  }

  const headCols = rombels.map(parts => `<th>${escapeKelasBayanganHtml(parts.rombel)}</th>`).join("");
  const bodyRows = mapels.map(mapel => {
    const cells = rombels.map(parts => {
      const isApplicable = isKelasBayanganMapelApplicableForClass(mapel, kelasBayanganMengajarTingkat, parts.rombel);
      if (!isApplicable) {
        return `
          <td class="mengajar-grid-cell mengajar-grid-disabled">
            <select class="mengajar-cell-dropdown mengajar-cell-dropdown-disabled" title="${escapeKelasBayanganHtml(getKelasBayanganMapelDisabledReason(mapel, kelasBayanganMengajarTingkat, parts.rombel))}" disabled>
              <option>-</option>
            </select>
          </td>
        `;
      }

      const value = getMengajarBayanganSelectValue(kelasBayanganMengajarTingkat, parts.rombel, mapel.kode_mapel);
      const totalJP = value ? projectedTotals.get(value) || 0 : 0;
      const statusClass = value ? `mengajar-grid-${getGuruJPStatus(totalJP)}` : "";
      const searchClass = typeof matchesMengajarGuruSearch === "function" && matchesMengajarGuruSearch(value, mengajarBayanganSearchQuery)
        ? "mengajar-grid-search-match"
        : "";
      return `
        <td class="mengajar-grid-cell ${statusClass} ${searchClass}" data-guru-kode="${escapeKelasBayanganHtml(value)}">
          <select
            class="mengajar-cell-dropdown"
            title="${value ? `${getMengajarGuruTitle(value)} | ${totalJP} JP` : getMengajarGuruTitle(value)}"
            onchange="handleMengajarBayanganSelectChange('${kelasBayanganMengajarTingkat}','${escapeKelasBayanganJs(parts.rombel)}','${escapeKelasBayanganJs(mapel.kode_mapel)}', this.value); this.title = getMengajarGuruTitle(this.value);"
          >
            ${renderGuruOptionsMengajar(value)}
          </select>
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td class="mengajar-mapel-cell"><strong>${escapeKelasBayanganHtml(mapel.kode_mapel)}</strong></td>
        ${cells}
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="matrix-toolbar-note">
      ${sourceKelas
        ? `Kelas sumber aktif: ${escapeKelasBayanganHtml(sourceKelas)}. Kelas sumber tidak ditampilkan sebagai kolom mengajar.`
        : `Matriks memakai entitas kelas real terpisah dari pembagian mengajar asli.`}
    </div>
    <div class="table-container matrix-table-wrap">
      <table class="matrix-table">
        <thead>
          <tr>
            <th>Mapel</th>
            ${headCols}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    ${summaryHtml}
  `;
  updateMengajarBayanganSearchStatus();
}

function setMengajarBayanganTingkat(value) {
  kelasBayanganMengajarTingkat = value || "7";
  pendingMengajarBayanganChanges = {};
  const content = document.getElementById("content");
  if (content) content.innerHTML = renderKelasBayanganMengajarPage();
  renderMengajarBayanganMatrix();
}

function refreshMengajarBayanganPage() {
  loadRealtimeKelasBayanganMengajar();
  renderMengajarBayanganMatrix();
}

async function saveAllMengajarBayangan() {
  const changes = Object.values(pendingMengajarBayanganChanges);
  if (changes.length === 0) {
    Swal.fire("Tidak ada perubahan", "Ubah matriks kelas real terlebih dahulu.", "info");
    return;
  }

  try {
    const prepared = changes.map(item => buildMengajarBayanganPayload(item.tingkat, item.rombel, item.mapel_kode, item.guru_kode));
    const invalid = prepared.filter(item => item.__error);
    if (invalid.length > 0) {
      Swal.fire("Ada guru yang belum cocok", invalid.slice(0, 5).map(item => item.__error).join("<br>"), "warning");
      return;
    }

    Swal.fire({ title: "Menyimpan pembagian mengajar kelas real...", didOpen: () => Swal.showLoading() });
    const batch = db.batch();
    let simpan = 0;
    let hapus = 0;

    prepared.forEach(item => {
      const ref = db.collection("mengajar_bayangan").doc(makeMengajarBayanganDocId(item.tingkat, item.rombel, item.mapel_kode));
      if (item.__delete) {
        batch.delete(ref);
        hapus++;
      } else {
        const existing = semuaDataMengajarBayangan.find(entry =>
          String(entry.tingkat || "") === String(item.tingkat || "") &&
          String(entry.rombel || "").toUpperCase() === String(item.rombel || "").toUpperCase() &&
          String(entry.mapel_kode || "").toUpperCase() === String(item.mapel_kode || "").toUpperCase()
        );
        batch.set(ref, {
          ...item,
          created_at: existing?.created_at || new Date()
        });
        simpan++;
      }
    });

    await batch.commit();
    pendingMengajarBayanganChanges = {};
    updateMengajarBayanganInfo();
    Swal.fire("Berhasil", `Tersimpan: ${simpan}, Dihapus: ${hapus}`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Pembagian mengajar kelas real belum berhasil disimpan", "error");
  }
}

function renderSetKelasBayanganList(kelasValue, targetKelas = "") {
  const members = getKelasBayanganMembers(kelasValue);
  if (members.length === 0) {
    return `<div class="empty-panel">Belum ada anggota yang bisa dipindahkan.</div>`;
  }

  return members.map(siswa => {
    const nipd = String(siswa.nipd || "").trim();
    return `
      <div class="anggota-option anggota-option-row">
        <span>
          <strong>${escapeKelasBayanganHtml(siswa.nama || "-")}</strong>
          <small>${escapeKelasBayanganHtml(nipd)} | Asli: ${escapeKelasBayanganHtml(siswa.kelas || "-")}</small>
        </span>
        <button type="button" class="btn-secondary" onclick="moveSiswaKelasBayangan('${escapeKelasBayanganJs(nipd)}')">Pindahkan</button>
      </div>
    `;
  }).join("");
}

function refreshSetKelasBayanganModal(sourceKelas) {
  const target = document.getElementById("setKelasBayanganTarget")?.value || "";
  const list = document.getElementById("setKelasBayanganList");
  const selected = document.getElementById("setKelasBayanganSelected");
  if (selected) selected.innerText = target || "-";
  if (list) list.innerHTML = renderSetKelasBayanganList(sourceKelas, target);
}

function showSetKelasBayangan(kelasValue) {
  const options = getKelasBayanganTargetOptions(kelasValue, kelasValue);
  Swal.fire({
    title: `Set ${escapeKelasBayanganHtml(kelasValue)} sebagai kelas real`,
    width: 920,
    html: `
      <div class="anggota-modal-note">
        Pilih kelas tujuan, lalu pindahkan anggota ${escapeKelasBayanganHtml(kelasValue)} ke kelas real lain.
      </div>
      <div class="kelas-bayangan-set-layout">
        <section class="anggota-panel">
          <div class="anggota-panel-head">
            <strong>Anggota ${escapeKelasBayanganHtml(kelasValue)}</strong>
            <span>${getKelasBayanganMembers(kelasValue).length} siswa</span>
          </div>
          <div id="setKelasBayanganList" class="anggota-list">${renderSetKelasBayanganList(kelasValue, kelasValue)}</div>
        </section>
        <section class="anggota-panel">
          <div class="anggota-panel-head">
            <strong>Kelas Tujuan</strong>
            <span id="setKelasBayanganSelected">${escapeKelasBayanganHtml(kelasValue)}</span>
          </div>
          <select id="setKelasBayanganTarget" class="kelas-inline-select" onchange="refreshSetKelasBayanganModal('${escapeKelasBayanganJs(kelasValue)}')">
            ${options}
          </select>
          <div class="matrix-toolbar-note">Siswa yang dipindahkan akan disimpan ke field kelas_bayangan.</div>
        </section>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true
  });
}

async function moveSiswaKelasBayangan(nipd) {
  const target = document.getElementById("setKelasBayanganTarget")?.value || "";
  const siswa = semuaDataKelasBayanganSiswa.find(item => String(item.nipd || "") === String(nipd));
  const targetParts = getKelasBayanganParts(target);
  const asliParts = getKelasBayanganParts(siswa?.kelas);

  if (!siswa || !targetParts.kelas || targetParts.tingkat !== asliParts.tingkat || !isRombelBayanganUtama(targetParts.rombel)) {
    Swal.fire("Belum valid", "Pilih kelas real tujuan A-H pada tingkat yang sama.", "warning");
    return;
  }

  await updateSiswa(nipd, {
    kelas_bayangan: targetParts.kelas,
    updated_at: new Date()
  });

  Swal.fire("Tersimpan", `${siswa.nama || "Siswa"} dipindahkan ke ${targetParts.kelas}.`, "success");
}

async function saveKelasBayanganManual(nipd, selectId) {
  const select = document.getElementById(selectId);
  const target = select?.value || "";
  const siswa = semuaDataKelasBayanganSiswa.find(item => String(item.nipd || "") === String(nipd));
  const asliParts = getKelasBayanganParts(siswa?.kelas);
  const targetParts = getKelasBayanganParts(target);

  if (!targetParts.kelas || targetParts.tingkat !== asliParts.tingkat || !isRombelBayanganUtama(targetParts.rombel)) {
    Swal.fire("Belum valid", "Pilih kelas real A-H pada tingkat yang sama.", "warning");
    return;
  }

  await updateSiswa(nipd, {
    kelas_bayangan: targetParts.kelas,
    updated_at: new Date()
  });
  Swal.fire("Tersimpan", "Kelas real siswa sudah diperbarui.", "success");
}

async function syncKelasBayanganUtama() {
  const candidates = semuaDataKelasBayanganSiswa
    .map(siswa => ({ ...siswa, kelasAsliParts: getKelasBayanganParts(siswa.kelas) }))
    .filter(siswa => siswa.nipd && isRombelBayanganUtama(siswa.kelasAsliParts.rombel) && !siswa.kelas_bayangan);

  if (candidates.length === 0) {
    Swal.fire("Sudah sinkron", "Semua kelas asli A-H sudah menjadi kelas real.", "info");
    return;
  }

  for (let index = 0; index < candidates.length; index += 450) {
    const batch = db.batch();
    candidates.slice(index, index + 450).forEach(siswa => {
      const siswaRef = typeof getSemesterDocRef === "function"
        ? getSemesterDocRef("siswa", siswa.nipd)
        : db.collection("siswa").doc(siswa.nipd);
      batch.update(siswaRef, {
        kelas_bayangan: siswa.kelasAsliParts.kelas,
        updated_at: new Date()
      });
    });
    await batch.commit();
  }

  Swal.fire("Selesai", `${candidates.length} siswa A-H sudah disinkronkan.`, "success");
}
