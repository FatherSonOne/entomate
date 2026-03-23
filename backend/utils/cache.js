/**
 * Simple In-Memory Cache with TTL
 * Week 6: Search Performance Optimization
 *
 * Features:
 * - TTL (Time To Live) support
 * - LRU-like eviction (removes oldest when max size reached)
 * - Cache hit/miss statistics
 * - Pattern-based invalidation
 */

class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 5 * 60 * 1000; // 5 minutes default
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    log.info('Memory cache initialized (max size:', this.maxSize, ', default TTL:', this.defaultTTL / 1000, 's)');
  }

  /**
   * Generate cache key from query and options
   */
  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.map(p => JSON.stringify(p)).join(':')}`;
  }

  /**
   * Get value from cache
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  set(key, value, ttl = this.defaultTTL) {
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });

    this.stats.sets++;
    return true;
  }

  /**
   * Delete value from cache
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching a pattern
   */
  invalidatePattern(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    return size;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? Math.round((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100)
      : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      log.info(`Cache cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// Create cache instances for different purposes
const searchCache = new MemoryCache({
  maxSize: 500,
  defaultTTL: 5 * 60 * 1000 // 5 minutes for search results
});

const embeddingCache = new MemoryCache({
  maxSize: 200,
  defaultTTL: 30 * 60 * 1000 // 30 minutes for embeddings (they don't change often)
});

const suggestionCache = new MemoryCache({
  maxSize: 100,
  defaultTTL: 2 * 60 * 1000 // 2 minutes for suggestions
});

/**
 * Cache wrapper for async functions
 */
async function withCache(cache, key, ttl, fetchFn) {
  const cached = cache.get(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  const data = await fetchFn();
  cache.set(key, data, ttl);
  return { data, fromCache: false };
}

module.exports = {
  MemoryCache,
  searchCache,
  embeddingCache,
  suggestionCache,
  withCache
};
