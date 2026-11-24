import api from '../services/api'

/**
 * Download a file from an authenticated API endpoint.
 * Uses the axios instance (which auto-attaches Bearer token)
 * and triggers a browser download via blob URL.
 */
export async function downloadFile(apiPath, filename, params = {}) {
  // The API interceptor already returns the response body, including for blobs.
  const blob = await api.get(apiPath, {
    responseType: 'blob',
    params
  })
  saveDownload(blob, filename)
}

function saveDownload(blob, filename) {
  if (!(blob instanceof Blob) || !blob.size) throw new Error('The download is empty or invalid.')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Let browsers start reading the object URL before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
