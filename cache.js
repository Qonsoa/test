// worker/cache.js
export class CacheManager {
  constructor(env) {
    this.cache = env.CHAT_CACHE; // KV namespace
    this.defaultTTL = 3600; // 1 hour
  }

  async get(key) {
    try {
      const cached = await this.cache.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      await this.cache.put(key, JSON.stringify(value), {
        expirationTtl: ttl || this.defaultTTL
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async delete(key) {
    try {
      await this.cache.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Cache FAQ responses
  async cacheFAQResponse(clinicId, question, response) {
    const key = `faq:${clinicId}:${question}`;
    await this.set(key, response, 86400); // 24 hours
  }

  async getFAQResponse(clinicId, question) {
    const key = `faq:${clinicId}:${question}`;
    return await this.get(key);
  }

  // Cache quick replies
  async cacheQuickReplies(clinicId, replies) {
    const key = `quick:${clinicId}`;
    await this.set(key, replies, 86400); // 24 hours
  }

  async getQuickReplies(clinicId) {
    const key = `quick:${clinicId}`;
    return await this.get(key);
  }
}