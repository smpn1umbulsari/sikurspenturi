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

function escapeRekapHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRekapTugasMengajarPage() {
  return `
    <div class="card">
      <div class="kelas-bayangan-head">
        <div>
          <span class="dashboard-eyebrow">Rekap</span>
          <h2>Rekap Tugas dan Mengajar</h2>
          <p>Ringkasan tugas mengajar, tugas tambahan, dan total JP setiap guru.</p>
        </div>
      </div>

      <div class="toolbar-info">
        <span id="rekapTugasMengajarInfo">Memuat data rekap...</span>
      </div>

      <div id="rekapTugasMengajarContainer"></div>
    </div>
  `;
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

function renderRekapTugasMengajarTable() {
  const container = document.getElementById("rekapTugasMengajarContainer");
  const info = document.getElementById("rekapTugasMengajarInfo");
  if (!container) return;

  const gurus = getSortedRekapGuru();
  if (info) {
    info.innerText = `${gurus.length} guru | ${semuaDataRekapMengajar.length} data mengajar | ${semuaDataRekapGuruTugasTambahan.length} data tugas tambahan`;
  }

  if (gurus.length === 0) {
    container.innerHTML = `<div class="empty-panel">Belum ada data guru untuk direkap.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-container rekap-table-wrap">
      <table class="rekap-table">
        <thead>
          <tr>
            <th rowspan="2">No</th>
            <th rowspan="2">Nama Guru</th>
            <th colspan="7">Tugas Mengajar</th>
            <th rowspan="2">Tugas Tambahan Utama</th>
            <th rowspan="2">Tugas Tambahan Ekuivalen</th>
            <th rowspan="2">Tugas Tambahan Sekolah</th>
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
          </tr>
        </thead>
        <tbody>
          ${gurus.map((guru, index) => renderRekapGuruRow(guru, index)).join("")}
        </tbody>
      </table>
    </div>
  `;
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

function renderRekapGuruRow(guru, index) {
  const guruKode = String(guru.kode_guru || "").trim();
  const mengajar = getRekapMengajarSummary(guruKode);
  const tugas = getRekapTugasTambahanSummary(guruKode);
  const totalJp = mengajar.total + tugas.totalJp;

  return `
    <tr>
      <td class="rekap-number-cell">${index + 1}</td>
      <td class="rekap-name-cell">
        <strong>${escapeRekapHtml(getRekapNamaGuru(guru) || guruKode || "-")}</strong>
        ${guru.nip ? `<small>NIP. ${escapeRekapHtml(guru.nip)}</small>` : `<small class="muted-text">NIP belum ada</small>`}
      </td>
      <td>${escapeRekapHtml(mengajar.levels["7"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${mengajar.levels["7"].jp}</td>
      <td>${escapeRekapHtml(mengajar.levels["8"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${mengajar.levels["8"].jp}</td>
      <td>${escapeRekapHtml(mengajar.levels["9"].kelas || "-")}</td>
      <td class="rekap-jp-cell">${mengajar.levels["9"].jp}</td>
      <td class="rekap-jp-cell">${mengajar.total}</td>
      <td>${renderRekapTaskList(tugas.utama)}</td>
      <td>${renderRekapTaskList(tugas.ekuivalen)}</td>
      <td>${renderRekapTaskList(tugas.sekolah)}</td>
      <td class="rekap-total-jp">${totalJp} JP</td>
    </tr>
  `;
}

function getRekapMengajarSummary(guruKode) {
  const levels = {
    "7": { rombels: new Set(), jp: 0 },
    "8": { rombels: new Set(), jp: 0 },
    "9": { rombels: new Set(), jp: 0 }
  };

  semuaDataRekapMengajar.forEach(item => {
    if (String(item.guru_kode || "").trim() !== String(guruKode || "").trim()) return;
    const tingkat = String(item.tingkat || getRekapKelasParts(item).tingkat || "").trim();
    if (!levels[tingkat]) return;

    const rombel = String(item.rombel || getRekapKelasParts(item).rombel || "").trim().toUpperCase();
    if (rombel) levels[tingkat].rombels.add(rombel);

    const mapel = getRekapMapel(item.mapel_kode);
    levels[tingkat].jp += Number(mapel?.jp || 0);
  });

  return {
    levels: {
      "7": { kelas: formatRekapRombelRanges([...levels["7"].rombels]), jp: levels["7"].jp },
      "8": { kelas: formatRekapRombelRanges([...levels["8"].rombels]), jp: levels["8"].jp },
      "9": { kelas: formatRekapRombelRanges([...levels["9"].rombels]), jp: levels["9"].jp }
    },
    total: levels["7"].jp + levels["8"].jp + levels["9"].jp
  };
}

function getRekapKelasParts(item) {
  const raw = String(item?.kelas || "").trim().toUpperCase();
  const match = raw.match(/^(\d+)\s*([A-Z]+)$/);
  if (!match) return { tingkat: "", rombel: "" };
  return { tingkat: match[1], rombel: match[2] };
}

function getRekapMapel(mapelKode) {
  const kode = String(mapelKode || "").trim().toUpperCase();
  return semuaDataRekapMapel.find(item => String(item.kode_mapel || "").trim().toUpperCase() === kode) || null;
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
    return item?.nama || fallbackNames[index] || "";
  }).filter(Boolean);
  return {
    ids,
    names: [...new Set(names)]
  };
}

function getRekapTugasTambahanById(id) {
  return semuaDataRekapTugasTambahan.find(item => item.id === id) || null;
}

function calculateRekapTugasTambahanJp(ids) {
  return ids.reduce((sum, id) => sum + Number(getRekapTugasTambahanById(id)?.jp || 0), 0);
}

function renderRekapTaskList(taskGroup) {
  const names = Array.isArray(taskGroup) ? taskGroup : taskGroup.names || [];
  if (names.length === 0) return `<span class="muted-text">-</span>`;
  return `<div class="rekap-task-list">${names.map(name => `<span>${escapeRekapHtml(name)}</span>`).join("")}</div>`;
}
