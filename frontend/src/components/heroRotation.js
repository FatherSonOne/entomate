export const HERO_CLIPS = ['workflow', 'hands', 'bridge', 'signal', 'factors']
const STORAGE_KEY = 'entomate.hero.previous'

/** Advance once per document load; a random starting point keeps visits varied. */
export function nextHeroClip() {
  const randomClip = () => HERO_CLIPS[Math.floor(Math.random() * HERO_CLIPS.length)]
  try {
    const previous = HERO_CLIPS.indexOf(window.localStorage.getItem(STORAGE_KEY))
    const clip = previous < 0 ? randomClip() : HERO_CLIPS[(previous + 1) % HERO_CLIPS.length]
    window.localStorage.setItem(STORAGE_KEY, clip)
    return clip
  } catch {
    // Storage can be unavailable in private or restricted browsing.
    return randomClip()
  }
}
