import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import api from '../services/api';
import { LoadingState } from '../components/ip/LoadingState';
import { ErrorState } from '../components/ip/ErrorState';

type Item = { id: string; sku: string; name: string; category: string; minStock: number };
type Warehouse = { id: string; name: string; location?: string };

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

const emptyItem = { sku: '', name: '', category: '', minStock: 0 };
const emptyWh = { name: '', location: '' };

export default function InventoryConfig() {
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [whForm, setWhForm] = useState(emptyWh);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [itemsRes, whRes] = await Promise.all([
      api.get('/inventory/items'),
      api.get('/inventory/warehouses'),
    ]);
    setItems(itemsRes.data);
    setWarehouses(whRes.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        setError('No se pudo cargar la configuración del inventario.');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const submitItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.sku.trim() || !itemForm.name.trim()) {
      toast.error('SKU y nombre son obligatorios.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        sku: itemForm.sku.trim(),
        name: itemForm.name.trim(),
        category: itemForm.category.trim(),
        minStock: Math.max(0, Math.floor(itemForm.minStock || 0)),
      };
      if (editingId) {
        await api.patch(`/inventory/items/${editingId}`, payload);
        toast.success('Item actualizado');
      } else {
        await api.post('/inventory/items', payload);
        toast.success('Item creado');
      }
      setItemForm(emptyItem);
      setEditingId(null);
      await load();
    } catch (err: any) {
      const m = err?.response?.data?.message;
      toast.error(Array.isArray(m) ? m[0] : m || 'No se pudo guardar el item.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (it: Item) => {
    setEditingId(it.id);
    setItemForm({ sku: it.sku, name: it.name, category: it.category, minStock: it.minStock });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setItemForm(emptyItem);
  };

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar este item? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/inventory/items/${id}`);
      toast.success('Item eliminado');
      await load();
    } catch (err: any) {
      const m = err?.response?.data?.message;
      toast.error(Array.isArray(m) ? m[0] : m || 'No se pudo eliminar el item.');
    }
  };

  const submitWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whForm.name.trim()) {
      toast.error('Nombre del almacén obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/warehouses', {
        name: whForm.name.trim(),
        location: whForm.location.trim() || undefined,
      });
      toast.success('Almacén creado');
      setWhForm(emptyWh);
      await load();
    } catch (err: any) {
      const m = err?.response?.data?.message;
      toast.error(Array.isArray(m) ? m[0] : m || 'No se pudo crear el almacén.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <LoadingState message="Cargando configuración..." />
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.18),_transparent_55%)]" />

      <div className="relative z-10 space-y-8">
        <div>
          <Link
            to="/inventory"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inventario
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            Configuración de inventario
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestión de items, almacenes y umbrales mínimos. Solo administradores.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <form
            onSubmit={submitItem}
            className={`${glassCard} rounded-3xl p-6 xl:col-span-3`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Editar item' : 'Nuevo item'}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <X className="h-3 w-3" /> Cancelar
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">SKU</span>
                <input
                  value={itemForm.sku}
                  onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Nombre</span>
                <input
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Categoría</span>
                <input
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Stock mínimo</span>
                <input
                  type="number"
                  min={0}
                  value={itemForm.minStock}
                  onChange={(e) => setItemForm({ ...itemForm, minStock: Number(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> {editingId ? 'Guardar cambios' : 'Crear item'}
              </button>
            </div>
          </form>

          <form onSubmit={submitWarehouse} className={`${glassCard} rounded-3xl p-6 xl:col-span-2`}>
            <h2 className="text-lg font-semibold text-slate-900">Nuevo almacén</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Nombre</span>
                <input
                  value={whForm.name}
                  onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Ubicación (opcional)
                </span>
                <input
                  value={whForm.location}
                  onChange={(e) => setWhForm({ ...whForm, location: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-amber-700 disabled:opacity-60"
              >
                <Building2 className="h-4 w-4" /> Crear almacén
              </button>
            </div>

            {warehouses.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Almacenes existentes ({warehouses.length})
                </p>
                <ul className="mt-2 space-y-1">
                  {warehouses.map((w) => (
                    <li key={w.id} className="text-sm text-slate-700">
                      <span className="font-semibold">{w.name}</span>
                      {w.location ? <span className="text-slate-500"> · {w.location}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
        </div>

        <div className={`${glassCard} overflow-hidden rounded-3xl`}>
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Catálogo de items ({items.length})</h2>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Aún no hay items en el catálogo.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{it.name}</p>
                    <p className="text-xs text-slate-500">
                      SKU {it.sku} · {it.category || 'Sin categoría'} · Mínimo {it.minStock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(it)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => deleteItem(it.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
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
