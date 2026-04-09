// ================= FIRESTORE CRUD KELAS =================

async function saveKelas(data) {
  const ref = typeof getSemesterDocRef === "function"
    ? getSemesterDocRef("kelas", data.kelas)
    : db.collection("kelas").doc(data.kelas);
  return ref.set(data);
}

async function updateKelas(kelasLama, data) {
  const kelasBaru = data.kelas;

  if (kelasLama === kelasBaru) {
    const ref = typeof getSemesterDocRef === "function"
      ? getSemesterDocRef("kelas", kelasLama)
      : db.collection("kelas").doc(kelasLama);
    return ref.update(data);
  }

  const batch = db.batch();
  const oldRef = typeof getSemesterDocRef === "function"
    ? getSemesterDocRef("kelas", kelasLama)
    : db.collection("kelas").doc(kelasLama);
  const newRef = typeof getSemesterDocRef === "function"
    ? getSemesterDocRef("kelas", kelasBaru)
    : db.collection("kelas").doc(kelasBaru);

  batch.set(newRef, data);
  batch.delete(oldRef);

  return batch.commit();
}

async function deleteKelas(kelas) {
  const ref = typeof getSemesterDocRef === "function"
    ? getSemesterDocRef("kelas", kelas)
    : db.collection("kelas").doc(kelas);
  return ref.delete();
}

function listenKelas(callback) {
  const query = typeof getSemesterCollectionQuery === "function"
    ? getSemesterCollectionQuery("kelas", "kelas")
    : db.collection("kelas").orderBy("kelas");
  return query
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
}
