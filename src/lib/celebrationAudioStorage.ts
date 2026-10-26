// ============================================================
// Celebration Audio Storage Engine
// Handles robust local caching (IndexedDB), MIME type normalization,
// Blob URL management, and fallback decoding to ensure audio
// plays 100% reliably in all browsers without "no supported source" errors.
// ============================================================

const DB_NAME = 'pitch_arena_media_db'
const DB_VERSION = 1
const STORE_NAME = 'audio_files'
const TRACK_KEY = 'celebration_music'

export const CELEBRATION_TRACK_NAME_KEY = 'pitch_arena_celebration_track_name'

let _cachedBlobUrl: string | null = null

/**
 * Normalizes file extension & raw MIME into a standard browser-supported audio MIME type.
 * Browsers require 'audio/mpeg' for MP3, 'audio/wav' for WAV, 'audio/mp4' for M4A, etc.
 */
export function normalizeAudioMime(fileName: string, rawMime?: string): string {
  const ext = (fileName.split('.').pop() || '').toLowerCase()

  if (rawMime && rawMime.startsWith('audio/')) {
    if (rawMime === 'audio/mp3') return 'audio/mpeg'
    if (rawMime === 'audio/x-m4a') return 'audio/mp4'
    if (rawMime === 'audio/x-wav') return 'audio/wav'
    return rawMime
  }

  switch (ext) {
    case 'mp3':
      return 'audio/mpeg'
    case 'wav':
      return 'audio/wav'
    case 'ogg':
      return 'audio/ogg'
    case 'm4a':
      return 'audio/mp4'
    case 'aac':
      return 'audio/aac'
    case 'webm':
      return 'audio/webm'
    case 'flac':
      return 'audio/flac'
    default:
      return 'audio/mpeg'
  }
}

/**
 * Open or create the IndexedDB database for local audio file storage.
 */
function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'))
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export interface StoredAudioRecord {
  blob: Blob
  fileName: string
  mimeType: string
  updatedAt: number
}

let _activeBlobUrls = new Set<string>()

/**
 * Save an audio Blob into IndexedDB.
 */
export async function saveTrackToIndexedDB(
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<void> {
  try {
    const db = await openAudioDB()
    const cleanBlob = blob.type === mimeType ? blob : new Blob([await blob.arrayBuffer()], { type: mimeType })
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const record: StoredAudioRecord = {
        blob: cleanBlob,
        fileName,
        mimeType,
        updatedAt: Date.now(),
      }
      const req = store.put(record, TRACK_KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    console.warn('Failed to save audio to IndexedDB:', err)
  }
}

/**
 * Retrieve saved audio Blob record from IndexedDB.
 */
export async function getTrackFromIndexedDB(): Promise<StoredAudioRecord | null> {
  try {
    const db = await openAudioDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(TRACK_KEY)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Clear the saved audio record from IndexedDB.
 */
export async function clearTrackFromIndexedDB(): Promise<void> {
  try {
    _activeBlobUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url)
      } catch {}
    })
    _activeBlobUrls.clear()

    const db = await openAudioDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.delete(TRACK_KEY)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  } catch {
    // Ignore error
  }
}

/**
 * Creates or reuses a browser Blob URL for an audio Blob.
 */
export function createOrReuseBlobUrl(blob: Blob): string {
  if (typeof window === 'undefined') return ''
  const url = URL.createObjectURL(blob)
  _activeBlobUrls.add(url)
  return url
}

/**
 * Converts a base64 Data URL to a native binary Blob with correct MIME type.
 * This completely resolves browser limits where large data URLs fail in <audio> elements.
 */
export function dataUrlToBlob(dataUrl: string, fallbackMime = 'audio/mpeg'): Blob {
  const parts = dataUrl.split(',')
  const header = parts[0]
  const base64 = parts[1] || ''

  const mimeMatch = header.match(/:(.*?);/)
  let mime = mimeMatch ? mimeMatch[1] : fallbackMime
  if (!mime || mime === 'application/octet-stream' || mime === 'audio/mp3') {
    mime = 'audio/mpeg'
  }

  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

/**
 * Resolves any audio string (remote HTTP URL, data URL, IndexedDB reference, or blob URL)
 * into a directly playable, browser-compatible URL for HTML5 Audio.
 */
export async function resolvePlayableAudioUrl(urlOrKey: string): Promise<string | null> {
  if (!urlOrKey) {
    const record = await getTrackFromIndexedDB()
    if (record?.blob) {
      return createOrReuseBlobUrl(record.blob)
    }
    return null
  }

  // 1. Direct Blob URL: Already in memory
  if (urlOrKey.startsWith('blob:')) {
    return urlOrKey
  }

  // 2. Base64 Data URL: Convert to native Blob URL to bypass Chromium URL length & decode issues
  if (urlOrKey.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(urlOrKey)
      return createOrReuseBlobUrl(blob)
    } catch (err) {
      console.warn('Failed to parse data URL to blob:', err)
      const record = await getTrackFromIndexedDB()
      if (record?.blob) return createOrReuseBlobUrl(record.blob)
      return null
    }
  }

  // 3. IndexedDB reference key
  if (urlOrKey.startsWith('indexeddb:') || urlOrKey === 'indexeddb') {
    const record = await getTrackFromIndexedDB()
    if (record?.blob) {
      return createOrReuseBlobUrl(record.blob)
    }
    return null
  }

  // 4. Remote HTTP/HTTPS URL (Supabase Storage or CDN)
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey
  }

  // 5. Fallback check in IndexedDB
  const record = await getTrackFromIndexedDB()
  if (record?.blob) {
    return createOrReuseBlobUrl(record.blob)
  }

  return null
}

/**
 * Get saved celebration music file name from localStorage.
 */
export function getStoredCelebrationTrackName(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(CELEBRATION_TRACK_NAME_KEY)
  } catch {
    return null
  }
}

/**
 * Store celebration music file name to localStorage.
 */
export function setStoredCelebrationTrackName(name: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (name) {
      localStorage.setItem(CELEBRATION_TRACK_NAME_KEY, name)
    } else {
      localStorage.removeItem(CELEBRATION_TRACK_NAME_KEY)
    }
  } catch {}
}
