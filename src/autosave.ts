// Tiny key-value store on IndexedDB (survives the window closing, holds big projects with images).
const open = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('sketchcad', 1)
  r.onupgradeneeded = () => r.result.createObjectStore('kv')
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})
export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await open()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('kv', 'readwrite')
    tx.objectStore('kv').put(value, key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
  db.close()
}
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open()
  const v = await new Promise<T | undefined>((res, rej) => {
    const r = db.transaction('kv').objectStore('kv').get(key)
    r.onsuccess = () => res(r.result as T | undefined)
    r.onerror = () => rej(r.error)
  })
  db.close()
  return v
}
