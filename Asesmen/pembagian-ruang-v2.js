// ================= STATE ASESMEN =================
let semuaDataAsesmenSiswa = [];
let unsubscribeAsesmenSiswa = null;
let jumlahRuangUjian = Number(localStorage.getItem("asesmenJumlahRuangUjian") || 1);
let draftJumlahRuangUjian = jumlahRuangUjian;
let pembagianKelasAsesmen = localStorage.getItem("asesmenPembagianKelas") === "manual" ? "manual" : "setengah";
let draftPembagianKelasAsesmen = pembagianKelasAsesmen;
const asesmenLevelSettings = {
  7: { mode: pembagianKelasAsesmen, order: "az", roomRanges: [{ start: "", end: "" }, { start: "", end: "" }], manualCounts: [] },
  8: { mode: pembagianKelasAsesmen, order: "az", roomRanges: [{ start: "", end: "" }, { start: "", end: "" }], manualCounts: [] },
  9: { mode: pembagianKelasAsesmen, order: "az", roomRanges: [{ start: "", end: "" }, { start: "", end: "" }], manualCounts: [] }
};
const draftAsesmenLevelSettings = {
  7: cloneAsesmenLevelSettings(asesmenLevelSettings[7]),
  8: cloneAsesmenLevelSettings(asesmenLevelSettings[8]),
  9: cloneAsesmenLevelSettings(asesmenLevelSettings[9])
};
const appliedAsesmenLevels = new Set();

function cloneAsesmenLevelSettings(settings) {
  return {
    mode: settings.mode,
    order: settings.order,
    roomRanges: settings.roomRanges.map(range => ({ ...range })),
    manualCounts: [...settings.manualCounts]
  };
}

function syncAsesmenManualCountLength(settings) {
  while (settings.manualCounts.length < jumlahRuangUjian) settings.manualCounts.push("");
  if (settings.manualCounts.length > jumlahRuangUjian) settings.manualCounts.length = jumlahRuangUjian;
}

function isAsesmenLevelApplied(level) {
  return appliedAsesmenLevels.has(String(level));
}

function escapeAsesmenHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asesmenCompare(left, right, direction = "asc") {
  const result = String(left ?? "").trim().localeCompare(String(right ?? "").trim(), undefined, {
    numeric: true,
    sensitivity: "base"
  });
  return direction === "asc" ? result : -result;
}

function getAsesmenKelasParts(kelasValue = "") {
  const normalized = String(kelasValue || "").trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/([7-9])([A-Z]+)$/);
  return {
    tingkat: match ? match[1] : "",
    rombel: match ? match[2] : "",
    kelas: match ? `${match[1]} ${match[2]}` : String(kelasValue || "").trim().toUpperCase()
  };
}

function isAsesmenRombelBayanganUtama(rombel) {
  return /^[A-H]$/.test(String(rombel || "").trim().toUpperCase());
}

function isAsesmenSiswaTambahanBayangan(siswa) {
  const kelasAsli = String(siswa?.asliKelasParts?.kelas || siswa?.kelas || "").trim().toUpperCase();
  const kelasAcuan = String(siswa?.kelasParts?.kelas || "").trim().toUpperCase();
  return Boolean(kelasAsli && kelasAcuan && kelasAsli !== kelasAcuan);
}

function compareAsesmenSiswaDalamKelas(a, b) {
  const tambahanA = isAsesmenSiswaTambahanBayangan(a) ? 1 : 0;
  const tambahanB = isAsesmenSiswaTambahanBayangan(b) ? 1 : 0;
  if (tambahanA !== tambahanB) return tambahanA - tambahanB;
  return asesmenCompare(a.nama, b.nama, "asc");
}

function getAsesmenKelasBayanganParts(siswa) {
  const asliParts = getAsesmenKelasParts(siswa.kelas);
  const bayanganParts = getAsesmenKelasParts(siswa.kelas_bayangan);

  if (bayanganParts.tingkat === asliParts.tingkat && isAsesmenRombelBayanganUtama(bayanganParts.rombel)) {
    return bayanganParts;
  }

  if (isAsesmenRombelBayanganUtama(asliParts.rombel)) {
    return asliParts;
  }

  return { tingkat: asliParts.tingkat, rombel: "", kelas: "" };
}

