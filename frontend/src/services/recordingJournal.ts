import type { AudioTracks, IsolatedAudioTrack, RecordingGaps, RecordingTrack, TrackCoverage } from './recordingAudioTracks'

export interface RecordingPiece {
  seq: number
  durationMs: number
  blob: Blob
  track?: IsolatedAudioTrack
}

export interface SavedRecording extends Partial<RecordingGaps> {
  id: string
  userId: string
  title: string
  mimeType: string
  savedPieces: number
  savedMs: number
  startedAt: number
  splitAudio?: boolean
  savedAudioTracks?: AudioTracks
  receivedTracks?: Partial<Record<RecordingTrack, TrackCoverage>>
}

export function savedTrackCoverage(recording: SavedRecording, track: RecordingTrack): TrackCoverage {
  if (track === 'mix') return { pieces: recording.savedPieces, durationMs: recording.savedMs }
  return recording.savedAudioTracks?.[track] ?? { pieces: 0, durationMs: 0 }
}

function setSavedCoverage(recording: SavedRecording, track: RecordingTrack, coverage: TrackCoverage): void {
  if (track === 'mix') {
    recording.savedPieces = coverage.pieces
    recording.savedMs = coverage.durationMs
  } else {
    recording.savedAudioTracks = { ...recording.savedAudioTracks, [track]: coverage }
  }
}

let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('entomate-recording-recovery', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('recordings', { keyPath: 'id' }).createIndex('userId', 'userId')
      request.result.createObjectStore('pieces')
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); database = undefined }
      resolve(db)
    }
    request.onerror = () => reject(request.error)
  }).catch(error => { database = undefined; throw error })
  return database
}

async function transact<T>(
  stores: string[], mode: IDBTransactionMode, work: (tx: IDBTransaction, result: (value: T) => void) => void,
): Promise<T> {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined)
    let result: T
    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(tx.error ?? new Error('Recording storage was interrupted.'))
    work(tx, value => { result = value })
  })
}

const pieceRange = (id: string): IDBKeyRange => IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])
const pieceKey = (id: string, seq: number, track?: IsolatedAudioTrack) => track ? [id, seq, track] : [id, seq]

export const recordingJournal = {
  create(input: Pick<SavedRecording, 'id' | 'userId' | 'title' | 'mimeType' | 'splitAudio'>): Promise<void> {
    return transact(['recordings'], 'readwrite', tx => {
      tx.objectStore('recordings').add({
        ...input, savedPieces: 0, savedMs: 0, receivedTracks: {}, startedAt: Date.now(),
      })
    })
  },
  list(userId: string): Promise<SavedRecording[]> {
    return transact(['recordings'], 'readonly', (tx, result) => {
      const request = tx.objectStore('recordings').index('userId').getAll(userId)
      request.onsuccess = () => {
        const saved = (request.result as SavedRecording[]).filter(row => row.savedPieces > 0)
        result(saved.sort((a, b) => b.startedAt - a.startedAt))
      }
    })
  },
  read(id: string): Promise<{ recording: SavedRecording; pieces: RecordingPiece[] } | null> {
    return transact(['recordings', 'pieces'], 'readonly', (tx, result) => {
      const request = tx.objectStore('recordings').get(id)
      request.onsuccess = () => {
        const recording = request.result as SavedRecording | undefined
        if (!recording) { result(null); return }
        const pieces = tx.objectStore('pieces').getAll(pieceRange(id))
        pieces.onsuccess = () => result({ recording, pieces: pieces.result })
      }
    })
  },
  append(id: string, piece: RecordingPiece, throughMs: number): Promise<number> {
    return transact(['recordings', 'pieces'], 'readwrite', (tx, result) => {
      const sessions = tx.objectStore('recordings')
      const request = sessions.get(id)
      request.onsuccess = () => {
        const entry = request.result as SavedRecording | undefined
        if (!entry) { result(0); return }
        tx.objectStore('pieces').put(piece, pieceKey(id, piece.seq, piece.track))
        const track = piece.track ?? 'mix'
        const coverage = savedTrackCoverage(entry, track)
        if (coverage.pieces === piece.seq) {
          setSavedCoverage(entry, track, { pieces: piece.seq + 1, durationMs: throughMs })
          sessions.put(entry)
        }
        result(savedTrackCoverage(entry, track).durationMs)
      }
    })
  },
  acknowledge(id: string, seq: number, throughMs: number, track?: IsolatedAudioTrack): Promise<void> {
    return transact(['recordings', 'pieces'], 'readwrite', tx => {
      const sessions = tx.objectStore('recordings')
      const request = sessions.get(id)
      request.onsuccess = () => {
        const entry = request.result as SavedRecording | undefined
        if (!entry) return
        tx.objectStore('pieces').delete(pieceKey(id, seq, track))
        const name = track ?? 'mix'
        const coverage = { pieces: seq + 1, durationMs: throughMs }
        if (savedTrackCoverage(entry, name).pieces < coverage.pieces) setSavedCoverage(entry, name, coverage)
        if ((entry.receivedTracks?.[name]?.pieces ?? 0) < coverage.pieces) {
          entry.receivedTracks = { ...entry.receivedTracks, [name]: coverage }
        }
        sessions.put(entry)
      }
    })
  },
  saveGaps(id: string, gaps: RecordingGaps): Promise<void> {
    return transact(['recordings'], 'readwrite', tx => {
      const sessions = tx.objectStore('recordings')
      const request = sessions.get(id)
      request.onsuccess = () => {
        if (request.result) sessions.put({ ...request.result, ...gaps })
      }
    })
  },
  remove(id: string): Promise<void> {
    return transact(['recordings', 'pieces'], 'readwrite', tx => {
      tx.objectStore('pieces').delete(pieceRange(id))
      tx.objectStore('recordings').delete(id)
    })
  },
}

/** Hold the recording until the recorder or the recovery action finishes. */
export function lockRecording(id: string): Promise<(() => void) | null> {
  if (!navigator.locks) return Promise.reject(new Error('This browser cannot coordinate recording recovery between tabs.'))
  return new Promise((resolve, reject) => {
    void navigator.locks.request(`entomate-recording:${id}`, { ifAvailable: true }, lock => {
      if (!lock) { resolve(null); return }
      return new Promise<void>(release => resolve(release))
    }).catch(reject)
  })
}
