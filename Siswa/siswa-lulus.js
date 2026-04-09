let semuaDataSiswaLulus = [];
let unsubscribeSiswaLulus = null;
let siswaLulusSearch = "";
let siswaLulusTahun = "";

function escapeSiswaLulusHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSiswaLulusPage() {
  const tahunOptions = [...new Set(semuaDataSiswaLulus.map(item => item.tahun_pelajaran_lulus).filter(Boolean))]
    .sort((a, b) => String(b).localeCompare(String(a), undefined, { numeric: true }));
  return `
    <div class="card">
      <div class="kelas-bayangan-head nilai-page-head">
        <div>
          <span class="dashboard-eyebrow">Data Siswa</span>
          <h2>Siswa Lulus</h2>
          <p>Daftar siswa kelas 9 yang otomatis dikeluarkan saat pergantian tahun pelajaran.</p>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <input id="siswaLulusSearch" placeholder="Cari nama / NIPD / NISN" value="${escapeSiswaLulusHtml(siswaLulusSearch)}" oninput="setSiswaLulusSearch(this.value)">
        </div>
        <div class="toolbar-right">
          <select id="siswaLulusTahun" onchange="setSiswaLulusTahun(this.value)">
            <option value="">Semua Tahun Pelajaran</option>
            ${tahunOptions.map(tahun => `<option value="${escapeSiswaLulusHtml(tahun)}" ${tahun === siswaLulusTahun ? "selected" : ""}>${escapeSiswaLulusHtml(tahun)}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>NIPD</th>
              <th>NISN</th>
              <th>Nama</th>
              <th>JK</th>
              <th>Kelas Lulus</th>
              <th>Tahun Pelajaran</th>
            </tr>
          </thead>
          <tbody>
            ${renderSiswaLulusRows()}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getFilteredSiswaLulus() {
  const keyword = String(siswaLulusSearch || "").trim().toLowerCase();
  return semuaDataSiswaLulus
    .filter(item => {
      const matchSearch = !keyword ||
        String(item.nama || "").toLowerCase().includes(keyword) ||
        String(item.nipd || "").toLowerCase().includes(keyword) ||
        String(item.nisn || "").toLowerCase().includes(keyword);
      const matchTahun = !siswaLulusTahun || String(item.tahun_pelajaran_lulus || "") === siswaLulusTahun;
      return matchSearch && matchTahun;
    })
    .sort((a, b) =>
      String(b.tahun_pelajaran_lulus || "").localeCompare(String(a.tahun_pelajaran_lulus || ""), undefined, { numeric: true }) ||
      String(a.kelas_lulus || "").localeCompare(String(b.kelas_lulus || ""), undefined, { numeric: true, sensitivity: "base" }) ||
      String(a.nama || "").localeCompare(String(b.nama || ""), undefined, { sensitivity: "base" })
    );
}

function renderSiswaLulusRows() {
  const rows = getFilteredSiswaLulus();
  if (rows.length === 0) return `<tr><td colspan="7">Belum ada siswa lulus.</td></tr>`;
  return rows.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeSiswaLulusHtml(item.nipd || "-")}</td>
      <td>${escapeSiswaLulusHtml(item.nisn || "-")}</td>
      <td>${escapeSiswaLulusHtml(item.nama || "-")}</td>
      <td>${escapeSiswaLulusHtml(item.jk || "-")}</td>
      <td>${escapeSiswaLulusHtml(item.kelas_lulus || item.kelas || "-")}</td>
      <td>${escapeSiswaLulusHtml(item.tahun_pelajaran_lulus || "-")}</td>
    </tr>
  `).join("");
}

function renderSiswaLulusState() {
  const content = document.getElementById("content");
  if (content) content.innerHTML = renderSiswaLulusPage();
}

function setSiswaLulusSearch(value) {
  siswaLulusSearch = value || "";
  renderSiswaLulusState();
}

function setSiswaLulusTahun(value) {
  siswaLulusTahun = value || "";
  renderSiswaLulusState();
}

function loadRealtimeSiswaLulus() {
  clearSiswaLulusListeners();
  unsubscribeSiswaLulus = db.collection("siswa_lulus").onSnapshot(snapshot => {
    semuaDataSiswaLulus = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderSiswaLulusState();
  });
}

function clearSiswaLulusListeners() {
  if (unsubscribeSiswaLulus) {
    unsubscribeSiswaLulus();
    unsubscribeSiswaLulus = null;
  }
}
