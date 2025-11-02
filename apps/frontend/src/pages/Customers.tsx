import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EmptyState } from "../components/ip/EmptyState";
import { ErrorState } from "../components/ip/ErrorState";
import { LoadingState } from "../components/ip/LoadingState";
import api from "../services/api";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  ipAsignada?: string;
  latitud?: string;
  longitud?: string;
};

export default function Customers() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const load = () => {
    setLoading(true);
    setError(undefined);
    api
      .get("/customers")
      .then((r) => setRows(r.data))
      .catch((e) => setError(e?.response?.data?.message || "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name) return;
    await api.post("/customers", form);
    setForm({ name: "", phone: "" });
    load();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  return (
    <motion.div
      className="p-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.h1
        className="text-3xl font-bold text-white mb-6"
        variants={itemVariants}
      >
        Clientes
      </motion.h1>

      {loading && <LoadingState message="Cargando clientes..." />}
      {error && (
        <div className="mb-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      )}
      {!loading && !error && rows.length === 0 && (
        <div className="mb-6">
          <EmptyState
            title="Sin clientes"
            description="Crea tu primer cliente para comenzar."
            action={{ label: "Crear cliente", onClick: create }}
          />
        </div>
      )}

      <motion.div
        className="bg-white/10 backdrop-blur-lg rounded-xl shadow-lg shadow-emerald-500/50 border border-slate-300 p-4 mb-6 grid md:grid-cols-3 gap-4"
        variants={itemVariants}
      >
        <input
          className="bg-transparent border-b border-emerald-400 text-white placeholder-gray-300 focus:outline-none focus:border-emerald-300"
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className="bg-transparent border-b border-emerald-400 text-white placeholder-gray-300 focus:outline-none focus:border-emerald-300"
          placeholder="Teléfono"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <motion.button
          onClick={create}
          className="bg-emerald-500 text-white rounded-lg px-4 py-2 hover:bg-emerald-600 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Crear
        </motion.button>
      </motion.div>

      <motion.div
        className="bg-white/10 backdrop-blur-lg rounded-xl shadow-lg shadow-emerald-500/50 border border-slate-300 overflow-x-auto"
        variants={itemVariants}
      >
        <table className="min-w-full text-sm text-white">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <motion.tr
                key={c.id}
                className="border-t border-slate-300/20"
                variants={itemVariants}
                initial="hidden"
                animate="visible"
              >
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3">{c.phone}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}
