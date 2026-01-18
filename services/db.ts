import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Category, Cashbook, CashbookStaff, Entry, UserRole, CashbookStatus, EntryType, PaymentMethod } from '../types.ts';

/**
 * PRODUCTION READY DATABASE SERVICE
 * On Vercel: Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in Environment Variables.
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pscwwrsxogriepdvxscc.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'sb_publishable_lPZI7DkSNFxz4gmNhS3kGQ_5mW4eR8h';

class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  private mapUser(u: any): User {
    return {
      id: u.id,
      fullName: u.full_name || 'Unknown User',
      email: u.email || undefined,
      phone: u.phone || '',
      password: u.password,
      role: (u.role || 'UNASSIGNED').toUpperCase() as UserRole,
      canCreateCashbooks: !!u.can_create_cashbooks,
      canArchiveCashbooks: !!u.can_archive_cashbooks,
      orgId: u.org_id,
      createdAt: u.created_at,
      profilePhoto: u.profile_photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.full_name}`
    };
  }

  private mapCashbook(cb: any, staffMeta?: any): Cashbook {
    return {
      id: cb.id,
      categoryId: cb.category_id,
      name: cb.name || 'Untitled Ledger',
      ownerId: cb.owner_id,
      status: cb.status === 'COMPLETED' ? CashbookStatus.COMPLETED : CashbookStatus.ACTIVE,
      createdAt: cb.created_at,
      userRole: staffMeta?.role,
      canEdit: staffMeta?.can_edit ?? (staffMeta?.role === UserRole.OWNER || staffMeta?.role === UserRole.MANAGER),
      canArchive: staffMeta?.can_archive ?? (staffMeta?.role === UserRole.OWNER),
      isDeleted: !!cb.is_deleted,
      deletedAt: cb.deleted_at
    };
  }

  private mapEntry(e: any): Entry {
    return {
      id: e.id,
      cashbookId: e.cashbook_id,
      type: e.type as EntryType,
      amount: typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount,
      description: e.description || '',
      paymentMethod: (e.payment_method || PaymentMethod.CASH) as PaymentMethod,
      attachmentUrl: e.attachment_url,
      isVerified: !!e.is_verified,
      verifiedBy: e.verified_by,
      createdBy: e.created_by,
      createdAt: e.created_at
    };
  }

  async getUsers(): Promise<User[]> {
    const { data, error } = await this.supabase.from('users').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(u => this.mapUser(u));
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const { data, error } = await this.supabase.from('users').select('*').eq('phone', phone.trim()).maybeSingle();
    if (error) return undefined;
    return data ? this.mapUser(data) : undefined;
  }

  async authenticate(phone: string, pass: string): Promise<User | null> {
    const user = await this.getUserByPhone(phone);
    if (user && user.password === pass) return user;
    return null;
  }

  async initializeFirstUser(data: any): Promise<User> {
    const { count } = await this.supabase.from('users').select('*', { count: 'exact', head: true });
    const isFirst = (count === 0);
    const role = isFirst ? UserRole.OWNER : UserRole.UNASSIGNED;
    
    const payload: any = {
      full_name: data.fullName,
      phone: data.phone.trim(),
      password: data.password,
      role: role,
      can_create_cashbooks: isFirst,
      can_archive_cashbooks: isFirst,
      email: data.email || null
    };
    
    const { data: newUser, error } = await this.supabase.from('users').insert(payload).select().single();
    if (error) throw error;
    return this.mapUser(newUser);
  }

  async createUser(data: any): Promise<User> {
    const payload: any = {
      full_name: data.fullName,
      phone: data.phone.trim(),
      password: data.password,
      role: data.role || UserRole.EMPLOYEE,
      can_create_cashbooks: !!data.canCreateCashbooks,
      can_archive_cashbooks: !!data.canArchiveCashbooks,
      email: data.email || null
    };
    
    const { data: newUser, error } = await this.supabase.from('users').insert(payload).select().single();
    if (error) throw error;
    return this.mapUser(newUser);
  }

  async updateUser(id: string, data: Partial<User>): Promise<void> {
    const update: any = {};
    if (data.fullName) update.full_name = data.fullName;
    if (data.role) update.role = data.role;
    if (data.canCreateCashbooks !== undefined) update.can_create_cashbooks = data.canCreateCashbooks;
    if (data.canArchiveCashbooks !== undefined) update.can_archive_cashbooks = data.canArchiveCashbooks;
    if (data.password) update.password = data.password;
    if (data.profilePhoto) update.profile_photo = data.profilePhoto;
    
    const { error } = await this.supabase.from('users').update(update).eq('id', id);
    if (error) throw error;
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await this.supabase.from('users').delete().eq('id', id);
    if (error) throw error;
  }

  async getCategories(): Promise<Category[]> {
    const { data, error } = await this.supabase.from('categories').select('*').order('name');
    if (error) return [];
    return data.map(c => ({ id: c.id, name: c.name, ownerId: c.owner_id, createdAt: c.created_at }));
  }

  async createCategory(name: string, ownerId: string): Promise<void> {
    await this.supabase.from('categories').insert({ name, owner_id: ownerId });
  }

  async updateCategory(id: string, name: string): Promise<void> {
    const { error } = await this.supabase.from('categories').update({ name }).eq('id', id);
    if (error) throw error;
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  }

  async getCashbooks(userId: string, isAdmin: boolean): Promise<Cashbook[]> {
    if (isAdmin) {
      const { data, error } = await this.supabase
        .from('cashbooks')
        .select('*')
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []).map(cb => this.mapCashbook(cb));
    }

    const { data, error } = await this.supabase
      .from('cashbooks')
      .select('*,cashbook_staff!inner(*)')
      .or('is_deleted.eq.false,is_deleted.is.null')
      .eq('cashbook_staff.user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) return [];
    
    return (data || []).map((cb: any) => {
      const staff = cb.cashbook_staff?.[0] || null;
      return this.mapCashbook(cb, staff);
    });
  }

  async getCashbookById(id: string, userId: string, isAdmin: boolean): Promise<Cashbook | null> {
    if (isAdmin) {
      const { data, error } = await this.supabase
        .from('cashbooks')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return this.mapCashbook(data);
    }

    const { data, error } = await this.supabase
      .from('cashbooks')
      .select('*,cashbook_staff!inner(*)')
      .eq('id', id)
      .eq('cashbook_staff.user_id', userId)
      .maybeSingle();
    
    if (error || !data) return null;
    const staff = data.cashbook_staff?.[0] || null;
    return this.mapCashbook(data, staff);
  }

  async createCashbook(categoryId: string, name: string, ownerId: string): Promise<Cashbook> {
    const { data, error } = await this.supabase.from('cashbooks').insert({
      category_id: categoryId,
      name,
      owner_id: ownerId,
      status: CashbookStatus.ACTIVE
    }).select().single();
    if (error) throw error;
    
    await this.assignStaffToCashbook(data.id, ownerId, UserRole.OWNER, true, true);
    return this.mapCashbook(data);
  }

  async updateCashbook(id: string, data: Partial<Cashbook>): Promise<void> {
    const update: any = {};
    if (data.name) update.name = data.name;
    const { error } = await this.supabase.from('cashbooks').update(update).eq('id', id);
    if (error) throw error;
  }

  async updateCashbookStatus(id: string, status: CashbookStatus): Promise<void> {
    const { error } = await this.supabase.from('cashbooks').update({ status }).eq('id', id);
    if (error) throw error;
  }

  async softDeleteCashbook(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase.from('cashbooks').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    }).eq('id', id);
    if (error) throw error;
  }

  async restoreCashbook(id: string): Promise<void> {
    const { error } = await this.supabase.from('cashbooks').update({
      is_deleted: false,
      deleted_at: null,
      deleted_by: null
    }).eq('id', id);
    if (error) throw error;
  }

  async getDeletedCashbooks(): Promise<Cashbook[]> {
    const { data, error } = await this.supabase
      .from('cashbooks')
      .select('*')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false });
    if (error) return [];
    return data.map(cb => this.mapCashbook(cb));
  }

  async getEntries(cashbookId: string): Promise<Entry[]> {
    const { data, error } = await this.supabase
      .from('entries')
      .select('*')
      .eq('cashbook_id', cashbookId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data.map(e => this.mapEntry(e));
  }

  async getAllAccessibleEntries(userId: string, isAdmin: boolean): Promise<Entry[]> {
    if (isAdmin) {
      const { data, error } = await this.supabase
        .from('entries')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data.map(e => this.mapEntry(e));
    }

    const { data: staffData } = await this.supabase
      .from('cashbook_staff')
      .select('cashbook_id')
      .eq('user_id', userId);
    
    if (!staffData || staffData.length === 0) return [];
    const bookIds = staffData.map(s => s.cashbook_id);

    const { data, error } = await this.supabase
      .from('entries')
      .select('*')
      .in('cashbook_id', bookIds)
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data.map(e => this.mapEntry(e));
  }

  /**
   * HIGH PERFORMANCE REPORTING
   * Calls the PostgreSQL function get_cashflow_report
   */
  async getAggregatedReport(userId: string, isAdmin: boolean, startDate: Date, endDate: Date): Promise<any[]> {
    const { data, error } = await this.supabase.rpc('get_cashflow_report', {
      p_user_id: userId,
      p_is_admin: isAdmin,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString()
    });

    if (error) {
      console.error("RPC Report Error:", error);
      return [];
    }

    return (data || []).map(row => ({
      cashbookId: row.cashbook_id,
      cashbookName: row.cashbook_name,
      totalIn: parseFloat(row.total_in),
      totalOut: parseFloat(row.total_out),
      netBalance: parseFloat(row.net_balance)
    }));
  }

  async createEntry(data: any): Promise<void> {
    const { error } = await this.supabase.from('entries').insert({
      cashbook_id: data.cashbookId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      payment_method: data.payment_method || PaymentMethod.CASH,
      is_verified: !!data.isVerified,
      created_by: data.createdBy
    });
    if (error) throw error;
  }

  async updateEntry(id: string, data: any): Promise<void> {
    const { error } = await this.supabase.from('entries').update({
      amount: data.amount,
      description: data.description,
      type: data.type
    }).eq('id', id);
    if (error) throw error;
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabase.from('entries').delete().eq('id', id);
    if (error) throw error;
  }

  async getCashbookStaff(cashbookId: string): Promise<CashbookStaff[]> {
    const { data, error } = await this.supabase
      .from('cashbook_staff')
      .select('*')
      .eq('cashbook_id', cashbookId);
    if (error) return [];
    return data.map(s => ({
      id: s.id,
      cashbookId: s.cashbook_id,
      userId: s.user_id,
      role: s.role as UserRole,
      canEdit: !!s.can_edit,
      canArchive: !!s.can_archive
    }));
  }

  async assignStaffToCashbook(cashbookId: string, userId: string, role: UserRole, canEdit: boolean = true, canArchive: boolean = false): Promise<void> {
    const { error } = await this.supabase.from('cashbook_staff').upsert({
      cashbook_id: cashbookId,
      user_id: userId,
      role,
      can_edit: canEdit,
      can_archive: canArchive
    }, { onConflict: 'cashbook_id,user_id' });
    if (error) throw error;
  }

  async removeStaffFromCashbook(cashbookId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('cashbook_staff')
      .delete()
      .eq('cashbook_id', cashbookId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  async updateStaffPermissionsInCashbook(cashbookId: string, userId: string, update: { canEdit?: boolean, canArchive?: boolean }): Promise<void> {
    const data: any = {};
    if (update.canEdit !== undefined) data.can_edit = update.canEdit;
    if (update.canArchive !== undefined) data.can_archive = update.canArchive;
    const { error } = await this.supabase
      .from('cashbook_staff')
      .update(data)
      .eq('cashbook_id', cashbookId)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export const db = new DatabaseService();