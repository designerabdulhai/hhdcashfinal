
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App.tsx';
import { UserRole, Category, User, Cashbook, CashbookStatus, CashbookStaff } from '../types.ts';
import { db } from '../services/db.ts';
import { Navigate, Link } from 'react-router-dom';
import ConfirmationModal from '../components/ConfirmationModal.tsx';

type AdminView = 'menu' | 'add-category' | 'directory' | 'active-books' | 'recycle-bin' | 'add-staff' | 'staff-detail';

const Toggle = ({ label, subLabel, checked, onChange, disabled }: { label: string, subLabel?: string, checked: boolean, onChange: (val: boolean) => void, disabled?: boolean }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
    <div className="flex-1 pr-4">
      <div className="text-xs font-black text-slate-800 tracking-tight">{label}</div>
      {subLabel && <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{subLabel}</div>}
    </div>
    <button 
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-slate-200'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`}></div>
    </button>
  </div>
);

const AdminPage: React.FC = () => {
  const { authState } = useAuth();
  const [currentView, setCurrentView] = useState<AdminView>('menu');
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeBooks, setActiveBooks] = useState<Cashbook[]>([]);
  const [deletedBooks, setDeletedBooks] = useState<Cashbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [uEditCanCreate, setUEditCanCreate] = useState(false);
  const [uEditCanArchive, setUEditCanArchive] = useState(false);

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [managingCb, setManagingCb] = useState<Cashbook | null>(null);
  const [assignedStaff, setAssignedStaff] = useState<CashbookStaff[]>([]);

  // Staff Detail View State
  const [selectedStaffForDetail, setSelectedStaffForDetail] = useState<User | null>(null);
  const [staffAssignedBooks, setStaffAssignedBooks] = useState<Cashbook[]>([]);

  // Deletion State
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [newCatName, setNewCatName] = useState('');
  
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [showEditCatModal, setShowEditCatModal] = useState(false);

  // New Staff State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPass, setNewStaffPass] = useState('');
  const [newStaffCanCreate, setNewStaffCanCreate] = useState(false);
  const [newStaffCanArchive, setNewStaffCanArchive] = useState(false);

  const loadData = async () => {
    if (!authState.user) return;
    setLoading(true);
    try {
      const [cats, userList, currentBooks, trashBooks] = await Promise.all([
        db.getCategories(),
        db.getUsers(),
        db.getCashbooks(authState.user.id, true),
        db.getDeletedCashbooks()
      ]);
      setCategories(cats);
      setUsers(userList);
      setActiveBooks(currentBooks);
      setDeletedBooks(trashBooks);
    } catch (err) { 
      console.error("Admin load error:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [authState.user]);

  if (authState.user?.role !== UserRole.OWNER) return <Navigate to="/" />;

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setUEditCanCreate(!!user.canCreateCashbooks);
    setUEditCanArchive(!!user.canArchiveCashbooks);
    setShowEditUserModal(true);
  };

  const saveUserPermissions = async () => {
    if (!editingUser) return;
    setActionLoading(true);
    try {
      await db.updateUser(editingUser.id, { 
        canCreateCashbooks: uEditCanCreate,
        canArchiveCashbooks: uEditCanArchive
      });
      setShowEditUserModal(false);
      await loadData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(false); }
  };

  const confirmDeleteUser = (user: User) => {
    setUserToDelete(user);
    setShowDeleteUserModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setActionLoading(true);
    try {
      await db.deleteUser(userToDelete.id);
      setShowDeleteUserModal(false);
      setUserToDelete(null);
      if (currentView === 'staff-detail') {
        setCurrentView('directory');
      }
      await loadData();
    } catch (err: any) {
      alert("Error deleting user: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openStaffDetail = async (user: User) => {
    setSelectedStaffForDetail(user);
    setLoading(true);
    try {
      const books = await db.getCashbooks(user.id, false);
      setStaffAssignedBooks(books);
      setCurrentView('staff-detail');
    } catch (err) {
      alert("Failed to load staff assignments");
    } finally {
      setLoading(false);
    }
  };

  const revokeStaffAccess = async (cbId: string) => {
    if (!selectedStaffForDetail) return;
    if (!confirm(`Revoke access to this ledger for ${selectedStaffForDetail.fullName}?`)) return;
    
    setActionLoading(true);
    try {
      await db.removeStaffFromCashbook(cbId, selectedStaffForDetail.id);
      const updatedBooks = await db.getCashbooks(selectedStaffForDetail.id, false);
      setStaffAssignedBooks(updatedBooks);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openStaffManagement = async (cb: Cashbook) => {
    setManagingCb(cb);
    setLoading(true);
    try {
      const staff = await db.getCashbookStaff(cb.id);
      setAssignedStaff(staff);
      setShowStaffModal(true);
    } catch (err: any) { 
      alert("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  };

  const updateStaffPerm = async (userId: string, update: any) => {
    if (!managingCb) return;
    try {
      await db.updateStaffPermissionsInCashbook(managingCb.id, userId, update);
      const staff = await db.getCashbookStaff(managingCb.id);
      setAssignedStaff(staff);
    } catch (err: any) { alert(err.message); }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setActionLoading(true);
    try {
      await db.createCategory(newCatName, authState.user!.id);
      setNewCatName('');
      await loadData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(false); }
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setShowEditCatModal(true);
  };

  const handleSaveCategoryEdit = async () => {
    if (!editingCategory || !editCatName.trim()) return;
    setActionLoading(true);
    try {
      await db.updateCategory(editingCategory.id, editCatName);
      setShowEditCatModal(false);
      await loadData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(false); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure? This will delete the category definition.")) return;
    setActionLoading(true);
    try {
      await db.deleteCategory(id);
      await loadData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(false); }
  };

  const handleRestoreCashbook = async (id: string) => {
    setActionLoading(true);
    try {
      await db.restoreCashbook(id);
      await loadData();
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(false); }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLoading) return;
    
    setActionLoading(true);
    try {
      await db.createUser({
        fullName: newStaffName,
        phone: newStaffPhone.trim(),
        password: newStaffPass,
        role: UserRole.EMPLOYEE,
        canCreateCashbooks: newStaffCanCreate,
        canArchiveCashbooks: newStaffCanArchive
      });
      
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffPass('');
      setNewStaffCanCreate(false);
      setNewStaffCanArchive(false);
      
      alert("Employee registered successfully!");
      setCurrentView('directory');
      await loadData();
    } catch (err: any) {
      console.error("Staff registration failed:", err);
      alert("Registration Error: " + (err.message || "Please check if the phone number is already registered."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBack = () => {
    if (actionLoading) return;
    if (currentView === 'staff-detail') {
      setCurrentView('directory');
      return;
    }
    setCurrentView('menu');
  };

  if (currentView === 'menu') {
    return (
      <div className="bg-slate-50 min-h-screen">
        <div className="bg-blue-600 text-white pt-12 pb-6 px-6 shadow-lg flex items-center justify-between sticky top-0 z-[100]">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <h1 className="text-xl font-black tracking-tight">Admin Portal</h1>
          </div>
          {(loading || actionLoading) && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
          <button onClick={() => setCurrentView('directory')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center active:scale-95 transition-all text-center">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Staff Rights</span>
          </button>
          
          <button onClick={() => setCurrentView('add-staff')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center active:scale-95 transition-all text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Add Staff</span>
          </button>

          <button onClick={() => setCurrentView('active-books')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center active:scale-95 transition-all text-center">
            <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Book Access</span>
          </button>

          <button onClick={() => setCurrentView('add-category')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center active:scale-95 transition-all text-center">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h10M7 11h10M7 15h10" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categories</span>
          </button>

          <button onClick={() => setCurrentView('recycle-bin')} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center active:scale-95 transition-all col-span-2 text-center">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recycle Bin</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen pb-24">
      <ConfirmationModal 
        isOpen={showDeleteUserModal}
        onClose={() => setShowDeleteUserModal(false)}
        onConfirm={handleDeleteUser}
        title="Delete Employee?"
        description={`This will permanently remove ${userToDelete?.fullName} from the system. Ledger data they created will be preserved but assigned to System.`}
        isDanger={true}
        confirmLabel="Delete Permanently"
      />

      <div className="bg-blue-600 text-white pt-12 pb-6 px-6 shadow-lg flex items-center gap-3 sticky top-0 z-[100]">
        <button onClick={handleBack} disabled={actionLoading} className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full disabled:opacity-50">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-xl font-black tracking-tight">
          {currentView === 'directory' ? 'Staff Directory' : 
           currentView === 'staff-detail' ? 'Staff Detail' :
           currentView === 'active-books' ? 'Ledger Staff' : 
           currentView === 'recycle-bin' ? 'Deleted Ledgers' : 
           currentView === 'add-staff' ? 'Register New Staff' : 'Categories'}
        </h1>
        {actionLoading && <div className="ml-auto w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
      </div>

      <div className="p-6 space-y-4">
        {currentView === 'add-staff' && (
          <form onSubmit={handleAddStaff} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5 animate-in slide-in-from-bottom-4 duration-300">
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 block">Full Name</label>
                <input type="text" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-blue-600 transition-all" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} required placeholder="e.g. Ariful Islam" />
             </div>
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 block">Mobile Number</label>
                <input type="tel" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-blue-600 transition-all" value={newStaffPhone} onChange={e => setNewStaffPhone(e.target.value)} required placeholder="01XXX-XXXXXX" />
             </div>
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1 block">Login Password</label>
                <input type="password" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-blue-600 transition-all" value={newStaffPass} onChange={e => setNewStaffPass(e.target.value)} required placeholder="••••••••" />
             </div>
             <div className="pt-2 space-y-1">
                <Toggle 
                  label="Allow Book Creation" 
                  subLabel="Can initiate new ledgers independently" 
                  checked={newStaffCanCreate} 
                  onChange={setNewStaffCanCreate} 
                  disabled={actionLoading}
                />
                <Toggle 
                  label="Allow Book Archive" 
                  subLabel="Can archive ledgers independently" 
                  checked={newStaffCanArchive} 
                  onChange={setNewStaffCanArchive} 
                  disabled={actionLoading}
                />
             </div>
             <button type="submit" disabled={actionLoading} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all mt-4 uppercase text-xs tracking-[0.2em] disabled:opacity-50">
                {actionLoading ? 'Registering...' : 'Register Employee'}
             </button>
          </form>
        )}

        {currentView === 'directory' && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Configure Global Rights</h2>
            {users.filter(u => u.role !== UserRole.OWNER).map(u => (
              <div key={u.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm active:bg-slate-50 transition-colors" onClick={() => openStaffDetail(u)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-400 rounded-xl flex items-center justify-center font-black text-xs">
                    {u.fullName[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-800 leading-tight">{u.fullName}</div>
                    <div className="flex flex-wrap gap-2 items-center mt-1">
                      <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">{u.role}</span>
                      {u.canCreateCashbooks && <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Creator</span>}
                      {u.canArchiveCashbooks && <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Archiver</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openEditUser(u); }} className="p-3 bg-slate-50 text-blue-600 rounded-2xl hover:bg-blue-50 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); confirmDeleteUser(u); }} className="p-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {users.filter(u => u.role !== UserRole.OWNER).length === 0 && (
              <div className="py-20 text-center">
                 <div className="text-slate-300 mb-2 font-bold uppercase tracking-widest text-[10px]">No staff registered</div>
              </div>
            )}
          </div>
        )}

        {currentView === 'staff-detail' && selectedStaffForDetail && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
               <button 
                  onClick={() => confirmDeleteUser(selectedStaffForDetail)}
                  className="absolute top-6 right-6 p-3 bg-rose-50 text-rose-500 rounded-2xl active:scale-90 transition-all"
               >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               </button>
               <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl">
                    {selectedStaffForDetail.fullName[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg tracking-tight">{selectedStaffForDetail.fullName}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedStaffForDetail.phone}</p>
                  </div>
               </div>
               <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-2">
                  <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{selectedStaffForDetail.role}</span>
                  {selectedStaffForDetail.canCreateCashbooks && <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full">Global Creator</span>}
                  {selectedStaffForDetail.canArchiveCashbooks && <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-600 px-3 py-1 rounded-full">Global Archiver</span>}
               </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Ledgers ({staffAssignedBooks.length})</h2>
              {staffAssignedBooks.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                  <div className="text-slate-300 font-bold text-[10px] uppercase tracking-widest">No ledgers assigned</div>
                </div>
              ) : (
                staffAssignedBooks.map(cb => (
                  <div key={cb.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                    <div>
                      <div className="text-sm font-black text-slate-800 tracking-tight">{cb.name}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        {categories.find(c => c.id === cb.categoryId)?.name || 'General'}
                      </div>
                    </div>
                    <button 
                      onClick={() => revokeStaffAccess(cb.id)} 
                      disabled={actionLoading}
                      className="p-3 bg-rose-50 text-rose-500 rounded-2xl hover:bg-rose-100 transition-colors disabled:opacity-50"
                      title="Revoke Access"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {currentView === 'active-books' && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Active Ledgers</h2>
            {activeBooks.map(cb => (
              <div key={cb.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-sm font-black text-slate-800 tracking-tight">{cb.name}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{categories.find(c => c.id === cb.categoryId)?.name}</div>
                </div>
                <button onClick={() => openStaffManagement(cb)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                  Permissions
                </button>
              </div>
            ))}
          </div>
        )}

        {currentView === 'recycle-bin' && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Deleted Books</h2>
            {deletedBooks.length === 0 ? (
              <div className="py-20 text-center">
                 <div className="text-slate-300 mb-2 font-bold uppercase tracking-widest text-[10px]">Trash is empty</div>
              </div>
            ) : (
              deletedBooks.map(cb => (
                <div key={cb.id} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm grayscale opacity-80">
                  <div>
                    <div className="text-sm font-black text-slate-600 line-through">{cb.name}</div>
                    <div className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Deleted on {new Date(cb.deletedAt!).toLocaleDateString()}</div>
                  </div>
                  <button onClick={() => handleRestoreCashbook(cb.id)} className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 active:scale-90 transition-all">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {currentView === 'add-category' && (
          <div className="space-y-6">
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Create Category</label>
                <div className="flex gap-2">
                  <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Sales, Rent" className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm font-bold outline-none focus:bg-white" />
                  <button onClick={handleCreateCategory} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest">Add</button>
                </div>
             </div>
             <div className="space-y-3">
               <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Existing Categories</h2>
               {categories.map(cat => (
                 <div key={cat.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
                   <span className="font-bold text-slate-800 text-sm">{cat.name}</span>
                   <div className="flex gap-2">
                      <button onClick={() => openEditCategory(cat)} className="text-blue-500 p-2 hover:bg-blue-50 rounded-xl transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteCategory(cat.id)} className="text-rose-400 p-2 hover:bg-rose-50 rounded-xl transition-colors">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </div>

      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Rights: {editingUser.fullName}</h3>
            <div className="space-y-1">
              <Toggle 
                label="Allow Book Creation" 
                subLabel="Can initiate new ledgers globally" 
                checked={uEditCanCreate} 
                onChange={setUEditCanCreate} 
              />
              <Toggle 
                label="Allow Book Archive" 
                subLabel="Can archive ledgers globally" 
                checked={uEditCanArchive} 
                onChange={setUEditCanArchive} 
              />
            </div>
            <button onClick={saveUserPermissions} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all">
              Save Changes
            </button>
            <button onClick={() => setShowEditUserModal(false)} className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      )}

      {showStaffModal && managingCb && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-900 tracking-tight">Staff: {managingCb.name}</h3>
              <button onClick={() => setShowStaffModal(false)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 no-scrollbar">
              {assignedStaff.map(staff => {
                const u = users.find(user => user.id === staff.userId);
                if (!u) return null;
                return (
                  <div key={staff.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="text-xs font-black text-slate-800 mb-2 uppercase tracking-widest border-b border-slate-200/50 pb-2">{u.fullName}</div>
                    <Toggle label="Can Post/Edit" subLabel="Allow adding & editing records" checked={staff.canEdit} onChange={(val) => updateStaffPerm(staff.userId, { canEdit: val })} />
                    <Toggle label="Can Archive" subLabel="Allow moving ledger to archives" checked={staff.canArchive} onChange={(val) => updateStaffPerm(staff.userId, { canArchive: val })} />
                  </div>
                );
              })}
              {assignedStaff.length === 0 && (
                <div className="py-12 text-center">
                  <div className="text-slate-300 mb-2 font-bold uppercase tracking-widest text-[10px]">No staff assigned</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showEditCatModal && editingCategory && (
        <div className="fixed inset-0 z-[160] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Rename Category</h3>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Name</label>
              <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:bg-white focus:border-blue-600 transition-all" value={editCatName} onChange={e => setEditCatName(e.target.value)} />
            </div>
            <button onClick={handleSaveCategoryEdit} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all">
              Save Category
            </button>
            <button onClick={() => setShowEditCatModal(false)} className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
