import { supabase } from './supabaseClient'

const BUCKET = 'profile-photos'
const SIGNED_URL_SECONDS = 3600
const MAX_INPUT_BYTES = 5 * 1024 * 1024
const PHOTO_SIZE = 256
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PROFILE_PHOTO_ACCEPT = ACCEPTED_TYPES.join(',')
export const PROFILE_PHOTO_REFRESH_MS = 45 * 60 * 1000

const pathFor = (userId: string): string => userId + '/avatar.jpg'
const bucket = () => supabase.storage.from(BUCKET)

export async function getProfilePhotoUrls(userIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(userIds)]
  if (!ids.length) return {}
  const { data, error } = await bucket().createSignedUrls(ids.map(pathFor), SIGNED_URL_SECONDS)
  if (error) throw error

  const urls: Record<string, string> = {}
  for (const item of data ?? []) {
    const userId = item.path?.split('/')[0]
    if (userId && !item.error && item.signedUrl) urls[userId] = item.signedUrl
  }
  return urls
}

export async function uploadProfilePhoto(userId: string, blob: Blob): Promise<void> {
  const { error } = await bucket().upload(pathFor(userId), blob, {
    cacheControl: '0',
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw error
}

export async function removeProfilePhoto(userId: string): Promise<void> {
  const { error } = await bucket().remove([pathFor(userId)])
  if (error) throw error
}

export async function prepareProfilePhoto(file: File): Promise<{ blob: Blob; preview: string }> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('Choose a photo that’s 5 MB or smaller.')

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This photo could not be opened. Try another image.')
  })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = PHOTO_SIZE
    canvas.height = PHOTO_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser couldn’t prepare the photo.')

    // Encode a centered crop without the source file's metadata.
    const side = Math.min(bitmap.width, bitmap.height)
    context.fillStyle = '#fff'
    context.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE)
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2,
      side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
    const preview = canvas.toDataURL('image/jpeg', 0.88)
    const [, encoded] = preview.split(',')
    if (!encoded || !preview.startsWith('data:image/jpeg;')) throw new Error('This browser couldn’t prepare the photo.')
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    return { blob: new Blob([bytes], { type: 'image/jpeg' }), preview }
  } finally {
    bitmap.close()
  }
}
