// ================= STATE GURU =================
let semuaDataGuru = [];
let currentEditGuru = null;
let unsubscribeGuru = null;
let isSubmittingGuru = false;
let debounceGuru;
let currentPageGuru = 1;
let rowsPerPageGuru = 10;
let semuaMapelGuru = [];
let unsubscribeGuruMapelOptions = null;
let guruSortField = "kode_guru";
let guruSortDirection = "asc";
let isBackfillingGuruStatus = false;
let hasBackfilledGuruStatus = false;
let isBackfillingGuruNama = false;
let hasBackfilledGuruNama = false;
let pendingGuruRowFocus = null;
const GURU_STATUS_OPTIONS = ["PNS", "PPPK", "PPPK PW", "GB"];

function escapeGuruHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripGuruTitlesFromName(value = "") {
  return String(value || "")
    .replace(/\b(Drs?|Dra|Prof|Hj?|Ir)\.?(?=\s|,|$)/gi, " ")
    .replace(/\b(S|M|D)\.?\s?(Pd|Si|Ag|Kom|H|E|Ak|Ikom|Hum|Kes|Kep|Farm|T|Sc|A)\.?(?=\s|,|$)/gi, " ")
    .replace(/,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getGuruSortName(guru = {}) {
  const namaTanpaGelar = String(guru.nama || "").trim();
  if (namaTanpaGelar) return namaTanpaGelar;
  return stripGuruTitlesFromName(guru.nama_lengkap || formatNamaGuru(guru));
}

function normalizeGuruStatus(value = "") {
  const normalized = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (GURU_STATUS_OPTIONS.includes(normalized)) return normalized;
  if (normalized.replace(/\s+/g, "") === "PPPKPW") return "PPPK PW";
  return "PNS";
}

function normalizeGuruNamaValue(namaValue = "") {
  const raw = String(namaValue || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .toLowerCase()
    .split(" ")
    .map(word => word
      .split(/([-'])/)
      .map(part => (/^[-']$/.test(part) ? part : (part ? part.charAt(0).toUpperCase() + part.slice(1) : "")))
      .join("")
    )
    .join(" ");
}

function getGuruStatus(guru = {}) {
  return normalizeGuruStatus(guru.status);
}

function isGuruStatusGB(guru = {}) {
  return getGuruStatus(guru) === "GB";
}

function renderGuruStatusOptions(selectedValue = "PNS") {
  const selectedStatus = normalizeGuruStatus(selectedValue);
  return GURU_STATUS_OPTIONS
    .map(status => `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${status}</option>`)
    .join("");
}

function queueGuruRowFocus(kodeGuru, options = {}) {
  pendingGuruRowFocus = {
    kodeGuru: String(kodeGuru || ""),
    focusInput: Boolean(options.focusInput)
  };
}

function flushGuruRowFocus() {
  if (!pendingGuruRowFocus?.kodeGuru) return;
  const { kodeGuru, focusInput } = pendingGuruRowFocus;
  pendingGuruRowFocus = null;

  requestAnimationFrame(() => {
    const row = Array.from(document.querySelectorAll("#tbodyGuru tr[data-guru-kode]"))
      .find(item => item.getAttribute("data-guru-kode") === kodeGuru);
    if (!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    row.classList.add("guru-row-focus-pulse");
    window.setTimeout(() => row.classList.remove("guru-row-focus-pulse"), 1400);

    const focusTarget = focusInput
      ? row.querySelector("input, select, button")
      : row.querySelector("button");
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  });
}

function sortGuruData(data) {
  return [...data].sort((a, b) => {
    if (guruSortField === "nama_lengkap") {
      return compareValues(getGuruSortName(a), getGuruSortName(b), guruSortDirection) ||
        compareValues(formatNamaGuru(a), formatNamaGuru(b), guruSortDirection);
    }

    return compareValues(a[guruSortField], b[guruSortField], guruSortDirection);
  });
}

function setGuruSort(field) {
  if (guruSortField === field) {
    guruSortDirection = guruSortDirection === "asc" ? "desc" : "asc";
  } else {
    guruSortField = field;
    guruSortDirection = "asc";
  }
  currentPageGuru = 1;
  renderGuruTableState();
}

function renderGuruTableState() {
  const content = document.getElementById("content");
  if (!content) return;
  const searchValue = document.getElementById("searchGuru")?.value || "";
  const rowsValue = String(rowsPerPageGuru);
  content.innerHTML = renderGuruTable();
  const search = document.getElementById("searchGuru");
  const rows = document.getElementById("rowsPerPageGuru");
  if (search) search.value = searchValue;
  if (rows) rows.value = rowsValue;
  renderGuruFiltered();
}

function renderGuruMapelOptions(selectedValue = "") {
  const normalizedSelected = String(selectedValue || "").trim().toLowerCase();
  const placeholder = semuaMapelGuru.length > 0 ? "Pilih mata pelajaran" : "Belum ada data mapel";
  const options = [`<option value="">${placeholder}</option>`];

  semuaMapelGuru.forEach(item => {
    const kodeMapel = String(item.kode_mapel || "").trim();
    const namaMapel = String(item.nama_mapel || "").trim();
    if (!kodeMapel) return;
    const selected = [kodeMapel, namaMapel]
      .some(value => String(value || "").trim().toLowerCase() === normalizedSelected)
      ? "selected"
      : "";
    const label = namaMapel ? `${kodeMapel} - ${namaMapel}` : kodeMapel;
    options.push(`<option value="${escapeGuruHtml(kodeMapel)}" ${selected}>${escapeGuruHtml(label)}</option>`);
  });

  if (selectedValue && !semuaMapelGuru.some(item =>
    [item.kode_mapel, item.nama_mapel].some(value =>
      String(value || "").trim().toLowerCase() === normalizedSelected
    )
  )) {
    options.push(`<option value="${escapeGuruHtml(selectedValue)}" selected>${escapeGuruHtml(selectedValue)}</option>`);
  }

  return options.join("");
}

function populateGuruMapelSelect(selectedValue = "") {
  const select = document.getElementById("mapelGuru");
  if (!select) return;
  select.innerHTML = renderGuruMapelOptions(selectedValue);
}

function loadGuruMapelOptions() {
  if (unsubscribeGuruMapelOptions) unsubscribeGuruMapelOptions();

  unsubscribeGuruMapelOptions = listenMapel(data => {
    semuaMapelGuru = data;
    populateGuruMapelSelect();
  });
}

function normalizeGuruHeader(text) {
  return String(text || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function getGuruCellValue(row, aliases) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeGuruHeader(key), value])
  );

  for (const alias of aliases) {
    const value = normalizedRow[normalizeGuruHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function downloadGuruTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([[
    "KODE_GURU",
    "NAMA",
    "GELAR_DEPAN",
    "GELAR_BELAKANG",
    "NIP",
    "STATUS",
    "MATA_PELAJARAN"
  ]]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "template-import-guru.xlsx");
}

function refreshGuruTable() {
  loadRealtimeGuru();
  renderGuruFiltered();
}

async function ensureGuruMapelOptions() {
  if (semuaMapelGuru.length > 0) return;

  const snapshot = await db.collection("mapel").get();
  semuaMapelGuru = snapshot.docs.map(doc => doc.data()).sort((a, b) => {
    const mappingA = Number(a.mapping ?? Number.MAX_SAFE_INTEGER);
    const mappingB = Number(b.mapping ?? Number.MAX_SAFE_INTEGER);
    if (mappingA !== mappingB) return mappingA - mappingB;
    return compareValues(a.nama_mapel, b.nama_mapel, "asc");
  });
}

function importGuruExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async (evt) => {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);

      const parsed = json.map(row => {
        const kodeGuru = String(getGuruCellValue(row, ["KODE_GURU", "KODE GURU", "KODE"])).trim();
        const nama = normalizeGuruNamaValue(getGuruCellValue(row, ["NAMA", "NAMA_GURU", "NAMA GURU"]));
        const gelarDepan = String(getGuruCellValue(row, ["GELAR_DEPAN", "GELAR DEPAN"])).trim();
        const gelarBelakang = String(getGuruCellValue(row, ["GELAR_BELAKANG", "GELAR BELAKANG"])).trim();
        const nip = String(getGuruCellValue(row, ["NIP"])).trim();
        const status = normalizeGuruStatus(getGuruCellValue(row, ["STATUS", "STATUS_GURU", "STATUS GURU"]));
        const mataPelajaran = String(getGuruCellValue(row, ["MATA_PELAJARAN", "MATA PELAJARAN", "MAPEL"])).trim();

        return {
          kode_guru: kodeGuru,
          nama,
          gelar_depan: gelarDepan,
          gelar_belakang: gelarBelakang,
          nip,
          status,
          mata_pelajaran: mataPelajaran,
          nama_lengkap: [gelarDepan, nama, gelarBelakang].filter(Boolean).join(" ")
        };
      }).filter(item => item.kode_guru || item.nama || item.nip || item.mata_pelajaran);

      const validRows = parsed.filter(item => item.kode_guru && item.nama && item.mata_pelajaran);
      const invalidRows = parsed.length - validRows.length;

      if (validRows.length === 0) {
        event.target.value = "";
        Swal.fire("Import guru gagal", "Tidak ada data valid yang bisa diimport.", "error");
        return;
      }

      const confirm = await Swal.fire({
        title: "Import Data Guru",
        html: `Data terbaca: ${parsed.length}<br>Siap diimport: ${validRows.length}<br>Baris tidak lengkap: ${invalidRows}<br><small>NIP dan gelar boleh kosong saat import</small>`,
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
        title: "Mengimport guru...",
        didOpen: () => Swal.showLoading()
      });

      let berhasil = 0;
      let gagal = 0;

      for (const guru of validRows) {
        try {
          const existing = semuaDataGuru.find(item => item.kode_guru === guru.kode_guru);
          await db.collection("guru").doc(guru.kode_guru).set({
            ...guru,
            jp: Number(existing?.jp || 0),
            created_at: existing ? existing.created_at || new Date() : new Date(),
            updated_at: new Date()
          });
          berhasil++;
        } catch (error) {
          console.error(error);
          gagal++;
        }
      }

      Swal.fire({
        title: "Import guru selesai",
        html: `Berhasil: ${berhasil}<br>Gagal: ${gagal}<br>Tidak lengkap: ${invalidRows}`,
        icon: "success",
        confirmButtonText: "OK"
      });

      event.target.value = "";
    } catch (error) {
      console.error(error);
      event.target.value = "";
      Swal.fire("Gagal membaca file guru", "", "error");
    }
  };

  reader.readAsArrayBuffer(file);
}

function formatNamaGuru(guru) {
  const parts = [guru.gelar_depan, guru.nama, guru.gelar_belakang]
    .map(value => String(value || "").trim())
    .filter(Boolean);
  return parts.join(" ");
}

function getGuruRowsPerPageValue() {
  return rowsPerPageGuru === "all" ? Number.MAX_SAFE_INTEGER : Number(rowsPerPageGuru);
}

function setGuruRowsPerPage(value) {
  rowsPerPageGuru = value === "all" ? "all" : Number(value);
  currentPageGuru = 1;
  renderGuruFiltered();
}

function setGuruPage(page) {
  const keyword = document.getElementById("searchGuru")?.value?.toLowerCase() || "";
  const hasil = semuaDataGuru.filter(d =>
    (d.kode_guru || "").toLowerCase().includes(keyword) ||
    formatNamaGuru(d).toLowerCase().includes(keyword) ||
    (d.nip || "").toLowerCase().includes(keyword) ||
    getGuruStatus(d).toLowerCase().includes(keyword) ||
    (d.mata_pelajaran || "").toLowerCase().includes(keyword)
  );

  const totalPages = Math.max(1, Math.ceil(hasil.length / getGuruRowsPerPageValue()));
  currentPageGuru = Math.min(Math.max(1, page), totalPages);
  renderGuruFiltered();
}

function loadRealtimeGuru() {
  if (unsubscribeGuru) unsubscribeGuru();

  unsubscribeGuru = listenGuru(data => {
    ensureGuruStatusDefaults(data);
    ensureGuruNamaDefaults(data);
    semuaDataGuru = data.map(guru => ({
      ...guru,
      nama: normalizeGuruNamaValue(guru.nama),
      status: getGuruStatus(guru)
    }));
    renderGuruFiltered();
  });
}

async function ensureGuruNamaDefaults(data = []) {
  if (hasBackfilledGuruNama || isBackfillingGuruNama) return;
  const changedGuru = data.filter(guru =>
    String(guru?.kode_guru || "").trim() &&
    normalizeGuruNamaValue(guru.nama) !== String(guru?.nama || "").trim()
  );

  if (changedGuru.length === 0) {
    hasBackfilledGuruNama = true;
    return;
  }

  isBackfillingGuruNama = true;
  try {
    const batch = db.batch();
    changedGuru.forEach(guru => {
      const normalizedNama = normalizeGuruNamaValue(guru.nama);
      batch.set(db.collection("guru").doc(String(guru.kode_guru).trim()), {
        ...guru,
        nama: normalizedNama,
        nama_lengkap: [guru.gelar_depan, normalizedNama, guru.gelar_belakang]
          .map(value => String(value || "").trim())
          .filter(Boolean)
          .join(" "),
        updated_at: new Date()
      }, { merge: true });
    });
    await batch.commit();
    hasBackfilledGuruNama = true;
  } catch (error) {
    console.error("Gagal mengisi normalisasi nama guru", error);
  } finally {
    isBackfillingGuruNama = false;
  }
}

async function ensureGuruStatusDefaults(data = []) {
  if (hasBackfilledGuruStatus || isBackfillingGuruStatus) return;
  const missingStatus = data.filter(guru =>
    String(guru?.kode_guru || "").trim() &&
    String(guru?.status || "").trim() === ""
  );

  if (missingStatus.length === 0) {
    hasBackfilledGuruStatus = true;
    return;
  }

  isBackfillingGuruStatus = true;
  try {
    const batch = db.batch();
    missingStatus.forEach(guru => {
      const { id, ...guruData } = guru;
      batch.set(db.collection("guru").doc(String(guru.kode_guru).trim()), {
        ...guruData,
        status: "PNS",
        updated_at: new Date()
      });
    });
    await batch.commit();
    hasBackfilledGuruStatus = true;
  } catch (error) {
    console.error("Gagal mengisi default status guru", error);
  } finally {
    isBackfillingGuruStatus = false;
  }
}

function renderGuruFiltered() {
  const keyword = document.getElementById("searchGuru")?.value?.toLowerCase() || "";
  const hasil = sortGuruData(semuaDataGuru.filter(d =>
    (d.kode_guru || "").toLowerCase().includes(keyword) ||
    formatNamaGuru(d).toLowerCase().includes(keyword) ||
    (d.nip || "").toLowerCase().includes(keyword) ||
    getGuruStatus(d).toLowerCase().includes(keyword) ||
    (d.mata_pelajaran || "").toLowerCase().includes(keyword)
  ));

  const tbody = document.getElementById("tbodyGuru");
  const empty = document.getElementById("emptyStateGuru");
  const effectiveRowsPerPage = getGuruRowsPerPageValue();
  const totalPages = Math.max(1, Math.ceil(hasil.length / effectiveRowsPerPage));

  if (!tbody) return;

  if (currentPageGuru > totalPages) {
    currentPageGuru = totalPages;
  }

  const startIndex = (currentPageGuru - 1) * effectiveRowsPerPage;
  const pagedData = hasil.slice(startIndex, startIndex + effectiveRowsPerPage);

  tbody.innerHTML = pagedData.map(renderGuruRow).join("");

  if (empty) {
    empty.style.display = hasil.length === 0 ? "block" : "none";
  }

  const info = document.getElementById("jumlahDataGuru");
  if (info) {
    info.innerText = `${hasil.length} guru`;
  }

  renderPagination("tablePaginationGuru", currentPageGuru, totalPages, "setGuruPage");
  flushGuruRowFocus();
}

function handleGuruSearch() {
  clearTimeout(debounceGuru);
  debounceGuru = setTimeout(() => {
    currentPageGuru = 1;
    renderGuruFiltered();
  }, 300);
}

function resetGuruFilter() {
  const search = document.getElementById("searchGuru");
  const rows = document.getElementById("rowsPerPageGuru");
  if (search) search.value = "";
  if (rows) rows.value = "10";
  rowsPerPageGuru = 10;
  currentPageGuru = 1;
  renderGuruFiltered();
}

async function simpanGuruData() {
  if (isSubmittingGuru) return;
  if (!validateGuruForm()) return;

  const btn = document.getElementById("btnSimpanGuru");
  const kodeGuruEl = document.getElementById("kodeGuru");
  const namaGuruEl = document.getElementById("namaGuru");
  const gelarDepanEl = document.getElementById("gelarDepanGuru");
  const gelarBelakangEl = document.getElementById("gelarBelakangGuru");
  const nipGuruEl = document.getElementById("nipGuru");
  const statusGuruEl = document.getElementById("statusGuru");
  const mapelGuruEl = document.getElementById("mapelGuru");

  const data = {
    kode_guru: kodeGuruEl.value.trim(),
    nama: normalizeGuruNamaValue(namaGuruEl.value),
    gelar_depan: gelarDepanEl.value.trim(),
    gelar_belakang: gelarBelakangEl.value.trim(),
    nip: nipGuruEl.value.trim(),
    status: normalizeGuruStatus(statusGuruEl?.value || "PNS"),
    mata_pelajaran: mapelGuruEl.value.trim(),
    jp: 0,
    nama_lengkap: [gelarDepanEl.value.trim(), normalizeGuruNamaValue(namaGuruEl.value), gelarBelakangEl.value.trim()].filter(Boolean).join(" "),
    created_at: new Date()
  };

  try {
    isSubmittingGuru = true;

    if (btn) {
      btn.disabled = true;
      btn.innerText = "Menyimpan...";
    }

    await saveGuru(data);
    Swal.fire("Berhasil", "Data guru tersimpan", "success");

    kodeGuruEl.value = "";
    namaGuruEl.value = "";
    gelarDepanEl.value = "";
    gelarBelakangEl.value = "";
    nipGuruEl.value = "";
    if (statusGuruEl) statusGuruEl.value = "PNS";
    mapelGuruEl.value = "";
    populateGuruMapelSelect();

  } catch {
    Swal.fire("Gagal", "Data guru belum berhasil disimpan", "error");
  } finally {
    isSubmittingGuru = false;

    if (btn) {
      btn.disabled = false;
      btn.innerText = "Simpan Data Guru";
    }
  }
}

async function hapusGuru(kodeGuru) {
  const assignmentSnapshot = await db.collection("mengajar").where("guru_kode", "==", kodeGuru).get();
  if (!assignmentSnapshot.empty) {
    Swal.fire("Guru masih dipakai", "Hapus dulu pembagian mengajar guru ini sebelum menghapus data guru.", "warning");
    return;
  }

  const confirm = await Swal.fire({
    title: "Hapus data guru?",
    showCancelButton: true
  });

  if (!confirm.isConfirmed) return;
  await deleteGuru(kodeGuru);
}

async function startEditGuru(kodeGuru) {
  const guru = semuaDataGuru.find(item => item.kode_guru === kodeGuru);
  if (!guru) {
    Swal.fire("Data guru tidak ditemukan", "", "error");
    return;
  }

  try {
    await ensureGuruMapelOptions();
  } catch (error) {
    console.error(error);
  }

  currentEditGuru = kodeGuru;
  queueGuruRowFocus(kodeGuru, { focusInput: true });
  renderGuruFiltered();
}

function cancelEditGuru() {
  currentEditGuru = null;
  renderGuruFiltered();
}

async function saveGuruInline(kodeGuru) {
  const nama = normalizeGuruNamaValue(document.getElementById("inlineNamaGuru")?.value || "");
  const nip = document.getElementById("inlineNipGuru")?.value.trim() || "";
  const status = normalizeGuruStatus(document.getElementById("inlineStatusGuru")?.value || "PNS");
  const gelarDepan = document.getElementById("inlineGelarDepanGuru")?.value.trim() || "";
  const gelarBelakang = document.getElementById("inlineGelarBelakangGuru")?.value.trim() || "";
  const mataPelajaran = document.getElementById("inlineMapelGuru")?.value.trim() || "";

  if (!nama) {
    Swal.fire("Nama wajib diisi", "", "warning");
    return;
  }

  if (nama.length < 3) {
    Swal.fire("Nama minimal 3 karakter", "", "warning");
    return;
  }

  if (/^[0-9]+$/.test(nama)) {
    Swal.fire("Nama tidak boleh hanya angka", "", "warning");
    return;
  }

  if (nip && !/^[0-9]+$/.test(nip)) {
    Swal.fire("NIP harus berupa angka", "", "warning");
    return;
  }

  const duplicateNip = semuaDataGuru.some(item =>
    item.kode_guru !== kodeGuru &&
    String(item.nip || "").trim() !== "" &&
    String(item.nip || "").trim() === nip
  );

  if (duplicateNip) {
    Swal.fire("NIP sudah digunakan guru lain", "", "warning");
    return;
  }

  if (!mataPelajaran) {
    Swal.fire("Mata pelajaran wajib diisi", "", "warning");
    return;
  }

  const payload = {
    nama,
    nip,
    status,
    gelar_depan: gelarDepan,
    gelar_belakang: gelarBelakang,
    mata_pelajaran: mataPelajaran,
    nama_lengkap: [gelarDepan, nama, gelarBelakang].filter(Boolean).join(" "),
    updated_at: new Date()
  };

  try {
    await updateGuru(kodeGuru, payload);
    currentEditGuru = null;
    queueGuruRowFocus(kodeGuru);
    renderGuruFiltered();
    if (typeof showInlineSaveNotificationForData === "function") {
      showInlineSaveNotificationForData("data-guru-kode", kodeGuru, "Tersimpan");
    }
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Data guru belum berhasil diperbarui", "error");
  }
}

async function showGuruJPRiwayat(kodeGuru) {
  const guru = semuaDataGuru.find(item => item.kode_guru === kodeGuru);
  if (!guru) {
    Swal.fire("Data guru tidak ditemukan", "", "error");
    return;
  }

  try {
    const [mengajarSnapshot, mapelSnapshot] = await Promise.all([
      db.collection("mengajar").where("guru_kode", "==", kodeGuru).get(),
      db.collection("mapel").get()
    ]);

    const mapelLookup = new Map(
      mapelSnapshot.docs.map(doc => {
        const data = doc.data();
        return [String(data.kode_mapel || "").trim().toUpperCase(), Number(data.jp || 0)];
      })
    );

    const rows = mengajarSnapshot.docs
      .map(doc => doc.data())
      .map(item => ({
        kelas: item.kelas || buildKelasName(item.tingkat, item.rombel),
        mapel: item.mapel_nama || item.mapel_kode || "-",
        jp: mapelLookup.get(String(item.mapel_kode || "").trim().toUpperCase()) || 0
      }))
      .sort((a, b) => compareValues(a.kelas, b.kelas, "asc") || compareValues(a.mapel, b.mapel, "asc"));

    const totalJP = rows.reduce((sum, item) => sum + Number(item.jp || 0), 0);
    const tableRows = rows.map(item => `
      <tr>
        <td>${escapeGuruHtml(item.kelas)}</td>
        <td>${escapeGuruHtml(item.mapel)}</td>
        <td>${item.jp}</td>
      </tr>
    `).join("");

    await Swal.fire({
      title: `Riwayat JP ${escapeGuruHtml(formatNamaGuru(guru) || guru.kode_guru || "")}`,
      width: 720,
      html: rows.length > 0
        ? `
          <div class="guru-riwayat-summary">Total JP saat ini: <strong>${totalJP} JP</strong></div>
          <div class="table-container guru-riwayat-table">
            <table>
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th>Mapel</th>
                  <th>JP</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        `
        : `<div class="empty-panel">Belum ada pembagian mengajar untuk guru ini.</div>`,
      confirmButtonText: "Tutup"
    });
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Riwayat JP belum berhasil dimuat", "error");
  }
}

function renderGuruEditRow(d) {
  return `
    <tr class="table-edit-row guru-inline-edit-row" data-guru-kode="${escapeGuruHtml(d.kode_guru || "")}">
      <td>${escapeGuruHtml(d.kode_guru || "-")}</td>
      <td>
        <div class="guru-inline-grid">
          <input id="inlineNamaGuru" value="${escapeGuruHtml(d.nama || "")}" placeholder="Nama tanpa gelar">
          <div class="guru-inline-grid-two">
            <input id="inlineGelarDepanGuru" value="${escapeGuruHtml(d.gelar_depan || "")}" placeholder="Gelar depan">
            <input id="inlineGelarBelakangGuru" value="${escapeGuruHtml(d.gelar_belakang || "")}" placeholder="Gelar belakang">
          </div>
        </div>
      </td>
      <td><input id="inlineNipGuru" value="${escapeGuruHtml(d.nip || "")}" placeholder="NIP"></td>
      <td>
        <select id="inlineStatusGuru">
          ${renderGuruStatusOptions(d.status || "PNS")}
        </select>
      </td>
      <td>
        <select id="inlineMapelGuru">
          ${renderGuruMapelOptions(d.mata_pelajaran || "")}
        </select>
      </td>
      <td>
        <div class="guru-jp-readonly">${Number(d.jp || 0)} JP</div>
        <small class="swal-field-note">Otomatis</small>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn-primary btn-inline-mapel btn-table-compact" onclick="saveGuruInline('${d.kode_guru}')">Simpan</button>
          <button class="btn-secondary btn-inline-mapel btn-table-compact" onclick="cancelEditGuru()">Batal</button>
          <button class="btn-secondary btn-inline-mapel btn-table-compact" onclick="showGuruJPRiwayat('${d.kode_guru}')">Riwayat JP</button>
          <button class="btn-danger-lite btn-inline-mapel btn-table-compact" onclick="hapusGuru('${d.kode_guru}')">Hapus</button>
        </div>
      </td>
    </tr>
  `;
}

function renderGuruRow(d) {
  if (currentEditGuru === d.kode_guru) {
    return renderGuruEditRow(d);
  }

  return `
    <tr data-guru-kode="${escapeGuruHtml(d.kode_guru || "")}">
      <td>${d.kode_guru || "-"}</td>
      <td>${formatNamaGuru(d) || "-"}</td>
      <td>${d.nip || "-"}</td>
      <td>${getGuruStatus(d)}</td>
      <td>${d.mata_pelajaran || "-"}</td>
      <td>${Number(d.jp || 0)}</td>
      <td>
        <div class="table-actions">
          <button class="btn-secondary btn-inline-mapel btn-table-compact" onclick="startEditGuru('${d.kode_guru}')">Edit</button>
          <button class="btn-secondary btn-inline-mapel btn-table-compact" onclick="showGuruJPRiwayat('${d.kode_guru}')">Riwayat JP</button>
          <button class="btn-danger-lite btn-inline-mapel btn-table-compact" onclick="hapusGuru('${d.kode_guru}')">Hapus</button>
        </div>
      </td>
    </tr>
  `;
}
