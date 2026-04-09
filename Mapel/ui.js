// ================= UI MAPEL =================
function renderMapelPage() {
  const isBayangan = typeof getActiveMapelCollectionName === "function" && getActiveMapelCollectionName() === "mapel_bayangan";
  return `
    <div class="card">
      <h2>${isBayangan ? "Data Mata Pelajaran Kelas Bayangan" : "Data Mata Pelajaran"}</h2>

      <div class="toolbar">
        <div class="toolbar-left">
          ${isBayangan ? `<span class="mapel-row-hint">Disalin dari Data Mapel asli. Yang bisa diubah hanya JP.</span>` : ""}
        </div>
        <div class="toolbar-right">
          ${isBayangan ? `
            <button class="btn-secondary" onclick="syncMapelBayanganManual()">Sinkron dari Data Mapel Asli</button>
          ` : `
            <button class="btn-secondary" onclick="downloadMapelTemplate()">Download Template</button>
            <label class="btn-upload">
              Import
              <input type="file" accept=".xlsx, .xls" onchange="importMapelExcel(event)">
            </label>
          `}
        </div>
      </div>

      <div class="toolbar-info">
        <span id="jumlahDataMapel">0 mapel</span>
      </div>

      <div class="table-container mapel-table-container">
        <table class="mapel-table">
          <thead>
            <tr>
              ${renderSortableHeader("No", "mapping", mapelSortField, mapelSortDirection, "setMapelSort")}
              ${renderSortableHeader("Induk", "induk_mapel", mapelSortField, mapelSortDirection, "setMapelSort")}
              ${renderSortableHeader("Kode Mapel", "kode_mapel", mapelSortField, mapelSortDirection, "setMapelSort")}
              ${renderSortableHeader("Nama Mapel", "nama_mapel", mapelSortField, mapelSortDirection, "setMapelSort")}
              ${renderSortableHeader("JP", "jp", mapelSortField, mapelSortDirection, "setMapelSort")}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="tbodyMapel"></tbody>
        </table>

        <div id="emptyStateMapel" style="display:none; text-align:center; padding:20px; color:#64748b;">
          Tidak ada data mata pelajaran
        </div>
      </div>

    </div>
  `;
}
