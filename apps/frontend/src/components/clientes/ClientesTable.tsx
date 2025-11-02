import { useMemo } from "react";
import type { CustomerDto } from "../../services/clientes";

interface Props {
  rows: CustomerDto[];
  onEdit: (c: CustomerDto) => void;
  onDelete: (c: CustomerDto) => void;
  query: string;
  onQueryChange: (v: string) => void;
}

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

export default function ClientesTable({
  rows,
  onEdit,
  onDelete,
  query,
  onQueryChange,
}: Props) {
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as CustomerDto[];
    const filtered = rows.filter(
      (r) =>
        (r.nombreCompleto || "").toLowerCase().includes(q) ||
        (r.direccion || "").toLowerCase().includes(q)
    );
    return filtered.slice(0, 3);
  }, [rows, query]);

  return (
    <div className={`${glassCard} rounded-2xl overflow-hidden`}>
      <div className="p-4 border-b border-black/10 flex items-center gap-4">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full md:w-80 bg-white/50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          placeholder="Buscar por nombre o dirección..."
        />
        {query && suggestions.length > 0 && (
          <div className="text-xs text-slate-500">
            Sugerencias: {suggestions.map((s) => s.nombreCompleto).join(", ")}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-slate-800">
            <thead className="bg-black/5">
                <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Dirección IP</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Teléfono</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Dirección</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Latitud</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Longitud</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Plan</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Estado</th>
                    <th className="px-4 py-3"></th>
                </tr>
            </thead>
            <tbody>
            {rows.map((c) => (
                <tr key={c.id} className="border-t border-black/5">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{c.ipAsignada || "-"}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{c.nombreCompleto}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{c.telefono || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{c.direccion || "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{c.latitud || "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{c.longitud || "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{c.plan?.name || "-"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{c.estadoCliente || "-"}</td>
                <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                    <button
                        onClick={() => onEdit(c)}
                        className="px-3 py-1 rounded-md bg-emerald-500 text-white text-xs hover:bg-emerald-600 transition-colors shadow"
                    >
                        Editar
                    </button>
                    <button
                        onClick={() => onDelete(c)}
                        className="px-3 py-1 rounded-md bg-rose-500 text-white text-xs hover:bg-rose-600 transition-colors shadow"
                    >
                        Borrar
                    </button>
                    </div>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
