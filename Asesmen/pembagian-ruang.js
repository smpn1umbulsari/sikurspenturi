// ================= STATE ASESMEN =================
let semuaDataAsesmenSiswa = [];
let unsubscribeAsesmenSiswa = null;
let jumlahRuangUjian = 1;
const asesmenLevelSettings = {
  7: { mode: "setengah", order: "az", roomText: "", manualCounts: [] },
  8: { mode: "setengah", order: "az", roomText: "", manualCounts: [] },
  9: { mode: "setengah", order: "az", roomText: "", manualCounts: [] }
};

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
  const match = normalized.match(/^([7-9])([A-Z]+)$/);
  return {
    tingkat: match ? match[1] : "",
    rombel: match ? match[2] : "",
    kelas: match ? `${match[1]} ${match[2]}` : String(kelasValue || "").trim().toUpperCase()
  };
}

function getAsesmenStudentsByLevel(level) {
  return semuaDataAsesmenSiswa
    .map(siswa => ({
      ...siswa,
      kelasParts: getAsesmenKelasParts(siswa.kelas)
    }))
    .filter(siswa => siswa.kelasParts.tingkat === String(level));
}

function getOrderedAsesmenStudents(level) {
  const settings = asesmenLevelSettings[level];
  const classDirection = settings.order === "za" ? "desc" : "asc";
  return getAsesmenStudentsByLevel(level).sort((a, b) => {
    const kelasResult = asesmenCompare(a.kelasParts.rombel, b.kelasParts.rombel, classDirection);
    if (kelasResult !== 0) return kelasResult;
    return asesmenCompare(a.nama, b.nama, "asc");
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

function parseAsesmenRoomText(roomText = "") {
  const result = [];
  const seen = new Set();
  String(roomText || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
    .forEach(part => {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      const singleMatch = part.match(/^\d+$/);

      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        const step = start <= end ? 1 : -1;
        for (let room = start; step > 0 ? room <= end : room >= end; room += step) {
          if (!seen.has(room)) {
            seen.add(room);
            result.push(room);
          }
        }
        return;
      }

      if (singleMatch) {
        const room = Number(part);
        if (!seen.has(room)) {
          seen.add(room);
          result.push(room);
        }
      }
    });

  return result;
}

function getAsesmenLevelRooms(level) {
  return parseAsesmenRoomText(asesmenLevelSettings[level].roomText);
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
    const siswaKelas = grouped.get(kelas).sort((a, b) => asesmenCompare(a.nama, b.nama, "asc"));
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
  const settings = asesmenLevelSettings[level];
  return settings.mode === "manual"
    ? buildManualAsesmenRooms(level)
    : buildSetengahAsesmenRooms(level);
}

function setJumlahRuangUjian(value) {
  jumlahRuangUjian = Math.min(Math.max(Number(value) || 1, 1), 99);
  [7, 8, 9].forEach(level => {
    const counts = asesmenLevelSettings[level].manualCounts;
    while (counts.length < jumlahRuangUjian) counts.push("");
    if (counts.length > jumlahRuangUjian) counts.length = jumlahRuangUjian;
  });
  renderPembagianRuangState();
}

function setAsesmenMode(level, value) {
  asesmenLevelSettings[level].mode = value === "manual" ? "manual" : "setengah";
  renderPembagianRuangState();
}

function setAsesmenOrder(level, value) {
  asesmenLevelSettings[level].order = value === "za" ? "za" : "az";
  renderPembagianRuangState();
}

function setAsesmenRoomText(level, value) {
  asesmenLevelSettings[level].roomText = value;
  renderPembagianRuangState();
}

function setAsesmenManualCount(level, roomIndex, value) {
  asesmenLevelSettings[level].manualCounts[roomIndex] = value;
  renderAsesmenPreview(level);
}

function loadRealtimePembagianRuang() {
  if (unsubscribeAsesmenSiswa) unsubscribeAsesmenSiswa();
  unsubscribeAsesmenSiswa = listenSiswa(data => {
    semuaDataAsesmenSiswa = data;
    renderPembagianRuangState();
  });
}

function renderPembagianRuangState() {
  const content = document.getElementById("content");
  if (!content) return;
  content.innerHTML = renderPembagianRuangPage();
  [7, 8, 9].forEach(level => renderAsesmenPreview(level));
}

function renderAsesmenManualInputs(level) {
  const settings = asesmenLevelSettings[level];
  if (settings.mode !== "manual") return "";

  const inputs = Array.from({ length: jumlahRuangUjian }, (_, index) => {
    const value = settings.manualCounts[index] || "";
    return `
      <label class="asesmen-room-input">
        <span>Ruang ${index + 1}</span>
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

  return `
    <div class="asesmen-manual-grid">
      ${inputs}
    </div>
  `;
}

function renderAsesmenLevelPanel(level) {
  const settings = asesmenLevelSettings[level];
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
          <span>Pembagian kelas</span>
          <select class="kelas-inline-select" onchange="setAsesmenMode('${level}', this.value)">
            <option value="setengah" ${settings.mode === "setengah" ? "selected" : ""}>2 setengah</option>
            <option value="manual" ${settings.mode === "manual" ? "selected" : ""}>Manual</option>
          </select>
        </label>

        <label class="form-group">
          <span>Urutan</span>
          <select class="kelas-inline-select" onchange="setAsesmenOrder('${level}', this.value)">
            <option value="az" ${settings.order === "az" ? "selected" : ""}>A-Z</option>
            <option value="za" ${settings.order === "za" ? "selected" : ""}>Z-A</option>
          </select>
        </label>

        <label class="form-group asesmen-room-range-field">
          <span>Ruang yang digunakan</span>
          <input
            class="kelas-inline-select"
            value="${escapeAsesmenHtml(settings.roomText)}"
            placeholder="Contoh: 1-9, 17-24"
            oninput="setAsesmenRoomText('${level}', this.value)"
          >
        </label>
      </div>

      ${renderAsesmenManualInputs(level)}

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
          <p>Atur jumlah ruang ujian, pola pembagian kelas, dan urutan siswa per jenjang.</p>
        </div>
        <label class="asesmen-room-total">
          <span>Jumlah ruang ujian</span>
          <input type="number" min="1" max="99" value="${jumlahRuangUjian}" oninput="setJumlahRuangUjian(this.value)">
        </label>
      </div>

      <div class="matrix-toolbar-note">
        Batas isi ruangan per jenjang adalah 1-20 siswa. Isi ruang yang digunakan dengan format 1-9, 17-24. Satu ruang fisik hanya boleh dipakai maksimal dua jenjang.
      </div>

      <div class="asesmen-level-grid">
        ${[7, 8, 9].map(renderAsesmenLevelPanel).join("")}
      </div>
    </div>
  `;
}

function renderAsesmenPreview(level) {
  const container = document.getElementById(`asesmenPreview-${level}`);
  if (!container) return;

  const rooms = getAsesmenRooms(level);
  const decoratedRooms = decorateAsesmenRooms(level, rooms);
  const totalSiswa = getAsesmenStudentsByLevel(level).length;
  const assigned = rooms.reduce((sum, room) => sum + room.length, 0);
  const overRoomCount = Math.max(0, rooms.length - jumlahRuangUjian);
  const physicalRooms = getAsesmenLevelRooms(level);
  const missingPhysicalCount = decoratedRooms.filter(room => room.missingPhysicalRoom).length;
  const conflictMessages = getAsesmenRoomConflictMessages(level);

  if (totalSiswa === 0) {
    container.innerHTML = `<div class="empty-panel">Belum ada siswa kelas ${level}.</div>`;
    return;
  }

  if (rooms.length === 0) {
    container.innerHTML = `<div class="empty-panel">Isi jumlah siswa per ruang untuk melihat preview.</div>`;
    return;
  }

  const warnings = [];
  if (overRoomCount > 0) {
    warnings.push(`Kebutuhan ${rooms.length} ruang. Tambahkan ${overRoomCount} ruang ujian agar semua bagian memiliki ruang sendiri.`);
  }
  if (assigned < totalSiswa) {
    warnings.push(`${totalSiswa - assigned} siswa belum masuk ruang pada pengaturan manual.`);
  }
  if (physicalRooms.length === 0) {
    warnings.push("Ruang fisik belum diisi untuk jenjang ini.");
  }
  if (missingPhysicalCount > 0) {
    warnings.push(`${missingPhysicalCount} bagian belum mendapat nomor ruang fisik.`);
  }
  conflictMessages.forEach(message => warnings.push(message));

  const warning = warnings.map(message => `<div class="asesmen-warning">${escapeAsesmenHtml(message)}</div>`).join("");

  container.innerHTML = `
    ${warning}
    <div class="asesmen-room-list">
      ${decoratedRooms.map((room, index) => `
        <div class="asesmen-room-card">
          <div class="asesmen-room-card-head">
            <strong>Ruang ${escapeAsesmenHtml(room.roomNumber)}</strong>
            <span>${room.students.length} siswa</span>
          </div>
          <div class="asesmen-student-list">
            ${room.students.map(siswa => `
              <span>${escapeAsesmenHtml(siswa.kelasParts.kelas)} - ${escapeAsesmenHtml(siswa.nama || "-")}</span>
            `).join("")}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}
