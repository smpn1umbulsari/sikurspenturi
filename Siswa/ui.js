// ================= FORM =================
function renderForm() {
  const isKoordinator = typeof canUseCoordinatorAccess === "function" && canUseCoordinatorAccess();
  const levels = typeof getCurrentCoordinatorLevelsSync === "function" ? getCurrentCoordinatorLevelsSync() : [];
  return `
    <div class="student-form-layout">
      <section class="student-form-shell">
        <div class="student-form-hero">
          <div>
            <span class="student-form-eyebrow">Input Data Siswa</span>
            <h2>Tambah data baru dengan format yang rapi dan cepat dibaca.</h2>
            <p>
              Isi identitas inti siswa, lalu simpan ke database. Form ini dibuat
              agar operator bisa fokus pada akurasi tanpa tampilan yang ramai.
            </p>
            ${isKoordinator ? `<div class="matrix-toolbar-note">Input siswa dibatasi ke jenjang ${escapeSiswaHtml(levels.length ? levels.join(", ") : "-")}.</div>` : ""}
          </div>
          <div class="student-form-hero-badge">
            <strong>6 Field</strong>
            <span>Identitas utama siswa</span>
          </div>
        </div>

        <div class="student-form-card">
          <div class="student-form-grid">
            <div class="form-group">
              <label for="nipd">NIPD</label>
              <input id="nipd" placeholder="Masukkan NIPD" oninput="validateForm()">
              <div id="err-nipd" class="error-text"></div>
            </div>

            <div class="form-group">
              <label for="nisn">NISN</label>
              <input id="nisn" placeholder="10 digit NISN" oninput="validateForm()">
              <div id="err-nisn" class="error-text"></div>
            </div>

            <div class="form-group form-group-full">
              <label for="nama">Nama Siswa</label>
              <input id="nama" placeholder="Masukkan nama lengkap siswa" oninput="validateForm()">
              <div id="err-nama" class="error-text"></div>
            </div>

            <div class="form-group">
              <label for="jk">Jenis Kelamin</label>
              <select id="jk" onchange="validateForm()">
                <option value="">Pilih jenis kelamin</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            <div class="form-group">
              <label for="agama">Agama</label>
              <select id="agama">
                <option value="">Pilih agama</option>
                <option>Islam</option>
                <option>Kristen</option>
                <option>Katolik</option>
                <option>Hindu</option>
                <option>Buddha</option>
                <option>Konghucu</option>
              </select>
            </div>

            <div class="form-group form-group-full">
              <label for="kelas">Kelas</label>
              <select id="kelas">
                ${renderSiswaKelasOptions()}
              </select>
            </div>
          </div>

          <div class="student-form-actions">
            <button id="btnSimpan" class="btn-primary" onclick="simpanData()">
              Simpan Data
            </button>
            <span class="student-form-helper">Pastikan NIPD dan NISN tidak duplikat sebelum menyimpan.</span>
          </div>
        </div>
      </section>

      <aside class="student-form-sidepanel">
        <div class="student-side-card">
          <span class="student-side-label">Checklist Cepat</span>
          <ul>
            <li>NIPD wajib diisi dan unik</li>
            <li>NISN harus 10 digit angka</li>
            <li>Nama siswa minimal 3 karakter</li>
            <li>Kelas boleh ditulis dengan spasi atau tanpa spasi</li>
          </ul>
        </div>

        <div class="student-side-card student-side-card-accent">
          <span class="student-side-label">Tips Operator</span>
          <p>
            Gunakan format penulisan nama yang konsisten agar pencarian dan proses
            import data berikutnya lebih mudah dicocokkan.
          </p>
        </div>
      </aside>
    </div>
  `;
}

function renderSortableHeader(label, field, sortField, sortDirection, handlerName) {
  const isActive = sortField === field;
  const indicator = isActive ? (sortDirection === "asc" ? " ▲" : " ▼") : "";
  return `<th class="sortable-header ${isActive ? "active" : ""}" onclick="${handlerName}('${field}')">${label}${indicator}</th>`;
}


