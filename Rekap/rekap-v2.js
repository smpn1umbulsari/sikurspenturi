// ================= REKAP TUGAS DAN MENGAJAR =================
let semuaDataRekapGuru = [];
let semuaDataRekapMengajar = [];
let semuaDataRekapMapel = [];
let semuaDataRekapTugasTambahan = [];
let semuaDataRekapGuruTugasTambahan = [];
let unsubscribeRekapGuru = null;
let unsubscribeRekapMengajar = null;
let unsubscribeRekapMapel = null;
let unsubscribeRekapTugasTambahan = null;
let unsubscribeRekapGuruTugasTambahan = null;
let unsubscribeRekapBayanganGuru = null;
let unsubscribeRekapBayanganMengajar = null;
let unsubscribeRekapBayanganMengajarAsli = null;
let unsubscribeRekapBayanganMapel = null;

function escapeRekapHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getRekapSettings() {
  const activeSemester = typeof getActiveSemesterContext === "function"
    ? getActiveSemesterContext()
    : null;
  return {
    nomorSurat: localStorage.getItem("rekapNomorSurat") || "",
    tempatTtd: localStorage.getItem("rekapTempatTtd") || "Umbulsari",
    semester: String(activeSemester?.semester || "").trim() || "GENAP",
    tahunPelajaran: String(activeSemester?.tahun || "").trim() || "2025/2026",
    tanggalTtd: localStorage.getItem("rekapTanggalTtd") || ""
  };
}

function normalizeRekapRoleText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRekapKepalaSekolahTaskName(name) {
  const task = typeof name === "object" && name !== null
    ? name
    : { nama: name, id: "" };
  const taskId = String(task.id || "").trim().toUpperCase();
  const normalized = normalizeRekapRoleText(task.nama);
  return taskId === "KS" ||
    normalized.includes("kepala sekolah") ||
    normalized.includes("kepala satuan pendidikan");
}

function getRekapAssignmentTaskNames(assignment = {}) {
  const utama = getRekapTaskNames(assignment, ["utama_id"], ["utama_nama"]);
  const ekuivalen = getRekapTaskNames(
    assignment,
    ["ekuivalen_1_id", "ekuivalen_2_id", "ekuivalen_3_id"],
    ["ekuivalen_1_nama", "ekuivalen_2_nama", "ekuivalen_3_nama"]
  );
  const sekolah = getRekapTaskNames(
    assignment,
    ["sekolah_1_id", "sekolah_2_id", "sekolah_3_id"],
    ["sekolah_1_nama", "sekolah_2_nama", "sekolah_3_nama"],
    ["sekolah_id"],
    ["sekolah_nama"]
  );
  return [...utama.names, ...ekuivalen.names, ...sekolah.names];
}

function getRekapKepalaSekolahInfo() {
  const sortedAssignments = [...semuaDataRekapGuruTugasTambahan].sort((a, b) =>
    String(a.guru_kode || a.id || "").localeCompare(String(b.guru_kode || b.id || ""), undefined, { numeric: true, sensitivity: "base" })
  );
  const assignment = sortedAssignments.find(item =>
    getRekapAssignmentTaskNames(item).some(isRekapKepalaSekolahTaskName)
  );

  if (!assignment) {
    return { nama: "-", nip: "-", ditemukan: false };
  }

  const guruKode = String(assignment.guru_kode || assignment.id || "").trim();
  const guru = semuaDataRekapGuru.find(item => String(item.kode_guru || "").trim() === guruKode) || null;
  const nama = guru ? getRekapNamaGuru(guru) : String(assignment.guru_nama || "").trim();
  const nip = guru ? String(guru.nip || "").trim() : "";
  return {
    nama: nama || "-",
    nip: nip || "-",
    ditemukan: true
  };
}

function renderRekapSettingsPanel(settings) {
  const kepalaSekolah = getRekapKepalaSekolahInfo();
  return `
    <div class="rekap-settings-stack">
      <div class="rekap-letter-settings">
        <div class="form-group">
          <label for="rekapNomorSurat">Nomor Surat</label>
          <input id="rekapNomorSurat" value="${escapeRekapHtml(settings.nomorSurat)}" placeholder="Contoh: 800/001/35.09.20/2026" oninput="saveRekapSettings()">
        </div>
        <div class="form-group">
          <label for="rekapTempatTtd">Tempat TTD</label>
          <input id="rekapTempatTtd" value="${escapeRekapHtml(settings.tempatTtd || "Umbulsari")}" placeholder="Contoh: Umbulsari" oninput="saveRekapSettings()">
        </div>
        <div class="form-group">
          <label for="rekapTanggalTtd">Tanggal TTD</label>
          <input id="rekapTanggalTtd" type="date" value="${escapeRekapHtml(settings.tanggalTtd || "")}" oninput="saveRekapSettings()">
        </div>
      </div>
      <div class="rekap-term-panel">
        <span class="rekap-term-eyebrow">Semester Aktif</span>
        <div class="rekap-term-badges">
          <span class="rekap-term-badge">${escapeRekapHtml(settings.semester || "-")}</span>
          <span class="rekap-term-badge rekap-term-badge-muted">${escapeRekapHtml(settings.tahunPelajaran || "-")}</span>
        </div>
        <small>Semester dan tahun pelajaran mengikuti pengaturan semester aktif aplikasi.</small>
        <small>Kepala Satuan Pendidikan: <strong>${escapeRekapHtml(kepalaSekolah.nama)}</strong>${kepalaSekolah.nip !== "-" ? ` | NIP ${escapeRekapHtml(kepalaSekolah.nip)}` : ""}</small>
      </div>
    </div>
  `;
}

