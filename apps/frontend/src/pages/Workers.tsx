import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { UserPlus, Users, Edit, Trash2, X, Check, AtSign, KeyRound, User } from 'lucide-react';

import api from '../services/api';

type WorkerUser = { id: string; email: string; name?: string; role: 'ADMIN' | 'USER' };

const glassCard =
  'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

export default function Workers() {
  const [rows, setRows] = useState<WorkerUser[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{
    id: string;
    name: string;
    email: string;
    password: string;
    paymentRate?: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      const list: WorkerUser[] = (data.value || data) as WorkerUser[];
      setRows(list.filter((u) => u.role === 'USER'));
    } catch {
      toast.error('No se pudieron cargar los trabajadores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name || !form.email || !form.password)
      return toast.error('Completa todos los campos');

    try {
      await api.post('/users', { ...form, role: 'USER' });
      toast.success('Trabajador creado');
      setForm({ name: '', email: '', password: '' });
      load();
    } catch {
      toast.error('No se pudo crear el trabajador.');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar a este trabajador?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('Trabajador eliminado');
      load();
    } catch {
      toast.error('No se pudo eliminar el trabajador.');
    }
  };

  const startEdit = (u: WorkerUser & { paymentRate?: number }) => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(`paymentRate_${u.id}`) : null;
    const initialRate = u.paymentRate ?? (stored ? Number(stored) : undefined);
    setEditing({
      id: u.id,
      name: u.name || '',
      email: u.email,
      password: '',
      paymentRate: typeof initialRate === 'number' && !isNaN(initialRate) ? String(initialRate) : '',
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.email) return toast.error('El correo es requerido');

    try {
      const payload: Record<string, any> = {
        email: editing.email,
        name: editing.name,
      };
      if (editing.password) payload.password = editing.password;
      if (editing.paymentRate && !isNaN(Number(editing.paymentRate))) payload.paymentRate = Number(editing.paymentRate);
      await api.patch(`/users/${editing.id}`, payload);
      try {
        if (typeof window !== 'undefined') {
          if (payload.paymentRate !== undefined) {
            window.localStorage.setItem(`paymentRate_${editing.id}`, String(payload.paymentRate));
          } else if (editing.paymentRate) {
            window.localStorage.setItem(`paymentRate_${editing.id}`, String(editing.paymentRate));
          }
        }
      } catch {}
      toast.success('Trabajador actualizado');
      setEditing(null);
      load();
    } catch {
      toast.error('No se pudo actualizar el trabajador.');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header>
          <motion.h1
            className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Gestión de Colaboradores
          </motion.h1>
          <motion.p
            className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Añade, edita y gestiona los perfiles de los colaboradores de tu equipo.
          </motion.p>
        </header>

        <motion.section
          className={`${glassCard} rounded-3xl p-6`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Añadir Nuevo Colaborador</h2>
          <div className="grid md:grid-cols-4 gap-4 items-center">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input
                className="w-full rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                placeholder="Nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input
                className="w-full rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                placeholder="Correo"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input
                className="w-full rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                placeholder="Contraseña"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button
              onClick={create}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600"
            >
              <UserPlus className="h-4 w-4" />
              Crear
            </button>
          </div>
        </motion.section>

        <motion.section
          className={`${glassCard} flex-1 rounded-3xl p-6`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-6 w-6 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">Listado de Colaboradores</h2>
          </div>

          <div className="overflow-y-auto custom-scrollbar max-h-[60vh]">
            <ul className="space-y-3 pr-2">
              {rows.map((u: WorkerUser, i: number) => (
                <motion.li
                  key={u.id}
                  className="bg-white/70 p-4 rounded-2xl border border-white/50 shadow-sm flex items-center justify-between gap-4"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{u.name || '-'}</div>
                    <div className="text-sm text-slate-500 truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(u)}
                      className="p-2 rounded-full text-emerald-600 bg-emerald-100/60 hover:bg-emerald-100 transition"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(u.id)}
                      className="p-2 rounded-full text-red-600 bg-red-100/60 hover:bg-red-100 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.li>
              ))}
              {!loading && rows.length === 0 && (
                <li className="text-center text-slate-500 py-8">
                  No hay colaboradores registrados.
                </li>
              )}
            </ul>
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {editing && (
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
              className={`${glassCard} w-full max-w-md rounded-3xl p-6`}
            >
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Editar Colaborador</h3>
              <div className="space-y-4">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                  <input
                    className="w-full rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                    placeholder="Nombre"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 text-sm">Q</span>
                  <input
                    className="w-full rounded-full border border-emerald-200/70 bg-white pl-7 pr-3 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Pago diario (opcional)"
                    value={editing.paymentRate || ''}
                    onChange={(e) => setEditing({ ...editing, paymentRate: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                  <input
                    className="w-full rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                    placeholder="Correo"
                    value={editing.email}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  />
                </div>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                  <input
                    className="w-full rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                    type="password"
                    placeholder="Nueva contraseña (opcional)"
                    value={editing.password}
                    onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/80 border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
                <button
                  onClick={saveEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600"
                >
                  <Check className="h-4 w-4" />
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
