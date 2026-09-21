import Papa from 'papaparse';
import { CategorySummary, CategoryType, Transaction } from '../types';
import { determineCategoryWithOverrides } from './rulesEngine';

/**
 * Clean a string representation of currency into a clean float number
 */
export function parseCurrency(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;

  // Remove currency signs, commas, extra whitespace
  const cleanStr = str.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleanStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format number into USD currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse CSV text or File into strongly-typed Transaction[]
 */
export function parseCSVData(csvText: string): {
  transactions: Transaction[];
  errors: string[];
  skippedCount: number;
} {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

  if (result.errors && result.errors.length > 0) {
    result.errors.forEach((err) => {
      if (err.type !== 'FieldMismatch') {
        errors.push(`Row ${err.row ?? '?'}: ${err.message}`);
      }
    });
  }

  const rows = result.data as Record<string, any>[];

  rows.forEach((row, index) => {
    // Find matching keys with fuzzy/case-insensitive matching
    const keys = Object.keys(row);
    const findKey = (candidates: string[]) => {
      return keys.find((k) =>
        candidates.some((c) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === c.toLowerCase().replace(/[^a-z0-9]/g, ''))
      );
    };

    const transDateKey = findKey(['TransactionDate', 'Transaction Date', 'Date', 'Trans Date', 'TxnDate']);
    const postedDateKey = findKey(['PostedDate', 'Posted Date', 'Post Date']);
    const cardKey = findKey(['Card No.', 'Card No', 'Card Number', 'Card', 'Card#', 'Account']);
    const descKey = findKey(['Description', 'Desc', 'Merchant', 'Payee', 'Details', 'Transaction Description']);
    const debitKey = findKey(['Debit', 'Debit Amount', 'Expense', 'Charge', 'Amount']);
    const creditKey = findKey(['Credit', 'Credit Amount', 'Payment', 'Refund']);
    const categoryKey = findKey(['Category', 'RawCategory', 'Type']);

    const transactionDate = transDateKey ? String(row[transDateKey] || '').trim() : '';
    const postedDate = postedDateKey ? String(row[postedDateKey] || '').trim() : transactionDate;
    let cardNumber = cardKey ? String(row[cardKey] || '').trim() : '';
    let description = descKey ? String(row[descKey] || '').trim() : '';
    const rawCategory = categoryKey ? String(row[categoryKey] || '').trim() : undefined;

    // Check if this is a Capital One Travel entry
    const isCapOneTravel =
      /capit[oa]l\s*one\s*travel/i.test(description) ||
      /cap\s*one\s*travel/i.test(description) ||
      /c1\s*travel/i.test(description) ||
      /capit[oa]l\s*one\s*travel/i.test(cardNumber) ||
      cardNumber.toLowerCase() === 'travel' ||
      rawCategory?.toLowerCase() === 'travel' ||
      rawCategory?.toLowerCase() === 'other travel';

    // Capital One Travel rule: make record title "Travel" rather than the card number
    if (isCapOneTravel) {
      cardNumber = 'Travel';
    }

    // Ensure description retains the file description
    if (!description && isCapOneTravel) {
      description = 'Capital One Travel';
    }

    let debit = debitKey ? parseCurrency(row[debitKey]) : 0;
    let credit = creditKey ? parseCurrency(row[creditKey]) : 0;

    // In some single-amount files, negative is credit, positive is debit
    if (debitKey && !creditKey && debit < 0) {
      credit = Math.abs(debit);
      debit = 0;
    }

    // Skip row if it has neither date nor description nor card number nor amounts
    if (!transactionDate && !description && debit === 0 && credit === 0) {
      skippedCount++;
      return;
    }

    // Calculate category based on remembered manual overrides first, then default rules
    const txDate = transactionDate || new Date().toISOString().split('T')[0];
    const postDate = postedDate || txDate;
    const { category: assignedCat, isManuallyChanged } = determineCategoryWithOverrides(
      cardNumber,
      description,
      rawCategory,
      credit,
      debit,
      txDate,
      postDate
    );

    transactions.push({
      id: `tx-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 6)}`,
      transactionDate: txDate,
      postedDate: postDate,
      cardNumber: cardNumber || 'N/A',
      description: description || 'Unnamed Transaction',
      debit,
      credit,
      category: assignedCat,
      rawCategory,
      isManuallyChanged,
    });
  });

  return { transactions, errors, skippedCount };
}

/**
 * Generate high-quality realistic sample dataset with 3810 (Rachel), 2642/6744 (Andrew), and Travel (Leisure)
 */
export function getSampleCSVString(): string {
  return `TransactionDate,PostedDate,Card No.,Description,Category,Debit,Credit
2026-08-01,2026-08-02,3810,Target Superstore #2104,Merchandise,84.50,
2026-08-02,2026-08-03,2642,Chevron Fuel Gas Station,Gasoline,55.20,
2026-08-03,2026-08-04,6744,Home Depot Hardware Supplies,Home Improvement,142.80,
2026-08-04,2026-08-05,3810,Sephora Beauty Online,Merchandise,68.00,
2026-08-05,2026-08-06,Travel,CAPITAL ONE TRAVEL *FLIGHT JFK,Travel,420.00,
2026-08-06,2026-08-07,3810,Whole Foods Market Groceries,Groceries,115.40,
2026-08-07,2026-08-08,6744,Best Buy Electronics Store,Electronics,299.99,
2026-08-08,2026-08-09,Travel,CAPITAL ONE TRAVEL *HOTEL RESORT,Travel,650.00,
2026-08-09,2026-08-10,2642,Trader Joe's Neighborhood Market,Groceries,78.35,
2026-08-10,2026-08-11,3810,Target Return Refund,Merchandise,,24.50
2026-08-11,2026-08-12,6744,Steam Games Digital Purchase,Entertainment,49.99,
2026-08-12,2026-08-13,3810,Starbucks Coffee Shop,Dining,16.75,
2026-08-13,2026-08-14,2642,Marriott Hotel Lodging,Travel,310.50,
2026-08-14,2026-08-15,6744,Payment from ALLY BANK ...8458,Payment,,500.00
2026-08-15,2026-08-16,3810,Annual Membership Fee,Fee/Interest Charge,95.00,
2026-08-16,2026-08-16,3810,Nordstrom Department Store,Merchandise,135.20,
2026-08-16,2026-08-17,2642,Costco Wholesale Warehouse,Groceries,210.60,
2026-08-17,2026-08-17,6744,Uber Ride Trip Airport,Transportation,42.50,
2026-08-17,2026-08-17,Travel,CAPITAL ONE TRAVEL *CAR RENTAL,Travel,520.00,`;
}

/**
 * Export full categorized transactions to CSV
 */
export function exportTransactionsToCSV(transactions: Transaction[], filename = 'categorized_transactions.csv') {
  const activeTransactions = transactions.filter((t) => !t.isDeleted);
  const exportData = activeTransactions.map((t) => ({
    'Transaction Date': t.transactionDate,
    'Posted Date': t.postedDate,
    'Card No.': t.cardNumber,
    'Description': t.description,
    'Category': t.category,
    'Debit ($)': t.debit > 0 ? t.debit.toFixed(2) : '',
    'Credit ($)': t.credit > 0 ? t.credit.toFixed(2) : '',
    'Net Spend ($)': (t.debit - t.credit).toFixed(2),
    'Manual Edit': t.isManuallyChanged ? 'Yes' : 'Default Rule',
    'Notes': t.notes || '',
  }));

  const csv = Papa.unparse(exportData);
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export aggregated summary breakdown to CSV
 */
export function exportSummariesToCSV(
  summaries: CategorySummary[],
  totalNet: number,
  totalDebit: number,
  totalCredit: number,
  filename = 'category_spending_summary.csv'
) {
  const totalAllocated = summaries.reduce((acc, curr) => acc + (curr.allocatedCredit ?? curr.totalCredit), 0);

  const summaryRows: Array<{
    'Category': string;
    'Transaction Count': number;
    'Gross Charges ($)': string;
    'Credits Applied ($)': string;
    'Credit Source': string;
    'Net Spending ($)': string;
    '% of Total Spend': string;
  }> = summaries.map((s) => ({
    'Category': s.category === 'Andrew' ? 'Andrew/Natalie' : s.category,
    'Transaction Count': s.count,
    'Gross Charges ($)': s.totalDebit.toFixed(2),
    'Credits Applied ($)': (s.allocatedCredit ?? s.totalCredit).toFixed(2),
    'Credit Source': s.isCreditOverridden ? 'Manual Override' : 'Auto from Transactions',
    'Net Spending ($)': s.netSpend.toFixed(2),
    '% of Total Spend': `${s.percentage.toFixed(1)}%`,
  }));

  // Append Total Row
  summaryRows.push({
    'Category': 'TOTAL / ALL',
    'Transaction Count': summaries.reduce((acc, curr) => acc + curr.count, 0),
    'Gross Charges ($)': totalDebit.toFixed(2),
    'Credits Applied ($)': totalAllocated.toFixed(2),
    'Credit Source': 'Total',
    'Net Spending ($)': totalNet.toFixed(2),
    '% of Total Spend': '100.0%',
  });

  const csv = Papa.unparse(summaryRows);
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Trigger browser file download
 */
function downloadBlob(content: string, filename: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const pom = document.createElement('a');
  pom.href = url;
  pom.setAttribute('download', filename);
  pom.click();
  URL.revokeObjectURL(url);
}
