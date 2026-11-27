import React from 'react'
import './Logo.css'
import { DEFAULT_LOGO, logoAsset, useLogoSystem } from '../services/logoSystem'

// The default identity (Relay Orbits). The mark shown follows the logo system
// picked in Settings > Appearance (services/logoSystem.ts).
export const PRIMARY_LOGO = DEFAULT_LOGO
const SIZES = { sm: { mark: 32, word: 116 }, md: { mark: 40, word: 148 }, lg: { mark: 56, word: 188 }, xl: { mark: 120, word: 280 } }
const LETTERS = [{"d":"M42 45H5C5 18 44 18 44 44M5 45C5 73 31 75 43 62","transform":"translate(0 0)"},{"d":"M5 70V28M5 42C5 22 42 22 42 43V70","transform":"translate(59 0)"},{"d":"M22 9V56Q22 73 40 69M5 29H40","transform":"translate(117 0)"},{"d":"M25 27C-2 27-2 70 25 70C52 70 52 27 25 27Z","transform":"translate(165 0)"},{"d":"M5 70V28M5 43C5 22 34 23 34 43V70M34 43C34 22 64 23 64 43V70","transform":"translate(226 0)"},{"d":"M43 70V29M43 49C43 20 4 20 4 49C4 77 43 78 43 49","transform":"translate(307 0)"},{"d":"M22 9V56Q22 73 40 69M5 29H40","transform":"translate(365 0)"},{"d":"M42 45H5C5 18 44 18 44 44M5 45C5 73 31 75 43 62","transform":"translate(413 0)"}]

export function EntomateMark({ size = 36, alt = 'Entomate', style = undefined, className = '' }) {
  const { id } = useLogoSystem()
  // Up to 64px the tight crop reads best; it sits in a dark well in light mode (Logo.css).
  if (size <= 64) {
    return <img className={`en-brand-mark ${className}`} src={logoAsset(id, 'small')} width={size} height={size}
      alt={alt} aria-hidden={alt === '' ? true : undefined} decoding="async" style={style} data-brand-mark="" />
  }
  const src = logoAsset(id, 128)
  const medium = logoAsset(id, 256)
  return <img className={`en-brand-mark ${className}`} src={src}
    srcSet={src === medium ? undefined : `${src} 128w, ${medium} 256w, ${logoAsset(id, 512)} 512w`}
    sizes={`${size}px`} width={size} height={size} alt={alt} aria-hidden={alt === '' ? true : undefined}
    decoding="async" style={style} />
}

export function Wordmark({ width = 148 }) {
  return <svg className="en-brand-wordmark" width={width} height={width * 84 / 470} viewBox="0 0 470 84"
    role="img" aria-label="Entomate" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      {LETTERS.map((path, index) => <path key={index} {...path} />)}
    </g>
  </svg>
}

export const Logo = ({ size = 'md', withText = true, className = '' }) => {
  const dimensions = SIZES[size] || SIZES.md
  return <span className={`en-brand-logo ${className}`} role="img" aria-label="Entomate">
    <EntomateMark size={dimensions.mark} alt="" />
    {withText && <span aria-hidden="true"><Wordmark width={dimensions.word} /></span>}
  </span>
}

export default Logo
