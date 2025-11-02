import type { ElementType } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Box, Boxes, Building2, CheckCircle2, ClipboardList, Filter, PackageSearch, PackageX, RefreshCw, Search, Sparkles, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { LoadingState } from '../components/ip/LoadingState';
import { ErrorState } from '../components/ip/ErrorState';

type Item = { id: string; sku: string; name: string; category: string; minStock: number };
type Warehouse = { id: string; name: string; location?: string };
type Stock = { id: string; item: Item; warehouse: Warehouse; quantity: number };
type Movement = { id: string; item: Item; type: 'IN' | 'OUT'; quantity: number; note: string; timestamp: string };
type MovementPayload = { itemId: string; warehouseId: string; type: 'IN' | 'OUT'; quantity: number; note: string };
type CurrentUser = ReturnType<typeof useAuth>['user'];

type WorkerNote = { userId: string; mode: 'IN' | 'OUT'; identity: string; message: string };

type AdminInventoryProps = {
  items: Item[];
  warehouses: Warehouse[];
  stocks: Stock[];
  movements: Movement[];
  error: string | null;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onCreateItem: (payload: { sku: string; name: string; category: string; minStock: number }) => Promise<void>;
  onCreateWarehouse: (payload: { name: string; location?: string }) => Promise<void>;
  onCreateMovement: (payload: MovementPayload) => Promise<void>;
  onUpdateItem: (id: string, payload: { sku?: string; name?: string; category?: string; minStock?: number }) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
};

type WorkerInventoryProps = {
  user: CurrentUser;
  items: Item[];
  warehouses: Warehouse[];
  stocks: Stock[];
  movements: Movement[];
  error: string | null;
  refreshing: boolean;
  onRefresh: () => Promise<void>;
  onCreateMovement: (payload: MovementPayload) => Promise<void>;
};

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';
const WORKER_NOTE_PREFIX = 'WORKER@';

