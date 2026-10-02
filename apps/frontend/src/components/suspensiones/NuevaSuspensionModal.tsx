import { Search, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listCustomers, type CustomerDto } from "../../services/clientes";
import {
  crearSuspension,
  errorMsg,
  hoyISO,
  type CrearSuspensionInput,
  type Suspension,
} from "../../services/suspensiones";
import Modal, { inputCls, labelCls } from "./Modal";

type Props = { open: boolean; onClose: () => void; onCreated: (s: Suspension) => void };

const vacio = (): CrearSuspensionInput => ({
  clienteNombre: "",
  clienteTelefono: "",
  clienteDireccion: "",
  clienteIp: "",
  clientePlan: "",
  clienteLatitud: "",
  clienteLongitud: "",
  clienteOrigenId: "",
  fechaSuspension: hoyISO(),
  montoAdeudado: 0,
});

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Alta de una suspensión (sólo ADMIN). Los datos del cliente se COPIAN desde el
 * módulo Clientes (o se escriben a mano): después ya no dependen de él.
 */
export default function NuevaSuspensionModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<CrearSuspensionInput>(vacio);
  const [clientes, setClientes] = useState<CustomerDto[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(vacio());
    setBusqueda("");
    if (!clientes) {
      listCustomers()
        .then(setClientes)
        .catch(() => setClientes([]));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sugerencias = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (q.length < 2 || !clientes) return [];
    return clientes
      .filter((c) =>
        normalizar(`${c.nombreCompleto} ${c.telefono ?? ""} ${c.ipAsignada ?? ""} ${c.direccion ?? ""}`).includes(q)
      )
      .slice(0, 8);
  }, [busqueda, clientes]);

  const elegir = (c: CustomerDto) => {
    setForm((f) => ({
      ...f,
      clienteNombre: c.nombreCompleto ?? "",
      clienteTelefono: c.telefono ?? "",
      clienteDireccion: c.direccion ?? "",
      clienteIp: c.ipAsignada ?? "",
      clientePlan: c.plan?.name ?? c.planDeInternet ?? "",
      clienteLatitud: c.latitud ?? "",
      clienteLongitud: c.longitud ?? "",
      clienteOrigenId: c.id,
    }));
    setBusqueda("");
  };

  const set = (patch: Partial<CrearSuspensionInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    if (!form.clienteNombre.trim()) return toast.error("Escribe el nombre del cliente");
    if (!form.fechaSuspension) return toast.error("Indica la fecha de suspensión");
    setSaving(true);
    try {
      const payload: CrearSuspensionInput = {
        ...form,
        montoAdeudado: Number(form.montoAdeudado) || 0,
      };
      for (const k of Object.keys(payload) as (keyof CrearSuspensionInput)[]) {
        if (payload[k] === "") delete payload[k];
      }
      const s = await crearSuspension(payload);
      toast.success("Suspensión creada; se avisó al supervisor");
      onCreated(s);
    } catch (err) {
      toast.error(errorMsg(err, "No se pudo crear la suspensión"));
    } finally {
      setSaving(false);
    }
  };

  const campo = (key: keyof CrearSuspensionInput, label: string, extra?: { span?: boolean; placeholder?: string }) => (
    <div className={extra?.span ? "sm:col-span-2" : ""}>
      <label className={labelCls} htmlFor={`ns-${key}`}>
        {label}
      </label>
      <input
        id={`ns-${key}`}
        className={inputCls}
        value={(form[key] as string) ?? ""}
        placeholder={extra?.placeholder}
        onChange={(e) => set({ [key]: e.target.value } as Partial<CrearSuspensionInput>)}
      />
    </div>
  );

  return (
    <Modal
      open={open}
      title="Nueva suspensión"
      subtitle="Se avisa al supervisor. Los datos del cliente quedan copiados aquí."
      onClose={onClose}
      onSubmit={submit}
      busy={saving}
      submitLabel="Crear suspensión"
      size="lg"
    >
      <div className="space-y-5">
        <div className="relative">
          <label className={labelCls}>Buscar en Clientes (para copiar sus datos)</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
            <input
              className={`${inputCls} pl-10`}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder={clientes === null ? "Cargando clientes…" : "Nombre, teléfono, IP o dirección"}
            />
          </div>
          {sugerencias.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
              {sugerencias.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => elegir(c)}
                    className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                  >
                    <span className="text-sm font-semibold text-slate-800">{c.nombreCompleto}</span>
                    <span className="text-xs text-slate-500">
                      {[c.telefono, c.ipAsignada, c.direccion].filter(Boolean).join(" · ") || "Sin datos extra"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {form.clienteOrigenId && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
              <UserCheck className="h-3.5 w-3.5" /> Datos copiados del módulo Clientes. Puedes ajustarlos.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {campo("clienteNombre", "Nombre del cliente *", { span: true })}
          {campo("clienteTelefono", "Teléfono")}
          {campo("clienteIp", "IP asignada")}
          {campo("clienteDireccion", "Dirección", { span: true })}
          {campo("clientePlan", "Plan")}
          <div className="grid grid-cols-2 gap-2">
            {campo("clienteLatitud", "Latitud")}
            {campo("clienteLongitud", "Longitud")}
          </div>
          <div>
            <label className={labelCls} htmlFor="ns-fecha">
              Fecha de suspensión *
            </label>
            <input
              id="ns-fecha"
              type="date"
              className={inputCls}
              value={form.fechaSuspension}
              onChange={(e) => set({ fechaSuspension: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="ns-monto">
              Cuánto quedó debiendo (Q) *
            </label>
            <input
              id="ns-monto"
              type="number"
              min={0}
              step="0.01"
              className={inputCls}
              value={Number.isNaN(form.montoAdeudado) ? "" : form.montoAdeudado}
              onChange={(e) => set({ montoAdeudado: e.target.value === "" ? 0 : Number(e.target.value) })}
            />
          </div>
        </div>

      </div>
    </Modal>
  );
}
