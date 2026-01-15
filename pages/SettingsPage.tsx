
import React, { useState } from 'react';
import { useAuth } from '../App.tsx';
import { db } from '../services/db.ts';

const SettingsPage: React.FC = () => {
  const { authState, logout } = useAuth();
  const user = authState.user;

  const [name, setName] = useState(user?.fullName || '');
  const [password, setPassword] = useState(user?.password || '');
  const [photoUrl, setPhotoUrl] = useState(user?.profilePhoto || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    setMessage(null);
    try {
      await db.updateUser(user.id, { 
        fullName: name, 
        password: password,
        profilePhoto: photoUrl
      });
      setMessage({ text: 'Profile updated successfully!', type: 'success' });
      // Note: In a production app, you'd trigger a context refresh here
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const generateRandomAvatar = () => {
    const seed = Math.random().toString(36).substring(7);
    setPhotoUrl(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
  };

  const inputStyle = "w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all";
  const labelStyle = "text-[10px] font-black text-slate-400 uppercase mb-1.5 block tracking-widest ml-1";

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      <div className="bg-blue-600 text-white pt-12 pb-24 px-6 relative shrink-0">
        <h1 className="text-2xl font-black tracking-tight">Profile Settings</h1>
        <p className="text-blue-100 text-xs font-bold uppercase tracking-widest opacity-80">Manage your business identity</p>
      </div>

      <div className="px-6 -mt-16 flex-1 pb-32">
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 p-8 border border-slate-100">
          <div className="flex flex-col items-center mb-10">
            <div className="relative group">
              <div className="w-28 h-28 rounded-[2rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden mb-4">
                <img 
                  src={photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} 
                  alt="Avatar Preview" 
                  className="w-full h-full object-cover"
                />
              </div>
              <button 
                type="button"
                onClick={generateRandomAvatar}
                className="absolute -bottom-1 -right-1 w-10 h-10 bg-blue-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:bg-blue-700 active:scale-90 transition-all border-4 border-white"
                title="Generate New Avatar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
            <div className="text-center">
              <h2 className="font-black text-slate-900 text-lg leading-none mb-1">{name || 'Your Name'}</h2>
              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full tracking-widest">{user?.role}</span>
            </div>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
              {message.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              )}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className={labelStyle}>Full Name</label>
              {/* Fixed: Access value from e.target.value */}
              <input 
                type="text" 
                className={inputStyle} 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </div>

            <div>
              <label className={labelStyle}>Phone (Unique ID)</label>
              <input 
                type="tel" 
                className={`${inputStyle} opacity-50 cursor-not-allowed`} 
                value={user?.phone} 
                readOnly 
              />
            </div>

            <div>
              <label className={labelStyle}>Account Password</label>
              {/* Fixed: Access value from e.target.value */}
              <input 
                type="password" 
                className={inputStyle} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>

            <button 
              type="submit" 
              disabled={saving}
              className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-blue-100 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
            >
              {saving ? 'Updating...' : 'Save Changes'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 flex flex-col items-center">
            <button 
              onClick={logout}
              className="text-rose-500 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-rose-50 px-6 py-3 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out Securely
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
