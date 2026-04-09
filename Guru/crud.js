// ================= FIRESTORE CRUD GURU =================

async function saveGuru(data) {
  return db.collection("guru").doc(data.kode_guru).set(data);
}

async function updateGuru(kodeGuru, data) {
  return db.collection("guru").doc(kodeGuru).update(data);
}

async function deleteGuru(kodeGuru) {
  return db.collection("guru").doc(kodeGuru).delete();
}

function listenGuru(callback) {
  return db.collection("guru")
    .orderBy("kode_guru")
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => doc.data());
      callback(data);
    });
}
