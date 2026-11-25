import React, { useState } from 'react'

interface ProfileAvatarProps {
  className?: string
  src?: string | null
  fallback: React.ReactNode
}

export default function ProfileAvatar({ className, src, fallback }: ProfileAvatarProps) {
  const [unavailable, setUnavailable] = useState<string | null>(null)

  return (
    <span className={className} aria-hidden="true">
      {src && src !== unavailable ? <img src={src} alt="" onError={() => setUnavailable(src)} /> : fallback}
    </span>
  )
}
