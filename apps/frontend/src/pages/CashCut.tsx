import type { ElementType } from 'react';
import { useEffect, useMemo, useState } from "react";
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Banknote, Calendar, PlusCircle, AlertTriangle } from 'lucide-react';

import { ErrorState } from "../components/ip/ErrorState";
import { LoadingState } from "../components/ip/LoadingState";
import { useSocket } from "../hooks/useSocket";
import api from "../services/api";

type Entry = { id: string; entryDate: string; type: "INCOME" | "EXPENSE"; description: string; amount: number | string; createdAt: string; createdBy?: string; createdById?: string; createdByName?: string; };
type CashCut = { date: string; incomes: number; expenses: number; balance: number; entries: Entry[]; closedBy?: string; };

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

function fmtMoney(q: number) {
  if (Number.isNaN(q)) q = 0;
  return `Q ${q.toFixed(2)}`;
}

function todayISO() {
  const d = new Date();
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

export default function CashCut() {
  const [date, setDate] = useState<string>(todayISO());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [data, setData] = useState<CashCut | null>(null);
  const { socket } = useSocket();

  const [inDesc, setInDesc] = useState("");
  const [inAmt, setInAmt] = useState<string>("");
  const [outDesc, setOutDesc] = useState("");
  const [outAmt, setOutAmt] = useState<string>("");
  const [formError, setFormError] = useState<string | undefined>();

  const reload = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const { data } = await api.get("/finance/cash-cut", { params: { date } });
      const entries = (data.entries || []).map((e: Entry) => ({ ...e, amount: typeof e.amount === "string" ? parseFloat(e.amount as any) : e.amount }));
      setData({ ...data, entries });
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al cargar el corte de caja");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [date]);

  useEffect(() => {
    if (!socket) return;
    const maybeRefresh = (payload: any) => { if (payload?.date === date) reload(); };
    socket.on("cash:entry-added", maybeRefresh);
    socket.on("cash:day-closed", maybeRefresh);
    return () => { socket.off("cash:entry-added", maybeRefresh); socket.off("cash:day-closed", maybeRefresh); };
  }, [socket, date]);

  const totals = useMemo(() => {
    const incomes = (data?.entries || []).filter((e) => e.type === "INCOME").reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const expenses = (data?.entries || []).filter((e) => e.type === "EXPENSE").reduce((a, e) => a + (Number(e.amount) || 0), 0);
    return { incomes, expenses, balance: incomes - expenses };
  }, [data]);

  const addEntry = async (type: 'INCOME' | 'EXPENSE') => {
    setFormError(undefined);
    const desc = type === 'INCOME' ? inDesc : outDesc;
    const amt = type === 'INCOME' ? inAmt : outAmt;
    const amount = parseFloat(amt || "0");
    if (!desc || !amount || amount <= 0) {
      setFormError("Ingresa una descripción y un monto mayor a 0.");
      return;
    }
    try {
      await api.post("/finance/cash-entry", { entryDate: date, type, description: desc, amount });
      if (type === 'INCOME') { setInDesc(""); setInAmt(""); } 
      else { setOutDesc(""); setOutAmt(""); }
      reload();
    } catch (e: any) {
      setFormError(e?.response?.data?.message || `No se pudo registrar el ${type === 'INCOME' ? 'ingreso' : 'egreso'}`);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <motion.h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    Mi Corte de Caja
                </motion.h1>
                <motion.p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
                    Registra tus ingresos y egresos del día para mantener la contabilidad al corriente.
                </motion.p>
            </div>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
              <input type="date" className="w-full md:w-auto rounded-full border border-emerald-200/70 bg-white pl-10 pr-4 py-2 text-sm font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
        </header>

        {loading && <LoadingState message="Cargando corte de caja..." />}
        {error && <ErrorState message={error} onRetry={reload} />}

        {!!data?.closedBy && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-sm text-amber-800 shadow-lg shadow-amber-500/10">
            <AlertTriangle className="h-5 w-5" />
            <span>Día cerrado por <strong>{data.closedBy}</strong>. No se pueden registrar nuevos movimientos.</span>
          </motion.div>
        )}
        {formError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl border border-red-300 bg-red-50/80 p-4 text-sm text-red-800 shadow-lg shadow-red-500/10">
            <AlertTriangle className="h-5 w-5" />
            <span>{formError}</span>
          </motion.div>
        )}

        {!loading && !error && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <StatCard icon={ArrowUp} title="Ingresos" value={fmtMoney(totals.incomes)} hint="Recaudado en el día" accent="bg-emerald-100 text-emerald-700" />
              <StatCard icon={ArrowDown} title="Egresos" value={fmtMoney(totals.expenses)} hint="Gastos del día" accent="bg-amber-100 text-amber-700" />
              <StatCard icon={Banknote} title="Resultado" value={fmtMoney(totals.balance)} hint={`Balance para ${new Date(date + 'T00:00:00').toLocaleDateString()}`} accent="bg-sky-100 text-sky-700" />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <motion.div className={`${glassCard} rounded-3xl p-6`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="font-semibold text-lg text-slate-800 mb-4">Registrar Ingreso</h3>
                <div className="space-y-4">
                  <input className="w-full rounded-full border border-emerald-200/70 bg-white px-5 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none" placeholder="Descripción" value={inDesc} onChange={(e) => setInDesc(e.target.value)} disabled={!!data?.closedBy} />
                  <input type="number" className="w-full rounded-full border border-emerald-200/70 bg-white px-5 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none" placeholder="Monto" value={inAmt} onChange={(e) => setInAmt(e.target.value)} disabled={!!data?.closedBy} />
                  <button onClick={() => addEntry('INCOME')} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600 disabled:opacity-50" disabled={!!data?.closedBy}>
                    <PlusCircle className="h-4 w-4" />
                    Agregar Ingreso
                  </button>
                </div>
              </motion.div>
              <motion.div className={`${glassCard} rounded-3xl p-6`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <h3 className="font-semibold text-lg text-slate-800 mb-4">Registrar Egreso</h3>
                <div className="space-y-4">
                  <input className="w-full rounded-full border border-emerald-200/70 bg-white px-5 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none" placeholder="Descripción" value={outDesc} onChange={(e) => setOutDesc(e.target.value)} disabled={!!data?.closedBy} />
                  <input type="number" className="w-full rounded-full border border-emerald-200/70 bg-white px-5 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none" placeholder="Monto" value={outAmt} onChange={(e) => setOutAmt(e.target.value)} disabled={!!data?.closedBy} />
                  <button onClick={() => addEntry('EXPENSE')} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600 disabled:opacity-50" disabled={!!data?.closedBy}>
                    <PlusCircle className="h-4 w-4" />
                    Agregar Egreso
                  </button>
                </div>
              </motion.div>
            </div>

            <motion.div className={`${glassCard} rounded-3xl p-6`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <h3 className="font-semibold text-lg text-slate-800 mb-4">Movimientos del Día</h3>
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-medium text-emerald-700 mb-2">Ingresos</h4>
                  <ul className="space-y-2">
                    {data?.entries.filter((e) => e.type === "INCOME").length === 0 && <li className="text-slate-500 text-xs">Sin ingresos.</li>}
                    {data?.entries.filter((e) => e.type === "INCOME").map((e) => (
                      <li key={e.id} className="border-b border-emerald-100/70 pb-2 flex justify-between items-start">
                        <div>
                          <p>{e.description}</p>
                          <p className="text-xs text-slate-400">{e.createdByName || e.createdBy || ""}</p>
                        </div>
                        <span className="font-medium text-emerald-600">{fmtMoney(Number(e.amount) || 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-amber-700 mb-2">Egresos</h4>
                  <ul className="space-y-2">
                    {data?.entries.filter((e) => e.type === "EXPENSE").length === 0 && <li className="text-slate-500 text-xs">Sin egresos.</li>}
                    {data?.entries.filter((e) => e.type === "EXPENSE").map((e) => (
                      <li key={e.id} className="border-b border-amber-100/70 pb-2 flex justify-between items-start">
                        <div>
                          <p>{e.description}</p>
                          <p className="text-xs text-slate-400">{e.createdByName || e.createdBy || ""}</p>
                        </div>
                        <span className="font-medium text-amber-600">{fmtMoney(Number(e.amount) || 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