const StatCard = ({
  icon: Icon,
  title,
  value,
  hint,
  accent,
}: {
  icon: ElementType;
  title: string;
  value: string;
  hint: string;
  accent: string;
}) => (
  <motion.div
    whileHover={{ translateY: -6, scale: 1.01 }}
    transition={{ type: 'spring', stiffness: 240, damping: 20 }}
    className={`${glassCard} relative overflow-hidden rounded-3xl p-6 text-slate-900`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-transparent to-sky-400/10" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-700/80">{title}</p>
        <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      </div>
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent}`}>
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </motion.div>
);

function encodeWorkerNote(user: CurrentUser, mode: 'IN' | 'OUT', message: string): string {
  const identity = user?.name || user?.email || 'Colaborador';
  const encodedMessage = encodeURIComponent(message || '');
  const encodedIdentity = encodeURIComponent(identity);
  return `${WORKER_NOTE_PREFIX}${user?.sub || ''}|${mode}|${encodedIdentity}|${encodedMessage}`;
}

function decodeWorkerNote(note: string): WorkerNote | null {
  if (!note || !note.startsWith(WORKER_NOTE_PREFIX)) return null;
  const payload = note.slice(WORKER_NOTE_PREFIX.length).split('|');
  if (payload.length < 4) return null;
  const [userId, mode, identity, message] = payload;
  return {
    userId,
    mode: mode === 'IN' ? 'IN' : 'OUT',
    identity: decodeURIComponent(identity || ''),
    message: decodeURIComponent(message || ''),
  };
}

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

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-ES').format(value);
}

function describeMovement(movement: Movement) {
  const meta = decodeWorkerNote(movement.note);
  if (meta) {
    const action = meta.mode === 'OUT' ? 'Retiro' : 'Devolución';
    return `${action} • ${meta.identity}${meta.message ? ` • ${meta.message}` : ''}`;
  }
  return movement.note || (movement.type === 'IN' ? 'Ingreso registrado' : 'Salida registrada');
}

export default function Inventory() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [itemsRes, warehousesRes, stocksRes, movementsRes] = await Promise.all([
      api.get('/inventory/items'),
      api.get('/inventory/warehouses'),
      api.get('/inventory/stocks'),
      api.get('/inventory/movements'),
    ]);
    setItems(itemsRes.data);
    setWarehouses(warehousesRes.data);
    setStocks(stocksRes.data);
    setMovements(movementsRes.data);
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

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
      setError(null);
    } catch (err) {
      console.error('No se pudo sincronizar el inventario', err);
      toast.error('No se pudo sincronizar el inventario.');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      refresh();
    };
    socket.on('inventory:movement', handler);
    socket.on('inventory:updated', handler);
    socket.on('stock:updated', handler);
    return () => {
      socket.off('inventory:movement', handler);
      socket.off('inventory:updated', handler);
      socket.off('stock:updated', handler);
    };
  }, [socket, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const createItem = useCallback(
    async (payload: { sku: string; name: string; category: string; minStock: number }) => {
      try {
        await api.post('/inventory/items', payload);
        toast.success('Item registrado');
        await refresh();
      } catch (err: any) {
        console.error('No se pudo crear el item', err);
        const message = err?.response?.data?.message;
        toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo crear el item.');
        throw err;
      }
    },
    [refresh],
  );

  const createWarehouse = useCallback(
    async (payload: { name: string; location?: string }) => {
      try {
        await api.post('/inventory/warehouses', payload);
        toast.success('Almacén agregado');
        await refresh();
      } catch (err: any) {
        console.error('No se pudo crear el almacén', err);
        const message = err?.response?.data?.message;
        toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo crear el almacén.');
        throw err;
      }
    },
    [refresh],
  );

  const createMovement = useCallback(
    async (payload: MovementPayload) => {
      try {
        const body = { ...payload, note: payload.note?.trim() || 'Movimiento manual' };
        await api.post('/inventory/movements', body);
        toast.success(body.type === 'IN' ? 'Ingreso registrado' : 'Salida registrada');
        await refresh();
      } catch (err: any) {
        console.error('No se pudo registrar el movimiento', err);
        const message = err?.response?.data?.message;
        toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo registrar el movimiento.');
        throw err;
      }
    },
    [refresh],
  );

  const updateItem = useCallback(
    async (id: string, payload: { sku?: string; name?: string; category?: string; minStock?: number }) => {
      try {
        await api.patch(`/inventory/items/${id}`, payload);
        toast.success('Item actualizado');
        await refresh();
      } catch (err: any) {
        console.error('No se pudo actualizar el item', err);
        const message = err?.response?.data?.message;
        toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo actualizar el item.');
        throw err;
      }
    },
    [refresh],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/inventory/items/${id}`);
        toast.success('Item eliminado');
        await refresh();
      } catch (err: any) {
        console.error('No se pudo eliminar el item', err);
        const message = err?.response?.data?.message;
        toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo eliminar el item.');
        throw err;
      }
    },
    [refresh],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <LoadingState message="Cargando inventario inteligente..." />
      </div>
    );
  }

  if (!loading && error && items.length === 0 && warehouses.length === 0 && stocks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <ErrorState message={error} onRetry={refresh} />
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  if (isAdmin) {
    return (
      <AdminInventory
        items={items}
        warehouses={warehouses}
        stocks={stocks}
        movements={movements}
        error={error}
        refreshing={refreshing}
        onRefresh={refresh}
        onCreateItem={createItem}
        onCreateWarehouse={createWarehouse}
        onCreateMovement={createMovement}
        onUpdateItem={updateItem}
        onDeleteItem={deleteItem}
      />
    );
  }

  return (
    <WorkerInventory
      user={user}
      items={items}
      warehouses={warehouses}
      stocks={stocks}
      movements={movements}
      error={error}
      refreshing={refreshing}
      onRefresh={refresh}
      onCreateMovement={createMovement}
    />
  );
}

