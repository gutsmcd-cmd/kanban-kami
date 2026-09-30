let database: IDBDatabase | null = null;

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onerror = () => reject(req.error ?? new Error('idb'));
    req.onsuccess = () => resolve(req.result);
  });
}

/** Best-effort persistent storage, then open this app's IndexedDB. */
export async function initDb(name: string): Promise<boolean> {
  try {
    const storage = navigator.storage;
    if (storage && typeof storage.persist === 'function') await storage.persist();
  } catch {
    /* persistence is best-effort and must not block the app */
  }
  try {
    database = await openDb(name);
    return true;
  } catch {
    database = null;
    return false;
  }
}

export async function loadState<T extends object>(fallback: T): Promise<T> {
  if (!database) return fallback;
  try {
    const raw = await new Promise<T | undefined>((resolve, reject) => {
      const tx = database!.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('state');
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error ?? new Error('read'));
    });
    if (!raw || typeof raw !== 'object') return fallback;
    return { ...fallback, ...raw };
  } catch {
    return fallback;
  }
}

/** Returns false on quota / failure. Caller must keep the in-memory text. */
export async function saveState(value: unknown): Promise<boolean> {
  if (!database) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database!.transaction('kv', 'readwrite');
      const req = tx.objectStore('kv').put(value, 'state');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? req.error ?? new Error('tx'));
      tx.onabort = () => reject(tx.error ?? new Error('abort'));
    });
    return true;
  } catch {
    return false;
  }
}
