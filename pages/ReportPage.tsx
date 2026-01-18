import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db.ts';
import { useAuth } from '../App.tsx';
import { UserRole } from '../types.ts';
import { useNavigate } from 'react-router-dom';

type ReportFilter = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';

const ReportPage: React.FC = () => {
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ReportFilter>('WEEKLY');
  const [bookStats, setBookStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  // Custom date states
  const [customStart, setCustomStart] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEnd, setCustomEnd] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const isOwner = authState.user?.role === UserRole.OWNER;

  const loadData = async () => {
    if (!authState.user) return;
    setLoading(true);
    
    try {
      const now = new Date();
      let start = new Date();
      let end = new Date();

      if (filter === 'DAILY') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (filter === 'WEEKLY') {
        start.setDate(now.getDate() - 7);
      } else if (filter === 'MONTHLY') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      } else if (filter === 'YEARLY') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
      } else if (filter === 'CUSTOM') {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }

      const results = await db.getAggregatedReport(authState.user.id, isOwner, start, end);
      setBookStats(results);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (filter !== 'CUSTOM') {
      loadData(); 
    }
  }, [authState.user, filter]);

  const globalStats = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    bookStats.forEach(s => {
      totalIn += s.totalIn;
      totalOut += s.totalOut;
    });
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [bookStats]);

  const handleFilterClick = (f: ReportFilter) => {
    setFilter(f);
    if (f === 'CUSTOM') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
    }
  };

  const openPicker = (ref: React.RefObject<HTMLInputElement>) => {
    if (ref.current && 'showPicker' in HTMLInputElement.prototype) {
      try {
        (ref.current as any).showPicker();
      } catch (e) {
        ref.current.focus();
      }
    } else if (ref.current) {
      ref.current.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {/* 
          Sticky Header Section 
          Consolidated into one container to ensure it sticks properly.
      */}
      <div className="sticky top-0 z-[200] bg-blue-600 shadow-xl shrink-0 pb-6">
        <header className="pt-12 px-6 pb-2 text-white">
          <h1 className="text-2xl font-black tracking-tight leading-none">Financial Reports</h1>
          <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mt-1.5 opacity-90">
            {filter === 'CUSTOM' ? `${customStart} - ${customEnd}` : `${filter} PERFORMANCE`}
          </p>
        </header>

        {/* Filter Scroll Tabs */}
        <div className="flex gap-2 py-2 px-6 overflow-x-auto no-scrollbar flex-nowrap touch-pan-x">
          {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM'] as ReportFilter[]).map(f => (
            <button
              key={f}
              onClick={() => handleFilterClick(f)}
              className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${filter === f ? 'bg-white text-blue-600 shadow-xl scale-105' : 'bg-blue-500/30 text-blue-100 hover:bg-blue-500/50'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 
          Main Content Area 
          Padding-top added to separate content from the sticky header.
      */}
      <div className="px-6 pt-10 flex-1 pb-32 relative z-[100]">
        
        {/* Big Summary Card */}
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100/50 flex flex-col items-center text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Total Net Balance</div>
          <div className={`text-5xl font-black tracking-tighter mb-8 ${globalStats.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            ৳{globalStats.balance.toLocaleString()}
          </div>
          
          <div className="flex w-full justify-between items-center px-2">
            <div className="flex flex-col items-start">
              <div className="text-[9px] font-black uppercase text-emerald-400 tracking-widest mb-1.5 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> TOTAL IN
              </div>
              <div className="font-black text-slate-900 text-2xl tracking-tighter">৳{globalStats.totalIn.toLocaleString()}</div>
            </div>
            <div className="flex flex-col items-end">
              <div className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-1.5 flex items-center gap-1.5">
                TOTAL OUT <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              </div>
              <div className="font-black text-slate-900 text-2xl tracking-tighter">৳{globalStats.totalOut.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Custom Date Picker (If showing) */}
        {showCustomPicker && filter === 'CUSTOM' && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-2xl mb-10 animate-in slide-in-from-top-4 duration-500">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div 
                className="space-y-1 bg-slate-50 p-4 rounded-3xl border border-slate-100 active:scale-95 transition-all cursor-pointer relative"
                onClick={() => openPicker(startInputRef)}
              >
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">From Date</label>
                  <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-sm font-black text-slate-900">{new Date(customStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <input 
                  ref={startInputRef}
                  type="date" 
                  value={customStart} 
                  onChange={e => setCustomStart(e.target.value)} 
                  className="absolute inset-0 opacity-0 pointer-events-none" 
                />
              </div>

              <div 
                className="space-y-1 bg-slate-50 p-4 rounded-3xl border border-slate-100 active:scale-95 transition-all cursor-pointer relative"
                onClick={() => openPicker(endInputRef)}
              >
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">To Date</label>
                  <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-sm font-black text-slate-900">{new Date(customEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                <input 
                  ref={endInputRef}
                  type="date" 
                  value={customEnd} 
                  onChange={e => setCustomEnd(e.target.value)} 
                  className="absolute inset-0 opacity-0 pointer-events-none" 
                />
              </div>
            </div>
            <button onClick={loadData} className="w-full py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl active:scale-95 transition-all">
              Filter Selection
            </button>
          </div>
        )}

        {/* Cashbook Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 mb-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Breakdown by Ledger</h2>
          </div>
          
          {loading ? (
             <div className="py-20 text-center animate-pulse">
               <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Crunching Ledger Data...</span>
             </div>
          ) : bookStats.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
              <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">No ledger records for this duration</p>
            </div>
          ) : (
            bookStats.map(stat => {
              const totalVolume = stat.totalIn + stat.totalOut || 1;
              const inPercentage = Math.round((stat.totalIn / totalVolume) * 100);
              return (
                <div 
                  key={stat.cashbookId} 
                  onClick={() => navigate(`/cashbook/${stat.cashbookId}`)}
                  className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm flex flex-col gap-4 active:scale-[0.98] transition-all group animate-in fade-in slide-in-from-bottom-2 duration-500 cursor-pointer hover:border-blue-400 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-base font-black text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">{stat.cashbookName}</div>
                    <div className="text-right">
                      <div className={`font-black text-lg tracking-tighter ${stat.netBalance >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>
                        ৳{stat.netBalance.toLocaleString()}
                      </div>
                      <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest -mt-0.5 text-right w-full block">Net Flow</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-slate-50 rounded-full overflow-hidden flex shadow-inner">
                       <div 
                         className="h-full bg-emerald-400 transition-all duration-1000 ease-out" 
                         style={{ width: `${inPercentage}%` }} 
                       />
                       <div 
                         className="h-full bg-rose-400 transition-all duration-1000 ease-out" 
                         style={{ width: `${100 - inPercentage}%` }} 
                       />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter min-w-[45px]">
                      {inPercentage}% IN
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportPage;