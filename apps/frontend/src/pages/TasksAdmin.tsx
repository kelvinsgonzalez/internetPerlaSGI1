import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSocket } from "../hooks/useSocket";
import api from "../services/api";
import { getCustomers } from "../services/customers";
import {
  createTask,
  deleteTask,
  archiveTask,
  listTasks,
  updateTask,
  type Task,
  type TaskStatus,
} from "../services/tasks";

type User = {
  id: string;
  email: string;
  name?: string;
  role: "ADMIN" | "USER";
};
type Customer = {
  id: string;
  nombreCompleto: string;
  direccion?: string;
  telefono?: string;
  ipAsignada?: string;
  latitud?: string | null;
  longitud?: string | null;
};

const statusColors: Record<TaskStatus, string> = {
  PENDIENTE: "bg-slate-200 text-slate-700",
  EN_PROCESO: "bg-amber-200 text-amber-800",
  COMPLETADA: "bg-emerald-200 text-emerald-800",
  OBJETADA: "bg-rose-200 text-rose-800",
};

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

export default function TasksAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reassignFor, setReassignFor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<
    Customer | undefined
  >();
  const [form, setForm] = useState({
    assignedToId: "",
    title: "",
    description: "",
  });
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "">("");
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const { socket } = useSocket();

  const load = async () => {
    const params: {
      status?: TaskStatus;
      assignedToId?: string;
      archived?: boolean;
    } = { archived: showLog };
    if (filterStatus) params.status = filterStatus;
    if (filterAssignedTo) params.assignedToId = filterAssignedTo;
    const [u, t] = await Promise.all([
      api.get("/users"),
      listTasks(params),
    ]);
    setUsers(u.data.value || u.data);
    setTasks(t as Task[]);
  };
  // Load customers when drawer opens to ensure token is present and reduce load
  useEffect(() => {
    if (!open) return;
    getCustomers()
      .then((data) => setCustomers(data as Customer[]))
      .catch(() => setCustomers([]));
  }, [open]);

  useEffect(() => {
    load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterAssignedTo, showLog]);

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

  const workerUsers = useMemo(
    () => users.filter((u) => u.role === "USER"),
    [users]
  );
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers.slice(0, 50);
    return customers
      .filter(
        (c) =>
          (c.nombreCompleto || "").toLowerCase().includes(term) ||
          (c.direccion || "").toLowerCase().includes(term)
      )
      .slice(0, 50);
  }, [customers, search]);

  const onCreate = async () => {
    if (!selectedCustomer) return toast.error("Selecciona un cliente");
    if (!form.assignedToId) return toast.error("Selecciona un trabajador");
    if (!form.title.trim()) return toast.error("Titulo requerido");
    if (!telefonoContacto.trim())
      return toast.error("El teléfono de contacto es obligatorio");
    await createTask({
      title: form.title,
      description: form.description || undefined,
      customerId: selectedCustomer.id,
      assignedToId: form.assignedToId,
      telefonoContacto: telefonoContacto.trim(),
    });
    toast.success("Tarea creada");
    setOpen(false);
    setSearch("");
    setSelectedCustomer(undefined);
    setForm({ assignedToId: "", title: "", description: "" });
    setTelefonoContacto("");
    await load();
  };

  const onChangeStatus = async (id: string, next: TaskStatus) => {
    const prev = tasks.slice();
    setTasks((curr) =>
      curr.map((t) => (t.id === id ? { ...t, status: next } : t))
    );
    try {
      await updateTask(id, { status: next });
    } catch {
      setTasks(prev);
    }
  };
  const onEdit = (t: Task) => {
    setEditingTaskId(t.id);
    setSelectedCustomer((t as any).customer);
    setForm({
      assignedToId: (t.assignedTo as any)?.id || "",
      title: t.title,
      description: t.description || "",
    });
    setTelefonoContacto(((t as any).telefonoContacto as string) || "");
    setOpen(true);
  };

  const onUpdate = async () => {
    if (!editingTaskId) return;
    try {
      await updateTask(editingTaskId, {
        description: form.description || undefined,
        assignedToId: form.assignedToId || undefined,
        telefonoContacto: telefonoContacto.trim() || undefined,
      } as any);
      toast.success("Tarea actualizada");
      setOpen(false);
      setEditingTaskId(null);
      setSelectedCustomer(undefined);
      setForm({ assignedToId: "", title: "", description: "" });
      setTelefonoContacto("");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "No se pudo actualizar");
    }
  };
  const onArchive = async (id: string) => {
    const prev = tasks.slice();
    setTasks((curr) => curr.filter((t) => t.id !== id));
    try {
      await archiveTask(id);
      toast.success("Tarea archivada");
      await load();
    } catch {
      setTasks(prev);
      toast.error("No se pudo archivar la tarea");
    }
  };
  const onReassign = async (id: string, newUserId: string) => {
    const prev = tasks.slice();
    const user = users.find((u) => u.id === newUserId);
    setTasks((curr) =>
      curr.map((t) =>
        t.id === id
          ? {
              ...t,
              assignedTo: user
                ? ({ id: user.id, name: user.name, email: user.email } as any)
                : (t as any).assignedTo,
              status: "PENDIENTE" as TaskStatus,
              motivoObjecion: undefined,
            }
          : t
      )
    );
    try {
      await updateTask(id, {
        assignedToId: newUserId,
        status: "PENDIENTE" as TaskStatus,
      } as any);
      toast.success("Tarea reasignada y reiniciada a PENDIENTE");
    } catch (e: any) {
      setTasks(prev);
      toast.error(
        e?.response?.data?.message || "No se pudo reasignar la tarea"
      );
    } finally {
      setReassignFor(null);
    }
  };
  const onDelete = async (id: string) => {
    const prev = tasks.slice();
    setTasks((curr) => curr.filter((t) => t.id !== id));
    try {
      await deleteTask(id);
      toast.success("Tarea eliminada");
    } catch {
      setTasks(prev);
    }
  };

  return (
    <div className="relative min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

      <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
        <header className="flex items-center justify-between">
            <motion.h1
                className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                Tareas (Admin)
            </motion.h1>
            <div className="flex gap-2">
            <button
                onClick={() => setShowLog((prev) => !prev)}
                className="inline-flex items-center rounded-full border border-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-700 bg-white/70 shadow-sm hover:bg-emerald-50 transition"
            >
                {showLog ? "Volver a tareas" : "Ver log (completadas)"}
            </button>
            <select
                className="border rounded px-2 py-1"
                value={filterAssignedTo}
                onChange={(e) => setFilterAssignedTo(e.target.value)}
            >
                <option value="">Todos los asignados</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
            </select>
            <select
                className="border rounded px-2 py-1"
                value={filterStatus}
                onChange={(e) => setFilterStatus((e.target.value || "") as any)}
            >
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="COMPLETADA">Completada</option>
                <option value="OBJETADA">Objetada</option>
            </select>
            <button
                onClick={() => setOpen(true)}
                className={`inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-600 fixed bottom-5 right-5 z-30 sm:static sm:relative sm:bottom-auto sm:right-auto ${
                  open
                    ? "opacity-0 pointer-events-none sm:opacity-100 sm:pointer-events-auto"
                    : ""
                }`}
            >
                ➕ Agregar tarea
            </button>
            </div>
        </header>

      <motion.div 
        className={`${glassCard} rounded-3xl p-0 overflow-auto`}
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <table className="min-w-full text-sm text-slate-800">
          <thead className="bg-black/5">
            <tr className="text-left">
              <th className="p-3 font-semibold text-slate-700">Cliente</th>
              <th className="p-3 font-semibold text-slate-700">Dirección</th>
              <th className="p-3 font-semibold text-slate-700">Asignado a</th>
              <th className="p-3 font-semibold text-slate-700">Estado</th>
              <th className="p-3 font-semibold text-slate-700">Comentario</th>
              <th className="p-3 font-semibold text-slate-700">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => (
              <>
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`border-t border-black/10 ${
                    t.status === "COMPLETADA"
                      ? "bg-green-100/50"
                      : t.status === "OBJETADA"
                      ? "bg-red-100/50"
                      : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="font-medium flex items-center gap-2 text-slate-700">
                      {(t.customer as any)?.nombreCompleto || "-"}
                      {t.status === "OBJETADA" && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-semibold">
                          OBJETADA
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{t.title}</div>
                  </td>
                  <td className="p-3 text-slate-600">
                    {(t.customer as any)?.direccion || "-"}
                  </td>
                  <td className="p-3 relative text-slate-700">
                    <div className="flex items-center gap-2">
                      <span>{t.assignedTo?.name || t.assignedTo?.email}</span>
                      {!showLog && (
                        <button
                          className="text-xs text-emerald-600 hover:underline"
                          onClick={() =>
                            setReassignFor(reassignFor === t.id ? null : t.id)
                          }
                        >
                          Reasignar
                        </button>
                      )}
                    </div>
                    {!showLog && reassignFor === t.id && (
                      <div className="absolute z-10 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-lg p-2">
                        <div className="text-[11px] text-slate-500 mb-1">
                          Selecciona trabajador
                        </div>
                        <select
                          className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-sm text-slate-800"
                          defaultValue=""
                          onChange={(e) =>
                            e.target.value && onReassign(t.id, e.target.value)
                          }
                        >
                          <option value="" disabled>
                            Elegir…
                          </option>
                          {workerUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[t.status]}`}>
                      {t.status.replace("_", " ")}
                    </span>
                    {showLog ? (
                      <div className="mt-1 text-[11px] text-slate-500">
                        Archivada:{" "}
                        {t.archivedAt
                          ? new Date(t.archivedAt).toLocaleString()
                          : "—"}
                      </div>
                    ) : (
                      <div className="mt-1">
                        <select
                          className="bg-white/50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                          value={t.status}
                          disabled={
                            t.status === "COMPLETADA" || t.status === "OBJETADA"
                          }
                          onChange={(e) =>
                            onChangeStatus(t.id, e.target.value as TaskStatus)
                          }
                        >
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="EN_PROCESO">En proceso</option>
                          <option value="COMPLETADA">Completada</option>
                        </select>
                      </div>
                    )}
                  </td>
                  <td
                    className="p-3 text-xs text-slate-600 max-w-xs truncate"
                    title={
                      (t.status === "COMPLETADA"
                        ? t.comentarioFinal
                        : t.motivoObjecion) || ""
                    }
                  >
                    {t.status === "COMPLETADA"
                      ? t.comentarioFinal
                        ? t.comentarioFinal.length > 80
                          ? t.comentarioFinal.slice(0, 80) + "…"
                          : t.comentarioFinal
                        : "-"
                      : t.motivoObjecion
                      ? t.motivoObjecion.length > 80
                        ? t.motivoObjecion.slice(0, 80) + "…"
                        : t.motivoObjecion
                      : "-"}
                  </td>
                  <td className="p-3">
                    {showLog ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [t.id]: !prev[t.id],
                            }))
                          }
                          className="text-emerald-600 hover:underline text-xs"
                        >
                          {expanded[t.id] ? "Ocultar" : "Ver más..."}
                        </button>
                        <button
                          onClick={() => onDelete(t.id)}
                          className="text-rose-600 hover:underline text-xs"
                        >
                          Eliminar (permanente)
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [t.id]: !prev[t.id],
                            }))
                          }
                          className="text-emerald-600 hover:underline text-xs"
                        >
                          {expanded[t.id] ? "Ocultar" : "Ver más..."}
                        </button>
                        <button
                          onClick={() => onEdit(t)}
                          className="text-sky-600 hover:underline text-xs"
                        >
                          Editar
                        </button>
                        {t.status === "COMPLETADA" && (
                          <button
                            onClick={() => onArchive(t.id)}
                            className="text-emerald-700 hover:underline text-xs"
                          >
                            Archivar
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(t.id)}
                          className="text-rose-600 hover:underline text-xs"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </motion.tr>
                {expanded[t.id] && (
                  <tr className="border-t border-black/10 bg-slate-100/50">
                    <td className="p-4 text-slate-700" colSpan={6}>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-[11px] text-slate-500">Teléfono</div>
                          <div className="font-medium">{(t.customer as any)?.telefono ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Teléfono contacto</div>
                          <div className="font-medium">{(t as any)?.telefonoContacto ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">IP</div>
                          <div className="font-medium">{(t.customer as any)?.ipAsignada ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Latitud</div>
                          <div className="font-medium">{(t.customer as any)?.latitud ?? "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Longitud</div>
                          <div className="font-medium">{(t.customer as any)?.longitud ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td className="p-4 text-center text-slate-500" colSpan={6}>
                  {showLog ? "Sin tareas archivadas." : "Sin tareas para mostrar."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
              <motion.div
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-800/80 backdrop-blur-lg border-l border-slate-700 shadow-2xl shadow-emerald-500/20 p-6 overflow-y-auto text-white"
              >
                <h2 className="text-2xl font-semibold mb-6 text-emerald-400">
                  {editingTaskId ? "Editar tarea" : "Agregar tarea"}
                </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400">Buscar cliente</label>
                <input
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  placeholder="Nombre o dirección"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto mt-2 border border-slate-700 rounded-lg bg-slate-900/30">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      className={`block w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors ${
                        selectedCustomer?.id === c.id ? "bg-emerald-500/10" : ""
                      }`}
                      onClick={() => !editingTaskId && setSelectedCustomer(c)}
                      disabled={!!editingTaskId}
                    >
                      {c.nombreCompleto}{" "}
                      <span className="text-xs text-slate-500">
                        — {c.direccion || "-"}
                      </span>
                    </button>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <div className="p-3 text-sm text-slate-400 text-center">
                      Sin resultados
                    </div>
                  )}
                </div>
              </div>
              {selectedCustomer && (
                <div className="rounded-lg border border-slate-700 p-3 text-sm text-slate-300 bg-slate-900/40 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-500">Dirección:</span>{" "}
                    {selectedCustomer.direccion || "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Teléfono:</span>{" "}
                    {selectedCustomer.telefono || "-"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-400">IP asignada:</span>{" "}
                    {selectedCustomer.ipAsignada ?? "-"}
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm text-slate-400">Asignar trabajador</label>
                <select
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  value={form.assignedToId}
                  onChange={(e) =>
                    setForm({ ...form, assignedToId: e.target.value })
                  }
                >
                  <option value="">Selecciona trabajador</option>
                  {workerUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400" htmlFor="telefonoContacto">Teléfono de contacto *</label>
                <input
                  id="telefonoContacto"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  placeholder="Ej. 5523456789"
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Es el número desde el que llamó el cliente. No edita el teléfono maestro del cliente.
                </p>
              </div>
              <div>
                <label className="text-sm text-slate-600">Título</label>
                <input
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  placeholder="Ej. Revisar instalación"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  disabled={!!editingTaskId}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Descripción (opcional)</label>
                <textarea
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 mt-1 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  rows={3}
                  placeholder="Detalles adicionales"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <motion.button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={editingTaskId ? onUpdate : onCreate}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 transition-all"
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                  {editingTaskId ? "Guardar Cambios" : "Crear Tarea"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
}
