import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Shield, User, Search, Lock, Unlock, KeyRound, UserCheck, UserX, Info, Eye, EyeOff, Loader2 } from 'lucide-react';

import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface WorkerSummary {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'USER';
  isBlocked?: boolean;
}

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

// Misma regla que valida el backend en common/security.ts: si cambia allí,
// cambia aquí (el servidor sigue siendo la autoridad; esto sólo evita el viaje).
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_RULE_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y símbolo';

const ROLE_LABEL: Record<WorkerSummary['role'], string> = {
  ADMIN: 'Administrador',
  USER: 'Colaborador',
};

/**
 * Contraseña temporal que cumple la política del servidor. Usa
 * `crypto.getRandomValues` en lugar de `Math.random`, que es predecible y no
 * sirve para generar credenciales.
 */
function generateTempPassword(): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = lower + upper + digits + symbols;

  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i] % set.length];

  // Un carácter garantizado de cada clase y el resto aleatorio.
  const chars = [pick(lower, 0), pick(upper, 1), pick(digits, 2), pick(symbols, 3)];
  for (let i = 4; i < bytes.length; i += 1) chars.push(pick(all, i));

  // Barajado Fisher-Yates para que las clases no queden siempre al principio.
  const shuffle = new Uint32Array(chars.length);
  crypto.getRandomValues(shuffle);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = shuffle[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default function AdminSettings() {
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { user: currentUser } = useAuth();

  // Cambio de contraseña de la propia cuenta (el admin principal incluido).
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      const list: WorkerSummary[] = (data.value || data) as WorkerSummary[];
      setWorkers(list.filter((u) => u.id !== currentUser?.sub));
    } catch (err) {
      toast.error('No se pudo cargar la lista de colaboradores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, [currentUser?.sub]);

  const filteredWorkers = useMemo(() => {
    if (!search) return workers;
    const term = search.toLowerCase();
    return workers.filter((w) =>
      [w.name, w.email].some((field) => field?.toLowerCase().includes(term))
    );
  }, [workers, search]);

  const toggleBlock = async (worker: WorkerSummary) => {
    try {
      const { data } = await api.patch(`/users/${worker.id}`, { isBlocked: !worker.isBlocked });
      const patched = (data?.value || data) as WorkerSummary | undefined;
      toast.success(!worker.isBlocked ? 'Acceso bloqueado' : 'Acceso restaurado');
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === worker.id
            ? { ...w, isBlocked: patched?.isBlocked ?? !worker.isBlocked }
            : w
        )
      );
    } catch (err) {
      toast.error('No se pudo actualizar el estado de bloqueo');
    }
  };

  const updateRole = async (worker: WorkerSummary, role: WorkerSummary['role']) => {
    if (role === worker.role) return;
    try {
      const { data } = await api.patch(`/users/${worker.id}`, { role });
      const updated = (data?.value || data) as WorkerSummary | undefined;
      toast.success('Rol actualizado');
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === worker.id ? { ...w, role: updated?.role ?? role } : w
        )
      );
    } catch (err) {
      toast.error('No se pudo actualizar el rol');
    }
  };

  const changeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const { current, next, confirm } = passwordForm;
    if (!current || !next) {
      toast.error('Escribe tu contraseña actual y la nueva');
      return;
    }
    if (!PASSWORD_REGEX.test(next)) {
      toast.error(PASSWORD_RULE_MESSAGE);
      return;
    }
    if (next === current) {
      toast.error('La nueva contraseña debe ser distinta de la actual');
      return;
    }
    if (next !== confirm) {
      toast.error('La confirmación no coincide con la nueva contraseña');
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch('/users/me/password', { currentPassword: current, newPassword: next });
      setPasswordForm({ current: '', next: '', confirm: '' });
      toast.success('Contraseña actualizada. Úsala en tu próximo inicio de sesión.');
    } catch (err: any) {
      const message = err?.response?.data?.message;
      toast.error(Array.isArray(message) ? message[0] : message || 'No se pudo cambiar la contraseña');
    } finally {
      setSavingPassword(false);
    }
  };

  const resetPassword = async (worker: WorkerSummary) => {
    const tempPassword = generateTempPassword();
    try {
      await api.patch(`/users/${worker.id}`, { password: tempPassword });
      toast.success(`Contraseña temporal: ${tempPassword}`, { duration: 10000 });
    } catch (err) {
      toast.error('No se pudo restablecer la contraseña');
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <motion.h1
                    className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    Ajustes de Administración
                </motion.h1>
                <motion.p
                    className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7 }}
                >
                    Controla accesos, asigna roles y gestiona acciones críticas desde un único lugar.
                </motion.p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input
                className="w-full md:w-72 rounded-full border border-emerald-200/70 bg-white px-10 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                placeholder="Buscar colaborador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.section 
            className={`${glassCard} lg:col-span-2 rounded-3xl p-6`} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900">Control de Accesos</h2>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              {loading && <div className="text-center text-slate-500 py-8">Cargando...</div>}
              {!loading && filteredWorkers.length === 0 && (
                <div className="text-center text-slate-500 py-8">No hay colaboradores que coincidan.</div>
              )}
              {filteredWorkers.map((worker, i) => (
                <motion.article
                  key={worker.id}
                  className={`p-4 border rounded-2xl transition-all duration-300 ${worker.isBlocked ? 'bg-red-50/70 border-red-200/80' : 'bg-white/70 border-white/50'}`}
                  initial={{opacity:0,y:6}}
                  animate={{opacity:1,y:0}}
                  transition={{delay:i*0.03}}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-800">{worker.name || 'Sin nombre'}</p>
                      <p className="text-sm text-slate-500">{worker.email}</p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${worker.isBlocked ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {worker.isBlocked ? 'Acceso bloqueado' : ROLE_LABEL[worker.role]}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button onClick={() => toggleBlock(worker)} className={`p-2 rounded-full transition ${worker.isBlocked ? 'text-emerald-600 bg-emerald-100/60 hover:bg-emerald-100' : 'text-red-600 bg-red-100/60 hover:bg-red-100'}`}>
                        {worker.isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </button>
                      <button onClick={() => resetPassword(worker)} className="p-2 rounded-full text-slate-600 bg-slate-100/60 hover:bg-slate-200 transition">
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <select
                        className="w-36 appearance-none rounded-full border border-emerald-200/70 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none"
                        value={worker.role}
                        onChange={(e) => updateRole(worker, e.target.value as WorkerSummary['role'])}
                      >
                        <option value="USER">Colaborador</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.section>

          <div className="flex flex-col gap-8">
          <motion.section
            className={`${glassCard} rounded-3xl p-6`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <User className="h-6 w-6 text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900">Mi cuenta</h2>
            </div>
            <p className="text-sm text-slate-500">
              {currentUser?.email}
              {currentUser?.role === 'ADMIN' ? ' · Administrador principal' : ''}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Cambia aquí tu propia contraseña. Nadie más puede hacerlo por ti.
            </p>

            <form className="mt-4 space-y-3" onSubmit={changeOwnPassword}>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="current-password">
                  Contraseña actual
                </label>
                <input
                  id="current-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-emerald-200/70 bg-white px-4 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="new-password">
                  Nueva contraseña
                </label>
                <p className="mb-1 text-[11px] leading-snug text-slate-400">{PASSWORD_RULE_MESSAGE}.</p>
                <input
                  id="new-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-emerald-200/70 bg-white px-4 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="confirm-password">
                  Confirmar nueva contraseña
                </label>
                <input
                  id="confirm-password"
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-emerald-200/70 bg-white px-4 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswords((v) => !v)}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showPasswords ? 'Ocultar' : 'Mostrar'}
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {savingPassword ? 'Guardando...' : 'Actualizar contraseña'}
                </button>
              </div>
            </form>
          </motion.section>

          <motion.section 
            className={`${glassCard} rounded-3xl p-6`} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Info className="h-6 w-6 text-sky-600" />
              <h2 className="text-xl font-bold text-slate-900">Buenas Prácticas</h2>
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex items-start gap-3"><UserX className="h-4 w-4 mt-0.5 text-sky-500 shrink-0" /><span>Bloquea las cuentas inactivas para evitar accesos no autorizados.</span></li>
              <li className="flex items-start gap-3"><KeyRound className="h-4 w-4 mt-0.5 text-sky-500 shrink-0" /><span>Genera contraseñas temporales y comunícalas por un medio seguro.</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 mt-0.5 text-sky-500 shrink-0" /><span>Promueve a administrador solo a personal de confianza y revoca el rol cuando sea necesario.</span></li>
            </ul>
          </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
