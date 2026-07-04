/* =========================================================================
   LOCAL STORAGE LAYER (raw persistence — services below abstract this away)
   ========================================================================= */
export const DB_KEYS = {
  company: 'sos_company',
  users: 'sos_users',
  clients: 'sos_clients',
  contracts: 'sos_contracts',
  seeded: 'sos_seeded_v1',
};

export function dbGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
export function dbSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
