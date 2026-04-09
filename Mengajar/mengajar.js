// ================= STATE MENGAJAR =================
let semuaDataMengajar = [];
let unsubscribeMengajar = null;
let unsubscribeMengajarMapel = null;
let unsubscribeMengajarKelas = null;
let unsubscribeMengajarGuru = null;
let unsubscribeMengajarSiswa = null;
let unsubscribeMengajarGuruTugasTambahan = null;
let semuaDataGuruTugasTambahanMengajar = [];
let semuaDataSiswaMengajar = [];
let isMengajarSiswaLoaded = false;
let mengajarSelectedTingkat = "7";
let mengajarSearchDraft = "";
let mengajarSearchQuery = "";
let pendingMengajarChanges = {};
let currentMengajarRombels = [];
let currentMengajarMapels = [];
const MENGAJAR_GREEN_MIN_JP = 12;
const MENGAJAR_GREEN_MAX_JP = 28;
const MENGAJAR_WARN_MIN_JP = 29;
const MENGAJAR_WARN_MAX_JP = 36;
const MENGAJAR_DANGER_MIN_JP = 37;

function sortMapelUntukMengajar(data) {
  return [...data].sort((a, b) => {
    const mappingA = Number(a.mapping ?? Number.MAX_SAFE_INTEGER);
    const mappingB = Number(b.mapping ?? Number.MAX_SAFE_INTEGER);
    if (mappingA !== mappingB) return mappingA - mappingB;
    return compareValues(a.kode_mapel, b.kode_mapel, "asc");
  });
}

function getMengajarRombels() {
  return [...semuaDataKelas]
    .map(item => getStoredKelasParts(item))
    .filter(parts => parts.tingkat === mengajarSelectedTingkat && parts.rombel)
    .sort((a, b) => compareValues(a.rombel, b.rombel, "asc"));
}

function getMengajarMapels() {
  return sortMapelUntukMengajar(semuaDataMapel).filter(item => item.kode_mapel && item.nama_mapel);
}

