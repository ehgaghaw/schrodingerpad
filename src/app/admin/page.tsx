'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { short } from '@/lib/format';

type Overview = {
  paused: boolean; testMode: boolean; cluster: string; launcher: string; launcherSol: number | null;
  logs: { id: string; at: string; level: string; scope: string; msg: string }[];
  payouts: { id: string; kind: string; wallet: string; lamports: string; status: string; sig: string | null; box: { number: number } }[];
  burns: { id: string; lamports: string; status: string; box: { number: number } }[];
  boxes: { id: string; number: number; mint: string | null; ticker: string; state: string; fate: string | null; rarity: string | null; seedSource: string; pendingCreator: string; pendingPool: string; test: boolean }[];
};

export default function Admin() {
  const [data, setData] = useState<Overview | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/overview', { cache: 'no-store' });
    if (r.status === 401) { setAuthed(false); return; }
    setAuthed(true);
    setData(await r.json());
  }, []);
  useEffect(() => { load(); const i = setInterval(load, 8000); return () => clearInterval(i); }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action + (extra.boxId ?? ''));
    const r = await fetch('/api/admin/action', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
    const j = await r.json();
    setMsg(r.ok ? `${action}: ${JSON.stringify(j.result ?? j.mint ?? j.collapsed ?? j.trade ?? 'ok')}` : `${action}: ${j.error}`);
    setBusy('');
    load();
  };

  if (authed === false) {
    return (
      <div className="mx-auto max-w-sm px-4 py-24">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <form className="mt-6 space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) });
          if (r.ok) load(); else setMsg((await r.json()).error);
        }}>
          <input type="password" className="input" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className="btn-primary w-full">Sign in</button>
          {msg && <p className="text-sm text-down">{msg}</p>}
        </form>
      </div>
    );
  }
  if (!data) return <div className="grid place-items-center py-24 text-mute"><Loader2 className="animate-spin" /></div>;
  const B = ({ a, label, extra }: { a: string; label: string; extra?: Record<string, unknown> }) => (
    <button className="btn text-xs" disabled={!!busy} onClick={() => act(a, extra)}>{busy === a + (extra?.boxId ?? '') ? <Loader2 size={12} className="animate-spin" /> : null}{label}</button>
  );
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <span className="pill">{data.cluster}{data.testMode ? ' · TEST_MODE' : ''}</span>
        <span className="pill">launcher {short(data.launcher, 5)} · {data.launcherSol?.toFixed(4) ?? '?'} SOL</span>
        <span className={`pill ${data.paused ? 'text-down' : 'text-up'}`}>{data.paused ? 'payouts paused' : 'payouts running'}</span>
        <button className="btn ml-auto text-xs" onClick={async () => { await fetch('/api/admin/logout', { method: 'POST' }); setAuthed(false); }}>Sign out</button>
      </div>
      <div className="card flex flex-wrap gap-2 p-4">
        {data.paused ? <B a="resume" label="Resume payouts" /> : <B a="pause" label="Pause payouts and burns" />}
        <B a="run-fees" label="Collect fees now" /><B a="run-distribution" label="Run payouts now" /><B a="run-snapshots" label="Snapshot holders" />
        {data.testMode && <B a="test-launch" label="Test: launch a box" extra={{ ticker: 'TEST' }} />}
      </div>
      {msg && <p className="mono break-all text-mute">{msg}</p>}
      <section className="card overflow-x-auto">
        <h2 className="border-b border-line p-4 text-sm font-semibold">Boxes</h2>
        <table className="w-full text-sm">
          <thead className="label text-left"><tr>{['#', 'Ticker', 'State', 'Fate', 'Rarity', 'Seed', 'Pending creator', 'Pending pool', data.testMode ? 'Test tools' : ''].map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {data.boxes.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="px-4 py-2">{b.mint ? <Link className="link" href={`/box/${b.mint}`}>{b.number}</Link> : b.number}</td>
                <td className="px-4 py-2">{b.ticker}</td><td className="px-4 py-2">{b.state}</td><td className="px-4 py-2">{b.fate ?? '-'}</td><td className="px-4 py-2">{b.rarity ?? '-'}</td>
                <td className="px-4 py-2">{b.seedSource === 'QUANTUM' ? 'quantum' : 'classical'}</td>
                <td className="mono px-4 py-2">{(Number(b.pendingCreator) / 1e9).toFixed(5)}</td><td className="mono px-4 py-2">{(Number(b.pendingPool) / 1e9).toFixed(5)}</td>
                {data.testMode && (
                  <td className="flex flex-wrap gap-1 px-4 py-2">
                    <B a="test-buy" label="Buy" extra={{ boxId: b.id }} /><B a="test-sell" label="Sell" extra={{ boxId: b.id }} />
                    <B a="test-decohere" label="Decohere" extra={{ boxId: b.id }} /><B a="test-holders" label="Fake holders" extra={{ boxId: b.id }} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-line p-4 text-sm font-semibold">Payouts and burns</h2>
          <div className="max-h-96 divide-y divide-line overflow-auto text-sm">
            {data.burns.map((b) => <p key={b.id} className="px-4 py-2">#{b.box.number} burn {(Number(b.lamports) / 1e9).toFixed(5)} SOL · {b.status}</p>)}
            {data.payouts.map((p) => <p key={p.id} className="px-4 py-2">#{p.box.number} {p.kind.toLowerCase()} {short(p.wallet)} {(Number(p.lamports) / 1e9).toFixed(6)} SOL · {p.status}</p>)}
          </div>
        </section>
        <section className="card overflow-hidden">
          <h2 className="border-b border-line p-4 text-sm font-semibold">Log</h2>
          <div className="mono max-h-96 divide-y divide-line overflow-auto">
            {data.logs.map((l) => <p key={l.id} className={`px-4 py-1.5 ${l.level === 'error' ? 'text-down' : l.level === 'warn' ? 'text-ink' : 'text-mute'}`}>{new Date(l.at).toLocaleTimeString()} [{l.scope}] {l.msg}</p>)}
          </div>
        </section>
      </div>
    </div>
  );
}
