let semuaDataRaporSiswa = [];
let semuaDataRaporMapel = [];
let semuaDataRaporMengajar = [];
let semuaDataRaporNilai = [];
let semuaDataRaporKelas = [];
let semuaDataRaporGuru = [];
let semuaDataRaporKehadiran = [];
let raporAdminSettings = {
  semester: "GENAP",
  tahun: "2025/2026",
  tanggal: new Date().toISOString().slice(0, 10),
  kepala_nama: "Dra. MAMIK SASMIATI, M.Pd",
  kepala_nip: "19660601 199003 2 010",
  kepala_ttd: ""
};
let unsubscribeRaporSiswa = null;
let unsubscribeRaporMapel = null;
let unsubscribeRaporMengajar = null;
let unsubscribeRaporNilai = null;
let unsubscribeRaporKelas = null;
let unsubscribeRaporGuru = null;
let unsubscribeRaporKehadiran = null;
let unsubscribeRaporSettings = null;
let unsubscribeAdminRaporSettings = null;

function escapeRaporHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCurrentRaporUser() {
  try {
    return JSON.parse(localStorage.getItem("appUser") || "{}");
  } catch {
    return {};
  }
}

function getRaporKelasParts(kelasValue = "") {
  const normalized = String(kelasValue || "").trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/([7-9])([A-Z]+)$/);
  return {
    tingkat: match ? match[1] : "",
    rombel: match ? match[2] : "",
    kelas: match ? `${match[1]} ${match[2]}` : String(kelasValue || "").trim().toUpperCase()
  };
}

function getRaporKelasBayanganParts(siswa) {
  const asli = getRaporKelasParts(siswa.kelas);
  const bayangan = getRaporKelasParts(siswa.kelas_bayangan);
  if (bayangan.tingkat === asli.tingkat && /^[A-H]$/.test(bayangan.rombel)) return bayangan;
  if (/^[A-H]$/.test(asli.rombel)) return asli;
  return { tingkat: asli.tingkat, rombel: "", kelas: "" };
}