function normalizeMengajarAgama(value = "") {
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

function normalizeMengajarKelasValue(value = "") {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function getMengajarMapelAgama(mapel = {}) {
  const explicit = normalizeMengajarAgama(mapel.agama);
  if (explicit) return explicit;

  const text = `${mapel.kode_mapel || ""} ${mapel.nama_mapel || ""}`.toLowerCase();
  return ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"]
    .find(agama => text.includes(agama.toLowerCase())) || "";
}

function escapeMengajarHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isMengajarMapelPabp(mapel = {}) {
  if (typeof getMapelIndukKode === "function" && getMapelIndukKode(mapel) === "PABP") return true;
  return /pabp|agama|budi pekerti/i.test(`${mapel.kode_mapel || ""} ${mapel.nama_mapel || ""}`);
}

function getMengajarAgamaSetForClass(tingkat, rombel) {
  const targetKelas = normalizeMengajarKelasValue(buildKelasName(tingkat, rombel));
  const result = new Set();

  semuaDataSiswaMengajar.forEach(siswa => {
    const siswaKelas = normalizeMengajarKelasValue(siswa.kelas);
    if (siswaKelas !== targetKelas) return;
    const agama = normalizeMengajarAgama(siswa.agama);
    if (agama) result.add(agama);
  });

  return result;
}

function isMengajarMapelApplicableForClass(mapel, tingkat, rombel) {
  if (!isMengajarMapelPabp(mapel)) return true;
  const agamaMapel = getMengajarMapelAgama(mapel);
  if (!agamaMapel) return true;
  if (!isMengajarSiswaLoaded) return true;
  return getMengajarAgamaSetForClass(tingkat, rombel).has(agamaMapel);
}

function getMengajarMapelDisabledReason(mapel, tingkat, rombel) {
  const agamaMapel = getMengajarMapelAgama(mapel);
  const kelas = buildKelasName(tingkat, rombel);
  if (!agamaMapel) return "";
  return `Tidak ada siswa beragama ${agamaMapel} di kelas ${kelas}`;
}

function getMengajarGurus() {
  return [...semuaDataGuru]
    .sort((a, b) => {
      const left = typeof getGuruSortName === "function" ? getGuruSortName(a) : formatNamaGuru(a);
      const right = typeof getGuruSortName === "function" ? getGuruSortName(b) : formatNamaGuru(b);
      return compareValues(left, right, "asc") || compareValues(formatNamaGuru(a), formatNamaGuru(b), "asc");
    });
}

function getMengajarAssignment(tingkat, rombel, mapelKode) {
  return semuaDataMengajar.find(item =>
    String(item.tingkat || "") === String(tingkat || "") &&
    String(item.rombel || "").toUpperCase() === String(rombel || "").toUpperCase() &&
    String(item.mapel_kode || "").toUpperCase() === String(mapelKode || "").toUpperCase()
  ) || null;
}

function getMengajarSelectValue(tingkat, rombel, mapelKode) {
  const docId = makeMengajarDocId(tingkat, rombel, mapelKode);
  if (Object.prototype.hasOwnProperty.call(pendingMengajarChanges, docId)) {
    return pendingMengajarChanges[docId].guru_kode ?? "";
  }
  return getMengajarAssignment(tingkat, rombel, mapelKode)?.guru_kode || "";
}

function normalizeGuruLookupText(value) {
  return String(value || "").trim().toLowerCase();
}

function getMengajarSearchGuruLabel(guru = {}) {
  return formatNamaGuru(guru) || guru.kode_guru || "-";
}

function getMengajarSearchGuruOptions(includeGb = true, selectedValue = "") {
  const normalizedSelected = String(selectedValue || "").trim();
  const options = ['<option value="">Pilih guru untuk dicari</option>'];

  getMengajarGurus()
    .filter(guru => includeGb || !(typeof isGuruStatusGB === "function" ? isGuruStatusGB(guru) : String(guru.status || "").trim().toUpperCase() === "GB"))
    .forEach(guru => {
      const value = String(guru.kode_guru || "").trim();
      if (!value) return;
      options.push(`<option value="${escapeMengajarHtml(value)}" ${value === normalizedSelected ? "selected" : ""}>${escapeMengajarHtml(getMengajarSearchGuruLabel(guru))}</option>`);
    });

  return options.join("");
}

function matchesMengajarGuruSearch(guruKode = "", query = "") {
  const left = String(guruKode || "").trim();
  const right = String(query || "").trim();
  return Boolean(left && right && left === right);
}

function getMengajarSearchGuruName(guruKode = "") {
  const guru = semuaDataGuru.find(item => String(item.kode_guru || "").trim() === String(guruKode || "").trim());
  return guru ? getMengajarSearchGuruLabel(guru) : guruKode || "-";
}

function getMengajarSearchMatchCount() {
  if (!mengajarSearchQuery) return 0;
  return currentMengajarMapels.reduce((total, mapel) =>
    total + currentMengajarRombels.reduce((rowTotal, parts) => {
      const guruKode = getMengajarSelectValue(mengajarSelectedTingkat, parts.rombel, mapel.kode_mapel);
      return rowTotal + (matchesMengajarGuruSearch(guruKode, mengajarSearchQuery) ? 1 : 0);
    }, 0), 0);
}

function updateMengajarSearchStatus() {
  const info = document.getElementById("mengajarSearchInfo");
  if (!info) return;

  if (!mengajarSearchQuery) {
    info.innerText = "Cari nama atau kode guru untuk menyorot posisi di matriks.";
    return;
  }

  const count = getMengajarSearchMatchCount();
  info.innerText = count > 0
    ? `${count} posisi ditemukan untuk ${getMengajarSearchGuruName(mengajarSearchQuery)}.`
    : `Tidak ada posisi untuk ${getMengajarSearchGuruName(mengajarSearchQuery)}.`;
}

function focusFirstMengajarSearchMatch() {
  if (!mengajarSearchQuery) return;
  requestAnimationFrame(() => {
    const firstMatch = document.querySelector("#mengajarMatrixContainer .mengajar-grid-search-match");
    if (!firstMatch) return;
    firstMatch.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  });
}

function handleMengajarSearchInput(value) {
  mengajarSearchDraft = String(value || "");
}

function handleMengajarSearchKeydown(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  submitMengajarSearch();
}

function submitMengajarSearch() {
  mengajarSearchQuery = String(mengajarSearchDraft || "").trim();
  renderMengajarMatrix();
  focusFirstMengajarSearchMatch();
}

function clearMengajarSearch() {
  mengajarSearchDraft = "";
  mengajarSearchQuery = "";
  const input = document.getElementById("mengajarSearchInput");
  if (input) input.value = "";
  renderMengajarMatrix();
}

function resolveGuruInput(value) {
  const input = normalizeGuruLookupText(value);
  if (!input) return null;

  return getMengajarGurus().find(guru => {
    const kode = normalizeGuruLookupText(guru.kode_guru);
    const nama = normalizeGuruLookupText(formatNamaGuru(guru));
    return input === kode || input === nama;
  }) || null;
}

function renderGuruOptionsMengajar(selectedValue = "") {
  const options = ['<option value="">Pilih</option>'];
  getMengajarGurus().forEach(guru => {
    const value = guru.kode_guru || "";
    const selected = value === selectedValue ? "selected" : "";
    options.push(`<option value="${value}" ${selected}>${formatNamaGuru(guru)}</option>`);
  });
  return options.join("");
}

function getMengajarGuruTitle(guruKode = "") {
  if (!guruKode) return "Belum dipilih";
  const guru = semuaDataGuru.find(item => item.kode_guru === guruKode);
  if (!guru) return guruKode;
  return `${guru.kode_guru || ""} - ${formatNamaGuru(guru)}`.trim();
}

function updateMengajarInfo() {
  const mapelCount = getMengajarMapels().length;
  const kelasCount = getMengajarRombels().length;
  const info = document.getElementById("jumlahMengajarInfo");
  const pending = document.getElementById("pendingMengajarInfo");
  if (info) info.innerText = `${mapelCount} mapel x ${kelasCount} kelas`;
  if (pending) pending.innerText = `${Object.keys(pendingMengajarChanges).length} perubahan belum disimpan`;
}

function getProjectedMengajarAssignments() {
  const prepared = Object.values(pendingMengajarChanges).map(item =>
    buildMengajarPayload(item.tingkat, item.rombel, item.mapel_kode, item.guru_input)
  );
  return projectMengajarAssignments(prepared.filter(item => !item.__error))
    .filter(item => {
      const mapel = semuaDataMapel.find(entry => String(entry.kode_mapel || "").trim().toUpperCase() === String(item.mapel_kode || "").trim().toUpperCase());
      return !mapel || isMengajarMapelApplicableForClass(mapel, item.tingkat, item.rombel);
    });
}

function getProjectedGuruJPTotals(assignments = getProjectedMengajarAssignments()) {
  const totals = new Map();

  assignments.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    const mapelKode = String(item.mapel_kode || "").trim().toUpperCase();
    if (!guruKode || !mapelKode) return;

    const mapel = semuaDataMapel.find(entry => String(entry.kode_mapel || "").trim().toUpperCase() === mapelKode);
    if (mapel && !isMengajarMapelApplicableForClass(mapel, item.tingkat, item.rombel)) return;
    const jp = Number(mapel?.jp || 0);
    totals.set(guruKode, (totals.get(guruKode) || 0) + jp);
  });

  semuaDataGuruTugasTambahanMengajar.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    if (!guruKode) return;
    totals.set(guruKode, (totals.get(guruKode) || 0) + Number(item.jp_tugas_tambahan || 0));
  });

  return totals;
}

