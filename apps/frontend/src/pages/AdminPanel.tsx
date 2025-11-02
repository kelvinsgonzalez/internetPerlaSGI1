import type { ElementType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, Boxes, CalendarRange, Layers, RefreshCw, ShieldAlert, Sparkles, TrendingUp, Users2 } from 'lucide-react';
import api from '../services/api';
import Attendance from './Attendance';
import Inventory from './Inventory';
import Finance from './Finance';

type Att = { id: string; createdAt?: string };
type Cust = { id: string };
type Stock = { id: string; quantity: number; item: { id: string } };
type Item = { id: string; name: string; minStock: number; updatedAt?: string; createdAt?: string };



const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

const StatCard = ({
  icon: Icon,
  title,
  value,
  hint,
  delta,
  loading,
}: {
  icon: ElementType;
  title: string;
  value: string;
  hint: string;
  delta: string;
  loading: boolean;
}) => (
  <motion.div
    whileHover={{ translateY: -6, rotateX: 2 }}
    transition={{ type: 'spring', stiffness: 200, damping: 18 }}
    className={`${glassCard} relative overflow-hidden rounded-3xl p-5 text-slate-900`}
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
    <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-emerald-600">
      <TrendingUp className="h-3.5 w-3.5" />
      {delta}
    </div>
  </motion.div>
);

const Sparkline = ({ data }: { data: number[] }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex h-24 items-end gap-1">
      {data.map((value, index) => {
        const height = Math.max(6, Math.round((value / max) * 100));
        return (
          <motion.div
            key={index}
            className="flex-1 rounded-full bg-gradient-to-t from-emerald-500/30 via-emerald-500/60 to-emerald-400"
            style={{ height: `${height}%` }}
            transition={{ duration: 0.4, delay: index * 0.03 }}
          />
        );
      })}
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

  const [att, setAtt] = useState<Att[]>([]);
  const [cust, setCust] = useState<Cust[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    setLoading(true);
    try {
      const [a, c, s, i] = await Promise.all([
        api.get('/attendance'),
        api.get('/customers'),
        api.get('/inventory/stocks'),
        api.get('/inventory/items'),
      ]);
      setAtt(a.data);
      setCust(c.data);
      setStocks(s.data);
      setItems(i.data);
    } catch (error) {
      console.warn('No se pudo cargar el dashboard administrativo', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const attendanceTrend = useMemo(() => {
    if (!att.length) return new Array(7).fill(0);
    const today = new Date();
    const buckets = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - idx));
      return { label: date.toLocaleDateString('es-ES', { weekday: 'short' }), key: date.toISOString().slice(0, 10), count: 0 };
    });
    const entriesWithDate = att.filter((record) => (record as any).createdAt);
    if (entriesWithDate.length === 0) {
      const avg = Math.max(1, Math.round(att.length / 7));
      return buckets.map(() => avg);
    }
    for (const record of entriesWithDate) {
      const iso = new Date((record as any).createdAt!).toISOString().slice(0, 10);
      const bucket = buckets.find((b) => b.key === iso);
      if (bucket) bucket.count += 1;
    }
    return buckets.map((b) => b.count);
  }, [att]);

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
              Visualiza la salud operacional de inmediato: estado de asistencia, clientes activos, inventario y focos críticos en tiempo real.
            </motion.p>
          </div>

        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <StatCard
            icon={Activity}
            title="Asistencia"
            value={`${att.length}`}
            hint="Registros totales sincronizados"
            delta="Seguimiento impecable esta semana"
            loading={loading}
          />
          <StatCard
            icon={Users2}
            title="Clientes"
            value={`${cust.length}`}
            hint="Clientes gestionados en CRM"
            delta="Experiencia positiva con respuestas rápidas"
            loading={loading}
          />
          <StatCard
            icon={Boxes}
            title="Items activos"
            value={`${items.length}`}
            hint="Portafolio vigente en inventario"
            delta="Actualización continua garantizada"
            loading={loading}
          />
          <StatCard
            icon={ShieldAlert}
            title="Alertas"
            value={`${lowStock.length}`}
            hint="Productos en umbral crítico"
            delta={lowStock.length === 0 ? 'Todo bajo control' : 'Toma acción antes del quiebre'}
            loading={loading}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <motion.div
            className={`${glassCard} rounded-3xl p-6 xl:col-span-3`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Pulso de asistencia semanal</h2>
              <span className="flex items-center gap-1 rounded-full bg-emerald-100/70 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                <CalendarRange className="h-3.5 w-3.5" /> Últimos 7 días
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Verifica el ritmo de asistencia y anticipa desviaciones antes de que afecten la operación.</p>
            <div className="mt-6">
              <Sparkline data={attendanceTrend} />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-slate-500">Pico diario</p>
                <p className="mt-1 text-lg font-semibold text-slate-800">{Math.max(...attendanceTrend, 0)}</p>
              </div>
              <div>
                <p className="text-slate-500">Promedio</p>
                <p className="mt-1 text-lg font-semibold text-slate-800">
                  {attendanceTrend.length ? Math.round(attendanceTrend.reduce((acc, cur) => acc + cur, 0) / attendanceTrend.length) : 0}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Registros totales</p>
                <p className="mt-1 text-lg font-semibold text-slate-800">{att.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className={`${glassCard} flex flex-col justify-between rounded-3xl p-6 xl:col-span-2`}
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
              <div className="space-y-4 text-xs">
                <div>
                  <p className="text-slate-500">Ítems seguros</p>
                  <p className="mt-1 text-base font-semibold text-slate-800">{items.length - lowStock.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">En riesgo</p>
                  <p className="mt-1 text-base font-semibold text-rose-600">{lowStock.length}</p>
                </div>
                <div>
                  <p className="text-slate-500">Cobertura estimada</p>
                  <p className="mt-1 text-base font-semibold text-emerald-600">{inventoryCoverage}%</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <motion.div
            className={`${glassCard} rounded-3xl p-6 xl:col-span-3`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Alertas de stock mínimo</h2>
              <span className="rounded-full bg-rose-100/70 px-3 py-1 text-[11px] font-semibold text-rose-600">{lowStock.length} pendientes</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Prioriza los reabastecimientos críticos antes de que impacten el servicio.</p>
            <div className="mt-5 space-y-3">
              {lowStock.length === 0 && <p className="text-sm text-slate-500">Todo impecable: no hay alertas activas.</p>}
              <AnimatePresence>
                {lowStock.slice(0, 6).map((item) => (
                  <motion.div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-emerald-100/70 bg-white/70 px-4 py-3 shadow-sm"
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{item.name || 'Ítem sin nombre'}</p>
                      <p className="text-xs text-slate-500">Umbral mínimo {item.minStock}</p>
                    </div>
                    <span className="rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-600">Reposición urgente</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            className={`${glassCard} rounded-3xl p-6 xl:col-span-2`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
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
