// ================= STATE MAPEL =================
let semuaDataMapel = [];
let unsubscribeMapel = null;
let currentPageMapel = 1;
let rowsPerPageMapel = "all";
let isSubmittingMapel = false;
let currentEditMapel = null;
let mapelSortField = "mapping";
let mapelSortDirection = "asc";
let isSyncingMapelBayangan = false;
const INDUK_MAPEL_OPTIONS = [
  { kode: "PABP", nama: "Pendidikan Agama dan Budi Pekerti" },
  { kode: "PP", nama: "Pendidikan Pancasila" },
  { kode: "BIN", nama: "Bahasa Indonesia" },
  { kode: "MTK", nama: "Matematika" },
  { kode: "IPA", nama: "Ilmu Pengetahuan Alam (IPA)" },
  { kode: "IPS", nama: "Ilmu Pengetahuan Sosial (IPS)" },
  { kode: "BIG", nama: "Bahasa Inggris" },
  { kode: "PJOK", nama: "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)" },
  { kode: "INF", nama: "Informatika" },
  { kode: "SENPRA", nama: "Seni dan Prakarya" },
  { kode: "MLD", nama: "Muatan Lokal Daerah" }
];
const MAPEL_AGAMA_OPTIONS = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"];

function downloadMapelTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([[
    "MAPPING",
    "INDUK_MAPEL",
    "AGAMA",
    "KODE_MAPEL",
    "NAMA_MAPEL",
    "JP"
  ]]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "template-import-mapel.xlsx");
}