function getGuruTugasTambahanJPTotals() {
  const totals = new Map();
  semuaDataGuruTugasTambahanMengajar.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    if (!guruKode) return;
    totals.set(guruKode, Number(item.jp_tugas_tambahan || 0));
  });
  return totals;
}

function getProjectedGuruOwnMapelJPTotals(assignments = getProjectedMengajarAssignments()) {
  const totals = new Map();

  assignments.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    const mapelKode = String(item.mapel_kode || "").trim().toUpperCase();
    if (!guruKode || !mapelKode) return;

    const guru = semuaDataGuru.find(entry => String(entry.kode_guru || "").trim() === guruKode);
    const mapel = semuaDataMapel.find(entry => String(entry.kode_mapel || "").trim().toUpperCase() === mapelKode);
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

function getGuruJPStatus(totalJP) {
  if (totalJP >= MENGAJAR_DANGER_MIN_JP) return "danger";
  if (totalJP >= MENGAJAR_WARN_MIN_JP && totalJP <= MENGAJAR_WARN_MAX_JP) return "warning";
  if (totalJP >= MENGAJAR_GREEN_MIN_JP && totalJP <= MENGAJAR_GREEN_MAX_JP) return "green";
  return "neutral";
}

function buildMengajarSummaryHtml(assignments = getProjectedMengajarAssignments()) {
  const totals = getProjectedGuruJPTotals(assignments);
  const ownMapelTotals = getProjectedGuruOwnMapelJPTotals(assignments);
  const tugasTambahanTotals = getGuruTugasTambahanJPTotals();
  const summary = getMengajarGurus()
    .map(guru => ({
      nama: formatNamaGuru(guru),
      kode: guru.kode_guru || "",
      jp: totals.get(guru.kode_guru || "") || 0,
      ownMapelJp: ownMapelTotals.get(guru.kode_guru || "") || 0,
      tugasTambahanJp: tugasTambahanTotals.get(guru.kode_guru || "") || 0,
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
        <strong>${item.nama || "-"}</strong>
        <span>${item.jp} JP | ${item.ownMapelJp} JP | +${item.tugasTambahanJp} JP</span>
      </div>
    </div>
  `).join("");

  return `
    <section class="mengajar-summary-panel">
      <div class="mengajar-summary-header">
        <div>
          <h3>Rekap JP Guru</h3>
          <p>Perubahan mengikuti pilihan dropdown saat ini, bahkan sebelum disimpan.</p>
        </div>
        <div class="mengajar-summary-badges">
          <span class="mengajar-summary-badge is-green">${greenCount} aman</span>
          <span class="mengajar-summary-badge is-warning">${warningCount} kuning</span>
          <span class="mengajar-summary-badge is-danger">${overloadCount} merah</span>
        </div>
      </div>
      <div class="mengajar-summary-rules">
        Format rekap: total JP | JP sesuai mapel guru | JP tugas tambahan. Hijau ${MENGAJAR_GREEN_MIN_JP}-${MENGAJAR_GREEN_MAX_JP} JP, Kuning ${MENGAJAR_WARN_MIN_JP}-${MENGAJAR_WARN_MAX_JP} JP, Merah >= ${MENGAJAR_DANGER_MIN_JP} JP
      </div>
      <div class="mengajar-jp-grid">
        ${items || '<div class="empty-panel">Belum ada guru yang bisa ditampilkan.</div>'}
      </div>
    </section>
  `;
}

function renderMengajarMatrix() {
  const container = document.getElementById("mengajarMatrixContainer");
  if (!container) return;

  const rombels = getMengajarRombels();
  const mapels = getMengajarMapels();
  const projectedAssignments = getProjectedMengajarAssignments();
  const projectedTotals = getProjectedGuruJPTotals(projectedAssignments);
  currentMengajarRombels = rombels;
  currentMengajarMapels = mapels;

  updateMengajarInfo();
  const summaryHtml = buildMengajarSummaryHtml(projectedAssignments);

  if (rombels.length === 0) {
    container.innerHTML = `
      <div class="empty-panel">Belum ada kelas untuk tingkat ${mengajarSelectedTingkat}.</div>
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

  const headCols = rombels.map(parts => `<th>${parts.rombel}</th>`).join("");
  const bodyRows = mapels.map(mapel => {
    const cells = rombels.map(parts => {
      const isApplicable = isMengajarMapelApplicableForClass(mapel, mengajarSelectedTingkat, parts.rombel);
      if (!isApplicable) {
        return `
          <td class="mengajar-grid-cell mengajar-grid-disabled">
            <select class="mengajar-cell-dropdown mengajar-cell-dropdown-disabled" title="${escapeMengajarHtml(getMengajarMapelDisabledReason(mapel, mengajarSelectedTingkat, parts.rombel))}" disabled>
              <option>-</option>
            </select>
          </td>
        `;
      }

      const value = getMengajarSelectValue(mengajarSelectedTingkat, parts.rombel, mapel.kode_mapel);
      const totalJP = value ? projectedTotals.get(value) || 0 : 0;
      const statusClass = value ? `mengajar-grid-${getGuruJPStatus(totalJP)}` : "";
      const searchClass = matchesMengajarGuruSearch(value, mengajarSearchQuery) ? "mengajar-grid-search-match" : "";
      return `
        <td class="mengajar-grid-cell ${statusClass} ${searchClass}" data-guru-kode="${escapeMengajarHtml(value)}">
          <select
            class="mengajar-cell-dropdown"
            title="${value ? `${getMengajarGuruTitle(value)} | ${totalJP} JP` : getMengajarGuruTitle(value)}"
            onchange="handleMengajarSelectChange('${mengajarSelectedTingkat}','${parts.rombel}','${mapel.kode_mapel}', this.value); this.title = getMengajarGuruTitle(this.value);"
          >
            ${renderGuruOptionsMengajar(value)}
          </select>
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td class="mengajar-mapel-cell">
          <strong>${mapel.kode_mapel}</strong>
        </td>
        ${cells}
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="table-container matrix-table-wrap">
      <table class="matrix-table">
        <thead>
          <tr>
            <th>Mapel</th>
            ${headCols}
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
    ${summaryHtml}
  `;
  updateMengajarSearchStatus();
}

function loadRealtimeMengajar() {
  if (unsubscribeMengajar) unsubscribeMengajar();
  if (unsubscribeMengajarMapel) unsubscribeMengajarMapel();
  if (unsubscribeMengajarKelas) unsubscribeMengajarKelas();
  if (unsubscribeMengajarGuru) unsubscribeMengajarGuru();
  if (unsubscribeMengajarSiswa) unsubscribeMengajarSiswa();
  if (unsubscribeMengajarGuruTugasTambahan) unsubscribeMengajarGuruTugasTambahan();
  isMengajarSiswaLoaded = false;

  unsubscribeMengajar = listenMengajar(data => {
    semuaDataMengajar = data;
    renderMengajarMatrix();
  });

  unsubscribeMengajarMapel = listenMapel(data => {
    semuaDataMapel = data;
    renderMengajarMatrix();
  });

  unsubscribeMengajarKelas = listenKelas(data => {
    semuaDataKelas = data;
    renderMengajarMatrix();
  });

  unsubscribeMengajarGuru = listenGuru(data => {
    semuaDataGuru = data;
    renderMengajarMatrix();
  });

  unsubscribeMengajarSiswa = listenSiswa(data => {
    semuaDataSiswaMengajar = data;
    isMengajarSiswaLoaded = true;
    renderMengajarMatrix();
  });

  unsubscribeMengajarGuruTugasTambahan = db.collection("guru_tugas_tambahan").onSnapshot(snapshot => {
    semuaDataGuruTugasTambahanMengajar = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMengajarMatrix();
  });
}

function setMengajarTingkat(value) {
  mengajarSelectedTingkat = value || "7";
  renderMengajarPageState();
}

function renderMengajarPageState() {
  const content = document.getElementById("content");
  if (!content) return;
  content.innerHTML = renderMengajarPage();
  renderMengajarMatrix();
}

function refreshMengajarPage() {
  loadRealtimeMengajar();
  renderMengajarMatrix();
}

async function syncMengajarAsliFromBayangan() {
  if (Object.keys(pendingMengajarChanges).length > 0) {
    Swal.fire("Masih ada perubahan", "Simpan atau refresh perubahan di matriks asli sebelum sinkron dari kelas bayangan.", "warning");
    return;
  }

  const confirm = await Swal.fire({
    title: "Sinkron dari Kelas Bayangan?",
    text: "Data kelas bayangan akan disalin ke pembagian mengajar asli. Guru berstatus GB tidak ikut disalin.",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sinkron",
    cancelButtonText: "Batal"
  });
  if (!confirm.isConfirmed) return;

  try {
    Swal.fire({ title: "Menyinkronkan pembagian mengajar...", didOpen: () => Swal.showLoading() });

    const [bayanganSnapshot, guruSnapshot, mapelSnapshot] = await Promise.all([
      db.collection("mengajar_bayangan").get(),
      db.collection("guru").get(),
      db.collection("mapel").get()
    ]);
    const guruRows = guruSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const guruByKode = new Map(guruRows.map(guru => [String(guru.kode_guru || guru.id || "").trim(), guru]));
    const mapelCodes = new Set(mapelSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return String(data.kode_mapel || doc.id || "").trim().toUpperCase();
      })
      .filter(Boolean));
    const batch = db.batch();
    let synced = 0;
    let skippedGb = 0;
    let skippedInvalid = 0;
    const syncedPayloads = [];

    bayanganSnapshot.docs.forEach(doc => {
      const item = doc.data();
      const tingkat = String(item.tingkat || "").trim();
      const rombel = String(item.rombel || "").trim().toUpperCase();
      const mapelKode = String(item.mapel_kode || "").trim().toUpperCase();
      const guruKode = String(item.guru_kode || "").trim();
      const guru = guruByKode.get(guruKode);

      if (!tingkat || !rombel || !mapelKode || !guruKode || !guru || !mapelCodes.has(mapelKode)) {
        skippedInvalid++;
        return;
      }

      if (typeof isGuruStatusGB === "function" ? isGuruStatusGB(guru) : String(guru.status || "").trim().toUpperCase() === "GB") {
        skippedGb++;
        return;
      }

      const payload = {
        ...item,
        tingkat,
        rombel,
        kelas: buildKelasName(tingkat, rombel),
        mapel_kode: mapelKode,
        guru_kode: guruKode,
        guru_nama: formatNamaGuru(guru),
        guru_nip: guru.nip || "",
        sumber: "sync_kelas_bayangan",
        synced_at: new Date(),
        updated_at: new Date()
      };
      batch.set(db.collection("mengajar").doc(makeMengajarDocId(tingkat, rombel, mapelKode)), payload);
      syncedPayloads.push(payload);
      synced++;
    });

    if (synced > 0) await batch.commit();
    if (syncedPayloads.length > 0) {
      await syncGuruJPFromAssignments(projectMengajarAssignments(syncedPayloads));
    }

    Swal.fire("Sinkron selesai", `Tersalin: ${synced}<br>Dilewati status GB: ${skippedGb}<br>Dilewati tidak valid: ${skippedInvalid}`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Sinkron dari kelas bayangan belum berhasil.", "error");
  }
}

function handleMengajarSelectChange(tingkat, rombel, mapelKode, guruKode) {
  const mapel = semuaDataMapel.find(item => String(item.kode_mapel || "").trim().toUpperCase() === String(mapelKode || "").trim().toUpperCase());
  if (mapel && !isMengajarMapelApplicableForClass(mapel, tingkat, rombel)) return;

  const docId = makeMengajarDocId(tingkat, rombel, mapelKode);
  const guru = semuaDataGuru.find(item => item.kode_guru === guruKode);
  pendingMengajarChanges[docId] = {
    tingkat,
    rombel,
    mapel_kode: mapelKode,
    guru_kode: guruKode,
    guru_input: guru ? formatNamaGuru(guru) : ""
  };
  renderMengajarMatrix();
}

function buildMengajarPayload(tingkat, rombel, mapelKode, rawInput) {
  const mapel = semuaDataMapel.find(item => item.kode_mapel === mapelKode);
  const guru = resolveGuruInput(rawInput);
  const cleanInput = String(rawInput || "").trim();

  if (!cleanInput) {
    return {
      __delete: true,
      tingkat,
      rombel,
      mapel_kode: mapelKode
    };
  }

  if (!guru) {
    return {
      __error: `Guru tidak dikenali untuk ${mapel?.nama_mapel || mapelKode} kelas ${buildKelasName(tingkat, rombel)}: ${cleanInput}`
    };
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
    updated_at: new Date()
  };
}

function projectMengajarAssignments(preparedChanges = []) {
  const assignmentMap = new Map(
    semuaDataMengajar.map(item => [
      makeMengajarDocId(item.tingkat, item.rombel, item.mapel_kode),
      { ...item }
    ])
  );

  preparedChanges.forEach(item => {
    const docId = makeMengajarDocId(item.tingkat, item.rombel, item.mapel_kode);
    if (item.__delete) {
      assignmentMap.delete(docId);
      return;
    }

    assignmentMap.set(docId, {
      ...assignmentMap.get(docId),
      ...item
    });
  });

  return Array.from(assignmentMap.values());
}

async function syncGuruJPFromAssignments(assignments = semuaDataMengajar) {
  const totals = new Map();

  assignments.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    const mapelKode = String(item.mapel_kode || "").trim().toUpperCase();
    if (!guruKode || !mapelKode) return;

    const mapel = semuaDataMapel.find(entry => String(entry.kode_mapel || "").trim().toUpperCase() === mapelKode);
    if (mapel && !isMengajarMapelApplicableForClass(mapel, item.tingkat, item.rombel)) return;
    const jp = Number(mapel?.jp || 0);
    totals.set(guruKode, (totals.get(guruKode) || 0) + jp);
  });

  semuaDataGuruTugasTambahanMengajar.forEach(item => {
    const guruKode = String(item.guru_kode || "").trim();
    if (!guruKode) return;
    totals.set(guruKode, (totals.get(guruKode) || 0) + Number(item.jp_tugas_tambahan || 0));
  });

  const batch = db.batch();
  semuaDataGuru.forEach(guru => {
    const guruKode = String(guru.kode_guru || "").trim();
    if (!guruKode) return;
    const nextJP = totals.get(guruKode) || 0;
    const currentJP = Number(guru.jp || 0) || 0;
    if (currentJP === nextJP) return;

    const { id, ...guruData } = guru;
    batch.set(
      db.collection("guru").doc(guruKode),
      {
        ...guruData,
        jp: nextJP,
        updated_at: new Date()
      }
    );
  });

  await batch.commit();
}

async function saveAllMengajar() {
  const changes = Object.values(pendingMengajarChanges);
  if (changes.length === 0) {
    Swal.fire("Tidak ada perubahan", "Pilih guru terlebih dahulu atau ubah matriks yang sudah ada.", "info");
    return;
  }

  try {
    const prepared = changes.map(item => buildMengajarPayload(item.tingkat, item.rombel, item.mapel_kode, item.guru_input));
    const invalid = prepared.filter(item => item.__error);
    if (invalid.length > 0) {
      Swal.fire("Ada guru yang belum cocok", invalid.slice(0, 5).map(item => item.__error).join("<br>"), "warning");
      return;
    }

    Swal.fire({ title: "Menyimpan pembagian mengajar...", didOpen: () => Swal.showLoading() });

    const batch = db.batch();
    let simpan = 0;
    let hapus = 0;

    prepared.forEach(item => {
      const ref = db.collection("mengajar").doc(makeMengajarDocId(item.tingkat, item.rombel, item.mapel_kode));
      if (item.__delete) {
        batch.delete(ref);
        hapus++;
      } else {
        const existing = getMengajarAssignment(item.tingkat, item.rombel, item.mapel_kode);
        batch.set(ref, {
          ...item,
          created_at: existing?.created_at || new Date()
        });
        simpan++;
      }
    });

    await batch.commit();
    await syncGuruJPFromAssignments(projectMengajarAssignments(prepared));
    pendingMengajarChanges = {};
    updateMengajarInfo();

    Swal.fire("Berhasil", `Tersimpan: ${simpan}, Dihapus: ${hapus}`, "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal", "Pembagian mengajar belum berhasil disimpan", "error");
  }
}

function downloadMengajarTemplate() {
  const worksheet = XLSX.utils.aoa_to_sheet([[
    "TINGKAT",
    "ROMBEL",
    "MAPEL_KODE",
    "GURU_KODE"
  ]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "template-import-pembagian-mengajar.xlsx");
}

function normalizeMengajarHeader(text) {
  return String(text || "").trim().toUpperCase().replace(/\s+/g, "_");
}

function getMengajarCellValue(row, aliases) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeMengajarHeader(key), value])
  );

  for (const alias of aliases) {
    const value = normalizedRow[normalizeMengajarHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function importMengajarExcel(event) {
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
        const tingkat = String(getMengajarCellValue(row, ["TINGKAT"])).trim();
        const rombel = String(getMengajarCellValue(row, ["ROMBEL", "KELAS"])).trim().toUpperCase();
        const mapelKode = String(getMengajarCellValue(row, ["MAPEL_KODE", "KODE_MAPEL"])).trim().toUpperCase();
        const guruKode = String(getMengajarCellValue(row, ["GURU_KODE", "KODE_GURU"])).trim();
        const mapel = semuaDataMapel.find(item => item.kode_mapel === mapelKode);
        const guru = semuaDataGuru.find(item => item.kode_guru === guruKode);
        const kelas = buildKelasName(tingkat, rombel);
        const kelasExists = semuaDataKelas.some(item => getStoredKelasParts(item).kelas === kelas);
        const mapelApplicable = mapel ? isMengajarMapelApplicableForClass(mapel, tingkat, rombel) : false;

        return {
          tingkat,
          rombel,
          kelas,
          mapel_kode: mapelKode,
          mapel_nama: mapel?.nama_mapel || "",
          guru_kode: guruKode,
          guru_nama: guru ? formatNamaGuru(guru) : "",
          guru_nip: guru?.nip || "",
          __valid: Boolean(tingkat && rombel && mapel && guru && kelasExists && mapelApplicable)
        };
      }).filter(item => item.tingkat || item.rombel || item.mapel_kode || item.guru_kode);

      const validRows = parsed.filter(item => item.__valid);
      const invalidRows = parsed.length - validRows.length;

      if (validRows.length === 0) {
        event.target.value = "";
        Swal.fire("Import pembagian gagal", "Tidak ada data valid yang bisa diimport.", "error");
        return;
      }

      const confirm = await Swal.fire({
        title: "Import Pembagian Mengajar",
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

      Swal.fire({ title: "Mengimport pembagian...", didOpen: () => Swal.showLoading() });

      let berhasil = 0;
      let gagal = 0;
      const importedRows = [];

      for (const item of validRows) {
        try {
          const existing = getMengajarAssignment(item.tingkat, item.rombel, item.mapel_kode);
          await saveMengajar({
            tingkat: item.tingkat,
            rombel: item.rombel,
            kelas: item.kelas,
            mapel_kode: item.mapel_kode,
            mapel_nama: item.mapel_nama,
            guru_kode: item.guru_kode,
            guru_nama: item.guru_nama,
            guru_nip: item.guru_nip,
            created_at: existing?.created_at || new Date(),
            updated_at: new Date()
          });
          berhasil++;
          importedRows.push(item);
        } catch (error) {
          console.error(error);
          gagal++;
        }
      }

      await syncGuruJPFromAssignments(projectMengajarAssignments(importedRows));

      Swal.fire("Import selesai", `Berhasil: ${berhasil}, Gagal: ${gagal}, Tidak valid: ${invalidRows}`, "success");
    } catch (error) {
      console.error(error);
      Swal.fire("Gagal membaca file pembagian mengajar", "", "error");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsArrayBuffer(file);
}

if (!window.__mengajarSelectionBound) {
  window.__mengajarSelectionBound = true;
}
