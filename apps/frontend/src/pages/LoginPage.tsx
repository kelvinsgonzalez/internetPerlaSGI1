import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader, Eye, EyeOff, Wifi } from 'lucide-react';

export default function LoginPage(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState<boolean|undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/health');
        setApiOk(data?.status === 'ok');
      } catch (e: any) {
        console.error('API health failed', e?.message);
        setApiOk(false);
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Por favor completa todos los campos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      nav('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error de conexión';
      console.error('Login error:', err);
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.23, 1, 0.320, 1] }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: index * 0.1, duration: 0.4 }
    })
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.3 } },
    blur: { scale: 1, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Animated background elements - Jade Green */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-bl from-green-700/15 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-green-800/15 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>

      <motion.div
        className="w-full max-w-md z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Card Container */}
        <div className="relative">
          {/* Glow effect - Jade Green */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-700/25 to-green-800/25 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          {/* Main Card */}
          <motion.form
            onSubmit={submit}
            className="relative bg-gradient-to-br from-gray-800 to-gray-900 p-8 rounded-2xl shadow-2xl border border-gray-700/50 backdrop-blur-xl"
            whileHover={{ borderColor: 'rgba(15, 61, 1, 0.5)' }}
          >
            {/* Header */}
            <motion.div
              className="text-center mb-8"
              custom={0}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                className="flex justify-center mb-6"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Wifi className="w-16 h-16 text-green-600" strokeWidth={1.5} />
              </motion.div>
              <h1 className="text-4xl font-bold text-white mb-1" style={{ letterSpacing: '0.05em' }}>
                INTERNET PERLA
              </h1>
              <p className="text-sm text-green-400 font-semibold">Conecta con tu cuenta</p>
            </motion.div>

            {/* API Status */}
            {apiOk === false && (
              <motion.div
                className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg mb-4 text-sm"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                ⚠️ No hay conexión con la API
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm flex items-start gap-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <span className="mt-0.5">✕</span>
                <span>{error}</span>
              </motion.div>
            )}

            {/* Email Input */}
            <motion.div
              className="mb-6"
              custom={1}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                className="relative group"
                variants={inputVariants}
                animate={emailFocus ? 'focus' : 'blur'}
              >
                <div className="relative flex items-center bg-gray-700/50 rounded-xl px-4 py-3 border-2 border-gray-600 transition-all duration-300 group-focus-within:border-green-600 group-focus-within:bg-gray-700/80 group-focus-within:shadow-lg group-focus-within:shadow-green-700/30">
                  <Mail className="w-5 h-5 text-gray-400 group-focus-within:text-green-500 transition-colors mr-3" />
                  <input
                    type="email"
                    placeholder="Ingresa tu correo"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocus(true)}
                    onBlur={() => setEmailFocus(false)}
                    className="w-full bg-transparent text-white placeholder-gray-500 outline-none text-sm"
                  />
                </div>
              </motion.div>
            </motion.div>

            {/* Password Input */}
            <motion.div
              className="mb-6"
              custom={2}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                className="relative group"
                variants={inputVariants}
                animate={passwordFocus ? 'focus' : 'blur'}
              >
                <div className="relative flex items-center bg-gray-700/50 rounded-xl px-4 py-3 border-2 border-gray-600 transition-all duration-300 group-focus-within:border-green-600 group-focus-within:bg-gray-700/80 group-focus-within:shadow-lg group-focus-within:shadow-green-700/30">
                  <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-green-500 transition-colors mr-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Ingresa tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocus(true)}
                    onBlur={() => setPasswordFocus(false)}
                    className="w-full bg-transparent text-white placeholder-gray-500 outline-none text-sm"
                  />
                  <motion.button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="ml-2 text-gray-400 hover:text-gray-200 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-700 to-green-600 text-white font-semibold py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-green-700/50 disabled:opacity-60 disabled:cursor-not-allowed mb-6"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              custom={3}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Ingresando...</span>
                </>
              ) : (
                <span>Ingresar</span>
              )}
            </motion.button>

            {/* Footer */}
            <motion.div
              className="text-center text-sm"
              custom={4}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <p className="text-gray-400">© Ingenieros UMG. Todos los derechos reservados.</p>
            </motion.div>

            {/* Bottom accent */}
            <motion.div
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-green-600 to-transparent rounded-full"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            ></motion.div>
          </motion.form>
        </div>
      </motion.div>
    </div>
  );
}
