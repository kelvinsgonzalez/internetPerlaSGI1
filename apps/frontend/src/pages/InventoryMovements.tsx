import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Search } from 'lucide-react';

import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { LoadingState } from '../components/ip/LoadingState';
import { ErrorState } from '../components/ip/ErrorState';

type Item = { id: string; sku: string; name: string };
type Warehouse = { id: string; name: string };
type Movement = {
  id: string;
  item: Item;
  warehouse?: Warehouse;
  type: 'IN' | 'OUT';
  quantity: number;
  note: string;
  timestamp: string;
};

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

type Filter = 'ALL' | 'IN' | 'OUT';

function formatDate(value: string) {
  const d = new Date(value);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InventoryMovements() {
  const { socket } = useSocket();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const res = await api.get('/inventory/movements');
    setMovements(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        setError('No se pudieron cargar los movimientos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      load().catch(() => {});
    };
    socket.on('inventory:movement', handler);
    return () => {
      socket.off('inventory:movement', handler);
    };
  }, [socket, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...movements]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .filter((m) => {
        if (filter !== 'ALL' && m.type !== filter) return false;
        if (!q) return true;
        return (
          (m.item?.name || '').toLowerCase().includes(q) ||
          (m.item?.sku || '').toLowerCase().includes(q) ||
          (m.note || '').toLowerCase().includes(q)
        );
      });
  }, [movements, filter, search]);

  const totals = useMemo(() => {
    let inQ = 0,
      outQ = 0;
    for (const m of movements) {
      if (m.type === 'IN') inQ += m.quantity;
      else outQ += m.quantity;
    }
    return { inQ, outQ };
  }, [movements]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <LoadingState message="Cargando movimientos..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="relative min-h-full px-3 py-4 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_55%)]" />

      <div className="relative z-10 space-y-6">
        <div>
          <Link
            to="/inventory"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inventario
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Movimientos</h1>
          <p className="mt-1 text-sm text-slate-600">Entradas y salidas registradas en el inventario.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className={`${glassCard} rounded-2xl p-4`}>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Total movimientos</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{movements.length}</p>
          </div>
          <div className={`${glassCard} rounded-2xl p-4`}>
            <p className="text-[11px] uppercase tracking-wider text-emerald-700">Entradas (unid.)</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{totals.inQ}</p>
          </div>
          <div className={`${glassCard} rounded-2xl p-4`}>
            <p className="text-[11px] uppercase tracking-wider text-rose-600">Salidas (unid.)</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{totals.outQ}</p>
          </div>
        </div>

        <div className={`${glassCard} flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center`}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por item, SKU o nota"
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white/80 p-1 text-sm">
            {(['ALL', 'IN', 'OUT'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1 font-semibold transition ${
                  filter === f
                    ? f === 'IN'
                      ? 'bg-emerald-600 text-white'
                      : f === 'OUT'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f === 'ALL' ? 'Todos' : f === 'IN' ? 'Entradas' : 'Salidas'}
              </button>
            ))}
          </div>
        </div>

        <div className={`${glassCard} overflow-hidden rounded-3xl`}>
          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No hay movimientos para los filtros aplicados.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        m.type === 'IN'
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-rose-500/15 text-rose-600'
                      }`}
                    >
                      {m.type === 'IN' ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {m.item?.name || 'Item'} <span className="text-slate-400">·</span>{' '}
                        <span className={m.type === 'IN' ? 'text-emerald-700' : 'text-rose-600'}>
                          {m.type === 'IN' ? '+' : '-'}
                          {m.quantity} u.
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.note || 'Sin nota'}
                        {m.warehouse?.name ? ` · ${m.warehouse.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{formatDate(m.timestamp)}</p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        m.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      {m.type === 'IN' ? 'Entrada' : 'Salida'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
