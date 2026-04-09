// ================= STATE =================
let semuaData = [];
let currentEdit = null;
let unsubscribe = null;
let isSubmitting = false;
let debounce;
let currentPage = 1;
let rowsPerPage = 10;
let semuaKelasSiswa = [];
let unsubscribeSiswaKelasOptions = null;
let siswaSortField = "nama";
let siswaSortDirection = "asc";
let isNormalizingSiswaKelas = false;
let hasNormalizedSiswaKelas = false;
let isNormalizingSiswaNama = false;
let hasNormalizedSiswaNama = false;

function getSiswaAccessibleLevels() {
  if (typeof canUseCoordinatorAccess !== "function" || !canUseCoordinatorAccess()) return [];
  if (typeof getCurrentCoordinatorLevelsSync !== "function") return [];
  return getCurrentCoordinatorLevelsSync().map(item => String(item || "")).filter(Boolean);
}

function getSiswaVisibleData(rows = semuaData) {
  const levels = getSiswaAccessibleLevels();
  if (!levels.length) return rows;
  return rows.filter(item => levels.includes(getSiswaTingkatFromKelas(item.kelas)));
}

function getSiswaVisibleKelasList() {
  const levels = getSiswaAccessibleLevels();
  if (!levels.length) return semuaKelasSiswa;
  return semuaKelasSiswa.filter(item => levels.includes(getSiswaTingkatFromKelas(item.kelas)));
}

function compareValues(left, right, direction = "asc") {
  const a = String(left ?? "").trim().toLowerCase();
  const b = String(right ?? "").trim().toLowerCase();
  const result = a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function normalizeSiswaKelasValue(kelasValue = "") {
  const raw = String(kelasValue || "").trim().toUpperCase();
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^([0-9]+)([A-Z]+)$/);
  if (match) return `${match[1]}${match[2]}`;
  return compact;
}

