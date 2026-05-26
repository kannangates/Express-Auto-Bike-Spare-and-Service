const DB_NAME = 'express-auto-bike'
const DB_VERSION = 1

let dbInstance: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('api-cache')) {
        db.createObjectStore('api-cache', { keyPath: 'key' })
      }
    }

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result
      resolve(dbInstance)
    }

    request.onerror = () => reject(request.error)
  })
}

export async function setCacheEntry(key: string, data: unknown): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const db = await openDB()
    const tx = db.transaction('api-cache', 'readwrite')
    tx.objectStore('api-cache').put({ key, data, cachedAt: Date.now() })
  } catch {
    // IndexedDB unavailable — fail silently
  }
}

export async function getCacheEntry<T = unknown>(key: string): Promise<T | null> {
  if (typeof window === 'undefined') return null
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('api-cache', 'readonly')
      const req = tx.objectStore('api-cache').get(key)
      req.onsuccess = () => resolve(req.result ? (req.result.data as T) : null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function getCacheTimestamp(key: string): Promise<number | null> {
  if (typeof window === 'undefined') return null
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction('api-cache', 'readonly')
      const req = tx.objectStore('api-cache').get(key)
      req.onsuccess = () => resolve(req.result ? (req.result.cachedAt as number) : null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}
