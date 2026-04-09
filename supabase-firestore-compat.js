(function () {
  const config = window.supabaseConfig || {};
  if (!window.supabase || !config.url || !config.anonKey || config.url.includes("YOUR-PROJECT-REF")) {
    throw new Error("Konfigurasi Supabase belum diisi di supabase-config.js");
  }

  const TABLE = config.documentsTable || "app_documents";
  const client = window.supabase.createClient(config.url, config.anonKey);

  function makeChannelName(prefix, path) {
    const randomId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}:${path.replace(/[^a-zA-Z0-9_-]/g, "-")}:${randomId}`;
  }

  function cleanObject(value) {
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(cleanObject);
    if (!value || typeof value !== "object") return value;
    if (typeof value.toDate === "function") return value.toDate().toISOString();
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, cleanObject(item)])
    );
  }

  function compareValue(a, b) {
    const left = a === undefined || a === null ? "" : a;
    const right = b === undefined || b === null ? "" : b;
    if (typeof left === "number" && typeof right === "number") return left - right;
    return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  }

  function matchesWhere(row, filter) {
    const value = row?.data?.[filter.field];
    if (filter.op === "==") return String(value ?? "") === String(filter.value ?? "");
    if (filter.op === "!=") return String(value ?? "") !== String(filter.value ?? "");
    if (filter.op === ">") return value > filter.value;
    if (filter.op === ">=") return value >= filter.value;
    if (filter.op === "<") return value < filter.value;
    if (filter.op === "<=") return value <= filter.value;
    if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(value);
    return false;
  }

  class SupabaseFirestoreDocumentSnapshot {
    constructor(ref, row) {
      this.ref = ref;
      this.id = ref.id;
      this.exists = Boolean(row);
      this._data = row ? { ...(row.data || {}) } : undefined;
    }

    data() {
      return this._data ? { ...this._data } : undefined;
    }
  }

  class SupabaseFirestoreQuerySnapshot {
    constructor(docs) {
      this.docs = docs;
      this.empty = docs.length === 0;
      this.size = docs.length;
    }

    forEach(callback) {
      this.docs.forEach(callback);
    }
  }

  class SupabaseFirestoreQuery {
    constructor(collectionPath, options = {}) {
      this.collectionPath = collectionPath;
      this._where = options.where || [];
      this._order = options.order || null;
      this._limit = options.limit || null;
    }

    where(field, op, value) {
      return new SupabaseFirestoreQuery(this.collectionPath, {
        where: [...this._where, { field, op, value }],
        order: this._order,
        limit: this._limit
      });
    }

    orderBy(field, direction = "asc") {
      return new SupabaseFirestoreQuery(this.collectionPath, {
        where: this._where,
        order: { field, direction },
        limit: this._limit
      });
    }

    limit(count) {
      return new SupabaseFirestoreQuery(this.collectionPath, {
        where: this._where,
        order: this._order,
        limit: count
      });
    }

    async get() {
      const { data, error } = await client
        .from(TABLE)
        .select("id,data")
        .eq("collection_path", this.collectionPath);

      if (error) throw error;

      let rows = (data || []).filter(row => this._where.every(filter => matchesWhere(row, filter)));
      if (this._order) {
        const { field, direction } = this._order;
        rows = [...rows].sort((a, b) => {
          const result = compareValue(a?.data?.[field], b?.data?.[field]);
          return String(direction).toLowerCase() === "desc" ? -result : result;
        });
      }
      if (this._limit !== null) rows = rows.slice(0, Number(this._limit) || 0);

      return new SupabaseFirestoreQuerySnapshot(
        rows.map(row => new SupabaseFirestoreDocumentSnapshot(new SupabaseFirestoreDocumentReference(this.collectionPath, row.id), row))
      );
    }

    onSnapshot(callback, onError) {
      let active = true;
      const refresh = async () => {
        if (!active) return;
        try {
          callback(await this.get());
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
        }
      };

      refresh();
      const channel = client
        .channel(makeChannelName("app-documents", this.collectionPath))
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, payload => {
          const path = payload.new?.collection_path || payload.old?.collection_path;
          if (path === this.collectionPath) refresh();
        })
        .subscribe();

      return () => {
        active = false;
        client.removeChannel(channel);
      };
    }
  }

  class SupabaseFirestoreCollectionReference extends SupabaseFirestoreQuery {
    constructor(collectionPath) {
      super(collectionPath);
      this.path = collectionPath;
    }

    doc(id) {
      return new SupabaseFirestoreDocumentReference(this.collectionPath, id);
    }
  }

  class SupabaseFirestoreDocumentReference {
    constructor(collectionPath, id) {
      this.collectionPath = collectionPath;
      this.id = String(id || "");
      this.path = `${collectionPath}/${this.id}`;
    }

    collection(name) {
      return new SupabaseFirestoreCollectionReference(`${this.collectionPath}/${this.id}/${name}`);
    }

    async get() {
      const { data, error } = await client
        .from(TABLE)
        .select("id,data")
        .eq("collection_path", this.collectionPath)
        .eq("id", this.id)
        .maybeSingle();

      if (error) throw error;
      return new SupabaseFirestoreDocumentSnapshot(this, data);
    }

    async set(data, options = {}) {
      const payloadData = cleanObject(data || {});
      let nextData = payloadData;

      if (options?.merge) {
        const existing = await this.get();
        nextData = { ...(existing.data() || {}), ...payloadData };
      }

      const { error } = await client
        .from(TABLE)
        .upsert({
          collection_path: this.collectionPath,
          id: this.id,
          data: nextData,
          updated_at: new Date().toISOString()
        }, { onConflict: "collection_path,id" });

      if (error) throw error;
    }

    async update(data) {
      return this.set(data, { merge: true });
    }

    async delete() {
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq("collection_path", this.collectionPath)
        .eq("id", this.id);

      if (error) throw error;
    }

    onSnapshot(callback, onError) {
      let active = true;
      const refresh = async () => {
        if (!active) return;
        try {
          callback(await this.get());
        } catch (error) {
          if (onError) onError(error);
          else console.error(error);
        }
      };

      refresh();
      const channel = client
        .channel(makeChannelName("app-document", this.path))
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, payload => {
          const path = payload.new?.collection_path || payload.old?.collection_path;
          const id = payload.new?.id || payload.old?.id;
          if (path === this.collectionPath && id === this.id) refresh();
        })
        .subscribe();

      return () => {
        active = false;
        client.removeChannel(channel);
      };
    }
  }

  class SupabaseFirestoreBatch {
    constructor() {
      this.operations = [];
    }

    set(ref, data, options) {
      this.operations.push(() => ref.set(data, options));
      return this;
    }

    update(ref, data) {
      this.operations.push(() => ref.update(data));
      return this;
    }

    delete(ref) {
      this.operations.push(() => ref.delete());
      return this;
    }

    async commit() {
      for (const operation of this.operations) {
        await operation();
      }
    }
  }

  const firestoreCompat = {
    collection(name) {
      return new SupabaseFirestoreCollectionReference(name);
    },
    batch() {
      return new SupabaseFirestoreBatch();
    }
  };

  window.supabaseClient = client;
  window.db = firestoreCompat;
  window.firebase = {
    firestore() {
      return firestoreCompat;
    }
  };
  window.firebase.firestore.Timestamp = {
    fromDate(date) {
      return {
        toDate() {
          return date;
        },
        toJSON() {
          return date.toISOString();
        }
      };
    }
  };
})();
