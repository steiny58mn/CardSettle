import { Transaction } from '../types';
import { normalizeText } from './rulesEngine';

export const DELETED_SIGNATURES_KEY = 'credit_card_analyzer_deleted_signatures';

/**
 * Computes a deterministic fingerprint for a transaction to track deletions across re-imports.
 * Uses: transactionDate (or postedDate) | normalized card | normalized description | debit | credit
 */
export function getTransactionSignature(tx: {
  transactionDate?: string;
  postedDate?: string;
  cardNumber?: string;
  description?: string;
  debit?: number | string;
  credit?: number | string;
}): string {
  const dateStr = (tx.transactionDate || tx.postedDate || '').trim();
  const cardStr = normalizeText(tx.cardNumber || '');
  const descStr = normalizeText(tx.description || '');
  const debitNum = typeof tx.debit === 'number' ? tx.debit : parseFloat(String(tx.debit || 0)) || 0;
  const creditNum = typeof tx.credit === 'number' ? tx.credit : parseFloat(String(tx.credit || 0)) || 0;
  const debitStr = debitNum.toFixed(2);
  const creditStr = creditNum.toFixed(2);
  return `${dateStr}|${cardStr}|${descStr}|${debitStr}|${creditStr}`;
}

/**
 * Retrieves deleted transaction signatures from localStorage with their deleted occurrence counts
 */
export function getDeletedSignatures(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DELETED_SIGNATURES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading deleted signatures from localStorage:', e);
  }
  return {};
}

/**
 * Saves a deleted transaction signature to localStorage
 */
export function saveDeletedSignature(tx: Transaction): void {
  saveDeletedSignatures([tx]);
}

/**
 * Saves multiple deleted transaction signatures to localStorage
 */
export function saveDeletedSignatures(txList: Transaction[]): void {
  try {
    const map = getDeletedSignatures();
    txList.forEach((tx) => {
      const sig = getTransactionSignature(tx);
      map[sig] = (map[sig] || 0) + 1;
    });
    localStorage.setItem(DELETED_SIGNATURES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Error saving deleted signatures:', e);
  }
}

/**
 * Removes a deleted transaction signature from localStorage (on undelete)
 */
export function removeDeletedSignature(tx: Transaction): void {
  removeDeletedSignatures([tx]);
}

/**
 * Removes multiple deleted transaction signatures from localStorage (on bulk undelete)
 */
export function removeDeletedSignatures(txList: Transaction[]): void {
  try {
    const map = getDeletedSignatures();
    txList.forEach((tx) => {
      const sig = getTransactionSignature(tx);
      if (map[sig]) {
        map[sig] = map[sig] - 1;
        if (map[sig] <= 0) {
          delete map[sig];
        }
      }
    });
    localStorage.setItem(DELETED_SIGNATURES_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Error removing deleted signatures:', e);
  }
}

/**
 * Clears all remembered deleted transaction signatures
 */
export function clearDeletedSignatures(): void {
  try {
    localStorage.removeItem(DELETED_SIGNATURES_KEY);
  } catch (e) {
    console.warn('Error clearing deleted signatures:', e);
  }
}

/**
 * Applies saved deletion signatures to a list of transactions (e.g. during statement re-import)
 * so that records deleted previously remain marked as deleted.
 */
export function applyDeletedSignatures(transactions: Transaction[]): Transaction[] {
  const deletedCounts = getDeletedSignatures();
  if (Object.keys(deletedCounts).length === 0) {
    return transactions;
  }

  const usedCounts: Record<string, number> = {};

  return transactions.map((tx) => {
    // If the transaction is already marked deleted, count it towards used and preserve
    const sig = getTransactionSignature(tx);
    const maxCount = deletedCounts[sig] || 0;
    const currentUsed = usedCounts[sig] || 0;

    if (tx.isDeleted) {
      usedCounts[sig] = currentUsed + 1;
      return tx;
    }

    if (currentUsed < maxCount) {
      usedCounts[sig] = currentUsed + 1;
      return {
        ...tx,
        isDeleted: true,
      };
    }

    return tx;
  });
}