function normalizeMapelHeader(text) {
  return String(text || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function getMapelCellValue(row, aliases) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeMapelHeader(key), value])
  );

  for (const alias of aliases) {
    const value = normalizedRow[normalizeMapelHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function normalizeMapelMapping(value) {
  return String(value ?? "").trim();
}

function normalizeIndukMapel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const upper = text.toUpperCase();
  const found = INDUK_MAPEL_OPTIONS.find(item => item.kode === upper || item.nama.toUpperCase() === upper);
  return found?.kode || upper;
}

function getIndukMapelOption(kode) {
  const normalized = normalizeIndukMapel(kode);
  return INDUK_MAPEL_OPTIONS.find(item => item.kode === normalized) || null;
}

function getMapelIndukKode(item = {}) {
  const explicit = normalizeIndukMapel(item.induk_mapel || item.induk || "");
  if (explicit) return explicit;
  return normalizeIndukMapel(item.kode_mapel || "");
}

function getMapelIndukLabel(item = {}) {
  const kode = getMapelIndukKode(item);
  const option = getIndukMapelOption(kode);
  return option ? option.kode : kode || "-";
}

function inferIndukMapelFromMapel(kode = "", nama = "") {
  const text = `${kode} ${nama}`.toUpperCase();
  if (/AGAMA|PABP|PA ISLAM|PA KRISTEN|PA KATOLIK|PA HINDU|PA BUDDHA|KONGHUCU/.test(text)) return "PABP";
  if (/PANCASILA|PPKN|PP\b/.test(text)) return "PP";
  if (/BAHASA INDONESIA|\bBIN\b/.test(text)) return "BIN";
  if (/MATEMATIKA|\bMTK\b/.test(text)) return "MTK";
  if (/IPA|ILMU PENGETAHUAN ALAM/.test(text)) return "IPA";
  if (/IPS|ILMU PENGETAHUAN SOSIAL/.test(text)) return "IPS";
  if (/BAHASA INGGRIS|\bBIG\b/.test(text)) return "BIG";
  if (/PJOK|JASMANI|OLAHRAGA/.test(text)) return "PJOK";
  if (/INFORMATIKA|\bINF\b/.test(text)) return "INF";
  if (/SENI|PRAKARYA/.test(text)) return "SENPRA";
  if (/MUATAN LOKAL|DAERAH|MLD/.test(text)) return "MLD";
  return "";
}

function renderIndukMapelOptions(selected = "") {
  const current = normalizeIndukMapel(selected);
  return [
    `<option value="">Pilih induk</option>`,
    ...INDUK_MAPEL_OPTIONS.map(item => `<option value="${item.kode}" ${item.kode === current ? "selected" : ""}>${item.kode} - ${item.nama}</option>`)
  ].join("");
}

function renderAgamaMapelOptions(selected = "") {
  const current = String(selected || "").trim().toLowerCase();
  return [
    `<option value="">Agama</option>`,
    ...MAPEL_AGAMA_OPTIONS.map(item => `<option value="${item}" ${item.toLowerCase() === current ? "selected" : ""}>${item}</option>`)
  ].join("");
}

function toggleAgamaMapelField(prefix = "") {
  const indukId = prefix ? `${prefix}IndukMapel` : "indukMapel";
  const agamaWrapId = prefix ? `${prefix}AgamaMapelWrap` : "agamaMapelWrap";
  const induk = document.getElementById(indukId)?.value || "";
  const agamaWrap = document.getElementById(agamaWrapId);
  if (agamaWrap) agamaWrap.style.display = normalizeIndukMapel(induk) === "PABP" ? "" : "none";
}

function sortMapelByMapping(data) {
  return [...data].sort((a, b) => {
    if (mapelSortField === "mapping") {
      const mappingA = Number(a.mapping ?? Number.MAX_SAFE_INTEGER);
      const mappingB = Number(b.mapping ?? Number.MAX_SAFE_INTEGER);
      const result = mappingA - mappingB;
      if (result !== 0) {
        return mapelSortDirection === "asc" ? result : -result;
      }
      return compareValues(a.kode_mapel, b.kode_mapel, mapelSortDirection);
    }

    if (mapelSortField === "induk_mapel") {
      return compareValues(getMapelIndukKode(a), getMapelIndukKode(b), mapelSortDirection);
    }

    return compareValues(a[mapelSortField], b[mapelSortField], mapelSortDirection);
  });
}

function setMapelSort(field) {
  if (mapelSortField === field) {
    mapelSortDirection = mapelSortDirection === "asc" ? "desc" : "asc";
  } else {
    mapelSortField = field;
    mapelSortDirection = "asc";
  }
  currentPageMapel = 1;
  renderMapelTableState();
}

function renderMapelTableState() {
  const content = document.getElementById("content");
  if (!content) return;
  content.innerHTML = renderMapelPage();
  renderMapelFiltered();
}

function validateMapelValues(mapping, induk, agama, kode, nama, jp, excludeKode = "") {
  const mappingValue = normalizeMapelMapping(mapping);
  const indukValue = normalizeIndukMapel(induk);
  const agamaValue = String(agama || "").trim();
  const kodeNorm = String(kode || "").trim().toLowerCase();
  const namaValue = String(nama || "").trim();
  const jpValue = String(jp || "").trim();
  const excludeNorm = String(excludeKode || "").trim().toLowerCase();

  if (!mappingValue) {
    return "Mapping wajib diisi";
  }

  if (!/^[0-9]+$/.test(mappingValue)) {
    return "Mapping harus berupa angka";
  }

  if (!indukValue) {
    return "Induk mapel wajib dipilih";
  }

  if (indukValue === "PABP" && !agamaValue) {
    return "Agama wajib dipilih untuk induk PABP";
  }

  const duplicateMapping = semuaDataMapel.some(d => {
    const existingCode = String(d.kode_mapel || "").trim().toLowerCase();
    return normalizeMapelMapping(d.mapping) === mappingValue && getMapelIndukKode(d) !== indukValue && existingCode !== excludeNorm;
  });

  if (duplicateMapping) {
    return "Mapping sudah digunakan";
  }

  if (!kodeNorm) {
    return "Kode mapel wajib diisi";
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(kode)) {
    return "Gunakan huruf, angka, titik, strip, atau underscore untuk kode mapel";
  }

  const duplicate = semuaDataMapel.some(d => {
    const existingCode = String(d.kode_mapel || "").trim().toLowerCase();
    return existingCode === kodeNorm && existingCode !== excludeNorm;
  });

  if (duplicate) {
    return "Kode mapel sudah digunakan";
  }

  if (!namaValue) {
    return "Nama mapel wajib diisi";
  }

  if (namaValue.length < 3) {
    return "Nama mapel minimal 3 karakter";
  }

  if (!jpValue) {
    return "JP wajib diisi";
  }

  if (!/^[0-9]+$/.test(jpValue)) {
    return "JP harus berupa angka";
  }

  if (Number(jpValue) < 0) {
    return "JP minimal 0";
  }

  return "";
}

function validateMapelImportValues(mapping, induk, agama, kode, nama, jp, seenCodes, seenMappings) {
  const kodeNorm = String(kode || "").trim().toLowerCase();
  const mappingValue = normalizeMapelMapping(mapping);
  const existing = semuaDataMapel.find(d => String(d.kode_mapel || "").trim().toLowerCase() === kodeNorm);
  const validationMessage = validateMapelValues(mapping, induk, agama, kode, nama, jp, existing?.kode_mapel || "");

  if (validationMessage) {
    return validationMessage;
  }

  if (seenCodes.has(kodeNorm)) {
    return "Kode mapel duplikat di file import";
  }

  return "";
}

function setMapelError(id, message) {
  const input = document.getElementById(id);
  const err = document.getElementById("err-" + id);
  if (!input || !err) return;

  if (message) {
    input.classList.add("input-error");
    err.innerText = message;
  } else {
    input.classList.remove("input-error");
    err.innerText = "";
  }
}

function validateMapelForm() {
  let valid = true;
  const mapping = document.getElementById("mappingMapel")?.value.trim() || "";
  const induk = document.getElementById("indukMapel")?.value.trim() || "";
  const agama = document.getElementById("agamaMapel")?.value.trim() || "";
  const kode = document.getElementById("kodeMapel")?.value.trim() || "";
  const nama = document.getElementById("namaMapel")?.value.trim() || "";
  const jp = document.getElementById("jpMapel")?.value.trim() || "";

  const validationMessage = validateMapelValues(mapping, induk, agama, kode, nama, jp);

  if (!mapping) {
    setMapelError("mappingMapel", "Mapping wajib diisi");
    valid = false;
  } else if (!/^[0-9]+$/.test(mapping)) {
    setMapelError("mappingMapel", "Harus angka");
    valid = false;
  } else if (validationMessage === "Mapping sudah digunakan") {
    setMapelError("mappingMapel", "Mapping sudah digunakan");
    valid = false;
  } else {
    setMapelError("mappingMapel", "");
  }

  if (!induk) {
    setMapelError("indukMapel", "Induk wajib dipilih");
    valid = false;
  } else if (validationMessage === "Agama wajib dipilih untuk induk PABP") {
    setMapelError("indukMapel", validationMessage);
    valid = false;
  } else {
    setMapelError("indukMapel", "");
  }

  if (!kode) {
    setMapelError("kodeMapel", "Kode mapel wajib diisi");
    valid = false;
  } else if (!/^[a-zA-Z0-9._-]+$/.test(kode)) {
    setMapelError("kodeMapel", "Gunakan huruf, angka, titik, strip, atau underscore");
    valid = false;
  } else if (validationMessage === "Kode mapel sudah digunakan") {
    setMapelError("kodeMapel", "Kode mapel sudah digunakan");
    valid = false;
  } else {
    setMapelError("kodeMapel", "");
  }

  if (!nama) {
    setMapelError("namaMapel", "Nama mapel wajib diisi");
    valid = false;
  } else if (nama.length < 3) {
    setMapelError("namaMapel", "Minimal 3 karakter");
    valid = false;
  } else {
    setMapelError("namaMapel", "");
  }

  if (!jp) {
    setMapelError("jpMapel", "JP wajib diisi");
    valid = false;
  } else if (!/^[0-9]+$/.test(jp)) {
    setMapelError("jpMapel", "Harus angka");
    valid = false;
  } else if (Number(jp) < 0) {
    setMapelError("jpMapel", "Minimal 0");
    valid = false;
  } else {
    setMapelError("jpMapel", "");
  }

  return valid;
}

function getMapelRowsPerPageValue() {
  return rowsPerPageMapel === "all" ? Number.MAX_SAFE_INTEGER : Number(rowsPerPageMapel);
}

function setMapelRowsPerPage(value) {
  rowsPerPageMapel = "all";
  currentPageMapel = 1;
  renderMapelFiltered();
}

function setMapelPage(page) {
  const hasil = semuaDataMapel;
  const totalPages = Math.max(1, Math.ceil(hasil.length / getMapelRowsPerPageValue()));
  currentPageMapel = Math.min(Math.max(1, page), totalPages);
  renderMapelFiltered();
}

function isMapelBayanganMode() {
  return typeof getActiveMapelCollectionName === "function" && getActiveMapelCollectionName() === "mapel_bayangan";
}

async function syncMapelBayanganFromOriginal({ force = false, removeMissing = false } = {}) {
  if (!isMapelBayanganMode() || isSyncingMapelBayangan) return;
  isSyncingMapelBayangan = true;
  try {
    const [originalSnapshot, bayanganSnapshot] = await Promise.all([
      db.collection("mapel").get(),
      db.collection("mapel_bayangan").get()
    ]);
    if (!force && !bayanganSnapshot.empty) return;
    if (originalSnapshot.empty) return;
    const bayanganById = new Map(bayanganSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() }]));
    const originalIds = new Set();
    const batch = db.batch();
    let count = 0;
    originalSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const kode = String(data.kode_mapel || doc.id || "").trim().toUpperCase();
      if (!kode) return;
      originalIds.add(kode);
      const existing = bayanganById.get(kode);
      batch.set(db.collection("mapel_bayangan").doc(kode), {
        ...data,
        kode_mapel: kode,
        jp: existing?.jp !== undefined ? Number(existing.jp || 0) : Number(data.jp || 0),
        sumber_clone: "mapel",
        cloned_at: existing?.cloned_at || new Date(),
        updated_at: new Date()
      });
      count++;
    });
    if (removeMissing) {
      bayanganSnapshot.docs.forEach(doc => {
        const kode = String(doc.data().kode_mapel || doc.id || "").trim().toUpperCase();
        if (kode && !originalIds.has(kode)) {
          batch.delete(doc.ref);
          count++;
        }
      });
    }
    if (count > 0) await batch.commit();
    return count;
  } catch (error) {
    console.error("Gagal sinkron mapel bayangan", error);
    throw error;
  } finally {
    isSyncingMapelBayangan = false;
  }
}