function getAsesmenStudentsByLevel(level) {
  return semuaDataAsesmenSiswa
    .map(siswa => {
      const asliKelasParts = getAsesmenKelasParts(siswa.kelas);
      const kelasParts = getAsesmenKelasBayanganParts(siswa);
      return { ...siswa, asliKelasParts, kelasParts };
    })
    .filter(siswa => siswa.kelasParts.tingkat === String(level) && siswa.kelasParts.rombel)
    .sort((a, b) => {
      const kelasResult = asesmenCompare(a.kelasParts.rombel, b.kelasParts.rombel, "asc");
      if (kelasResult !== 0) return kelasResult;
      return compareAsesmenSiswaDalamKelas(a, b);
    });
}

function getAsesmenRombelCode(rombel = "") {
  const letter = String(rombel || "").trim().toUpperCase().charAt(0);
  if (!/^[A-Z]$/.test(letter)) return "0";
  return String(letter.charCodeAt(0) - 64);
}

function getAsesmenJenisKelaminCode(jk = "") {
  const normalized = String(jk || "").trim().toUpperCase();
  if (normalized === "L") return "1";
  if (normalized === "P") return "2";
  return "-";
}

function isSameAsesmenSiswa(left, right) {
  if (left?.nipd && right?.nipd) return String(left.nipd) === String(right.nipd);
  if (left?.nisn && right?.nisn) return String(left.nisn) === String(right.nisn);
  return String(left?.nama || "") === String(right?.nama || "")
    && String(left?.kelasParts?.kelas || left?.kelas || "") === String(right?.kelasParts?.kelas || right?.kelas || "");
}

function getAsesmenNomorPresensi(siswa) {
  const kelas = siswa?.kelasParts?.kelas || "";
  const classmates = getAsesmenStudentsByLevel(siswa?.kelasParts?.tingkat)
    .filter(item => item.kelasParts.kelas === kelas)
    .sort(compareAsesmenSiswaDalamKelas);
  const index = classmates.findIndex(item => isSameAsesmenSiswa(item, siswa));
  return String(index >= 0 ? index + 1 : 0).padStart(3, "0");
}

function getAsesmenNomorUjian(siswa) {
  const tingkat = siswa?.kelasParts?.tingkat || "-";
  const rombelCode = getAsesmenRombelCode(siswa?.kelasParts?.rombel);
  const presensi = getAsesmenNomorPresensi(siswa);
  const jkCode = getAsesmenJenisKelaminCode(siswa?.jk);
  return `${tingkat}${rombelCode}-130-${presensi}-${jkCode}`;
}

function getAsesmenKelasAsliNote(siswa) {
  const kelasAsli = siswa?.asliKelasParts?.kelas || siswa?.kelas || "";
  const kelasAcuan = siswa?.kelasParts?.kelas || "";
  return kelasAsli && kelasAcuan && kelasAsli !== kelasAcuan ? ` <small>(${escapeAsesmenHtml(kelasAsli)})</small>` : "";
}

function getAsesmenUnassignedStudentsByLevel(level) {
  return semuaDataAsesmenSiswa
    .map(siswa => {
      const asliKelasParts = getAsesmenKelasParts(siswa.kelas);
      const kelasParts = getAsesmenKelasBayanganParts(siswa);
      return { ...siswa, asliKelasParts, kelasParts };
    })
    .filter(siswa => siswa.asliKelasParts.tingkat === String(level) && !siswa.kelasParts.rombel);
}

function getOrderedAsesmenStudents(level) {
  const settings = asesmenLevelSettings[level];
  const classDirection = settings.order === "za" ? "desc" : "asc";
  return getAsesmenStudentsByLevel(level).sort((a, b) => {
    const kelasResult = asesmenCompare(a.kelasParts.rombel, b.kelasParts.rombel, classDirection);
    if (kelasResult !== 0) return kelasResult;
    return compareAsesmenSiswaDalamKelas(a, b);
  });
}

function chunkAsesmenStudents(students, size) {
  const safeSize = Math.min(Math.max(Number(size) || 1, 1), 20);
  const chunks = [];
  for (let index = 0; index < students.length; index += safeSize) {
    chunks.push(students.slice(index, index + safeSize));
  }
  return chunks;
}

