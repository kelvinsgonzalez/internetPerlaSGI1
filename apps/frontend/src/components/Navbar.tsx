import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const logoSrc = "/perla-logo.svg";

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const userRoleLinks = (isMobile: boolean) => {
    const linkClasses = isMobile
      ? "block py-2 px-3 rounded-lg border border-transparent hover:bg-white/10 hover:border-emerald-400/30 hover:shadow-[0_0_0_2px_rgba(16,185,129,0.25),0_0_12px_rgba(16,185,129,0.25)] transition"
      : "rounded-lg px-2 py-1 text-white/80 hover:text-white border border-transparent hover:border-emerald-400/30 hover:shadow-[0_0_0_2px_rgba(16,185,129,0.25),0_0_10px_rgba(16,185,129,0.25)] transition";

    if (user?.role === "ADMIN") {
      return (
        <>
          <Link to="/workers" className={linkClasses} onClick={handleLinkClick}>
            Trabajadores
          </Link>
          <Link to="/attendance" className={linkClasses} onClick={handleLinkClick}>
            Asistencia
          </Link>
          <Link to="/inventory" className={linkClasses} onClick={handleLinkClick}>
            Inventario
          </Link>
          <Link to="/finanzas" className={linkClasses} onClick={handleLinkClick}>
            Finanzas
          </Link>
          <Link to="/tasks-admin" className={linkClasses} onClick={handleLinkClick}>
            Tareas
          </Link>
          <Link to="/messages" className={linkClasses} onClick={handleLinkClick}>
            Mensajes
          </Link>
        </>
      );
    }

    if (user?.role === "USER") {
      return (
        <>
          <Link to="/my-tasks" className={linkClasses} onClick={handleLinkClick}>
            Mis Tareas
          </Link>
          <Link to="/inventory" className={linkClasses} onClick={handleLinkClick}>
            Inventario
          </Link>
          <Link to="/messages" className={linkClasses} onClick={handleLinkClick}>
            Mensajes
          </Link>
          <Link to="/finance" className={linkClasses} onClick={handleLinkClick}>
            Finanzas
          </Link>
        </>
      );
    }

    return null;
  };

  return (
    <>
      <header className="brand-gradient sticky top-0 z-30 shadow text-white">
        <div className="flex items-center justify-between p-4">
          <Link to="/" className="group flex items-center gap-2 font-bold transition hover:opacity-90">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <span className="absolute inset-0 rounded-2xl bg-emerald-200/30 blur-sm" />
              <span className="absolute inset-0 rounded-2xl border border-emerald-400/50" />
              <span
                className="absolute -inset-1 rounded-3xl border border-emerald-400/30 animate-ping"
                style={{ animationDuration: "3s" }}
              />
              <span
                className="absolute -inset-2.5 rounded-[1.75rem] border border-emerald-300/20 animate-ping"
                style={{ animationDuration: "4.5s" }}
              />
              <img src={logoSrc} alt="Internet Perla" className="relative z-10 h-7 w-7 object-contain" />
            </span>
            <span className="leading-tight">Internet Perla</span>
          </Link>

          <nav className="hidden items-center gap-4 text-sm md:flex">
            {userRoleLinks(false)}
            <Link to="/profile" className="text-white/80 hover:text-white">
              Perfil
            </Link>
            <span className="text-white/80">{user?.email}</span>
            <button onClick={logout} className="text-red-100 transition hover:text-white">
              Salir
            </button>
          </nav>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-white">
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            onClick={() => setIsOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.nav
            className="fixed top-0 left-0 z-50 h-full w-4/5 max-w-sm bg-[#0a2a06] p-6 text-white md:hidden"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="flex h-full flex-col gap-4 text-base">
              <div className="mb-4 border-b pb-4">
                <span className="text-lg font-bold">Menú</span>
              </div>
              {userRoleLinks(true)}
              <Link to="/profile" className="block rounded py-2 px-3 hover:bg-white/10" onClick={handleLinkClick}>
                Perfil
              </Link>
              <div className="mt-auto border-t pt-4">
                <div className="mb-2 text-sm text-gray-400">{user?.email}</div>
                <button
                  onClick={() => {
                    logout();
                    handleLinkClick();
                  }}
                  className="block w-full rounded py-2 px-3 text-left text-red-300 hover:bg-red-500/20"
                >
                  Salir
                </button>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
