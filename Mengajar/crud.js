// ================= FIRESTORE CRUD MENGAJAR =================

function makeMengajarDocId(tingkat, rombel, mapelKode) {
  return `${String(tingkat || '').trim()}_${String(rombel || '').trim().toUpperCase()}_${String(mapelKode || '').trim().toUpperCase()}`;
}

async function saveMengajar(data) {
  const docId = makeMengajarDocId(data.tingkat, data.rombel, data.mapel_kode);
  return db.collection("mengajar").doc(docId).set(data);
}

async function deleteMengajar(tingkat, rombel, mapelKode) {
  const docId = makeMengajarDocId(tingkat, rombel, mapelKode);
  return db.collection("mengajar").doc(docId).delete();
}

function listenMengajar(callback) {
  return db.collection("mengajar")
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
}
