import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import api, { getApiOrigin } from "../services/api";
import { listMyTasks, updateTask, type Task } from "../services/tasks";

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

export default function MyTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"COMPLETE" | "OBJECT" | null>(
    null
  );
  const [commentText, setCommentText] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  useAuth();

  const load = async () => {
    const data = await listMyTasks();
    setTasks(data as any);
  };
  const { socket } = useSocket();
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (!socket) return;
    const refresh = () => load();
    socket.on("task:created", refresh);
    socket.on("task:updated", refresh);
    socket.on("tasks:update", refresh);
    return () => {
      socket.off("task:created", refresh);
      socket.off("task:updated", refresh);
      socket.off("tasks:update", refresh);
    };
  }, [socket]);

  const openComplete = (id: string) => {
    setActionTaskId(id);
    setActionType("COMPLETE");
    setCommentText("");
  };
  const openObjection = (id: string) => {
    setActionTaskId(id);
    setActionType("OBJECT");
    setCommentText("");
  };
  const handleComplete = (t: Task) => openComplete(t.id);
  const handleObject = (t: Task) => openObjection(t.id);
  const submitAction = async () => {
    if (!actionTaskId || !actionType) return;
    if (!commentText.trim()) {
      toast.error("Agrega un comentario");
      return;
    }
    try {
      if (actionType === "COMPLETE") {
        await updateTask(actionTaskId, {
          status: "COMPLETADA",
          comentarioFinal: commentText.trim(),
        } as any);
        toast.success("Tarea completada");
      } else {
        await updateTask(actionTaskId, {
          status: "OBJETADA",
          motivoObjecion: commentText.trim(),
        } as any);
        toast.success("Tarea objetada");
      }
      setActionTaskId(null);
      setActionType(null);
      setCommentText("");
      setSelectedTask(null);
      await load();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "No se pudo enviar el comentario"
      );
    }
  };

  const counts = useMemo(() => {
    const pendientes = tasks.filter((t) => t.status !== "COMPLETADA").length;
    const completadas = tasks.filter((t) => t.status === "COMPLETADA").length;
    const objetadas = tasks.filter((t) => t.status === "OBJETADA").length;
    return { pendientes, completadas, objetadas };
  }, [tasks]);

  const visibleTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "PENDIENTE" || t.status === "EN_PROCESO"
      ),
    [tasks]
  );

  const { user } = useAuth();
  const markAttendance = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayKey = `attendance_${today}`;
      if (localStorage.getItem(todayKey)) return;

      const completedTasks = tasks.filter(
        (t) => t.status === "COMPLETADA"
      ).length;
      const totalTasks = tasks.length;
      if (!user?.sub) return;

      await api.post("/attendance", {
        userId: user.sub,
        date: today,
        completedTasks,
        totalTasks,
      });
      localStorage.setItem(todayKey, "done");
      toast.success("Asistencia registrada automáticamente");
    } catch (err) {
      console.warn("Auto-attendance failed", err);
    }
  };

  useEffect(() => {
    if (tasks.length > 0 && visibleTasks.length === 0) {
      markAttendance();
    }
  }, [tasks, visibleTasks]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 },
    },
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
                    Mis Tareas
                </motion.h1>
                <motion.div
                    className="mt-4 flex gap-6 text-sm text-slate-700"
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ duration: 0.7 }}
                >
                    <div>
                        Pendientes:{" "}
                        <span className="font-semibold text-slate-800">{counts.pendientes}</span>
                    </div>
                    <div>
                        Completas:{" "}
                        <span className="font-semibold text-slate-800">{counts.completadas}</span>
                    </div>
                    <div>
                        Objetadas:{" "}
                        <span className="font-semibold text-slate-800">{counts.objetadas}</span>
                    </div>
                </motion.div>
            </header>

      <motion.div
        className={`${glassCard} rounded-3xl overflow-hidden`}
        variants={itemVariants}
      >
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-black/5">
                <tr>
                <th className="p-4 text-left font-semibold text-slate-800">Cliente</th>
                <th className="p-4 text-left font-semibold text-slate-800">Dirección</th>
                <th className="p-4 text-left font-semibold text-slate-800">Tarea</th>
                <th className="p-4 text-left font-semibold text-slate-800">Ubicación</th>
                <th className="p-4 text-left font-semibold text-slate-800">Acciones</th>
                </tr>
            </thead>
            <tbody>
                {visibleTasks.map((t, i) => (
                <motion.tr
                    key={t.id}
                    variants={itemVariants}
                    className="border-t border-black/10 hover:bg-emerald-100/50 transition-colors"
                >
                    <td className="p-4 rounded-l-2xl">
                    <div className="font-medium text-slate-800">
                        {t.customer?.nombreCompleto || "-"}
                    </div>
                    <div className="text-xs text-slate-600">
                        IP: {t.customer?.ipAsignada || "-"} | Tel:{" "}
                        {t.customer?.telefono || "-"}
                    </div>
                    </td>
                    <td className="p-4 text-slate-700">
                    {t.customer?.direccion || "-"}
                    </td>
                    <td className="p-4 text-slate-700">{t.title}</td>
                    <td className="p-4">
                    <div
                        className="truncate text-slate-700 text-sm"
                        title={
                        t.customer?.latitud && t.customer?.longitud
                            ? `${t.customer.latitud}, ${t.customer.longitud}`
                            : undefined
                        }
                    >
                        {t.customer?.latitud && t.customer?.longitud
                        ? `${t.customer.latitud}, ${t.customer.longitud}`
                        : "-"}
                    </div>
                    </td>
                    <td className="p-4 rounded-r-2xl">
                    <motion.button
                        className="font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                        onClick={() => setSelectedTask(t)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        Ver más detalles
                    </motion.button>
                    </td>
                </motion.tr>
                ))}
                {visibleTasks.length === 0 && (
                <tr>
                    <td className="p-6" colSpan={5}>
                    <div className="flex flex-col items-center justify-center text-center text-slate-700 py-16">
                        <motion.img
                        src="/calma.png"
                        alt="Ilustración de calma"
                        className="w-48 h-auto mb-6 opacity-80"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        />
                        <h3 className="text-emerald-700 text-xl font-semibold mb-2">
                        ¡Gracias por tu trabajo de hoy!
                        </h3>
                        <p className="max-w-xl text-slate-600/90 leading-relaxed">
                        Has completado todas tus tareas asignadas. Tómate un respiro, relájate y prepárate para un nuevo día.
                        </p>
                    </div>
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>
      </motion.div>

      {selectedTask && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedTask(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white/90 backdrop-blur-lg border-l border-slate-200 shadow-2xl p-6 overflow-y-auto text-slate-800"
          >
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-2xl font-semibold text-emerald-700">Detalles de la tarea</h2>
              <motion.button
                className="text-sm text-slate-500 hover:underline"
                onClick={() => setSelectedTask(null)}
                whileHover={{ scale: 1.1 }}
              >
                Cerrar
              </motion.button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-3 p-4 rounded-lg bg-black/5">
                <h3 className="text-lg font-semibold text-emerald-700 border-b border-emerald-600/20 pb-2 mb-2">Cliente</h3>
                <div>
                  <div className="text-xs text-slate-500">Nombre</div>
                  <div className="font-medium text-slate-700">
                    {selectedTask.customer?.nombreCompleto || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">IP asignada</div>
                  <div className="font-medium text-slate-700">
                    {selectedTask.customer?.ipAsignada || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Teléfono</div>
                  <div className="font-medium text-slate-700">
                    {selectedTask.customer?.telefono || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Dirección</div>
                  <div className="font-medium text-slate-700">
                    {selectedTask.customer?.direccion || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Ubicación</div>
                  <div className="font-medium text-slate-700">
                    {selectedTask.customer?.latitud &&
                    selectedTask.customer?.longitud
                      ? `${selectedTask.customer.latitud}, ${selectedTask.customer.longitud}`
                      : "-"}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 p-4 rounded-lg bg-black/5">
                <h3 className="text-lg font-semibold text-emerald-700 border-b border-emerald-600/20 pb-2 mb-2">Tarea</h3>
                <div>
                  <div className="text-xs text-slate-500">Título</div>
                  <div className="font-medium text-slate-700">{selectedTask.title}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Descripción</div>
                  <div className="font-medium whitespace-pre-wrap text-slate-700">
                    {selectedTask.description || "-"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Estado</div>
                  <div className="font-medium text-slate-700">{selectedTask.status}</div>
                </div>
                {selectedTask.comentarioFinal && (
                  <div>
                    <div className="text-xs text-slate-500">Comentario final</div>
                    <div className="font-medium whitespace-pre-wrap text-slate-700">
                      {selectedTask.comentarioFinal}
                    </div>
                  </div>
                )}
                {selectedTask.motivoObjecion && (
                  <div>
                    <div className="text-xs text-slate-500">Motivo de objeción</div>
                    <div className="font-medium whitespace-pre-wrap text-slate-700">
                      {selectedTask.motivoObjecion}
                    </div>
                  </div>
                )}
                {(selectedTask as any).proofUrl && (
                  <div>
                    <div className="text-xs text-slate-500">Evidencia</div>
                    <a
                      className="text-emerald-600 underline hover:text-emerald-700"
                      href={`${getApiOrigin()}${
                        (selectedTask as any).proofUrl
                      }`}
                      target="_blank"
                    >
                      Ver evidencia
                    </a>
                  </div>
                )}
              </div>
            </div>
            {selectedTask.status !== "COMPLETADA" &&
              selectedTask.status !== "OBJETADA" && (
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
                  <motion.button
                    onClick={() => handleComplete(selectedTask)}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/30"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Marcar como Completada
                  </motion.button>
                  <motion.button
                    onClick={() => handleObject(selectedTask)}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-500/30"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Objetar Tarea
                  </motion.button>
                </div>
              )}
          </motion.div>
        </div>
      )}

      {actionTaskId && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setActionTaskId(null);
              setActionType(null);
              setCommentText("");
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="relative w-full max-w-md bg-white/90 backdrop-blur-lg border border-slate-200 rounded-xl shadow-2xl p-6 text-slate-800"
          >
            <h3 className="text-xl font-semibold mb-2 text-emerald-700">Agrega un comentario</h3>
            <p className="text-sm text-slate-600 mb-4">
              Describe cómo se completó la tarea o por qué no pudo realizarse.
            </p>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white/80 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              rows={4}
              placeholder="Ej: Se instaló la antena y se configuró el router..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-3">
              <motion.button
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-100 transition-colors"
                onClick={() => {
                  setActionTaskId(null);
                  setActionType(null);
                  setCommentText("");
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancelar
              </motion.button>
              <motion.button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/30"
                onClick={submitAction}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Enviar
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
        </div>
    </div>
  );
}
