import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TransactionTable } from './components/TransactionTable';
import { FileUploadModal } from './components/FileUploadModal';
import { RulesGuideModal } from './components/RulesGuideModal';
import { SavedStatementsPanel } from './components/SavedStatementsPanel';
import { SaveStatementModal } from './components/SaveStatementModal';
import { ReopenConfirmModal } from './components/ReopenConfirmModal';
import { RemainingBalanceModal } from './components/RemainingBalanceModal';
import { Transaction, CategoryType, CategorySummary, CreditOverrides, SavedStatement, RemainingBalances } from './types';
import { parseCSVData, getSampleCSVString, exportTransactionsToCSV, exportSummariesToCSV, formatCurrency } from './utils/csvHelper';
import { calculateStatementTotals, calculateCarriedOverTotals, getRemainingBalances, saveRemainingBalances, clearRemainingBalances } from './utils/statementHelper';
import {
  applyDeletedSignatures,
  saveDeletedSignature,
  saveDeletedSignatures,
  removeDeletedSignature,
  removeDeletedSignatures,
  clearDeletedSignatures,
} from './utils/deletionHelper';
import {
  determineDefaultCategory,
  CATEGORY_COLORS,
  saveManualOverride,
  saveManualOverrides,
  clearManualOverrides,
  getCreditOverrides,
  saveCreditOverrides,
  clearCreditOverrides,
} from './utils/rulesEngine';
import {
  CheckCircle2,
  Trash2,
  AlertTriangle,
  X,
  FileText,
  Layers,
  Scale,
} from 'lucide-react';

