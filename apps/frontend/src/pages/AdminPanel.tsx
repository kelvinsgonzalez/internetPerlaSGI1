import type { ElementType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, CalendarRange, ClipboardList, Layers, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import api from '../services/api';

type Stock = { id: string; quantity: number; item: { id: string } };
type Item = { id: string; name: string; minStock: number; updatedAt?: string; createdAt?: string };
type Task = { id: string; status?: string };
type DailyCash = { date: string; incomes: number; expenses: number; balance: number };

const PENDING_STATUSES = ['PENDIENTE', 'EN_PROCESO'];

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const formatQ = (n: number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 2 }).format(n);

// Lunes de la semana en curso
const startOfWeek = (ref: Date) => {
  const day = ref.getDay();
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + (day === 0 ? -6 : 1 - day));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const StatCard = ({
  icon: Icon,
  title,
  value,
  hint,
  delta,
  loading,
  to,
  children,
}: {
  icon: ElementType;
  title: string;
  value: string;
  hint: string;
  delta: string;
  loading: boolean;
  to?: string;
  children?: React.ReactNode;
}) => {
  const card = (
    <motion.div
      whileHover={{ translateY: -6, rotateX: 2 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className={`${glassCard} relative h-full overflow-hidden rounded-3xl p-5 text-slate-900 ${to ? 'cursor-pointer' : ''}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10" />
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-700/80">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{loading ? '···' : value}</p>
          <p className="mt-2 text-xs text-slate-500">{hint}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-700">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {children}
      <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-600">
        <TrendingUp className="h-3.5 w-3.5" />
        {delta}
      </div>
    </motion.div>
  );
  return to ? <Link to={to} className="block h-full">{card}</Link> : card;
};

// Barras diarias de ingresos de la semana (solo forma, sin cifras)
const WeekBars = ({ data }: { data: number[] }) => {
  const max = Math.max(...data, 1);
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  return (
    <div className="mt-4 flex h-16 items-end gap-1.5">
      {data.map((value, index) => (
        <div key={index} className="flex flex-1 flex-col items-center gap-1">
          <motion.div
            className="w-full rounded-full bg-gradient-to-t from-emerald-500/30 via-emerald-500/60 to-emerald-400"
            initial={{ height: 0 }}
            animate={{ height: `${Math.max(8, Math.round((value / max) * 100))}%` }}
            transition={{ duration: 0.5, delay: index * 0.04 }}
          />
          <span className="text-[9px] font-semibold text-slate-400">{labels[index]}</span>
        </div>
      ))}
    </div>
  );
};

// Comparativa mes actual vs mes anterior: únicamente gráfica, sin valores.
const MonthComparisonChart = ({
  current,
  previous,
  labels,
}: {
  current: number[];
  previous: number[];
  labels: string[];
}) => {
  const max = Math.max(...current, ...previous, 1);
  return (
    <div>
      <div className="flex items-center gap-5 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Mes actual
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Mes anterior
        </span>
      </div>
      <div className="mt-6 flex h-56 items-end gap-4">
        {labels.map((label, index) => (
          <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1.5">
              <motion.div
                className="w-1/2 max-w-[26px] rounded-t-xl bg-gradient-to-t from-emerald-500/40 via-emerald-500/70 to-emerald-400"
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(3, Math.round(((current[index] || 0) / max) * 100))}%` }}
                transition={{ duration: 0.7, delay: 0.05 * index, ease: 'easeOut' }}
              />
              <motion.div
                className="w-1/2 max-w-[26px] rounded-t-xl bg-gradient-to-t from-slate-200 via-slate-300 to-slate-300"
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(3, Math.round(((previous[index] || 0) / max) * 100))}%` }}
                transition={{ duration: 0.7, delay: 0.05 * index + 0.05, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Proporción visual del mes actual frente al anterior (sin números)
const ComparisonGauge = ({ current, previous }: { current: number; previous: number }) => {
  const total = current + previous;
  const share = total > 0 ? (current / total) * 100 : 50;
  return (
    <div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200/70">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
          initial={{ width: 0 }}
          animate={{ width: `${share}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <span>Mes actual</span>
        <span>Mes anterior</span>
      </div>
    </div>
  );
};

