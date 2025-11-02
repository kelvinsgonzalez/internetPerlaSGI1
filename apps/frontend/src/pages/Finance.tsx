import type { ElementType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Banknote, BarChart, Calendar, Filter, PiggyBank, RefreshCw, Search, Users } from 'lucide-react';

import { ErrorState } from '../components/ip/ErrorState';
import { LoadingState } from '../components/ip/LoadingState';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';

type CashSummary = { id: string; date: string; incomes: number | string; expenses: number | string; balance: number | string; createdAt: string; closedBy?: string };
type CashEntry = { id: string; entryDate: string; type: 'INCOME' | 'EXPENSE'; description: string; amount: number | string; createdAt: string; createdBy?: string; createdById?: string; createdByName?: string };
type User = { id: string; email: string; name?: string; role: 'ADMIN' | 'USER' };

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

const StatCard = ({ icon: Icon, title, value, hint, accent }: { icon: ElementType; title: string; value: string; hint: string; accent: string }) => (
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

export default function Finance() {
  const { user: authUser } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const [summaries, setSummaries] = useState<CashSummary[]>([]);
  const [filterMode, setFilterMode] = useState<'DAY' | 'WEEK'>('WEEK');
  const [baseDate, setBaseDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [detailEntries, setDetailEntries] = useState<CashEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();

  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState<string | undefined>();
  const [dayIncomes, setDayIncomes] = useState<CashEntry[]>([]);
  const [dayExpenses, setDayExpenses] = useState<CashEntry[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(undefined);
      const s = await fetchSummaries(filterMode, baseDate, selectedUserId);
      setSummaries(normalizeSummaries(s));
      if (authUser?.role === 'ADMIN') {
        const { data } = await api.get('/users');
        setUsers(Array.isArray(data?.value || data) ? (data?.value || data) : []);
      }
    } catch (e: any) {
      setError('Error al cargar finanzas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchSummaries(filterMode, baseDate, selectedUserId);
        setSummaries(normalizeSummaries(s));
      } catch {}
    })();
  }, [filterMode, baseDate, selectedUserId]);

  useEffect(() => {
    if (baseDate) loadMovements(baseDate);
  }, [baseDate, selectedUserId]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => { (async () => { try { const s = await fetchSummaries(filterMode, baseDate, selectedUserId); setSummaries(normalizeSummaries(s)); } catch {} })(); };
    const refreshDetail = (payload?: any) => { if (detailDate && payload?.date === detailDate) loadDetail(detailDate); };
    const refreshMovements = (payload?: any) => {
      if (!payload?.date) return loadMovements(baseDate);
      if (filterMode === 'DAY') { if (payload.date === baseDate) loadMovements(baseDate); }
      else { const { from, to } = weekRange(baseDate); if (payload.date >= from && payload.date <= to) loadMovements(baseDate); }
    };
    socket.on('cash:entry-added', refresh); socket.on('cash:day-closed', refresh); socket.on('cash:day-reopened', refresh);
    socket.on('cash:entry-added', refreshDetail); socket.on('cash:day-closed', refreshDetail); socket.on('cash:day-reopened', refreshDetail);
    socket.on('cash:entry-added', refreshMovements); socket.on('cash:day-closed', refreshMovements); socket.on('cash:day-reopened', refreshMovements);
    return () => {
      socket.off('cash:entry-added', refresh); socket.off('cash:day-closed', refresh); socket.off('cash:day-reopened', refresh);
      socket.off('cash:entry-added', refreshDetail); socket.off('cash:day-closed', refreshDetail); socket.off('cash:day-reopened', refreshDetail);
      socket.off('cash:entry-added', refreshMovements); socket.off('cash:day-closed', refreshMovements); socket.off('cash:day-reopened', refreshMovements);
    };
  }, [socket, filterMode, baseDate, detailDate, selectedUserId]);

  async function loadDetail(date: string) {
    try {
      setDetailLoading(true);
      setDetailError(undefined);
      const params: any = { date };
      if (authUser?.role === 'ADMIN' && selectedUserId) params.userId = selectedUserId;
      const { data } = await api.get('/finance/cash-cut', { params });
      const entries = (data.entries || []).map((e: any) => ({ ...e, amount: typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount }));
      setDetailEntries(entries);
      setDetailDate(date);
    } catch (e: any) {
      setDetailError(e?.response?.data?.message || 'Error al cargar el detalle del día');
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadMovements(date: string) {
    try {
      setMovementsLoading(true);
      setMovementsError(undefined);
      const params: any = {};
      if (authUser?.role === 'ADMIN' && selectedUserId) params.userId = selectedUserId;
      if (filterMode === 'DAY') {
        params.date = date;
        const { data } = await api.get('/finance/cash-cut', { params });
        const entries: CashEntry[] = (data.entries || []).map((e: any) => ({ ...e, amount: typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount }));
        setDayIncomes(entries.filter((e) => e.type === 'INCOME'));
        setDayExpenses(entries.filter((e) => e.type === 'EXPENSE'));
      } else {
        const { from, to } = weekRange(date);
        const days = isoDatesBetween(from, to);
        const results = await Promise.all(days.map((d) => api.get('/finance/cash-cut', { params: { date: d, ...(params.userId ? { userId: params.userId } : {}) } })));
        const allEntriesRaw = results.flatMap((r) => r.data?.entries || []);
        const entries: CashEntry[] = allEntriesRaw.map((e: any) => ({ ...e, amount: typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount }));
        setDayIncomes(entries.filter((e) => e.type === 'INCOME'));
        setDayExpenses(entries.filter((e) => e.type === 'EXPENSE'));
      }
    } catch (e: any) {
      setMovementsError(e?.response?.data?.message || 'Error al cargar movimientos');
      setDayIncomes([]);
      setDayExpenses([]);
    } finally {
      setMovementsLoading(false);
    }
  }

  const totals = useMemo(() => {
    const inc = summaries.reduce((a, r) => a + (Number(r.incomes) || 0), 0);
    const exp = summaries.reduce((a, r) => a + (Number(r.expenses) || 0), 0);
    return { inc, exp, bal: inc - exp };
  }, [summaries]);

  const closeDay = async (date: string) => {
    const ok = window.confirm(`Vas a cerrar el día ${new Date(date + 'T00:00:00').toLocaleDateString()}. ¿Confirmas?`);
    if (!ok) return;
    await api.post('/finance/cash-summaries/close-day', { date });
    const s = await fetchSummaries(filterMode, baseDate, selectedUserId);
    setSummaries(normalizeSummaries(s));
  };

  const fmt = (n: number) => `Q ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header>
          <motion.h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            Centro Financiero
          </motion.h1>
          <motion.p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            Supervisa ingresos, egresos y balances con reportes inteligentes y filtros avanzados.
          </motion.p>
        </header>

        {loading && <LoadingState message="Cargando finanzas..." />}
        {error && <ErrorState message={error} onRetry={loadData} />}

        <div className="grid gap-4 lg:grid-cols-3">
          <StatCard icon={ArrowUp} title="Ingresos Totales" value={fmt(totals.inc)} hint="Suma de todas las entradas" accent="bg-emerald-100 text-emerald-700" />
          <StatCard icon={ArrowDown} title="Egresos Totales" value={fmt(totals.exp)} hint="Suma de todas las salidas" accent="bg-amber-100 text-amber-700" />
          <StatCard icon={Banknote} title="Balance General" value={fmt(totals.bal)} hint="Diferencia neta" accent="bg-sky-100 text-sky-700" />
        </div>

        <motion.section className={`${glassCard} flex flex-1 flex-col rounded-3xl p-6`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Cortes de Caja</h2>
              <p className="text-sm text-slate-500">Filtra por día o semana para analizar la salud financiera.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select className="rounded-full border border-emerald-200/70 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none" value={filterMode} onChange={(e) => setFilterMode(e.target.value as any)}>
                <option value="DAY">Día</option>
                <option value="WEEK">Semana</option>
              </select>
              <input type="date" className="rounded-full border border-emerald-200/70 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
              {authUser?.role === 'ADMIN' && (
                <select className="rounded-full border border-emerald-200/70 bg-white px-4 py-2 text-xs font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} title="Filtrar por usuario">
                  <option value="">Todos los usuarios</option>
                  {users.filter((u) => u.role === 'USER').map((u) => (<option key={u.id} value={u.id}>{u.name || u.email}</option>))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/40">
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
              <table className="min-w-full text-sm">
                <thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Ingresos</th>
                    <th className="px-4 py-3">Egresos</th>
                    <th className="px-4 py-3">Balance</th>
                    <th className="px-4 py-3">Cerrado por</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50/60 bg-white/70">
                  {summaries.map((s) => (
                    <tr key={s.id || s.date} className="transition hover:bg-emerald-50/70">
                      <td className="px-4 py-3"><button className="font-semibold text-emerald-600 hover:underline" onClick={() => loadDetail(s.date)}>{new Date(s.date + 'T00:00:00').toLocaleDateString()}</button></td>
                      <td className="px-4 py-3 text-slate-500">{fmt(Number(s.incomes) || 0)}</td>
                      <td className="px-4 py-3 text-slate-500">{fmt(Number(s.expenses) || 0)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{fmt(Number(s.balance) || 0)}</td>
                      <td className="px-4 py-3 text-slate-500">{s.closedBy ? (s.closedBy === 'system@auto-close' ? 'Auto (20:00)' : s.closedBy) : '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300" onClick={() => !s.closedBy && closeDay(s.date)} disabled={!!s.closedBy} title={s.closedBy ? 'Ya cerrado' : 'Cerrar día'}>Cerrar día</button>
                      </td>
                    </tr>
                  ))}
                  {summaries.length === 0 && (<tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">Sin resúmenes para el rango.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className={`${glassCard} rounded-3xl p-6`}>
            <h3 className="text-base font-semibold text-slate-900">Movimientos del Periodo</h3>
            <p className="text-xs text-slate-500">Desglose de ingresos y egresos para el {filterMode === 'DAY' ? 'día' : 'la semana'} actual.</p>
            {movementsLoading ? <div className="text-sm text-gray-600 pt-4">Cargando...</div> : movementsError ? <div className="text-sm text-red-600 pt-4">{movementsError}</div> : (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-emerald-700 mb-2">Ingresos</h4>
                  <ul className="space-y-2 text-sm">
                    {dayIncomes.map(e => <li key={e.id} className="flex justify-between"><span>{e.description}</span><span className="font-medium">{fmt(Number(e.amount) || 0)}</span></li>)}
                    {dayIncomes.length === 0 && <li className="text-slate-400">Sin ingresos.</li>}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-amber-700 mb-2">Egresos</h4>
                  <ul className="space-y-2 text-sm">
                    {dayExpenses.map(e => <li key={e.id} className="flex justify-between"><span>{e.description}</span><span className="font-medium">{fmt(Number(e.amount) || 0)}</span></li>)}
                    {dayExpenses.length === 0 && <li className="text-slate-400">Sin egresos.</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>

        <AnimatePresence>
          {detailDate && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-2xl rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Detalle del {new Date(detailDate + 'T00:00:00').toLocaleDateString()}</h3>
                  <button onClick={() => setDetailDate(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cerrar</button>
                </div>
                {detailLoading ? <div className="text-sm text-gray-600 pt-4">Cargando detalle...</div> : detailError ? <div className="text-sm text-red-600 pt-4">{detailError}</div> : (
                  <div className="mt-4 max-h-96 overflow-y-auto custom-scrollbar">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-2">Tipo</th><th className="px-4 py-2">Descripción</th><th className="px-4 py-2">Registrado por</th><th className="px-4 py-2 text-right">Monto</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailEntries.map((e) => (<tr key={e.id}><td className="px-4 py-2">{e.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</td><td className="px-4 py-2">{e.description}</td><td className="px-4 py-2">{e.createdByName || e.createdBy || ''}</td><td className="px-4 py-2 text-right">{fmt(Number(e.amount) || 0)}</td></tr>))}
                        {detailEntries.length === 0 && (<tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Sin movimientos.</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Helper functions (unchanged)
function weekRange(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toIsoDate(monday), to: toIsoDate(sunday) };
}

function toIsoDate(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function isoDatesBetween(from: string, to: string) {
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(toIsoDate(d));
  }
  return out;
}

async function fetchSummaries(mode: 'DAY' | 'WEEK', dateStr: string, userId?: string) {
  const baseParams: any = {};
  if (userId) baseParams.userId = userId;
  if (mode === 'DAY') {
    const { data } = await api.get("/finance/cash-summaries", { params: { from: dateStr, to: dateStr, ...baseParams } });
    return data as CashSummary[];
  } else {
    const { from, to } = weekRange(dateStr);
    const { data } = await api.get("/finance/cash-summaries", { params: { from, to, ...baseParams } });
    return data as CashSummary[];
  }
}

function normalizeSummaries(list: any) {
  return (list || []).map((r: CashSummary) => ({ ...r, incomes: typeof r.incomes === 'string' ? parseFloat(r.incomes as any) : r.incomes, expenses: typeof r.expenses === 'string' ? parseFloat(r.expenses as any) : r.expenses, balance: typeof r.balance === 'string' ? parseFloat(r.balance as any) : r.balance }));
}
