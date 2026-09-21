export type CategoryType = 'Andrew' | 'Rachel' | 'Leisure';

export type CreditOverrides = {
  Andrew?: number | null;
  Rachel?: number | null;
  Leisure?: number | null;
};

export type CreditAllocations = CreditOverrides;

export interface Transaction {
  id: string;
  transactionDate: string;
  postedDate: string;
  cardNumber: string;
  description: string;
  debit: number;
  credit: number;
  category: CategoryType;
  rawCategory?: string; // If original CSV contained a Category column
  notes?: string;
  isManuallyChanged?: boolean;
  statementId?: string; // ID of the statement it belongs to
  statementName?: string; // Name of the statement (e.g. 'August_Statement.pdf')
  isDeleted?: boolean; // Soft deleted flag
  deletedAt?: string; // Timestamp when record was deleted
}

export interface BucketTotals {
  debit: number;
  credit: number;
  allocatedCredit: number;
  netSpend: number;
  count: number;
}

export interface SavedStatementTotals {
  totalDebit: number;
  totalCredit: number;
  totalAllocatedCredit: number;
  totalNetSpend: number;
  count: number;
  andrew: BucketTotals;
  rachel: BucketTotals;
  leisure: BucketTotals;
}

export interface SavedStatement {
  id: string;
  name: string; // e.g. "Statement #1: July_Statement.pdf"
  fileName?: string; // original uploaded file name
  savedAt: string; // timestamp or readable date
  transactions: Transaction[];
  creditOverrides: CreditOverrides;
  totals: SavedStatementTotals;
}

export interface RemainingBalances {
  Andrew: number;
  Rachel: number;
  Leisure: number;
  enabled?: boolean;
  asOfDate?: string;
  notes?: string;
}

export interface CategorySummary {
  category: CategoryType;
  totalDebit: number;
  totalCredit: number;
  allocatedCredit: number;
  isCreditOverridden?: boolean;
  netSpend: number; // Debits - allocatedCredit (or Total Balance if remaining balance applied)
  statementNet?: number; // Pure statement net spend (Gross - allocatedCredit)
  remainingBalance?: number; // Starting/carried cutoff balance
  totalBalance?: number; // remainingBalance + statementNet
  count: number;
  percentage: number;
  color: string;
  badgeBg: string;
  textColor: string;
}

export interface CardSummary {
  cardNumber: string;
  ownerDefault: string;
  totalDebit: number;
  totalCredit: number;
  netSpend: number;
  count: number;
}

export interface MonthlySpend {
  monthKey: string; // YYYY-MM
  monthLabel: string;
  andrew: number;
  rachel: number;
  leisure: number;
  total: number;
}
