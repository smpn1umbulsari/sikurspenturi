// ================= FIRESTORE CRUD MAPEL =================
let activeMapelCollectionName = "mapel";

function setActiveMapelCollection(collectionName = "mapel") {
  activeMapelCollectionName = collectionName === "mapel_bayangan" ? "mapel_bayangan" : "mapel";
}

function getActiveMapelCollectionName() {
  return activeMapelCollectionName || "mapel";
}

function getActiveMapelCollection() {
  return db.collection(getActiveMapelCollectionName());
}

function getActiveMengajarCollectionForMapel() {
  return getActiveMapelCollectionName() === "mapel_bayangan" ? "mengajar_bayangan" : "mengajar";
}

async function saveMapel(data) {
  return getActiveMapelCollection().doc(data.kode_mapel).set(data);
}

async function updateMapel(kodeLama, data) {
  const kodeBaru = data.kode_mapel;

  if (kodeLama === kodeBaru) {
    return getActiveMapelCollection().doc(kodeLama).update(data);
  }

  const oldKodeNorm = String(kodeLama || "").trim().toUpperCase();
  const newKodeNorm = String(kodeBaru || "").trim().toUpperCase();
  const mengajarCollectionName = getActiveMengajarCollectionForMapel();
  const mengajarSnapshot = await db.collection(mengajarCollectionName)
    .where("mapel_kode", "==", oldKodeNorm)
    .get();
  const batch = db.batch();
  const mapelCollection = getActiveMapelCollection();
  const oldRef = mapelCollection.doc(kodeLama);
  const newRef = mapelCollection.doc(kodeBaru);

  batch.set(newRef, data);
  batch.delete(oldRef);
  mengajarSnapshot.docs.forEach(doc => {
    const mengajar = doc.data();
    const tingkat = String(mengajar.tingkat || "").trim();
    const rombel = String(mengajar.rombel || "").trim().toUpperCase();
    const newDocId = makeMengajarDocId(tingkat, rombel, newKodeNorm);
    batch.set(db.collection(mengajarCollectionName).doc(newDocId), {
      ...mengajar,
      mapel_kode: newKodeNorm,
      mapel_nama: data.nama_mapel || "",
      updated_at: new Date()
    });
    batch.delete(doc.ref);
  });

  return batch.commit();
}

async function deleteMapel(kodeMapel) {
  return getActiveMapelCollection().doc(kodeMapel).delete();
}

function listenMapel(callback) {
  return getActiveMapelCollection()
    .orderBy("kode_mapel")
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
}

function listenMapelBayangan(callback) {
  return db.collection("mapel_bayangan")
    .orderBy("kode_mapel")
    .onSnapshot(snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    });
}
