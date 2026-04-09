// ================= VALIDATION GURU =================

function setGuruError(id, message) {
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

function validateGuruForm() {
  let valid = true;

  const kodeGuru = document.getElementById("kodeGuru").value.trim();
  const nama = document.getElementById("namaGuru").value.trim();
  const nip = document.getElementById("nipGuru").value.trim();
  const mapel = document.getElementById("mapelGuru").value.trim();

  if (!kodeGuru) {
    setGuruError("kodeGuru", "Kode guru wajib diisi");
    valid = false;
  } else if (!/^[a-zA-Z0-9.-]+$/.test(kodeGuru)) {
    setGuruError("kodeGuru", "Gunakan huruf, angka, titik, atau strip");
    valid = false;
  } else {
    const exists = semuaDataGuru.some(d => d.kode_guru === kodeGuru && d.kode_guru !== currentEditGuru);
    if (exists) {
      setGuruError("kodeGuru", "Kode guru sudah digunakan");
      valid = false;
    } else {
      setGuruError("kodeGuru", "");
    }
  }

  if (!nama) {
    setGuruError("namaGuru", "Nama wajib diisi");
    valid = false;
  } else if (nama.length < 3) {
    setGuruError("namaGuru", "Minimal 3 karakter");
    valid = false;
  } else if (/^[0-9]+$/.test(nama)) {
    setGuruError("namaGuru", "Nama tidak boleh hanya angka");
    valid = false;
  } else {
    setGuruError("namaGuru", "");
  }

  if (!nip) {
    setGuruError("nipGuru", "NIP wajib diisi");
    valid = false;
  } else if (!/^[0-9]+$/.test(nip)) {
    setGuruError("nipGuru", "NIP harus berupa angka");
    valid = false;
  } else {
    const exists = semuaDataGuru.some(d => d.nip === nip && d.kode_guru !== currentEditGuru);
    if (exists) {
      setGuruError("nipGuru", "NIP sudah digunakan");
      valid = false;
    } else {
      setGuruError("nipGuru", "");
    }
  }

  if (!mapel) {
    setGuruError("mapelGuru", "Mata pelajaran wajib diisi");
    valid = false;
  } else {
    setGuruError("mapelGuru", "");
  }

  return valid;
}
