
import React, { useState, useEffect, createContext, useContext } from 'react';
import { User, UserRole, AuthState } from './types.ts';
import { db } from './services/db.ts';
import LoginPage from './pages/LoginPage.tsx';
import Dashboard from './pages/Dashboard.tsx';
import CashbookDetail from './pages/CashbookDetail.tsx';
import AdminPage from './pages/AdminPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

interface AuthContextType {
  authState: AuthState;
  login: (phone: string, pass: string) => Promise<void>;
  register: (data: Omit<User, 'id' | 'createdAt' | 'role'>) => Promise<void>;
  logout: () => void;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      const stored = localStorage.getItem('hhd_auth');
      if (stored) {
        try {
          const localUser = JSON.parse(stored);
          const cloudUser = await db.getUserByPhone(localUser.phone);
          if (cloudUser && cloudUser.password === localUser.password) {
            localStorage.setItem('hhd_auth', JSON.stringify(cloudUser));
            setAuthState({
              user: cloudUser,
              isAuthenticated: true,
              isLoading: false
            });
          } else {
            logout();
          }
        } catch (err) {
          setAuthState({ user: JSON.parse(stored), isAuthenticated: true, isLoading: false });
          setIsOnline(false);
        }
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    };
    verifySession();
  }, []);

  const login = async (phone: string, pass: string) => {
    const user = await db.authenticate(phone, pass);
    if (!user) throw new Error("Invalid phone or password.");
    localStorage.setItem('hhd_auth', JSON.stringify(user));
    setAuthState({ user, isAuthenticated: true, isLoading: false });
    setIsOnline(true);
  };

  const register = async (data: Omit<User, 'id' | 'createdAt' | 'role'>) => {
    const user = await db.initializeFirstUser(data);
    localStorage.setItem('hhd_auth', JSON.stringify(user));
    setAuthState({ user, isAuthenticated: true, isLoading: false });
    setIsOnline(true);
  };

  const logout = () => {
    localStorage.removeItem('hhd_auth');
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ authState, login, register, logout, isOnline }}>
      {children}
    </AuthContext.Provider>
  );
};

const BottomNav: React.FC = () => {
  const location = useLocation();
  const { authState } = useAuth();
  const isOwner = authState.user?.role === UserRole.OWNER;
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-t border-slate-200 h-20 flex items-center justify-around fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-[100] px-6 pb-2">
      <Link to="/" className={`flex-1 flex flex-col items-center gap-1 transition-all ${isActive('/') ? 'text-blue-600' : 'text-slate-400'}`}>
        <svg className="w-6 h-6" fill={isActive('/') ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">Books</span>
      </Link>

      {isOwner && (
        <Link to="/admin" className={`flex-1 flex flex-col items-center gap-1 transition-all ${isActive('/admin') ? 'text-blue-600' : 'text-slate-400'}`}>
          <svg className="w-6 h-6" fill={isActive('/admin') ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider">Admin</span>
        </Link>
      )}

      <Link to="/settings" className={`flex-1 flex flex-col items-center gap-1 transition-all ${isActive('/settings') ? 'text-blue-600' : 'text-slate-400'}`}>
        <svg className="w-6 h-6" fill={isActive('/settings') ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
      </Link>
    </nav>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<LoginWrapper />} />
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/cashbook/:id" element={<ProtectedRoute><Layout><CashbookDetail /></Layout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Layout><AdminPage /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

const LoginWrapper = () => {
  const { authState } = useAuth();
  if (authState.isAuthenticated) return <Navigate to="/" />;
  return <LoginPage />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState } = useAuth();
  if (authState.isLoading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!authState.isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const hideNav = location.pathname.includes('/cashbook/');

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-50 border-x border-slate-200 shadow-sm relative overflow-x-hidden">
      <main className={`flex-1 ${hideNav ? '' : 'pb-24'}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};

export default App;
