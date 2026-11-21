import React from 'react'
import BrandMotion from './BrandMotion'
import { nextHeroClip } from './heroRotation'

// Module scope selects once per page load, including under React Strict Mode.
const heroClip = nextHeroClip()

export default function LandingHero() {
  return <BrandMotion clip={heroClip} className="hero-brand-film" />
}
