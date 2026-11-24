export const HERO_CLIPS = ['workflow', 'hands', 'bridge', 'signal', 'factors']
const STORAGE_KEY = 'entomate.hero.previous'

/** Advance once per document load; a random starting point keeps visits varied. */
export function nextHeroClip({ clips = HERO_CLIPS, storageKey = STORAGE_KEY } = {}) {
  const randomClip = () => clips[Math.floor(Math.random() * clips.length)]
  try {
    const previous = clips.indexOf(window.localStorage.getItem(storageKey))
    const clip = previous < 0 ? randomClip() : clips[(previous + 1) % clips.length]
    window.localStorage.setItem(storageKey, clip)
    return clip
  } catch {
    // Storage can be unavailable in private or restricted browsing.
    return randomClip()
  }
}
