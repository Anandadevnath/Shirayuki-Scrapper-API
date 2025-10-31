// Simple in-memory namespaced TTL cache
const namespaces = new Map();

function createNamespace(name, defaultTTL = 0) {
  if (namespaces.has(name)) return namespaces.get(name);
  const map = new Map();

  function now() { return Date.now(); }

  function set(key, value, ttl = defaultTTL) {
    const expiresAt = ttl > 0 ? now() + ttl : 0;
    map.set(key, { value, expiresAt });
  }

  function get(key) {
    const entry = map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= now()) {
      map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function has(key) {
    const entry = map.get(key);
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt <= now()) {
      map.delete(key);
      return false;
    }
    return true;
  }

  function del(key) { map.delete(key); }

  const ns = { set, get, has, del };
  namespaces.set(name, ns);
  return ns;
}

export default { createNamespace };
