import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Boxes, Search, ShieldAlert, Filter } from 'lucide-react';

import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { LoadingState } from '../components/ip/LoadingState';
import { ErrorState } from '../components/ip/ErrorState';

type Item = { id: string; sku: string; name: string; category: string; minStock: number };
type Warehouse = { id: string; name: string; location?: string };
type Stock = { id: string; item: Item; warehouse: Warehouse; quantity: number };

type StockRow = {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  minStock: number;
  total: number;
  byWarehouse: { warehouse: string; quantity: number }[];
};

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

export default function InventoryStatus() {
  const { socket } = useSocket();
  const [items, setItems] = useState<Item[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);

  const load = useCallback(async () => {
    const [itemsRes, stocksRes] = await Promise.all([
      api.get('/inventory/items'),
      api.get('/inventory/stocks'),
    ]);
    setItems(itemsRes.data);
    setStocks(stocksRes.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        setError('No se pudo cargar el estatus del inventario.');
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
    socket.on('stock:updated', handler);
    return () => {
      socket.off('inventory:movement', handler);
      socket.off('stock:updated', handler);
    };
  }, [socket, load]);

  const rows: StockRow[] = useMemo(() => {
    const byItem = new Map<string, StockRow>();
    for (const it of items) {
      byItem.set(it.id, {
        itemId: it.id,
        sku: it.sku,
        name: it.name,
        category: it.category,
        minStock: it.minStock,
        total: 0,
        byWarehouse: [],
      });
    }
    for (const s of stocks) {
      const id = s.item?.id;
      if (!id) continue;
      const row = byItem.get(id);
      if (!row) continue;
      row.total += s.quantity || 0;
      row.byWarehouse.push({ warehouse: s.warehouse?.name || '—', quantity: s.quantity || 0 });
    }
    return Array.from(byItem.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, stocks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyLow && r.total > r.minStock) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [rows, search, onlyLow]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <LoadingState message="Cargando estatus..." />
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%)]" />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              to="/inventory"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver al inventario
            </Link>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
              Estatus del inventario
            </h1>
            <p className="mt-1 text-sm text-slate-600">Existencias actuales por item y almacén.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/80 px-4 py-2 text-sm shadow-sm">
            <Boxes className="h-4 w-4 text-emerald-700" />
            <span className="font-semibold text-slate-800">{rows.length}</span>
            <span className="text-slate-500">items</span>
          </div>
        </div>

        <div className={`${glassCard} flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center`}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, SKU o categoría"
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setOnlyLow((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              onlyLow
                ? 'border-rose-300 bg-rose-100/70 text-rose-700'
                : 'border-slate-200 bg-white/80 text-slate-700 hover:border-emerald-300'
            }`}
          >
            <Filter className="h-4 w-4" /> Solo en alerta
          </button>
        </div>

        <div className={`${glassCard} overflow-hidden rounded-3xl`}>
          <div className="hidden grid-cols-12 gap-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:grid">
            <div className="col-span-4">Item</div>
            <div className="col-span-2">SKU</div>
            <div className="col-span-2">Categoría</div>
            <div className="col-span-1 text-right">Mínimo</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-2">Almacenes</div>
          </div>

          {filtered.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No hay items para mostrar.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((r) => {
                const isLow = r.total <= r.minStock;
                return (
                  <li key={r.itemId} className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-12 sm:items-center">
                    <div className="sm:col-span-4">
                      <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                      {isLow && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                          <ShieldAlert className="h-3 w-3" /> En umbral crítico
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 sm:col-span-2">{r.sku}</div>
                    <div className="text-xs text-slate-500 sm:col-span-2">{r.category || '—'}</div>
                    <div className="text-sm text-slate-700 sm:col-span-1 sm:text-right">{r.minStock}</div>
                    <div
                      className={`text-base font-bold sm:col-span-1 sm:text-right ${
                        isLow ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {r.total}
                    </div>
                    <div className="flex flex-wrap gap-1 sm:col-span-2">
                      {r.byWarehouse.length === 0 ? (
                        <span className="text-[11px] text-slate-400">Sin stock</span>
                      ) : (
                        r.byWarehouse.map((w, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700"
                          >
                            {w.warehouse}: {w.quantity}
                          </span>
                        ))
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
