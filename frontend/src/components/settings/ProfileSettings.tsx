import React, { useId, useRef, useState } from 'react'
import { Key, TextInput } from '../bench'
import ProfileAvatar from '../ProfileAvatar'
import { initials } from '../../services/settingsView'
import { supabase } from '../../services/supabaseClient'
import { prepareProfilePhoto, PROFILE_PHOTO_ACCEPT, removeProfilePhoto, uploadProfilePhoto } from '../../services/profilePhotos'
import type { AuthCtx } from './settingsTypes'

type PendingPhoto = Awaited<ReturnType<typeof prepareProfilePhoto>> | 'remove' | null

export default function ProfileSettings({ user, profilePhotoUrl, hasUploadedProfilePhoto, setProfilePhotoUrl, signOut }: AuthCtx) {
  const [name, setName] = useState(user?.name ?? '')
  const [photo, setPhoto] = useState<PendingPhoto>(null)
  const [busy, setBusy] = useState<'prepare' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const saving = useRef(false)
  const nameId = useId()
  const savedName = user?.name ?? ''
  const preview = photo === 'remove' ? null : photo?.preview ?? profilePhotoUrl
  const dirty = name !== savedName || photo !== null

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setBusy('prepare')
    setError(null)
    setMessage(null)
    try {
      setPhoto(await prepareProfilePhoto(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This photo could not be opened.')
    } finally {
      setBusy(null)
    }
  }

  const reset = () => {
    setName(savedName)
    setPhoto(null)
    setError(null)
    setMessage(null)
  }

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user?.id || saving.current || busy || !dirty) return
    const trimmed = name.trim()
    if (name !== savedName && !trimmed) {
      setError('Enter a display name.')
      return
    }
    saving.current = true
    setBusy('save')
    setError(null)
    setMessage(null)
    try {
      const metadata: Record<string, string | boolean> = {}
      if (name !== savedName) metadata.name = trimmed
      // Suppress the sign-in picture first. If deletion fails, the uploaded
      // picture still displays and the user can retry.
      if (photo === 'remove') metadata.entomate_avatar_hidden = true
      if (Object.keys(metadata).length) {
        const { error } = await supabase.auth.updateUser({ data: metadata })
        if (error) throw error
        setName(trimmed)
      }
      if (photo === 'remove') {
        if (hasUploadedProfilePhoto !== false) await removeProfilePhoto(user.id)
        setProfilePhotoUrl(null)
      } else if (photo) {
        await uploadProfilePhoto(user.id, photo.blob)
        setProfilePhotoUrl(photo.preview)
      }
      setPhoto(null)
      setMessage('Profile saved.')
    } catch {
      setError('Couldn’t finish saving your profile. Try again.')
    } finally {
      saving.current = false
      setBusy(null)
    }
  }

  return (
    <>
      <form aria-label="Profile details" aria-busy={!!busy} onSubmit={(event) => { void save(event) }}>
        <div className="bs-set-photo">
          <ProfileAvatar className="bs-set-avatar bs-set-profile-avatar" src={preview}
            fallback={initials(name || savedName, user?.email)} />
          <div>
            <h3 className="bs-h3">Profile photo</h3>
            <p className="bs-set-help">JPG, PNG or WebP, up to 5 MB.</p>
            <input ref={fileRef} type="file" accept={PROFILE_PHOTO_ACCEPT} hidden
              aria-label="Choose a profile photo" onChange={(event) => { void pick(event) }} disabled={!!busy} />
            <div className="bs-set-photo-actions">
              <Key disabled={!!busy} onClick={() => fileRef.current?.click()}>
                {busy === 'prepare' ? 'Preparing photo…' : preview ? 'Replace photo' : 'Upload photo'}
              </Key>
              {preview && (
                <Key disabled={!!busy} onClick={() => {
                  setPhoto(profilePhotoUrl ? 'remove' : null)
                  setMessage(profilePhotoUrl ? 'Photo will be removed when you save.' : null)
                  setError(null)
                }}>Remove photo</Key>
              )}
            </div>
          </div>
        </div>
        <div className="bs-set-row bs-set-profile-field">
          <div className="bs-set-l">
            <label className="bs-h3" htmlFor={nameId}>Display name</label>
            <span>Shown with your photo in Entomate.</span>
          </div>
          <TextInput id={nameId} value={name} disabled={!!busy}
            onChange={(event) => { setName(event.target.value); setMessage(null); setError(null) }} />
        </div>
        <div className="bs-set-row bs-set-profile-field">
          <div className="bs-set-l">
            <b>Sign-in email</b>
            <span>Managed by your sign-in provider.</span>
          </div>
          <span>{user?.email}</span>
        </div>
        <div className="bs-set-keys bs-set-profile-keys">
          <div aria-live="polite" className="bs-set-profile-status">
            {error ? <span className="bs-set-err">{error}</span> : message}
          </div>
          <Key disabled={!dirty || !!busy} onClick={reset}>Cancel</Key>
          <Key type="submit" variant="primary" disabled={!dirty || !!busy || !user}>
            {busy === 'save' ? 'Saving…' : 'Save profile'}
          </Key>
        </div>
      </form>
      <div className="bs-set-sub"><span className="bs-h3">Session</span></div>
      <div className="bs-set-row">
        <div className="bs-set-l"><b>Entomate account</b></div>
        <div className="bs-set-c"><Key disabled={!!busy} onClick={() => { void signOut() }}>Sign out</Key></div>
      </div>
    </>
  )
}
