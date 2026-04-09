// ================= FIRESTORE CRUD =================

async function saveSiswa(data) {
  const ref = typeof getSemesterDocRef === "function"
    ? getSemesterDocRef("siswa", data.nipd)
    : db.collection("siswa").doc(data.nipd);
  return ref.set(data);
}

async function updateSiswa(nipd, data) {
  const ref = typeof getSemesterDocRef === "function"
    ? getSemesterDocRef("siswa", nipd)
    : db.collection("siswa").doc(nipd);
  return ref.update(data);
}

async function deleteSiswa(nipd) {
  const ref = typeof getSemesterDocRef === "function"
    ? getSemesterDocRef("siswa", nipd)
    : db.collection("siswa").doc(nipd);
  return ref.delete();
}

function listenSiswa(callback) {
  const query = typeof getSemesterCollectionQuery === "function"
    ? getSemesterCollectionQuery("siswa", "nama")
    : db.collection("siswa").orderBy("nama");
  return query
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
}
