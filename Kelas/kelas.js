// ================= STATE KELAS =================
let semuaDataKelas = [];
let daftarGuruKelas = [];
let daftarMengajarKelas = [];
let daftarSiswaKelas = [];
let unsubscribeKelas = null;
let unsubscribeKelasGuru = null;
let unsubscribeKelasMengajar = null;
let unsubscribeKelasSiswa = null;
let currentPageKelas = 1;
let rowsPerPageKelas = 10;
let isSubmittingKelas = false;
let currentEditKelas = null;
let kelasSortField = "tingkat";
let kelasSortDirection = "asc";
let draftKelasTingkat = "7";
let draftWaliKelasTarget = "";
let draftKelasWali = "";
let anggotaKelasDraft = null;
let acakWaliKelasState = JSON.parse(localStorage.getItem("acakWaliKelasState") || "{\"excluded\":{}}");
let acakWaliKelasDraft = null;
let acakWaliKelasUndo = JSON.parse(localStorage.getItem("acakWaliKelasUndo") || "null");

function escapeKelasHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeKelasJs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function downloadKelasTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([[
    "KELAS",
    "KODE_GURU",
    "WALI_KELAS"
  ]]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "template-import-kelas.xlsx");
}

function normalizeKelasHeader(text) {
  return String(text || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function getKelasCellValue(row, aliases) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKelasHeader(key), value])
  );

  for (const alias of aliases) {
    const value = normalizedRow[normalizeKelasHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function findGuruForKelasImport(kodeGuru, waliKelasText) {
  const kode = String(kodeGuru || "").trim();
  const waliText = String(waliKelasText || "").trim().toLowerCase();

  if (kode) {
    const guruByCode = daftarGuruKelas.find(item => item.kode_guru === kode);
    if (guruByCode) return guruByCode;
  }

  if (waliText) {
    return daftarGuruKelas.find(item => formatNamaGuru(item).trim().toLowerCase() === waliText) || null;
  }

  return null;
}

function parseKelasParts(kelasValue = "") {
  const raw = String(kelasValue || "").trim().toUpperCase();
  const normalized = raw.replace(/\s+/g, "");
  const match = normalized.match(/^([7-9])([A-Z]+)$/);

  if (match) {
    return {
      tingkat: match[1],
      rombel: match[2],
      kelas: `${match[1]} ${match[2]}`
    };
  }

  return {
    tingkat: "",
    rombel: "",
    kelas: raw
  };
}

function buildKelasName(tingkat, rombel) {
  const level = String(tingkat || "").trim();
  const group = String(rombel || "").trim().toUpperCase();
  return level && group ? `${level} ${group}` : "";
}

function getStoredKelasParts(item) {
  if (item?.tingkat && item?.rombel) {
    return {
      tingkat: String(item.tingkat).trim(),
      rombel: String(item.rombel).trim().toUpperCase(),
      kelas: buildKelasName(item.tingkat, item.rombel)
    };
  }

  return parseKelasParts(item?.kelas || "");
}

function getNextRombelForTingkat(tingkat, excludeKelas = "") {
  const level = String(tingkat || "").trim();
  const exclude = String(excludeKelas || "").trim().toUpperCase().replace(/\s+/g, "");
  const letters = semuaDataKelas
    .map(item => getStoredKelasParts(item))
    .filter(parts => parts.tingkat === level && `${parts.tingkat}${parts.rombel}` !== exclude && parts.rombel)
    .map(parts => parts.rombel);

  if (letters.length === 0) return "A";

  let maxCode = "A".charCodeAt(0) - 1;
  letters.forEach(letter => {
    const code = String(letter).charCodeAt(0);
    if (code > maxCode) maxCode = code;
  });

  return String.fromCharCode(maxCode + 1);
}

function getCurrentDraftRombel() {
  return getNextRombelForTingkat(draftKelasTingkat);
}

function syncKelasAutoFields() {
  const tingkatEl = document.getElementById("tingkatKelas");
  const rombelEl = document.getElementById("rombelKelas");
  if (tingkatEl) draftKelasTingkat = tingkatEl.value || "7";
  if (rombelEl) rombelEl.value = getCurrentDraftRombel();
}

function syncEditKelasAutoField(kelasLama) {
  const tingkatEl = document.getElementById("editTingkatKelas");
  const rombelEl = document.getElementById("editRombelKelas");
  if (!tingkatEl || !rombelEl) return;

  rombelEl.value = getNextRombelForTingkat(tingkatEl.value, kelasLama);
}

function formatWaliKelasLabel(kodeGuru) {
  const guru = daftarGuruKelas.find(item => item.kode_guru === kodeGuru);
  return guru ? formatNamaGuru(guru) : "-";
}

function getUsedWaliKelasCodes(excludeKelas = "") {
  const excludeValue = String(excludeKelas || "").trim().toUpperCase();
  return new Set(
    semuaDataKelas
      .filter(item => getStoredKelasParts(item).kelas.toUpperCase() !== excludeValue)
      .map(item => String(item.kode_guru || "").trim())
      .filter(Boolean)
  );
}

function getMengajarGuruCodesForKelas(namaKelas = "") {
  const targetKelas = getStoredKelasParts({ kelas: namaKelas }).kelas.toUpperCase();
  if (!targetKelas) return new Set();

  return new Set(
    daftarMengajarKelas
      .filter(item => {
        const kelasMengajar = getStoredKelasParts({
          kelas: item.kelas || buildKelasName(item.tingkat, item.rombel),
          tingkat: item.tingkat,
          rombel: item.rombel
        }).kelas.toUpperCase();
        return kelasMengajar === targetKelas;
      })
      .map(item => String(item.guru_kode || "").trim())
      .filter(Boolean)
  );
}

function guruMengajarDiKelas(kodeGuru = "", namaKelas = "") {
  const guruKode = String(kodeGuru || "").trim();
  if (!guruKode || !namaKelas) return false;
  return getMengajarGuruCodesForKelas(namaKelas).has(guruKode);
}

function getEligibleWaliGuruKelas(selectedValue = "", selectedKelas = "") {
  const usedCodes = getUsedWaliKelasCodes(selectedKelas);
  const mengajarCodes = getMengajarGuruCodesForKelas(selectedKelas);
  return daftarGuruKelas.filter(guru => {
    const value = guru.kode_guru || "";
    if (!value) return false;
    if (typeof isGuruStatusGB === "function" ? isGuruStatusGB(guru) : String(guru.status || "").trim().toUpperCase() === "GB") return false;
    if (!mengajarCodes.has(value)) return false;
    if (usedCodes.has(value) && value !== selectedValue) return false;
    return true;
  });
}

function getGuruOptionsKelas(selectedValue = "", selectedKelas = "") {
  const options = [
    `<option value="">${selectedKelas ? "Pilih wali kelas" : "Pilih kelas terlebih dahulu"}</option>`,
    ...getEligibleWaliGuruKelas(selectedValue, selectedKelas).map(guru => {
      const value = guru.kode_guru || "";
      const selected = value === selectedValue ? "selected" : "";
      const label = formatNamaGuru(guru) || value;
      return `<option value="${value}" ${selected}>${label}</option>`;
    })
  ];

  return options.filter(Boolean).join("");
}

function getGuruKelasByKode(kodeGuru = "") {
  return daftarGuruKelas.find(item => String(item.kode_guru || "").trim() === String(kodeGuru || "").trim()) || null;
}

function getKelasWaliByLevel(level) {
  return sortKelasData(semuaDataKelas)
    .map(item => ({ item, parts: getStoredKelasParts(item) }))
    .filter(({ parts }) => parts.tingkat === String(level || "") && parts.rombel);
}

function hasAcakWaliUndo() {
  return Array.isArray(acakWaliKelasUndo?.items) && acakWaliKelasUndo.items.length > 0;
}

function validateKelasValues(tingkat, rombel, excludeKelas = "") {
  const kelasValue = buildKelasName(tingkat, rombel);
  const excludeValue = String(excludeKelas || "").trim().toUpperCase();

  if (!tingkat) {
    return "Tingkat wajib dipilih";
  }

  if (!rombel) {
    return "Kelas otomatis belum tersedia";
  }

  const duplicate = semuaDataKelas.some(item => {
    const existingKelas = getStoredKelasParts(item).kelas.toUpperCase();
    return existingKelas === kelasValue && existingKelas !== excludeValue;
  });

  if (duplicate) {
    return "Kelas sudah digunakan";
  }

  return "";
}

function validateWaliKelasValues(namaKelas, kodeGuru) {
  const waliValue = String(kodeGuru || "").trim();
  const kelasValue = String(namaKelas || "").trim().toUpperCase();

  if (!kelasValue) {
    return "Kelas wajib dipilih";
  }

  const selectedKelas = semuaDataKelas.find(item => getStoredKelasParts(item).kelas.toUpperCase() === kelasValue);
  if (!selectedKelas) {
    return "Kelas tidak ditemukan";
  }

  if (!waliValue) {
    return "Wali kelas wajib dipilih";
  }

  const selectedGuru = daftarGuruKelas.find(item => String(item.kode_guru || "").trim() === waliValue);
  if (!selectedGuru || (typeof isGuruStatusGB === "function" ? isGuruStatusGB(selectedGuru) : String(selectedGuru.status || "").trim().toUpperCase() === "GB")) {
    return "Wali kelas tidak boleh guru berstatus GB";
  }

  if (!guruMengajarDiKelas(waliValue, kelasValue)) {
    return "Wali kelas harus guru yang mengajar di kelas tersebut";
  }

  const duplicateWali = semuaDataKelas.some(item => {
    const existingKelas = getStoredKelasParts(item).kelas.toUpperCase();
    return String(item.kode_guru || "").trim() === waliValue && existingKelas !== kelasValue;
  });

  if (duplicateWali) {
    return "Guru tersebut sudah menjadi wali kelas";
  }

  return "";
}

function setKelasRowsPerPage(value) {
  rowsPerPageKelas = value === "all" ? "all" : Number(value);
  currentPageKelas = 1;
  renderKelasFiltered();
}

function sortKelasData(data) {
  return [...data].sort((a, b) => {
    const leftParts = getStoredKelasParts(a);
    const rightParts = getStoredKelasParts(b);
    const left = kelasSortField === "tingkat" ? leftParts.tingkat : kelasSortField === "rombel" ? leftParts.rombel : a[kelasSortField];
    const right = kelasSortField === "tingkat" ? rightParts.tingkat : kelasSortField === "rombel" ? rightParts.rombel : b[kelasSortField];
    return compareValues(left, right, kelasSortDirection);
  });
}

function setKelasSort(field) {
  if (kelasSortField === field) {
    kelasSortDirection = kelasSortDirection === "asc" ? "desc" : "asc";
  } else {
    kelasSortField = field;
    kelasSortDirection = "asc";
  }
  currentPageKelas = 1;
  renderKelasTableState();
}

function renderKelasTableState() {
  const content = document.getElementById("content");
  if (!content) return;
  const rowsValue = String(rowsPerPageKelas);
  content.innerHTML = renderKelasPage();
  const rows = document.getElementById("rowsPerPageKelas");
  if (rows) rows.value = rowsValue;
  renderKelasFiltered();
}

function getKelasRowsPerPageValue() {
  return rowsPerPageKelas === "all" ? Number.MAX_SAFE_INTEGER : Number(rowsPerPageKelas);
}

function setKelasPage(page) {
  const totalPages = Math.max(1, Math.ceil(semuaDataKelas.length / getKelasRowsPerPageValue()));
  currentPageKelas = Math.min(Math.max(1, page), totalPages);
  renderKelasFiltered();
}

function resetKelasFilter() {
  const rows = document.getElementById("rowsPerPageKelas");
  if (rows) rows.value = "10";
  rowsPerPageKelas = 10;
  currentPageKelas = 1;
  renderKelasFiltered();
}

function refreshKelasTable() {
  loadRealtimeKelas();
  renderKelasFiltered();
}

function loadRealtimeKelas() {
  if (unsubscribeKelas) unsubscribeKelas();
  if (unsubscribeKelasGuru) unsubscribeKelasGuru();
  if (unsubscribeKelasMengajar) unsubscribeKelasMengajar();
  if (unsubscribeKelasSiswa) unsubscribeKelasSiswa();

  unsubscribeKelas = listenKelas(data => {
    semuaDataKelas = data;
    renderKelasFiltered();
  });

  unsubscribeKelasGuru = listenGuru(data => {
    daftarGuruKelas = data;
    renderKelasFiltered();
  });

  unsubscribeKelasMengajar = listenMengajar(data => {
    daftarMengajarKelas = data;
    renderKelasFiltered();
  });

  unsubscribeKelasSiswa = listenSiswa(data => {
    daftarSiswaKelas = data;
    renderKelasFiltered();
  });
}

function renderKelasFiltered() {
  const tbody = document.getElementById("tbodyKelas");
  const empty = document.getElementById("emptyStateKelas");
  const createForm = document.getElementById("kelasCreateForm");
  const sortedData = sortKelasData(semuaDataKelas);
  const effectiveRowsPerPage = getKelasRowsPerPageValue();
  const totalPages = Math.max(1, Math.ceil(sortedData.length / effectiveRowsPerPage));

  if (createForm) createForm.innerHTML = renderKelasCreateForm();

  if (!tbody) return;

  if (currentPageKelas > totalPages) {
    currentPageKelas = totalPages;
  }

  const startIndex = (currentPageKelas - 1) * effectiveRowsPerPage;
  const pagedData = sortedData.slice(startIndex, startIndex + effectiveRowsPerPage);

  tbody.innerHTML = pagedData.map((item, index) => renderKelasRow(item, startIndex + index + 1)).join("");

  if (empty) {
    empty.style.display = sortedData.length === 0 ? "block" : "none";
  }

  const info = document.getElementById("jumlahDataKelas");
  if (info) {
    info.innerText = `${sortedData.length} kelas`;
  }

  renderPagination("tablePaginationKelas", currentPageKelas, totalPages, "setKelasPage");
}

function renderKelasCreateForm() {
  const autoRombel = getCurrentDraftRombel();

  return `
    <div class="kelas-form-panel">
      <span class="mapel-row-hint">Data Kelas</span>
      <h3>Tambah kelas</h3>
      <div class="kelas-form-grid">
        <div class="form-group">
          <label for="tingkatKelas">Tingkat</label>
          <select id="tingkatKelas" class="kelas-inline-select" onchange="syncKelasAutoFields()" onkeydown="handleKelasInlineKey(event)">
          <option value="7" ${draftKelasTingkat === "7" ? "selected" : ""}>7</option>
          <option value="8" ${draftKelasTingkat === "8" ? "selected" : ""}>8</option>
          <option value="9" ${draftKelasTingkat === "9" ? "selected" : ""}>9</option>
          </select>
        </div>

        <div class="form-group">
          <label for="rombelKelas">Kelas</label>
          <input id="rombelKelas" class="kelas-inline-readonly" value="${autoRombel}" readonly disabled>
        </div>
      </div>

      <div class="kelas-form-actions">
        <button id="btnSimpanKelas" class="btn-primary" onclick="simpanKelasData()">Tambah Kelas</button>
        <button class="btn-secondary" onclick="showAcakWaliKelasModal()">Acak Wali Kelas</button>
        <button class="btn-secondary" onclick="undoAcakWaliKelas()" ${hasAcakWaliUndo() ? "" : "disabled"}>Undo Acak</button>
        <div class="error-text" id="err-kelasInline"></div>
      </div>
    </div>
  `;
}

function getKelasOptionsForWali(selectedValue = "") {
  const options = ['<option value="">Pilih kelas</option>'];
  sortKelasData(semuaDataKelas).forEach(item => {
    const parts = getStoredKelasParts(item);
    if (!parts.kelas) return;
    const selected = parts.kelas === selectedValue ? "selected" : "";
    options.push(`<option value="${parts.kelas}" ${selected}>${parts.kelas}</option>`);
  });
  return options.join("");
}

function renderWaliKelasForm() {
  const selectedKelas = semuaDataKelas.find(item => getStoredKelasParts(item).kelas === draftWaliKelasTarget);
  const selectedGuru = selectedKelas?.kode_guru || draftKelasWali;
  const guruReady = daftarGuruKelas.length > 0;
  const kelasReady = semuaDataKelas.length > 0;
  const eligibleGuruCount = draftWaliKelasTarget ? getEligibleWaliGuruKelas(selectedGuru, draftWaliKelasTarget).length : 0;
  const canChooseWali = guruReady && kelasReady && eligibleGuruCount > 0;
  const helperText = !kelasReady
    ? "Tambahkan kelas terlebih dahulu"
    : !draftWaliKelasTarget
      ? "Pilih kelas terlebih dahulu"
      : eligibleGuruCount === 0
        ? "Belum ada guru non-GB yang mengajar di kelas ini"
        : "";

  return `
    <div class="kelas-form-panel">
      <span class="mapel-row-hint">Pemilihan Wali Kelas</span>
      <h3>Tetapkan wali kelas</h3>
      <div class="kelas-form-grid">
        <div class="form-group">
          <label for="kelasWaliTarget">Kelas</label>
          <select id="kelasWaliTarget" class="kelas-inline-select" onchange="handleWaliKelasTargetChange(this.value)" ${kelasReady ? "" : "disabled"}>
            ${getKelasOptionsForWali(draftWaliKelasTarget)}
          </select>
        </div>

        <div class="form-group">
          <label for="waliKelas">Wali Kelas</label>
          <select id="waliKelas" class="kelas-inline-select kelas-inline-select-wide" onchange="draftKelasWali=this.value" onkeydown="handleWaliKelasKey(event)" ${canChooseWali ? "" : "disabled"}>
            ${getGuruOptionsKelas(selectedGuru, draftWaliKelasTarget)}
          </select>
        </div>
      </div>

      <div class="kelas-form-actions">
        <button id="btnSimpanWaliKelas" class="btn-primary" onclick="simpanWaliKelasData()" ${canChooseWali ? "" : "disabled"}>Simpan Wali Kelas</button>
        <button class="btn-secondary" onclick="showAcakWaliKelasModal()">Acak Wali Kelas</button>
        <button class="btn-secondary" onclick="undoAcakWaliKelas()" ${hasAcakWaliUndo() ? "" : "disabled"}>Undo Acak</button>
        <div class="error-text" id="err-waliKelasInline">${helperText}</div>
      </div>
    </div>
  `;
}

function renderInlineWaliKelasSelect(item) {
  const parts = getStoredKelasParts(item);
  const kelasValue = parts.kelas || item.kelas || "";
  const selectedGuru = String(item.kode_guru || "").trim();
  const eligibleGuru = getEligibleWaliGuruKelas(selectedGuru, kelasValue);
  const currentGuru = selectedGuru ? getGuruKelasByKode(selectedGuru) : null;
  const hasSelectedInOptions = eligibleGuru.some(guru => String(guru.kode_guru || "").trim() === selectedGuru);
  const canChooseWali = eligibleGuru.length > 0;
  const selectId = `waliKelasInline-${kelasValue.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const helperText = !kelasValue
    ? "Kelas belum valid"
    : daftarGuruKelas.length === 0
      ? "Data guru belum tersedia"
      : currentGuru && !canChooseWali
        ? "Tidak ada calon lain"
        : !canChooseWali
        ? "Belum ada calon wali"
        : "";

  const options = [
    `<option value="">${canChooseWali ? "Pilih wali kelas" : helperText}</option>`,
    ...eligibleGuru.map(guru => {
      const value = String(guru.kode_guru || "").trim();
      return `<option value="${escapeKelasHtml(value)}" ${value === selectedGuru ? "selected" : ""}>${escapeKelasHtml(formatNamaGuru(guru) || value)}</option>`;
    })
  ];

  if (currentGuru && !hasSelectedInOptions) {
    options.push(`<option value="${escapeKelasHtml(selectedGuru)}" selected>${escapeKelasHtml(formatNamaGuru(currentGuru) || selectedGuru)}</option>`);
  }

  return `
    <div class="kelas-inline-wali">
      <select id="${escapeKelasHtml(selectId)}" class="kelas-inline-select kelas-inline-wali-select" data-previous-value="${escapeKelasHtml(selectedGuru)}" onchange="handleInlineWaliKelasChange('${escapeKelasJs(kelasValue)}', this)" ${canChooseWali || currentGuru ? "" : "disabled"}>
        ${options.join("")}
      </select>
      <small id="${escapeKelasHtml(selectId)}Status" class="mapel-row-hint">${escapeKelasHtml(helperText)}</small>
    </div>
  `;
}

function renderKelasRow(item, nomor) {
  const parts = getStoredKelasParts(item);
  const kelasJs = escapeKelasJs(item.kelas || parts.kelas);
  const jumlahAnggota = getJumlahAnggotaKelasAsli(parts.kelas);

  if (currentEditKelas === item.kelas) {
    const currentTingkat = parts.tingkat || "7";
    const currentRombel = parts.rombel || getNextRombelForTingkat(currentTingkat, item.kelas);
    return `
      <tr class="table-edit-row mapel-edit-row" data-kelas-id="${escapeKelasHtml(item.kelas || parts.kelas)}">
        <td>
          <select id="editTingkatKelas" onchange="syncEditKelasAutoField('${kelasJs}')" onkeydown="handleKelasEditKey(event, '${kelasJs}')">
            <option value="7" ${currentTingkat === "7" ? "selected" : ""}>7</option>
            <option value="8" ${currentTingkat === "8" ? "selected" : ""}>8</option>
            <option value="9" ${currentTingkat === "9" ? "selected" : ""}>9</option>
          </select>
        </td>
        <td>
          <input id="editRombelKelas" value="${currentRombel}" readonly>
        </td>
        <td>
          ${renderInlineWaliKelasSelect(item)}
        </td>
        <td>${jumlahAnggota} siswa</td>
        <td>
          <div class="table-actions">
            <button class="btn-primary btn-table-compact" onclick="saveEditKelas('${kelasJs}')">Simpan</button>
            <button class="btn-secondary btn-table-compact" onclick="cancelEditKelas()">Batal</button>
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr data-kelas-id="${escapeKelasHtml(item.kelas || parts.kelas)}">
      <td>${parts.tingkat || "-"}</td>
      <td>${parts.rombel || "-"}</td>
      <td>${renderInlineWaliKelasSelect(item)}</td>
      <td>${jumlahAnggota} siswa</td>
      <td>
        <div class="table-actions">
          <button class="btn-secondary btn-table-compact" onclick="editKelas('${kelasJs}')">Edit</button>
          <button class="btn-secondary btn-table-compact" onclick="showAnggotaKelas('${kelasJs}')">Anggota</button>
          <button class="btn-secondary btn-danger-lite btn-table-compact" onclick="hapusKelas('${kelasJs}')">Hapus</button>
        </div>
      </td>
    </tr>
  `;
}

function importKelasExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (daftarGuruKelas.length === 0) {
    event.target.value = "";
    Swal.fire("Import kelas belum bisa dilakukan", "Data guru belum tersedia untuk memilih wali kelas.", "warning");
    return;
  }

  const reader = new FileReader();

  reader.onload = async evt => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      const parsed = json.map(row => {
        const kelas = String(getKelasCellValue(row, ["KELAS", "NAMA_KELAS", "NAMA KELAS"])).trim().toUpperCase();
        const kodeGuru = String(getKelasCellValue(row, ["KODE_GURU", "KODE GURU"])).trim();
        const waliKelasText = String(getKelasCellValue(row, ["WALI_KELAS", "WALI KELAS", "WALIKELAS"])).trim();
        const guru = findGuruForKelasImport(kodeGuru, waliKelasText);

        return {
          ...parseKelasParts(kelas),
          kelas,
          kode_guru: guru?.kode_guru || "",
          wali_kelas: guru ? formatNamaGuru(guru) : waliKelasText
        };
      }).filter(item => item.kelas || item.kode_guru || item.wali_kelas);

      const validRows = parsed.filter(item => {
        const existing = semuaDataKelas.find(kelas => kelas.kelas === item.kelas);
        return !validateKelasValues(item.tingkat, item.rombel, existing?.kelas || "");
      });
      const invalidRows = parsed.length - validRows.length;

      if (validRows.length === 0) {
        event.target.value = "";
        Swal.fire("Import kelas gagal", "Tidak ada data valid yang bisa diimport.", "error");
        return;
      }

      const confirm = await Swal.fire({
        title: "Import Data Kelas",
        html: `Data terbaca: ${parsed.length}<br>Siap diimport: ${validRows.length}<br>Baris tidak valid: ${invalidRows}`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Import",
        cancelButtonText: "Batal"
      });

      if (!confirm.isConfirmed) {
        event.target.value = "";
        return;
      }

      Swal.fire({
        title: "Mengimport kelas...",
        didOpen: () => Swal.showLoading()
      });

      let berhasil = 0;
      let gagal = 0;

      for (const item of validRows) {
        try {
          const existing = semuaDataKelas.find(kelas => kelas.kelas === item.kelas);
          const kelasRef = typeof getSemesterDocRef === "function"
            ? getSemesterDocRef("kelas", item.kelas)
            : db.collection("kelas").doc(item.kelas);
          await kelasRef.set({
            ...item,
            created_at: existing ? existing.created_at || new Date() : new Date(),
            updated_at: new Date()
          });
          berhasil++;
        } catch (error) {
          console.error(error);
          gagal++;
        }
      }

      if (berhasil > 0 && typeof syncWaliKelasTugasTambahan === "function") {
        await syncWaliKelasTugasTambahan();
      }

      Swal.fire({
        title: "Import kelas selesai",
        html: `Berhasil: ${berhasil}<br>Gagal: ${gagal}<br>Tidak valid: ${invalidRows}`,
        icon: "success",
        confirmButtonText: "OK"
      });
    } catch (error) {
      console.error(error);
      Swal.fire("Gagal membaca file kelas", "", "error");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsArrayBuffer(file);
}

async function simpanKelasData() {
  if (isSubmittingKelas) return;

  const tingkatEl = document.getElementById("tingkatKelas");
  const rombelEl = document.getElementById("rombelKelas");
  const btn = document.getElementById("btnSimpanKelas");
  const err = document.getElementById("err-kelasInline");

  const tingkat = tingkatEl?.value || "7";
  const rombel = rombelEl?.value || "";
  const kelas = buildKelasName(tingkat, rombel);
  const validationMessage = validateKelasValues(tingkat, rombel);

  if (err) err.innerText = validationMessage;
  if (validationMessage) return;

  try {
    isSubmittingKelas = true;
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Menyimpan...";
    }

    await saveKelas({
      tingkat,
      rombel,
      kelas,
      kode_guru: "",
      wali_kelas: "",
      created_at: new Date(),
      updated_at: new Date()
    });

    draftKelasTingkat = tingkat;
    syncKelasAutoFields();
    if (err) err.innerText = "";
    Swal.fire("Berhasil", "Data kelas ditambahkan", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Data kelas belum berhasil ditambahkan", "error");
  } finally {
    isSubmittingKelas = false;
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Tambah Kelas";
    }
  }
}

function handleWaliKelasTargetChange(namaKelas) {
  draftWaliKelasTarget = namaKelas || "";
  const selectedKelas = semuaDataKelas.find(item => getStoredKelasParts(item).kelas === draftWaliKelasTarget);
  draftKelasWali = selectedKelas?.kode_guru || "";
  renderKelasFiltered();
}

async function startPilihWaliKelas(namaKelas) {
  const kelasValue = getStoredKelasParts({ kelas: namaKelas }).kelas;
  const existing = semuaDataKelas.find(item => getStoredKelasParts(item).kelas === kelasValue);
  const selectedGuru = existing?.kode_guru || "";
  const eligible = getEligibleWaliGuruKelas(selectedGuru, kelasValue);
  if (!existing) {
    Swal.fire("Kelas tidak ditemukan", "", "warning");
    return;
  }
  if (eligible.length === 0) {
    Swal.fire("Belum ada calon wali", "Calon wali kelas harus guru non-GB dan mengajar di kelas tersebut.", "warning");
    return;
  }
  const result = await Swal.fire({
    title: `Pilih Wali Kelas ${kelasValue}`,
    input: "select",
    inputOptions: Object.fromEntries(eligible.map(guru => [guru.kode_guru, formatNamaGuru(guru)])),
    inputValue: selectedGuru,
    showCancelButton: true,
    confirmButtonText: "Simpan",
    cancelButtonText: "Batal",
    inputValidator: value => !value ? "Pilih wali kelas" : undefined
  });
  if (!result.isConfirmed) return;
  await simpanWaliKelasData(kelasValue, result.value);
}

async function handleInlineWaliKelasChange(namaKelas, selectEl) {
  const previousValue = selectEl?.dataset?.previousValue || "";
  const status = document.getElementById(`${selectEl.id}Status`);
  const kodeGuru = selectEl?.value || "";

  if (!kodeGuru) {
    if (status) status.innerText = "Pilih wali kelas";
    if (selectEl) selectEl.value = previousValue;
    return;
  }

  try {
    if (selectEl) {
      selectEl.disabled = true;
      selectEl.dataset.previousValue = kodeGuru;
    }
    if (status) status.innerText = "Menyimpan...";
    await simpanWaliKelasData(namaKelas, kodeGuru, { silent: true });
    if (status) status.innerText = "Tersimpan";
  } catch (error) {
    if (selectEl) {
      selectEl.value = previousValue;
      selectEl.dataset.previousValue = previousValue;
    }
    if (status) status.innerText = "Gagal menyimpan";
  } finally {
    if (selectEl) selectEl.disabled = false;
  }
}

function getSiswaKelasValue(siswa) {
  return parseKelasParts(siswa?.kelas || "").kelas.toUpperCase();
}

function getJumlahAnggotaKelasAsli(namaKelas) {
  const targetKelas = parseKelasParts(namaKelas || "").kelas.toUpperCase();
  if (!targetKelas) return 0;
  return daftarSiswaKelas.filter(siswa => getSiswaKelasValue(siswa) === targetKelas).length;
}

function getAnggotaKelasDraftLists() {
  if (!anggotaKelasDraft) {
    return { unassigned: [], members: [] };
  }

  const targetKelas = parseKelasParts(anggotaKelasDraft.kelas || "").kelas.toUpperCase();
  const memberSet = anggotaKelasDraft.memberNipds;
  const sortedSiswa = [...daftarSiswaKelas].sort((a, b) => compareValues(a.nama, b.nama, "asc"));

  return {
    unassigned: sortedSiswa.filter(siswa => {
      const nipd = String(siswa.nipd || "").trim();
      return nipd && !memberSet.has(nipd) && !String(siswa.kelas || "").trim();
    }),
    members: sortedSiswa.filter(siswa => {
      const nipd = String(siswa.nipd || "").trim();
      return nipd && (memberSet.has(nipd) || getSiswaKelasValue(siswa) === targetKelas);
    }).filter(siswa => memberSet.has(String(siswa.nipd || "").trim()))
  };
}

function renderAnggotaKelasList(items, emptyText, actionLabel, actionName) {
  if (items.length === 0) {
    return `<div class="empty-panel">${escapeKelasHtml(emptyText)}</div>`;
  }

  return items.map(siswa => {
    const nipd = String(siswa.nipd || "").trim();
    const nama = String(siswa.nama || "-").trim();

    return `
      <div class="anggota-option anggota-option-row" data-nipd="${escapeKelasHtml(nipd)}">
        <span>
          <strong>${escapeKelasHtml(nama)}</strong>
          <small>${escapeKelasHtml(nipd)}</small>
        </span>
        <button type="button" class="btn-secondary" onclick="${actionName}('${escapeKelasJs(nipd)}')">${escapeKelasHtml(actionLabel)}</button>
      </div>
    `;
  }).join("");
}

function renderAnggotaKelasOptions(namaKelas) {
  const targetKelas = String(namaKelas || "").trim().toUpperCase();
  const lists = getAnggotaKelasDraftLists();
  const memberCount = lists.members.length;
  const unassignedCount = lists.unassigned.length;

  if (daftarSiswaKelas.length === 0) {
    return `<div class="empty-panel">Belum ada data siswa.</div>`;
  }

  return `
    <div class="anggota-panels">
      <section class="anggota-panel">
        <div class="anggota-panel-head">
          <strong>Belum Memiliki Kelas</strong>
          <span>${unassignedCount} siswa</span>
        </div>
        <div class="anggota-list">
          ${renderAnggotaKelasList(lists.unassigned, "Tidak ada siswa tanpa kelas.", "Tambah", "addAnggotaKelasDraft")}
        </div>
      </section>

      <section class="anggota-panel">
        <div class="anggota-panel-head">
          <strong>Anggota ${escapeKelasHtml(targetKelas)}</strong>
          <span>${memberCount} siswa</span>
        </div>
        <div class="anggota-list anggota-list-members">
          ${renderAnggotaKelasList(lists.members, "Belum ada anggota kelas.", "Keluarkan", "removeAnggotaKelasDraft")}
        </div>
      </section>
    </div>
  `;
}

function refreshAnggotaKelasDraft() {
  const container = document.getElementById("anggotaKelasModalBody");
  if (!container || !anggotaKelasDraft) return;
  container.innerHTML = renderAnggotaKelasOptions(anggotaKelasDraft.kelas);
}

function addAnggotaKelasDraft(nipd) {
  if (!anggotaKelasDraft) return;
  anggotaKelasDraft.memberNipds.add(String(nipd || "").trim());
  refreshAnggotaKelasDraft();
}

function removeAnggotaKelasDraft(nipd) {
  if (!anggotaKelasDraft) return;
  anggotaKelasDraft.memberNipds.delete(String(nipd || "").trim());
  refreshAnggotaKelasDraft();
}

async function showAnggotaKelas(namaKelas) {
  const kelasValue = parseKelasParts(namaKelas || "").kelas;
  if (!kelasValue) return;
  anggotaKelasDraft = {
    kelas: kelasValue,
    memberNipds: new Set(
      daftarSiswaKelas
        .filter(siswa => getSiswaKelasValue(siswa) === kelasValue.toUpperCase())
        .map(siswa => String(siswa.nipd || "").trim())
        .filter(Boolean)
    )
  };

  const result = await Swal.fire({
    title: `Anggota Kelas ${escapeKelasHtml(kelasValue)}`,
    width: 920,
    html: `
      <div class="anggota-modal-note">
        Pindahkan siswa dari panel kiri ke panel kanan untuk memasukkannya ke ${escapeKelasHtml(kelasValue)}.
      </div>
      <div id="anggotaKelasModalBody">
        ${renderAnggotaKelasOptions(kelasValue)}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Simpan Anggota",
    cancelButtonText: "Batal",
    preConfirm: () => Array.from(anggotaKelasDraft?.memberNipds || [])
  });

  const selectedNipds = result.value || [];
  anggotaKelasDraft = null;

  if (!result.isConfirmed) return;

  await simpanAnggotaKelas(kelasValue, selectedNipds);
}

