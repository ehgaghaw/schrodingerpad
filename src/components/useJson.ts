'use client';
// Tiny polling fetcher: refreshes every `every` ms while the tab is visible.
import { useEffect, useRef, useState } from 'react';

export function useJson<T>(url: string | null, every = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!url) return;
    let t: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          const j = await r.json();
          if (!alive.current) return;
          if (!r.ok) setError(j.error || 'Request failed'); else { setData(j); setError(null); }
        } catch { if (alive.current) setError('Network error'); }
      }
      if (every > 0) t = setTimeout(load, every);
    };
    load();
    return () => { alive.current = false; clearTimeout(t); };
  }, [url, every]);
  return { data, error };
}
