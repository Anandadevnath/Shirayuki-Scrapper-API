import axios from 'axios';
import { load } from 'cheerio';

export const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (compatible; ShirayukiBot/1.0; +https://example.com/bot)'
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
  const resp = await axios.get(url, { headers: defaultHeaders, timeout: 20000 });
  return load(resp.data);
}

export default { fetchAndLoad, resolveUrlFactory, defaultHeaders };
