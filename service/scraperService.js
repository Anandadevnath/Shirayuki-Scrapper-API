import axios from 'axios';
import { load } from 'cheerio';

// Create optimized axios instance with connection pooling
const httpClient = axios.create({
  timeout: 8000, // Increased timeout for render.com
  maxRedirects: 2,
  validateStatus: function (status) {
    return status >= 200 && status < 300; 
  },
  // Enable connection pooling for better performance
  httpAgent: false,
  httpsAgent: false,
  // Optimize for render.com's slower network
  maxContentLength: 10 * 1024 * 1024, // 10MB limit
  responseType: 'text'
});

export const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (compatible; ShirayukiBot/1.0; +https://example.com/bot)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'no-cache'
};

// Simple response cache to avoid duplicate requests
const responseCache = new Map();
const RESPONSE_CACHE_TTL = 30000; // 30 seconds

export function resolveUrlFactory(base) {
  return (u) => {
    if (!u) return null;
    try {
      return new URL(u, base).href;
    } catch (e) {
      if (u.startsWith('//')) return 'https:' + u;
      if (u.startsWith('/')) return base + u;
      return u;
    }
  };
}

export async function fetchAndLoad(url) {
  // Check cache first
  const now = Date.now();
  const cached = responseCache.get(url);
  if (cached && (now - cached.timestamp) < RESPONSE_CACHE_TTL) {
    return load(cached.data);
  }

  try {
    const resp = await httpClient.get(url, { 
      headers: defaultHeaders
    });
    
    // Cache the response
    responseCache.set(url, {
      data: resp.data,
      timestamp: now
    });
    
    // Clean old cache entries periodically
    if (responseCache.size > 50) {
      for (const [cachedUrl, entry] of responseCache.entries()) {
        if ((now - entry.timestamp) > RESPONSE_CACHE_TTL) {
          responseCache.delete(cachedUrl);
        }
      }
    }
    
    return load(resp.data);
  } catch (error) {
    // If it's a timeout or network error, throw a more descriptive error
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error(`Request timeout for ${url} - this is common on free hosting plans`);
    }
    throw error;
  }
}

export default { fetchAndLoad, resolveUrlFactory, defaultHeaders };
