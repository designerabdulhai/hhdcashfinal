
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App.tsx';
import { db } from '../services/db.ts';

type AuthMode = 'STAFF' | 'ADMIN' | 'REGISTER';

const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>('STAFF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDatabaseEmpty, setIsDatabaseEmpty] = useState(false);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const users = await db.getUsers();
        if (users.length === 0) {
          setIsDatabaseEmpty(true);
          setAuthMode('REGISTER');
        }
      } catch (err) {}
    };
    checkStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (authMode === 'REGISTER') {
        await register({ fullName: name, phone, password });
      } else {
        await login(phone, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full p-4 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-900 shadow-sm";
  const labelStyle = "text-[11px] uppercase font-bold text-slate-400 mb-1.5 ml-1 block tracking-wider";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl mx-auto flex items-center justify-center font-black text-3xl mb-4 shadow-indigo-200 shadow-lg transform -rotate-3">H</div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {authMode === 'REGISTER' ? 'Get Started' : 'Welcome Back'}
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">HhdCash Pro Cashbook</p>
          </div>

          {!isDatabaseEmpty && (
            <div className="flex bg-slate-100 p-1.5 rounded-xl mb-8 border border-slate-200/50">
              <button 
                type="button"
                onClick={() => setAuthMode('STAFF')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 ${authMode === 'STAFF' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >Staff Access</button>
              <button 
                type="button"
                onClick={() => setAuthMode('ADMIN')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all duration-200 ${authMode === 'ADMIN' ? 'bg-white text-indigo-700 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
              >Owner Portal</button>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-[11px] font-bold rounded-xl border border-rose-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {authMode === 'REGISTER' && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <label className={labelStyle}>Business Owner Name</label>
                <input type="text" className={inputStyle} value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. John Doe" />
              </div>
            )}
            <div className="animate-in fade-in slide-in-from-left-2 duration-300 delay-100">
              <label className={labelStyle}>Mobile Number</label>
              <input type="tel" className={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} required placeholder="01XXX-XXXXXX" />
            </div>
            <div className="animate-in fade-in slide-in-from-left-2 duration-300 delay-150">
              <label className={labelStyle}>Secure Password</label>
              <input type="password" className={inputStyle} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm uppercase tracking-[0.15em] rounded-xl hover:brightness-110 active:scale-[0.97] transition-all disabled:opacity-50 mt-6 shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 border-b-4 border-indigo-800"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                authMode === 'REGISTER' ? 'Create Account' : 'Login'
              )}
            </button>
          </form>

          {!isDatabaseEmpty && (
            <div className="mt-8 text-center pt-6 border-t border-slate-50">
              <button 
                type="button"
                onClick={() => setAuthMode(authMode === 'REGISTER' ? 'STAFF' : 'REGISTER')}
                className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
              >
                {authMode === 'REGISTER' ? 'Back to Login' : 'Setup New Business Account'}
              </button>
            </div>
          )}
        </div>
        
        <p className="text-center mt-6 text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
          Secure • Encrypted • Professional
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
