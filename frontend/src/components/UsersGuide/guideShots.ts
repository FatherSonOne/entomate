/**
 * Screenshots in the User Guide, keyed by section or subsection id.
 * Files live in public/guide/<id>-light.webp and <id>-dark.webp, shot from the
 * seeded qntmecos workspace at 1440px wide (scripts/guide-shots.mjs).
 */
export interface GuideShot {
  caption: string
  alt: string
  /** Intrinsic size, so the page doesn't jump while images load. */
  w: number
  h: number
}

export const GUIDE_SHOTS: Readonly<Record<string, GuideShot>> = {}
