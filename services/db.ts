
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Category, Cashbook, CashbookStaff, Entry, UserRole, CashbookStatus, EntryType, PaymentMethod } from '../types.ts';

const SUPABASE_URL = 'https://pscwwrsxogriepdvxscc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lPZI7DkSNFxz4gmNhS3kGQ_5mW4eR8h';

class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  private mapUser(u: any): User {
    return {
      id: u.id,
      fullName: u.full_name || 'Unknown User',
      email: u.email || '',
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
    const role = count === 0 ? UserRole.OWNER : UserRole.UNASSIGNED;
    const { data: newUser, error } = await this.supabase.from('users').insert({
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: role,
      can_create_cashbooks: role === UserRole.OWNER,
      can_archive_cashbooks: role === UserRole.OWNER
    }).select().single();
    if (error) throw error;
    return this.mapUser(newUser);
  }

  async createUser(data: any): Promise<User> {
    const { data: newUser, error } = await this.supabase.from('users').insert({
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: data.role || UserRole.EMPLOYEE,
      can_create_cashbooks: !!data.canCreateCashbooks,
      can_archive_cashbooks: !!data.canArchiveCashbooks
    }).select().single();
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
    return this.mapCashbook(data, (data as any).cashbook_staff?.[0] || null);
  }

  async createCashbook(categoryId: string, name: string, ownerId: string): Promise<Cashbook> {
    const { data, error } = await this.supabase.from('cashbooks').insert({
      category_id: categoryId,
      name,
      owner_id: ownerId,
      status: 'ACTIVE'
    }).select().single();
    if (error) throw error;
    return this.mapCashbook(data, { role: UserRole.OWNER });
  }

  async updateCashbook(id: string, data: Partial<Cashbook>): Promise<void> {
    const update: any = {};
    if (data.name) update.name = data.name;
    if (data.categoryId) update.category_id = data.categoryId;
    if (data.status) update.status = data.status;
    
    const { error } = await this.supabase.from('cashbooks').update(update).eq('id', id);
    if (error) throw error;
  }

  async getCashbookStaff(cashbookId: string): Promise<CashbookStaff[]> {
    const { data, error } = await this.supabase.from('cashbook_staff').select('*').eq('cashbook_id', cashbookId);
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

  async updateStaffPermissionsInCashbook(cashbookId: string, userId: string, update: any): Promise<void> {
    const mapped: any = {};
    if (update.canEdit !== undefined) mapped.can_edit = update.canEdit;
    if (update.canArchive !== undefined) mapped.can_archive = update.canArchive;
    if (update.role) mapped.role = update.role;
    
    const { error } = await this.supabase.from('cashbook_staff').update(mapped)
      .eq('cashbook_id', cashbookId).eq('user_id', userId);
    if (error) throw error;
  }

  async assignStaffToCashbook(cashbookId: string, userId: string, role: UserRole): Promise<void> {
    await this.supabase.from('cashbook_staff').insert({
      cashbook_id: cashbookId,
      user_id: userId,
      role: role,
      can_edit: true,
      can_archive: false
    });
  }

  async removeStaffFromCashbook(cashbookId: string, userId: string): Promise<void> {
    const { error } = await this.supabase.from('cashbook_staff').delete().eq('cashbook_id', cashbookId).eq('user_id', userId);
    if (error) throw error;
  }

  async getEntries(cashbookId: string): Promise<Entry[]> {
    const { data, error } = await this.supabase.from('entries').select('*').eq('cashbook_id', cashbookId).order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(e => ({
      id: e.id,
      cashbookId: e.cashbook_id,
      type: (e.type || EntryType.IN) as EntryType,
      amount: parseFloat(e.amount) || 0,
      description: e.description || '',
      paymentMethod: (e.payment_method || PaymentMethod.CASH) as PaymentMethod,
      isVerified: !!e.is_verified,
      createdBy: e.created_by,
      createdAt: e.created_at
    }));
  }

  async createEntry(data: any): Promise<void> {
    const { error } = await this.supabase.from('entries').insert({
      cashbook_id: data.cashbookId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      payment_method: data.paymentMethod || 'CASH',
      is_verified: !!data.isVerified,
      created_by: data.createdBy
    });
    if (error) throw error;
  }

  async updateEntry(id: string, data: Partial<Entry>): Promise<void> {
    const update: any = {};
    if (data.amount !== undefined) update.amount = data.amount;
    if (data.description !== undefined) update.description = data.description;
    if (data.type !== undefined) update.type = data.type;
    if (data.paymentMethod !== undefined) update.payment_method = data.paymentMethod;
    
    const { error } = await this.supabase.from('entries').update(update).eq('id', id);
    if (error) throw error;
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabase.from('entries').delete().eq('id', id);
    if (error) throw error;
  }

  async updateCashbookStatus(id: string, status: string): Promise<void> {
    await this.supabase.from('cashbooks').update({ status }).eq('id', id);
  }

  async softDeleteCashbook(id: string, userId: string): Promise<void> {
    await this.supabase.from('cashbooks').update({ is_deleted: true, deleted_at: new Date(), deleted_by: userId }).eq('id', id);
  }

  async restoreCashbook(id: string): Promise<void> {
    await this.supabase.from('cashbooks').update({ is_deleted: false, deleted_at: null, deleted_by: null }).eq('id', id);
  }

  async getDeletedCashbooks(): Promise<Cashbook[]> {
    const { data, error } = await this.supabase.from('cashbooks').select('*').eq('is_deleted', true).order('deleted_at', { ascending: false });
    if (error) return [];
    return data.map(cb => this.mapCashbook(cb));
  }
}

export const db = new DatabaseService();
