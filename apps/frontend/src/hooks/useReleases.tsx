import { AnimatePresence, motion } from "framer-motion";
import { Gift, Sparkles, X } from "lucide-react";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  getMyReleases,
  markReleasesSeen,
  releaseLines,
  type AppRelease,
} from "../services/releases";
import { useAuth } from "./useAuth";
import { useSocket } from "./useSocket";

type ReleasesContextType = {
  unreadCount: number;
  latestVersion: string | null;
  open: () => void;
};

const ReleasesContext = createContext<ReleasesContextType>({
  unreadCount: 0,
  latestVersion: null,
  open: () => {},
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * Montado una sola vez (en el router) para que el aviso automático no se abra
 * por duplicado: AdminShell pinta su barra lateral y su cabecera móvil a la vez.
 * Al entrar, si hay versiones sin leer, se abre el panel de Novedades; al
 * cerrarlo quedan marcadas como leídas para ese usuario.
 */
export function ReleasesProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState<AppRelease[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const autoOpened = useRef(false);

  const load = useCallback(
    async (autoOpen: boolean) => {
      if (!user) return;
      try {
        const data = await getMyReleases();
        setItems(data.items);
        setUnreadCount(data.unreadCount);
        setLatestVersion(data.latestVersion);
        if (autoOpen && data.unreadCount > 0) setIsOpen(true);
      } catch {
        /* sin novedades disponibles: no se interrumpe al usuario */
      }
    },
    [user]
  );

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnreadCount(0);
      autoOpened.current = false;
      return;
    }
    load(!autoOpened.current);
    autoOpened.current = true;
  }, [user?.sub, load]);

  useEffect(() => {
    if (!socket) return;
    const onPublished = () => load(true);
    socket.on("release:published", onPublished);
    return () => {
      socket.off("release:published", onPublished);
    };
  }, [socket, load]);

  const close = useCallback(() => {
    setIsOpen(false);
    if (unreadCount > 0) {
      setUnreadCount(0);
      setItems((prev) => prev.map((r) => ({ ...r, unread: false })));
      markReleasesSeen().catch(() => {});
    }
  }, [unreadCount]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const value = useMemo(
    () => ({ unreadCount, latestVersion, open: () => setIsOpen(true) }),
    [unreadCount, latestVersion]
  );

  const modal = (
    <AnimatePresence>
      {isOpen && user && (
        <motion.div
          className="fixed inset-0 z-[100000] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          onClick={close}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="releases-title"
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <div className="brand-gradient flex items-start justify-between gap-3 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h2 id="releases-title" className="text-lg font-bold leading-tight">
                    Novedades
                  </h2>
                  <p className="text-xs text-emerald-100">
                    {latestVersion
                      ? `Versión actual ${latestVersion}`
                      : "Aún no hay versiones publicadas"}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500">
                  Cuando se publique una nueva versión la verás aquí.
                </p>
              )}
              <ol className="space-y-4">
                {items.map((r) => (
                  <li
                    key={r.id}
                    className={`rounded-2xl border p-4 ${
                      r.unread
                        ? "border-emerald-300 bg-emerald-50/70"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                        v{r.version}
                      </span>
                      {r.unread && (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                          Nuevo
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-400">
                        {formatDate(r.publishedAt)}
                      </span>
                    </div>
                    <h3 className="mt-2 font-semibold text-slate-900">{r.title}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {releaseLines(r.notes).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-slate-100 px-5 py-3">
              <button
                onClick={close}
                className="w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <ReleasesContext.Provider value={value}>
      {children}
      {typeof document !== "undefined" ? createPortal(modal, document.body) : modal}
    </ReleasesContext.Provider>
  );
}

export const useReleases = () => useContext(ReleasesContext);

/** Botón con ícono de regalo y contador de novedades sin leer. */
export function ReleasesButton({ variant = "icon" }: { variant?: "icon" | "menu" }) {
  const { unreadCount, latestVersion, open } = useReleases();
  const badge =
    unreadCount > 0 ? (
      <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
        {unreadCount}
      </span>
    ) : null;

  if (variant === "menu") {
    return (
      <button
        onClick={open}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <span className="rounded-lg bg-white/10 p-2">
          <Gift size={16} />
        </span>
        <span className="font-medium">Novedades</span>
        {latestVersion && !badge && (
          <span className="ml-auto text-xs text-white/50">v{latestVersion}</span>
        )}
        {badge && <span className="ml-auto">{badge}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={open}
      aria-label={unreadCount > 0 ? `Novedades (${unreadCount} sin leer)` : "Novedades"}
      title="Novedades"
      className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
    >
      <Gift size={18} />
      {badge && <span className="absolute -right-1 -top-1">{badge}</span>}
    </button>
  );
}
