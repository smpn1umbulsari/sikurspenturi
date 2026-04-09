// ================= VALIDATION =================

function setError(id, message) {
  const input = document.getElementById(id);
  const err = document.getElementById("err-" + id);

  if (!input || !err) return;

  if (message) {
    input.classList.add("input-error");
    err.innerText = message;
  } else {
    input.classList.remove("input-error");
    err.innerText = "";
  }
}

function validateForm() {

  let valid = true;

  const nipd = document.getElementById("nipd").value.trim();
  const nisn = document.getElementById("nisn").value.trim();
  const nama = document.getElementById("nama").value.trim();

  // ================= NIPD =================
  if (!nipd) {
    setError("nipd", "NIPD wajib diisi");
    valid = false;

  } else if (nipd.length < 3) {
    setError("nipd", "Minimal 3 karakter");
    valid = false;

  } else if (!/^[a-zA-Z0-9]+$/.test(nipd)) {
    setError("nipd", "Hanya huruf & angka");
    valid = false;

  } else {
    const exists = semuaData.some(d => 
      d.nipd === nipd && d.nipd !== currentEdit
    );

    if (exists) {
      setError("nipd", "NIPD sudah digunakan");
      valid = false;
    } else {
      setError("nipd", "");
    }
  }


  // ================= NISN =================
  if (!nisn) {
    setError("nisn", "NISN wajib diisi");
    valid = false;

  } else if (!/^[0-9]+$/.test(nisn)) {
    setError("nisn", "Harus angka");
    valid = false;

  } else if (nisn.length !== 10) {
    setError("nisn", "Harus 10 digit");
    valid = false;

  } else {
    const exists = semuaData.some(d => 
      d.nisn === nisn && d.nipd !== currentEdit
    );

    if (exists) {
      setError("nisn", "NISN sudah digunakan");
      valid = false;
    } else {
      setError("nisn", "");
    }
  }


  // ================= NAMA =================
  if (!nama) {
    setError("nama", "Nama wajib diisi");
    valid = false;

  } else if (nama.length < 3) {
    setError("nama", "Minimal 3 karakter");
    valid = false;

  } else if (/^[0-9]+$/.test(nama)) {
    setError("nama", "Tidak boleh hanya angka");
    valid = false;

  } else {
    setError("nama", "");
  }

  return valid;
}