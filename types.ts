
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  VIEWER = 'VIEWER',
  UNASSIGNED = 'UNASSIGNED'
}

export enum CashbookStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED'
}

export enum EntryType {
  IN = 'IN',
  OUT = 'OUT',
  NOTE = 'NOTE'
}

export enum PaymentMethod {
  CASH = 'CASH',
  BANK = 'BANK',
  MOBILE_BANKING = 'MOBILE_BANKING'
}

export interface User {
  id: string;
  fullName: string;
  email?: string;
  phone: string;
  password?: string;
  profilePhoto?: string;
  role: UserRole;
  orgId?: string;
  canCreateCashbooks?: boolean; // Global permission
  canArchiveCashbooks?: boolean; // Global permission
  createdAt: string;
  lastLogin?: string;
}

export interface Category {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Cashbook {
  id: string;
  categoryId: string;
  name: string;
  ownerId: string;
  status: CashbookStatus;
  createdAt: string;
  userRole?: UserRole;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  // Permissions context for current user
  canEdit?: boolean;
  canArchive?: boolean;
}

export interface CashbookStaff {
  id: string;
  cashbookId: string;
  userId: string;
  role: UserRole;
  canEdit: boolean;
  canArchive: boolean;
}

export interface Entry {
  id: string;
  cashbookId: string;
  type: EntryType;
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  attachmentUrl?: string;
  isVerified: boolean;
  verifiedBy?: string;
  createdBy: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