function expandAsesmenRange(startValue, endValue) {
  const start = Number(startValue);
  const end = Number(endValue || startValue);
  if (!Number.isFinite(start) || start <= 0) return [];
  if (!Number.isFinite(end) || end <= 0) return [start];

  const rooms = [];
  const step = start <= end ? 1 : -1;
  for (let room = start; step > 0 ? room <= end : room >= end; room += step) {
    rooms.push(room);
  }
  return rooms;
}

function getAsesmenLevelRooms(level) {
  if (!isAsesmenLevelApplied(level)) return [];

  const seen = new Set();
  const rooms = [];
  asesmenLevelSettings[level].roomRanges.forEach(range => {
    expandAsesmenRange(range.start, range.end).forEach(room => {
      if (!seen.has(room)) {
        seen.add(room);
        rooms.push(room);
      }
    });
  });
  return rooms;
}

function getAsesmenRoomUsage() {
  const usage = new Map();
  [7, 8, 9].forEach(level => {
    getAsesmenLevelRooms(level).forEach(roomNumber => {
      if (!usage.has(roomNumber)) usage.set(roomNumber, []);
      usage.get(roomNumber).push(String(level));
    });
  });
  return usage;
}

function getAsesmenRoomConflictMessages(level) {
  const usage = getAsesmenRoomUsage();
  return getAsesmenLevelRooms(level)
    .filter(roomNumber => (usage.get(roomNumber) || []).length > 2)
    .map(roomNumber => `Ruang ${roomNumber} dipakai oleh kelas ${usage.get(roomNumber).join(", ")}`);
}

function decorateAsesmenRooms(level, rooms) {
  const physicalRooms = getAsesmenLevelRooms(level);
  return rooms.map((students, index) => ({
    level: String(level),
    students,
    roomNumber: physicalRooms[index] || index + 1,
    missingPhysicalRoom: physicalRooms.length > 0 && !physicalRooms[index]
  }));
}

function buildSetengahAsesmenRooms(level) {
  const settings = asesmenLevelSettings[level];
  const classDirection = settings.order === "za" ? "desc" : "asc";
  const grouped = new Map();
  getAsesmenStudentsByLevel(level).forEach(siswa => {
    const kelas = siswa.kelasParts.kelas;
    if (!grouped.has(kelas)) grouped.set(kelas, []);
    grouped.get(kelas).push(siswa);
  });

  const kelasList = Array.from(grouped.keys()).sort((a, b) => {
    const rombelA = getAsesmenKelasParts(a).rombel;
    const rombelB = getAsesmenKelasParts(b).rombel;
    return asesmenCompare(rombelA, rombelB, classDirection);
  });

  return kelasList.flatMap(kelas => {
    const siswaKelas = grouped.get(kelas).sort(compareAsesmenSiswaDalamKelas);
    const halfSize = Math.max(1, Math.ceil(siswaKelas.length / 2));
    return chunkAsesmenStudents(siswaKelas, Math.min(halfSize, 20));
  });
}

function buildManualAsesmenRooms(level) {
  const settings = asesmenLevelSettings[level];
  const students = getOrderedAsesmenStudents(level);
  let cursor = 0;

  return settings.manualCounts
    .slice(0, jumlahRuangUjian)
    .map(count => Math.min(Math.max(Number(count) || 0, 0), 20))
    .filter(count => count > 0)
    .map(count => {
      const roomStudents = students.slice(cursor, cursor + count);
      cursor += count;
      return roomStudents;
    });
}

function getAsesmenRooms(level) {
  if (!isAsesmenLevelApplied(level)) return [];

  const settings = asesmenLevelSettings[level];
  return settings.mode === "manual" ? buildManualAsesmenRooms(level) : buildSetengahAsesmenRooms(level);
}

function getDecoratedAsesmenRoomsByLevel(level) {
  return decorateAsesmenRooms(level, getAsesmenRooms(level));
}

function getCombinedAsesmenRoomMap() {
  const roomMap = new Map();
  [7, 8, 9].forEach(level => {
    getDecoratedAsesmenRoomsByLevel(level).forEach(room => {
      if (!roomMap.has(room.roomNumber)) roomMap.set(room.roomNumber, []);
      roomMap.get(room.roomNumber).push(room);
    });
  });
  return new Map(Array.from(roomMap.entries()).sort((a, b) => Number(a[0]) - Number(b[0])));
}

