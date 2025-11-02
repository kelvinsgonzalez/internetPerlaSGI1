import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ClipboardList, MessageCircle, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { listContacts, type Contact } from '../services/messages';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';

type Task = { id: string; title: string; description: string; status: 'PENDING' | 'COMPLETED'; createdAt?: string; updatedAt?: string };

type SummaryType = 'tasks' | 'messages';

type NotificationItem = {
  id: SummaryType;
  title: string;
  description: string;
  createdAt: string;
  count: number;
};

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const msInUnit: [number, Intl.RelativeTimeFormatUnit][] = [
  [60_000, 'minute'],
  [3_600_000, 'hour'],
  [86_400_000, 'day'],
  [604_800_000, 'week'],
  [2_592_000_000, 'month'],
  [31_536_000_000, 'year'],
];

const getTimestamp = (value?: string) => (value ? new Date(value).getTime() : 0);

function timeAgo(dateIso: string | undefined) {
  if (!dateIso) return 'Sin fecha';
  const date = new Date(dateIso);
  const elapsed = date.getTime() - Date.now();
  const abs = Math.abs(elapsed);
  for (const [ms, unit] of msInUnit) {
    if (abs < ms * 1.5) {
      return rtf.format(Math.round(elapsed / ms), unit);
    }
  }
  return rtf.format(Math.round(elapsed / 31_536_000_000), 'year');
}

export function UserNotificationBell(){
  const { user } = useAuth();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const openRef = useRef(false);

  useEffect(() => { openRef.current = open; }, [open]);

  const storageBase = useMemo(() => (user ? `ip_seen_${user.sub}` : ''), [user?.sub]);

  const readSeen = useCallback((type: SummaryType) => {
    if (!storageBase || typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(`${storageBase}_${type}`);
    return raw ? Number(raw) : 0;
  }, [storageBase]);

  const writeSeen = useCallback((type: SummaryType, timestamp: number) => {
    if (!storageBase || typeof window === 'undefined') return;
    const key = `${storageBase}_${type}`;
    const prev = Number(window.localStorage.getItem(key) || '0');
    window.localStorage.setItem(key, String(Math.max(prev, timestamp)));
  }, [storageBase]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [tasksRes, contacts] = await Promise.all([
        api.get<Task[]>('/tasks/mine'),
        listContacts(),
      ]);

      const tasks = (tasksRes.data || []) as Task[];
      const pendingTasks = tasks.filter((task) => task.status === 'PENDING');
      const latestTaskTs = pendingTasks.reduce((max, task) => {
        const ts = getTimestamp(task.updatedAt || task.createdAt);
        return ts > max ? ts : max;
      }, 0);

      const notifications: NotificationItem[] = [];
      const seenTasks = readSeen('tasks');
      if (pendingTasks.length > 0 && latestTaskTs > seenTasks) {
        notifications.push({
          id: 'tasks',
          title: `Tienes ${pendingTasks.length} tarea${pendingTasks.length === 1 ? '' : 's'} pendiente${pendingTasks.length === 1 ? '' : 's'}`,
          description: 'Visita Mis Tareas para actualizar tu avance.',
          createdAt: new Date(latestTaskTs).toISOString(),
          count: pendingTasks.length,
        });
      }

      const contactsList = contacts as Contact[];
      const seenMessages = readSeen('messages');
      let latestMessageTs = 0;
      const conversationsWithNew = contactsList.filter((contact) => {
        if (!contact.lastAt) return false;
        const ts = new Date(contact.lastAt).getTime();
        if (ts > seenMessages) {
          if (ts > latestMessageTs) latestMessageTs = ts;
          return true;
        }
        return false;
      });

      if (conversationsWithNew.length > 0 && latestMessageTs > seenMessages) {
        notifications.push({
          id: 'messages',
          title: `Tienes mensajes pendientes (${conversationsWithNew.length})`,
          description: 'Abre tu bandeja para responder las conversaciones recientes.',
          createdAt: new Date(latestMessageTs).toISOString(),
          count: conversationsWithNew.length,
        });
      }

      setPendingCount(notifications.length);
      if (openRef.current) {
        setItems(notifications);
      } else {
        setItems([]);
      }
    } catch (err) {
      setError('No se pudieron cargar las notificaciones.');
      setItems([]);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  }, [readSeen, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on('task:created', refresh);
    socket.on('task:updated', refresh);
    socket.on('message:created', refresh);
    return () => {
      socket.off('task:created', refresh);
      socket.off('task:updated', refresh);
      socket.off('message:created', refresh);
    };
  }, [socket, load]);

  const toggle = () => {
    const next = !openRef.current;
    openRef.current = next;
    setOpen(next);
    if (next) {
      load();
    } else {
      setItems([]);
    }
  };

  const handleAccess = (type: SummaryType, createdAt: string) => {
    const ts = getTimestamp(createdAt) || Date.now();
    writeSeen(type, ts);
    const remaining = items.filter((item) => item.id !== type).length;
    setPendingCount(remaining);
    openRef.current = false;
    setOpen(false);
    setItems([]);
  };

  const badge = useMemo(() => pendingCount, [pendingCount]);

  if (!user) return null;

  return (
    <div className="relative z-[9999]">
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={toggle}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 text-white/90 shadow-inner backdrop-blur hover:bg-white/30 hover:text-white transition"
      >
        <Bell size={18} />
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {badge}
          </span>
        )}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 mt-3 w-80 origin-top-right overflow-hidden rounded-3xl border border-emerald-200/70 bg-white text-slate-900 shadow-2xl z-[99999]"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500/15 to-teal-500/10 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-emerald-700/70">Actividad</p>
                <h3 className="text-sm font-semibold text-emerald-900">Tus notificaciones</h3>
              </div>
              <button
                onClick={load}
                className="flex items-center gap-1 rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Actualizar
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto p-4">
              {loading && <div className="py-10 text-center text-xs text-slate-400">Cargando novedades...</div>}
              {!loading && error && <div className="py-10 text-center text-xs text-rose-500">{error}</div>}
              {!loading && !error && pendingCount === 0 && (
                <div className="py-10 text-center text-xs text-slate-400">Sin tareas pendientes ni nuevos mensajes.</div>
              )}
              {!loading && !error && items.length > 0 && (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.id === 'tasks' ? '/my-tasks' : '/messages'}
                        onClick={() => handleAccess(item.id, item.createdAt)}
                        className={`block rounded-2xl border border-slate-100/80 px-4 py-3 shadow-sm transition hover:scale-[1.01] ${
                          item.id === 'tasks' ? 'bg-emerald-50/70 hover:bg-emerald-100/60' : 'bg-sky-50/60 hover:bg-sky-100/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                            item.id === 'tasks' ? 'bg-emerald-500/20 text-emerald-700' : 'bg-sky-500/20 text-sky-700'
                          }`}>
                            {item.id === 'tasks' ? <ClipboardList className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                            <p className="text-xs text-slate-500 truncate">{item.description}</p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span>{timeAgo(item.createdAt)}</span>
                          <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{item.count}</span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-emerald-700">
              <Link to="/my-tasks" className="hover:text-emerald-900 transition">Mis tareas</Link>
              <Link to="/messages" className="hover:text-emerald-900 transition">Bandeja de mensajes</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default UserNotificationBell;