const ProgressRing = ({ percent }: { percent: number }) => {
  const clamped = Math.min(100, Math.max(0, percent));
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (clamped / 100) * circumference;
  return (
    <svg className="h-24 w-24" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="36" stroke="#d1fae5" strokeWidth="8" fill="none" />
      <motion.circle
        cx="50"
        cy="50"
        r="36"
        stroke="url(#ring)"
        strokeWidth="8"
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      <text x="50" y="54" textAnchor="middle" className="fill-emerald-600 text-xl font-semibold">
        {clamped.toFixed(0)}%
      </text>
    </svg>
  );
};

export default function AdminPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [daily, setDaily] = useState<DailyCash[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const now = new Date();
    // Desde el inicio del mes anterior para poder comparar los dos meses.
    const from = toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    try {
      const [t, d, s, i] = await Promise.all([
        api.get('/tasks'),
        api.get('/finance/cash-daily', { params: { from, to } }),
        api.get('/inventory/stocks'),
        api.get('/inventory/items'),
      ]);
      setTasks(t.data || []);
      setDaily(d.data || []);
      setStocks(s.data || []);
      setItems(i.data || []);
    } catch (error) {
      console.warn('No se pudo cargar el dashboard administrativo', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => PENDING_STATUSES.includes(String(task.status || '').toUpperCase())).length,
    [tasks],
  );

  // Ingresos de la semana en curso (lunes a domingo)
  const week = useMemo(() => {
    const monday = startOfWeek(new Date());
    const days = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + idx);
      return toISO(date);
    });
    const byDate = new Map(daily.map((row) => [String(row.date).slice(0, 10), row]));
    const series = days.map((iso) => Number(byDate.get(iso)?.incomes || 0));
    return { series, total: series.reduce((acc, cur) => acc + cur, 0) };
  }, [daily]);

  // Comparativa de ingresos por semana del mes: actual vs anterior
  const comparison = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previous = new Date(currentYear, currentMonth - 1, 1);

    const buckets = (month: number, year: number) => {
      const totals = [0, 0, 0, 0, 0];
      for (const row of daily) {
        const iso = String(row.date).slice(0, 10);
        const [y, m, d] = iso.split('-').map(Number);
        if (y !== year || m - 1 !== month) continue;
        const index = Math.min(4, Math.floor((d - 1) / 7));
        totals[index] += Number(row.incomes || 0);
      }
      return totals;
    };

    const current = buckets(currentMonth, currentYear);
    const prev = buckets(previous.getMonth(), previous.getFullYear());
    return {
      current,
      previous: prev,
      labels: ['S1', 'S2', 'S3', 'S4', 'S5'],
      currentTotal: current.reduce((acc, cur) => acc + cur, 0),
      previousTotal: prev.reduce((acc, cur) => acc + cur, 0),
      previousLabel: previous.toLocaleDateString('es-ES', { month: 'long' }),
      currentLabel: now.toLocaleDateString('es-ES', { month: 'long' }),
    };
  }, [daily]);

  const totals = useMemo(() => {
    const accumulator: Record<string, number> = {};
    for (const stock of stocks) {
      const key = stock.item?.id;
      if (!key) continue;
      accumulator[key] = (accumulator[key] || 0) + (stock.quantity || 0);
    }
    return accumulator;
  }, [stocks]);

  const lowStock = useMemo(() => items.filter((item) => (totals[item.id] || 0) <= item.minStock), [items, totals]);

  const inventoryCoverage = useMemo(() => {
    if (items.length === 0) return 100;
    const safe = items.length - lowStock.length;
    return Math.max(0, Math.round((safe / items.length) * 100));
  }, [items.length, lowStock.length]);

  const quickActions = [
    { label: 'Crear tarea', description: 'Coordina responsabilidades críticas.', to: '/tasks-admin' },
    { label: 'Agregar inventario', description: 'Actualiza existencias en segundos.', to: '/inventory' },
    { label: 'Nueva comunicación', description: 'Inicia una conversación con el equipo.', to: '/messages' },
  ];

  return (
    <div className="relative min-h-full overflow-hidden px-3 py-4 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[120%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.05),rgba(16,185,129,0.12))] blur-3xl opacity-40" />

      <div className="relative z-10 space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <motion.p
              className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-white/50 px-4 py-1 text-xs font-semibold text-emerald-700 shadow-sm"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Sparkles className="h-3.5 w-3.5" /> Control total en una sola vista
            </motion.p>
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Panel Administrativo
            </motion.h1>
            <motion.p
              className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              Tareas pendientes, ingresos de la semana y la evolución del mes frente al anterior, en una sola vista.
            </motion.p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <StatCard
            icon={ClipboardList}
            title="Tareas pendientes"
            value={`${pendingTasks}`}
            hint="Incluye pendientes y en proceso"
            delta={pendingTasks === 0 ? 'Sin trabajo pendiente' : 'Dales seguimiento con tu equipo'}
            loading={loading}
            to="/tasks-admin"
          />
          <StatCard
            icon={Wallet}
            title="Ingresos de la semana"
            value={formatQ(week.total)}
            hint="Total de la semana en curso (lunes a domingo)"
            delta="Actualizado con los movimientos de caja"
            loading={loading}
            to="/finance"
          >
            <WeekBars data={week.series} />
          </StatCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <motion.div
            className={`${glassCard} rounded-3xl p-6 xl:col-span-3`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Ingresos: {comparison.currentLabel} vs {comparison.previousLabel}</h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100/70 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                <BarChart3 className="h-3.5 w-3.5" /> Comparativa mensual
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Compara la forma de los ingresos semana a semana frente al mes anterior.</p>
            <div className="mt-4">
              <MonthComparisonChart current={comparison.current} previous={comparison.previous} labels={comparison.labels} />
            </div>
          </motion.div>

          <motion.div
            className={`${glassCard} flex flex-col justify-between rounded-3xl p-6 xl:col-span-2`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Peso del mes</h2>
                <CalendarRange className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-1 text-xs text-slate-500">Proporción visual de los ingresos acumulados del mes actual frente al mes anterior.</p>
            </div>
            <div className="mt-8">
              <ComparisonGauge current={comparison.currentTotal} previous={comparison.previousTotal} />
            </div>
            <div className="mt-8">
              <div className="flex h-24 items-end gap-3">
                <motion.div
                  className="flex-1 rounded-t-2xl bg-gradient-to-t from-emerald-500/40 via-emerald-500/70 to-emerald-400"
                  initial={{ height: 0 }}
                  animate={{
                    height: `${Math.max(
                      6,
                      Math.round(
                        (comparison.currentTotal / Math.max(comparison.currentTotal, comparison.previousTotal, 1)) * 100,
                      ),
                    )}%`,
                  }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                />
                <motion.div
                  className="flex-1 rounded-t-2xl bg-gradient-to-t from-slate-200 via-slate-300 to-slate-300"
                  initial={{ height: 0 }}
                  animate={{
                    height: `${Math.max(
                      6,
                      Math.round(
                        (comparison.previousTotal / Math.max(comparison.currentTotal, comparison.previousTotal, 1)) * 100,
                      ),
                    )}%`,
                  }}
                  transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span className="flex-1 text-center">Actual</span>
                <span className="flex-1 text-center">Anterior</span>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <Link to="/inventory" className="block xl:col-span-3">
            <motion.div
              className={`${glassCard} flex h-full flex-col justify-between rounded-3xl p-6 cursor-pointer`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Salud del inventario</h2>
                <ArrowUpRight className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-1 text-xs text-slate-500">Proporción de ítems sin alerta en relación al catálogo completo.</p>
              <div className="mt-6 flex items-center justify-between gap-6">
                <ProgressRing percent={inventoryCoverage} />
                <AnimatePresence>
                  <motion.div
                    className="flex-1 rounded-2xl border border-emerald-100/70 bg-white/70 px-4 py-3 text-xs text-slate-500 shadow-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    Cobertura estimada del catálogo activo.
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </Link>

          <motion.div
            className={`${glassCard} rounded-3xl p-6 xl:col-span-2`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            <h2 className="text-lg font-semibold text-slate-900">Acciones inmediatas</h2>
            <p className="mt-1 text-xs text-slate-500">Impulsa decisiones con atajos inteligentes.</p>
            <div className="mt-5 space-y-3">
              {quickActions.map((action) => (
                <motion.div key={action.label} whileHover={{ scale: 1.01 }}>
                  <Link
                    to={action.to}
                    className="group flex items-center justify-between rounded-2xl border border-slate-100/70 bg-white/70 px-4 py-3 shadow-sm transition hover:translate-x-1 hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{action.label}</p>
                      <p className="text-xs text-slate-500">{action.description}</p>
                    </div>
                    <Layers className="h-4 w-4 text-emerald-500 transition group-hover:translate-x-1" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
