import { afterEach, expect, test, vi } from 'vitest'
import api from '../services/api'
import { downloadFile } from '../utils/downloadHelper'

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('downloads the API blob unchanged with the requested filename', async () => {
  vi.useFakeTimers()
  const pdf = new Blob(['%PDF-1.3'], { type: 'application/pdf' })
  api.get.mockResolvedValue(pdf)
  const createObjectURL = vi.fn(() => 'blob:recap')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    expect(this.download).toBe('Planning - Recap.pdf')
    expect(this.href).toBe('blob:recap')
  })

  await downloadFile('/reports/meeting/m1/pdf', 'Planning - Recap.pdf')

  expect(createObjectURL).toHaveBeenCalledWith(pdf)
  expect(click).toHaveBeenCalledOnce()
  expect(revokeObjectURL).not.toHaveBeenCalled()
  vi.runAllTimers()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:recap')
})
