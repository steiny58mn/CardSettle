import { CreditOverrides, RemainingBalances, SavedStatement, SavedStatementTotals, Transaction } from '../types';

export const SAVED_STATEMENTS_KEY = 'credit_card_analyzer_saved_statements';
export const ACTIVE_STATEMENT_NAME_KEY = 'credit_card_analyzer_active_statement_name';
export const REMAINING_BALANCES_KEY = 'credit_card_analyzer_remaining_balances';

export const DEFAULT_REMAINING_BALANCES: RemainingBalances = {
  Andrew: 0,
  Rachel: 0,
  Leisure: 0,
  enabled: false,
  asOfDate: '',
  notes: '',
};

/**
 * Calculates bucket-by-bucket and overall totals for a set of transactions and overrides.
 * Excludes soft-deleted transactions so totals remain accurate.
 */
export function calculateStatementTotals(
  transactions: Transaction[],
  creditOverrides: CreditOverrides = {}
): SavedStatementTotals {
  let totalDebit = 0;
  let totalCredit = 0;

  const buckets = {
    andrew: { debit: 0, credit: 0, count: 0 },
    rachel: { debit: 0, credit: 0, count: 0 },
    leisure: { debit: 0, credit: 0, count: 0 },
  };

  const activeTransactions = transactions.filter((tx) => !tx.isDeleted);

  activeTransactions.forEach((tx) => {
    totalDebit += tx.debit;
    totalCredit += tx.credit;

    if (tx.category === 'Andrew') {
      buckets.andrew.debit += tx.debit;
      buckets.andrew.credit += tx.credit;
      buckets.andrew.count += 1;
    } else if (tx.category === 'Rachel') {
      buckets.rachel.debit += tx.debit;
      buckets.rachel.credit += tx.credit;
      buckets.rachel.count += 1;
    } else {
      buckets.leisure.debit += tx.debit;
      buckets.leisure.credit += tx.credit;
      buckets.leisure.count += 1;
    }
  });

  // Calculate allocated credits
  const andrewAllocated =
    typeof creditOverrides.Andrew === 'number' && !isNaN(Number(creditOverrides.Andrew))
      ? Number(creditOverrides.Andrew)
      : buckets.andrew.credit;

  const rachelAllocated =
    typeof creditOverrides.Rachel === 'number' && !isNaN(Number(creditOverrides.Rachel))
      ? Number(creditOverrides.Rachel)
      : buckets.rachel.credit;

  const leisureAllocated =
    typeof creditOverrides.Leisure === 'number' && !isNaN(Number(creditOverrides.Leisure))
      ? Number(creditOverrides.Leisure)
      : buckets.leisure.credit;

  const totalAllocatedCredit = andrewAllocated + rachelAllocated + leisureAllocated;

  const andrewNet = buckets.andrew.debit - andrewAllocated;
  const rachelNet = buckets.rachel.debit - rachelAllocated;
  const leisureNet = buckets.leisure.debit - leisureAllocated;
  const totalNetSpend = totalDebit - totalAllocatedCredit;

  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalAllocatedCredit: Math.round(totalAllocatedCredit * 100) / 100,
    totalNetSpend: Math.round(totalNetSpend * 100) / 100,
    count: activeTransactions.length,
    andrew: {
      debit: Math.round(buckets.andrew.debit * 100) / 100,
      credit: Math.round(buckets.andrew.credit * 100) / 100,
      allocatedCredit: Math.round(andrewAllocated * 100) / 100,
      netSpend: Math.round(andrewNet * 100) / 100,
      count: buckets.andrew.count,
    },
    rachel: {
      debit: Math.round(buckets.rachel.debit * 100) / 100,
      credit: Math.round(buckets.rachel.credit * 100) / 100,
      allocatedCredit: Math.round(rachelAllocated * 100) / 100,
      netSpend: Math.round(rachelNet * 100) / 100,
      count: buckets.rachel.count,
    },
    leisure: {
      debit: Math.round(buckets.leisure.debit * 100) / 100,
      credit: Math.round(buckets.leisure.credit * 100) / 100,
      allocatedCredit: Math.round(leisureAllocated * 100) / 100,
      netSpend: Math.round(leisureNet * 100) / 100,
      count: buckets.leisure.count,
    },
  };
}