const STORAGE_KEY = 'credit_card_analyzer_transactions';
const SAVED_STATEMENTS_KEY = 'credit_card_analyzer_saved_statements';
const ACTIVE_STATEMENT_NAME_KEY = 'credit_card_analyzer_active_statement_name';
const THEME_KEY = 'credit_card_analyzer_theme';

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return applyDeletedSignatures(parsed);
        }
      } else {
        // First ever visit: load sample CSV dataset
        const sample = getSampleCSVString();
        const { transactions: sampleTx } = parseCSVData(sample);
        return applyDeletedSignatures(sampleTx);
      }
    } catch (e) {
      console.error('Failed to parse saved transactions from localStorage', e);
    }
    return [];
  });
  const [creditOverrides, setCreditOverrides] = useState<CreditOverrides>(() => getCreditOverrides());
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [statementToReopen, setStatementToReopen] = useState<SavedStatement | null>(null);
  const [isRemainingBalanceModalOpen, setIsRemainingBalanceModalOpen] = useState(false);
  const [remainingBalances, setRemainingBalances] = useState<RemainingBalances>(() => getRemainingBalances());

  // Saved Statements State (persisted across sessions and imports)
  const [savedStatements, setSavedStatements] = useState<SavedStatement[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_STATEMENTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to read saved statements from localStorage', e);
    }
    return [];
  });

  // Active Statement Name (e.g. July 2026 Statement)
  const [activeStatementName, setActiveStatementName] = useState<string>(() => {
    try {
      const name = localStorage.getItem(ACTIVE_STATEMENT_NAME_KEY);
      if (name) return name;
    } catch (e) {
      console.error('Failed to read active statement name from localStorage', e);
    }
    return 'Statement 1';
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_KEY);
      if (savedTheme !== null) {
        return savedTheme === 'dark';
      }
    } catch (e) {
      console.warn('Error reading theme from localStorage', e);
    }
    // Default to dark mode as requested
    return true;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Update HTML class and document style for dark mode
  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
        localStorage.setItem(THEME_KEY, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
        localStorage.setItem(THEME_KEY, 'light');
      }
    } catch (e) {
      console.warn('Error updating theme class', e);
    }
  }, [darkMode]);

  // Save active transactions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed to persist transactions to localStorage', e);
    }
  }, [transactions]);

  // Self-healing check for legacy doubled credit override bug in localStorage
  useEffect(() => {
    const raw = getCreditOverrides();
    if (typeof raw.Leisure === 'number' && transactions.length > 0) {
      const autoLeisure = Math.round(
        transactions
          .filter((t) => t.category === 'Leisure')
          .reduce((sum, t) => sum + t.credit, 0) * 100
      ) / 100;
      // If Leisure override is 2x the auto leisure credit (or equal to auto), clear the stale override
      if (
        (autoLeisure > 0 && Math.abs(raw.Leisure - autoLeisure * 2) < 0.01) ||
        Math.abs(raw.Leisure - autoLeisure) < 0.01
      ) {
        const next = { ...raw };
        delete next.Leisure;
        delete next.Andrew;
        saveCreditOverrides(next);
        setCreditOverrides(next);
      }
    }
  }, [transactions]);

  // Save saved statements to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_STATEMENTS_KEY, JSON.stringify(savedStatements));
    } catch (e) {
      console.error('Failed to persist saved statements to localStorage', e);
    }
  }, [savedStatements]);

  // Save active statement name to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_STATEMENT_NAME_KEY, activeStatementName);
    } catch (e) {
      console.error('Failed to persist active statement name to localStorage', e);
    }
  }, [activeStatementName]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  };

  // Active (non-deleted) count
  const activeTransactionsCount = useMemo(
    () => transactions.filter((t) => !t.isDeleted).length,
    [transactions]
  );

  // Compute calculated metrics for active workspace
  const activeTotals = useMemo(() => {
    return calculateStatementTotals(transactions, creditOverrides);
  }, [transactions, creditOverrides]);

  // Compute carried-over totals from all prior saved statements
  const carriedOverTotals = useMemo(() => {
    return calculateCarriedOverTotals(savedStatements);
  }, [savedStatements]);

  // Check if active persistent remaining cutoff balances are configured
  const hasRemainingBalances = Boolean(
    remainingBalances?.enabled &&
      ((remainingBalances.Andrew || 0) !== 0 ||
        (remainingBalances.Rachel || 0) !== 0 ||
        (remainingBalances.Leisure || 0) !== 0)
  );

  const totalRemaining = hasRemainingBalances
    ? Math.round(
        ((remainingBalances?.Andrew || 0) +
          (remainingBalances?.Rachel || 0) +
          (remainingBalances?.Leisure || 0)) *
          100
      ) / 100
    : 0;

  // Compute combined net numbers for the Remaining Balance snapshot filler
  const currentNetByBucket = useMemo(() => {
    return {
      Andrew: Math.round((activeTotals.andrew.netSpend + carriedOverTotals.andrew.netSpend) * 100) / 100,
      Rachel: Math.round((activeTotals.rachel.netSpend + carriedOverTotals.rachel.netSpend) * 100) / 100,
      Leisure: Math.round((activeTotals.leisure.netSpend + carriedOverTotals.leisure.netSpend) * 100) / 100,
      total: Math.round((activeTotals.totalNetSpend + carriedOverTotals.totalNetSpend) * 100) / 100,
    };
  }, [activeTotals, carriedOverTotals]);

  const handleSaveRemainingBalances = (
    newBalances: RemainingBalances,
    options: { clearSavedStatements: boolean; clearActiveTransactions: boolean }
  ) => {
    saveRemainingBalances(newBalances);
    setRemainingBalances(newBalances);

    if (options.clearSavedStatements) {
      localStorage.removeItem(SAVED_STATEMENTS_KEY);
      setSavedStatements([]);
    }
    if (options.clearActiveTransactions) {
      setTransactions([]);
      localStorage.removeItem(STORAGE_KEY);
      clearManualOverrides();
      clearCreditOverrides();
      setCreditOverrides({});
    }

    showToast('Remaining balances and cutoff baseline saved successfully!');
  };

  const handleClearRemainingBalances = () => {
    clearRemainingBalances();
    setRemainingBalances(getRemainingBalances());
    showToast('Remaining cutoff balances cleared.');
  };

  // Handle updates to custom credit allocations
  // When manually overriding amounts in the Leisure category, add or subtract from Andrew/Natalie to ensure the amounts stay in sync.
  const handleUpdateCreditOverride = useCallback(
    (category: CategoryType, amount: number | null, syncWithAndrew: boolean = true) => {
      let toastMsg = '';
      setCreditOverrides((prev) => {
        // Determine automatic transaction credits for reference
        const autoAndrew = Math.round(
          transactions
            .filter((t) => t.category === 'Andrew')
            .reduce((sum, t) => sum + t.credit, 0) * 100
        ) / 100;
        const autoLeisure = Math.round(
          transactions
            .filter((t) => t.category === 'Leisure')
            .reduce((sum, t) => sum + t.credit, 0) * 100
        ) / 100;

        const currentLeisure =
          typeof prev.Leisure === 'number' && !isNaN(Number(prev.Leisure))
            ? Number(prev.Leisure)
            : autoLeisure;
        const currentAndrew =
          typeof prev.Andrew === 'number' && !isNaN(Number(prev.Andrew))
            ? Number(prev.Andrew)
            : autoAndrew;

        const next: CreditOverrides = { ...prev };

        if (category === 'Leisure' && syncWithAndrew) {
          if (amount === null) {
            // Revert Leisure to auto transaction sum
            const delta = Math.round((autoLeisure - currentLeisure) * 100) / 100;
            const newAndrew = Math.round((currentAndrew - delta) * 100) / 100;

            delete next.Leisure;
            if (Math.abs(newAndrew - autoAndrew) < 0.005) {
              delete next.Andrew;
            } else {
              next.Andrew = newAndrew;
            }

            toastMsg = `Reverted Leisure to auto (${formatCurrency(autoLeisure)}) and synchronized Andrew/Natalie to ${formatCurrency(newAndrew)}.`;
          } else {
            const newLeisure = Math.round(amount * 100) / 100;
            // Difference from current allocated leisure credit
            const delta = Math.round((newLeisure - currentLeisure) * 100) / 100;
            // When Leisure increases (delta > 0), subtract delta from Andrew.
            // When Leisure decreases (delta < 0), add |delta| to Andrew.
            const newAndrew = Math.round((currentAndrew - delta) * 100) / 100;

            next.Leisure = newLeisure;
            next.Andrew = newAndrew;

            if (delta > 0) {
              toastMsg = `Updated Leisure credit to ${formatCurrency(newLeisure)} (+$${delta.toFixed(2)}) and subtracted $${delta.toFixed(2)} from Andrew/Natalie (${formatCurrency(newAndrew)}) to stay in sync.`;
            } else if (delta < 0) {
              toastMsg = `Updated Leisure credit to ${formatCurrency(newLeisure)} (-$${Math.abs(delta).toFixed(2)}) and added $${Math.abs(delta).toFixed(2)} to Andrew/Natalie (${formatCurrency(newAndrew)}) to stay in sync.`;
            } else {
              toastMsg = `Leisure credit set to ${formatCurrency(newLeisure)} (Andrew/Natalie kept in sync at ${formatCurrency(newAndrew)}).`;
            }
          }
        } else {
          // Other categories, or explicit unsynced update (e.g. auto-applying unallocated credit directly)
          if (amount === null) {
            delete next[category];
            toastMsg = `Reverted ${category === 'Andrew' ? 'Andrew/Natalie' : category} to auto transaction credit.`;
          } else {
            next[category] = Math.round(amount * 100) / 100;
            toastMsg = `Updated credit allocation for ${category === 'Andrew' ? 'Andrew/Natalie' : category} to ${formatCurrency(amount)}.`;
          }
        }

        saveCreditOverrides(next);
        return next;
      });

      if (toastMsg) {
        showToast(toastMsg);
      }
    },
    [transactions]
  );

  const handleBulkUpdateCreditOverrides = useCallback(
    (updates: Partial<Record<CategoryType, number | null>>) => {
      setCreditOverrides((prev) => {
        const next = { ...prev };
        (Object.keys(updates) as CategoryType[]).forEach((cat) => {
          const val = updates[cat];
          if (val === null || val === undefined) {
            delete next[cat];
          } else {
            next[cat] = Math.round(val * 100) / 100;
          }
        });
        saveCreditOverrides(next);
        return next;
      });
      showToast('Updated credit allocations.');
    },
    []
  );

  const handleResetAllCreditOverrides = useCallback(() => {
    clearCreditOverrides();
    setCreditOverrides({});
    showToast('Reset all bucket credit overrides to automatic transaction sums.');
  }, []);

  // Saved Statement Handlers: Save current statement, carry over totals, load next file
  const handleOpenSaveModal = () => {
    if (transactions.length === 0) {
      showToast('No active transactions to save.');
      return;
    }
    setIsSaveModalOpen(true);
  };

  const handleSaveStatement = (nameToSave: string, openUploadNext: boolean = true) => {
    const finalName = nameToSave.trim() || activeStatementName || `Statement ${savedStatements.length + 1}`;
    const newSaved: SavedStatement = {
      id: `stmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: finalName,
      fileName: finalName,
      savedAt: new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      transactions: [...transactions],
      creditOverrides: { ...creditOverrides },
      totals: activeTotals,
    };

    setSavedStatements((prev) => [newSaved, ...prev]);
    // Clear the active workspace:
    // 1) Avoids double-counting saved transactions in combined views
    // 2) The carried-over totals and credit allocations are already applied before the next file is loaded
    // 3) The application is ready to process the next file and account for these carried totals
    setTransactions([]);
    clearCreditOverrides();
    setCreditOverrides({});
    setActiveStatementName(`Statement ${savedStatements.length + 2}`);
    
    // Close save modal and automatically pop up the file upload modal for the next statement
    setIsSaveModalOpen(false);
    if (openUploadNext) {
      setIsUploadModalOpen(true);
      showToast(`Saved "${finalName}" (${formatCurrency(activeTotals.totalNetSpend)} net). Upload your next statement to carry over totals!`);
    } else {
      showToast(`Saved "${finalName}" (${formatCurrency(activeTotals.totalNetSpend)} net). Totals & credit allocations carried over!`);
    }
  };

  const executeReopenStatement = (target: SavedStatement) => {
    setTransactions(applyDeletedSignatures(target.transactions));
    setCreditOverrides(target.creditOverrides || {});
    setActiveStatementName(target.name);
    // Remove from saved statements while active so it is not double-counted in carried totals
    setSavedStatements((prev) => prev.filter((s) => s.id !== target.id));
    setStatementToReopen(null);
    showToast(`Loaded "${target.name}" into active workspace for editing.`);
    // Smooth scroll to transactions ledger
    setTimeout(() => {
      document.getElementById('transactions-ledger')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleReopenStatement = (statementId: string) => {
    const target = savedStatements.find((s) => s.id === statementId);
    if (!target) return;

    if (transactions.length > 0) {
      // Prompt with friendly in-app modal instead of browser window.confirm
      setStatementToReopen(target);
      return;
    }

    // Direct reopen when active workspace is empty
    executeReopenStatement(target);
  };

  const handleConfirmSaveAndOpen = () => {
    if (!statementToReopen) return;
    // 1. Save current active workspace
    const newSaved: SavedStatement = {
      id: `stmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: activeStatementName || `Statement ${savedStatements.length + 1}`,
      fileName: activeStatementName || `Statement ${savedStatements.length + 1}`,
      savedAt: new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      transactions: [...transactions],
      creditOverrides: { ...creditOverrides },
      totals: { ...activeTotals },
    };

    const target = statementToReopen;
    // Update saved statements: add current workspace, remove target
    setSavedStatements((prev) => [newSaved, ...prev.filter((s) => s.id !== target.id)]);
    executeReopenStatement(target);
    showToast(`Saved current statement and loaded "${target.name}" for editing.`);
  };

  const handleConfirmDiscardAndOpen = () => {
    if (!statementToReopen) return;
    executeReopenStatement(statementToReopen);
  };

  const handleRenameSavedStatement = (statementId: string, newName: string) => {
    setSavedStatements((prev) =>
      prev.map((s) => (s.id === statementId ? { ...s, name: newName } : s))
    );
    showToast(`Renamed statement to "${newName}".`);
  };

  const handleDeleteSavedStatement = (statementId: string) => {
    const target = savedStatements.find((s) => s.id === statementId);
    if (target) {
      setSavedStatements((prev) => prev.filter((s) => s.id !== statementId));
      showToast(`Deleted saved statement "${target.name}".`);
    }
  };

  const handleClearAllSaved = () => {
    setSavedStatements([]);
    showToast('Cleared all saved statements.');
  };

  const handleScrollToSavedStatements = () => {
    const el = document.getElementById('saved-statements-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Import handler: when a new PDF or CSV is loaded, set active statement name,
  // replace active transactions, reset active credit overrides (while carried over statements stay locked)
  const handleImportSuccess = (newTx: Transaction[], fileName?: string) => {
    const preparedTx = applyDeletedSignatures(newTx);
    setTransactions(preparedTx);
    if (fileName) {
      const cleanName = fileName.replace(/\.(csv|pdf|txt)$/i, '');
      setActiveStatementName(cleanName);
    } else {
      setActiveStatementName(`Statement ${savedStatements.length + 1}`);
    }

    // Reset active credit overrides so fresh transactions start with automatic calculations
    clearCreditOverrides();
    setCreditOverrides({});

    const activeCount = preparedTx.filter((t) => !t.isDeleted).length;
    const deletedCount = preparedTx.length - activeCount;

    if (savedStatements.length > 0) {
      showToast(
        `Loaded ${activeCount} active transactions${deletedCount > 0 ? ` (${deletedCount} previously deleted excluded)` : ''} from ${fileName || 'new file'}. Prior totals (${formatCurrency(carriedOverTotals.totalNetSpend)} net) are safely carried over!`
      );
    } else {
      showToast(`Loaded ${activeCount} active transactions${deletedCount > 0 ? ` (${deletedCount} previously deleted excluded)` : ''} from ${fileName || 'file'}.`);
    }

    // Scroll to ledger so user immediately sees their imported data
    setTimeout(() => {
      document.getElementById('transactions-ledger')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Update single category from dropdown (Live reactivity active & remembered for next PDF/CSV load)
  const handleUpdateCategory = useCallback((id: string, newCategory: CategoryType) => {
    const target = transactions.find((t) => t.id === id);

    // Guard: don't allow bucket to change while deleted
    if (target?.isDeleted) {
      showToast('Cannot change bucket while record is deleted. Undelete this record first.');
      return;
    }

    // If this transaction has a credit, clear any stale manual overrides on Leisure or Andrew
    // so that the category credit cleanly flows into the auto transaction calculation
    if (target && target.credit > 0) {
      setCreditOverrides((currentOverrides) => {
        if (currentOverrides.Leisure !== undefined || currentOverrides.Andrew !== undefined) {
          const next = { ...currentOverrides };
          delete next.Leisure;
          delete next.Andrew;
          saveCreditOverrides(next);
          return next;
        }
        return currentOverrides;
      });
    }

    setTransactions((prev) => {
      const updated = prev.map((t) =>
        t.id === id
          ? {
              ...t,
              category: newCategory,
              isManuallyChanged: true,
            }
          : t
      );
      const changedTx = updated.find((t) => t.id === id);
      if (changedTx) {
        saveManualOverride(changedTx, newCategory);
      }
      return updated;
    });

    showToast(`Updated category for ${newCategory === 'Andrew' ? 'Andrew/Natalie' : newCategory}`);
  }, [transactions]);

  // Bulk update
  const handleBulkUpdateCategory = useCallback((ids: string[], newCategory: CategoryType) => {
    const idSet = new Set(ids);
    setTransactions((prev) => {
      const targets = prev.filter((t) => idSet.has(t.id) && !t.isDeleted);
      if (targets.length > 0) {
        saveManualOverrides(targets, newCategory);
      }
      return prev.map((t) =>
        idSet.has(t.id) && !t.isDeleted
          ? {
              ...t,
              category: newCategory,
              isManuallyChanged: true,
            }
          : t
      );
    });
    showToast(`Bulk updated & remembered ${ids.length} transactions for ${newCategory === 'Andrew' ? 'Andrew/Natalie' : newCategory}`);
  }, []);

  // Delete transaction (removes from totals and remembers signature so re-imports stay deleted)
  const handleDeleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) {
        saveDeletedSignature(target);
      }
      return prev.map((t) =>
        t.id === id ? { ...t, isDeleted: true, deletedAt: new Date().toISOString() } : t
      );
    });
    showToast('Record deleted (excluded from totals).');
  }, []);

  // Bulk delete
  const handleDeleteBulkTransactions = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setTransactions((prev) => {
      const targets = prev.filter((t) => idSet.has(t.id));
      if (targets.length > 0) {
        saveDeletedSignatures(targets);
      }
      const now = new Date().toISOString();
      return prev.map((t) =>
        idSet.has(t.id) ? { ...t, isDeleted: true, deletedAt: now } : t
      );
    });
    showToast(`Deleted ${ids.length} records (excluded from totals).`);
  }, []);

  // Undelete transaction (restores to totals and removes signature so re-imports won't be deleted)
  const handleUndeleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => {
      const target = prev.find((t) => t.id === id);
      if (target) {
        removeDeletedSignature(target);
      }
      return prev.map((t) =>
        t.id === id ? { ...t, isDeleted: false, deletedAt: undefined } : t
      );
    });
    showToast('Record undeleted and restored to totals.');
  }, []);

  // Bulk undelete
  const handleUndeleteBulkTransactions = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setTransactions((prev) => {
      const targets = prev.filter((t) => idSet.has(t.id));
      if (targets.length > 0) {
        removeDeletedSignatures(targets);
      }
      return prev.map((t) =>
        idSet.has(t.id) ? { ...t, isDeleted: false, deletedAt: undefined } : t
      );
    });
    showToast(`Restored ${ids.length} records to totals.`);
  }, []);

  // Add transaction
  const handleAddTransaction = useCallback((newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isManuallyChanged: true,
    };
    saveManualOverride(newTx, newTx.category);

    setTransactions((prev) => [newTx, ...prev]);

    // If a credit transaction is added, clear any stale overrides on Leisure/Andrew
    // so that the newly added transaction credit is cleanly calculated into the auto credit sum
    if (newTx.credit > 0) {
      setCreditOverrides((currentOverrides) => {
        if (currentOverrides.Leisure !== undefined || currentOverrides.Andrew !== undefined) {
          const next = { ...currentOverrides };
          delete next.Leisure;
          delete next.Andrew;
          saveCreditOverrides(next);
          return next;
        }
        return currentOverrides;
      });
    }

    showToast('Manual transaction added.');
  }, []);

  // Reset to default rule assignments
  const handleResetToDefaultRules = useCallback(() => {
    clearManualOverrides();
    clearCreditOverrides();
    setCreditOverrides({});
    setTransactions((prev) =>
      prev.map((tx) => ({
        ...tx,
        category: determineDefaultCategory(
          tx.cardNumber,
          tx.description,
          tx.rawCategory,
          tx.credit,
          tx.debit
        ),
        isManuallyChanged: false,
      }))
    );
    showToast('Reset all transactions and credit splits to default business logic rules.');
  }, []);

  // Clear all prompt & handlers (allows clearing active workspace only or all including saved)
  const handlePromptClearAll = () => {
    setIsClearConfirmOpen(true);
  };

  const handleClearCurrentOnly = () => {
    const count = transactions.length;
    setTransactions([]);
    clearCreditOverrides();
    setCreditOverrides({});
    setIsClearConfirmOpen(false);
    showToast(`Cleared ${count} active transaction${count === 1 ? '' : 's'}. Saved statements preserved.`);
  };

  const handleClearAllIncludingSaved = () => {
    const totalTx =
      transactions.length + savedStatements.reduce((sum, s) => sum + s.transactions.length, 0);
    const totalStmts = savedStatements.length;
    setTransactions([]);
    setSavedStatements([]);
    clearCreditOverrides();
    setCreditOverrides({});
    clearManualOverrides();
    clearDeletedSignatures();
    setActiveStatementName('Statement 1');
    setIsClearConfirmOpen(false);
    showToast(`Cleared all ${totalTx} transactions across active workspace and ${totalStmts} saved statement${totalStmts === 1 ? '' : 's'}.`);
  };

  // Load sample dataset
  const handleLoadSample = () => {
    const sample = getSampleCSVString();
    const { transactions: sampleTx } = parseCSVData(sample);
    clearCreditOverrides();
    setCreditOverrides({});
    setTransactions(applyDeletedSignatures(sampleTx));
    setActiveStatementName('August 2026 Statement');
    showToast(`Loaded sample dataset with ${sampleTx.length} transactions.`);
  };

  // Export all transactions
  const handleExportAll = () => {
    if (transactions.length === 0) {
      showToast('No transactions to export.');
      return;
    }
    const cleanFileName = (activeStatementName || 'transactions').replace(/[^a-z0-9_-]/gi, '_');
    exportTransactionsToCSV(transactions, `${cleanFileName}_analyzed.csv`);
    showToast(`Exported ${transactions.length} transactions to CSV!`);
  };

  // Export summary breakdown
  const handleExportSummary = () => {
    if (transactions.length === 0) {
      showToast('No data to export.');
      return;
    }

    const categories: CategoryType[] = ['Andrew', 'Rachel', 'Leisure'];
    let totalDebit = 0;
    let totalAllocated = 0;

    const summaries: CategorySummary[] = categories.map((cat) => {
      const txs = transactions.filter((t) => !t.isDeleted && t.category === cat);
      const catDebit = txs.reduce((sum, t) => sum + (t.debit || 0), 0);
      const catCredit = txs.reduce((sum, t) => sum + (t.credit || 0), 0);
      const allocatedCredit = activeTotals[cat.toLowerCase() as 'andrew' | 'rachel' | 'leisure']?.allocatedCredit ?? catCredit;
      const netSpend = activeTotals[cat.toLowerCase() as 'andrew' | 'rachel' | 'leisure']?.netSpend ?? (catDebit - allocatedCredit);

      totalDebit += catDebit;
      totalAllocated += allocatedCredit;

      return {
        category: cat,
        totalDebit: catDebit,
        totalCredit: catCredit,
        allocatedCredit,
        isCreditOverridden: creditOverrides[cat] !== undefined && creditOverrides[cat] !== null,
        netSpend,
        count: txs.length,
        percentage: 0,
        color: CATEGORY_COLORS[cat].bg,
        badgeBg: CATEGORY_COLORS[cat].badgeBg,
        textColor: CATEGORY_COLORS[cat].text,
      };
    });

    const totalNet = totalDebit - totalAllocated;
    summaries.forEach((s) => {
      s.percentage = totalNet !== 0 ? (s.netSpend / totalNet) * 100 : 0;
    });

    exportSummariesToCSV(summaries, totalNet, totalDebit, totalAllocated);
    showToast('Exported spending category summary to CSV!');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200 selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl shadow-xl border border-slate-700/50 text-xs font-semibold animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navbar with Upload Statement Button */}
      <Navbar
        transactionCount={activeTransactionsCount}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        onLoadSample={handleLoadSample}
        onExportAll={handleExportAll}
        onExportSummary={handleExportSummary}
        onClearAll={(transactions.length > 0 || savedStatements.length > 0) ? handlePromptClearAll : undefined}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        savedStatementsCount={savedStatements.length}
        onSaveCurrentStatement={transactions.length > 0 ? handleOpenSaveModal : undefined}
        onScrollToSavedStatements={savedStatements.length > 0 ? handleScrollToSavedStatements : undefined}
        onOpenRemainingBalanceModal={() => setIsRemainingBalanceModalOpen(true)}
        hasRemainingBalances={hasRemainingBalances}
      />

      {/* Main Content Container (Import Statement section removed from top as requested) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* 1. Saved Statements & Multi-File Carried-Over Summary Panel */}
        <div id="saved-statements-section">
          <SavedStatementsPanel
            savedStatements={savedStatements}
            carriedOverTotals={carriedOverTotals}
            activeStatementName={activeStatementName}
            activeTotals={activeTotals}
            onReopenStatement={handleReopenStatement}
            onDeleteStatement={handleDeleteSavedStatement}
            onClearAllSaved={handleClearAllSaved}
            onSaveCurrentStatement={handleOpenSaveModal}
            activeTransactionCount={activeTransactionsCount}
            onRenameStatement={handleRenameSavedStatement}
            remainingBalances={remainingBalances}
            onOpenRemainingBalanceModal={() => setIsRemainingBalanceModalOpen(true)}
          />
        </div>

        {/* 2. Transaction Table with Row Category Dropdowns & Quick Batch Actions */}
        <div id="transactions-ledger" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Transactions Ledger
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {activeTransactionsCount} Records
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRemainingBalanceModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs active:scale-95 ${
                  hasRemainingBalances
                    ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700'
                    : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-800/80'
                }`}
                title="Store or adjust starting Remaining Balance cutoff baseline across Andrew, Rachel, and Leisure"
              >
                <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{hasRemainingBalances ? `Remaining Cutoff (${formatCurrency(totalRemaining)})` : 'Remaining Balance'}</span>
              </button>
            </div>
          </div>

          <TransactionTable
            transactions={transactions}
            onUpdateCategory={handleUpdateCategory}
            onBulkUpdateCategory={handleBulkUpdateCategory}
            onDeleteTransaction={handleDeleteTransaction}
            onDeleteBulkTransactions={handleDeleteBulkTransactions}
            onUndeleteTransaction={handleUndeleteTransaction}
            onUndeleteBulkTransactions={handleUndeleteBulkTransactions}
            onAddTransaction={handleAddTransaction}
            onResetToDefaultRules={handleResetToDefaultRules}
            onClearAll={(transactions.length > 0 || savedStatements.length > 0) ? handlePromptClearAll : undefined}
            selectedCategoryFilter={selectedCategoryFilter}
            onSelectCategoryFilter={setSelectedCategoryFilter}
            activeStatementName={activeStatementName}
            onSaveCurrentStatement={transactions.length > 0 ? handleOpenSaveModal : undefined}
            onOpenUploadModal={() => setIsUploadModalOpen(true)}
          />
        </div>

        {/* 3. Spending & Category Analytics Section */}
        <div id="analytics-section" className="pt-2">
          <Dashboard
            transactions={transactions}
            creditOverrides={creditOverrides}
            onUpdateCreditOverride={handleUpdateCreditOverride}
            onResetAllCreditOverrides={handleResetAllCreditOverrides}
            onBulkUpdateCreditOverrides={handleBulkUpdateCreditOverrides}
            selectedCategoryFilter={selectedCategoryFilter}
            onSelectCategoryFilter={(cat) => setSelectedCategoryFilter(cat)}
            savedStatements={savedStatements}
            activeStatementName={activeStatementName}
            remainingBalances={remainingBalances}
            onOpenRemainingBalanceModal={() => setIsRemainingBalanceModalOpen(true)}
          />
        </div>

        {/* 4. Bottom Workspace Status & Clear Actions Bar */}
        <div className="pt-6 pb-2 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Workspace Scope:
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {transactions.length} Active Records
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {savedStatements.length} Saved Statement{savedStatements.length === 1 ? '' : 's'}
            </span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsRemainingBalanceModalOpen(true)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                hasRemainingBalances
                  ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700 hover:bg-purple-200'
                  : 'bg-slate-100 dark:bg-slate-800 text-purple-700 dark:text-purple-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
              }`}
            >
              <Scale className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>{hasRemainingBalances ? `Cutoff Active: ${formatCurrency(totalRemaining)}` : 'Set Remaining Balance'}</span>
            </button>
          </div>

          {(transactions.length > 0 || savedStatements.length > 0) && (
            <button
              type="button"
              onClick={handlePromptClearAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer shadow-2xs"
              title="Clear active transactions or all saved statements"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Clear Workspace Transactions</span>
            </button>
          )}
        </div>
      </main>

      {/* Global File Upload Modal (Drag & Drop or Click Browse) */}
      <FileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onImportSuccess={handleImportSuccess}
        currentCount={transactions.length}
        savedStatementsCount={savedStatements.length}
        carriedOverNetTotal={carriedOverTotals.totalNetSpend}
        activeStatementName={activeStatementName}
      />

      {/* In-App Reopen / Edit Confirmation Modal */}
      <ReopenConfirmModal
        isOpen={Boolean(statementToReopen)}
        onClose={() => setStatementToReopen(null)}
        targetStatement={statementToReopen}
        currentCount={transactions.length}
        currentStatementName={activeStatementName}
        onConfirmSaveAndOpen={handleConfirmSaveAndOpen}
        onConfirmDiscardAndOpen={handleConfirmDiscardAndOpen}
      />

      {/* Save Statement Modal */}
      <SaveStatementModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        defaultName={activeStatementName}
        totals={activeTotals}
        transactionCount={transactions.length}
        onSave={handleSaveStatement}
        onOpenNextPdfPicker={() => {
          setIsSaveModalOpen(false);
          setIsUploadModalOpen(true);
        }}
      />

      {/* Clear All Confirmation Modal (Scope Choice: Current Active Only vs All Including Saved) */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl animate-scale-in space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Clear Transactions & Data
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Choose whether you want to clear only the active transactions in your current workspace, or delete all saved statements as well.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope Selection Options */}
            <div className="space-y-3 pt-1">
              {/* Option 1: Current Transactions Only */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Clear Current Transactions Only
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      {transactions.length} active
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                    Deletes active transactions from <span className="font-semibold">{activeStatementName || 'Current Statement'}</span> and resets active credit offsets. Your <span className="font-semibold">{savedStatements.length} saved statement{savedStatements.length === 1 ? '' : 's'}</span> will remain completely safe.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={transactions.length === 0}
                  onClick={handleClearCurrentOnly}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Current ({transactions.length})
                </button>
              </div>

              {/* Option 2: Delete All (Including Saved Statements) */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-400 dark:hover:border-rose-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-rose-900 dark:text-rose-200">
                      Clear Everything (Including Saved)
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-200/80 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200">
                      {transactions.length + savedStatements.reduce((sum, s) => sum + s.transactions.length, 0)} total records
                    </span>
                  </div>
                  <p className="text-xs text-rose-700/80 dark:text-rose-300/80 leading-relaxed max-w-sm">
                    Permanently deletes all active transactions, active credit offsets, and all <span className="font-semibold">{savedStatements.length} saved statement{savedStatements.length === 1 ? '' : 's'}</span> ({savedStatements.reduce((sum, s) => sum + s.transactions.length, 0)} archived transactions). Resets the app to a blank workspace.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={transactions.length === 0 && savedStatements.length === 0}
                  onClick={handleClearAllIncludingSaved}
                  className="px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shrink-0 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete All Data
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel / Keep Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Guide Modal */}
      <RulesGuideModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        onReapplyDefaults={handleResetToDefaultRules}
      />

      {/* Remaining Balance & Statement Cutoff Modal */}
      <RemainingBalanceModal
        isOpen={isRemainingBalanceModalOpen}
        onClose={() => setIsRemainingBalanceModalOpen(false)}
        currentBalances={remainingBalances}
        onSave={handleSaveRemainingBalances}
        onClear={handleClearRemainingBalances}
        currentNetByBucket={currentNetByBucket}
        savedStatementCount={savedStatements.length}
        activeTransactionCount={transactions.length}
      />
    </div>
  );
}
