import axios from 'axios';
import { load } from 'cheerio';

export const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (compatible; ShirayukiBot/1.0; +https://example.com/bot)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

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
  const resp = await axios.get(url, { 
    headers: defaultHeaders, 
    timeout: 5000, 
    maxRedirects: 2, 
    validateStatus: function (status) {
      return status >= 200 && status < 300; 
    }
  });
  return load(resp.data);
}

export default { fetchAndLoad, resolveUrlFactory, defaultHeaders };
