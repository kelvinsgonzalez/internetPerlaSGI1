import { motion } from "framer-motion";
import { Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  createRelease,
  deleteRelease,
  listAllReleases,
  releaseLines,
  updateRelease,
  type AppRelease,
  type ReleaseInput,
} from "../services/releases";
import { ROLE_LABEL, type Role } from "../services/roles";

const glassCard =
  "backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30";

const fieldCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400";

const ALL_ROLES: Role[] = ["ADMIN", "SUPERVISOR", "USER"];

const emptyForm: ReleaseInput = { version: "", title: "", notes: "", audience: [] };

/** Sugiere la siguiente versión menor a partir de la última publicada. */
const nextVersion = (latest?: string) => {
  const parts = (latest || "1.0.0").split(/[.-]/).map((n) => Number.parseInt(n, 10) || 0);
  const [major = 1, minor = 0] = parts;
  return `${major}.${minor + 1}.0`;
};

/** Valor para <input type="datetime-local"> en hora local. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export default function ReleasesAdmin() {
  const [releases, setReleases] = useState<AppRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ReleaseInput>(emptyForm);
  const [publishAt, setPublishAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReleases(await listAllReleases());
    } catch {
      toast.error("No se pudieron cargar las versiones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setEditingId(null);
    setForm({ ...emptyForm, version: nextVersion(releases[0]?.version) });
    setPublishAt("");
  };

  const startEdit = (r: AppRelease) => {
    setEditingId(r.id);
    setForm({ version: r.version, title: r.title, notes: r.notes, audience: r.audience ?? [] });
    setPublishAt(toLocalInput(r.publishedAt));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleRole = (role: Role) =>
    setForm((f) => ({
      ...f,
      audience: f.audience.includes(role)
        ? f.audience.filter((r) => r !== role)
        : [...f.audience, role],
    }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: ReleaseInput = {
      ...form,
      publishedAt: publishAt ? new Date(publishAt).toISOString() : undefined,
    };
    try {
      if (editingId) {
        await updateRelease(editingId, payload);
        toast.success(`Versión ${form.version} actualizada`);
      } else {
        await createRelease(payload);
        toast.success(`Versión ${form.version} publicada`);
      }
      await load();
      setEditingId(null);
      setForm(emptyForm);
      setPublishAt("");
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  // Tras cargar o publicar, el formulario vacío propone la siguiente versión.
  useEffect(() => {
    if (!editingId && !form.version && !loading) {
      setForm((f) => ({ ...f, version: nextVersion(releases[0]?.version) }));
    }
  }, [releases, editingId, form.version, loading]);

  const onDelete = async (r: AppRelease) => {
    if (!window.confirm(`¿Eliminar la versión ${r.version}? Los usuarios dejarán de verla.`)) return;
    try {
      await deleteRelease(r.id);
      toast.success("Versión eliminada");
      if (editingId === r.id) reset();
      load();
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  const preview = releaseLines(form.notes);
  const now = Date.now();

  return (
    <div className="relative min-h-screen flex-col overflow-hidden px-3 py-6 sm:px-6 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.25),_transparent_55%),_radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.25),_transparent_60%)]" />

      <div className="relative z-10 flex flex-1 flex-col gap-6">
        <header>
          <motion.h1
            className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Versiones y novedades
          </motion.h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Publica qué cambió en cada versión. Cada usuario verá el aviso de
            Novedades al entrar hasta que lo marque como leído.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <form onSubmit={onSubmit} className={`${glassCard} flex flex-col gap-3 rounded-3xl p-5`}>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              {editingId ? <Pencil size={18} /> : <Plus size={18} />}
              {editingId ? "Editar versión" : "Nueva versión"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
              <label className="text-xs font-semibold text-slate-600">
                Versión
                <input
                  required
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                  placeholder="1.2.0"
                  className={`${fieldCls} mt-1`}
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Título
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Mejoras en Finanzas"
                  className={`${fieldCls} mt-1`}
                />
              </label>
            </div>
            <label className="text-xs font-semibold text-slate-600">
              Cambios (uno por línea)
              <textarea
                required
                minLength={3}
                rows={7}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={"Nuevo reporte de cortes de caja\nCorregido el cálculo de planilla"}
                className={`${fieldCls} mt-1 font-normal`}
              />
            </label>
            <fieldset className="text-xs font-semibold text-slate-600">
              <legend>Visible para</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {ALL_ROLES.map((role) => {
                  const active = form.audience.includes(role);
                  return (
                    <button
                      type="button"
                      key={role}
                      onClick={() => toggleRole(role)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {ROLE_LABEL[role]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 font-normal text-slate-500">
                {form.audience.length === 0 ? "Sin selección: la ven todos los usuarios." : "Sólo los roles marcados la verán."}
              </p>
            </fieldset>
            <label className="text-xs font-semibold text-slate-600">
              Publicar el (opcional)
              <input
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                className={`${fieldCls} mt-1`}
              />
              <span className="mt-1 block font-normal text-slate-500">
                Vacío = publicar ahora. Una fecha futura la deja programada.
              </span>
            </label>
            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <Rocket size={16} />
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Publicar versión"}
              </button>
              {editingId && (
                <button type="button" onClick={reset} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
              )}
            </div>
            {preview.length > 0 && (
              <div className="mt-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Vista previa</p>
                <p className="mt-1 font-semibold text-slate-900">
                  v{form.version.replace(/^v/i, "")} · {form.title || "Sin título"}
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                  {preview.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </div>
            )}
          </form>

          <section className={`${glassCard} rounded-3xl p-5`}>
            <h2 className="text-lg font-bold text-slate-900">Publicadas</h2>
            {loading && <p className="mt-4 text-sm text-slate-500">Cargando…</p>}
            {!loading && releases.length === 0 && (
              <p className="mt-4 text-sm text-slate-500">Aún no hay versiones.</p>
            )}
            <ol className="mt-3 space-y-3">
              {releases.map((r) => {
                const scheduled = new Date(r.publishedAt).getTime() > now;
                return (
                  <li key={r.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">v{r.version}</span>
                      {scheduled && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-800">Programada</span>
                      )}
                      <span className="text-xs text-slate-400">{new Date(r.publishedAt).toLocaleString()}</span>
                      <div className="ml-auto flex gap-1">
                        <button onClick={() => startEdit(r)} aria-label={`Editar ${r.version}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => onDelete(r)} aria-label={`Eliminar ${r.version}`} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 font-semibold text-slate-900">{r.title}</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                      {releaseLines(r.notes).map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                    <p className="mt-2 text-xs text-slate-400">
                      {r.audience?.length ? `Para: ${r.audience.map((a) => ROLE_LABEL[a]).join(", ")}` : "Para: todos"}
                      {r.createdBy ? ` · por ${r.createdBy}` : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