/**
 * Sums up carried-over totals across all saved statements
 */
export function calculateCarriedOverTotals(savedStatements: SavedStatement[]): SavedStatementTotals {
  let totalDebit = 0;
  let totalCredit = 0;
  let totalAllocatedCredit = 0;
  let totalNetSpend = 0;
  let totalCount = 0;

  const andrew = { debit: 0, credit: 0, allocatedCredit: 0, netSpend: 0, count: 0 };
  const rachel = { debit: 0, credit: 0, allocatedCredit: 0, netSpend: 0, count: 0 };
  const leisure = { debit: 0, credit: 0, allocatedCredit: 0, netSpend: 0, count: 0 };

  savedStatements.forEach((stmt) => {
    const t = stmt.totals;
    totalDebit += t.totalDebit;
    totalCredit += t.totalCredit;
    totalAllocatedCredit += t.totalAllocatedCredit;
    totalNetSpend += t.totalNetSpend;
    totalCount += t.count;

    andrew.debit += t.andrew.debit;
    andrew.credit += t.andrew.credit;
    andrew.allocatedCredit += t.andrew.allocatedCredit;
    andrew.netSpend += t.andrew.netSpend;
    andrew.count += t.andrew.count;

    rachel.debit += t.rachel.debit;
    rachel.credit += t.rachel.credit;
    rachel.allocatedCredit += t.rachel.allocatedCredit;
    rachel.netSpend += t.rachel.netSpend;
    rachel.count += t.rachel.count;

    leisure.debit += t.leisure.debit;
    leisure.credit += t.leisure.credit;
    leisure.allocatedCredit += t.leisure.allocatedCredit;
    leisure.netSpend += t.leisure.netSpend;
    leisure.count += t.leisure.count;
  });

  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalAllocatedCredit: Math.round(totalAllocatedCredit * 100) / 100,
    totalNetSpend: Math.round(totalNetSpend * 100) / 100,
    count: totalCount,
    andrew: {
      debit: Math.round(andrew.debit * 100) / 100,
      credit: Math.round(andrew.credit * 100) / 100,
      allocatedCredit: Math.round(andrew.allocatedCredit * 100) / 100,
      netSpend: Math.round(andrewNetSpend(andrew.debit, andrew.allocatedCredit) * 100) / 100,
      count: andrew.count,
    },
    rachel: {
      debit: Math.round(rachel.debit * 100) / 100,
      credit: Math.round(rachel.credit * 100) / 100,
      allocatedCredit: Math.round(rachel.allocatedCredit * 100) / 100,
      netSpend: Math.round(rachelNetSpend(rachel.debit, rachel.allocatedCredit) * 100) / 100,
      count: rachel.count,
    },
    leisure: {
      debit: Math.round(leisure.debit * 100) / 100,
      credit: Math.round(leisure.credit * 100) / 100,
      allocatedCredit: Math.round(leisure.allocatedCredit * 100) / 100,
      netSpend: Math.round(leisureNetSpend(leisure.debit, leisure.allocatedCredit) * 100) / 100,
      count: leisure.count,
    },
  };
}

function andrewNetSpend(debit: number, credit: number) {
  return debit - credit;
}

function rachelNetSpend(debit: number, credit: number) {
  return debit - credit;
}

function leisureNetSpend(debit: number, credit: number) {
  return debit - credit;
}

/**
 * Combines active statement totals with carried-over totals from saved statements
 */
