import api from '../services/api'

/**
 * Download a file from an authenticated API endpoint.
 * Uses the axios instance (which auto-attaches Bearer token)
 * and triggers a browser download via blob URL.
 */
export async function downloadFile(apiPath, filename, params = {}) {
  const response = await api.get(apiPath, {
    responseType: 'blob',
    params
  })

  const contentType = response.headers?.['content-type'] || 'application/octet-stream'
  const blob = new Blob([response.data], { type: contentType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