async function syncMapelBayanganManual() {
  if (!isMapelBayanganMode()) return;
  const confirm = await Swal.fire({
    title: "Sinkron mapel bayangan?",
    text: "Struktur mapel akan diambil dari Data Mapel asli. JP yang sudah diedit di kelas bayangan tetap dipertahankan.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sinkron",
    cancelButtonText: "Batal"
  });

  if (!confirm.isConfirmed) return;

  try {
    Swal.fire({
      title: "Menyinkronkan mapel...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
    await syncMapelBayanganFromOriginal({ force: true, removeMissing: true });
    Swal.fire("Berhasil", "Data Mapel Kelas Bayangan sudah disinkronkan.", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Data Mapel Kelas Bayangan belum berhasil disinkronkan.", "error");
  }
}

function loadRealtimeMapel() {
  if (unsubscribeMapel) unsubscribeMapel();
  if (isMapelBayanganMode()) {
    syncMapelBayanganFromOriginal();
  }

  unsubscribeMapel = listenMapel(data => {
    semuaDataMapel = data;
    renderMapelFiltered();
  });
}

function renderMapelFiltered() {
  const hasil = sortMapelByMapping(semuaDataMapel);

  const tbody = document.getElementById("tbodyMapel");
  const empty = document.getElementById("emptyStateMapel");
  const totalPages = 1;

  if (!tbody) return;

  tbody.innerHTML = [
    isMapelBayanganMode() ? "" : renderMapelInputRow(),
    ...hasil.map(d => renderMapelRow(d))
  ].join("");

  if (empty) {
    empty.style.display = hasil.length === 0 ? "block" : "none";
  }

  const info = document.getElementById("jumlahDataMapel");
  if (info) {
    info.innerText = `${hasil.length} mapel`;
  }

  const pagination = document.getElementById("tablePaginationMapel");
  if (pagination) pagination.innerHTML = "";
}

function renderMapelRow(d) {
  if (currentEditMapel === d.kode_mapel) {
    if (isMapelBayanganMode()) {
      return `
        <tr class="table-edit-row mapel-edit-row" data-mapel-kode="${d.kode_mapel || ""}">
          <td>${d.mapping || "-"}</td>
          <td>${getMapelIndukLabel(d)}${d.agama ? `<br><span class="mapel-row-hint">${d.agama}</span>` : ""}</td>
          <td>${d.kode_mapel || "-"}</td>
          <td>${d.nama_mapel || "-"}</td>
          <td>
            <input class="mapel-inline-input mapel-inline-input-compact mapel-inline-input-center" id="editJpMapel" value="${d.jp || ""}" onkeydown="handleMapelEditKey(event, '${d.kode_mapel}')">
          </td>
          <td>
            <div class="table-actions mapel-actions">
              <button class="btn-primary btn-table-compact" onclick="saveEditMapel('${d.kode_mapel}')">Simpan JP</button>
              <button class="btn-secondary btn-table-compact" onclick="cancelEditMapel()">Batal</button>
            </div>
          </td>
        </tr>
      `;
    }
    return `
      <tr class="table-edit-row mapel-edit-row" data-mapel-kode="${d.kode_mapel || ""}">
        <td>
          <input class="mapel-inline-input mapel-inline-input-compact mapel-inline-input-center" id="editMappingMapel" value="${d.mapping || ""}" onkeydown="handleMapelEditKey(event, '${d.kode_mapel}')">
        </td>
        <td>
          <select id="editIndukMapel" class="mapel-inline-input mapel-inline-input-compact" onchange="toggleAgamaMapelField('edit')" onkeydown="handleMapelEditKey(event, '${d.kode_mapel}')">
            ${renderIndukMapelOptions(getMapelIndukKode(d))}
          </select>
          <div id="editAgamaMapelWrap" style="display:${getMapelIndukKode(d) === "PABP" ? "" : "none"}; margin-top:6px;">
            <select id="editAgamaMapel" class="mapel-inline-input mapel-inline-input-compact" onkeydown="handleMapelEditKey(event, '${d.kode_mapel}')">
              ${renderAgamaMapelOptions(d.agama)}
            </select>
          </div>
        </td>
        <td>
          <input class="mapel-inline-input mapel-inline-input-compact" id="editKodeMapel" value="${d.kode_mapel || ""}" onkeydown="handleMapelEditKey(event, '${d.kode_mapel}')">
        </td>
        <td>
          <input class="mapel-inline-input mapel-inline-input-compact" id="editNamaMapel" value="${d.nama_mapel || ""}" onkeydown="handleMapelEditKey(event, '${d.kode_mapel}')">
        </td>
        <td>
          <input class="mapel-inline-input mapel-inline-input-compact mapel-inline-input-center" id="editJpMapel" value="${d.jp || ""}" onkeydown="handleMapelEditKey(event, '${d.kode_mapel}')">
        </td>
        <td>
          <div class="table-actions mapel-actions">
            <button class="btn-primary btn-table-compact" onclick="saveEditMapel('${d.kode_mapel}')">Simpan</button>
            <button class="btn-secondary btn-table-compact" onclick="cancelEditMapel()">Batal</button>
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr data-mapel-kode="${d.kode_mapel || ""}">
      <td>${d.mapping || "-"}</td>
      <td>${getMapelIndukLabel(d)}${d.agama ? `<br><span class="mapel-row-hint">${d.agama}</span>` : ""}</td>
      <td>${d.kode_mapel || "-"}</td>
      <td>${d.nama_mapel || "-"}</td>
      <td>${d.jp || "-"}</td>
      <td>
        <div class="table-actions mapel-actions">
          <button class="btn-secondary btn-table-compact" onclick="editMapel('${d.kode_mapel}')">${isMapelBayanganMode() ? "Edit JP" : "Edit"}</button>
          ${isMapelBayanganMode() ? "" : `<button class="btn-secondary btn-danger-lite btn-table-compact" onclick="hapusMapel('${d.kode_mapel}')">Hapus</button>`}
        </div>
      </td>
    </tr>
  `;
}

function renderMapelInputRow() {
  return `
    <tr class="mapel-input-row">
      <td>
        <input
          id="mappingMapel"
          class="mapel-inline-input mapel-inline-input-compact mapel-inline-input-center"
          placeholder="1"
          oninput="validateMapelForm()"
          onkeydown="handleMapelInlineKey(event)"
        >
        <div id="err-mappingMapel" class="error-text"></div>
      </td>
      <td>
        <select
          id="indukMapel"
          class="mapel-inline-input mapel-inline-input-compact"
          onchange="toggleAgamaMapelField(); validateMapelForm()"
          onkeydown="handleMapelInlineKey(event)"
        >
          ${renderIndukMapelOptions("")}
        </select>
        <div id="agamaMapelWrap" style="display:none; margin-top:6px;">
          <select id="agamaMapel" class="mapel-inline-input mapel-inline-input-compact" onchange="validateMapelForm()" onkeydown="handleMapelInlineKey(event)">
            ${renderAgamaMapelOptions("")}
          </select>
        </div>
        <div id="err-indukMapel" class="error-text"></div>
      </td>
      <td>
        <input
          id="kodeMapel"
          class="mapel-inline-input mapel-inline-input-compact"
          placeholder="Contoh: MTK"
          oninput="validateMapelForm()"
          onkeydown="handleMapelInlineKey(event)"
        >
        <div id="err-kodeMapel" class="error-text"></div>
      </td>
      <td>
        <div class="mapel-inline-cell">
          <div class="mapel-inline-field">
            <input
              id="namaMapel"
              class="mapel-inline-input mapel-inline-input-compact"
              placeholder="Contoh: Matematika"
              oninput="validateMapelForm()"
              onkeydown="handleMapelInlineKey(event)"
            >
            <div id="err-namaMapel" class="error-text"></div>
          </div>
        </div>
      </td>
      <td>
        <div class="mapel-inline-cell">
          <div class="mapel-inline-field">
            <input
              id="jpMapel"
              class="mapel-inline-input mapel-inline-input-compact mapel-inline-input-center"
              placeholder="4"
              oninput="validateMapelForm()"
              onkeydown="handleMapelInlineKey(event)"
            >
            <div id="err-jpMapel" class="error-text"></div>
          </div>
        </div>
      </td>
      <td>
        <button id="btnSimpanMapel" class="btn-primary btn-inline-mapel btn-table-compact" onclick="simpanMapelData()">Tambah</button>
      </td>
    </tr>
  `;
}

function handleMapelSearch() {
  currentPageMapel = 1;
  renderMapelFiltered();
}

function resetMapelFilter() {
  rowsPerPageMapel = "all";
  currentPageMapel = 1;
  renderMapelFiltered();
}

function importMapelExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async evt => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      const parsed = json.map(row => {
        const mapping = String(getMapelCellValue(row, ["MAPPING", "NO", "NOMOR_URUT", "NOMOR URUT"])).trim();
        const indukMapelRaw = normalizeIndukMapel(getMapelCellValue(row, ["INDUK_MAPEL", "INDUK MAPEL", "INDUK"]));
        const agama = String(getMapelCellValue(row, ["AGAMA"])).trim();
        const kodeMapel = String(getMapelCellValue(row, ["KODE_MAPEL", "KODE MAPEL", "KODE"])).trim().toUpperCase();
        const namaMapel = String(getMapelCellValue(row, ["NAMA_MAPEL", "NAMA MAPEL", "NAMA"])).trim();
        const indukMapel = indukMapelRaw || inferIndukMapelFromMapel(kodeMapel, namaMapel);
        const jp = String(getMapelCellValue(row, ["JP", "JAM_PELAJARAN", "JAM PELAJARAN"])).trim();

        return {
          mapping,
          induk_mapel: indukMapel,
          agama,
          kode_mapel: kodeMapel,
          nama_mapel: namaMapel,
          jp
        };
      }).filter(item => item.kode_mapel || item.nama_mapel);

      const seenCodes = new Set();
      const seenMappings = new Set();
      const preparedRows = parsed.map(item => {
        const error = validateMapelImportValues(item.mapping, item.induk_mapel, item.agama, item.kode_mapel, item.nama_mapel, item.jp, seenCodes, seenMappings);
        const existing = semuaDataMapel.find(mapel => mapel.kode_mapel === item.kode_mapel);

        if (!error) {
          seenCodes.add(String(item.kode_mapel || "").trim().toLowerCase());
          seenMappings.add(normalizeMapelMapping(item.mapping));
        }

        return {
          ...item,
          __error: error,
          __mode: existing ? "update" : "new",
          __existing: existing || null
        };
      });

      const validRows = preparedRows.filter(item => !item.__error);
      const invalidRows = preparedRows.length - validRows.length;

      if (validRows.length === 0) {
        event.target.value = "";
        Swal.fire("Import mapel gagal", "Tidak ada data valid yang bisa diimport.", "error");
        return;
      }

      const totalBaru = validRows.filter(item => item.__mode === "new").length;
      const totalUpdate = validRows.filter(item => item.__mode === "update").length;

      const confirm = await Swal.fire({
        title: "Import Data Mapel",
        html: `Data terbaca: ${parsed.length}<br>Baru: ${totalBaru}<br>Update: ${totalUpdate}<br>Baris tidak valid: ${invalidRows}`,
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
        title: "Mengimport mapel...",
        didOpen: () => Swal.showLoading()
      });

      let berhasil = 0;
      let gagal = 0;
      let update = 0;
      let baru = 0;

      for (const item of validRows) {
        try {
          const existing = item.__existing;
          await getActiveMapelCollection().doc(item.kode_mapel).set({
            mapping: Number(item.mapping),
            induk_mapel: item.induk_mapel,
            induk_nama: getIndukMapelOption(item.induk_mapel)?.nama || "",
            agama: item.induk_mapel === "PABP" ? item.agama : "",
            kode_mapel: item.kode_mapel,
            nama_mapel: item.nama_mapel,
            jp: Number(item.jp),
            created_at: existing ? existing.created_at || new Date() : new Date(),
            updated_at: new Date()
          });
          berhasil++;
          if (item.__mode === "update") {
            update++;
          } else {
            baru++;
          }
        } catch (error) {
          console.error(error);
          gagal++;
        }
      }

      Swal.fire({
        title: "Import mapel selesai",
        html: `Berhasil: ${berhasil}<br>Baru: ${baru}<br>Update: ${update}<br>Gagal: ${gagal}<br>Tidak valid: ${invalidRows}`,
        icon: "success",
        confirmButtonText: "OK"
      });
    } catch (error) {
      console.error(error);
      Swal.fire("Gagal membaca file mapel", "", "error");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsArrayBuffer(file);
}

async function simpanMapelData() {
  if (isMapelBayanganMode()) {
    Swal.fire("Read only", "Data mapel kelas bayangan disalin dari mapel asli. Yang bisa diubah hanya JP pada baris mapel.", "info");
    return;
  }
  if (isSubmittingMapel) return;
  if (!validateMapelForm()) return;

  const btn = document.getElementById("btnSimpanMapel");
  const mappingEl = document.getElementById("mappingMapel");
  const indukEl = document.getElementById("indukMapel");
  const agamaEl = document.getElementById("agamaMapel");
  const kodeEl = document.getElementById("kodeMapel");
  const namaEl = document.getElementById("namaMapel");
  const jpEl = document.getElementById("jpMapel");

  const data = {
    mapping: Number(mappingEl.value.trim()),
    induk_mapel: normalizeIndukMapel(indukEl.value),
    induk_nama: getIndukMapelOption(indukEl.value)?.nama || "",
    agama: normalizeIndukMapel(indukEl.value) === "PABP" ? agamaEl.value.trim() : "",
    kode_mapel: kodeEl.value.trim().toUpperCase(),
    nama_mapel: namaEl.value.trim(),
    jp: Number(jpEl.value.trim()),
    created_at: new Date(),
    updated_at: new Date()
  };

  try {
    isSubmittingMapel = true;
    if (btn) {
      btn.disabled = true;
      btn.innerText = "Menyimpan...";
    }

    await saveMapel(data);
    mappingEl.value = "";
    indukEl.value = "";
    if (agamaEl) agamaEl.value = "";
    toggleAgamaMapelField();
    kodeEl.value = "";
    namaEl.value = "";
    jpEl.value = "";
    setMapelError("mappingMapel", "");
    setMapelError("indukMapel", "");
    setMapelError("kodeMapel", "");
    setMapelError("namaMapel", "");
    setMapelError("jpMapel", "");
    Swal.fire("Berhasil", "Mata pelajaran ditambahkan", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Mata pelajaran belum berhasil ditambahkan", "error");
  } finally {
    isSubmittingMapel = false;
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Tambah";
    }
  }
}

function handleMapelInlineKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    simpanMapelData();
  }
}

function editMapel(kodeMapel) {
  currentEditMapel = kodeMapel;
  renderMapelFiltered();
}

function cancelEditMapel() {
  currentEditMapel = null;
  renderMapelFiltered();
}

function handleMapelEditKey(event, kodeMapel) {
  if (event.key === "Enter") {
    event.preventDefault();
    saveEditMapel(kodeMapel);
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEditMapel();
  }
}

async function saveEditMapel(kodeLama) {
  if (isMapelBayanganMode()) {
    const jpBaru = document.getElementById("editJpMapel")?.value.trim() || "";
    if (!/^[0-9]+$/.test(jpBaru) || Number(jpBaru) < 0) {
      Swal.fire("JP belum valid", "JP harus angka minimal 0.", "warning");
      return;
    }
    try {
      await getActiveMapelCollection().doc(kodeLama).update({
        jp: Number(jpBaru),
        updated_at: new Date()
      });
      currentEditMapel = null;
      renderMapelFiltered();
      if (typeof showInlineSaveNotificationForData === "function") {
        showInlineSaveNotificationForData("data-mapel-kode", kodeLama, "Tersimpan");
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Gagal", "JP belum berhasil diperbarui", "error");
    }
    return;
  }

  const mappingBaru = document.getElementById("editMappingMapel")?.value.trim() || "";
  const indukBaru = document.getElementById("editIndukMapel")?.value.trim() || "";
  const agamaBaru = document.getElementById("editAgamaMapel")?.value.trim() || "";
  const kodeBaru = document.getElementById("editKodeMapel")?.value.trim().toUpperCase() || "";
  const namaBaru = document.getElementById("editNamaMapel")?.value.trim() || "";
  const jpBaru = document.getElementById("editJpMapel")?.value.trim() || "";
  const validationMessage = validateMapelValues(mappingBaru, indukBaru, agamaBaru, kodeBaru, namaBaru, jpBaru, kodeLama);

  if (validationMessage) {
    Swal.fire("Edit mapel belum bisa disimpan", validationMessage, "warning");
    return;
  }

  try {
    const existing = semuaDataMapel.find(d => d.kode_mapel === kodeLama) || {};

    await updateMapel(kodeLama, {
      ...existing,
      mapping: Number(mappingBaru),
      induk_mapel: normalizeIndukMapel(indukBaru),
      induk_nama: getIndukMapelOption(indukBaru)?.nama || "",
      agama: normalizeIndukMapel(indukBaru) === "PABP" ? agamaBaru : "",
      kode_mapel: kodeBaru,
      nama_mapel: namaBaru,
      jp: Number(jpBaru),
      updated_at: new Date()
    });

    currentEditMapel = null;
    renderMapelFiltered();
    if (typeof showInlineSaveNotificationForData === "function") {
      const shown = showInlineSaveNotificationForData("data-mapel-kode", kodeBaru, "Tersimpan");
      if (!shown) showInlineSaveNotificationForData("data-mapel-kode", kodeLama, "Tersimpan");
    }
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Perubahan mapel belum berhasil disimpan", "error");
  }
}

async function hapusMapel(kodeMapel) {
  if (isMapelBayanganMode()) {
    Swal.fire("Read only", "Mapel kelas bayangan tidak bisa dihapus. Hapus dari Data Mapel asli jika perlu.", "info");
    return;
  }
  const confirm = await Swal.fire({
    title: "Hapus mata pelajaran?",
    text: `Data ${kodeMapel} akan dihapus.`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Hapus",
    cancelButtonText: "Batal"
  });

  if (!confirm.isConfirmed) return;

  try {
    await deleteMapel(kodeMapel);
    if (currentEditMapel === kodeMapel) {
      currentEditMapel = null;
    }
    Swal.fire("Berhasil", "Mata pelajaran dihapus", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Mata pelajaran belum berhasil dihapus", "error");
  }
}
