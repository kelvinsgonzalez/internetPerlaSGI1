import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowRight, ClipboardCheck, MessageSquare, DollarSign, Briefcase, User, LogOut, Server, CheckCircle } from 'lucide-react';

import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { listContacts } from '../services/messages';

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

const DashboardCard = ({ to, icon: Icon, title, subtitle, accentColor, delay, extra }: { to: string, icon: React.ElementType, title: string, subtitle: string, accentColor: string, delay: number, extra?: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    whileHover={{ translateY: -5, scale: 1.02 }}
  >
    <Link to={to} className={`${glassCard} rounded-3xl p-6 flex flex-col justify-between h-full group`}>
      <div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${accentColor}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <h3 className="font-bold text-slate-800 text-lg mt-4">{title}</h3>
        <p className="text-sm text-slate-500">{subtitle}</p>
        {extra}
      </div>
      <div className="mt-4 flex items-center justify-end text-sm font-semibold text-emerald-600 group-hover:text-emerald-500 transition-colors">
        Ir ahora <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  </motion.div>
);

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 2 }).format(n);

export default function Dashboard(){
  const { user } = useAuth();
  const [pendingTasks, setPendingTasks] = useState<number>(0);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [attendanceIn, setAttendanceIn] = useState<string>('No registrada');
  const [attendanceOut, setAttendanceOut] = useState<string>('No registrada');
  const [cashTotals, setCashTotals] = useState<{ income: number; expense: number; entries: number } | null>(null);
  const { socket } = useSocket();

  const isPending = (t: any) => t?.status === 'PENDIENTE' || t?.status === 'EN_PROCESO';

  const loadData = () => {
    api.get('/tasks/mine').then(r=>{
      const list = r.data || [];
      setPendingTasks((list as any[]).filter(isPending).length);
    }).catch(()=>setPendingTasks(0));

    listContacts().then(cs=>{
        const unread = cs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadMessages(unread);
    }).catch(()=>setUnreadMessages(0));

    api.get('/attendance').then(r=>{
      const me = (user?.name || user?.email)?.toLowerCase();
      const today = new Date().toDateString();
      const list = (r.data as any[]).filter(a=> new Date(a.timestamp).toDateString()===today && (a.name||'').toLowerCase()===me);
      const recIn = list.find(a=>a.tipo==='IN');
      const recOut = list.find(a=>a.tipo==='OUT');
      setAttendanceIn(recIn ? new Date(recIn.timestamp).toLocaleTimeString() : 'No registrada');
      setAttendanceOut(recOut ? new Date(recOut.timestamp).toLocaleTimeString() : 'No registrada');
    }).catch(()=>{ setAttendanceIn('No disponible'); setAttendanceOut('No disponible'); });

    const today = new Date().toISOString().slice(0, 10);
    api.get('/finance/cash-cut', { params: { date: today } }).then(r => {
      const entries = (r.data?.entries || []) as Array<{ type: 'INCOME' | 'EXPENSE'; amount: number | string }>;
      const income = entries.filter(e => e.type === 'INCOME').reduce((a, e) => a + (Number(e.amount) || 0), 0);
      const expense = entries.filter(e => e.type === 'EXPENSE').reduce((a, e) => a + (Number(e.amount) || 0), 0);
      setCashTotals({ income, expense, entries: entries.length });
    }).catch(() => setCashTotals(null));
  };

  useEffect(()=>{
    loadData();
  },[]);

  useEffect(()=>{
    if (!socket) return;
    const onNewAttendance = (rec:any)=>{
      const me = (user?.name || user?.email)?.toLowerCase();
      const t = new Date(rec.timestamp);
      if ((rec.name||'').toLowerCase()===me && new Date().toDateString()===t.toDateString()){
        if (rec.tipo==='OUT') setAttendanceOut(t.toLocaleTimeString());
        if (rec.tipo==='IN') setAttendanceIn(t.toLocaleTimeString());
      }
    };
    const onNewMessage = () => { listContacts().then(cs => setUnreadMessages(cs.reduce((acc, c) => acc + (c.unreadCount || 0), 0))); };
    const onTaskUpdate = () => { api.get('/tasks/mine').then(r => setPendingTasks((r.data || []).filter(isPending).length)); };

    const onCashChange = () => loadData();

    socket.on('attendance:created', onNewAttendance);
    socket.on('message:created', onNewMessage);
    socket.on('task:created', onTaskUpdate);
    socket.on('task:updated', onTaskUpdate);
    socket.on('cash:entry-added', onCashChange);
    socket.on('cash:day-closed', onCashChange);
    socket.on('cash:user-closed', onCashChange);
    socket.on('cash:day-reopened', onCashChange);

    return ()=>{
      socket.off('attendance:created', onNewAttendance);
      socket.off('message:created', onNewMessage);
      socket.off('task:created', onTaskUpdate);
      socket.off('task:updated', onTaskUpdate);
      socket.off('cash:entry-added', onCashChange);
      socket.off('cash:day-closed', onCashChange);
      socket.off('cash:user-closed', onCashChange);
      socket.off('cash:day-reopened', onCashChange);
    };
  },[socket, user]);

  const handleRegisterExit = async () => {
    if (pendingTasks > 0) {
      toast.error(`No puedes salir: tienes ${pendingTasks} tarea${pendingTasks === 1 ? '' : 's'} pendiente${pendingTasks === 1 ? '' : 's'}.`);
      return;
    }
    try {
      // El backend toma la identidad del JWT; mandarla desde el cliente
      // permitiría marcar la salida de otra persona.
      await api.post('/attendance/check', { tipo: 'OUT', note: 'manual-out-dashboard' });
      toast.success('Salida registrada correctamente');
      loadData();
    } catch {
      toast.error('No se pudo registrar la salida');
    }
  }

  return (
    <div className="bg-gray-50 relative flex min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
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
            Bienvenido, {user?.name || user?.email}
          </motion.h1>
          <motion.p
            className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Aquí tienes un resumen de tu actividad y accesos directos a tus herramientas.
          </motion.p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DashboardCard to="/my-tasks" icon={ClipboardCheck} title="Mis Tareas" subtitle={pendingTasks > 0 ? `${pendingTasks} pendiente${pendingTasks === 1 ? '' : 's'}` : 'Todo completado'} accentColor="bg-amber-500" delay={0.1} />
          <DashboardCard to="/messages" icon={MessageSquare} title="Mensajes" subtitle={`${unreadMessages} sin leer`} accentColor="bg-sky-500" delay={0.2} />
          <DashboardCard
            to="/finance"
            icon={DollarSign}
            title="Mi Corte de Caja"
            subtitle={cashTotals ? `${cashTotals.entries} movimiento${cashTotals.entries === 1 ? '' : 's'} hoy` : 'Registrar ingresos/egresos'}
            accentColor="bg-emerald-500"
            delay={0.3}
            extra={cashTotals && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-emerald-500/10 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700">Ingresos</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-700">{formatCurrency(cashTotals.income)}</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 px-2 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-rose-600">Egresos</p>
                  <p className="mt-0.5 text-sm font-bold text-rose-600">{formatCurrency(cashTotals.expense)}</p>
                </div>
                <div className={`rounded-xl px-2 py-2 text-center ${cashTotals.income - cashTotals.expense >= 0 ? 'bg-sky-500/10' : 'bg-amber-500/10'}`}>
                  <p className={`text-[10px] uppercase tracking-wide ${cashTotals.income - cashTotals.expense >= 0 ? 'text-sky-700' : 'text-amber-700'}`}>Saldo</p>
                  <p className={`mt-0.5 text-sm font-bold ${cashTotals.income - cashTotals.expense >= 0 ? 'text-sky-700' : 'text-amber-700'}`}>
                    {formatCurrency(cashTotals.income - cashTotals.expense)}
                  </p>
                </div>
              </div>
            )}
          />
          <DashboardCard to="/inventory" icon={Briefcase} title="Inventario" subtitle="Gestionar herramientas" accentColor="bg-violet-500" delay={0.4} />
          <DashboardCard to="/profile" icon={User} title="Mi Perfil" subtitle="Ver mi información" accentColor="bg-slate-500" delay={0.5} />
        </div>

        <motion.div 
          className={`${glassCard} rounded-3xl p-6`} 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <h3 className="font-bold text-slate-800 text-lg mb-4">Asistencia de Hoy</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white/70 p-4 rounded-2xl border border-white/50 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">Entrada</p>
              <p className="text-lg font-bold text-slate-800">{attendanceIn}</p>
            </div>
            <div className="bg-white/70 p-4 rounded-2xl border border-white/50 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">Salida</p>
              <p className="text-lg font-bold text-slate-800">{attendanceOut}</p>
            </div>
            {attendanceOut === 'No registrada' && (
              <div className="col-span-2 flex flex-col items-center justify-center gap-2">
                <button
                  onClick={handleRegisterExit}
                  disabled={pendingTasks > 0}
                  title={pendingTasks > 0 ? `Bloqueado: ${pendingTasks} tarea${pendingTasks === 1 ? '' : 's'} pendiente${pendingTasks === 1 ? '' : 's'}` : 'Registrar salida'}
                  className={`w-full h-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition ${
                    pendingTasks > 0
                      ? 'bg-slate-400 shadow-slate-200 cursor-not-allowed'
                      : 'bg-emerald-500 shadow-emerald-200 hover:bg-emerald-600'
                  }`}
                >
                  <LogOut className="h-4 w-4" />
                  {pendingTasks > 0 ? 'Salida bloqueada' : 'Registrar Mi Salida'}
                </button>
                {pendingTasks > 0 && (
                  <p className="text-xs text-rose-600">
                    Completa tus {pendingTasks} tarea{pendingTasks === 1 ? '' : 's'} pendiente{pendingTasks === 1 ? '' : 's'} antes de salir.
                  </p>
                )}
              </div>
            )}
            {attendanceOut !== 'No registrada' && (
              <div className="col-span-2 flex items-center justify-center bg-emerald-50/80 rounded-2xl text-emerald-700">
                <CheckCircle className="h-5 w-5 mr-2" />
                <p className="font-semibold text-sm">Jornada completada</p>
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
