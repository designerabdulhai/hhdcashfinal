
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Cashbook, Entry, UserRole, EntryType, CashbookStatus, Category, PaymentMethod, User, CashbookStaff } from '../types.ts';
import { db } from '../services/db.ts';
import { useAuth } from '../App.tsx';
import ConfirmationModal from '../components/ConfirmationModal.tsx';

const Toggle = ({ label, subLabel, checked, onChange }: { label: string, subLabel?: string, checked: boolean, onChange: (val: boolean) => void }) => (
  <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
    <div className="flex-1 pr-4">
      <div className="text-[10px] font-black text-slate-800 tracking-tight uppercase">{label}</div>
      {subLabel && <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{subLabel}</div>}
    </div>
    <button 
      onClick={() => onChange(!checked)}
      className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`}></div>
    </button>
  </div>
);

const CashbookDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authState } = useAuth();
  
  const [cashbook, setCashbook] = useState<Cashbook | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [showEditCashbookModal, setShowEditCashbookModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  
  const [confModal, setConfModal] = useState<{ isOpen: boolean; title: string; desc: string; onConfirm: () => void; isDanger?: boolean }>({
    isOpen: false,
    title: '',
    desc: '',
    onConfirm: () => {},
    isDanger: false
  });

  // Entry Form State
  const [entryType, setEntryType] = useState<EntryType>(EntryType.IN);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  
  // Cashbook Form State
  const [editCbName, setEditCbName] = useState('');
  
  // Staff State
  const [assignedStaff, setAssignedStaff] = useState<CashbookStaff[]>([]);
  const [saving, setSaving] = useState(false);

  const isOwner = authState.user?.role === UserRole.OWNER;
  const canEdit = isOwner || !!cashbook?.canEdit;
  const canArchive = isOwner || !!cashbook?.canArchive;
  const canPost = cashbook?.status === CashbookStatus.ACTIVE && canEdit;

  const loadData = async () => {
    if (!id || !authState.user) return;
    try {
      setLoading(true);
      const [cb, items, usersList] = await Promise.all([
        db.getCashbookById(id, authState.user.id, isOwner),
        db.getEntries(id),
        db.getUsers()
      ]);
      
      if (cb) {
        if (cb.status === CashbookStatus.COMPLETED && !isOwner) {
          navigate('/');
          return;
        }
        setCashbook(cb); 
        setEditCbName(cb.name);
        setEntries(items); 
        setAllUsers(usersList);
        const map: Record<string, string> = {}; 
        usersList.forEach(u => { map[u.id] = u.fullName; }); 
        setUserMap(map);
      } else { navigate('/'); }
    } catch (err) { navigate('/'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id, authState.user]);

  const loadStaff = async () => {
    if (!id) return;
    try {
      const staff = await db.getCashbookStaff(id);
      setAssignedStaff(staff);
    } catch (err) { console.error(err); }
  };

  const stats = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    entries.forEach(e => {
      if (e.type === EntryType.IN) totalIn += e.amount;
      if (e.type === EntryType.OUT) totalOut += e.amount;
    });
    return { in: totalIn, out: totalOut, balance: totalIn - totalOut };
  }, [entries]);

  const handleToggleStatus = async () => {
    if (!canArchive) return;
    const nextStatus = cashbook?.status === CashbookStatus.ACTIVE ? CashbookStatus.COMPLETED : CashbookStatus.ACTIVE;
    setConfModal({
      isOpen: true,
      title: nextStatus === CashbookStatus.COMPLETED ? 'Archive Ledger?' : 'Re-activate?',
      desc: nextStatus === CashbookStatus.COMPLETED ? 'Only Owners will be able to see this book.' : 'Staff can resume adding entries.',
      onConfirm: async () => {
        try {
          await db.updateCashbookStatus(id!, nextStatus);
          setShowManageModal(false);
          loadData();
        } catch(err:any){alert(err.message);}
      }
    });
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;
    setSaving(true);
    try {
      await db.updateEntry(editingEntry.id, {
        amount: parseFloat(amount),
        description,
        type: entryType
      });
      setShowEditEntryModal(false);
      setEditingEntry(null);
      setAmount('');
      setDescription('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    setConfModal({
      isOpen: true,
      title: 'Delete Entry?',
      desc: 'This action cannot be undone. Financial totals will be recalculated.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await db.deleteEntry(entryId);
          loadData();
        } catch (err: any) { alert(err.message); }
      }
    });
  };

  const handleEditEntryClick = (entry: Entry) => {
    if (!canEdit) return;
    setEditingEntry(entry);
    setEntryType(entry.type);
    setAmount(entry.amount.toString());
    setDescription(entry.description);
    setShowEditEntryModal(true);
  };

  const handleUpdateCashbook = async () => {
    if (!editCbName.trim()) return;
    setSaving(true);
    try {
      await db.updateCashbook(id!, { name: editCbName });
      setShowEditCashbookModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCashbook = () => {
    if (!isOwner) return;
    setConfModal({
      isOpen: true,
      title: 'Delete Ledger?',
      desc: 'This ledger will be moved to the Recycle Bin. All records will be hidden from staff.',
      isDanger: true,
      onConfirm: async () => {
        try {
          await db.softDeleteCashbook(id!, authState.user!.id);
          navigate('/');
        } catch (err: any) { alert(err.message); }
      }
    });
  };

  const handleAssignStaff = async (userId: string) => {
    try {
      await db.assignStaffToCashbook(id!, userId, UserRole.EMPLOYEE);
      loadStaff();
    } catch (err: any) { alert(err.message); }
  };

  const handleRemoveStaff = async (userId: string) => {
    try {
      await db.removeStaffFromCashbook(id!, userId);
      loadStaff();
    } catch (err: any) { alert(err.message); }
  };

  const handleUpdateStaffPerm = async (userId: string, update: any) => {
    try {
      await db.updateStaffPermissionsInCashbook(id!, userId, update);
      loadStaff();
    } catch (err: any) { alert(err.message); }
  };

  const availableUsers = useMemo(() => {
    return allUsers.filter(u => u.role !== UserRole.OWNER && !assignedStaff.some(s => s.userId === u.id));
  }, [allUsers, assignedStaff]);

  if (loading && !cashbook) return <div className="p-8 text-center py-32 animate-pulse">Syncing...</div>;
  if (!cashbook) return null;

  return (
    <div className="bg-white min-h-screen">
      <ConfirmationModal 
        isOpen={confModal.isOpen}
        onClose={() => setConfModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confModal.onConfirm}
        title={confModal.title}
        description={confModal.desc}
        isDanger={confModal.isDanger}
      />

      <div className="bg-blue-600 text-white p-6 pt-12 sticky top-0 z-[100] shadow-lg">
        <div className="flex justify-between mb-4">
          <Link to="/" className="p-2.5 bg-white/10 rounded-xl">✕</Link>
          {(isOwner || canArchive) && (
            <button onClick={() => setShowManageModal(true)} className="p-2.5 bg-white/10 rounded-xl font-bold text-xs uppercase tracking-widest">Settings</button>
          )}
        </div>
        <h1 className="text-2xl font-black">{cashbook.name}</h1>
        <div className="grid grid-cols-3 gap-3 mt-6">
           <div className="bg-white/10 p-3 rounded-2xl"><div className="text-[9px] opacity-60 font-black uppercase">Balance</div><div className="font-black">৳{stats.balance}</div></div>
           <div className="bg-emerald-500/20 p-3 rounded-2xl"><div className="text-[9px] text-emerald-300 font-black uppercase">In</div><div className="font-black">৳{stats.in}</div></div>
           <div className="bg-rose-500/20 p-3 rounded-2xl"><div className="text-[9px] text-rose-300 font-black uppercase">Out</div><div className="font-black">৳{stats.out}</div></div>
        </div>
      </div>

      <div className="p-6 space-y-4 pb-32">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Recent Transactions</h2>
        {entries.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-slate-300 font-bold">No entries yet</div>
          </div>
        ) : (
          entries.map(e => (
            <div key={e.id} className="p-4 border border-slate-50 rounded-2xl flex justify-between items-center shadow-sm group relative active:bg-slate-50 transition-colors">
              <div className="flex-1" onClick={() => canEdit && handleEditEntryClick(e)}>
                <div className="text-[9px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
                  {userMap[e.createdBy]} 
                  <span className="w-1 h-1 bg-slate-200 rounded-full" />
                  {new Date(e.createdAt).toLocaleDateString()}
                </div>
                <div className="font-bold text-slate-800 text-sm">{e.description}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className={`font-black text-sm text-right ${e.type === EntryType.IN ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {e.type === EntryType.IN ? '+' : '-'}৳{e.amount}
                </div>
                {canEdit && (
                  <button onClick={() => handleDeleteEntry(e.id)} className="p-2 text-slate-200 hover:text-rose-400 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {canPost && (
        <div className="fixed bottom-8 left-0 right-0 px-6 max-w-lg mx-auto">
          <button onClick={() => {
            setEditingEntry(null);
            setAmount('');
            setDescription('');
            setEntryType(EntryType.IN);
            setShowAddModal(true);
          }} className="w-full h-16 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 active:scale-95 transition-all">
            Add Record
          </button>
        </div>
      )}

      {/* Settings Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
             <h3 className="font-black text-slate-900 text-lg tracking-tight mb-4">Ledger Settings</h3>
             
             {isOwner && (
               <button onClick={() => { setShowManageModal(false); setShowEditCashbookModal(true); }} className="w-full py-4 bg-slate-50 text-slate-700 rounded-2xl font-black uppercase text-[11px] tracking-widest active:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                 Rename Ledger
               </button>
             )}

             {isOwner && (
               <button onClick={() => { setShowManageModal(false); loadStaff(); setShowStaffModal(true); }} className="w-full py-4 bg-blue-50 text-blue-700 rounded-2xl font-black uppercase text-[11px] tracking-widest active:bg-blue-100 transition-colors flex items-center justify-center gap-2">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                 Manage Staff Access
               </button>
             )}

             {canArchive && (
               <button onClick={handleToggleStatus} className="w-full py-4 border-2 border-slate-100 rounded-2xl font-black uppercase text-[11px] tracking-widest active:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                 {cashbook.status === CashbookStatus.ACTIVE ? 'Archive Ledger' : 'Re-activate'}
               </button>
             )}

             {isOwner && (
               <button onClick={handleDeleteCashbook} className="w-full py-4 text-rose-500 bg-rose-50 rounded-2xl font-black uppercase text-[11px] tracking-widest active:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 Delete Ledger
               </button>
             )}

             <button onClick={() => setShowManageModal(false)} className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-4">Dismiss</button>
          </div>
        </div>
      )}

      {/* Staff Management Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-[170] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-black text-slate-900 tracking-tight">Staff: {cashbook.name}</h3>
              <button onClick={() => setShowStaffModal(false)} className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
              {/* Current Staff */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Staff</h4>
                {assignedStaff.map(s => {
                  const u = allUsers.find(user => user.id === s.userId);
                  if (!u) return null;
                  return (
                    <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-start border-b border-slate-200/50 pb-2 mb-2">
                        <div>
                          <div className="text-xs font-black text-slate-800 uppercase tracking-widest">{u.fullName}</div>
                          <div className="text-[9px] text-slate-400 font-bold tracking-wider">{u.phone}</div>
                        </div>
                        <button onClick={() => handleRemoveStaff(u.id)} className="text-rose-500 p-1 hover:bg-rose-100 rounded-lg">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <Toggle label="Can Post/Edit" checked={s.canEdit} onChange={(val) => handleUpdateStaffPerm(s.userId, { canEdit: val })} />
                      <Toggle label="Can Archive" checked={s.canArchive} onChange={(val) => handleUpdateStaffPerm(s.userId, { canArchive: val })} />
                    </div>
                  );
                })}
                {assignedStaff.length === 0 && <div className="text-[10px] text-slate-300 font-bold text-center py-4">No staff assigned yet</div>}
              </div>

              {/* Add New Staff */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Staff</h4>
                <div className="space-y-2">
                  {availableUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <div>
                        <div className="text-xs font-black text-slate-800 tracking-tight">{u.fullName}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">{u.role}</div>
                      </div>
                      <button onClick={() => handleAssignStaff(u.id)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Add</button>
                    </div>
                  ))}
                  {availableUsers.length === 0 && <div className="text-[10px] text-slate-300 font-bold text-center py-4">All registered staff assigned</div>}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-50 shrink-0">
               <button onClick={() => setShowStaffModal(false)} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest shadow-lg">Done Managing</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Ledger Modal */}
      {showEditCashbookModal && (
        <div className="fixed inset-0 z-[160] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="font-black text-slate-900 text-lg tracking-tight">Edit Ledger</h3>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Title</label>
              <input type="text" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold" value={editCbName} onChange={e => setEditCbName(e.target.value)} />
            </div>
            <button onClick={handleUpdateCashbook} disabled={saving} className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">
              {saving ? 'Updating...' : 'Save Title'}
            </button>
            <button onClick={() => setShowEditCashbookModal(false)} className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest">Cancel</button>
          </div>
        </div>
      )}

      {/* Add/Edit Entry Modal */}
      {(showAddModal || showEditEntryModal) && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
             <h3 className="font-black text-slate-900 text-lg tracking-tight">{showEditEntryModal ? 'Edit Record' : 'New Record'}</h3>
             <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button type="button" onClick={() => setEntryType(EntryType.IN)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${entryType === EntryType.IN ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Inflow</button>
                <button type="button" onClick={() => setEntryType(EntryType.OUT)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${entryType === EntryType.OUT ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>Outflow</button>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300 text-xl">৳</span>
                  <input type="number" className="w-full p-5 pl-10 bg-slate-50 border rounded-2xl font-black text-3xl outline-none focus:bg-white" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <textarea className="w-full p-5 bg-slate-50 border rounded-2xl h-24 text-sm font-bold outline-none focus:bg-white resize-none" placeholder="Add a description..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <button 
                onClick={showEditEntryModal ? handleUpdateEntry : async () => {
                  setSaving(true);
                  try {
                    await db.createEntry({ cashbookId: id!, type: entryType, amount: parseFloat(amount), description, paymentMethod: PaymentMethod.CASH, isVerified: false, createdBy: authState.user!.id });
                    setShowAddModal(false); setAmount(''); setDescription(''); loadData();
                  } catch(err:any){alert(err.message);}
                  finally{setSaving(false);}
                }} 
                className={`w-full py-5 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all ${entryType === EntryType.IN ? 'bg-emerald-500' : 'bg-rose-500'}`}
              >
                {saving ? 'Processing...' : (showEditEntryModal ? 'Save Changes' : 'Confirm Entry')}
              </button>
              <button onClick={() => { setShowAddModal(false); setShowEditEntryModal(false); }} className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashbookDetail;