function setJumlahRuangUjian(value) {
  draftJumlahRuangUjian = Math.min(Math.max(Number(value) || 1, 1), 99);
}

function setPembagianKelasAsesmen(value) {
  draftPembagianKelasAsesmen = value === "manual" ? "manual" : "setengah";
}

function applyJumlahRuangUjian() {
  jumlahRuangUjian = Math.min(Math.max(Number(draftJumlahRuangUjian) || 1, 1), 99);
  pembagianKelasAsesmen = draftPembagianKelasAsesmen === "manual" ? "manual" : "setengah";
  localStorage.setItem("asesmenJumlahRuangUjian", String(jumlahRuangUjian));
  localStorage.setItem("asesmenPembagianKelas", pembagianKelasAsesmen);
  appliedAsesmenLevels.clear();
  [7, 8, 9].forEach(level => {
    asesmenLevelSettings[level].mode = pembagianKelasAsesmen;
    draftAsesmenLevelSettings[level].mode = pembagianKelasAsesmen;
    syncAsesmenManualCountLength(asesmenLevelSettings[level]);
    syncAsesmenManualCountLength(draftAsesmenLevelSettings[level]);
  });
  renderPembagianRuangState();
}

function setAsesmenOrder(level, value) {
  draftAsesmenLevelSettings[level].order = value === "za" ? "za" : "az";
}

function setAsesmenRoomRange(level, rangeIndex, key, value) {
  draftAsesmenLevelSettings[level].roomRanges[rangeIndex][key] = value;
}

function setAsesmenManualCount(level, roomIndex, value) {
  draftAsesmenLevelSettings[level].manualCounts[roomIndex] = value;
}

function applyAsesmenLevelSettings(level) {
  syncAsesmenManualCountLength(draftAsesmenLevelSettings[level]);
  draftAsesmenLevelSettings[level].mode = pembagianKelasAsesmen;
  asesmenLevelSettings[level] = cloneAsesmenLevelSettings(draftAsesmenLevelSettings[level]);
  appliedAsesmenLevels.add(String(level));
  renderPembagianRuangState();
}

function loadRealtimePembagianRuang() {
  if (unsubscribeAsesmenSiswa) unsubscribeAsesmenSiswa();
  unsubscribeAsesmenSiswa = listenSiswa(data => {
    semuaDataAsesmenSiswa = data;
    renderPembagianRuangState();
  });
}

function loadRealtimeAdministrasiAsesmen() {
  if (unsubscribeAsesmenSiswa) unsubscribeAsesmenSiswa();
  unsubscribeAsesmenSiswa = listenSiswa(data => {
    semuaDataAsesmenSiswa = data;
    renderAdministrasiAsesmenState();
  });
}

function renderPembagianRuangState() {
  const content = document.getElementById("content");
  if (!content) return;
  content.innerHTML = renderPembagianRuangPage();
  renderAllAsesmenPreviews();
}

function renderAdministrasiAsesmenState() {
  const content = document.getElementById("content");
  if (!content) return;
  content.innerHTML = renderAdministrasiAsesmenPage();
}

function setAdministrasiAsesmenSetting(key, value) {
  localStorage.setItem(`asesmenAdministrasi${key}`, value);
}

function getAdministrasiAsesmenSetting(key, fallback = "") {
  return localStorage.getItem(`asesmenAdministrasi${key}`) || fallback;
}

function renderAdministrasiAsesmenKeteranganSelect() {
  const value = getAdministrasiAsesmenSetting("Keterangan", "Akhir Tahun");
  const options = [
    "Tengah Semester Ganjil",
    "Akhir Semester Ganjil",
    "Tengah Semester Genap",
    "Akhir Tahun",
    "Akhir Jenjang"
  ];
  const hasStoredValue = options.includes(value);
  const extraOption = value && !hasStoredValue
    ? `<option value="${escapeAsesmenHtml(value)}" selected>${escapeAsesmenHtml(value)}</option>`
    : "";

  return `
    <select class="kelas-inline-select" onchange="setAdministrasiAsesmenSetting('Keterangan', this.value)">
      ${extraOption}
      ${options.map(option => `<option value="${escapeAsesmenHtml(option)}" ${option === value ? "selected" : ""}>${escapeAsesmenHtml(option)}</option>`).join("")}
    </select>
  `;
}

