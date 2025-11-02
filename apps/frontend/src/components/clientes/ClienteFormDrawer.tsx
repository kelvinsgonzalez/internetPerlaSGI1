import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type {
  CreateCustomerInput,
  CustomerDto,
  InternetPlan,
} from "../../services/clientes";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCustomerInput, editingId?: string) => Promise<void>;
  plans: InternetPlan[];
  editing?: CustomerDto | null;
}

export default function ClienteFormDrawer({
  open,
  onClose,
  onSubmit,
  plans,
  editing,
}: Props) {
  const [name, setName] = useState("");
  const [ipAsignada, setIpAsignada] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("active");
  const [planId, setPlanId] = useState<string>("");
  const [planName, setPlanName] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.nombreCompleto || "");
      setIpAsignada(editing.ipAsignada || "");
      setAddress(editing.direccion || "");
      setStatus(editing.estadoCliente || "active");
      setPlanId(editing.plan?.id || "");
      setPlanName(editing.plan?.name || editing.planDeInternet || "");
      setPhone(editing.telefono || "");
      setLatitud(editing.latitud || "");
      setLongitud(editing.longitud || "");
      setNotes(editing.notas || "");
    } else {
      setName("");
      setIpAsignada("");
      setAddress("");
      setStatus("active");
      setPlanId("");
      setPlanName("");
      setPhone("");
      setLatitud("");
      setLongitud("");
      setNotes("");
    }
    setErrors(null);
  }, [editing, open]);

  const handleSubmit = async () => {
    setErrors(null);
    if (!name.trim()) return setErrors("El nombre completo es requerido.");
    if (!address.trim()) return setErrors("La dirección es requerida.");
    if (!status.trim()) return setErrors("El estado del cliente es requerido.");
    if (!planId && !planName.trim())
      return setErrors(
        "El plan de internet es requerido (elige uno o escribe un nombre)."
      );
    if (latitud && !/^[-+]?\d+(\.\d{1,6})?$/.test(latitud))
      return setErrors(
        "Latitud debe ser un número decimal con hasta 6 decimales."
      );
    if (longitud && !/^[-+]?\d+(\.\d{1,6})?$/.test(longitud))
      return setErrors(
        "Longitud debe ser un número decimal con hasta 6 decimales."
      );

    const payload: CreateCustomerInput = {
      nombreCompleto: name.trim(),
      ipAsignada: ipAsignada.trim() || undefined,
      direccion: address.trim(),
      estadoCliente: status.trim(),
      telefono: phone.trim() || undefined,
      latitud: latitud.trim() || undefined,
      longitud: longitud.trim() || undefined,
      notas: notes.trim() || undefined,
    };
    if (planId) payload.planId = planId;
    else payload.planDeInternet = planName.trim();

    setSubmitting(true);
    try {
      await onSubmit(payload, editing?.id);
      onClose();
    } catch (e: any) {
      setErrors(e?.response?.data?.message || "Error al guardar el cliente");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-slate-800/80 backdrop-blur-lg border-l border-slate-700 shadow-2xl shadow-emerald-500/20 text-white"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-6">
              <h3 className="text-2xl font-semibold text-emerald-400">
                {editing ? "Editar Cliente" : "Nuevo Cliente"}
              </h3>
              <motion.button
                onClick={onClose}
                className="text-slate-400 hover:text-white"
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              >
                Cerrar
              </motion.button>
            </div>
            <div className="p-6 space-y-4">
              {errors && (
                <div className="rounded-lg bg-rose-500/20 p-3 text-sm text-rose-300 border border-rose-500/30">
                  {errors}
                </div>
              )}
              
              <Input label="Dirección IP" value={ipAsignada} onChange={setIpAsignada} />
              <Input label="Nombre completo" value={name} onChange={setName} />
              <Input label="Teléfono" value={phone} onChange={setPhone} />
              <Input label="Dirección" value={address} onChange={setAddress} />

              <div>
                <label className="text-sm text-slate-400">Estado del cliente</label>
                <Select value={status} onChange={setStatus}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="suspended">Suspendido</option>
                </Select>
              </div>

              <div>
                <label className="text-sm text-slate-400">Plan de internet</label>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <Select
                    value={planId}
                    onChange={(value) => {
                      setPlanId(value);
                      if (value) setPlanName("");
                    }}
                  >
                    <option value="">-- Seleccionar --</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <Input 
                    placeholder="o escribir nombre de plan"
                    value={planName} 
                    onChange={(value) => {
                        setPlanName(value);
                        if (value) setPlanId("");
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Elige un plan existente o escribe un nombre para crear uno nuevo.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Latitud" placeholder="0.000000" value={latitud} onChange={setLatitud} />
                <Input label="Longitud" placeholder="0.000000" value={longitud} onChange={setLongitud} />
              </div>

              <div>
                <label className="text-sm text-slate-400">Notas</label>
                <textarea
                  className="mt-1 w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-700 p-6 mt-4">
              <motion.button
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
                onClick={onClose}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              >
                Cancelar
              </motion.button>
              <motion.button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-all"
                onClick={handleSubmit}
                disabled={submitting}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              >
                {submitting
                  ? "Guardando..."
                  : editing
                  ? "Guardar Cambios"
                  : "Crear Cliente"}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Helper components for consistent styling
const Input = ({ label, value, onChange, ...props }: { label?: string, value: string, onChange: (v:string)=>void, [key:string]: any}) => (
    <div>
        {label && <label className="text-sm text-slate-400">{label}</label>}
        <input
            className="mt-1 w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...props}
        />
    </div>
);

const Select = ({ label, value, onChange, children }: { label?: string, value: string, onChange: (v:string)=>void, children: React.ReactNode}) => (
    <div>
        {label && <label className="text-sm text-slate-400">{label}</label>}
        <select
            className="mt-1 w-full bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {children}
        </select>
    </div>
);
