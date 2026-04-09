// ================= UI MENGAJAR =================
function renderMengajarPage() {
  return `
    <div class="card">
      <h2>Pembagian Mengajar Guru</h2>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="page-size-control">
            <label for="tingkatMengajar">Tingkat</label>
            <select id="tingkatMengajar" onchange="setMengajarTingkat(this.value)">
              <option value="7" ${mengajarSelectedTingkat === "7" ? "selected" : ""}>7</option>
              <option value="8" ${mengajarSelectedTingkat === "8" ? "selected" : ""}>8</option>
              <option value="9" ${mengajarSelectedTingkat === "9" ? "selected" : ""}>9</option>
            </select>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn-secondary" onclick="syncMengajarAsliFromBayangan()">Sinkron dari Kelas Bayangan</button>
          <button class="btn-secondary" onclick="downloadMengajarTemplate()">Download Template</button>
          <label class="btn-upload">
            Import
            <input type="file" accept=".xlsx, .xls" onchange="importMengajarExcel(event)">
          </label>
          <button class="btn-primary" onclick="saveAllMengajar()">Simpan Semua</button>
        </div>
      </div>

      <div class="toolbar-info">
        <span id="jumlahMengajarInfo">0 mapel x 0 kelas</span>
        <div class="page-size-control">
          <span id="pendingMengajarInfo">0 perubahan belum disimpan</span>
          <button class="btn-secondary" onclick="refreshMengajarPage()">Refresh</button>
        </div>
      </div>

      <div class="matrix-search-bar">
        <select id="mengajarSearchInput" class="matrix-search-input" onchange="handleMengajarSearchInput(this.value)" onkeydown="handleMengajarSearchKeydown(event)">
          ${getMengajarSearchGuruOptions(false, mengajarSearchDraft)}
        </select>
        <button class="btn-secondary" onclick="submitMengajarSearch()">Cari</button>
        <button class="btn-secondary" onclick="clearMengajarSearch()">Reset</button>
        <small id="mengajarSearchInfo" class="matrix-search-info">Pilih nama guru untuk menyorot posisinya di matriks.</small>
      </div>

      <div class="matrix-toolbar-note">
        Dropdown tabel menampilkan kode guru agar matriks lebih ramping. PABP yang tidak sesuai agama siswa di kelas akan disamarkan.
      </div>

      <div id="mengajarMatrixContainer"></div>
    </div>
  `;
}
