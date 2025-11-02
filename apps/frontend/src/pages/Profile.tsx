import { motion } from 'framer-motion';
import { User, Mail, Shield } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const glassCard = 'backdrop-blur-xl bg-white/80 shadow-xl shadow-emerald-100/60 border border-white/30';

export default function Profile(){
  const { user } = useAuth();

  const InfoCard = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | undefined }) => (
    <div className="flex items-center gap-4 bg-white/70 p-4 rounded-2xl border border-white/50 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100/80 text-emerald-600">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800">{value || '-'}</p>
      </div>
    </div>
  );

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
            Mi Perfil
          </motion.h1>
          <motion.p
            className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            Aquí puedes ver la información de tu cuenta y tu rol en el sistema.
          </motion.p>
        </header>

        <motion.div 
          className={`${glassCard} rounded-3xl p-6 max-w-2xl`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="space-y-4">
            <InfoCard icon={User} label="Nombre" value={user?.name} />
            <InfoCard icon={Mail} label="Correo Electrónico" value={user?.email} />
            <InfoCard icon={Shield} label="Rol" value={user?.role} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