// ================= TABLE =================
function escapeSiswaHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeSiswaJs(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function updateFilterUI() {
  const rows = document.getElementById("rowsPerPage");
  if (rows) rows.value = String(rowsPerPage);
}

function renderTable() {
  const isKoordinator = typeof canUseCoordinatorAccess === "function" && canUseCoordinatorAccess();
  const levels = typeof getCurrentCoordinatorLevelsSync === "function" ? getCurrentCoordinatorLevelsSync() : [];
  return `
    <div class="card">

      <h2>Data Siswa</h2>
      ${isKoordinator ? `<div class="matrix-toolbar-note">Akses koordinator dibatasi ke jenjang ${escapeSiswaHtml(levels.length ? levels.join(", ") : "-")}.</div>` : ""}

      <!-- TOOLBAR -->
      <div class="toolbar">

        <!-- SEARCH -->
        <div class="toolbar-left">
          <input id="search" placeholder="🔍 Cari siswa..." oninput="handleSearch(); updateFilterUI()">
        </div>

        <!-- FILTER + ACTION -->
        <div class="toolbar-right">
          ${isKoordinator ? "" : `
            <button class="btn-secondary" onclick="downloadSiswaTemplate()">
              Download Template
            </button>
          `}

          <select id="filterTingkat" onchange="handleTingkatFilterChange()">
            <option value="">Semua Tingkat</option>
            <option value="7">Tingkat 7</option>
            <option value="8">Tingkat 8</option>
            <option value="9">Tingkat 9</option>
          </select>

          <select id="filterKelas" onchange="applyFilters()">
            <option value="">Semua Kelas</option>
          </select>

          <select id="filterJK" onchange="applyFilters(); updateFilterUI()">
            <option value="">Semua JK</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>

          <select id="filterAgama" onchange="applyFilters(); updateFilterUI()">
            <option value="">Semua Agama</option>
            <option>Islam</option>
            <option>Kristen</option>
            <option>Katolik</option>
            <option>Hindu</option>
            <option>Buddha</option>
            <option>Konghucu</option>
          </select>

          ${isKoordinator ? "" : `
            <label class="btn-upload">
              Import
              <input type="file" accept=".xlsx, .xls" onchange="importExcel(event)">
            </label>
          `}
        </div>
      </div>

      <!-- INFO -->
      <div class="toolbar-info">
        <span id="jumlahData">0 siswa</span>
        <div class="page-size-control">
          <label for="rowsPerPage">Tampilkan</label>
          <select id="rowsPerPage" onchange="setRowsPerPage(this.value)">
            <option value="10" selected>10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="all">Semuanya</option>
          </select>
          <button class="btn-secondary" onclick="refreshSiswaTable()">Refresh</button>
        </div>
      </div>

      <!-- TABLE -->
      <div class="table-container siswa-table-container">
        <table class="siswa-compact-table">
          <thead>
            <tr>
              ${renderSortableHeader("NIPD", "nipd", siswaSortField, siswaSortDirection, "setSiswaSort")}
              ${renderSortableHeader("NISN", "nisn", siswaSortField, siswaSortDirection, "setSiswaSort")}
              ${renderSortableHeader("Nama", "nama", siswaSortField, siswaSortDirection, "setSiswaSort")}
              ${renderSortableHeader("JK", "jk", siswaSortField, siswaSortDirection, "setSiswaSort")}
              ${renderSortableHeader("Agama", "agama", siswaSortField, siswaSortDirection, "setSiswaSort")}
              ${renderSortableHeader("Kelas", "kelas", siswaSortField, siswaSortDirection, "setSiswaSort")}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>

        <!-- EMPTY STATE -->
        <div id="emptyState" style="display:none; text-align:center; padding:20px; color:#64748b;">
          Tidak ada data
        </div>
      </div>

      <div id="tablePagination" class="pagination-wrap"></div>

    </div>

    <div id="previewModal" class="preview-modal" style="display:none;" onclick="handlePreviewBackdrop(event)">
      <div class="preview-modal-content">
        <div id="previewContainer"></div>
      </div>
    </div>
  `;
}


// ================= ROW =================
function renderRow(d) {
  const isKoordinator = typeof canUseCoordinatorAccess === "function" && canUseCoordinatorAccess();
  const nipd = String(d.nipd || "");
  const safeNipd = escapeSiswaHtml(nipd);
  const safeNipdJs = escapeSiswaJs(nipd);

  if (currentEdit === d.nipd) {
    return `
      <tr class="table-edit-row" data-siswa-nipd="${safeNipd}">
        <td>${safeNipd}</td>
        <td><input id="nisn-${safeNipd}" value="${escapeSiswaHtml(d.nisn || "")}"></td>
        <td><input id="nama-${safeNipd}" value="${escapeSiswaHtml(d.nama || "")}"></td>

        <td>
          <select id="jk-${safeNipd}">
            <option value="L" ${d.jk==="L"?"selected":""}>L</option>
            <option value="P" ${d.jk==="P"?"selected":""}>P</option>
          </select>
        </td>

        <td>
          <select id="agama-${safeNipd}">
            ${renderAgamaOptions(d.agama)}
          </select>
        </td>

        <td>
          <select id="kelas-${safeNipd}">
            ${renderSiswaKelasOptions(d.kelas || "")}
          </select>
        </td>

        <td>
          <div class="table-actions">
            <button onclick="saveEdit('${safeNipdJs}')" class="btn-primary btn-table-compact">Simpan</button>
            <button onclick="cancelEdit()" class="btn-secondary btn-table-compact">Batal</button>
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr data-siswa-nipd="${safeNipd}">
      <td>${escapeSiswaHtml(d.nipd || "-")}</td>
      <td>${escapeSiswaHtml(d.nisn || "-")}</td>
      <td>${escapeSiswaHtml(d.nama || "-")}</td>
      <td>${escapeSiswaHtml(d.jk || "-")}</td>
      <td>${escapeSiswaHtml(d.agama || "-")}</td>
      <td>${escapeSiswaHtml(d.kelas || "-")}</td>
      <td>
        ${d.nipd ? `
          <button class="btn-secondary btn-table-compact" onclick="editRow('${safeNipdJs}')">
            Edit
          </button>
        ` : `
          <button class="btn-secondary btn-table-compact" disabled>
            Edit
          </button>
        `}

        <button class="btn-danger btn-table-compact" onclick="hapusData('${safeNipdJs}')">
          Hapus
        </button>
      </td>
    </tr>
  `;
}


// ================= HELPER =================
function renderAgamaOptions(selected) {
  const list = ["Islam","Kristen","Katolik","Hindu","Buddha","Konghucu"];
  return list.map(a =>
    `<option ${a===selected?"selected":""}>${a}</option>`
  ).join("");
}
