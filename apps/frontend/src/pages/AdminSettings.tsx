import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Shield, User, Search, Lock, Unlock, KeyRound, UserCheck, UserX, Info, Eye, EyeOff, Loader2, Pencil, AtSign, X, Check, Wand2 } from 'lucide-react';

import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABEL, type Role } from '../services/roles';

interface WorkerSummary {
  id: string;
  email: string;
  name?: string;
  role: Role;
  isBlocked?: boolean;
}

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

const inputCls =
  'w-full rounded-2xl border border-emerald-200/70 bg-white px-4 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const apiError = (err: any, fallback: string) => {
  const message = err?.response?.data?.message;
  return Array.isArray(message) ? message[0] : message || fallback;
};

type AccessForm = { worker: WorkerSummary; email: string; password: string };

// Misma regla que valida el backend en common/security.ts: si cambia allí,
// cambia aquí (el servidor sigue siendo la autoridad; esto sólo evita el viaje).
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_RULE_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y símbolo';

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

  // Cambio de correo de la propia cuenta.
  const [myEmail, setMyEmail] = useState(currentUser?.email ?? '');
  const [emailForm, setEmailForm] = useState({ email: '', current: '' });
  const [savingEmail, setSavingEmail] = useState(false);

  // Edición de correo y contraseña de otra cuenta.
  const [access, setAccess] = useState<AccessForm | null>(null);
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  useEffect(() => {
    setMyEmail(currentUser?.email ?? '');
  }, [currentUser?.email]);

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
      toast.error(apiError(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setSavingPassword(false);
    }
  };

  const openAccess = (worker: WorkerSummary) => {
    setShowAccessPassword(false);
    setAccess({ worker, email: worker.email, password: '' });
  };

  const saveAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!access) return;
    const email = access.email.trim().toLowerCase();
    const payload: { email?: string; password?: string } = {};
    if (email !== access.worker.email) {
      if (!EMAIL_REGEX.test(email)) {
        toast.error('Escribe un correo válido');
        return;
      }
      payload.email = email;
    }
    if (access.password) {
      if (!PASSWORD_REGEX.test(access.password)) {
        toast.error(PASSWORD_RULE_MESSAGE);
        return;
      }
      payload.password = access.password;
    }
    if (!payload.email && !payload.password) {
      toast.info('No hay cambios que guardar');
      return;
    }
    setSavingAccess(true);
    try {
      const { data } = await api.patch(`/users/${access.worker.id}`, payload);
      const updated = (data?.value || data) as WorkerSummary | undefined;
      setWorkers((prev) =>
        prev.map((w) => (w.id === access.worker.id ? { ...w, email: updated?.email ?? email } : w))
      );
      if (payload.password) {
        // Se muestra una sola vez: el servidor sólo guarda el hash.
        toast.success(`Acceso actualizado. Nueva contraseña: ${payload.password}`, { duration: 15000 });
      } else {
        toast.success('Correo actualizado');
      }
      setAccess(null);
    } catch (err: any) {
      toast.error(apiError(err, 'No se pudo actualizar el acceso'));
    } finally {
      setSavingAccess(false);
    }
  };

  const changeOwnEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailForm.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      toast.error('Escribe un correo válido');
      return;
    }
    if (email === myEmail.toLowerCase()) {
      toast.error('El nuevo correo es igual al actual');
      return;
    }
    if (!emailForm.current) {
      toast.error('Escribe tu contraseña actual para confirmar');
      return;
    }
    setSavingEmail(true);
    try {
      const { data } = await api.patch('/users/me/email', { email, currentPassword: emailForm.current });
      setMyEmail(data?.email ?? email);
      setEmailForm({ email: '', current: '' });
      toast.success('Correo actualizado. Úsalo en tu próximo inicio de sesión.');
    } catch (err: any) {
      toast.error(apiError(err, 'No se pudo cambiar el correo'));
    } finally {
      setSavingEmail(false);
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
                      <button
                        onClick={() => toggleBlock(worker)}
                        title={worker.isBlocked ? 'Restaurar acceso' : 'Bloquear acceso'}
                        className={`p-2 rounded-full transition ${worker.isBlocked ? 'text-emerald-600 bg-emerald-100/60 hover:bg-emerald-100' : 'text-red-600 bg-red-100/60 hover:bg-red-100'}`}>
                        {worker.isBlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openAccess(worker)}
                        title="Cambiar correo y contraseña"
                        aria-label={`Cambiar correo y contraseña de ${worker.name || worker.email}`}
                        className="p-2 rounded-full text-slate-600 bg-slate-100/60 hover:bg-slate-200 transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <select
                        className="w-36 appearance-none rounded-full border border-emerald-200/70 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none"
                        value={worker.role}
                        onChange={(e) => updateRole(worker, e.target.value as WorkerSummary['role'])}
                      >
                        <option value="USER">{ROLE_LABEL.USER}</option>
                        <option value="SUPERVISOR">{ROLE_LABEL.SUPERVISOR}</option>
                        <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
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
              {myEmail}
              {currentUser?.role === 'ADMIN' ? ' · Administrador principal' : ''}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Cambia aquí tu propio correo y contraseña. Ambos piden tu contraseña actual.
            </p>

            <form className="mt-4 space-y-3" onSubmit={changeOwnEmail}>
              <h3 className="text-sm font-semibold text-slate-700">Correo de acceso</h3>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="new-email">
                  Nuevo correo
                </label>
                <input
                  id="new-email"
                  type="email"
                  autoComplete="email"
                  className={inputCls}
                  value={emailForm.email}
                  onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="email-current-password">
                  Contraseña actual
                </label>
                <input
                  id="email-current-password"
                  type="password"
                  autoComplete="current-password"
                  className={inputCls}
                  value={emailForm.current}
                  onChange={(e) => setEmailForm((f) => ({ ...f, current: e.target.value }))}
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingEmail}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <AtSign className="h-4 w-4" />}
                  {savingEmail ? 'Guardando...' : 'Actualizar correo'}
                </button>
              </div>
            </form>

            <div className="my-5 border-t border-emerald-100" />
            <h3 className="text-sm font-semibold text-slate-700">Contraseña</h3>

            <form className="mt-3 space-y-3" onSubmit={changeOwnPassword}>
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
              <li className="flex items-start gap-3"><KeyRound className="h-4 w-4 mt-0.5 text-sky-500 shrink-0" /><span>Si cambias el correo o la contraseña de alguien, comunícaselo por un medio seguro. Su sesión actual se cierra al cambiar la contraseña.</span></li>
              <li className="flex items-start gap-3"><UserCheck className="h-4 w-4 mt-0.5 text-sky-500 shrink-0" /><span>Promueve a administrador solo a personal de confianza y revoca el rol cuando sea necesario.</span></li>
            </ul>
          </motion.section>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {access && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur"
            onClick={() => !savingAccess && setAccess(null)}
          >
            <motion.form
              role="dialog"
              aria-modal="true"
              aria-labelledby="access-title"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`${glassCard} w-full max-w-md rounded-3xl p-6`}
              onClick={(e) => e.stopPropagation()}
              onSubmit={saveAccess}
            >
              <h3 id="access-title" className="text-lg font-semibold text-slate-900">
                Correo y contraseña
              </h3>
              <p className="mb-4 text-sm text-slate-500">{access.worker.name || access.worker.email}</p>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="access-email">
                    Correo
                  </label>
                  <input
                    id="access-email"
                    type="email"
                    autoComplete="off"
                    className={inputCls}
                    value={access.email}
                    onChange={(e) => setAccess({ ...access, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor="access-password">
                    Nueva contraseña <span className="font-normal text-slate-400">(déjala vacía para no cambiarla)</span>
                  </label>
                  <p className="mb-1 text-[11px] leading-snug text-slate-400">{PASSWORD_RULE_MESSAGE}.</p>
                  <div className="flex gap-2">
                    <input
                      id="access-password"
                      type={showAccessPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={inputCls}
                      value={access.password}
                      onChange={(e) => setAccess({ ...access, password: e.target.value })}
                    />
                    <button
                      type="button"
                      title={showAccessPassword ? 'Ocultar' : 'Mostrar'}
                      aria-label={showAccessPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      onClick={() => setShowAccessPassword((v) => !v)}
                      className="shrink-0 rounded-full bg-slate-100/80 p-2 text-slate-600 transition hover:bg-slate-200"
                    >
                      {showAccessPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAccess({ ...access, password: generateTempPassword() });
                      setShowAccessPassword(true);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Generar contraseña temporal
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAccess(null)}
                  disabled={savingAccess}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAccess}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingAccess ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
