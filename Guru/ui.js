// ================= UI GURU =================
function renderGuruForm() {
  return `
    <div class="student-form-layout">
      <section class="student-form-shell teacher-form-shell">
        <div class="student-form-hero teacher-form-hero">
          <div>
            <span class="student-form-eyebrow teacher-form-eyebrow">Input Data Guru</span>
            <h2>Susun identitas guru dengan format profesional dan mudah dicek ulang.</h2>
            <p>
              Simpan data inti guru agar daftar pengajar tetap konsisten, mudah dicari,
              dan siap dipakai untuk kebutuhan administrasi sekolah.
            </p>
          </div>
          <div class="student-form-hero-badge teacher-form-badge">
            <strong>7 Field</strong>
            <span>Profil utama guru</span>
          </div>
        </div>

        <div class="student-form-card">
          <div class="student-form-grid">
            <div class="form-group">
              <label for="kodeGuru">Kode Guru</label>
              <input id="kodeGuru" placeholder="Masukkan kode guru" oninput="validateGuruForm()">
              <div id="err-kodeGuru" class="error-text"></div>
            </div>

            <div class="form-group">
              <label for="nipGuru">NIP</label>
              <input id="nipGuru" placeholder="Masukkan NIP" oninput="validateGuruForm()">
              <div id="err-nipGuru" class="error-text"></div>
            </div>

            <div class="form-group">
              <label for="statusGuru">Status</label>
              <select id="statusGuru">
                ${renderGuruStatusOptions("PNS")}
              </select>
            </div>

            <div class="form-group form-group-full">
              <label for="namaGuru">Nama Tanpa Gelar</label>
              <input id="namaGuru" placeholder="Masukkan nama tanpa gelar" oninput="validateGuruForm()">
              <div id="err-namaGuru" class="error-text"></div>
            </div>

            <div class="form-group">
              <label for="gelarDepanGuru">Gelar Depan</label>
              <input id="gelarDepanGuru" placeholder="Contoh: Drs.">
            </div>

            <div class="form-group">
              <label for="gelarBelakangGuru">Gelar Belakang</label>
              <input id="gelarBelakangGuru" placeholder="Contoh: S.Pd.">
            </div>

            <div class="form-group form-group-full">
              <label for="mapelGuru">Mata Pelajaran</label>
              <select id="mapelGuru" onchange="validateGuruForm()">
                ${renderGuruMapelOptions()}
              </select>
              <div id="err-mapelGuru" class="error-text"></div>
            </div>
          </div>

          <div class="student-form-actions">
            <button id="btnSimpanGuru" class="btn-primary" onclick="simpanGuruData()">
              Simpan Data Guru
            </button>
            <span class="student-form-helper">Nama pada tabel akan otomatis ditampilkan beserta gelar depan dan belakang.</span>
          </div>
        </div>
      </section>

      <aside class="student-form-sidepanel">
        <div class="student-side-card teacher-side-card">
          <span class="student-side-label teacher-side-label">Checklist Cepat</span>
          <ul>
            <li>Kode guru wajib unik</li>
            <li>Nama disimpan tanpa gelar</li>
            <li>Gelar depan dan belakang boleh kosong</li>
            <li>NIP harus berupa angka</li>
            <li>Status default adalah PNS</li>
            <li>Mata pelajaran wajib diisi</li>
          </ul>
        </div>

        <div class="student-side-card student-side-card-accent teacher-side-card-accent">
          <span class="student-side-label teacher-side-label">Tampilan Otomatis</span>
          <p>
            Saat data ditampilkan, nama guru akan dirangkai otomatis menjadi format lengkap,
            misalnya gelar depan, nama, lalu gelar belakang.
          </p>
        </div>
      </aside>
    </div>
  `;
}

function renderGuruTable() {
  return `
    <div class="card">
      <h2>Data Guru</h2>

      <div class="toolbar">
        <div class="toolbar-left">
          <input id="searchGuru" placeholder="Cari guru, kode, NIP, status, atau mapel..." oninput="handleGuruSearch()">
        </div>
        <div class="toolbar-right">
          <button class="btn-secondary" onclick="downloadGuruTemplate()">Download Template</button>
          <label class="btn-upload">
            Import
            <input type="file" accept=".xlsx, .xls" onchange="importGuruExcel(event)">
          </label>
        </div>
      </div>

      <div class="toolbar-info">
        <span id="jumlahDataGuru">0 guru</span>
        <div class="page-size-control">
          <label for="rowsPerPageGuru">Tampilkan</label>
          <select id="rowsPerPageGuru" onchange="setGuruRowsPerPage(this.value)">
            <option value="10" selected>10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="all">Semuanya</option>
          </select>
          <button class="btn-secondary" onclick="refreshGuruTable()">Refresh</button>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              ${renderSortableHeader("Kode Guru", "kode_guru", guruSortField, guruSortDirection, "setGuruSort")}
              ${renderSortableHeader("Nama dengan Gelar", "nama_lengkap", guruSortField, guruSortDirection, "setGuruSort")}
              ${renderSortableHeader("NIP", "nip", guruSortField, guruSortDirection, "setGuruSort")}
              ${renderSortableHeader("Status", "status", guruSortField, guruSortDirection, "setGuruSort")}
              ${renderSortableHeader("Mata Pelajaran", "mata_pelajaran", guruSortField, guruSortDirection, "setGuruSort")}
              ${renderSortableHeader("JP", "jp", guruSortField, guruSortDirection, "setGuruSort")}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="tbodyGuru"></tbody>
        </table>

        <div id="emptyStateGuru" style="display:none; text-align:center; padding:20px; color:#64748b;">
          Tidak ada data guru
        </div>
      </div>

      <div id="tablePaginationGuru" class="pagination-wrap"></div>
    </div>
  `;
}
