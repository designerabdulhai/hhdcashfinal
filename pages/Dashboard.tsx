
import React, { useState, useEffect, useMemo } from 'react';
import { Category, Cashbook, UserRole, CashbookStatus, User } from '../types.ts';
import { db } from '../services/db.ts';
import { useAuth } from '../App.tsx';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { authState } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cashbooks, setCashbooks] = useState<Cashbook[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatus, setActiveStatus] = useState<CashbookStatus>(CashbookStatus.ACTIVE);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCbName, setNewCbName] = useState('');
  const [createCatId, setCreateCatId] = useState('');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const isOwner = authState.user?.role === UserRole.OWNER;
  const canCreate = isOwner || !!authState.user?.canCreateCashbooks;

  const loadData = async () => {
    if (!authState.user) return;
    try {
      setLoading(true);
      const [cats, books, users] = await Promise.all([
        db.getCategories(),
        db.getCashbooks(authState.user.id, isOwner),
        db.getUsers()
      ]);
      setCategories(cats);
      setCashbooks(isOwner ? books : books.filter(b => b.status === CashbookStatus.ACTIVE));
      setAllUsers(users.filter(u => u.id !== authState.user?.id)); // Exclude self
      
      if (cats.length > 0 && !createCatId) {
        setCreateCatId(cats[0].id);
      }
    } catch (err) {
      console.error("Dashboard load failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [authState.user]);

  const handleCreateCashbook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCbName || !createCatId || creating) return;
    setCreating(true);
    try {
      const newCb = await db.createCashbook(createCatId, newCbName, authState.user!.id);
      
      // Assign selected staff
      if (selectedStaffIds.length > 0) {
        await Promise.all(selectedStaffIds.map(userId => 
          db.assignStaffToCashbook(newCb.id, userId, UserRole.EMPLOYEE)
        ));
      }

      setNewCbName('');
      setSelectedStaffIds([]);
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleStaffSelection = (userId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const filteredBooks = useMemo(() => {
    return cashbooks.filter(cb => {
      const matchesSearch = cb.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = cb.status === activeStatus;
      const matchesCategory = selectedCategoryId === 'all' || cb.categoryId === selectedCategoryId;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [cashbooks, searchQuery, activeStatus, selectedCategoryId]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Ledgers</span>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-slate-50/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden p-1">
            <img 
              src={authState.user?.profilePhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${authState.user?.fullName}`} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Business Identity</div>
            <span className="font-black text-slate-900 leading-none">{authState.user?.fullName}</span>
          </div>
        </div>
      </header>

      {/* Search & Main Filter */}
      <div className="px-6 mb-4 space-y-4">
        <div className="relative group">
          <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Find ledger by name..."
            className="w-full bg-white h-14 pl-12 pr-6 rounded-2xl text-sm font-bold shadow-sm outline-none border border-slate-100 focus:border-blue-200 transition-all"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {isOwner && (
          <div className="bg-slate-200/50 p-1 rounded-2xl flex">
            <button onClick={() => setActiveStatus(CashbookStatus.ACTIVE)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeStatus === CashbookStatus.ACTIVE ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Active Books</button>
            <button onClick={() => setActiveStatus(CashbookStatus.COMPLETED)} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeStatus === CashbookStatus.COMPLETED ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}>Archived</button>
          </div>
        )}
      </div>

      {/* Category Nav - Updated to flex-wrap for visibility */}
      <div className="mb-6 px-6">
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setSelectedCategoryId('all')}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCategoryId === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-100 shadow-sm'}`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`whitespace-nowrap px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCategoryId === cat.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-400 border-slate-100 shadow-sm'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest opacity-80">
          {selectedCategoryId === 'all' ? 'All Ledgers' : categories.find(c => c.id === selectedCategoryId)?.name}
        </h2>
        {canCreate && activeStatus === CashbookStatus.ACTIVE && (
          <button onClick={() => setShowCreateModal(true)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 active:scale-90 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </button>
        )}
      </div>

      <div className="px-6 space-y-3 pb-32">
        {filteredBooks.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[2rem] border border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-200">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">No books found</div>
          </div>
        ) : (
          filteredBooks.map(cb => (
            <Link 
              key={cb.id} 
              to={`/cashbook/${cb.id}`} 
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.97] transition-all hover:border-blue-100"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <div className="font-black text-slate-900 text-base tracking-tight leading-tight">{cb.name}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {categories.find(c => c.id === cb.categoryId)?.name || 'General'}
                  </div>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
              </div>
            </Link>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="text-center">
              <h3 className="font-black text-slate-900 text-lg tracking-tight mb-1">New Ledger</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Initiate professional cashbook</p>
            </div>
            <form onSubmit={handleCreateCashbook} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                <input type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-blue-600 transition-all" placeholder="e.g. Monthly Sales 2025" value={newCbName} onChange={e => setNewCbName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHN0cm9rZT0iIzQ3NTVmMSIgc3Ryb2tlLXdpZHRoPSIzIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:1.2rem] bg-[right_1rem_center] bg-no-repeat" value={createCatId} onChange={e => setCreateCatId(e.target.value)} required>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {allUsers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assign Staff Access</label>
                  <div className="grid grid-cols-2 gap-2">
                    {allUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleStaffSelection(user.id)}
                        className={`p-3 rounded-2xl border text-left transition-all flex flex-col ${selectedStaffIds.includes(user.id) ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-white border-slate-100 shadow-sm'}`}
                      >
                        <span className={`text-[10px] font-black tracking-tight ${selectedStaffIds.includes(user.id) ? 'text-blue-700' : 'text-slate-700'}`}>{user.fullName}</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{user.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button type="submit" disabled={creating} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all mt-4 uppercase text-xs tracking-[0.2em]">
                {creating ? 'Syncing...' : 'Confirm & Create'}
              </button>
              <button type="button" onClick={() => setShowCreateModal(false)} className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest pt-2">Dismiss</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