function getRaporKelasList() {
  const user = getCurrentRaporUser();
  const role = user.role || "admin";
  const kelasSet = new Set();
  const hasCoordinatorAccess = typeof canUseCoordinatorAccess === "function" && canUseCoordinatorAccess();
  const coordinatorLevels = typeof getCurrentCoordinatorLevelsSync === "function" ? getCurrentCoordinatorLevelsSync() : [];

  if (role === "admin") {
    semuaDataRaporSiswa.forEach(siswa => {
      const parts = getRaporKelasBayanganParts(siswa);
      if (parts.kelas) kelasSet.add(parts.kelas);
    });
  } else if (role === "guru" && hasCoordinatorAccess) {
    semuaDataRaporSiswa.forEach(siswa => {
      const parts = getRaporKelasBayanganParts(siswa);
      if (parts.kelas && coordinatorLevels.includes(parts.tingkat)) kelasSet.add(parts.kelas);
    });
  } else if (role === "koordinator") {
    semuaDataRaporSiswa.forEach(siswa => {
      const parts = getRaporKelasBayanganParts(siswa);
      if (parts.kelas && coordinatorLevels.includes(parts.tingkat)) kelasSet.add(parts.kelas);
    });
  } else if (role === "guru") {
    const kodeGuru = String(user.kode_guru || "").trim();
    semuaDataRaporKelas
      .filter(item => String(item.kode_guru || "").trim() === kodeGuru)
      .forEach(item => kelasSet.add(getRaporKelasParts(item.kelas || `${item.tingkat || ""}${item.rombel || ""}`).kelas));
  }

  return Array.from(kelasSet)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function getSelectedRaporKelas() {
  return getRaporKelasParts(document.getElementById("raporKelasSelect")?.value || getPreferredRaporKelas()).kelas;
}

function getPreferredRaporKelas() {
  const classes = getRaporKelasList();
  if (classes.length === 0) return "";
  const user = getCurrentRaporUser();
  const kodeGuru = String(user.kode_guru || "").trim();
  const ownClass = semuaDataRaporKelas
    .map(item => ({
      kode_guru: String(item.kode_guru || "").trim(),
      kelas: getRaporKelasParts(item.kelas || `${item.tingkat || ""}${item.rombel || ""}`).kelas
    }))
    .find(item => item.kode_guru === kodeGuru && classes.includes(item.kelas))?.kelas;
  return ownClass || classes[0];
}

function getRaporStudentsByClass(kelasValue) {
  const target = getRaporKelasParts(kelasValue).kelas;
  return semuaDataRaporSiswa
    .map(siswa => ({ ...siswa, kelasRaporParts: getRaporKelasBayanganParts(siswa) }))
    .filter(siswa => siswa.kelasRaporParts.kelas === target)
    .sort((a, b) => String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" }));
}

function getRaporMapelByKode(mapelKode) {
  const target = String(mapelKode || "").trim().toUpperCase();
  return semuaDataRaporMapel.find(item => String(item.kode_mapel || item.id || "").trim().toUpperCase() === target) || null;
}

function normalizeRaporAgama(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getRaporMapelIndukKode(mapel = {}) {
  const value = String(mapel.induk_mapel || mapel.induk || mapel.kode_induk || "").trim().toUpperCase();
  return value || String(mapel.kode_mapel || mapel.id || "").trim().toUpperCase();
}

function isRaporMapelVisibleForSiswa(mapel, siswa) {
  if (!siswa || !mapel) return true;
  if (getRaporMapelIndukKode(mapel) !== "PABP") return true;
  const mapelAgama = normalizeRaporAgama(mapel.agama);
  if (!mapelAgama) return true;
  return normalizeRaporAgama(siswa.agama) === mapelAgama;
}

function getRaporMapelForClass(kelasValue, siswa = null) {
  const parts = getRaporKelasParts(kelasValue);
  const seen = new Set();
  return semuaDataRaporMengajar
    .filter(item => String(item.tingkat || "") === parts.tingkat && String(item.rombel || "").toUpperCase() === parts.rombel)
    .map(item => getRaporMapelByKode(item.mapel_kode) || { kode_mapel: item.mapel_kode, nama_mapel: item.mapel_nama || item.mapel_kode, jp: item.jp || 0 })
    .filter(item => isRaporMapelVisibleForSiswa(item, siswa))
    .filter(item => {
      const kode = String(item.kode_mapel || item.id || "").trim().toUpperCase();
      const seenKey = getRaporMapelIndukKode(item) === "PABP" ? `PABP:${normalizeRaporAgama(item.agama) || kode}` : kode;
      if (!kode || seen.has(seenKey)) return false;
      seen.add(seenKey);
      return true;
    })
    .sort((a, b) => {
      const mapA = Number(a.mapping ?? Number.MAX_SAFE_INTEGER);
      const mapB = Number(b.mapping ?? Number.MAX_SAFE_INTEGER);
      if (mapA !== mapB) return mapA - mapB;
      return String(a.kode_mapel || "").localeCompare(String(b.kode_mapel || ""), undefined, { sensitivity: "base" });
    });
}

function getRaporNilai(siswa, mapelKode) {
  const kelas = siswa.kelasRaporParts?.kelas || getRaporKelasBayanganParts(siswa).kelas;
  const targetMapel = String(mapelKode || "").trim().toUpperCase();
  return semuaDataRaporNilai.find(item =>
    String(item.nipd || "") === String(siswa.nipd || "") &&
    String(item.kelas || "").toUpperCase() === String(kelas || "").toUpperCase() &&
    String(item.mapel_kode || "").toUpperCase() === targetMapel
  ) || null;
}

function getRaporNilaiValue(nilai, field) {
  if (!nilai) return "";
  const aliases = {
    uh_1: ["uh_1", "UH1", "UH_1", "uh1", "nilai"],
    uh_2: ["uh_2", "UH2", "UH_2", "uh2"],
    uh_3: ["uh_3", "UH3", "UH_3", "uh3"],
    pts: ["pts", "PTS", "nilai_pts"]
  }[field] || [field];
  for (const alias of aliases) {
    if (nilai[alias] !== undefined && nilai[alias] !== null && nilai[alias] !== "") return nilai[alias];
  }
  return "";
}

function getRaporWaliKelas(kelasValue) {
  const target = getRaporKelasParts(kelasValue).kelas;
  const kelas = semuaDataRaporKelas.find(item => getRaporKelasParts(item.kelas || `${item.tingkat || ""}${item.rombel || ""}`).kelas === target);
  const guru = semuaDataRaporGuru.find(item => String(item.kode_guru || "") === String(kelas?.kode_guru || ""));
  return {
    kelas,
    guru,
    nama: guru ? (typeof formatNamaGuru === "function" ? formatNamaGuru(guru) : guru.nama || kelas?.wali_kelas || "-") : kelas?.wali_kelas || "-",
    nip: guru?.nip || "-"
  };
}

function getRaporKehadiran(siswa) {
  const kelas = siswa.kelasRaporParts?.kelas || getRaporKelasBayanganParts(siswa).kelas;
  return semuaDataRaporKehadiran.find(item =>
    String(item.nipd || "") === String(siswa.nipd || "") &&
    getRaporKelasParts(item.kelas).kelas === kelas
  ) || {};
}

function getRaporSettings() {
  const activeTerm = typeof getActiveSemesterContext === "function" ? getActiveSemesterContext() : null;
  return {
    semester: activeTerm?.semester || raporAdminSettings.semester || "GENAP",
    tahun: activeTerm?.tahun || raporAdminSettings.tahun || "2025/2026",
    paper: localStorage.getItem("raporPaperSize") || "A4",
    tanggal: raporAdminSettings.tanggal || new Date().toISOString().slice(0, 10),
    kepala_nama: raporAdminSettings.kepala_nama || "Dra. MAMIK SASMIATI, M.Pd",
    kepala_nip: raporAdminSettings.kepala_nip || "19660601 199003 2 010",
    kepala_ttd: raporAdminSettings.kepala_ttd || ""
  };
}

function formatRaporDisplayClass(kelasValue) {
  const parts = getRaporKelasParts(kelasValue);
  const roman = { 7: "VII", 8: "VIII", 9: "IX" }[parts.tingkat] || parts.tingkat || "";
  return roman && parts.rombel ? `${roman}.${parts.rombel}` : parts.kelas || "-";
}

function setRaporPaperSize() {
  const value = document.getElementById("raporPaperSize")?.value || "A4";
  localStorage.setItem("raporPaperSize", value);
  Swal.fire("Diset", `Ukuran kertas rapor: ${value === "F4" ? "F4 / FLSA" : "A4"}`, "success");
}

function renderAdminRaporPage() {
  const settings = raporAdminSettings;
  return `
    <div class="card">
      <div class="kelas-bayangan-head nilai-page-head">
        <div>
          <span class="dashboard-eyebrow">Admin</span>
          <h2>Administrasi Rapor</h2>
          <p>Atur tanggal cetak, kepala sekolah, NIP, dan tanda tangan yang dipakai wali kelas saat cetak rapor.</p>
        </div>
      </div>

      <div class="admin-rapor-form">
        <label class="form-group">
          <span>Tanggal cetak rapor</span>
          <input id="adminRaporTanggal" type="date" value="${escapeRaporHtml(settings.tanggal || "")}">
        </label>
        <label class="form-group">
          <span>Nama Kepala Sekolah</span>
          <input id="adminRaporKepalaNama" value="${escapeRaporHtml(settings.kepala_nama || "")}" placeholder="Nama kepala sekolah">
        </label>
        <label class="form-group">
          <span>NIP Kepala Sekolah</span>
          <input id="adminRaporKepalaNip" value="${escapeRaporHtml(settings.kepala_nip || "")}" placeholder="NIP kepala sekolah">
        </label>
        <label class="form-group form-group-full">
          <span>TTD Kepala Sekolah</span>
          <input id="adminRaporKepalaTtd" type="file" accept="image/*" onchange="previewAdminRaporSignature(event)">
          <small class="mapel-row-hint">Gunakan gambar tanda tangan berukuran kecil agar aman disimpan.</small>
        </label>
      </div>

      <div class="admin-rapor-signature-box">
        <span>Preview TTD</span>
        <div id="adminRaporTtdPreview">
          ${settings.kepala_ttd ? `<img src="${escapeRaporHtml(settings.kepala_ttd)}" alt="TTD Kepala Sekolah">` : `<small>Belum ada gambar tanda tangan.</small>`}
        </div>
      </div>

      <div class="table-actions">
        <button class="btn-primary" onclick="saveAdminRaporSettings()">Simpan Pengaturan</button>
        <button class="btn-secondary" onclick="clearAdminRaporSignature()">Hapus TTD</button>
      </div>
    </div>
  `;
}

function loadRealtimeAdminRapor() {
  clearAdminRaporListeners();
  unsubscribeAdminRaporSettings = db.collection("settings").doc("rapor").onSnapshot(snapshot => {
    raporAdminSettings = {
      ...raporAdminSettings,
      ...(snapshot.exists ? snapshot.data() : {})
    };
    const tanggal = document.getElementById("adminRaporTanggal");
    const nama = document.getElementById("adminRaporKepalaNama");
    const nip = document.getElementById("adminRaporKepalaNip");
    const preview = document.getElementById("adminRaporTtdPreview");
    if (tanggal) tanggal.value = raporAdminSettings.tanggal || "";
    if (nama) nama.value = raporAdminSettings.kepala_nama || "";
    if (nip) nip.value = raporAdminSettings.kepala_nip || "";
    if (preview) {
      preview.innerHTML = raporAdminSettings.kepala_ttd
        ? `<img src="${escapeRaporHtml(raporAdminSettings.kepala_ttd)}" alt="TTD Kepala Sekolah">`
        : `<small>Belum ada gambar tanda tangan.</small>`;
    }
  });
}

function clearAdminRaporListeners() {
  if (unsubscribeAdminRaporSettings) {
    unsubscribeAdminRaporSettings();
    unsubscribeAdminRaporSettings = null;
  }
}

function previewAdminRaporSignature(event) {
  const file = event.target.files?.[0];
  const preview = document.getElementById("adminRaporTtdPreview");
  if (!file || !preview) return;
  if (file.size > 900 * 1024) {
    event.target.value = "";
    Swal.fire("Gambar terlalu besar", "Gunakan gambar TTD di bawah 900 KB.", "warning");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.innerHTML = `<img src="${escapeRaporHtml(reader.result)}" alt="TTD Kepala Sekolah">`;
  };
  reader.readAsDataURL(file);
}

async function saveAdminRaporSettings() {
  const tanggal = document.getElementById("adminRaporTanggal")?.value || "";
  const kepalaNama = document.getElementById("adminRaporKepalaNama")?.value.trim() || "";
  const kepalaNip = document.getElementById("adminRaporKepalaNip")?.value.trim() || "";
  const file = document.getElementById("adminRaporKepalaTtd")?.files?.[0] || null;

  if (!tanggal || !kepalaNama || !kepalaNip) {
    Swal.fire("Lengkapi data", "Tanggal, nama kepala sekolah, dan NIP wajib diisi.", "warning");
    return;
  }
  if (file && file.size > 900 * 1024) {
    Swal.fire("Gambar terlalu besar", "Gunakan gambar TTD di bawah 900 KB.", "warning");
    return;
  }

  const readSignature = () => new Promise((resolve, reject) => {
    if (!file) return resolve(raporAdminSettings.kepala_ttd || "");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  try {
    const kepalaTtd = await readSignature();
    await db.collection("settings").doc("rapor").set({
      tanggal,
      kepala_nama: kepalaNama,
      kepala_nip: kepalaNip,
      kepala_ttd: kepalaTtd,
      updated_at: new Date()
    }, { merge: true });
    Swal.fire("Tersimpan", "Pengaturan rapor sudah diperbarui.", "success");
  } catch (error) {
    console.error(error);
    Swal.fire("Gagal menyimpan", "", "error");
  }
}

async function clearAdminRaporSignature() {
  await db.collection("settings").doc("rapor").set({
    kepala_ttd: "",
    updated_at: new Date()
  }, { merge: true });
  const input = document.getElementById("adminRaporKepalaTtd");
  if (input) input.value = "";
  Swal.fire("Dihapus", "TTD kepala sekolah sudah dihapus.", "success");
}

function renderCetakRaporPage() {
  const settings = getRaporSettings();
  return `
    <div class="card">
      <div class="kelas-bayangan-head nilai-page-head">
        <div>
          <span class="dashboard-eyebrow">Wali Kelas</span>
          <h2>Cetak Rapor</h2>
          <p>Cetak rapor PTS berdasarkan kelas, siswa, nilai, dan rekap kehadiran.</p>
        </div>
      </div>

      <div class="nilai-control-panel rapor-control-panel">
        <div class="rapor-control-fields">
          <label class="form-group">
            <span>Pilih kelas</span>
            <select id="raporKelasSelect" onchange="renderRaporStudentOptions()"></select>
          </label>
          <label class="form-group">
            <span>Pilih siswa</span>
            <select id="raporSiswaSelect"></select>
          </label>
          <label class="form-group">
            <span>Ukuran Kertas</span>
            <select id="raporPaperSize">
              <option value="A4" ${settings.paper === "A4" ? "selected" : ""}>A4</option>
              <option value="F4" ${settings.paper === "F4" ? "selected" : ""}>F4 / FLSA</option>
            </select>
          </label>
        </div>
        <div class="nilai-control-actions rapor-print-actions">
          <button type="button" class="btn-secondary" onclick="setRaporPaperSize()">Set</button>
          <button type="button" class="btn-primary" onclick="printSelectedRapor()">Cetak</button>
          <button type="button" class="btn-secondary" onclick="printAllRaporInClass()">Cetak Semua</button>
        </div>
      </div>

      <div id="raporInfo" class="nilai-assignment-info">Memuat data rapor...</div>
    </div>
  `;
}

function loadRealtimeCetakRapor() {
  clearCetakRaporListeners();
  const render = () => renderCetakRaporState();
  const siswaQuery = typeof getSemesterCollectionQuery === "function" ? getSemesterCollectionQuery("siswa", "nama") : db.collection("siswa").orderBy("nama");
  const kelasQuery = typeof getSemesterCollectionQuery === "function" ? getSemesterCollectionQuery("kelas") : db.collection("kelas");
  unsubscribeRaporSiswa = siswaQuery.onSnapshot(snapshot => {
    semuaDataRaporSiswa = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render();
  });
  unsubscribeRaporMapel = db.collection("mapel_bayangan").orderBy("kode_mapel").onSnapshot(snapshot => {
    semuaDataRaporMapel = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render();
  });
  unsubscribeRaporMengajar = db.collection("mengajar_bayangan").onSnapshot(snapshot => {
    semuaDataRaporMengajar = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render();
  });
  unsubscribeRaporNilai = db.collection("nilai").onSnapshot(snapshot => {
    semuaDataRaporNilai = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => typeof isActiveTermDoc === "function" ? isActiveTermDoc(item) : true);
    render();
  });
  unsubscribeRaporKelas = kelasQuery.onSnapshot(snapshot => {
    semuaDataRaporKelas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render();
  });
  unsubscribeRaporGuru = db.collection("guru").onSnapshot(snapshot => {
    semuaDataRaporGuru = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render();
  });
  unsubscribeRaporKehadiran = db.collection("kehadiran_rekap_siswa").onSnapshot(snapshot => {
    semuaDataRaporKehadiran = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(item => typeof isActiveTermDoc === "function" ? isActiveTermDoc(item) : true);
    render();
  });
  unsubscribeRaporSettings = db.collection("settings").doc("rapor").onSnapshot(snapshot => {
    raporAdminSettings = {
      ...raporAdminSettings,
      ...(snapshot.exists ? snapshot.data() : {})
    };
    render();
  });
}

function clearCetakRaporListeners() {
  [unsubscribeRaporSiswa, unsubscribeRaporMapel, unsubscribeRaporMengajar, unsubscribeRaporNilai, unsubscribeRaporKelas, unsubscribeRaporGuru, unsubscribeRaporKehadiran, unsubscribeRaporSettings].forEach(unsub => {
    if (unsub) unsub();
  });
  unsubscribeRaporSiswa = null;
  unsubscribeRaporMapel = null;
  unsubscribeRaporMengajar = null;
  unsubscribeRaporNilai = null;
  unsubscribeRaporKelas = null;
  unsubscribeRaporGuru = null;
  unsubscribeRaporKehadiran = null;
  unsubscribeRaporSettings = null;
}

function renderCetakRaporState() {
  renderRaporClassOptions();
  renderRaporStudentOptions(false);
  renderRaporPreview();
}

function renderRaporClassOptions() {
  const select = document.getElementById("raporKelasSelect");
  if (!select) return;
  const current = select.value;
  const classes = getRaporKelasList();
  select.innerHTML = classes.length
    ? classes.map(kelas => `<option value="${escapeRaporHtml(kelas)}">${escapeRaporHtml(kelas)}</option>`).join("")
    : `<option value="">Tidak ada kelas</option>`;
  const preferred = getPreferredRaporKelas();
  if (current && classes.includes(current)) select.value = current;
  else if (preferred && classes.includes(preferred)) select.value = preferred;
}

function renderRaporStudentOptions(shouldPreview = true) {
  const select = document.getElementById("raporSiswaSelect");
  if (!select) return;
  const current = select.value;
  const students = getRaporStudentsByClass(getSelectedRaporKelas());
  select.innerHTML = students.length
    ? students.map(siswa => `<option value="${escapeRaporHtml(siswa.nipd || "")}">${escapeRaporHtml(siswa.nama || "-")}</option>`).join("")
    : `<option value="">Tidak ada siswa</option>`;
  if (current && students.some(siswa => String(siswa.nipd || "") === current)) select.value = current;
  if (shouldPreview) renderRaporPreview();
}

function getSelectedRaporStudents(all = false) {
  const kelas = getSelectedRaporKelas();
  const students = getRaporStudentsByClass(kelas);
  if (all) return students;
  const nipd = document.getElementById("raporSiswaSelect")?.value || "";
  return students.filter(siswa => String(siswa.nipd || "") === String(nipd || ""));
}

function renderRaporPreview() {
  const info = document.getElementById("raporInfo");
  if (!info) return;
  const kelas = getSelectedRaporKelas();
  const students = getRaporStudentsByClass(kelas);
  const mapel = getRaporMapelForClass(kelas);
  info.innerHTML = `
    <span><strong>Kelas</strong>${escapeRaporHtml(kelas || "-")}</span>
    <span><strong>Siswa</strong>${students.length}</span>
    <span><strong>Mapel</strong>${mapel.length}</span>
    <span><strong>Semester</strong>${escapeRaporHtml(getRaporSettings().semester || "-")}</span>
    <span><strong>Tahun</strong>${escapeRaporHtml(getRaporSettings().tahun || "-")}</span>
  `;
}

function getRaporLogoCandidates() {
  return {
    left: ["img/logo_pemda.png", "img/logo.png", "img/jember.png"],
    right: ["img/logo_sekolah.png", "img/tutwuri.png", "img/kemdikbud.png"]
  };
}

function renderRaporLogo(position) {
  const candidates = getRaporLogoCandidates()[position] || [];
  const src = candidates[0] || "";
  if (!src) return `<div class="rapor-logo-placeholder"></div>`;
  return `<img src="${escapeRaporHtml(src)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';"><div class="rapor-logo-placeholder" style="display:none;"></div>`;
}

function formatRaporDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function renderRaporRows(siswa, mapelList) {
  const groups = [
    { label: "Kelompok A", rows: [] },
    { label: "Kelompok B", rows: [] }
  ];
  mapelList.forEach((mapel, index) => {
    const mapping = Number(mapel.mapping ?? index + 1);
    const groupName = String(mapel.kelompok || mapel.grup || "").toUpperCase();
    const targetGroup = groupName.includes("B") || mapping > 7 ? groups[1] : groups[0];
    targetGroup.rows.push(mapel);
  });

  let number = 1;
  return groups.map(group => {
    if (group.rows.length === 0) return "";
    const header = `<tr class="rapor-group-row"><td colspan="6">${escapeRaporHtml(group.label)}</td></tr>`;
    const rows = group.rows.map(mapel => {
      const nilai = getRaporNilai(siswa, mapel.kode_mapel || mapel.id);
      return `
        <tr>
          <td>${number++}</td>
          <td>${escapeRaporHtml(mapel.nama_mapel || mapel.kode_mapel || "-")}</td>
          <td>${escapeRaporHtml(getRaporNilaiValue(nilai, "uh_1") || "")}</td>
          <td>${escapeRaporHtml(getRaporNilaiValue(nilai, "uh_2") || "")}</td>
          <td>${escapeRaporHtml(getRaporNilaiValue(nilai, "uh_3") || "")}</td>
          <td>${escapeRaporHtml(getRaporNilaiValue(nilai, "pts") || "")}</td>
        </tr>
      `;
    }).join("");
    return header + rows;
  }).join("");
}

function renderRaporPage(siswa) {
  const settings = getRaporSettings();
  const kelas = siswa.kelasRaporParts?.kelas || getRaporKelasBayanganParts(siswa).kelas;
  const mapelList = getRaporMapelForClass(kelas, siswa);
  const wali = getRaporWaliKelas(kelas);
  const kehadiran = getRaporKehadiran(siswa);
  const nomorInduk = [siswa.nipd, siswa.nisn].filter(Boolean).join(" / ") || "-";

  return `
    <section class="rapor-print-page">
      <header class="rapor-kop">
        <div class="rapor-logo">${renderRaporLogo("left")}</div>
        <div class="rapor-kop-text">
          <h4>PEMERINTAH KABUPATEN JEMBER</h4>
          <h2>SMP NEGERI 1 UMBULSARI</h2>
          <p>Jl. PB. Sudirman No. 12 Gunungsari - Umbulsari, Kode Pos 68166. Telp. (0331) 3231441</p>
          <p>E-mail : smpnegeri1umbulsari@yahoo.com</p>
        </div>
        <div class="rapor-logo">${renderRaporLogo("right")}</div>
      </header>

      <div class="rapor-title">
        <h3>LAPORAN</h3>
        <h3>HASIL BELAJAR PESERTA DIDIK TENGAH SEMESTER ${escapeRaporHtml(String(settings.semester).toUpperCase())}</h3>
        <h3>TAHUN PELAJARAN ${escapeRaporHtml(settings.tahun)}</h3>
      </div>

      <div class="rapor-identity">
        <div><strong>NAMA PESERTA DIDIK</strong><span>:</span><b>${escapeRaporHtml(siswa.nama || "-")}</b></div>
        <div><strong>KELAS</strong><span>:</span><b>${escapeRaporHtml(formatRaporDisplayClass(kelas))}</b></div>
        <div><strong>NIPD / NISN</strong><span>:</span><b>${escapeRaporHtml(nomorInduk)}</b></div>
      </div>

      <div class="rapor-section-title">A. SIKAP</div>
      <div class="rapor-sikap-row"><strong>1. Sikap Spiritual</strong><b>: B</b></div>
      <div class="rapor-description">Memiliki ketakwaan dan toleransi beragama yang mulai berkembang</div>
      <div class="rapor-sikap-row"><strong>2. Sikap Sosial</strong><b>: B</b></div>
      <div class="rapor-description">Memiliki sifat jujur, disiplin, tanggung jawab dan sopan santun yang baik</div>

      <div class="rapor-section-title">B. NILAI</div>
      <table class="rapor-score-table">
        <thead>
          <tr>
            <th rowspan="3">NO.</th>
            <th rowspan="3">MATA PELAJARAN</th>
            <th colspan="3">PENILAIAN</th>
            <th rowspan="3">PTS</th>
          </tr>
          <tr>
            <th colspan="3">SUMATIF HARIAN</th>
          </tr>
          <tr>
            <th>1</th><th>2</th><th>3</th>
          </tr>
        </thead>
        <tbody>${renderRaporRows(siswa, mapelList)}</tbody>
      </table>

      <div class="rapor-section-title">KETIDAKHADIRAN DAN CATATAN WALI KELAS</div>
      <table class="rapor-note-table">
        <thead>
          <tr><th>No.</th><th>Ketidakhadiran</th><th>Jumlah (Hari)</th><th>Catatan Wali Kelas</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>Sakit</td><td>${escapeRaporHtml(kehadiran.s ?? 0)}</td><td rowspan="3"></td></tr>
          <tr><td>2</td><td>Izin</td><td>${escapeRaporHtml(kehadiran.i ?? 0)}</td></tr>
          <tr><td>3</td><td>Tanpa Keterangan</td><td>${escapeRaporHtml(kehadiran.a ?? 0)}</td></tr>
        </tbody>
      </table>

      <div class="rapor-signatures">
        <div>
          <span class="rapor-date-placeholder">&nbsp;</span>
          <span>Wali Murid,</span>
          <span class="rapor-signature-space"></span>
          <strong>________________</strong>
          <small>&nbsp;</small>
        </div>
        <div>
          <span class="rapor-date-placeholder">&nbsp;</span>
          <span>Wali Kelas,</span>
          <span class="rapor-signature-space"></span>
          <strong>${escapeRaporHtml(wali.nama || "-")}</strong>
          <small>NIP. ${escapeRaporHtml(wali.nip || "-")}</small>
        </div>
        <div>
          <span class="rapor-date-line">Jember, ${escapeRaporHtml(formatRaporDate(settings.tanggal))}</span>
          <span>Kepala Sekolah,</span>
          ${settings.kepala_ttd ? `<img class="rapor-signature-img" src="${escapeRaporHtml(settings.kepala_ttd)}" alt="TTD Kepala Sekolah">` : `<span class="rapor-signature-space"></span>`}
          <strong>${escapeRaporHtml(settings.kepala_nama)}</strong>
          <small>NIP. ${escapeRaporHtml(settings.kepala_nip)}</small>
        </div>
      </div>
    </section>
  `;
}

function getRaporPrintHtml(students) {
  const pages = students.map(siswa => renderRaporPage({ ...siswa, kelasRaporParts: getRaporKelasBayanganParts(siswa) })).join("");
  const settings = getRaporSettings();
  const isF4 = settings.paper === "F4";
  const paperWidth = isF4 ? "215mm" : "210mm";
  const paperHeight = isF4 ? "330mm" : "297mm";
  const pageSize = isF4 ? "215mm 330mm" : "A4";
  return `
    <!doctype html>
    <html>
      <head>
        <base href="${escapeRaporHtml(window.location.href.replace(/[^/]*$/, ""))}">
        <title>Cetak Rapor</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; }
          .rapor-print-page { width: ${paperWidth}; height: ${paperHeight}; padding: ${isF4 ? "15mm 18mm 17mm" : "13mm 16mm 16mm"}; margin: 0 auto; page-break-after: always; font-size: 12pt; display: flex; flex-direction: column; overflow: hidden; }
          .rapor-kop { display: grid; grid-template-columns: 68px 1fr 68px; align-items: center; gap: 12px; padding-bottom: 7px; border-bottom: 3px solid #111; }
          .rapor-logo { display: grid; place-items: center; height: 62px; }
          .rapor-logo img { max-width: 62px; max-height: 62px; object-fit: contain; }
          .rapor-logo-placeholder { width: 62px; height: 62px; border: 1px solid transparent; }
          .rapor-kop-text { text-align: center; line-height: 1.08; }
          .rapor-kop-text h2, .rapor-kop-text h3, .rapor-kop-text h4, .rapor-kop-text p { margin: 0; }
          .rapor-kop-text h2 { font-size: 18pt; letter-spacing: .2px; }
          .rapor-kop-text h3 { font-size: 12pt; }
          .rapor-kop-text h4 { font-size: 12pt; font-weight: 500; }
          .rapor-kop-text p { font-size: 8.6pt; line-height: 1.12; }
          .rapor-title { text-align: center; margin: 10px 0 8px; line-height: 1.08; }
          .rapor-title h3 { margin: 0; font-size: 11pt; }
          .rapor-identity { display: grid; grid-template-columns: 1fr 170px; gap: 4px 20px; margin-bottom: 7px; font-size: 9.5pt; }
          .rapor-identity div { display: grid; grid-template-columns: 118px 8px 1fr; gap: 3px; }
          .rapor-section-title { margin: 6px 0 3px; font-size: 9.8pt; font-weight: 800; }
          .rapor-sikap-row { display: flex; gap: 14px; margin: 2px 0 2px 16px; font-size: 9pt; }
          .rapor-description { border: 1px solid #555; min-height: 19px; padding: 4px 7px; margin: 0 0 4px 16px; font-size: 8.5pt; }
          table { border-collapse: collapse; width: 100%; }
          .rapor-score-table { flex: 1 1 auto; }
          .rapor-score-table th, .rapor-score-table td { border: 1px solid #333; padding: 1.6px 3.5px; font-size: 8.8pt; line-height: 1; }
          .rapor-score-table th { text-align: center; background: #efefef; font-weight: 800; }
          .rapor-score-table td { text-align: center; }
          .rapor-score-table td:nth-child(2) { text-align: left; width: 48%; }
          .rapor-group-row td { text-align: left !important; font-weight: 800; background: #f8f8f8; }
          .rapor-note-table th, .rapor-note-table td { border: 1px solid #333; padding: 2px 4px; font-size: 8.6pt; line-height: 1; }
          .rapor-note-table th { background: #f4b183; }
          .rapor-note-table td:first-child, .rapor-note-table td:nth-child(3) { text-align: center; width: 62px; }
          .rapor-note-table td:last-child { width: 42%; }
          .rapor-date-line, .rapor-date-placeholder { display: block; min-height: 12px; font-size: 9pt; text-align: center; }
          .rapor-signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 8px; text-align: center; font-size: 9pt; align-items: start; }
          .rapor-signatures div { display: grid; align-content: start; min-height: 70px; gap: 1px; }
          .rapor-signatures strong { margin-top: 0; text-decoration: underline; font-size: 8.8pt; min-height: 12px; }
          .rapor-signatures small { font-size: 8pt; min-height: 10px; }
          .rapor-signature-img { width: 84px; height: 38px; object-fit: contain; justify-self: center; }
          .rapor-signature-space { display: block; height: 38px; }
          @page { size: ${pageSize} portrait; margin: 0; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .rapor-print-page { margin: 0; page-break-after: always; }
          }
        </style>
      </head>
      <body>${pages}</body>
    </html>
  `;
}

function openRaporPrint(students) {
  if (!students.length) {
    Swal.fire("Tidak ada siswa", "Pilih siswa yang akan dicetak.", "warning");
    return;
  }
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    Swal.fire("Popup diblokir", "Izinkan popup browser untuk mencetak rapor.", "warning");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(getRaporPrintHtml(students));
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
}

function printSelectedRapor() {
  openRaporPrint(getSelectedRaporStudents(false));
}

function printAllRaporInClass() {
  openRaporPrint(getSelectedRaporStudents(true));
}

function printRaporByNipd(nipd) {
  const siswa = getRaporStudentsByClass(getSelectedRaporKelas()).filter(item => String(item.nipd || "") === String(nipd || ""));
  openRaporPrint(siswa);
}