function normalizeSiswaNamaValue(namaValue = "") {
  const raw = String(namaValue || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .toLowerCase()
    .split(" ")
    .map(word => word
      .split(/([.'-])/)
      .map(part => (/^[.'-]$/.test(part) ? part : (part ? part.charAt(0).toUpperCase() + part.slice(1) : "")))
      .join("")
    )
    .join(" ");
}

function sortSiswaData(data) {
  return [...data].sort((a, b) => compareValues(a[siswaSortField], b[siswaSortField], siswaSortDirection));
}

function setSiswaSort(field) {
  if (siswaSortField === field) {
    siswaSortDirection = siswaSortDirection === "asc" ? "desc" : "asc";
  } else {
    siswaSortField = field;
    siswaSortDirection = "asc";
  }
  currentPage = 1;
  renderTableState();
}

function renderTableState() {
  const content = document.getElementById("content");
  if (!content) return;
  const levels = getSiswaAccessibleLevels();
  const searchValue = document.getElementById("search")?.value || "";
  const tingkatValue = document.getElementById("filterTingkat")?.value || (levels.length === 1 ? levels[0] : "");
  const kelasValue = document.getElementById("filterKelas")?.value || "";
  const jkValue = document.getElementById("filterJK")?.value || "";
  const agamaValue = document.getElementById("filterAgama")?.value || "";
  const rowsValue = String(rowsPerPage);
  content.innerHTML = renderTable();
  const search = document.getElementById("search");
  const filterTingkat = document.getElementById("filterTingkat");
  const filterKelas = document.getElementById("filterKelas");
  const filterJK = document.getElementById("filterJK");
  const filterAgama = document.getElementById("filterAgama");
  const rows = document.getElementById("rowsPerPage");
  if (search) search.value = searchValue;
  if (filterTingkat) filterTingkat.value = tingkatValue;
  populateSiswaFilterKelasOptions(tingkatValue, kelasValue);
  if (filterKelas) setSiswaKelasFilterValue(kelasValue);
  if (filterJK) filterJK.value = jkValue;
  if (filterAgama) filterAgama.value = agamaValue;
  if (rows) rows.value = rowsValue;
  renderFiltered();
}

function renderSiswaKelasOptions(selectedValue = "") {
  const normalizedSelected = normalizeSiswaKelasFilterValue(selectedValue);
  const visibleKelas = getSiswaVisibleKelasList();
  const placeholder = visibleKelas.length > 0 ? "Pilih kelas" : "Belum ada data kelas";
  const options = [`<option value="">${placeholder}</option>`];

  visibleKelas.forEach(item => {
    const namaKelas = normalizeSiswaKelasValue(item.kelas);
    if (!namaKelas) return;
    const selected = normalizeSiswaKelasFilterValue(namaKelas) === normalizedSelected ? "selected" : "";
    options.push(`<option value="${namaKelas}" ${selected}>${namaKelas}</option>`);
  });

  if (selectedValue && !visibleKelas.some(item => normalizeSiswaKelasFilterValue(item.kelas) === normalizedSelected)) {
    const normalizedValue = normalizeSiswaKelasValue(selectedValue);
    options.push(`<option value="${normalizedValue}" selected>${normalizedValue}</option>`);
  }

  return options.join("");
}

function populateSiswaKelasSelect(selectedValue = "") {
  const select = document.getElementById("kelas");
  if (!select) return;
  select.innerHTML = renderSiswaKelasOptions(selectedValue);
}

function getSiswaTingkatFromKelas(kelasValue = "") {
  const normalized = normalizeSiswaKelasValue(kelasValue);
  const match = normalized.match(/^([7-9])/);
  return match ? match[1] : "";
}

function normalizeSiswaKelasFilterValue(kelasValue = "") {
  return normalizeSiswaKelasValue(kelasValue);
}

function populateSiswaFilterKelasOptions(selectedTingkat = "", selectedValue = "") {
  const select = document.getElementById("filterKelas");
  if (!select) return;

  const options = ['<option value="">Semua Kelas</option>'];
  const kelasList = [...new Set(
    getSiswaVisibleKelasList()
      .map(item => normalizeSiswaKelasValue(item.kelas))
      .filter(Boolean)
      .filter(kelas => !selectedTingkat || getSiswaTingkatFromKelas(kelas) === selectedTingkat)
      .sort((a, b) => compareValues(a, b, "asc"))
  )];

  kelasList.forEach(kelas => {
    const selected = normalizeSiswaKelasFilterValue(kelas) === normalizeSiswaKelasFilterValue(selectedValue) ? "selected" : "";
    options.push(`<option value="${kelas}" ${selected}>${kelas}</option>`);
  });

  if (selectedValue && !kelasList.some(kelas => normalizeSiswaKelasFilterValue(kelas) === normalizeSiswaKelasFilterValue(selectedValue))) {
    options.push(`<option value="${selectedValue}" selected>${selectedValue}</option>`);
  }

  select.innerHTML = options.join("");
}

function setSiswaKelasFilterValue(value = "") {
  const select = document.getElementById("filterKelas");
  if (!select) return;
  const normalizedValue = normalizeSiswaKelasFilterValue(value);
  const matchingOption = Array.from(select.options).find(option =>
    normalizeSiswaKelasFilterValue(option.value) === normalizedValue
  );
  select.value = matchingOption ? matchingOption.value : value;
}

function handleTingkatFilterChange() {
  const levels = getSiswaAccessibleLevels();
  const tingkat = document.getElementById("filterTingkat")?.value || (levels.length === 1 ? levels[0] : "");
  populateSiswaFilterKelasOptions(tingkat, "");
  const filterKelas = document.getElementById("filterKelas");
  if (filterKelas) filterKelas.value = "";
  applyFilters();
}

function loadSiswaKelasOptions() {
  if (unsubscribeSiswaKelasOptions) unsubscribeSiswaKelasOptions();

  unsubscribeSiswaKelasOptions = listenKelas(data => {
    semuaKelasSiswa = data;
    populateSiswaKelasSelect();
    const levels = getSiswaAccessibleLevels();
    const selectedTingkat = document.getElementById("filterTingkat")?.value || (levels.length === 1 ? levels[0] : "");
    const selectedKelas = document.getElementById("filterKelas")?.value || "";
    populateSiswaFilterKelasOptions(selectedTingkat, selectedKelas);
    if (currentEdit) {
      renderFiltered();
    }
  });
}

function renderPagination(containerId, current, total, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (total <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="pagination">
      <button class="btn-secondary" onclick="${onPageChange}(${current - 1})" ${current === 1 ? "disabled" : ""}>Prev</button>
      <span>Halaman ${current} dari ${total}</span>
      <button class="btn-secondary" onclick="${onPageChange}(${current + 1})" ${current === total ? "disabled" : ""}>Next</button>
    </div>
  `;
}

function setPage(page) {
  const keyword = document.getElementById("search")?.value?.toLowerCase() || "";
  const levels = getSiswaAccessibleLevels();
  const tingkat = document.getElementById("filterTingkat")?.value || (levels.length === 1 ? levels[0] : "");
  const kelas = document.getElementById("filterKelas")?.value || "";
  const jk = document.getElementById("filterJK")?.value || "";
  const agama = document.getElementById("filterAgama")?.value || "";

  const hasil = getSiswaVisibleData().filter(d =>
    (
      (d.nama || "").toLowerCase().includes(keyword) ||
      (d.nipd || "").toLowerCase().includes(keyword) ||
      (d.nisn || "").toLowerCase().includes(keyword)
    ) &&
    (!tingkat || getSiswaTingkatFromKelas(d.kelas) === tingkat) &&
    (!kelas || normalizeSiswaKelasFilterValue(d.kelas) === normalizeSiswaKelasFilterValue(kelas)) &&
    (!jk || (d.jk || "").toUpperCase() === jk) &&
    (!agama || (d.agama || "").toLowerCase() === agama.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(hasil.length / getRowsPerPageValue()));
  currentPage = Math.min(Math.max(1, page), totalPages);
  renderFiltered();
}

function applyFilters() {
  currentPage = 1;
  renderFiltered();
}

function getRowsPerPageValue() {
  return rowsPerPage === "all" ? Number.MAX_SAFE_INTEGER : Number(rowsPerPage);
}

function setRowsPerPage(value) {
  rowsPerPage = value === "all" ? "all" : Number(value);
  currentPage = 1;
  renderFiltered();
}


// ================= LOAD =================
function loadRealtime() {
  if (unsubscribe) unsubscribe();

  unsubscribe = listenSiswa(data => {
    semuaData = data.map(item => ({
      ...item,
      nama: normalizeSiswaNamaValue(item.nama),
      kelas: normalizeSiswaKelasValue(item.kelas)
    }));
    ensureNormalizedSiswaNamaData(data);
    ensureNormalizedSiswaKelasData(data);
    renderFiltered();
  });
}

async function ensureNormalizedSiswaNamaData(data = []) {
  if (hasNormalizedSiswaNama || isNormalizingSiswaNama) return;
  const changedRows = data.filter(item => {
    const nipd = String(item.nipd || item.id || "").trim();
    return nipd && normalizeSiswaNamaValue(item.nama) !== String(item.nama || "").trim();
  });

  if (changedRows.length === 0) {
    hasNormalizedSiswaNama = true;
    return;
  }

  isNormalizingSiswaNama = true;
  try {
    const batch = db.batch();
    changedRows.forEach(item => {
      const nipd = String(item.nipd || item.id || "").trim();
      if (!nipd) return;
      const ref = typeof getSemesterDocRef === "function"
        ? getSemesterDocRef("siswa", nipd)
        : db.collection("siswa").doc(nipd);
      batch.set(ref, {
        nama: normalizeSiswaNamaValue(item.nama),
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
    hasNormalizedSiswaNama = true;
  } catch (error) {
    console.error("Gagal normalisasi nama siswa", error);
  } finally {
    isNormalizingSiswaNama = false;
  }
}

async function ensureNormalizedSiswaKelasData(data = []) {
  if (hasNormalizedSiswaKelas || isNormalizingSiswaKelas) return;
  const changedRows = data.filter(item => {
    const nipd = String(item.nipd || item.id || "").trim();
    return nipd && normalizeSiswaKelasValue(item.kelas) !== String(item.kelas || "").trim();
  });

  if (changedRows.length === 0) {
    hasNormalizedSiswaKelas = true;
    return;
  }

  isNormalizingSiswaKelas = true;
  try {
    const batch = db.batch();
    changedRows.forEach(item => {
      const nipd = String(item.nipd || item.id || "").trim();
      if (!nipd) return;
      const ref = typeof getSemesterDocRef === "function"
        ? getSemesterDocRef("siswa", nipd)
        : db.collection("siswa").doc(nipd);
      batch.set(ref, {
        kelas: normalizeSiswaKelasValue(item.kelas),
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
    hasNormalizedSiswaKelas = true;
  } catch (error) {
    console.error("Gagal normalisasi kelas siswa", error);
  } finally {
    isNormalizingSiswaKelas = false;
  }
}


// ================= FILTER =================
function renderFiltered() {

  const keyword = document.getElementById("search")?.value?.toLowerCase() || "";
  const tingkat = document.getElementById("filterTingkat")?.value || "";
  const kelas = document.getElementById("filterKelas")?.value || "";
  const jk = document.getElementById("filterJK")?.value || "";
  const agama = document.getElementById("filterAgama")?.value || "";

  const levels = getSiswaAccessibleLevels();
  const tingkatFilter = document.getElementById("filterTingkat")?.value || (levels.length === 1 ? levels[0] : "");
  const hasil = sortSiswaData(getSiswaVisibleData().filter(d =>
    (
      (d.nama || "").toLowerCase().includes(keyword) ||
      (d.nipd || "").toLowerCase().includes(keyword) ||
      (d.nisn || "").toLowerCase().includes(keyword)
    ) &&
    (!tingkatFilter || getSiswaTingkatFromKelas(d.kelas) === tingkatFilter) &&
    (!kelas || normalizeSiswaKelasFilterValue(d.kelas) === normalizeSiswaKelasFilterValue(kelas)) &&
    (!jk || (d.jk || "").toUpperCase() === jk) &&
    (!agama || (d.agama || "").toLowerCase() === agama.toLowerCase())
  ));

  const tbody = document.getElementById("tbody");
  const empty = document.getElementById("emptyState");
  const effectiveRowsPerPage = getRowsPerPageValue();
  const totalPages = Math.max(1, Math.ceil(hasil.length / effectiveRowsPerPage));

  if (!tbody) return;

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * effectiveRowsPerPage;
  const pagedData = hasil.slice(startIndex, startIndex + effectiveRowsPerPage);

  tbody.innerHTML = pagedData.map(renderRow).join("");

  // 🔥 EMPTY STATE
  if (empty) {
    empty.style.display = hasil.length === 0 ? "block" : "none";
  }

  // 🔥 JUMLAH DATA
  const info = document.getElementById("jumlahData");
  if (info) {
    info.innerText = `${hasil.length} siswa`;
  }

  renderPagination("tablePagination", currentPage, totalPages, "setPage");
}


// ================= SEARCH =================
function handleSearch() {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    currentPage = 1;
    renderFiltered();
  }, 300);
}


// ================= RESET FILTER =================
function resetFilter() {
  document.getElementById("search").value = "";
  const levels = getSiswaAccessibleLevels();
  document.getElementById("filterTingkat").value = levels.length === 1 ? levels[0] : "";
  populateSiswaFilterKelasOptions(levels.length === 1 ? levels[0] : "", "");
  document.getElementById("filterKelas").value = "";
  document.getElementById("filterJK").value = "";
  document.getElementById("filterAgama").value = "";

  currentPage = 1;
  renderFiltered();
}

function refreshSiswaTable() {
  loadRealtime();
  renderFiltered();
}


// ================= SIMPAN =================
async function simpanData() {

  if (isSubmitting) return;
  if (!validateForm()) return;

  const btn = document.getElementById("btnSimpan");

  // 🔥 AMAN
  const nipdEl = document.getElementById("nipd");
  const nisnEl = document.getElementById("nisn");
  const namaEl = document.getElementById("nama");
  const jkEl = document.getElementById("jk");
  const agamaEl = document.getElementById("agama");
  const kelasEl = document.getElementById("kelas");

  const data = {
    nipd: nipdEl.value.trim(),
    nisn: nisnEl.value.trim(),
    nama: normalizeSiswaNamaValue(namaEl.value),
    jk: jkEl.value,
    agama: agamaEl.value,
    kelas: normalizeSiswaKelasValue(kelasEl.value),
    created_at: new Date()
  };

  const levels = getSiswaAccessibleLevels();
  if (levels.length && !levels.includes(getSiswaTingkatFromKelas(data.kelas))) {
    Swal.fire("Kelas tidak sesuai", `Koordinator hanya dapat menambah siswa pada jenjang ${levels.join(", ")}.`, "warning");
    return;
  }

  try {
    isSubmitting = true;

    if (btn) {
      btn.disabled = true;
      btn.innerText = "Menyimpan...";
    }

    await saveSiswa(data);

    Swal.fire("Berhasil", "", "success");

    // 🔥 RESET FORM
    nipdEl.value = "";
    nisnEl.value = "";
    namaEl.value = "";
    jkEl.value = "";
    agamaEl.value = "";
    kelasEl.value = "";
    populateSiswaKelasSelect();

  } catch {
    Swal.fire("Gagal", "", "error");
  } finally {
    isSubmitting = false;

    if (btn) {
      btn.disabled = false;
      btn.innerText = "Simpan Data";
    }
  }
}


// ================= DELETE =================
async function hapusData(nipd) {

  const confirm = await Swal.fire({
    title: "Hapus data?",
    showCancelButton: true
  });

  if (!confirm.isConfirmed) return;

  await deleteSiswa(nipd);
}


// ================= EDIT =================
function editRow(nipd) {
  currentEdit = nipd;
  renderFiltered();
}


// ================= CANCEL EDIT =================
function cancelEdit() {
  currentEdit = null;
  renderFiltered();
}


// ================= SAVE EDIT =================
async function saveEdit(nipd) {

  const nisn = document.getElementById(`nisn-${nipd}`).value.trim();
  const nama = normalizeSiswaNamaValue(document.getElementById(`nama-${nipd}`).value);
  const jk = document.getElementById(`jk-${nipd}`).value;
  const agama = document.getElementById(`agama-${nipd}`).value;
  const kelas = normalizeSiswaKelasValue(document.getElementById(`kelas-${nipd}`).value);

  // 🔥 VALIDASI SEDERHANA
  if (!nisn || nisn.length !== 10) {
    Swal.fire("NISN harus 10 digit");
    return;
  }

  if (!nama) {
    Swal.fire("Nama tidak boleh kosong");
    return;
  }

  try {
    await updateSiswa(nipd, {
      nisn,
      nama,
      jk,
      agama,
      kelas,
      updated_at: new Date()
    });

    currentEdit = null;
    renderFiltered();

    if (typeof showInlineSaveNotificationForData === "function") {
      showInlineSaveNotificationForData("data-siswa-nipd", nipd, "Tersimpan");
    }

  } catch {
    Swal.fire("Gagal update", "", "error");
  }
}
