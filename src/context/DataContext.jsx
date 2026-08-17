import React, { useState, useCallback, useEffect, useRef } from 'react';
import { clientService, contractService } from '../services/supabaseServices.js';

/* =========================================================================
   DATA CONTEXT — ONE copy of contracts + clients for the whole admin app
   =========================================================================
   Every admin page (Dashboard, Contracts, Receivables, Revenue Report, Clients)
   reads the same arrays from here and every mutation calls refresh(), so
   creating or editing a contract updates every impacted view at once.

   Before this, each page called a local hook that fetched once on mount and
   never re-fetched. Saving a contract on the Contracts page left the Dashboard
   showing pre-edit numbers until a manual browser reload — which is why two
   call sites had resorted to `location.reload()`. A full page reload also
   dropped the user's place in the app and re-ran auth, so it was slow as well
   as jarring.

   Deliberately simple: no cache keys, no per-entity invalidation. The dataset
   is small (tens of contracts) and always fetched together, so one shared
   refresh is both correct and cheap. `refresh()` returns a promise, so a caller
   that needs the fresh data before navigating can await it.
   ========================================================================= */
export const DataContext = React.createContext(null);

export function DataProvider({ children }) {
  const [contracts, setContracts] = useState(null);
  const [clients, setClients] = useState(null);
  const [error, setError] = useState(null);
  // Guards against a slow earlier fetch resolving after a newer one and
  // overwriting fresher data with stale rows.
  const seqRef = useRef(0);
  // Avoids a state update on an unmounted provider (React strict-mode remount).
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const [c, cl] = await Promise.all([contractService.getAll(), clientService.getAll()]);
      // A newer refresh started while this one was in flight — discard.
      if (seq !== seqRef.current || !mountedRef.current) return;
      setContracts(c);
      setClients(cl);
      setError(null);
      return { contracts: c, clients: cl };
    } catch (e) {
      if (seq !== seqRef.current || !mountedRef.current) return;
      // Keep the last good data on screen rather than blanking the board.
      setError(e);
      throw e;
    }
  }, []);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  return (
    <DataContext.Provider value={{ contracts, clients, error, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

// Shared admin dataset. Returns { contracts, clients, error, refresh }.
// `contracts`/`clients` are null until the first load resolves — callers render
// a skeleton on null, exactly as they did with the old local hook.
export function useData() {
  const ctx = React.useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside a DataProvider');
  return ctx;
}
