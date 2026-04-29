import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, Boxes, ClipboardList, Settings2, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { LoadingState } from '../components/ip/LoadingState';
import { ErrorState } from '../components/ip/ErrorState';

type Item = { id: string; sku: string; name: string; category: string; minStock: number };
type Warehouse = { id: string; name: string; location?: string };
type Stock = { id: string; item: Item; warehouse: Warehouse; quantity: number };
type Movement = {
  id: string;
  item: Item;
  type: 'IN' | 'OUT';
  quantity: number;
  note: string;
  timestamp: string;
};

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes <= 1) return 'Hace un minuto';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function InventoryHome() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const isAdmin = user?.role === 'ADMIN';

  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ itemId: '', warehouseId: '', quantity: 1, note: '' });

  const load = useCallback(async () => {
    const [itemsRes, whRes, stocksRes, movsRes] = await Promise.all([
      api.get('/inventory/items'),
      api.get('/inventory/warehouses'),
      api.get('/inventory/stocks'),
      api.get('/inventory/movements'),
    ]);
    setItems(itemsRes.data);
    setWarehouses(whRes.data);
    setStocks(stocksRes.data);
    setMovements(movsRes.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        console.error('No se pudo cargar el inventario', err);
        setError('No se pudo cargar el inventario. Inténtalo nuevamente.');
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
    socket.on('inventory:updated', handler);
    socket.on('stock:updated', handler);
    return () => {
      socket.off('inventory:movement', handler);
      socket.off('inventory:updated', handler);
      socket.off('stock:updated', handler);
    };
  }, [socket, load]);

  const lowStockCount = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const s of stocks) {
      const id = s.item?.id;
      if (!id) continue;
      totals[id] = (totals[id] || 0) + (s.quantity || 0);
    }
    return items.filter((it) => (totals[it.id] || 0) <= it.minStock).length;
  }, [stocks, items]);

  const recentMovements = useMemo(
    () =>
      [...movements]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8),
    [movements],
  );

  const movementType: 'IN' | 'OUT' = isAdmin ? 'IN' : 'OUT';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.itemId || !form.warehouseId || form.quantity <= 0) {
      toast.error('Completa item, almacén y cantidad.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/movements', {
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        type: movementType,
        quantity: form.quantity,
        note: form.note.trim() || (movementType === 'IN' ? 'Ingreso' : 'Egreso'),
      });
      toast.success(movementType === 'IN' ? 'Ingreso registrado' : 'Egreso registrado');
      setForm((prev) => ({ ...prev, quantity: 1, note: '' }));
      await load();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo registrar el movimiento.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <LoadingState message="Cargando inventario..." />
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="relative min-h-full px-3 py-4 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_60%)]" />

      <div className="relative z-10 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-700/80">Inventario</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            {isAdmin ? 'Registrar ingresos al inventario' : 'Registrar egresos del inventario'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {isAdmin
              ? 'Como admin, registrá las entradas de mercadería y consultá el estado del inventario.'
              : 'Como colaborador, registrá las salidas de inventario que retiraste o asignaste.'}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            to="/inventory/estatus"
            className={`${glassCard} group flex items-center justify-between rounded-3xl p-5 transition hover:-translate-y-1 hover:shadow-emerald-200`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-700/80">Existencias</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">Ver estatus</p>
              <p className="mt-1 text-xs text-slate-500">Lista de existencias actuales</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700">
              <Boxes className="h-6 w-6" />
            </div>
          </Link>

          <Link
            to="/inventory/movimientos"
            className={`${glassCard} group flex items-center justify-between rounded-3xl p-5 transition hover:-translate-y-1 hover:shadow-sky-200`}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-700/80">Movimientos</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">Ver movimientos</p>
              <p className="mt-1 text-xs text-slate-500">Entradas y salidas registradas</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-700">
              <ClipboardList className="h-6 w-6" />
            </div>
          </Link>

          {isAdmin && (
            <Link
              to="/inventory/config"
              className={`${glassCard} group flex items-center justify-between rounded-3xl p-5 transition hover:-translate-y-1 hover:shadow-amber-200`}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-700/80">Configuración</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">Items y almacenes</p>
                <p className="mt-1 text-xs text-slate-500">Crear / editar catálogo y umbrales</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
                <Settings2 className="h-6 w-6" />
              </div>
            </Link>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <motion.form
            onSubmit={submit}
            className={`${glassCard} rounded-3xl p-6 xl:col-span-3`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  movementType === 'IN' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-600'
                }`}
              >
                {movementType === 'IN' ? <ArrowDownCircle className="h-6 w-6" /> : <ArrowUpCircle className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {movementType === 'IN' ? 'Registrar ingreso' : 'Registrar egreso'}
                </h2>
                <p className="text-xs text-slate-500">
                  {movementType === 'IN'
                    ? 'Suma stock al almacén seleccionado.'
                    : 'Resta stock del almacén seleccionado.'}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Item</span>
                <select
                  value={form.itemId}
                  onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Selecciona un item</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} — {it.sku}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Almacén</span>
                <select
                  value={form.warehouseId}
                  onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Selecciona un almacén</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cantidad</span>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              </label>

              <label className="block sm:col-span-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Nota (opcional)</span>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder={movementType === 'IN' ? 'Compra, devolución...' : 'Asignación, descarte...'}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
              <span>
                Registrado por <strong>{user?.name || user?.email}</strong>
              </span>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? 'Guardando...' : movementType === 'IN' ? 'Registrar ingreso' : 'Registrar egreso'}
              </button>
            </div>
          </motion.form>

          <motion.div
            className={`${glassCard} flex flex-col rounded-3xl p-6 xl:col-span-2`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Resumen</h2>
              <button
                onClick={() => load().catch(() => {})}
                className="flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <RefreshCw className="h-3 w-3" /> Actualizar
              </button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wide text-emerald-700">Items</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{items.length}</p>
              </div>
              <div className="rounded-2xl bg-sky-500/10 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wide text-sky-700">Almacenes</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{warehouses.length}</p>
              </div>
              <div className="rounded-2xl bg-rose-500/10 p-3 text-center">
                <p className="text-[11px] uppercase tracking-wide text-rose-600">Bajos</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{lowStockCount}</p>
              </div>
            </div>
            {lowStockCount > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-700">
                <ShieldAlert className="h-4 w-4" />
                Hay {lowStockCount} item{lowStockCount === 1 ? '' : 's'} en umbral crítico.
              </div>
            )}
          </motion.div>
        </div>

        <motion.div
          className={`${glassCard} rounded-3xl p-6`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Últimos movimientos</h2>
            <Link to="/inventory/movimientos" className="text-xs font-semibold text-emerald-700 hover:underline">
              Ver todos →
            </Link>
          </div>
          {recentMovements.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aún no hay movimientos registrados.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recentMovements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                        m.type === 'IN'
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-rose-500/15 text-rose-600'
                      }`}
                    >
                      {m.type === 'IN' ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {m.item?.name || 'Item'} · {m.quantity} u.
                      </p>
                      <p className="text-xs text-slate-500">{m.note}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{relativeTime(m.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </div>
    </div>
  );
}
