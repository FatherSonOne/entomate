/**
 * Simple TTL cache for API GET responses
 *
 * Features:
 * - Cache GET responses by URL + params
 * - Configurable TTL per endpoint (default 30s)
 * - Auto-invalidate on mutations (POST/PUT/DELETE to same resource)
 * - Manual invalidation via cache.invalidate('/api/tasks')
 */

const DEFAULT_TTL = 30 * 1000 // 30 seconds

class ApiCache {
  constructor() {
    this._store = new Map()
    this._ttls = new Map() // per-path TTL overrides
  }

  /**
   * Set custom TTL for a path prefix
   * @param {string} pathPrefix - e.g., '/api/meetings'
   * @param {number} ttlMs - TTL in milliseconds
   */
  setTTL(pathPrefix, ttlMs) {
    this._ttls.set(pathPrefix, ttlMs)
  }

  /**
   * Get TTL for a given path
   */
  _getTTL(path) {
    for (const [prefix, ttl] of this._ttls) {
      if (path.startsWith(prefix)) return ttl
    }
    return DEFAULT_TTL
  }

  /**
   * Generate a cache key from URL and params
   */
  _key(url, params) {
    const paramStr = params ? JSON.stringify(params, Object.keys(params).sort()) : ''
    return `${url}|${paramStr}`
  }

  /**
   * Get a cached response, or null if expired/missing
   */
  get(url, params) {
    const key = this._key(url, params)
    const entry = this._store.get(key)
    if (!entry) return null

    const ttl = this._getTTL(url)
    if (Date.now() - entry.timestamp > ttl) {
      this._store.delete(key)
      return null
    }

    return entry.data
  }

  /**
   * Store a response in the cache
   */
  set(url, params, data) {
    const key = this._key(url, params)
    this._store.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Invalidate all cache entries matching a path prefix
   * Called automatically on mutations
   */
  invalidate(pathPrefix) {
    for (const [key] of this._store) {
      const url = key.split('|')[0]
      if (url.startsWith(pathPrefix) || url === pathPrefix) {
        this._store.delete(key)
      }
    }
  }

  /**
   * Clear the entire cache
   */
  clear() {
    this._store.clear()
  }

  /**
   * Get cache stats for debugging
   */
  get size() {
    return this._store.size
  }
}

// Singleton instance
const cache = new ApiCache()

// Set sensible TTLs for different endpoints
cache.setTTL('/api/meetings', 60 * 1000)     // 60s - meetings don't change fast
cache.setTTL('/api/tasks', 15 * 1000)        // 15s - tasks change frequently
cache.setTTL('/api/projects', 60 * 1000)     // 60s
cache.setTTL('/api/goals', 60 * 1000)        // 60s
cache.setTTL('/api/analytics', 120 * 1000)   // 2min - expensive queries
cache.setTTL('/api/agents', 30 * 1000)       // 30s
cache.setTTL('/api/automations', 30 * 1000)  // 30s
cache.setTTL('/api/workflows', 30 * 1000)    // 30s
cache.setTTL('/api/health', 10 * 1000)       // 10s
cache.setTTL('/api/intelligence', 30 * 1000) // 30s

export default cache