function AdminInventory({
  items,
  warehouses,
  stocks,
  movements,
  error,
  refreshing,
  onRefresh,
  onCreateItem,
  onCreateWarehouse,
  onCreateMovement,
  onUpdateItem,
  onDeleteItem,
}: AdminInventoryProps) {
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<'ALL' | string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LOW' | 'HEALTHY'>('ALL');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ sku: '', name: '', category: '', minStock: 0 });
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });
  const [movementForm, setMovementForm] = useState<MovementPayload>({ itemId: '', warehouseId: '', type: 'OUT', quantity: 1, note: '' });

  const categories = useMemo(() => {
    const set = new Set(items.map((item) => item.category).filter(Boolean));
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    const grouped = new Map<string, { item: Item; stocks: Stock[] }>();
    for (const stock of stocks) {
      const entry = grouped.get(stock.item.id) || { item: stock.item, stocks: [] };
      entry.stocks.push(stock);
      grouped.set(stock.item.id, entry);
    }

    return Array.from(grouped.values())
      .filter(({ item, stocks: itemStocks }) => {
        if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
          return false;
        }

        const stocksForFilter =
          warehouseFilter === 'ALL'
            ? itemStocks
            : itemStocks.filter((stock) => stock.warehouse?.id === warehouseFilter);

        if (warehouseFilter !== 'ALL' && stocksForFilter.length === 0) {
          return false;
        }

        const effectiveStocks = stocksForFilter.length > 0 ? stocksForFilter : itemStocks;
        const totalQuantity = effectiveStocks.reduce((sum, stock) => sum + (stock.quantity || 0), 0);

        if (riskFilter === 'LOW' && totalQuantity > item.minStock) {
          return false;
        }
        if (riskFilter === 'HEALTHY' && totalQuantity <= item.minStock) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          item.name,
          item.sku,
          item.category,
          ...effectiveStocks.map((stock) => stock.warehouse?.name ?? ''),
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      })
      .map(({ item, stocks: itemStocks }) => {
        const stocksForFilter =
          warehouseFilter === 'ALL'
            ? itemStocks
            : itemStocks.filter((stock) => stock.warehouse?.id === warehouseFilter);
        const effectiveStocks = stocksForFilter.length > 0 ? stocksForFilter : itemStocks;
        const totalQuantity = effectiveStocks.reduce((sum, stock) => sum + (stock.quantity || 0), 0);

        return {
          item,
          stocks: effectiveStocks,
          totalQuantity,
          isLow: totalQuantity <= item.minStock,
        };
      })
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [stocks, warehouseFilter, categoryFilter, riskFilter, search]);

  const stats = useMemo(() => {
    const totalUnits = stocks.reduce((acc, stock) => acc + stock.quantity, 0);
    const low = stocks.filter((stock) => stock.quantity <= stock.item.minStock).length;
    const uniqueCategories = new Set(items.map((item) => item.category).filter(Boolean)).size;
    return {
      items: items.length,
      warehouses: warehouses.length,
      units: totalUnits,
      low,
      categories: uniqueCategories,
    };
  }, [stocks, items, warehouses]);

  const warehouseSummary = useMemo(() => {
    const map = new Map<string, { warehouse: Warehouse; total: number; critical: number }>();
    for (const stock of stocks) {
      const current = map.get(stock.warehouse.id) || { warehouse: stock.warehouse, total: 0, critical: 0 };
      current.total += stock.quantity;
      if (stock.quantity <= stock.item.minStock) current.critical += 1;
      map.set(stock.warehouse.id, current);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [stocks]);

  const critical = useMemo(
    () =>
      stocks
        .filter((stock) => stock.quantity <= stock.item.minStock)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 6),
    [stocks],
  );

  const recentMovements = useMemo(
    () =>
      [...movements]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 18),
    [movements],
  );

  const openMovementModal = (stock?: Stock, type: 'IN' | 'OUT' = 'OUT') => {
    setMovementForm({
      itemId: stock?.item.id || '',
      warehouseId: stock?.warehouse.id || '',
      type,
      quantity: 1,
      note: '',
    });
    setShowMovementModal(true);
  };

  const openEditItem = (item: Item) => {
    setEditingItemId(item.id);
    setItemForm({
      sku: item.sku,
      name: item.name,
      category: item.category,
      minStock: item.minStock,
    });
    setShowItemModal(true);
  };

  const confirmDeleteItem = (item: Item) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el item "${item.name}"? No podrá recuperarse.`)) {
      onDeleteItem(item.id).catch(() => {
        // Error handled in hook
      });
    }
  };

  const submitItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemForm.sku.trim() || !itemForm.name.trim()) {
      toast.warning('Completa el SKU y el nombre.');
      return;
    }
    try {
      const payload = {
        sku: itemForm.sku.trim(),
        name: itemForm.name.trim(),
        category: itemForm.category.trim() || 'General',
        minStock: Number.isNaN(itemForm.minStock) ? 0 : Math.max(0, itemForm.minStock),
      };

      if (editingItemId) {
        await onUpdateItem(editingItemId, payload);
      } else {
        await onCreateItem(payload);
      }

      setItemForm({ sku: '', name: '', category: '', minStock: 0 });
      setEditingItemId(null);
      setShowItemModal(false);
    } catch {
      // handled in hook
    }
  };

  const submitWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseForm.name.trim()) {
      toast.warning('El nombre del almacén es obligatorio.');
      return;
    }
    try {
      await onCreateWarehouse({
        name: warehouseForm.name.trim(),
        location: warehouseForm.location.trim() || undefined,
      });
      setWarehouseForm({ name: '', location: '' });
      setShowWarehouseModal(false);
    } catch {
      // handled in hook
    }
  };

  const submitMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!movementForm.itemId || !movementForm.warehouseId) {
      toast.warning('Selecciona item y almacén.');
      return;
    }
    if (movementForm.quantity <= 0) {
      toast.warning('La cantidad debe ser mayor a cero.');
      return;
    }
    try {
      await onCreateMovement({ ...movementForm, note: movementForm.note.trim() });
      setMovementForm({ itemId: '', warehouseId: '', type: 'OUT', quantity: 1, note: '' });
      setShowMovementModal(false);
    } catch {
      // handled in hook
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <motion.span
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-700/30 bg-emerald-600/15 px-4 py-1 text-xs font-semibold text-emerald-800 shadow-sm"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Operaciones en vivo
            </motion.span>
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Centro maestro de inventario
            </motion.h1>
            <motion.p
              className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Controla niveles, reposiciones y retiros con dashboards inteligentes, filtros de precisión y actualizaciones instantáneas.
            </motion.p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowItemModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-700/30 transition hover:bg-emerald-800"
            >
              <Boxes className="h-4 w-4" /> Nuevo item
            </button>
            <button
              onClick={() => setShowWarehouseModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700"
            >
              <Building2 className="h-4 w-4" /> Crear almacén
            </button>
            <button
              onClick={() => openMovementModal()}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700"
            >
              <ClipboardList className="h-4 w-4" /> Registrar movimiento
            </button>
            <button
              onClick={() => onRefresh()}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Sincronizar
            </button>
          </div>
        </header>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-700 shadow"
          >
            <span>{error}</span>
            <button onClick={() => onRefresh()} className="font-semibold underline">Reintentar</button>
          </motion.div>
        )}

        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard
            icon={Boxes}
            title="Items activos"
            value={formatNumber(stats.items)}
            hint={`${stats.categories} categorías detectadas`}
            accent="bg-emerald-700/20 text-emerald-800"
          />
          <StatCard
            icon={Building2}
            title="Almacenes"
            value={formatNumber(stats.warehouses)}
            hint="Centros logísticos sincronizados"
            accent="bg-emerald-600/20 text-emerald-700"
          />
          <StatCard
            icon={Box}
            title="Unidades disponibles"
            value={formatNumber(stats.units)}
            hint="Sumatoria total en stock"
            accent="bg-emerald-500/20 text-emerald-700"
          />
          <StatCard
            icon={AlertTriangle}
            title="Alertas críticas"
            value={formatNumber(stats.low)}
            hint="Items por debajo del mínimo"
            accent="bg-amber-500/20 text-amber-700"
          />
        </div>

        <section className={`${glassCard} flex flex-1 flex-col rounded-3xl p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Existencias en vivo</h2>
              <p className="text-sm text-slate-500">Filtra por almacén, categoría o nivel de riesgo para tomar decisiones instantáneas.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar SKU, nombre o almacén"
                  className="w-64 rounded-full border border-emerald-700/30 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-700 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-700/30 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-800">
                <Filter className="h-3.5 w-3.5" /> Filtros activos
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              value={warehouseFilter}
              onChange={(event) => setWarehouseFilter(event.target.value)}
              className="rounded-full border border-emerald-700/30 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-inner focus:border-emerald-700 focus:outline-none"
            >
              <option value="ALL">Todos los almacenes</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-full border border-emerald-700/30 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-inner focus:border-emerald-700 focus:outline-none"
            >
              <option value="ALL">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}
              className="rounded-full border border-emerald-700/30 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 shadow-inner focus:border-emerald-700 focus:outline-none"
            >
              <option value="ALL">Todos los niveles</option>
              <option value="LOW">Solo críticos</option>
              <option value="HEALTHY">En equilibrio</option>
            </select>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/40">
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
              <table className="min-w-full text-sm">
                <thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Almacén</th>
                    <th className="px-4 py-3 text-right">Disponible</th>
                    <th className="px-4 py-3 text-right">Mínimo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50/60 bg-white/70">
                  {filteredItems.map((summary) => {
                    const targetStock = summary.stocks[0];
                    const warehouseNames = summary.stocks
                      .map((stock) => stock.warehouse?.name)
                      .filter(Boolean)
                      .join(', ');
                    return (
                      <tr key={summary.item.id} className="transition hover:bg-emerald-50/70">
                        <td className="px-4 py-3 font-semibold text-slate-800">{summary.item.name}</td>
                        <td className="px-4 py-3 text-slate-500">{summary.item.sku}</td>
                        <td className="px-4 py-3 text-slate-500">{warehouseNames || 'Sin almacén'}</td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${summary.isLow ? 'text-amber-600' : 'text-emerald-600'}`}
                        >
                          {formatNumber(summary.totalQuantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">{formatNumber(summary.item.minStock)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => openMovementModal(targetStock, 'IN')}
                              className="rounded-full border border-emerald-700/40 bg-white px-3 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                            >
                              Reponer
                            </button>
                            <button
                              onClick={() => openMovementModal(targetStock, 'OUT')}
                              className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              disabled={summary.totalQuantity === 0}
                            >
                              Retirar
                            </button>
                            <button
                              onClick={() => openEditItem(summary.item)}
                              className="rounded-full border border-blue-700/40 bg-white px-3 py-1 text-xs font-semibold text-blue-800 transition hover:bg-blue-50"
                              title="Editar item"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => confirmDeleteItem(summary.item)}
                              className="rounded-full border border-red-700/40 bg-white px-3 py-1 text-xs font-semibold text-red-800 transition hover:bg-red-50"
                              title="Eliminar item"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                        No hay elementos que coincidan con los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {warehouseSummary.map((summary) => (
              <div
                key={summary.warehouse.id}
                className="rounded-full border border-emerald-200/70 bg-white/70 px-4 py-2 text-xs font-semibold text-emerald-700 shadow"
              >
                {summary.warehouse.name}: {formatNumber(summary.total)} unidades • {summary.critical} críticos
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <div className={`${glassCard} rounded-3xl p-6`}>
            <h3 className="text-base font-semibold text-slate-900">Alertas inmediatas</h3>
            <p className="text-xs text-slate-500">Items que requieren acción en los próximos minutos.</p>
            <div className="mt-4 max-h-[340px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {critical.map((stock) => (
                <motion.div
                  key={`${stock.item.id}-${stock.warehouse.id}`}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center justify-between rounded-2xl border border-amber-200/60 bg-amber-50/70 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-amber-700">{stock.item.name}</p>
                    <p className="text-xs text-amber-600">{stock.warehouse.name} • Min {stock.item.minStock}</p>
                  </div>
                  <div className="text-right text-sm font-semibold text-amber-700">{formatNumber(stock.quantity)}</div>
                </motion.div>
              ))}
              {critical.length === 0 && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-600">
                  Todo está saludable. No hay alertas activas.
                </div>
              )}
            </div>
          </div>

          <div className={`${glassCard} flex flex-col rounded-3xl p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Movimientos en tiempo real</h3>
                <p className="text-xs text-slate-500">Los últimos eventos registrados en la plataforma.</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-4 flex-1 overflow-y-auto custom-scrollbar max-h-[420px]">
              <ul className="space-y-3">
                {recentMovements.map((movement) => (
                  <motion.li
                    key={movement.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/40 bg-white/80 px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{relativeTime(movement.timestamp)}</span>
                      <span className={movement.type === 'IN' ? 'text-emerald-500' : 'text-amber-600'}>
                        {movement.type === 'IN' ? 'Ingreso' : 'Retiro'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{movement.item.name}</p>
                    <p className="text-xs text-slate-500">{describeMovement(movement)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">Cantidad: {formatNumber(movement.quantity)}</p>
                  </motion.li>
                ))}
                {recentMovements.length === 0 && (
                  <li className="rounded-2xl border border-white/40 bg-white/80 px-4 py-6 text-center text-sm text-slate-400">
                    Aún no se registran movimientos.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showItemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur"
          >
            <motion.form
              onSubmit={submitItem}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {editingItemId ? 'Editar item' : 'Registrar nuevo item'}
              </h3>
              <p className="text-xs text-slate-500">Define la ficha técnica y el stock mínimo permitido.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input
                  value={itemForm.sku}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, sku: event.target.value }))}
                  placeholder="SKU"
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <input
                  value={itemForm.name}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Nombre comercial"
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <input
                  value={itemForm.category}
                  onChange={(event) => setItemForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="Categoría"
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <input
                  type="number"
                  value={itemForm.minStock}
                  onChange={(event) =>
                    setItemForm((prev) => ({ ...prev, minStock: parseInt(event.target.value || '0', 10) }))
                  }
                  placeholder="Stock mínimo"
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowItemModal(false);
                    setEditingItemId(null);
                    setItemForm({ sku: '', name: '', category: '', minStock: 1 });
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
                >
                  Guardar item
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWarehouseModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur"
          >
            <motion.form
              onSubmit={submitWarehouse}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-slate-900">Nuevo almacén</h3>
              <p className="text-xs text-slate-500">Integra un punto logístico adicional para tus operaciones.</p>
              <div className="mt-4 space-y-3">
                <input
                  value={warehouseForm.name}
                  onChange={(event) => setWarehouseForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Nombre del almacén"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <input
                  value={warehouseForm.location}
                  onChange={(event) => setWarehouseForm((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Ubicación (opcional)"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
                >
                  Guardar almacén
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMovementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur"
          >
            <motion.form
              onSubmit={submitMovement}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-slate-900">Registrar movimiento</h3>
              <p className="text-xs text-slate-500">Actualiza el inventario con retiros o ingresos controlados.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <select
                  value={movementForm.itemId}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, itemId: event.target.value }))}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Selecciona item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select
                  value={movementForm.warehouseId}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, warehouseId: event.target.value }))}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Selecciona almacén</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                <select
                  value={movementForm.type}
                  onChange={(event) => setMovementForm((prev) => ({ ...prev, type: event.target.value as 'IN' | 'OUT' }))}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="OUT">Retiro (OUT)</option>
                  <option value="IN">Ingreso (IN)</option>
                </select>
                <input
                  type="number"
                  value={movementForm.quantity}
                  onChange={(event) =>
                    setMovementForm((prev) => ({ ...prev, quantity: parseInt(event.target.value || '1', 10) }))
                  }
                  min={1}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                  placeholder="Cantidad"
                />
              </div>
              <textarea
                value={movementForm.note}
                onChange={(event) => setMovementForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Notas (responsable, motivo, ticket, etc.)"
                className="mt-3 h-24 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
                >
                  Confirmar movimiento
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type TaskWithTools = {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  proofUrl?: string;
  toolsUsed?: Array<{ itemId: string; quantity: number }>;
};

function WorkerInventory({
  user,
  items,
  warehouses,
  stocks,
  movements,
  error,
  refreshing,
  onRefresh,
  onCreateMovement,
}: WorkerInventoryProps) {
  const [search, setSearch] = useState('');
  const [tasks, setTasks] = useState<TaskWithTools[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [completedTaskAlert, setCompletedTaskAlert] = useState<TaskWithTools | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionMode, setActionMode] = useState<'IN' | 'OUT'>('OUT');
  const [actionItem, setActionItem] = useState<Item | null>(null);
  const [actionWarehouseId, setActionWarehouseId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [available, setAvailable] = useState(0);
  const [taskReportMode, setTaskReportMode] = useState<string | null>(null);
  const [selectedToolsForTask, setSelectedToolsForTask] = useState<Array<{ itemId: string; quantity: number }>>([]);
  const { socket } = useSocket();

  const loadTasks = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const { data } = await api.get('/tasks/mine');
      setTasks(data);
    } catch (err) {
      console.error('No se pudieron cargar las tareas', err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => loadTasks();
    const taskCompletedHandler = (taskData: any) => {
      const task = tasks.find((t) => t.id === taskData.id);
      if (task) {
        setCompletedTaskAlert(task);
        setTimeout(() => setCompletedTaskAlert(null), 10000);
      }
      loadTasks();
    };
    socket.on('task:created', handler);
    socket.on('task:updated', handler);
    socket.on('task:completed', taskCompletedHandler);
    return () => {
      socket.off('task:created', handler);
      socket.off('task:updated', handler);
      socket.off('task:completed', taskCompletedHandler);
    };
  }, [socket, loadTasks, tasks]);

  const filteredStocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return stocks
      .filter((stock) => stock.quantity > 0)
      .filter((stock) =>
        !query
          ? true
          : `${stock.item.name} ${stock.item.sku} ${stock.warehouse?.name ?? ''}`.toLowerCase().includes(query)
      )
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [stocks, search]);

  const activeTasks = useMemo(() => tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS'), [tasks]);

  const outstanding = useMemo(() => {
    if (!user?.sub) return [] as Array<{ item: Item; quantity: number; last: string; identity: string }>;
    const map = new Map<string, { item: Item; quantity: number; last: string; identity: string }>();
    movements.forEach((movement) => {
      const meta = decodeWorkerNote(movement.note);
      if (!meta || meta.userId !== user.sub) return;
      const entry = map.get(movement.item.id) || {
        item: movement.item,
        quantity: 0,
        last: movement.timestamp,
        identity: meta.identity,
      };
      entry.quantity += meta.mode === 'OUT' ? movement.quantity : -movement.quantity;
      entry.last = movement.timestamp;
      entry.identity = meta.identity;
      map.set(movement.item.id, entry);
    });
    return Array.from(map.values()).filter((entry) => entry.quantity > 0).sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime());
  }, [movements, user?.sub]);

  const stats = useMemo(() => {
    const totalUnits = stocks.reduce((acc, stock) => acc + stock.quantity, 0);
    const active = outstanding.reduce((acc, entry) => acc + entry.quantity, 0);
    return {
      units: totalUnits,
      tools: filteredStocks.length,
      active,
    };
  }, [stocks, outstanding, filteredStocks.length]);

  const openTake = (stock: Stock) => {
    setActionMode('OUT');
    setActionItem(stock.item);
    setActionWarehouseId(stock.warehouse.id);
    setQuantity(Math.min(1, Math.max(stock.quantity ? 1 : 0, 1)));
    setMessage('');
    setAvailable(stock.quantity);
    setActionOpen(true);
  };

  const openReturn = (entry: { item: Item; quantity: number }) => {
    setActionMode('IN');
    setActionItem(entry.item);
    setActionWarehouseId(warehouses[0]?.id || '');
    setQuantity(entry.quantity);
    setMessage('');
    setAvailable(entry.quantity);
    setActionOpen(true);
  };

  const openToolReportForTask = (taskId: string) => {
    setTaskReportMode(taskId);
    setSelectedToolsForTask([]);
  };

  const addToolToTask = (itemId: string, qty: number) => {
    setSelectedToolsForTask((prev) => {
      const existing = prev.find((t) => t.itemId === itemId);
      if (existing) {
        return prev.map((t) => (t.itemId === itemId ? { ...t, quantity: t.quantity + qty } : t));
      }
      return [...prev, { itemId, quantity: qty }];
    });
  };

  const removeToolFromTask = (itemId: string) => {
    setSelectedToolsForTask((prev) => prev.filter((t) => t.itemId !== itemId));
  };

  const submitToolsForTask = async () => {
    if (!taskReportMode || selectedToolsForTask.length === 0) {
      toast.warning('Selecciona al menos una herramienta para la tarea.');
      return;
    }
    try {
      let successCount = 0;
      for (const tool of selectedToolsForTask) {
        const item = items.find((i) => i.id === tool.itemId);
        const stock = stocks.find((s) => s.item.id === tool.itemId);
        if (item && stock) {
          try {
            await onCreateMovement({
              itemId: item.id,
              warehouseId: stock.warehouse.id,
              type: 'OUT',
              quantity: tool.quantity,
              note: encodeWorkerNote(user, 'OUT', `Tarea asignada: ${tasks.find((t) => t.id === taskReportMode)?.title || 'Sin título'}`),
            });
            successCount++;
          } catch (itemErr: any) {
            console.error(`Error registrando ${item.name}:`, itemErr);
            const errorMsg = itemErr?.response?.data?.message || itemErr.message;
            toast.error(`No se pudo registrar ${item.name}: ${errorMsg}`);
          }
        }
      }
      if (successCount > 0) {
        toast.success(`${successCount} herramienta(s) registrada(s) para esta tarea`);
        setTaskReportMode(null);
        setSelectedToolsForTask([]);
      }
    } catch (err: any) {
      console.error('Error general al registrar herramientas', err);
      const message = err?.response?.data?.message || 'No se pudieron registrar las herramientas';
      toast.error(message);
    }
  };

  const submitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.sub || !actionItem) {
      toast.error('No pudimos identificar al usuario.');
      return;
    }
    if (!actionWarehouseId) {
      toast.warning('Selecciona un almacén.');
      return;
    }
    if (quantity <= 0) {
      toast.warning('Ingresa una cantidad válida.');
      return;
    }
    if (actionMode === 'OUT' && quantity > available) {
      toast.warning('La cantidad supera el stock disponible.');
      return;
    }
    if (actionMode === 'IN' && quantity > available) {
      toast.warning('No puedes devolver más de lo retirado.');
      return;
    }
    try {
      await onCreateMovement({
        itemId: actionItem.id,
        warehouseId: actionWarehouseId,
        type: actionMode,
        quantity,
        note: encodeWorkerNote(user, actionMode, message),
      });
      setActionOpen(false);
    } catch {
      // handled upstream
    }
  };

  const warehousesForItem = useMemo(() => {
    if (!actionItem) return warehouses;
    const related = stocks.filter((stock) => stock.item.id === actionItem.id).map((stock) => stock.warehouse);
    return related.length ? related : warehouses;
  }, [actionItem, warehouses, stocks]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.2),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <motion.span
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-white/70 px-4 py-1 text-xs font-semibold text-emerald-700 shadow-sm"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Registro ágil de herramientas
            </motion.span>
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Inventario de Trabajo
            </motion.h1>
            <motion.p
              className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Reporta herramientas para tus tareas, devuelve lo que uses y mantén todo controlado y rastreable.
            </motion.p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onRefresh()}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-700 shadow hover:bg-emerald-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Sincronizar
            </button>
          </div>
        </header>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-700 shadow"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence>
          {completedTaskAlert && (
            <motion.div
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              className="fixed bottom-6 right-6 z-50 max-w-sm"
            >
              <div className="backdrop-blur-xl bg-white/95 border-2 border-amber-300 rounded-2xl p-5 shadow-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-bold text-slate-900 text-sm">¡DEVOLUCIÓN PENDIENTE!</p>
                    <p className="text-xs text-slate-600 mt-1">
                      La tarea <span className="font-semibold">"{completedTaskAlert.title}"</span> ha sido completada.
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Por favor, registra la devolución de todas las herramientas que utilizaste en esta tarea.
                    </p>
                    <button
                      onClick={() => {
                        setCompletedTaskAlert(null);
                        document.querySelector('#tools-section')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="mt-3 inline-block px-4 py-2 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition"
                    >
                      Registrar Devoluciones
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard
            icon={ClipboardList}
            title="Tareas activas"
            value={formatNumber(activeTasks.length)}
            hint="Pendientes o en progreso"
            accent="bg-emerald-100 text-emerald-700"
          />
          <StatCard
            icon={Box}
            title="Unidades disponibles"
            value={formatNumber(stats.units)}
            hint="Total en el sistema"
            accent="bg-sky-100 text-sky-700"
          />
          <StatCard
            icon={PackageX}
            title="Lo mío en uso"
            value={formatNumber(stats.active)}
            hint="Herramientas registradas a mi nombre"
            accent="bg-amber-100 text-amber-700"
          />
        </div>

        <section className={`${glassCard} flex flex-1 flex-col rounded-3xl p-6`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Explorar stock disponible</h2>
              <p className="text-sm text-slate-500">Retira herramientas directamente o usa el flujo de tareas.</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar herramientas o almacenes"
                className="w-72 rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredStocks.map((stock) => (
              <motion.div
                key={stock.id}
                whileHover={{ translateY: -4 }}
                className="flex flex-col justify-between rounded-3xl border border-white/40 bg-white/80 p-4 shadow"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{stock.item.name}</p>
                  <p className="text-xs text-slate-500">{stock.warehouse.name}</p>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Disponible</p>
                    <p className="text-lg font-bold text-emerald-600">{formatNumber(stock.quantity)}</p>
                  </div>
                  <button
                    onClick={() => openTake(stock)}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-600"
                  >
                    Registrar retiro
                  </button>
                </div>
              </motion.div>
            ))}
            {filteredStocks.length === 0 && (
              <div className="rounded-3xl border border-white/40 bg-white/80 px-4 py-6 text-center text-sm text-slate-400">
                No encontramos herramientas disponibles con ese criterio.
              </div>
            )}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {taskReportMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl max-h-96 overflow-y-auto"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                Herramientas para: {tasks.find((t) => t.id === taskReportMode)?.title}
              </h3>
              <p className="text-xs text-slate-500">
                Selecciona las herramientas que utilizarás en esta tarea. Se registrarán a tu nombre.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {filteredStocks.map((stock) => {
                  const selected = selectedToolsForTask.find((t) => t.itemId === stock.item.id);
                  return (
                    <div
                      key={stock.id}
                      className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 cursor-pointer transition hover:border-emerald-400"
                      onClick={() => {
                        if (!selected) {
                          addToolToTask(stock.item.id, 1);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{stock.item.name}</p>
                          <p className="text-xs text-slate-500">{stock.warehouse.name} • Disponible: {formatNumber(stock.quantity)}</p>
                        </div>
                        {selected && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
                            {selected.quantity}
                          </span>
                        )}
                      </div>
                      {selected && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selected.quantity > 1) {
                                setSelectedToolsForTask((prev) =>
                                  prev.map((t) =>
                                    t.itemId === stock.item.id
                                      ? { ...t, quantity: t.quantity - 1 }
                                      : t
                                  )
                                );
                              } else {
                                removeToolFromTask(stock.item.id);
                              }
                            }}
                            className="rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={stock.quantity}
                            value={selected.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value || '1', 10);
                              if (val > 0 && val <= stock.quantity) {
                                setSelectedToolsForTask((prev) =>
                                  prev.map((t) =>
                                    t.itemId === stock.item.id ? { ...t, quantity: val } : t
                                  )
                                );
                              }
                            }}
                            className="w-12 rounded-lg border border-slate-200 px-2 py-1 text-center text-xs"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selected.quantity < stock.quantity) {
                                setSelectedToolsForTask((prev) =>
                                  prev.map((t) =>
                                    t.itemId === stock.item.id
                                      ? { ...t, quantity: t.quantity + 1 }
                                      : t
                                  )
                                );
                              }
                            }}
                            className="rounded-full bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeToolFromTask(stock.item.id);
                            }}
                            className="ml-auto rounded-full border border-red-300 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Quitar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTaskReportMode(null);
                    setSelectedToolsForTask([]);
                  }}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => submitToolsForTask()}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50"
                  disabled={selectedToolsForTask.length === 0}
                >
                  <CheckCircle2 className="h-4 w-4" /> Confirmar Herramientas ({selectedToolsForTask.length})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {actionOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur"
          >
            <motion.form
              onSubmit={submitAction}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {actionMode === 'OUT' ? 'Registrar retiro' : 'Registrar devolución'}
              </h3>
              <p className="text-xs text-slate-500">
                {actionMode === 'OUT'
                  ? 'Confirma qué herramienta estás tomando y cuántas unidades.'
                  : 'Indica cuántas unidades estás devolviendo al inventario.'}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Herramienta</p>
                  <p className="text-sm font-semibold text-slate-800">{actionItem?.name || 'Selecciona un item'}</p>
                </div>
                <select
                  value={actionWarehouseId}
                  onChange={(event) => setActionWarehouseId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="">Selecciona almacén</option>
                  {warehousesForItem.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={quantity}
                  min={1}
                  onChange={(event) => setQuantity(parseInt(event.target.value || '1', 10))}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Notas (proyecto, turno, incidencia...)"
                  className="h-24 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <p className="text-xs text-slate-400">
                  Disponibles: {formatNumber(available)} • Se registrará a tu nombre ({user?.name || user?.email}).
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActionOpen(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-800"
                >
                  <CheckCircle2 className="h-4 w-4" /> Confirmar
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

