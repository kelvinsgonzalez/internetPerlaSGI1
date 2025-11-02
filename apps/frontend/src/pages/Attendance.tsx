import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Filter, RefreshCw, Search, CheckCircle, User, Type, FileText } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { LoadingState } from '../components/ip/LoadingState';
import { ErrorState } from '../components/ip/ErrorState';
import { useSocket } from '../hooks/useSocket';

type Rec = { id: string; name: string; tipo: 'IN' | 'OUT'; timestamp: string; note?: string };

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

export default function Attendance() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [filter, setFilter] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL');
  const [search, setSearch] = useState('');
  const { socket } = useSocket();

  const [users, setUsers] = useState<{ id: string; name: string; email: string; paymentRate?: number }[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  // Historial semanal (guardado local)
  type WeekRecord = {
    id: string;
    userId: string;
    userName: string;
    weekStart: string;
    weekEnd: string;
    rate: number;
    days: { date: string; checkIn: string; checkOut: string; payment: number }[];
    total: number;
    savedAt: string;
  };
  const [history, setHistory] = useState<WeekRecord[]>([]);
  const [historyQuery, setHistoryQuery] = useState<string>('');
  const HISTORY_KEY = 'attendance_week_history';
  const readHistory = (): WeekRecord[] => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(HISTORY_KEY) : null;
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? (arr as WeekRecord[]) : [];
    } catch {
      return [];
    }
  };
  const writeHistory = (arr: WeekRecord[]) => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
    } catch {}
  };
  useEffect(() => { setHistory(readHistory()); }, []);

  useEffect(() => {
    api.get('/users')
      .then(r => {
        const list = (r.data?.value ?? r.data) as any[];
        // Normalizar posible nombre del campo de pago (paymentRate | payment_rate)
        const normalized = (list || []).map((u) => ({
          ...u,
          paymentRate:
            typeof u?.paymentRate !== 'undefined'
              ? u.paymentRate
              : typeof (u as any)?.payment_rate !== 'undefined'
              ? (u as any).payment_rate
              : (typeof window !== 'undefined'
                  ? Number(window.localStorage.getItem(`paymentRate_${u.id}`) || '') || undefined
                  : undefined),
        }));
        setUsers(normalized);
      })
      .catch(() => toast.error('No se pudo cargar la lista de trabajadores.'));
  }, []);

  const load = () => {
    setLoading(true);
    setError(undefined);
    api.get('/attendance')
      .then(r => setRows(r.data))
      .catch(() => setError('Error al cargar asistencia'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!socket) return;
    const onNew = () => {
      toast.info('Nuevo registro de asistencia recibido.');
      load();
    };
    socket.on('attendance:created', onNew);
    return () => { socket.off('attendance:created', onNew); };
  }, [socket]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return rows.filter(r => {
      const t = new Date(r.timestamp);
      const byRange =
        filter === 'ALL' ||
        (filter === 'WEEK' && t >= startOfWeek) ||
        (filter === 'MONTH' && t >= startOfMonth);
      const byName = !search || r.name.toLowerCase().includes(search.toLowerCase());
      return byRange && byName;
    });
  }, [rows, filter, search]);

  const { weeklyData, bonusEligible } = useMemo(() => {
    if (!selectedUser) return { weeklyData: [], bonusEligible: false };

    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const weekDays = Array.from({ length: 6 }).map((_, i) => {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      return {
        date: day,
        dayName: day.toLocaleDateString('es-ES', { weekday: 'long' }),
        records: [] as Rec[],
      };
    });

    const selectedUserName = users.find(u => u.id === selectedUser)?.name;
    if (!selectedUserName) return { weeklyData: [], bonusEligible: false };

    const userRecords = rows.filter(r => {
      if (r.name !== selectedUserName) return false;
      const recordDate = new Date(r.timestamp);
      return recordDate >= startOfWeek && recordDate < new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
    });

    userRecords.forEach(rec => {
      const recDay = new Date(rec.timestamp).getDay();
      const dayIndex = recDay === 0 ? 6 : recDay - 1;
      if (dayIndex < 6) {
        weekDays[dayIndex].records.push(rec);
      }
    });

    const processedData = weekDays.map(day => {
      const checkIn = day.records.find(r => r.tipo === 'IN');
      const checkOut = day.records.find(r => r.tipo === 'OUT');
      return {
        dayName: day.dayName,
        date: day.date.toISOString().slice(0, 10),
        checkIn: checkIn ? new Date(checkIn.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '---',
        checkOut: checkOut ? new Date(checkOut.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '---',
        attended: !!checkIn,
        bonus: '', // ✅ agregado para evitar error TS2339
      };
    });

    const bonusEligible = processedData.length === 6 && processedData.every(day => day.attended);
    return { weeklyData: processedData, bonusEligible };
  }, [selectedUser, users, rows]);

  const [editingCell, setEditingCell] = useState<{ date: string; field: 'checkIn' | 'checkOut' | 'bonus' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleSave = async () => {
    if (!editingCell) return;
    const user = users.find(u => u.id === selectedUser);
    if (!user) return;
    try {
      await api.post('/attendance/manual-entry', {
        name: user.name,
        date: editingCell.date,
        type: editingCell.field,
        value: editValue,
      });
      toast.success('Cambio guardado exitosamente.');
      load();
    } catch {
      toast.error('No se pudo guardar el cambio.');
    } finally {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleEditClick = (day: any, field: 'checkIn' | 'checkOut' | 'bonus') => {
    setEditingCell({ date: day.date, field });
    const currentValue = day[field];
    if (currentValue.includes(':')) setEditValue(currentValue);
    else setEditValue('');
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
            Control de Asistencia
          </motion.h1>
          <motion.p
            className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Registra entradas y salidas del personal. Filtra y busca registros históricos con facilidad.
          </motion.p>
        </header>

        {loading && <LoadingState message="Cargando asistencia..." />}
        {error && <ErrorState message={error} onRetry={load} />}

        {/* Vista Semanal */}
        <motion.section className={`${glassCard} rounded-3xl p-6`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Vista Semanal por Trabajador</h2>
          <div className="relative max-w-xs">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
            <select className="w-full appearance-none rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
              value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="">Seleccione un trabajador</option>
              {users.map(u => (<option key={u.id} value={u.id}>{u.name || u.email}</option>))}
            </select>
          </div>

          {selectedUser && (
            <div className="mt-6">
              {(() => {
                const sel = users.find(u => u.id === selectedUser) as any;
                const rateRaw = sel?.paymentRate ?? 0;
                const rate = Number(typeof rateRaw === 'string' ? parseFloat(rateRaw) : rateRaw) || 0;
                return (
                  <div className="mb-2 text-xs text-slate-500">Pago diario configurado: Q{rate.toFixed(2)}</div>
                );
              })()}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-white/60 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Día</th>
                      <th className="px-4 py-3">Entrada</th>
                      <th className="px-4 py-3">Salida</th>
                      <th className="px-4 py-3">Pago</th>
                      {bonusEligible && <th className="px-4 py-3">Bonificación</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50/60 bg-white/70">
                    {weeklyData.map(day => (
                      <tr key={day.date}>
                        <td className="px-4 py-3 font-semibold text-slate-800 capitalize">{day.dayName} <span className="text-xs text-slate-400">{day.date}</span></td>
                        <td className="px-4 py-3 text-slate-600">
                          {editingCell?.date === day.date && editingCell?.field === 'checkIn' ? (
                            <input type="time" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleSave}
                              onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus
                              className="w-24 rounded border-emerald-300 bg-white px-1 py-0.5 text-sm shadow-inner focus:border-emerald-400 focus:outline-none" />
                          ) : (
                            <div onClick={() => handleEditClick(day, 'checkIn')} className="cursor-pointer w-full h-full">{day.checkIn}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {editingCell?.date === day.date && editingCell?.field === 'checkOut' ? (
                            <input type="time" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleSave}
                              onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus
                              className="w-24 rounded border-emerald-300 bg-white px-1 py-0.5 text-sm shadow-inner focus:border-emerald-400 focus:outline-none" />
                          ) : (
                            <div onClick={() => handleEditClick(day, 'checkOut')} className="cursor-pointer w-full h-full">{day.checkOut}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {(() => {
                            const sel = users.find(u => u.id === selectedUser) as any;
                            const rateRaw = sel?.paymentRate ?? 0;
                            const rate = Number(typeof rateRaw === 'string' ? parseFloat(rateRaw) : rateRaw) || 0;
                            const worked = day.checkIn !== '---' && day.checkOut !== '---';
                            return worked && rate > 0 ? `Q${rate.toFixed(2)}` : 'Q0.00';
                          })()}
                        </td>
                        {bonusEligible && (
                          <td className="px-4 py-3 text-emerald-600 font-semibold">
                            {editingCell?.date === day.date && editingCell?.field === 'bonus' ? (
                              <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={handleSave}
                                onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus placeholder="Monto"
                                className="w-24 rounded border-emerald-300 bg-white px-1 py-0.5 text-sm shadow-inner focus:border-emerald-400 focus:outline-none" />
                            ) : (
                              <div onClick={() => handleEditClick(day, 'bonus')} className="cursor-pointer w-full h-full">{day.bonus || 'Aplicar'}</div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {weeklyData.length === 0 && (
                      <tr><td colSpan={bonusEligible ? 5 : 4} className="px-4 py-6 text-center text-sm text-slate-400">No hay datos de asistencia para esta semana.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(() => {
                const sel = users.find(u => u.id === selectedUser) as any;
                const rateRaw = sel?.paymentRate ?? 0;
                const rate = Number(typeof rateRaw === 'string' ? parseFloat(rateRaw) : rateRaw) || 0;
                const daysWorked = weeklyData.filter((d: any) => d.checkIn !== '---' && d.checkOut !== '---').length;
                const total = rate * daysWorked;
                return (
                  <div className="mt-3 rounded-xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <div className="font-semibold">Resumen semanal</div>
                    <div>Días trabajados: {daysWorked} de 6</div>

              {/* Acciones de historial */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-600"
                  onClick={() => {
                    if (!selectedUser) return;
                    const u = users.find((x) => x.id === selectedUser);
                    if (!u) return;
                    const rate = Number((u as any)?.paymentRate || 0) || 0;
                    const now = new Date();
                    const dow = now.getDay();
                    const diffToMon = dow === 0 ? -6 : 1 - dow;
                    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMon);
                    start.setHours(0,0,0,0);
                    const end = new Date(start.getTime() + 6*24*60*60*1000);
                    const days = weeklyData.map((d: any) => ({
                      date: d.date,
                      checkIn: d.checkIn,
                      checkOut: d.checkOut,
                      payment: (d.checkIn !== "---" && d.checkOut !== "---") ? rate : 0,
                    }));
                    const totalSave = days.reduce((s: number, d: any) => s + d.payment, 0);
                    const rec: any = {
                      id: `${selectedUser}_${start.toISOString().slice(0,10)}`,
                      userId: selectedUser,
                      userName: (u as any).name || (u as any).email,
                      weekStart: start.toISOString().slice(0,10),
                      weekEnd: end.toISOString().slice(0,10),
                      rate,
                      days,
                      total: totalSave,
                      savedAt: new Date().toISOString(),
                    };
                    const existing: any[] = readHistory();
                    const idxRec = existing.findIndex((x: any) => x.id === rec.id);
                    if (idxRec >= 0) existing[idxRec] = rec; else existing.unshift(rec);
                    writeHistory(existing);
                    setHistory(existing);
                  }}
                >
                  Guardar semana en historial
                </button>
              </div>
                    <div>Total (sin bonificación): Q{total.toFixed(2)}</div>
                  </div>
                );
              })()}
              {bonusEligible && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm text-emerald-800">
                  <p><span className="font-semibold">¡Bonificación Desbloqueada!</span> Este trabajador ha cumplido con la asistencia de la semana completa.</p>
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* Historial semanal guardado localmente */}
        <motion.section className={`${glassCard} rounded-3xl p-6`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Historial semanal</h2>
              <p className="text-sm text-slate-500">Consulta semanas guardadas por fecha.</p>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Buscar por fecha</label>
              <input type="date" className="rounded border border-emerald-200/70 px-3 py-1 text-sm shadow-inner" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/60 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Trabajador</th>
                  <th className="px-3 py-2 text-left">Semana</th>
                  <th className="px-3 py-2 text-left">Pago diario</th>
                  <th className="px-3 py-2 text-left">Total</th>
                  <th className="px-3 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white/70">
                {history.filter(h => !historyQuery || (h.weekStart <= historyQuery && historyQuery <= h.weekEnd)).map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2">{h.userName}</td>
                    <td className="px-3 py-2">{h.weekStart} � {h.weekEnd}</td>
                    <td className="px-3 py-2">Q{h.rate.toFixed(2)}</td>
                    <td className="px-3 py-2">Q{h.total.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <details>
                        <summary className="cursor-pointer text-emerald-700 hover:underline">Ver</summary>
                        <div className="mt-2">
                          <table className="min-w-[500px] text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="px-2 py-1 text-left">Fecha</th>
                                <th className="px-2 py-1 text-left">Entrada</th>
                                <th className="px-2 py-1 text-left">Salida</th>
                                <th className="px-2 py-1 text-left">Pago</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {h.days.map(d => (
                                <tr key={d.date}>
                                  <td className="px-2 py-1">{d.date}</td>
                                  <td className="px-2 py-1">{d.checkIn}</td>
                                  <td className="px-2 py-1">{d.checkOut}</td>
                                  <td className="px-2 py-1">Q{d.payment.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (<tr><td className="px-3 py-4 text-center text-slate-500" colSpan={5}>A�n no hay semanas guardadas.</td></tr>)}
              </tbody>
            </table>
          </div>
        </motion.section>

{/* Tabla general de registros */}
        <motion.section className={`${glassCard} flex flex-1 flex-col rounded-3xl p-6`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Registros de Asistencia</h2>
              <p className="text-sm text-slate-500">Visualiza, filtra y busca en el historial de asistencia.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                <input className="w-64 rounded-full border border-emerald-200/70 bg-white px-9 py-2 text-sm shadow-inner focus:border-emerald-400 focus:outline-none"
                  placeholder="Buscar por nombre" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-700">
                <Filter className="h-3.5 w-3.5" />
                <select className="appearance-none bg-transparent focus:outline-none" value={filter} onChange={e => setFilter(e.target.value as any)}>
                  <option value="ALL">Todo</option>
                  <option value="WEEK">Semana actual</option>
                  <option value="MONTH">Mes actual</option>
                </select>
              </div>
              <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-semibold text-emerald-700 shadow hover:bg-emerald-50">
                <RefreshCw className="h-4 w-4" /> Recargar
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-white/40">
            <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
              <table className="min-w-full text-sm">
                <thead className="bg-white/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Fecha/Hora</th>
                    <th className="px-4 py-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50/60 bg-white/70">
                  {filtered.map(r => (
                    <tr key={r.id} className="transition hover:bg-emerald-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-800">{r.name}</td>
                      <td className="px-4 py-3 text-slate-500">{r.tipo}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(r.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 text-slate-500">{r.note}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">No hay registros que coincidan con los filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}


        
