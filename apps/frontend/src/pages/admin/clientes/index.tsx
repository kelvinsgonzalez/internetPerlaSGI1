import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ClienteFormDrawer from "../../../components/clientes/ClienteFormDrawer";
import ClientesTable from "../../../components/clientes/ClientesTable";
import CsvImportModal from "../../../components/clientes/CsvImportModal";
import {
  createCustomer,
  type CustomerDto,
  importCustomersCsv,
  type InternetPlan,
  listConflicts,
  listCustomers,
  listPlans,
  removeCustomer,
  updateCustomer,
} from "../../../services/clientes";

const glassCard = 'backdrop-blur-xl bg-white/5 shadow-lg shadow-emerald-500/10 border border-white/10';

export default function ClientesAdminPage() {
  const [rows, setRows] = useState<CustomerDto[]>([]);
  const [plans, setPlans] = useState<InternetPlan[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [editing, setEditing] = useState<CustomerDto | null>(null);
  const [query, setQuery] = useState("");

  const total = rows.length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.nombreCompleto || "").toLowerCase().includes(q) ||
        (r.direccion || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, p, cf] = await Promise.all([
        listCustomers(),
        listPlans().catch(() => []),
        listConflicts().catch(() => []),
      ]);
      setRows(c);
      setPlans(p || []);
      setConflicts(cf || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreateOrUpdate = async (input: any, editingId?: string) => {
    if (editingId) {
      await updateCustomer(editingId, input);
      toast.success("Cliente actualizado correctamente");
    } else {
      await createCustomer(input);
      toast.success("Cliente creado correctamente");
    }
    await load();
  };

  const onDelete = async (c: CustomerDto) => {
    if (!confirm(`¿Borrar cliente "${c.nombreCompleto}"?`)) return;
    await removeCustomer(c.id);
    toast.success("Cliente eliminado");
    await load();
  };

  const onImport = async (file: File) => {
    const res = await importCustomersCsv(file);
    toast.success(
      `Importación completada: ${res?.inserted ?? 0} insertados, ${
        res?.conflicts ?? 0
      } conflictos`
    );
    await load();
    return res;
  };

  return (
    <div className="relative min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-[140%] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(16,185,129,0.12),rgba(14,165,233,0.08),rgba(16,185,129,0.12))] blur-3xl opacity-35" />

        <div className="relative z-10 flex flex-1 flex-col gap-8 overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                        Clientes{" "}
                        <span className="ml-2 text-2xl font-medium rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                        {total}
                        </span>
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
                        Administra tus clientes, importa desde CSV y revisa conflictos.
                    </p>
                </motion.div>
                <div className="flex items-center gap-3">
                <motion.button
                    className="rounded-xl bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-md hover:bg-white transition-all"
                    onClick={() => setOpenImport(true)}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                    Importar CSV
                </motion.button>
                <motion.button
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all"
                    onClick={() => {
                    setEditing(null);
                    setOpenDrawer(true);
                    }}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                >
                    + Agregar Cliente
                </motion.button>
                </div>
            </header>

            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-rose-300">
                {error}
                </div>
            )}

            {loading ? (
                <div className={`${glassCard} rounded-2xl p-6 text-center text-slate-300`}>
                Cargando clientes...
                </div>
            ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
                    <ClientesTable
                        rows={filtered}
                        onEdit={(c) => {
                            setEditing(c);
                            setOpenDrawer(true);
                        }}
                        onDelete={onDelete}
                        query={query}
                        onQueryChange={setQuery}
                    />
                </motion.div>
            )}

            <motion.div className={`${glassCard} rounded-2xl p-6`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
                <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Conflictos recientes</h2>
                <button
                    className="text-xs text-emerald-400 hover:underline"
                    onClick={async () =>
                    setConflicts(await listConflicts().catch(() => []))
                    }
                >
                    Actualizar
                </button>
                </div>
                {conflicts.length === 0 ? (
                <div className="text-sm text-slate-400">
                    Sin conflictos registrados.
                </div>
                ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-xs text-slate-300">
                    <thead className="bg-white/10">
                        <tr>
                        <th className="px-3 py-2 text-left font-semibold">Nombre</th>
                        <th className="px-3 py-2 text-left font-semibold">Dirección</th>
                        <th className="px-3 py-2 text-left font-semibold">Motivo</th>
                        <th className="px-3 py-2 text-left font-semibold">Plan</th>
                        <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {conflicts.map((c: any) => (
                        <tr key={c.id} className="border-t border-white/10">
                            <td className="px-3 py-2">{c.name}</td>
                            <td className="px-3 py-2">{c.address || "-"}</td>
                            <td className="px-3 py-2">{c.reason || "-"}</td>
                            <td className="px-3 py-2">{c.planName || "-"}</td>
                            <td className="px-3 py-2">
                            {new Date(c.createdAt).toLocaleString()}
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                )}
            </motion.div>

            <ClienteFormDrawer
                open={openDrawer}
                onClose={() => setOpenDrawer(false)}
                onSubmit={onCreateOrUpdate}
                plans={plans}
                editing={editing || null}
            />
            <CsvImportModal
                open={openImport}
                onClose={() => setOpenImport(false)}
                onSubmit={onImport}
            />
        </div>
    </div>
  );
}