export function combineStatementTotals(
  active: SavedStatementTotals,
  carriedOver: SavedStatementTotals
): SavedStatementTotals {
  const totalDebit = active.totalDebit + carriedOver.totalDebit;
  const totalCredit = active.totalCredit + carriedOver.totalCredit;
  const totalAllocatedCredit = active.totalAllocatedCredit + carriedOver.totalAllocatedCredit;
  const totalNetSpend = active.totalNetSpend + carriedOver.totalNetSpend;
  const count = active.count + carriedOver.count;

  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalAllocatedCredit: Math.round(totalAllocatedCredit * 100) / 100,
    totalNetSpend: Math.round(totalNetSpend * 100) / 100,
    count,
    andrew: {
      debit: Math.round((active.andrew.debit + carriedOver.andrew.debit) * 100) / 100,
      credit: Math.round((active.andrew.credit + carriedOver.andrew.credit) * 100) / 100,
      allocatedCredit: Math.round((active.andrew.allocatedCredit + carriedOver.andrew.allocatedCredit) * 100) / 100,
      netSpend: Math.round((active.andrew.netSpend + carriedOver.andrew.netSpend) * 100) / 100,
      count: active.andrew.count + carriedOver.andrew.count,
    },
    rachel: {
      debit: Math.round((active.rachel.debit + carriedOver.rachel.debit) * 100) / 100,
      credit: Math.round((active.rachel.credit + carriedOver.rachel.credit) * 100) / 100,
      allocatedCredit: Math.round((active.rachel.allocatedCredit + carriedOver.rachel.allocatedCredit) * 100) / 100,
      netSpend: Math.round((active.rachel.netSpend + carriedOver.rachel.netSpend) * 100) / 100,
      count: active.rachel.count + carriedOver.rachel.count,
    },
    leisure: {
      debit: Math.round((active.leisure.debit + carriedOver.leisure.debit) * 100) / 100,
      credit: Math.round((active.leisure.credit + carriedOver.leisure.credit) * 100) / 100,
      allocatedCredit: Math.round((active.leisure.allocatedCredit + carriedOver.leisure.allocatedCredit) * 100) / 100,
      netSpend: Math.round((active.leisure.netSpend + carriedOver.leisure.netSpend) * 100) / 100,
      count: active.leisure.count + carriedOver.leisure.count,
    },
  };
}

/**
 * Loads saved statements from localStorage
 */
export function getSavedStatements(): SavedStatement[] {
  try {
    const raw = localStorage.getItem(SAVED_STATEMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading saved statements from localStorage:', e);
  }
  return [];
}

/**
 * Saves statements array to localStorage
 */
export function saveSavedStatements(statements: SavedStatement[]): void {
  try {
    localStorage.setItem(SAVED_STATEMENTS_KEY, JSON.stringify(statements));
  } catch (e) {
    console.warn('Error writing saved statements to localStorage:', e);
  }
}

/**
 * Loads active statement name from localStorage
 */
export function getActiveStatementName(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_STATEMENT_NAME_KEY);
    if (raw && raw.trim()) {
      return raw.trim();
    }
  } catch (e) {
    console.warn('Error reading active statement name:', e);
  }
  return 'Current Statement';
}

/**
 * Saves active statement name to localStorage
 */
export function saveActiveStatementName(name: string): void {
  try {
    localStorage.setItem(ACTIVE_STATEMENT_NAME_KEY, name);
  } catch (e) {
    console.warn('Error saving active statement name:', e);
  }
}

/**
 * Loads stored Remaining Balances (per-bucket starting cutoff balances) from localStorage
 */
export function getRemainingBalances(): RemainingBalances {
  try {
    const raw = localStorage.getItem(REMAINING_BALANCES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          Andrew: typeof parsed.Andrew === 'number' && !isNaN(parsed.Andrew) ? parsed.Andrew : 0,
          Rachel: typeof parsed.Rachel === 'number' && !isNaN(parsed.Rachel) ? parsed.Rachel : 0,
          Leisure: typeof parsed.Leisure === 'number' && !isNaN(parsed.Leisure) ? parsed.Leisure : 0,
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
          asOfDate: typeof parsed.asOfDate === 'string' ? parsed.asOfDate : '',
          notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        };
      }
    }
  } catch (e) {
    console.warn('Error reading remaining balances from localStorage:', e);
  }
  return { ...DEFAULT_REMAINING_BALANCES };
}

/**
 * Saves Remaining Balances to localStorage
 */
export function saveRemainingBalances(balances: RemainingBalances): void {
  try {
    localStorage.setItem(REMAINING_BALANCES_KEY, JSON.stringify(balances));
  } catch (e) {
    console.warn('Error saving remaining balances to localStorage:', e);
  }
}

/**
 * Clears Remaining Balances from localStorage
 */
export function clearRemainingBalances(): void {
  try {
    localStorage.removeItem(REMAINING_BALANCES_KEY);
  } catch (e) {
    console.warn('Error clearing remaining balances from localStorage:', e);
  }
}