async function simpanAnggotaKelas(namaKelas, selectedNipds) {
  const targetKelas = parseKelasParts(namaKelas || "").kelas;
  const selectedSet = new Set(selectedNipds.map(value => String(value || "").trim()).filter(Boolean));
  const currentMembers = daftarSiswaKelas.filter(siswa => getSiswaKelasValue(siswa) === targetKelas.toUpperCase());
  const selectedStudents = daftarSiswaKelas.filter(siswa => selectedSet.has(String(siswa.nipd || "").trim()));
  const changes = new Map();

  currentMembers.forEach(siswa => {
    const nipd = String(siswa.nipd || "").trim();
    if (nipd && !selectedSet.has(nipd)) {
      changes.set(nipd, { ...siswa, kelas: "" });
    }
  });

  selectedStudents.forEach(siswa => {
    const nipd = String(siswa.nipd || "").trim();
    if (nipd && getSiswaKelasValue(siswa) !== targetKelas.toUpperCase()) {
      changes.set(nipd, { ...siswa, kelas: targetKelas });
    }
  });

  if (changes.size === 0) {
    Swal.fire("Tidak ada perubahan", "", "info");
    return;
  }

  try {
    Swal.fire({ title: "Menyimpan anggota...", didOpen: () => Swal.showLoading() });

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
    Swal.fire("Berhasil", `${selectedSet.size} anggota tersimpan`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Anggota kelas belum berhasil disimpan", "error");
  }
}

function handleWaliKelasKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    simpanWaliKelasData();
  }
}