function renderAdministrasiAsesmenPage() {
  return `
    <div class="card">
      <div class="asesmen-page-head">
        <div>
          <span class="dashboard-eyebrow">Asesmen</span>
          <h2>Administrasi</h2>
          <p>Siapkan dokumen administrasi asesmen dari susunan ruang yang sudah di-set.</p>
        </div>
      </div>

      <div class="rekap-letter-settings asesmen-admin-settings">
        <label class="form-group">
          <span>Judul</span>
          <input value="${escapeAsesmenHtml(getAdministrasiAsesmenSetting("Judul", "Asesmen Sumatif"))}" oninput="setAdministrasiAsesmenSetting('Judul', this.value)">
        </label>
        <label class="form-group">
          <span>Keterangan</span>
          ${renderAdministrasiAsesmenKeteranganSelect()}
        </label>
        <label class="form-group">
          <span>Tahun Pelajaran</span>
          <input value="${escapeAsesmenHtml(getAdministrasiAsesmenSetting("TahunPelajaran", ""))}" placeholder="2025/2026" oninput="setAdministrasiAsesmenSetting('TahunPelajaran', this.value)">
        </label>
      </div>

      <div class="table-container mapel-table-container">
        <table class="mapel-table">
          <thead>
            <tr>
              <th>Administrasi</th>
              <th>Export PDF</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Tempel Kaca</td>
              <td><button type="button" class="btn-primary btn-table-compact" onclick="exportTempelKacaPDF()">Export PDF</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAllAsesmenPreviews() {
  [7, 8, 9].forEach(level => renderAsesmenPreview(level));
  renderAsesmenRoomArrangement();
}

function renderAsesmenManualInputs(level) {
  const settings = draftAsesmenLevelSettings[level];
  if (settings.mode !== "manual") return "";

  const inputs = Array.from({ length: jumlahRuangUjian }, (_, index) => {
    const value = settings.manualCounts[index] || "";
    return `
      <label class="asesmen-room-input">
        <span>Isi ruang ${index + 1}</span>
        <input
          type="number"
          min="1"
          max="20"
          value="${escapeAsesmenHtml(value)}"
          placeholder="1-20"
          oninput="setAsesmenManualCount('${level}', ${index}, this.value)"
        >
      </label>
    `;
  }).join("");

  return `<div class="asesmen-manual-grid">${inputs}</div>`;
}

function renderAsesmenRoomRangeInputs(level) {
  const ranges = draftAsesmenLevelSettings[level].roomRanges;
  return `
    <div class="asesmen-range-grid">
      ${ranges.map((range, index) => `
        <div class="asesmen-range-group">
          <span>Rentang ${index + 1}</span>
          <input
            type="number"
            min="1"
            value="${escapeAsesmenHtml(range.start)}"
            placeholder="Awal"
            oninput="setAsesmenRoomRange('${level}', ${index}, 'start', this.value)"
          >
          <input
            type="number"
            min="1"
            value="${escapeAsesmenHtml(range.end)}"
            placeholder="Akhir"
            oninput="setAsesmenRoomRange('${level}', ${index}, 'end', this.value)"
          >
        </div>
      `).join("")}
    </div>
  `;
}

function renderAsesmenLevelPanel(level) {
  const settings = draftAsesmenLevelSettings[level];
  const totalSiswa = getAsesmenStudentsByLevel(level).length;

  return `
    <section class="asesmen-level-panel">
      <div class="asesmen-panel-head">
        <div>
          <span class="mapel-row-hint">Panel Kelas ${level}</span>
          <h3>Kelas ${level}</h3>
        </div>
        <strong>${totalSiswa} siswa</strong>
      </div>

      <div class="asesmen-control-grid">
        <label class="form-group">
          <span>Urutan</span>
          <select class="kelas-inline-select" onchange="setAsesmenOrder('${level}', this.value)">
            <option value="az" ${settings.order === "az" ? "selected" : ""}>A-Z</option>
            <option value="za" ${settings.order === "za" ? "selected" : ""}>Z-A</option>
          </select>
        </label>
      </div>

      ${renderAsesmenRoomRangeInputs(level)}
      ${renderAsesmenManualInputs(level)}

      <div class="asesmen-panel-actions">
        <button type="button" class="btn-primary btn-table-compact" onclick="applyAsesmenLevelSettings('${level}')">Set Kelas ${level}</button>
        <span class="mapel-row-hint">Perubahan panel ini diterapkan setelah klik Set.</span>
      </div>

      <div id="asesmenPreview-${level}" class="asesmen-preview"></div>
    </section>
  `;
}

function renderPembagianRuangPage() {
  return `
    <div class="card">
      <div class="asesmen-page-head">
        <div>
          <span class="dashboard-eyebrow">Asesmen</span>
          <h2>Pembagian Ruang</h2>
          <p>Atur ruang ujian dan susunan dua jenjang per ruang.</p>
        </div>
        <label class="asesmen-room-total">
          <span>Pengaturan global</span>
          <div class="asesmen-room-total-control">
            <input type="number" min="1" max="99" value="${draftJumlahRuangUjian}" oninput="setJumlahRuangUjian(this.value)" title="Jumlah ruang ujian">
            <select class="kelas-inline-select" onchange="setPembagianKelasAsesmen(this.value)" title="Pembagian kelas">
              <option value="setengah" ${draftPembagianKelasAsesmen === "setengah" ? "selected" : ""}>2 setengah</option>
              <option value="manual" ${draftPembagianKelasAsesmen === "manual" ? "selected" : ""}>Manual</option>
            </select>
            <button type="button" class="btn-primary" onclick="applyJumlahRuangUjian()">Set</button>
          </div>
        </label>
      </div>

      <div class="matrix-toolbar-note">
        Isi dua rentang ruang per jenjang. Satu ruang fisik hanya boleh dipakai maksimal dua jenjang; susunan ruang menampilkan jenjang rendah di kiri dan jenjang tinggi di kanan.
      </div>

      <div class="asesmen-level-grid">
        ${[7, 8, 9].map(renderAsesmenLevelPanel).join("")}
      </div>

      <section class="asesmen-arrangement">
        <div class="asesmen-arrangement-head">
          <div>
            <span class="mapel-row-hint">Susunan Ruang</span>
            <h3>Preview Ruang Ujian</h3>
          </div>
        </div>
        <div id="asesmenRoomArrangement"></div>
      </section>
    </div>
  `;
}

function renderAsesmenPreview(level) {
  const container = document.getElementById(`asesmenPreview-${level}`);
  if (!container) return;

  const rooms = getAsesmenRooms(level);
  const decoratedRooms = getDecoratedAsesmenRoomsByLevel(level);
  const totalSiswa = getAsesmenStudentsByLevel(level).length;
  const belumBayangan = getAsesmenUnassignedStudentsByLevel(level).length;
  const assigned = rooms.reduce((sum, room) => sum + room.length, 0);
  const physicalRooms = getAsesmenLevelRooms(level);
  const missingPhysicalCount = decoratedRooms.filter(room => room.missingPhysicalRoom).length;
  const conflictMessages = getAsesmenRoomConflictMessages(level);
  const warnings = [];

  if (totalSiswa === 0) {
    const message = belumBayangan > 0
      ? `${belumBayangan} siswa kelas ${level} belum memiliki kelas bayangan.`
      : `Belum ada siswa kelas ${level}.`;
    container.innerHTML = `<div class="empty-panel">${escapeAsesmenHtml(message)}</div>`;
    return;
  }

  if (!isAsesmenLevelApplied(level)) {
    container.innerHTML = `<div class="empty-panel">Panel kelas ${escapeAsesmenHtml(level)} belum di-set.</div>`;
    return;
  }

  if (assigned < totalSiswa) warnings.push(`${totalSiswa - assigned} siswa belum masuk ruang.`);
  if (belumBayangan > 0) warnings.push(`${belumBayangan} siswa belum memiliki kelas bayangan.`);
  if (physicalRooms.length === 0) warnings.push("Ruang fisik belum diisi.");
  if (missingPhysicalCount > 0) warnings.push(`${missingPhysicalCount} bagian belum mendapat nomor ruang fisik.`);
  conflictMessages.forEach(message => warnings.push(message));

  container.innerHTML = `
    ${warnings.map(message => `<div class="asesmen-warning">${escapeAsesmenHtml(message)}</div>`).join("")}
    <div class="asesmen-level-summary">
      <span>${decoratedRooms.length} bagian</span>
      <span>${physicalRooms.length} ruang dipilih</span>
      <span>A-H dari kelas bayangan</span>
      <span>${assigned}/${totalSiswa} siswa</span>
    </div>
  `;
}

function renderAsesmenStudentColumn(entry) {
  return `
    <section class="asesmen-room-column">
      <div class="asesmen-room-column-head">
        <strong>Kelas ${escapeAsesmenHtml(entry.level)}</strong>
        <span>${entry.students.length} siswa</span>
      </div>
      <div class="asesmen-student-list">
        ${entry.students.map(siswa => `
          <span>${escapeAsesmenHtml(siswa.kelasParts.kelas)}, ${escapeAsesmenHtml(getAsesmenNomorUjian(siswa))}, ${escapeAsesmenHtml(siswa.nama || "-")}${getAsesmenKelasAsliNote(siswa)}</span>
        `).join("")}
      </div>
    </section>
  `;
}

function renderTempelKacaRows(students = []) {
  return Array.from({ length: 20 }, (_, index) => students[index] || null).map(siswa => siswa ? `
    <tr>
      <td class="tempel-kelas">${escapeAsesmenHtml(siswa.kelasParts?.kelas || "-")}</td>
      <td class="tempel-nama">${escapeAsesmenHtml(siswa.nama || "-")}</td>
    </tr>
  ` : `
    <tr>
      <td class="tempel-kelas">&nbsp;</td>
      <td class="tempel-nama">&nbsp;</td>
    </tr>
  `).join("");
}

function renderTempelKacaStudentTable(entry, label) {
  if (!entry) return `<section class="tempel-student-panel tempel-student-panel-empty"></section>`;

  return `
    <section class="tempel-student-panel">
      <div class="tempel-panel-title">${escapeAsesmenHtml(label)}</div>
      <table>
        <thead>
          <tr>
            <th class="tempel-kelas">Kelas</th>
            <th class="tempel-nama">Nama</th>
          </tr>
        </thead>
        <tbody>${renderTempelKacaRows(entry?.students || [])}</tbody>
      </table>
    </section>
  `;
}

function renderTempelKacaPage(roomNumber, entries) {
  const sortedEntries = [...entries].sort((a, b) => Number(b.level) - Number(a.level));
  const highEntry = sortedEntries[0] || null;
  const lowEntry = sortedEntries[1] || null;
  const singleEntryClass = lowEntry ? "" : " tempel-kaca-page-single";
  const judul = getAdministrasiAsesmenSetting("Judul", "Asesmen Sumatif") || "Asesmen Sumatif";
  const keterangan = getAdministrasiAsesmenSetting("Keterangan", "xxxxxxxxx") || "xxxxxxxxx";
  const tahunPelajaran = getAdministrasiAsesmenSetting("TahunPelajaran", "xxxxx") || "xxxxx";

  return `
    <section class="tempel-kaca-page${singleEntryClass}">
      <div class="tempel-room-id-panel">
        <div class="tempel-kop">
          <strong>${escapeAsesmenHtml(judul)}</strong>
          <span>${escapeAsesmenHtml(keterangan)}</span>
          <span>Tahun Pelajaran ${escapeAsesmenHtml(tahunPelajaran)}</span>
        </div>
        <div class="tempel-room-box">
          <span>Nomor Ruang</span>
          <strong>${escapeAsesmenHtml(roomNumber)}</strong>
        </div>
      </div>
      ${renderTempelKacaStudentTable(highEntry, `Kelas ${highEntry?.level || ""}`)}
      ${lowEntry ? renderTempelKacaStudentTable(lowEntry, `Kelas ${lowEntry.level}`) : ""}
    </section>
  `;
}

function getTempelKacaPrintHtml() {
  const roomMap = getCombinedAsesmenRoomMap();
  const pages = Array.from(roomMap.entries()).map(([roomNumber, entries]) => renderTempelKacaPage(roomNumber, entries)).join("");

  return `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Tempel Kaca</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #ffffff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
        .tempel-kaca-page {
          width: 100%;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 30% 35% 35%;
          gap: 8px;
          border: 2px solid #111827;
          border-radius: 14px;
          padding: 8px;
          page-break-after: always;
          break-after: page;
          overflow: hidden;
        }
        .tempel-kaca-page-single {
          grid-template-columns: 30% 70%;
        }
        .tempel-kaca-page:last-child { page-break-after: auto; break-after: auto; }
        .tempel-room-id-panel,
        .tempel-student-panel {
          min-width: 0;
          border: 2px solid #111827;
          border-radius: 10px;
          overflow: hidden;
          background: #ffffff;
        }
        .tempel-room-id-panel {
          display: grid;
          grid-template-rows: auto 1fr;
          padding: 12px;
        }
        .tempel-kop {
          display: grid;
          gap: 4px;
          text-align: center;
          font-size: 16px;
          line-height: 1.15;
        }
        .tempel-kop strong {
          font-size: 20px;
        }
        .tempel-room-box {
          align-self: center;
          display: grid;
          gap: 8px;
          margin: 14px auto 0;
          width: 100%;
          min-height: 190px;
          place-items: center;
          border: 3px solid #111827;
          border-radius: 10px;
          text-align: center;
          padding: 12px;
        }
        .tempel-room-box span {
          font-weight: 800;
          font-size: 18px;
        }
        .tempel-room-box strong {
          display: block;
          font-size: 92px;
          line-height: 1;
          font-weight: 900;
        }
        .tempel-panel-title {
          padding: 6px 10px;
          border-bottom: 1px solid #111827;
          text-align: center;
          font-weight: 800;
          font-size: 16px;
        }
        table { width: 100%; height: calc(100% - 31px); border-collapse: collapse; table-layout: fixed; font-size: 14px; }
        th, td { border-bottom: 1px solid #d1d5db; padding: 3px 7px; vertical-align: middle; }
        th { font-size: 11px; background: #f8fafc; color: #374151; }
        tbody tr { height: 4.65%; }
        .tempel-kelas { width: 72px; text-align: center; font-weight: 800; white-space: nowrap; }
        .tempel-nama { text-align: left; white-space: nowrap; overflow: hidden; text-overflow: clip; }
        .tempel-empty { text-align: center; color: #6b7280; }
        .tempel-student-panel-empty { background: #ffffff; border-color: transparent; }
        @page { size: A4 landscape; margin: 5mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>${pages}</body>
    </html>
  `;
}

function exportTempelKacaPDF() {
  const roomMap = getCombinedAsesmenRoomMap();
  if (roomMap.size === 0) {
    Swal.fire("Belum ada ruang", "Set panel kelas dan ruang ujian terlebih dahulu di menu Pembagian Ruang.", "warning");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    Swal.fire("Popup diblokir", "Izinkan popup browser untuk export PDF.", "warning");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(getTempelKacaPrintHtml());
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
}

function renderAsesmenRoomArrangement() {
  const container = document.getElementById("asesmenRoomArrangement");
  if (!container) return;

  const roomMap = getCombinedAsesmenRoomMap();
  if (roomMap.size === 0) {
    container.innerHTML = `<div class="empty-panel">Isi ruang yang digunakan untuk melihat susunan ruang.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="asesmen-combined-room-list">
      ${Array.from(roomMap.entries()).map(([roomNumber, entries]) => {
        const sortedEntries = entries.sort((a, b) => Number(b.level) - Number(a.level));
        const warning = sortedEntries.length > 2
          ? `<div class="asesmen-warning">Ruang ini dipakai ${sortedEntries.length} jenjang. Maksimal dua jenjang.</div>`
          : "";
        return `
          <article class="asesmen-combined-room-card">
            <div class="asesmen-room-card-head">
              <strong>Ruang ${escapeAsesmenHtml(roomNumber)}</strong>
              <span>${sortedEntries.reduce((sum, entry) => sum + entry.students.length, 0)} siswa</span>
            </div>
            ${warning}
            <div class="asesmen-room-pair">
              ${sortedEntries.map(renderAsesmenStudentColumn).join("")}
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}
