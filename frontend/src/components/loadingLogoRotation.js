export const LOADING_LOGOS = [
  'relay', 'constellation', 'aperture', 'orbit', 'bloom',
  'circuit-spire', 'circuit-e', 'catalyst-core', 'routed-signal',
  'ignition', 'relay-orbits', 'signal-cascade', 'orbital-network',
  'trinity', 'flow-field', 'neural-core', 'ribbon-catalyst',
]
const STORAGE_KEY = 'entomate.loading.previous'

/** One new direction per document, cycling through all 17 before repeating. */
export function nextLoadingLogo() {
  let previous = -1
  try {
    previous = LOADING_LOGOS.indexOf(window.localStorage.getItem(STORAGE_KEY))
  } catch { /* Storage may be blocked by the browser. */ }
  const index = previous < 0
    ? Math.floor(Math.random() * LOADING_LOGOS.length)
    : (previous + 1) % LOADING_LOGOS.length
  const logo = LOADING_LOGOS[index]
  try {
    window.localStorage.setItem(STORAGE_KEY, logo)
  } catch { /* Loading must still work when storage is unavailable. */ }
  return logo
}