async function getAcakWaliMengajarBayangan() {
  const snapshot = await db.collection("mengajar_bayangan").get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function buildAcakWaliCandidates(mengajarRows) {
  const byLevel = { 7: new Map(), 8: new Map(), 9: new Map() };
  const levelsByGuru = new Map();

  mengajarRows.forEach(item => {
    const level = String(item.tingkat || "").trim();
    const kodeGuru = String(item.guru_kode || "").trim();
    if (!["7", "8", "9"].includes(level) || !kodeGuru) return;
    const guru = getGuruKelasByKode(kodeGuru);
    if (!guru || (typeof isGuruStatusGB === "function" ? isGuruStatusGB(guru) : String(guru.status || "").trim().toUpperCase() === "GB")) return;
    const kelas = buildKelasName(item.tingkat, item.rombel);
    if (!byLevel[level].has(kodeGuru)) {
      byLevel[level].set(kodeGuru, { guru, kode_guru: kodeGuru, kelas: new Set() });
    }
    if (kelas) byLevel[level].get(kodeGuru).kelas.add(kelas);
    if (!levelsByGuru.has(kodeGuru)) levelsByGuru.set(kodeGuru, new Set());
    levelsByGuru.get(kodeGuru).add(level);
  });

  return { byLevel, levelsByGuru };
}

function renderAcakWaliGuruCard(level, candidate, levelsByGuru, excludedByLevel) {
  const kode = candidate.kode_guru;
  const guru = candidate.guru;
  const levels = [...(levelsByGuru.get(kode) || [])].sort();
  const activeLevels = levels.filter(itemLevel => !(excludedByLevel[itemLevel] || []).includes(kode));
  const crossLevel = activeLevels.length > 1;
  const kelasText = [...candidate.kelas].sort((a, b) => compareValues(a, b, "asc")).join(", ");
  return `
    <div class="acak-wali-card ${crossLevel ? "acak-wali-card-multi" : ""}">
      <div>
        <strong>${escapeKelasHtml(formatNamaGuru(guru) || kode)}</strong>
        <small>${escapeKelasHtml(guru.nip || "-")} | ${escapeKelasHtml(kelasText || `Kelas ${level}`)}</small>
        ${crossLevel ? `<span class="acak-wali-badge">Ada di jenjang ${escapeKelasHtml(activeLevels.join(" dan "))}</span>` : ""}
      </div>
      <button class="btn-secondary btn-table-compact" onclick="toggleAcakWaliCandidate('${escapeKelasJs(level)}','${escapeKelasJs(kode)}', true)">Keluarkan</button>
    </div>
  `;
}

function renderAcakWaliExcludedCard(level, candidate) {
  const kode = candidate.kode_guru;
  return `
    <div class="acak-wali-card acak-wali-card-out">
      <div>
        <strong>${escapeKelasHtml(formatNamaGuru(candidate.guru) || kode)}</strong>
        <small>Jenjang ${escapeKelasHtml(level)} | ${escapeKelasHtml(candidate.guru.nip || "-")}</small>
      </div>
      <button class="btn-secondary btn-table-compact" onclick="toggleAcakWaliCandidate('${escapeKelasJs(level)}','${escapeKelasJs(kode)}', false)">Masukkan</button>
    </div>
  `;
}

function renderAcakWaliModalHtml() {
  if (!acakWaliKelasDraft) return `<div class="empty-panel">Memuat calon wali kelas...</div>`;
  const { byLevel, levelsByGuru, excluded } = acakWaliKelasDraft;
  const panels = ["7", "8", "9"].map(level => {
    const excludedSet = new Set(excluded[level] || []);
    const candidates = [...(byLevel[level]?.values() || [])].sort((a, b) =>
      String(typeof getGuruSortName === "function" ? getGuruSortName(a.guru) : formatNamaGuru(a.guru) || "")
        .localeCompare(String(typeof getGuruSortName === "function" ? getGuruSortName(b.guru) : formatNamaGuru(b.guru) || ""), undefined, { sensitivity: "base" }) ||
      String(formatNamaGuru(a.guru) || "").localeCompare(String(formatNamaGuru(b.guru) || ""), undefined, { sensitivity: "base" })
    );
    const activeCards = candidates
      .filter(item => !excludedSet.has(item.kode_guru))
      .map(item => renderAcakWaliGuruCard(level, item, levelsByGuru, excluded))
      .join("");
    return `
      <section class="acak-wali-panel">
        <h4>Calon Wali Kelas ${level}</h4>
        <div class="acak-wali-list">${activeCards || `<div class="empty-panel">Belum ada calon eligible.</div>`}</div>
      </section>
    `;
  }).join("");

  const excludedCards = ["7", "8", "9"].flatMap(level => {
    const candidates = [...(byLevel[level]?.values() || [])];
    const excludedSet = new Set(excluded[level] || []);
    return candidates
      .filter(item => excludedSet.has(item.kode_guru))
      .map(item => renderAcakWaliExcludedCard(level, item));
  }).join("");

  return `
    <div class="acak-wali-modal">
      <div class="acak-wali-grid">${panels}</div>
      <section class="acak-wali-excluded">
        <h4>Guru yang tidak jadi wali kelas</h4>
        <div class="acak-wali-list">${excludedCards || `<div class="empty-panel">Belum ada guru yang dikeluarkan.</div>`}</div>
      </section>
      <div class="acak-wali-actions">
        <button class="btn-secondary" onclick="saveAcakWaliCandidates()">Simpan Calon</button>
        <button class="btn-primary" onclick="acakWaliKelas()">Acak</button>
        <small id="acakWaliSaveInfo"></small>
      </div>
    </div>
  `;
}

function refreshAcakWaliModal() {
  const container = document.getElementById("acakWaliModalContent");
  if (container) container.innerHTML = renderAcakWaliModalHtml();
}

function toggleAcakWaliCandidate(level, kodeGuru, shouldExclude) {
  if (!acakWaliKelasDraft) return;
  const excluded = acakWaliKelasDraft.excluded[level] || [];
  const next = new Set(excluded);
  if (shouldExclude) next.add(kodeGuru);
  else next.delete(kodeGuru);
  acakWaliKelasDraft.excluded[level] = [...next];
  refreshAcakWaliModal();
}

function saveAcakWaliCandidates(showMessage = true) {
  if (!acakWaliKelasDraft) return;
  acakWaliKelasState = { excluded: acakWaliKelasDraft.excluded };
  localStorage.setItem("acakWaliKelasState", JSON.stringify(acakWaliKelasState));
  if (showMessage) {
    const container = document.getElementById("acakWaliSaveInfo");
    if (container) container.innerText = "Calon wali kelas tersimpan.";
  }
}

async function showAcakWaliKelasModal() {
  try {
    Swal.fire({ title: "Memuat calon wali kelas...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    const mengajarRows = await getAcakWaliMengajarBayangan();
    const built = buildAcakWaliCandidates(mengajarRows);
    acakWaliKelasDraft = {
      ...built,
      excluded: {
        7: [...(acakWaliKelasState.excluded?.["7"] || [])],
        8: [...(acakWaliKelasState.excluded?.["8"] || [])],
        9: [...(acakWaliKelasState.excluded?.["9"] || [])]
      }
    };
    await Swal.fire({
      title: "Acak Wali Kelas",
    html: `<div id="acakWaliModalContent">${renderAcakWaliModalHtml()}</div>`,
      width: "1100px",
      showConfirmButton: false,
      showCloseButton: true
    });
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal memuat calon wali kelas", "", "error");
  }
}

function getAcakWaliEligibleCodesForClass(level, kelas, usedCodes) {
  const excludedSet = new Set(acakWaliKelasDraft?.excluded?.[level] || []);
  const candidates = [...(acakWaliKelasDraft?.byLevel?.[level]?.values() || [])]
    .filter(item => !excludedSet.has(item.kode_guru))
    .filter(item => !usedCodes.has(item.kode_guru))
    .filter(item => item.kelas.has(kelas));
  return candidates.map(item => item.kode_guru);
}

function pickRandomItem(items) {
  if (!items.length) return "";
  return items[Math.floor(Math.random() * items.length)];
}

function buildAcakWaliResult() {
  const result = [];
  const usedCodes = new Set();
  ["7", "8", "9"].forEach(level => {
    getKelasWaliByLevel(level).forEach(({ item, parts }) => {
      const eligibleCodes = getAcakWaliEligibleCodesForClass(level, parts.kelas, usedCodes);
      const kodeGuru = pickRandomItem(eligibleCodes);
      if (kodeGuru) usedCodes.add(kodeGuru);
      result.push({
        kelasItem: item,
        kelas: parts.kelas,
        kode_guru: kodeGuru,
        guru: getGuruKelasByKode(kodeGuru)
      });
    });
  });
  return result;
}

function renderAcakWaliResultHtml(result) {
  return `
    <div class="table-container acak-wali-result">
      <table class="mapel-table">
        <thead><tr><th>Kelas</th><th>Wali Kelas</th><th>Status</th></tr></thead>
        <tbody>
          ${result.map(item => `
            <tr>
              <td>${escapeKelasHtml(item.kelas)}</td>
              <td>${escapeKelasHtml(item.guru ? formatNamaGuru(item.guru) : "-")}</td>
              <td>${item.guru ? "Siap disimpan" : "Tidak ada calon"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function saveAcakWaliUndoSnapshot(validResult) {
  acakWaliKelasUndo = {
    saved_at: new Date().toISOString(),
    items: validResult.map(item => ({
      kelas: item.kelasItem.kelas,
      kode_guru: item.kelasItem.kode_guru || "",
      wali_kelas: item.kelasItem.wali_kelas || ""
    }))
  };
  localStorage.setItem("acakWaliKelasUndo", JSON.stringify(acakWaliKelasUndo));
}

function clearAcakWaliUndoSnapshot() {
  acakWaliKelasUndo = null;
  localStorage.removeItem("acakWaliKelasUndo");
}

async function acakWaliKelas() {
  if (!acakWaliKelasDraft) return;
  saveAcakWaliCandidates(false);
  Swal.fire({
    title: "Mengacak wali kelas...",
    html: `<div class="acak-wali-loading">
      <div class="acak-wali-loader">
        <span>W</span><span>A</span><span>L</span><span>I</span>
      </div>
      <p>Guru-guru sedang dikocok dengan penuh martabat...</p>
    </div>`,
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading()
  });

  await new Promise(resolve => setTimeout(resolve, 5000));
  const result = buildAcakWaliResult();
  const confirm = await Swal.fire({
    title: "Hasil Acak Wali Kelas",
    html: renderAcakWaliResultHtml(result),
    width: "820px",
    customClass: { popup: "acak-wali-result-popup" },
    showCancelButton: true,
    confirmButtonText: "Set sebagai Wali Kelas",
    cancelButtonText: "Batal"
  });
  if (!confirm.isConfirmed) {
    await showAcakWaliKelasModal();
    return;
  }
  await applyAcakWaliResult(result);
}

async function applyAcakWaliResult(result) {
  const valid = result.filter(item => item.guru && item.kode_guru);
  if (valid.length === 0) {
    Swal.fire("Belum ada hasil valid", "Tidak ada wali kelas yang bisa disimpan.", "warning");
    return;
  }
  try {
    Swal.fire({ title: "Menyimpan wali kelas...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    const batch = db.batch();
    saveAcakWaliUndoSnapshot(valid);
    valid.forEach(item => {
      const kelasRef = typeof getSemesterDocRef === "function"
        ? getSemesterDocRef("kelas", item.kelasItem.kelas)
        : db.collection("kelas").doc(item.kelasItem.kelas);
      batch.set(kelasRef, {
        ...item.kelasItem,
        kode_guru: item.kode_guru,
        wali_kelas: formatNamaGuru(item.guru),
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
    if (typeof syncWaliKelasTugasTambahan === "function") {
      await syncWaliKelasTugasTambahan();
    }
    Swal.fire("Berhasil", `${valid.length} wali kelas disimpan dan tugas tambahan wali kelas disinkronkan.`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal menyimpan hasil acak", "", "error");
  }
}

async function undoAcakWaliKelas() {
  if (!hasAcakWaliUndo()) {
    Swal.fire("Tidak ada data undo", "Belum ada hasil acak yang bisa dikembalikan.", "info");
    return;
  }

  const confirm = await Swal.fire({
    title: "Undo hasil acak?",
    text: "Wali kelas akan dikembalikan ke kondisi sebelum acak terakhir.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Undo",
    cancelButtonText: "Batal"
  });
  if (!confirm.isConfirmed) return;

  try {
    Swal.fire({ title: "Mengembalikan wali kelas...", didOpen: () => Swal.showLoading(), allowOutsideClick: false });
    const batch = db.batch();
    acakWaliKelasUndo.items.forEach(item => {
      const kelas = semuaDataKelas.find(entry => getStoredKelasParts(entry).kelas === item.kelas);
      if (!kelas) return;
      const kelasRef = typeof getSemesterDocRef === "function"
        ? getSemesterDocRef("kelas", kelas.kelas)
        : db.collection("kelas").doc(kelas.kelas);
      batch.set(kelasRef, {
        ...kelas,
        kode_guru: item.kode_guru || "",
        wali_kelas: item.wali_kelas || "",
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
    clearAcakWaliUndoSnapshot();
    if (typeof syncWaliKelasTugasTambahan === "function") {
      await syncWaliKelasTugasTambahan();
    }
    renderKelasFiltered();
    Swal.fire("Berhasil", "Hasil acak wali kelas sudah di-undo.", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal undo", "", "error");
  }
}

async function simpanWaliKelasData(namaKelasArg = "", kodeGuruArg = "", options = {}) {
  const kelasEl = document.getElementById("kelasWaliTarget");
  const waliEl = document.getElementById("waliKelas");
  const btn = document.getElementById("btnSimpanWaliKelas");
  const err = document.getElementById("err-waliKelasInline");
  const namaKelas = namaKelasArg || kelasEl?.value || draftWaliKelasTarget;
  const kodeGuru = kodeGuruArg || waliEl?.value || "";
  const validationMessage = validateWaliKelasValues(namaKelas, kodeGuru);

  if (err) err.innerText = validationMessage;
  if (validationMessage) {
    if (options.silent) throw new Error(validationMessage);
    return;
  }

  const existing = semuaDataKelas.find(item => getStoredKelasParts(item).kelas === namaKelas);
  const guru = daftarGuruKelas.find(item => item.kode_guru === kodeGuru);

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Menyimpan...";
    }

    await updateKelas(existing.kelas, {
      ...existing,
      kode_guru: kodeGuru,
      wali_kelas: guru ? formatNamaGuru(guru) : "",
      updated_at: new Date()
    });

    draftWaliKelasTarget = namaKelas;
    draftKelasWali = kodeGuru;
    if (err) err.innerText = "";
    if (typeof syncWaliKelasTugasTambahan === "function") {
      await syncWaliKelasTugasTambahan();
    }
    if (!options.silent) Swal.fire("Berhasil", "Wali kelas diperbarui", "success");
  } catch (error) {
    console.error(error);
    if (!options.silent) Swal.fire("Gagal", "Wali kelas belum berhasil disimpan", "error");
    throw error;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Simpan Wali Kelas";
    }
  }
}

function editKelas(namaKelas) {
  currentEditKelas = namaKelas;
  renderKelasFiltered();
}

function cancelEditKelas() {
  currentEditKelas = null;
  renderKelasFiltered();
}

function handleKelasInlineKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    simpanKelasData();
  }
}

function handleKelasEditKey(event, namaKelas) {
  if (event.key === "Enter") {
    event.preventDefault();
    saveEditKelas(namaKelas);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEditKelas();
  }
}

async function saveEditKelas(kelasLama) {
  const tingkatBaru = document.getElementById("editTingkatKelas")?.value || "7";
  const rombelBaru = document.getElementById("editRombelKelas")?.value || "";
  const kelasBaru = buildKelasName(tingkatBaru, rombelBaru);
  const validationMessage = validateKelasValues(tingkatBaru, rombelBaru, kelasLama);

  if (validationMessage) {
    Swal.fire("Edit kelas belum bisa disimpan", validationMessage, "warning");
    return;
  }

  const existing = semuaDataKelas.find(item => item.kelas === kelasLama) || {};

  try {
    await updateKelas(kelasLama, {
      ...existing,
      tingkat: tingkatBaru,
      rombel: rombelBaru,
      kelas: kelasBaru,
      updated_at: new Date()
    });

    currentEditKelas = null;
    if (draftWaliKelasTarget === kelasLama) {
      draftWaliKelasTarget = kelasBaru;
    }
    renderKelasFiltered();
    if (typeof showInlineSaveNotificationForData === "function") {
      const shown = showInlineSaveNotificationForData("data-kelas-id", kelasBaru, "Tersimpan");
      if (!shown) showInlineSaveNotificationForData("data-kelas-id", kelasLama, "Tersimpan");
    }
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Perubahan kelas belum berhasil disimpan", "error");
  }
}

async function hapusKelas(namaKelas) {
  const confirm = await Swal.fire({
    title: "Hapus data kelas?",
    text: `Data ${namaKelas} akan dihapus.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal"
  });

  if (!confirm.isConfirmed) return;

  try {
    await deleteKelas(namaKelas);
    if (currentEditKelas === namaKelas) {
      currentEditKelas = null;
    }
    Swal.fire("Berhasil", "Data kelas dihapus", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Data kelas belum berhasil dihapus", "error");
  }
}