function formatRekapTanggalTtd(value = "") {
  const text = String(value || "").trim();
  if (!text) return "-";
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function renderRekapSignatureBlock(settings = getRekapSettings()) {
  const kepalaSekolah = getRekapKepalaSekolahInfo();
  const tempatTtd = String(settings.tempatTtd || "Umbulsari").trim() || "Umbulsari";
  return `
    <div class="rekap-signature-block">
      <div>${escapeRekapHtml(tempatTtd)}, ${escapeRekapHtml(formatRekapTanggalTtd(settings.tanggalTtd))}</div>
      <div>Kepala Satuan Pendidikan</div>
      <div class="rekap-signature-space"></div>
      <div class="rekap-signature-name">${escapeRekapHtml(kepalaSekolah.nama)}</div>
      <div>NIP ${escapeRekapHtml(kepalaSekolah.nip)}</div>
    </div>
  `;
}

function renderRekapTugasMengajarPage() {
  const settings = getRekapSettings();
  return `
    <div class="card rekap-card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Rekap</span>
          <h2>Rekap Tugas dan Mengajar</h2>
          <p>Format lampiran surat resmi untuk tugas mengajar dan tugas tambahan.</p>
        </div>
      </div>

      ${renderRekapSettingsPanel(settings)}

      <div class="toolbar-info rekap-toolbar">
        <span id="rekapTugasMengajarInfo">Memuat data rekap...</span>
        <div class="table-actions">
          <button class="btn-secondary" onclick="exportRekapTugasMengajarPdf()">Export PDF</button>
          <button class="btn-secondary" onclick="exportRekapTugasMengajarExcel()">Export Excel</button>
        </div>
      </div>

      <div id="rekapTugasMengajarContainer"></div>
    </div>
  `;
}

function renderRekapTugasMengajarBayanganPage() {
  const settings = getRekapSettings();
  return `
    <div class="card rekap-card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Kelas Real</span>
          <h2>Rekap Tugas Mengajar Kelas Real</h2>
          <p>Format lampiran surat resmi berdasarkan pembagian mengajar kelas real.</p>
        </div>
      </div>

      ${renderRekapSettingsPanel(settings)}

      <div class="toolbar-info rekap-toolbar">
        <span id="rekapTugasMengajarBayanganInfo">Memuat data rekap kelas real...</span>
        <div class="table-actions">
          <button class="btn-secondary" onclick="exportRekapTugasMengajarBayanganPdf()">Export PDF</button>
          <button class="btn-secondary" onclick="exportRekapTugasMengajarBayanganExcel()">Export Excel</button>
        </div>
      </div>

      <div id="rekapTugasMengajarBayanganContainer"></div>
    </div>
  `;
}

function saveRekapSettings() {
  localStorage.setItem("rekapNomorSurat", document.getElementById("rekapNomorSurat")?.value || "");
  localStorage.setItem("rekapTempatTtd", document.getElementById("rekapTempatTtd")?.value || "Umbulsari");
  localStorage.setItem("rekapTanggalTtd", document.getElementById("rekapTanggalTtd")?.value || "");
}

function loadRealtimeRekapTugasMengajar() {
  if (unsubscribeRekapGuru) unsubscribeRekapGuru();
  if (unsubscribeRekapMengajar) unsubscribeRekapMengajar();
  if (unsubscribeRekapMapel) unsubscribeRekapMapel();
  if (unsubscribeRekapTugasTambahan) unsubscribeRekapTugasTambahan();
  if (unsubscribeRekapGuruTugasTambahan) unsubscribeRekapGuruTugasTambahan();

  unsubscribeRekapGuru = listenGuru(data => {
    semuaDataRekapGuru = data;
    renderRekapTugasMengajarTable();
  });

  unsubscribeRekapMengajar = listenMengajar(data => {
    semuaDataRekapMengajar = data;
    renderRekapTugasMengajarTable();
  });

  unsubscribeRekapMapel = listenMapel(data => {
    semuaDataRekapMapel = data;
    renderRekapTugasMengajarTable();
  });

  unsubscribeRekapTugasTambahan = db.collection("tugas_tambahan").onSnapshot(snapshot => {
    semuaDataRekapTugasTambahan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderRekapTugasMengajarTable();
  });

  unsubscribeRekapGuruTugasTambahan = db.collection("guru_tugas_tambahan").onSnapshot(snapshot => {
    semuaDataRekapGuruTugasTambahan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderRekapTugasMengajarTable();
  });
}

function loadRealtimeRekapTugasMengajarBayangan() {
  if (unsubscribeRekapBayanganGuru) unsubscribeRekapBayanganGuru();
  if (unsubscribeRekapBayanganMengajar) unsubscribeRekapBayanganMengajar();
  if (unsubscribeRekapBayanganMengajarAsli) unsubscribeRekapBayanganMengajarAsli();
  if (unsubscribeRekapBayanganMapel) unsubscribeRekapBayanganMapel();

  unsubscribeRekapBayanganGuru = listenGuru(data => {
    semuaDataRekapGuru = data;
    renderRekapTugasMengajarBayanganTable();
  });

  unsubscribeRekapBayanganMengajar = listenMengajarBayangan(data => {
    semuaDataMengajarBayangan = data;
    renderRekapTugasMengajarBayanganTable();
  });

  unsubscribeRekapBayanganMengajarAsli = listenMengajar(data => {
    semuaDataMengajarBayanganAsli = data;
    renderRekapTugasMengajarBayanganTable();
  });

  unsubscribeRekapBayanganMapel = listenMapelBayangan(data => {
    semuaDataRekapMapel = data;
    renderRekapTugasMengajarBayanganTable();
  });
}

function renderRekapTugasMengajarTable() {
  const container = document.getElementById("rekapTugasMengajarContainer");
  const info = document.getElementById("rekapTugasMengajarInfo");
  if (!container) return;

  const rows = buildRekapTugasMengajarRows();
  if (info) {
    info.innerText = `${semuaDataRekapGuru.length} guru | ${rows.length} baris mapel | ${semuaDataRekapGuruTugasTambahan.length} data tugas tambahan`;
  }

  if (semuaDataRekapGuru.length === 0) {
    container.innerHTML = `<div class="empty-panel">Belum ada data guru untuk direkap.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="rekap-print-sheet">
      ${renderRekapLetterHeader()}
      ${renderRekapTableHtml(rows)}
      ${renderRekapSignatureBlock()}
    </div>
  `;
}

function renderRekapTugasMengajarBayanganTable() {
  const container = document.getElementById("rekapTugasMengajarBayanganContainer");
  const info = document.getElementById("rekapTugasMengajarBayanganInfo");
  if (!container) return;

  const rows = buildRekapTugasMengajarBayanganRows();
  if (info) {
    info.innerText = `${semuaDataRekapGuru.length} guru | ${rows.length} baris mapel kelas real`;
  }

  if (semuaDataRekapGuru.length === 0) {
    container.innerHTML = `<div class="empty-panel">Belum ada data guru untuk direkap.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="rekap-print-sheet">
      ${renderRekapLetterHeader("Pembagian Tugas Mengajar Kelas Real", "Daftar Nama Guru dan Tugas Mengajar Kelas Real")}
      ${renderRekapMengajarOnlyTableHtml(rows)}
      ${renderRekapSignatureBlock()}
    </div>
  `;
}

function renderRekapLetterHeader(tentang = "Pembagian Tugas Mengajar dan Tugas Tambahan", judul = "Daftar Nama Guru dan Tugas Mengajar serta Tugas Tambahan") {
  const settings = getRekapSettings();
  return `
    <div class="rekap-letter-head">
      <div>Lampiran 1</div>
      <div>Keputusan Kepala SMP Negeri 1 Umbulsari</div>
      <div>Nomor : ${escapeRekapHtml(settings.nomorSurat || "-")}</div>
      <div>Tentang : ${escapeRekapHtml(tentang)}</div>
      <div>Semester ${escapeRekapHtml(settings.semester || "-")} Tahun Pelajaran ${escapeRekapHtml(settings.tahunPelajaran || "-")}</div>
      <h3>${escapeRekapHtml(judul)}</h3>
    </div>
  `;
}

function renderRekapTableHtml(rows) {
  return `
    <div class="table-container rekap-table-wrap">
      <table class="rekap-table">
        <thead>
          <tr>
            <th rowspan="2">No</th>
            <th rowspan="2">Nama Guru</th>
            <th rowspan="2">Mapel</th>
            <th colspan="7">Tugas Mengajar</th>
            <th colspan="3">Tugas Tambahan</th>
            <th rowspan="2">Total JP</th>
          </tr>
          <tr>
            <th>7</th>
            <th>JP</th>
            <th>8</th>
            <th>JP</th>
            <th>9</th>
            <th>JP</th>
            <th>Total</th>
            <th>Utama</th>
            <th>Ekuivalen</th>
            <th>Sekolah</th>
          </tr>
        </thead>
        ${renderRekapGroupedTableBodies(rows, renderRekapTableRow)}
      </table>
    </div>
  `;
}

function renderRekapMengajarOnlyTableHtml(rows) {
  return `
    <div class="table-container rekap-table-wrap">
      <table class="rekap-table rekap-table-mengajar-only">
        <thead>
          <tr>
            <th rowspan="2">No</th>
            <th rowspan="2">Nama Guru</th>
            <th rowspan="2">Mapel</th>
            <th colspan="7">Tugas Mengajar</th>
          </tr>
          <tr>
            <th>7</th>
            <th>JP</th>
            <th>8</th>
            <th>JP</th>
            <th>9</th>
            <th>JP</th>
            <th>Total</th>
          </tr>
        </thead>
        ${renderRekapGroupedTableBodies(rows, renderRekapMengajarOnlyTableRow)}
      </table>
    </div>
  `;
}

function renderRekapGroupedTableBodies(rows, renderRowFn) {
  const groups = [];
  let current = [];

  rows.forEach(row => {
    if (row.isFirstGuruRow && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(row);
  });

  if (current.length > 0) groups.push(current);

  return groups.map(group => `
    <tbody class="rekap-guru-group">
      ${group.map(renderRowFn).join("")}
    </tbody>
  `).join("");
}

function renderRekapTableRow(row) {
  const rowSpan = Math.max(1, Number(row.guruRowSpan || 1));
  return `
    <tr>
      ${row.isFirstGuruRow ? `<td class="rekap-number-cell" rowspan="${rowSpan}">${row.no}</td>` : ""}
      ${row.isFirstGuruRow ? `<td class="rekap-name-cell" rowspan="${rowSpan}">
        ${row.isFirstGuruRow ? `
          <strong>${escapeRekapHtml(row.namaGuru || "-")}</strong>
          <small>${row.nip ? `NIP. ${escapeRekapHtml(row.nip)}` : "-"}</small>
        ` : ""}
      </td>` : ""}
      <td class="rekap-mapel-cell">${escapeRekapHtml(row.mapelNama || "-")}</td>
      <td class="rekap-level-cell">${escapeRekapHtml(row.levels["7"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${formatRekapJp(row.levels["7"].jp)}</td>
      <td class="rekap-level-cell">${escapeRekapHtml(row.levels["8"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${formatRekapJp(row.levels["8"].jp)}</td>
      <td class="rekap-level-cell">${escapeRekapHtml(row.levels["9"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${formatRekapJp(row.levels["9"].jp)}</td>
      <td class="rekap-jp-cell rekap-total-mengajar-cell"><strong>${formatRekapJp(row.totalMengajarJp)}</strong></td>
      <td>${row.isFirstGuruRow ? renderRekapTaskList(row.tugas.utama) : ""}</td>
      <td>${row.isFirstGuruRow ? renderRekapTaskList(row.tugas.ekuivalen) : ""}</td>
      <td>${row.isFirstGuruRow ? renderRekapTaskList(row.tugas.sekolah) : ""}</td>
      <td class="rekap-total-jp">${row.isFirstGuruRow ? `${row.totalJp} JP` : ""}</td>
    </tr>
  `;
}

function renderRekapMengajarOnlyTableRow(row) {
  const rowSpan = Math.max(1, Number(row.guruRowSpan || 1));
  return `
    <tr>
      ${row.isFirstGuruRow ? `<td class="rekap-number-cell" rowspan="${rowSpan}">${row.no}</td>` : ""}
      ${row.isFirstGuruRow ? `<td class="rekap-name-cell" rowspan="${rowSpan}">
        ${row.isFirstGuruRow ? `
          <strong>${escapeRekapHtml(row.namaGuru || "-")}</strong>
          <small>${row.nip ? `NIP. ${escapeRekapHtml(row.nip)}` : "-"}</small>
        ` : ""}
      </td>` : ""}
      <td class="rekap-mapel-cell">${escapeRekapHtml(row.mapelNama || "-")}</td>
      <td class="rekap-level-cell">${escapeRekapHtml(row.levels["7"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${formatRekapJp(row.levels["7"].jp)}</td>
      <td class="rekap-level-cell">${escapeRekapHtml(row.levels["8"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${formatRekapJp(row.levels["8"].jp)}</td>
      <td class="rekap-level-cell">${escapeRekapHtml(row.levels["9"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${formatRekapJp(row.levels["9"].jp)}</td>
      <td class="rekap-jp-cell rekap-total-mengajar-cell"><strong>${formatRekapJp(row.totalMengajarJp)}</strong></td>
    </tr>
  `;
}

function buildRekapTugasMengajarRows() {
  const rows = [];
  getSortedRekapGuru()
    .filter(guru => !(typeof isGuruStatusGB === "function" ? isGuruStatusGB(guru) : String(guru.status || "").trim().toUpperCase() === "GB"))
    .forEach((guru, guruIndex) => {
    const guruKode = String(guru.kode_guru || "").trim();
    const mapelRows = getRekapMapelRowsForGuru(guruKode);
    const tugas = getRekapTugasTambahanSummary(guruKode);
    const totalMengajarJp = mapelRows.reduce((sum, row) => sum + row.totalMengajarJp, 0);
    const totalJp = totalMengajarJp + tugas.totalJp;
    const effectiveRows = mapelRows.length > 0 ? mapelRows : [createEmptyRekapMapelRow()];

    effectiveRows.forEach((mapelRow, mapelIndex) => {
      rows.push({
        ...mapelRow,
        no: guruIndex + 1,
        guruKode,
        namaGuru: getRekapNamaGuru(guru) || guruKode,
        nip: String(guru.nip || "").trim(),
        tugas,
        totalJp,
        isFirstGuruRow: mapelIndex === 0,
        guruRowSpan: effectiveRows.length
      });
    });
  });
  return rows;
}

function buildRekapTugasMengajarBayanganRows() {
  const effectiveAssignments = getEffectiveRekapMengajarBayanganAssignments();
  return buildRekapRowsFromAssignments(effectiveAssignments, false);
}

function buildRekapRowsFromAssignments(assignments, includeTugasTambahan = true) {
  const rows = [];
  getSortedRekapGuru().forEach((guru, guruIndex) => {
    const guruKode = String(guru.kode_guru || "").trim();
    const mapelRows = getRekapMapelRowsForGuruFromAssignments(guruKode, assignments);
    const tugas = includeTugasTambahan ? getRekapTugasTambahanSummary(guruKode) : { totalJp: 0, utama: { names: [] }, ekuivalen: { names: [] }, sekolah: { names: [] } };
    const totalMengajarJp = mapelRows.reduce((sum, row) => sum + row.totalMengajarJp, 0);
    const totalJp = totalMengajarJp + tugas.totalJp;
    const effectiveRows = mapelRows.length > 0 ? mapelRows : [createEmptyRekapMapelRow()];

    effectiveRows.forEach((mapelRow, mapelIndex) => {
      rows.push({
        ...mapelRow,
        no: guruIndex + 1,
        guruKode,
        namaGuru: getRekapNamaGuru(guru) || guruKode,
        nip: String(guru.nip || "").trim(),
        tugas,
        totalJp,
        isFirstGuruRow: mapelIndex === 0,
        guruRowSpan: effectiveRows.length
      });
    });
  });
  return rows;
}

function getEffectiveRekapMengajarBayanganAssignments() {
  const assignmentMap = new Map();
  semuaDataMengajarBayangan.forEach(item => {
    assignmentMap.set(makeMengajarBayanganDocId(item.tingkat, item.rombel, item.mapel_kode), { ...item, sumber: "kelas_bayangan" });
  });
  return [...assignmentMap.values()];
}

function createEmptyRekapMapelRow() {
  return {
    mapelKode: "",
    mapelNama: "-",
    levels: {
      "7": { kelas: "", jp: 0 },
      "8": { kelas: "", jp: 0 },
      "9": { kelas: "", jp: 0 }
    },
    totalMengajarJp: 0
  };
}

function getRekapMapelRowsForGuru(guruKode) {
  return getRekapMapelRowsForGuruFromAssignments(guruKode, semuaDataRekapMengajar);
}

function getRekapMapelRowsForGuruFromAssignments(guruKode, assignments) {
  const grouped = new Map();
  const seenAssignments = new Set();

  assignments.forEach(item => {
    if (String(item.guru_kode || "").trim() !== guruKode) return;
    const rawMapelKode = String(item.mapel_kode || "").trim();
    if (!rawMapelKode) return;

    const tingkat = String(item.tingkat || getRekapKelasParts(item).tingkat || "").trim();
    if (!["7", "8", "9"].includes(tingkat)) return;

    const rombel = String(item.rombel || getRekapKelasParts(item).rombel || "").trim().toUpperCase();
    if (!rombel) return;

    const mapel = getRekapMapel(rawMapelKode);
    if (!mapel) return;
    const mapelKode = getRekapMapelKode(rawMapelKode, mapel);
    const assignmentKey = `${guruKode}|${tingkat}|${rombel}|${mapelKode}`;
    if (seenAssignments.has(assignmentKey)) return;
    seenAssignments.add(assignmentKey);

    if (!grouped.has(mapelKode)) {
      grouped.set(mapelKode, {
        mapelKode,
        mapelNama: getRekapMapelNama(item, mapel, mapelKode),
        mapelUrutan: Number(mapel?.mapping ?? Number.MAX_SAFE_INTEGER),
        mapelJp: Number(mapel?.jp || 0),
        levels: {
          "7": { rombels: new Set(), jp: 0 },
          "8": { rombels: new Set(), jp: 0 },
          "9": { rombels: new Set(), jp: 0 }
        }
      });
    }

    const row = grouped.get(mapelKode);
    if (rombel) row.levels[tingkat].rombels.add(rombel);
    row.levels[tingkat].jp += Number(mapel?.jp || 0);
  });

  return [...grouped.values()]
    .sort((a, b) => {
      const orderResult = a.mapelUrutan - b.mapelUrutan;
      if (orderResult !== 0) return orderResult;
      return a.mapelKode.localeCompare(b.mapelKode, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(row => ({
      mapelKode: row.mapelKode,
      mapelNama: row.mapelNama,
      levels: {
        "7": { kelas: formatRekapRombelRanges([...row.levels["7"].rombels]), jp: row.levels["7"].jp },
        "8": { kelas: formatRekapRombelRanges([...row.levels["8"].rombels]), jp: row.levels["8"].jp },
        "9": { kelas: formatRekapRombelRanges([...row.levels["9"].rombels]), jp: row.levels["9"].jp }
      },
      totalMengajarJp: row.levels["7"].jp + row.levels["8"].jp + row.levels["9"].jp
    }));
}

function getSortedRekapGuru() {
  return [...semuaDataRekapGuru].sort((a, b) =>
    String(a.kode_guru || "").localeCompare(String(b.kode_guru || ""), undefined, { numeric: true, sensitivity: "base" })
  );
}

function getRekapNamaGuru(guru) {
  if (typeof formatNamaGuru === "function") return formatNamaGuru(guru);
  return [guru?.gelar_depan, guru?.nama, guru?.gelar_belakang]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function getRekapKelasParts(item) {
  const raw = String(item?.kelas || "").trim().toUpperCase();
  const match = raw.match(/^(\d+)\s*([A-Z]+)$/);
  if (!match) return { tingkat: "", rombel: "" };
  return { tingkat: match[1], rombel: match[2] };
}

function getRekapMapel(mapelKode) {
  const kode = String(mapelKode || "").trim().toUpperCase();
  return semuaDataRekapMapel.find(item =>
    String(item.kode_mapel || "").trim().toUpperCase() === kode ||
    String(item.id || "").trim().toUpperCase() === kode
  ) || null;
}

function getRekapMapelKode(rawMapelKode, mapel) {
  return String(mapel?.kode_mapel || mapel?.id || rawMapelKode || "").trim().toUpperCase();
}

function getRekapMapelNama(assignment, mapel, mapelKode) {
  const masterName = String(mapel?.nama_mapel || "").trim();
  if (masterName) return masterName;
  return mapelKode;
}

function formatRekapRombelRanges(rombels) {
  const clean = [...new Set(rombels.map(item => String(item || "").trim().toUpperCase()).filter(Boolean))];
  const singleLetters = clean
    .filter(item => /^[A-Z]$/.test(item))
    .sort((a, b) => a.localeCompare(b));
  const others = clean
    .filter(item => !/^[A-Z]$/.test(item))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  const ranges = [];
  let start = null;
  let previous = null;

  singleLetters.forEach(letter => {
    const code = letter.charCodeAt(0);
    if (!start) {
      start = letter;
      previous = letter;
      return;
    }
    if (code === previous.charCodeAt(0) + 1) {
      previous = letter;
      return;
    }
    ranges.push(start === previous ? start : `${start}-${previous}`);
    start = letter;
    previous = letter;
  });

  if (start) ranges.push(start === previous ? start : `${start}-${previous}`);
  return [...ranges, ...others].join(", ");
}

function formatRekapJp(value) {
  const number = Number(value || 0);
  return number > 0 ? String(number) : "-";
}

function getRekapTugasTambahanSummary(guruKode) {
  const assignment = semuaDataRekapGuruTugasTambahan.find(item =>
    String(item.guru_kode || item.id || "").trim() === String(guruKode || "").trim()
  ) || {};
  const utama = getRekapTaskNames(assignment, ["utama_id"], ["utama_nama"]);
  const ekuivalen = getRekapTaskNames(
    assignment,
    ["ekuivalen_1_id", "ekuivalen_2_id", "ekuivalen_3_id"],
    ["ekuivalen_1_nama", "ekuivalen_2_nama", "ekuivalen_3_nama"]
  );
  const sekolah = getRekapTaskNames(
    assignment,
    ["sekolah_1_id", "sekolah_2_id", "sekolah_3_id"],
    ["sekolah_1_nama", "sekolah_2_nama", "sekolah_3_nama"],
    ["sekolah_id"],
    ["sekolah_nama"]
  );

  return {
    utama,
    ekuivalen,
    sekolah,
    totalJp: Number.isFinite(Number(assignment.jp_tugas_tambahan))
      ? Number(assignment.jp_tugas_tambahan || 0)
      : calculateRekapTugasTambahanJp([...utama.ids, ...ekuivalen.ids, ...sekolah.ids])
  };
}

function getRekapTaskNames(assignment, idFields, nameFields, legacyIdFields = [], legacyNameFields = []) {
  const ids = [...new Set([...idFields, ...legacyIdFields]
    .map(field => String(assignment[field] || "").trim())
    .filter(Boolean))];
  const fallbackNames = [...nameFields, ...legacyNameFields]
    .map(field => String(assignment[field] || "").trim())
    .filter(Boolean);
  const names = ids.map((id, index) => {
    const item = getRekapTugasTambahanById(id);
    const nama = item?.nama || fallbackNames[index] || "";
    const jp = Number(item?.jp || 0);
    return {
      id,
      nama,
      jp
    };
  }).filter(Boolean);
  return {
    ids,
    names: names.filter(item => item.nama).filter((item, index, array) =>
      array.findIndex(candidate =>
        candidate.id === item.id &&
        candidate.nama === item.nama &&
        candidate.jp === item.jp
      ) === index
    )
  };
}

function getRekapTugasTambahanById(id) {
  return semuaDataRekapTugasTambahan.find(item => item.id === id) || null;
}

function calculateRekapTugasTambahanJp(ids) {
  return ids.reduce((sum, id) => sum + Number(getRekapTugasTambahanById(id)?.jp || 0), 0);
}

function formatRekapTaskBullet(task = "") {
  const rawTask = typeof task === "object" && task !== null
    ? task
    : { nama: task, jp: 0 };
  const text = String(rawTask.nama || "").trim();
  if (!text) return "";
  const jp = Number(rawTask.jp || 0);
  return `- ${text}${jp > 0 ? ` (${jp} JP)` : ""}`;
}

function renderRekapTaskList(taskGroup) {
  const names = Array.isArray(taskGroup) ? taskGroup : taskGroup.names || [];
  if (names.length === 0) return `<span class="muted-text">-</span>`;
  return `<div class="rekap-task-list">${names.map(name => `<span>${escapeRekapHtml(formatRekapTaskBullet(name))}</span>`).join("")}</div>`;
}

function exportRekapTugasMengajarExcel() {
  if (typeof XLSX === "undefined") {
    Swal.fire("Export Excel belum bisa dilakukan", "Library XLSX belum tersedia.", "warning");
    return;
  }

  saveRekapSettings();
  const settings = getRekapSettings();
  const kepalaSekolah = getRekapKepalaSekolahInfo();
  const rows = buildRekapTugasMengajarRows();
  const sheetRows = [
    ["Lampiran 1"],
    ["Keputusan Kepala SMP Negeri 1 Umbulsari"],
    [`Nomor : ${settings.nomorSurat || "-"}`],
    ["Tentang : Pembagian Tugas Mengajar dan Tugas Tambahan"],
    [`Semester ${settings.semester || "-"} Tahun Pelajaran ${settings.tahunPelajaran || "-"}`],
    [],
    ["Daftar Nama Guru dan Tugas Mengajar serta Tugas Tambahan"],
    [],
    ["No", "Nama Guru", "NIP", "Mapel", "Tugas Mengajar", "", "", "", "", "", "", "Tugas Tambahan", "", "", "Total JP"],
    ["", "", "", "", "7", "JP", "8", "JP", "9", "JP", "Total Mengajar", "Utama", "Ekuivalen", "Sekolah", ""],
    ...rows.map(row => [
      row.isFirstGuruRow ? row.no : "",
      row.isFirstGuruRow ? row.namaGuru : "",
      row.isFirstGuruRow ? row.nip || "-" : "",
      row.mapelNama || "-",
      row.levels["7"].kelas || "-",
      formatRekapJp(row.levels["7"].jp),
      row.levels["8"].kelas || "-",
      formatRekapJp(row.levels["8"].jp),
      row.levels["9"].kelas || "-",
      formatRekapJp(row.levels["9"].jp),
      formatRekapJp(row.totalMengajarJp),
      row.isFirstGuruRow ? row.tugas.utama.names.map(formatRekapTaskBullet).join("\n") || "-" : "",
      row.isFirstGuruRow ? row.tugas.ekuivalen.names.map(formatRekapTaskBullet).join("\n") || "-" : "",
      row.isFirstGuruRow ? row.tugas.sekolah.names.map(formatRekapTaskBullet).join("\n") || "-" : "",
      row.isFirstGuruRow ? `${row.totalJp} JP` : ""
    ]),
    [],
    ["", "", "", "", "", "", "", "", "", "", "", (settings.tempatTtd || "Umbulsari") + ", " + formatRekapTanggalTtd(settings.tanggalTtd)],
    ["", "", "", "", "", "", "", "", "", "", "", "Kepala Satuan Pendidikan"],
    [],
    ["", "", "", "", "", "", "", "", "", "", "", kepalaSekolah.nama || "-"],
    ["", "", "", "", "", "", "", "", "", "", "", `NIP ${kepalaSekolah.nip || "-"}`]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet["!merges"] = [
    { s: { r: 8, c: 0 }, e: { r: 9, c: 0 } },
    { s: { r: 8, c: 1 }, e: { r: 9, c: 1 } },
    { s: { r: 8, c: 2 }, e: { r: 9, c: 2 } },
    { s: { r: 8, c: 3 }, e: { r: 9, c: 3 } },
    { s: { r: 8, c: 4 }, e: { r: 8, c: 10 } },
    { s: { r: 8, c: 11 }, e: { r: 8, c: 13 } },
    { s: { r: 8, c: 14 }, e: { r: 9, c: 14 } }
  ];
  worksheet["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 9 }, { wch: 6 }, { wch: 9 }, { wch: 6 },
    { wch: 9 }, { wch: 6 }, { wch: 12 }, { wch: 28 }, { wch: 30 }, { wch: 30 }, { wch: 10 }
  ];
  for (let rowIndex = 10; rowIndex < 10 + rows.length; rowIndex += 1) {
    ["D", "L", "M", "N"].forEach(col => {
      const cell = worksheet[`${col}${rowIndex + 1}`];
      if (!cell) return;
      cell.s = {
        alignment: {
          wrapText: true,
          vertical: "top"
        }
      };
    });
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap");
  XLSX.writeFile(workbook, "rekap-tugas-dan-mengajar.xlsx");
}

function exportRekapTugasMengajarBayanganExcel() {
  if (typeof XLSX === "undefined") {
    Swal.fire("Export Excel belum bisa dilakukan", "Library XLSX belum tersedia.", "warning");
    return;
  }

  saveRekapSettings();
  const settings = getRekapSettings();
  const kepalaSekolah = getRekapKepalaSekolahInfo();
  const rows = buildRekapTugasMengajarBayanganRows();
  const sheetRows = [
    ["Lampiran 1"],
    ["Keputusan Kepala SMP Negeri 1 Umbulsari"],
    [`Nomor : ${settings.nomorSurat || "-"}`],
    ["Tentang : Pembagian Tugas Mengajar Kelas Real"],
    [`Semester ${settings.semester || "-"} Tahun Pelajaran ${settings.tahunPelajaran || "-"}`],
    [],
    ["Daftar Nama Guru dan Tugas Mengajar Kelas Real"],
    [],
    ["No", "Nama Guru", "NIP", "Mapel", "7", "JP", "8", "JP", "9", "JP", "Total Mengajar"],
    ...rows.map(row => [
      row.isFirstGuruRow ? row.no : "",
      row.isFirstGuruRow ? row.namaGuru : "",
      row.isFirstGuruRow ? row.nip || "-" : "",
      row.mapelNama || "-",
      row.levels["7"].kelas || "-",
      formatRekapJp(row.levels["7"].jp),
      row.levels["8"].kelas || "-",
      formatRekapJp(row.levels["8"].jp),
      row.levels["9"].kelas || "-",
      formatRekapJp(row.levels["9"].jp),
      formatRekapJp(row.totalMengajarJp)
    ]),
    [],
    ["", "", "", "", "", "", "", "", (settings.tempatTtd || "Umbulsari") + ", " + formatRekapTanggalTtd(settings.tanggalTtd)],
    ["", "", "", "", "", "", "", "", "Kepala Satuan Pendidikan"],
    [],
    ["", "", "", "", "", "", "", "", kepalaSekolah.nama || "-"],
    ["", "", "", "", "", "", "", "", `NIP ${kepalaSekolah.nip || "-"}`]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 9 }, { wch: 6 },
    { wch: 9 }, { wch: 6 }, { wch: 9 }, { wch: 6 }, { wch: 12 }
  ];
  for (let rowIndex = 8; rowIndex < 8 + rows.length; rowIndex += 1) {
    const cell = worksheet[`D${rowIndex + 1}`];
    if (!cell) continue;
    cell.s = {
      alignment: {
        wrapText: true,
        vertical: "top"
      }
    };
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Real");
  XLSX.writeFile(workbook, "rekap-tugas-mengajar-kelas-real.xlsx");
}

function exportRekapTugasMengajarPdf() {
  saveRekapSettings();
  const rows = buildRekapTugasMengajarRows();
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    Swal.fire("Popup diblokir", "Izinkan popup browser untuk export PDF.", "warning");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Rekap Tugas dan Mengajar</title>
        <style>
          @page { size: legal landscape; margin: 14mm; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
          .rekap-letter-head { font-size: 14px; line-height: 1.45; margin-bottom: 12px; }
          .rekap-letter-head h3 { margin: 14px 0 10px; text-align: center; text-transform: uppercase; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #111827; padding: 6px 7px; vertical-align: top; }
          tbody.rekap-guru-group { break-inside: avoid; page-break-inside: avoid; }
          tbody.rekap-guru-group tr { break-inside: avoid; page-break-inside: avoid; }
          th { text-align: center; font-weight: 700; }
          .rekap-number-cell, .rekap-jp-cell, .rekap-total-jp { text-align: center; white-space: nowrap; }
          .rekap-level-cell { text-align: left; white-space: nowrap; }
          .rekap-mapel-cell { white-space: normal; word-break: break-word; min-width: 150px; }
          .rekap-name-cell strong, .rekap-name-cell small { display: block; }
          .rekap-name-cell small { margin-top: 3px; font-size: 11px; }
          .rekap-task-list { display: grid; gap: 3px; }
          .rekap-signature-block { width: 280px; margin: 26px 0 0 auto; text-align: left; line-height: 1.6; font-size: 13px; }
          .rekap-signature-space { height: 60px; }
          .rekap-signature-name { font-weight: 700; }
          .muted-text { color: #111827; }
        </style>
      </head>
      <body>
        ${renderRekapLetterHeader()}
        ${renderRekapTableHtml(rows)}
        ${renderRekapSignatureBlock()}
        <script>
          window.onload = function() {
            window.print();
          };
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function exportRekapTugasMengajarBayanganPdf() {
  saveRekapSettings();
  const rows = buildRekapTugasMengajarBayanganRows();
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    Swal.fire("Popup diblokir", "Izinkan popup browser untuk export PDF.", "warning");
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Rekap Tugas Mengajar Kelas Real</title>
        <style>
          @page { size: legal landscape; margin: 14mm; }
          body { font-family: Arial, sans-serif; color: #111827; margin: 0; }
          .rekap-letter-head { font-size: 14px; line-height: 1.45; margin-bottom: 12px; }
          .rekap-letter-head h3 { margin: 14px 0 10px; text-align: center; text-transform: uppercase; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #111827; padding: 6px 7px; vertical-align: top; }
          tbody.rekap-guru-group { break-inside: avoid; page-break-inside: avoid; }
          tbody.rekap-guru-group tr { break-inside: avoid; page-break-inside: avoid; }
          th { text-align: center; font-weight: 700; }
          .rekap-number-cell, .rekap-jp-cell { text-align: center; white-space: nowrap; }
          .rekap-level-cell { text-align: left; white-space: nowrap; }
          .rekap-mapel-cell { white-space: normal; word-break: break-word; min-width: 150px; }
          .rekap-name-cell strong, .rekap-name-cell small { display: block; }
          .rekap-name-cell small { margin-top: 3px; font-size: 11px; }
          .rekap-signature-block { width: 280px; margin: 26px 0 0 auto; text-align: left; line-height: 1.6; font-size: 13px; }
          .rekap-signature-space { height: 60px; }
          .rekap-signature-name { font-weight: 700; }
        </style>
      </head>
      <body>
        ${renderRekapLetterHeader("Pembagian Tugas Mengajar Kelas Real", "Daftar Nama Guru dan Tugas Mengajar Kelas Real")}
        ${renderRekapMengajarOnlyTableHtml(rows)}
        ${renderRekapSignatureBlock()}
        <script>
          window.onload = function() {
            window.print();
          };
        <\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
