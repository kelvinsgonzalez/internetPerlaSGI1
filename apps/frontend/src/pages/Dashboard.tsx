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

const DashboardCard = ({ to, icon: Icon, title, subtitle, accentColor, delay }: { to: string, icon: React.ElementType, title: string, subtitle: string, accentColor: string, delay: number }) => (
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
      </div>
      <div className="mt-4 flex items-center justify-end text-sm font-semibold text-emerald-600 group-hover:text-emerald-500 transition-colors">
        Ir ahora <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  </motion.div>
);

export default function Dashboard(){
  const { user } = useAuth();
  const [pendingTasks, setPendingTasks] = useState<number>(0);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [attendanceIn, setAttendanceIn] = useState<string>('No registrada');
  const [attendanceOut, setAttendanceOut] = useState<string>('No registrada');
  const { socket } = useSocket();

  const loadData = () => {
    api.get('/tasks/mine').then(r=>{
      const list = r.data || [];
      setPendingTasks((list as any[]).filter((t:any)=>t.status==='PENDING').length);
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
    const onTaskUpdate = () => { api.get('/tasks/mine').then(r => setPendingTasks((r.data || []).filter((t:any)=>t.status==='PENDING').length)); };

    socket.on('attendance:created', onNewAttendance);
    socket.on('message:created', onNewMessage);
    socket.on('task:created', onTaskUpdate);
    socket.on('task:updated', onTaskUpdate);

    return ()=>{ 
      socket.off('attendance:created', onNewAttendance);
      socket.off('message:created', onNewMessage);
      socket.off('task:created', onTaskUpdate);
      socket.off('task:updated', onTaskUpdate);
    };
  },[socket, user]);

  const handleRegisterExit = async () => {
    try {
      const name = (user?.name || user?.email) as string;
      await api.post('/attendance/check', { name, tipo: 'OUT', note: 'manual-out-dashboard' });
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
          <DashboardCard to="/my-tasks" icon={ClipboardCheck} title="Mis Tareas" subtitle={`${pendingTasks} pendiente(s)`} accentColor="bg-amber-500" delay={0.1} />
          <DashboardCard to="/messages" icon={MessageSquare} title="Mensajes" subtitle={`${unreadMessages} sin leer`} accentColor="bg-sky-500" delay={0.2} />
          <DashboardCard to="/finance" icon={DollarSign} title="Mi Corte de Caja" subtitle="Registrar ingresos/egresos" accentColor="bg-emerald-500" delay={0.3} />
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
              <div className="col-span-2 flex items-center justify-center">
                <button 
                  onClick={handleRegisterExit}
                  className="w-full h-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600"
                >
                  <LogOut className="h-4 w-4" />
                  Registrar Mi Salida
                </button>
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
