// =====================================================
// SMART IMPORT EXCEL (PRO VERSION)
// =====================================================

let previewData = [];
let lastImportedIds = [];
let isUploading = false;
let lastImportInput = null;
let previewPage = 1;
let previewRowsPerPage = 10;

function downloadExcelTemplate(filename, headers) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, filename);
}

function downloadSiswaTemplate() {
  downloadExcelTemplate("template-import-siswa.xlsx", [
    "NIPD",
    "NISN",
    "NAMA",
    "JK",
    "AGAMA",
    "KELAS"
  ]);
}

function openPreviewModal() {
  const modal = document.getElementById("previewModal");
  if (!modal) return;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

function closePreviewModal() {
  const modal = document.getElementById("previewModal");
  if (!modal) return;

  modal.style.display = "none";
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
}

function resetImportFileInput() {
  if (lastImportInput) lastImportInput.value = "";
}

function handlePreviewBackdrop(event) {
  if (event.target?.id === "previewModal") {
    batalImport();
  }
}

function normalizeHeader(text) {
  return String(text || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function getCellValue(row, aliases) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  );

  for (const alias of aliases) {
    const value = normalizedRow[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function normalizeJK(value) {
  const text = String(value || "").trim().toUpperCase();

  if (!text) return "";
  if (["L", "LK", "LAKI-LAKI", "LAKI LAKI", "LAKILAKI"].includes(text)) return "L";
  if (["P", "PR", "PEREMPUAN", "WANITA"].includes(text)) return "P";

  return text;
}

function normalizeKelas(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^([0-9]+)([A-Z]+)$/);
  if (match) return `${match[1]}${match[2]}`;
  return compact;
}

function getPreviewRowsPerPageValue() {
  return previewRowsPerPage === "all" ? Number.MAX_SAFE_INTEGER : Number(previewRowsPerPage);
}

function setPreviewRowsPerPage(value) {
  previewRowsPerPage = value === "all" ? "all" : Number(value);
  previewPage = 1;
  renderPreview();
}


// =====================================================
// STEP 1: IMPORT FILE
// =====================================================
function importExcel(e) {
  if (isSiswaImportLockedBySemester()) {
    Swal.fire(
      "Import dikunci",
      "Import data siswa hanya bisa dilakukan pada semester terbaru/aktif. Semester lama memakai snapshot agar datanya tidak berubah.",
      "warning"
    );
    if (e?.target) e.target.value = "";
    return;
  }

  const file = e.target.files[0];
  if (!file) return;
  lastImportInput = e.target;

  const reader = new FileReader();

  reader.onload = (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      const siswaByNipd = new Map(semuaData.map(item => [String(item.nipd || "").trim(), item]));
      const siswaByNisn = new Map();
      semuaData.forEach(item => {
        const nisn = String(item.nisn || "").trim();
        if (nisn && !siswaByNisn.has(nisn)) siswaByNisn.set(nisn, item);
      });

      previewData = json.map(row => {

        const nipd = String(getCellValue(row, ["NIPD", "NO_INDUK", "ID_SISWA"])).trim();
        const nisn = String(getCellValue(row, ["NISN"])).trim();
        const rawNama = String(getCellValue(row, ["NAMA", "NAMA_SISWA", "NAMA LENGKAP", "NAMA_LENGKAP"])).trim();
        const nama = typeof normalizeSiswaNamaValue === "function" ? normalizeSiswaNamaValue(rawNama) : rawNama;
        const jk = normalizeJK(getCellValue(row, ["JK", "JENIS_KELAMIN", "JENIS KELAMIN", "L/P", "LP"]));
        const agama = String(getCellValue(row, ["AGAMA"])).trim();
        const kelas = normalizeKelas(getCellValue(row, ["KELAS", "KELAS_ROMBEL", "ROMBEL"]));

        const existing = siswaByNipd.get(nipd);
        const nisnOwner = siswaByNisn.get(nisn);
        const nisnConflict = nisnOwner && nisnOwner.nipd !== nipd ? nisnOwner : null;

        let status = "new";

        if (!nipd || !nisn || !nama) {
          status = "error";
        } else if (nisnConflict) {
          status = "conflict";
        } else if (existing) {

          const isSame =
            existing.nama === nama &&
            existing.nisn === nisn &&
            existing.jk === jk &&
            existing.agama === agama &&
            existing.kelas === kelas;

          status = isSame ? "same" : "update";
        }

        return {
          nipd, nisn, nama, jk, agama, kelas,
          status,
          existing
        };
      });

      previewPage = 1;
      renderPreview();

    } catch (err) {
      console.error(err);
      Swal.fire("Gagal membaca file", "", "error");
    }
  };

  reader.readAsArrayBuffer(file);
}


// =====================================================
// STEP 2: PREVIEW
// =====================================================
function renderPreview() {

  const container = document.getElementById("previewContainer");
  if (!container) return;

  openPreviewModal();

  const summary = {
    new: previewData.filter(d => d.status === "new").length,
    update: previewData.filter(d => d.status === "update").length,
    same: previewData.filter(d => d.status === "same").length,
    conflict: previewData.filter(d => d.status === "conflict").length,
    error: previewData.filter(d => d.status === "error").length
  };
  const effectiveRowsPerPage = getPreviewRowsPerPageValue();
  const totalPages = Math.max(1, Math.ceil(previewData.length / effectiveRowsPerPage));
  if (previewPage > totalPages) {
    previewPage = totalPages;
  }

  const startIndex = (previewPage - 1) * effectiveRowsPerPage;
  const rows = previewData.slice(startIndex, startIndex + effectiveRowsPerPage).map(d => {

    let bg = "", label = "";

    switch (d.status) {
      case "error":
        bg = "#fee2e2"; label = "ERROR"; break;
      case "conflict":
        bg = "#fde68a"; label = "CONFLICT"; break;
      case "update":
        bg = "#bfdbfe"; label = "UPDATE"; break;
      case "new":
        bg = "#dcfce7"; label = "NEW"; break;
      case "same":
        bg = "#f1f5f9"; label = "SAME"; break;
    }

    return `
      <tr style="background:${bg}">
        <td>${d.nipd}</td>
        <td>${d.nisn}</td>
        <td>${d.nama}</td>
        <td>${d.jk}</td>
        <td>${d.agama}</td>
        <td>${d.kelas}</td>
        <td><b>${label}</b></td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="preview-header">
      <div>
        <h3>Preview Import (${previewData.length} data)</h3>
        <div class="preview-summary">
          <span>Baru: ${summary.new}</span>
          <span>Update: ${summary.update}</span>
          <span>Same: ${summary.same}</span>
          <span>Conflict: ${summary.conflict}</span>
          <span>Error: ${summary.error}</span>
        </div>
      </div>
      <div class="preview-header-actions">
        <div class="page-size-control">
          <label for="previewRowsPerPage">Tampilkan</label>
          <select id="previewRowsPerPage" onchange="setPreviewRowsPerPage(this.value)">
            <option value="10" ${previewRowsPerPage === 10 ? "selected" : ""}>10</option>
            <option value="20" ${previewRowsPerPage === 20 ? "selected" : ""}>20</option>
            <option value="50" ${previewRowsPerPage === 50 ? "selected" : ""}>50</option>
            <option value="100" ${previewRowsPerPage === 100 ? "selected" : ""}>100</option>
            <option value="200" ${previewRowsPerPage === 200 ? "selected" : ""}>200</option>
            <option value="all" ${previewRowsPerPage === "all" ? "selected" : ""}>Semuanya</option>
          </select>
        </div>
        <button class="btn-secondary" onclick="batalImport()">Tutup</button>
      </div>
    </div>

    <div class="preview-table-wrap">
      <table>
        <thead>
          <tr>
            <th>NIPD</th>
            <th>NISN</th>
            <th>Nama</th>
            <th>JK</th>
            <th>Agama</th>
            <th>Kelas</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div id="previewPagination" class="pagination-wrap"></div>

    <div class="preview-mode">
      <b>Mode Import:</b><br>

      <label>
        <input type="radio" name="importMode" value="update" checked>
        Update (ubah jika berbeda)
      </label><br>

      <label>
        <input type="radio" name="importMode" value="skip">
        Skip (lewati data lama)
      </label><br>

      <label>
        <input type="radio" name="importMode" value="overwrite">
        Overwrite (paksa semua)
      </label>
    </div>

    <div class="preview-actions">
      <button class="btn-primary" onclick="uploadImport()">Upload</button>
      <button class="btn-secondary" onclick="batalImport()">Batal</button>
    </div>

    <small class="preview-note">
      Hijau=baru | Biru=update | Abu=same | Kuning=conflict | Merah=error
    </small>
  `;

  renderPreviewPagination(totalPages);
}

function renderPreviewPagination(totalPages) {
  const container = document.getElementById("previewPagination");
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="pagination">
      <button class="btn-secondary" onclick="setPreviewPage(${previewPage - 1})" ${previewPage === 1 ? "disabled" : ""}>Prev</button>
      <span>Halaman ${previewPage} dari ${totalPages}</span>
      <button class="btn-secondary" onclick="setPreviewPage(${previewPage + 1})" ${previewPage === totalPages ? "disabled" : ""}>Next</button>
    </div>
  `;
}

function setPreviewPage(page) {
  const totalPages = Math.max(1, Math.ceil(previewData.length / getPreviewRowsPerPageValue()));
  previewPage = Math.min(Math.max(1, page), totalPages);
  renderPreview();
}


// =====================================================
// STEP 3: MODE
// =====================================================
function getImportMode() {
  return document.querySelector('input[name="importMode"]:checked')?.value || "update";
}

function isSiswaImportLockedBySemester() {
  return false;
}

function getSiswaImportErrorMessage(error) {
  const code = String(error?.code || "");
  if (code === "resource-exhausted") return "Quota Supabase kemungkinan habis atau limit sementara tercapai.";
  if (code === "permission-denied") return "Akses Supabase ditolak oleh policy.";
  if (code === "unavailable") return "Koneksi ke Supabase sedang tidak tersedia.";
  return error?.message || "Error tidak diketahui.";
}


// =====================================================
// STEP 4: UPLOAD
// =====================================================
async function uploadImport() {
  if (isSiswaImportLockedBySemester()) {
    Swal.fire(
      "Import dikunci",
      "Silakan login ke semester terbaru untuk import data siswa. Semester lama dikunci agar snapshot tidak berubah.",
      "warning"
    );
    return;
  }

  if (isUploading) return;
  isUploading = true;

  let berhasil = 0;
  let gagal = 0;
  const errorMessages = [];

  lastImportedIds = [];

  const mode = getImportMode();
  const dataSiapUpload = previewData.filter(d => {
    if (d.status === "error" || d.status === "conflict") return false;

    const exists = !!d.existing;
    if (mode === "skip" && exists) return false;
    if (mode === "update" && exists && d.status === "same") return false;

    return true;
  });

  if (dataSiapUpload.length === 0) {
    isUploading = false;

    Swal.fire({
      title: "Tidak ada perubahan",
      text: "Tidak ada data yang perlu diupload.",
      icon: "info",
      confirmButtonText: "OK"
    });
    return;
  }

  Swal.fire({
    title: "Mengupload...",
    didOpen: () => Swal.showLoading()
  });

  for (let index = 0; index < dataSiapUpload.length; index += 450) {
    const batchItems = dataSiapUpload.slice(index, index + 450);
    const batch = db.batch();
    const newIds = [];
    batchItems.forEach(d => {
      const exists = !!d.existing;
      const ref = typeof getSemesterDocRef === "function"
        ? getSemesterDocRef("siswa", d.nipd)
        : db.collection("siswa").doc(d.nipd);
      batch.set(ref, {
        nipd: d.nipd,
        nisn: d.nisn,
        nama: d.nama,
        jk: d.jk,
        agama: d.agama,
        kelas: d.kelas,
        created_at: exists ? d.existing.created_at || new Date() : new Date(),
        updated_at: new Date()
      });
      if (!exists) newIds.push(d.nipd);
    });
    try {
      await batch.commit();
      berhasil += batchItems.length;
      lastImportedIds.push(...newIds);
    } catch (err) {
      console.error(err);
      gagal += batchItems.length;
      errorMessages.push(getSiswaImportErrorMessage(err));
    }
  }

  closePreviewModal();
  const errorInfo = errorMessages.length
    ? `<br><small>Error: ${[...new Set(errorMessages)].slice(0, 3).join("<br>")}</small>`
    : "";

  if (lastImportedIds.length > 0) {
    Swal.fire({
      title: "Import selesai",
      html: `Berhasil: ${berhasil}<br>Gagal: ${gagal}${errorInfo}`,
      showCancelButton: true,
      confirmButtonText: "Undo",
      cancelButtonText: "Tutup"
    }).then(res => {
      if (res.isConfirmed) undoImport();
    });
  } else {
    Swal.fire({
      title: "Import selesai",
      html: `Berhasil: ${berhasil}<br>Gagal: ${gagal}${errorInfo}`,
      icon: gagal ? "warning" : "success",
      confirmButtonText: "OK"
    });
  }

  resetImportFileInput();
  isUploading = false;
}


// =====================================================
// STEP 5: UNDO (DATA BARU)
// =====================================================
async function undoImport() {

  Swal.fire({
    title: "Undo...",
    didOpen: () => Swal.showLoading()
  });

  for (const id of lastImportedIds) {
    const ref = typeof getSemesterDocRef === "function"
      ? getSemesterDocRef("siswa", id)
      : db.collection("siswa").doc(id);
    await ref.delete();
  }

  Swal.fire("Undo berhasil", "", "success");
}


// =====================================================
// STEP 6: BATAL
// =====================================================
function batalImport() {
  previewData = [];
  previewPage = 1;
  const container = document.getElementById("previewContainer");
  if (container) container.innerHTML = "";
  resetImportFileInput();
  closePreviewModal();
}
