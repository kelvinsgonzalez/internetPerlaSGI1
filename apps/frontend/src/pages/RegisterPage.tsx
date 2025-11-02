import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage(){
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const { register } = useAuth();
  const nav = useNavigate();
  const submit = async (e:React.FormEvent)=>{ e.preventDefault(); try{ await register(name,email,password); nav('/'); } catch(err:any){ setError(err?.response?.data?.message||'Error'); } };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form onSubmit={submit} className="bg-white p-6 rounded shadow w-full max-w-sm">
        <h1 className="text-2xl font-bold text-primary mb-4">Registro</h1>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <label className="text-sm">Nombre</label>
        <input className="w-full border rounded px-3 py-2 mb-3" value={name} onChange={e=>setName(e.target.value)} />
        <label className="text-sm">Correo</label>
        <input className="w-full border rounded px-3 py-2 mb-3" value={email} onChange={e=>setEmail(e.target.value)} />
        <label className="text-sm">Contraseña</label>
        <input type="password" className="w-full border rounded px-3 py-2 mb-4" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="w-full bg-primary text-white py-2 rounded">Crear cuenta</button>
        <div className="text-xs text-gray-600 mt-3">¿Ya tienes cuenta? <Link to="/login" className="text-primary">Ingresa</Link></div>
      </form>
    </div>
  );
}

