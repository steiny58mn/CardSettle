import React, { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Check,
  ChevronDown,
  Sparkles,
  Trash2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  User,
  Palmtree,
  CreditCard,
  Edit2,
  X,
  FileSpreadsheet,
  BookmarkCheck,
  FileText,
  Upload,
  LayoutList,
  Table,
  RotateCcw,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { CategoryType, Transaction } from '../types';
import { formatCurrency } from '../utils/csvHelper';
import { isPaymentOrCredit } from '../utils/rulesEngine';

const RAW_CATEGORY_PALETTES: Record<string, string> = {
  merchandise: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  dining: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  travel: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  entertainment: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  groceries: 'bg-lime-50 dark:bg-lime-950/60 text-lime-700 dark:text-lime-300 border-lime-200 dark:border-lime-800',
  gasoline: 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  healthcare: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  payment: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  'fee/interest charge': 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
};

const DYNAMIC_PALETTES = [
  'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  'bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800',
  'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
];

function getCategoryBadgeColor(category: string): string {
  if (!category) return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  const key = category.trim().toLowerCase();
  if (RAW_CATEGORY_PALETTES[key]) {
    return RAW_CATEGORY_PALETTES[key];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DYNAMIC_PALETTES.length;
  return DYNAMIC_PALETTES[index];
}

const CATEGORY_ORDER: Record<CategoryType, number> = {
  Andrew: 1,
  Rachel: 2,
  Leisure: 3,
};

interface TransactionTableProps {
  transactions: Transaction[];
  onUpdateCategory: (id: string, newCategory: CategoryType) => void;
  onBulkUpdateCategory: (ids: string[], newCategory: CategoryType) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteBulkTransactions: (ids: string[]) => void;
  onUndeleteTransaction: (id: string) => void;
  onUndeleteBulkTransactions: (ids: string[]) => void;
  onAddTransaction: (newTx: Omit<Transaction, 'id'>) => void;
  onResetToDefaultRules: () => void;
  onClearAll?: () => void;
  selectedCategoryFilter: string;
  onSelectCategoryFilter: (cat: string) => void;
  activeStatementName?: string;
  onSaveCurrentStatement?: () => void;
  onOpenUploadModal?: () => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onUpdateCategory,
  onBulkUpdateCategory,
  onDeleteTransaction,
  onDeleteBulkTransactions,
  onUndeleteTransaction,
  onUndeleteBulkTransactions,
  onAddTransaction,
  onResetToDefaultRules,
  onClearAll,
  selectedCategoryFilter,
  onSelectCategoryFilter,
  activeStatementName,
  onSaveCurrentStatement,
  onOpenUploadModal,
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCardFilter, setSelectedCardFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'DELETED' | 'ALL'>('ACTIVE');
  const [sortBy, setSortBy] = useState<'category' | 'date' | 'description' | 'amount' | 'card'>('category');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Selection & Pagination State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [viewMode, setViewMode] = useState<'auto' | 'table' | 'cards'>('auto');

  // Modal State for adding new transaction
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newCard, setNewCard] = useState('3810');
  const [newDescription, setNewDescription] = useState('');
  const [newDebit, setNewDebit] = useState('');
  const [newCredit, setNewCredit] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryType>('Rachel');

  // Counts of deleted and active transactions
  const deletedCount = useMemo(() => transactions.filter((t) => t.isDeleted).length, [transactions]);
  const activeCount = useMemo(() => transactions.filter((t) => !t.isDeleted).length, [transactions]);

  // Extract unique cards for filter
  const uniqueCards = useMemo(() => {
    const cards = Array.from(new Set(transactions.map((t) => t.cardNumber).filter(Boolean)));
    return cards.sort();
  }, [transactions]);

  // Filtered and Sorted list
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        // Filter by status: ACTIVE, DELETED, or ALL
        if (statusFilter === 'ACTIVE' && t.isDeleted) {
          return false;
        }
        if (statusFilter === 'DELETED' && !t.isDeleted) {
          return false;
        }

        // Search term filter
        if (searchTerm.trim()) {
          const s = searchTerm.toLowerCase();
          const matchesDesc = t.description.toLowerCase().includes(s);
          const matchesCard = t.cardNumber.toLowerCase().includes(s);
          const matchesDate = t.transactionDate.includes(s) || t.postedDate.includes(s);
          const matchesCat = t.category.toLowerCase().includes(s);
          const matchesAmount =
            t.debit.toString().includes(s) ||
            t.credit.toString().includes(s) ||
            (t.debit - t.credit).toString().includes(s);

          if (!matchesDesc && !matchesCard && !matchesDate && !matchesCat && !matchesAmount) {
            return false;
          }
        }

        // Category filter
        if (selectedCategoryFilter !== 'ALL' && t.category !== selectedCategoryFilter) {
          return false;
        }

        // Card filter
        if (selectedCardFilter !== 'ALL' && t.cardNumber !== selectedCardFilter) {
          return false;
        }

        // Type filter (Debit or Credit)
        if (typeFilter === 'DEBIT' && t.debit <= 0) return false;
        if (typeFilter === 'CREDIT' && t.credit <= 0) return false;

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'category') {
          const rankA = CATEGORY_ORDER[a.category] || 99;
          const rankB = CATEGORY_ORDER[b.category] || 99;
          comp = rankA - rankB;
          if (comp === 0) {
            comp = (b.transactionDate || '').localeCompare(a.transactionDate || '');
          }
        } else if (sortBy === 'date') {
          const dateA = a.transactionDate || a.postedDate || '';
          const dateB = b.transactionDate || b.postedDate || '';
          comp = dateA.localeCompare(dateB);
        } else if (sortBy === 'description') {
          comp = a.description.localeCompare(b.description);
        } else if (sortBy === 'card') {
          comp = a.cardNumber.localeCompare(b.cardNumber);
        } else if (sortBy === 'amount') {
          const netA = a.debit - a.credit;
          const netB = b.debit - b.credit;
          comp = netA - netB;
        }

        return sortDirection === 'asc' ? comp : -comp;
      });
  }, [transactions, statusFilter, searchTerm, selectedCategoryFilter, selectedCardFilter, typeFilter, sortBy, sortDirection]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  // Handle Sort Toggle
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection(column === 'category' ? 'asc' : 'desc');
    }
  };

  // Bulk Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allCurrent = new Set(paginatedTransactions.map((t) => t.id));
      setSelectedIds(allCurrent);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectRow = (id: string) => {
    const updated = new Set(selectedIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedIds(updated);
  };

  // Selected items breakdown (active vs deleted)
  const selectedList = useMemo(() => {
    return filteredTransactions.filter((t) => selectedIds.has(t.id));
  }, [filteredTransactions, selectedIds]);

  const selectedActiveIds = useMemo(() => {
    return selectedList.filter((t) => !t.isDeleted).map((t) => t.id);
  }, [selectedList]);

  const selectedDeletedIds = useMemo(() => {
    return selectedList.filter((t) => t.isDeleted).map((t) => t.id);
  }, [selectedList]);

  const handleBulkAssign = (cat: CategoryType) => {
    // Cannot assign bucket to deleted records
    if (selectedActiveIds.length === 0) return;
    onBulkUpdateCategory(selectedActiveIds, cat);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedActiveIds.length === 0) return;
    if (window.confirm(`Delete ${selectedActiveIds.length} selected record(s)?`)) {
      onDeleteBulkTransactions(selectedActiveIds);
      setSelectedIds(new Set());
    }
  };

  const handleBulkUndelete = () => {
    if (selectedDeletedIds.length === 0) return;
    onUndeleteBulkTransactions(selectedDeletedIds);
    setSelectedIds(new Set());
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const debitVal = parseFloat(newDebit) || 0;
    const creditVal = parseFloat(newCredit) || 0;

    if (!newDescription.trim() && debitVal === 0 && creditVal === 0) {
      return;
    }

    onAddTransaction({
      transactionDate: newDate,
      postedDate: newDate,
      cardNumber: newCard.trim() || 'Manual',
      description: newDescription.trim() || 'Manual Entry',
      debit: debitVal,
      credit: creditVal,
      category: newCategory,
      isManuallyChanged: true,
    });

    // Reset modal form
    setNewDescription('');
    setNewDebit('');
    setNewCredit('');
    setIsAddModalOpen(false);
  };

  const isAllPaginatedSelected =
    paginatedTransactions.length > 0 &&
    paginatedTransactions.every((t) => selectedIds.has(t.id));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Transactions Categorization Table
              </h3>
              {activeStatementName && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {activeStatementName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {statusFilter === 'DELETED' ? (
                <>Showing {filteredTransactions.length} of {deletedCount} deleted records (excluded from totals).</>
              ) : statusFilter === 'ALL' ? (
                <>Showing {filteredTransactions.length} of {transactions.length} total records ({activeCount} active, {deletedCount} deleted).</>
              ) : (
                <>Showing {filteredTransactions.length} of {activeCount} active records{deletedCount > 0 && ` (${deletedCount} deleted hidden)`}.</>
              )}
              {' '}Use the dropdown in each row to re-assign categories.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* View Mode Toggle: Cards (Mobile friendly full vendor names) vs Table */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('auto')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'auto'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Responsive View (Cards on mobile, table on desktop)"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Mobile Cards (Full vendor name visible)"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Full Data Table"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            {/* Record Status Filter: Active / Deleted / All */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ACTIVE');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="View active transactions (included in totals)"
              >
                Active ({activeCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter(statusFilter === 'DELETED' ? 'ACTIVE' : 'DELETED');
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'DELETED'
                    ? 'bg-rose-600 text-white shadow-2xs font-bold'
                    : deletedCount > 0
                    ? 'bg-amber-100/70 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-200/80 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title={statusFilter === 'DELETED' ? 'Switch back to active records' : 'Show deleted records (excluded from totals)'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Deleted ({deletedCount})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="View all records (both active and deleted)"
              >
                All ({transactions.length})
              </button>
            </div>

            {onSaveCurrentStatement && transactions.length > 0 && (
              <button
                onClick={onSaveCurrentStatement}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer"
                title="Save & lock this statement's categories and totals before importing the next file"
              >
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>Save Statement</span>
              </button>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Transaction
            </button>

            <button
              onClick={onResetToDefaultRules}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Reset all categories to default rules: Card 3810 -> Rachel, 2642/6744 -> Andrew, Travel -> Leisure"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>

            {onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                title="Clear transactions or all workspace data"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2">
          {/* Search Input */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search description, card, date..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="lg:col-span-4 flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'Andrew', 'Rachel', 'Leisure'] as const).map((cat) => {
              const isSelected = selectedCategoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    onSelectCategoryFilter(cat);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? cat === 'Andrew'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : cat === 'Rachel'
                        ? 'bg-pink-400 text-white shadow-2xs'
                        : cat === 'Leisure'
                        ? 'bg-sky-500 text-white shadow-2xs'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat === 'ALL' ? 'All Categories' : cat === 'Andrew' ? 'Andrew/Natalie' : cat}
                </button>
              );
            })}
          </div>

          {/* Card Filter Dropdown */}
          <div className="lg:col-span-2">
            <select
              value={selectedCardFilter}
              onChange={(e) => {
                setSelectedCardFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Cards / Accounts ({transactions.length})</option>
              {uniqueCards.map((card) => {
                let label = card;
                if (card.toLowerCase() === 'travel') label = 'Travel (Capital One Travel)';
                else if (card.includes('3810') || card.endsWith('3810')) label += ' (Rachel)';
                else if (card.includes('6744') || card.endsWith('6744')) label += ' (Natalie)';
                else if (card.includes('2642') || card.endsWith('2642')) label += ' (Andrew)';
                return (
                  <option key={card} value={card}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Debit/Credit Type Filter */}
          <div className="lg:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Types (Debit & Credit)</option>
              <option value="DEBIT">Debits Only</option>
              <option value="CREDIT">Credits / Refunds Only</option>
            </select>
          </div>
        </div>

        {/* Deleted Records Banner Notice */}
        {statusFilter === 'DELETED' && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-rose-900 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <div>
                <span className="font-bold">
                  Viewing {filteredTransactions.length} of {deletedCount} Deleted Record{deletedCount === 1 ? '' : 's'}
                </span>
                <span className="text-rose-700/80 dark:text-rose-300/80 ml-1">
                  (Excluded from spending totals & preserved across re-imports).
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {deletedCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    onUndeleteBulkTransactions(
                      transactions.filter((t) => t.isDeleted).map((t) => t.id)
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors shadow-2xs cursor-pointer"
                  title="Restore all deleted records back to active totals"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undelete All ({deletedCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ACTIVE');
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Back to Active ({activeCount})
              </button>
            </div>
          </div>
        )}

        {/* Batch Operations Bar (Visible when rows selected) */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/70 rounded-xl animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
              <Check className="w-4 h-4 text-indigo-600" />
              <span>
                {selectedIds.size} row(s) selected
                {selectedDeletedIds.length > 0 && ` (${selectedDeletedIds.length} deleted)`}
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {selectedActiveIds.length > 0 && (
                <>
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Batch Assign:</span>
                  <button
                    type="button"
                    onClick={() => handleBulkAssign('Andrew')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer"
                  >
                    Andrew/Natalie
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAssign('Rachel')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-pink-400 hover:bg-pink-500 text-white shadow-2xs cursor-pointer"
                  >
                    Rachel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAssign('Leisure')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-sky-500 hover:bg-sky-600 text-white shadow-2xs cursor-pointer"
                  >
                    Leisure
                  </button>
                  <div className="h-4 w-px bg-indigo-200 dark:bg-indigo-700 mx-1" />
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/60 cursor-pointer"
                    title="Delete selected active records"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete ({selectedActiveIds.length})</span>
                  </button>
                </>
              )}
              {selectedDeletedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkUndelete}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer"
                  title="Restore selected deleted records"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Undelete ({selectedDeletedIds.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 ml-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Cards View (Optimized for mobile devices: full vendor names, touch-friendly 44px selectors) */}
      <div className={`p-3.5 space-y-3 ${viewMode === 'table' ? 'hidden' : viewMode === 'auto' ? 'block md:hidden' : 'block'}`}>
        {transactions.length === 0 ? (
          <div className="text-center py-10 text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-2">
              <FileText className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Active Transactions</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Upload your statement PDF or CSV to categorize transactions.
            </p>
            {onOpenUploadModal && (
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Statement</span>
              </button>
            )}
          </div>
        ) : paginatedTransactions.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
            {statusFilter === 'DELETED' && deletedCount === 0 ? (
              <div className="max-w-md mx-auto">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                  <Trash2 className="w-6 h-6" />
                </div>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Deleted Records</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  You currently have no deleted records. Click the trash icon on any transaction to remove it and exclude it from totals.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ACTIVE');
                    setCurrentPage(1);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
                >
                  View Active Records ({activeCount})
                </button>
              </div>
            ) : statusFilter === 'DELETED' && deletedCount > 0 ? (
              <div className="max-w-md mx-auto">
                <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">0 Deleted Records Match Current Filters</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  There {deletedCount === 1 ? 'is 1 deleted record' : `are ${deletedCount} deleted records`} in other categories or cards.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    onSelectCategoryFilter('ALL');
                    setSelectedCardFilter('ALL');
                    setTypeFilter('ALL');
                  }}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                >
                  Clear Filters to View All {deletedCount} Deleted Records
                </button>
              </div>
            ) : (
              <div>
                <SlidersHorizontal className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="font-semibold text-sm">No transactions match the selected filters</p>
                {deletedCount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {deletedCount} deleted record{deletedCount === 1 ? '' : 's'} hidden in Deleted tab.
                  </p>
                )}
                <div className="mt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      onSelectCategoryFilter('ALL');
                      setSelectedCardFilter('ALL');
                      setTypeFilter('ALL');
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Clear all filters
                  </button>
                  {deletedCount > 0 && (
                    <button
                      onClick={() => {
                        setStatusFilter('DELETED');
                        setCurrentPage(1);
                      }}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      View {deletedCount} Deleted Record{deletedCount === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          paginatedTransactions.map((tx) => {
            const isSelected = selectedIds.has(tx.id);
            return (
              <div
                key={tx.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  tx.isDeleted
                    ? isSelected
                      ? 'bg-rose-100/70 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 shadow-2xs border-dashed'
                      : 'bg-rose-50/20 dark:bg-rose-950/15 border-rose-200 dark:border-rose-900/60 shadow-2xs border-dashed opacity-85'
                    : isSelected
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-2xs'
                    : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-800 shadow-2xs'
                }`}
              >
                {/* Card Top: Checkbox, Date, Badges, Delete / Undelete button */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectRow(tx.id)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span
                      className={`font-mono text-xs font-semibold ${
                        tx.isDeleted
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tx.transactionDate}
                    </span>
                    {tx.postedDate && tx.postedDate !== tx.transactionDate && (
                      <span className="text-[10px] text-slate-400">Post: {tx.postedDate}</span>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-1.5 justify-end">
                    {/* Deleted Badge */}
                    {tx.isDeleted && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        Deleted
                      </span>
                    )}

                    {/* Card Badge */}
                    {tx.cardNumber && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${
                          tx.cardNumber.toLowerCase() === 'travel'
                            ? 'bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                            : tx.cardNumber.includes('3810')
                            ? 'bg-pink-50/80 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800'
                            : tx.cardNumber.includes('2642') || tx.cardNumber.includes('6744')
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {tx.cardNumber.toLowerCase() === 'travel' ? (
                          <>
                            <Palmtree className="w-3 h-3 text-teal-600" />
                            Travel
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-3 h-3" />
                            {tx.cardNumber.length === 4 ? `...${tx.cardNumber}` : tx.cardNumber}
                          </>
                        )}
                      </span>
                    )}

                    {/* Raw Category */}
                    {(tx.rawCategory || tx.category) && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${getCategoryBadgeColor(
                          tx.rawCategory || tx.category
                        )}`}
                      >
                        {tx.rawCategory || tx.category}
                      </span>
                    )}

                    {/* Row Action: Delete or Undelete */}
                    {tx.isDeleted ? (
                      <button
                        type="button"
                        onClick={() => onUndeleteTransaction(tx.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer ml-1"
                        title="Undelete record and restore to totals"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Undelete</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer ml-1"
                        title="Delete record from analysis and totals"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Full Vendor Name - Completely visible with NO truncation or clamping */}
                <div
                  className={`text-sm sm:text-base font-bold break-words leading-snug py-1 ${
                    tx.isDeleted
                      ? 'line-through text-slate-400 dark:text-slate-500'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {tx.description}
                </div>

                {/* Sub-tags */}
                <div className="flex items-center flex-wrap gap-1.5 mb-2.5">
                  {isPaymentOrCredit(tx) && (
                    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Payment / Credit
                    </span>
                  )}
                  {tx.isManuallyChanged ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      • Saved Override
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      • Auto Rule
                    </span>
                  )}
                </div>

                {/* Card Bottom: Amounts & Mobile-Optimized 44px Category Dropdown */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    {tx.debit > 0 && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-slate-400 font-medium">Debit:</span>
                        <span
                          className={`font-mono font-bold text-sm sm:text-base ${
                            tx.isDeleted
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {formatCurrency(tx.debit)}
                        </span>
                      </div>
                    )}
                    {tx.credit > 0 && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Credit:</span>
                        <span
                          className={`font-mono font-bold text-sm sm:text-base ${
                            tx.isDeleted
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          +{formatCurrency(tx.credit)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="relative w-full sm:w-44">
                    <select
                      value={tx.category}
                      onChange={(e) => onUpdateCategory(tx.id, e.target.value as CategoryType)}
                      disabled={tx.isDeleted}
                      title={
                        tx.isDeleted
                          ? 'Cannot change bucket while record is deleted. Undelete this record first.'
                          : undefined
                      }
                      className={`w-full appearance-none pl-3 pr-8 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold border transition-all shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                        tx.isDeleted
                          ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                          : tx.category === 'Andrew'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 cursor-pointer'
                          : tx.category === 'Rachel'
                          ? 'bg-pink-50/80 dark:bg-pink-950/40 text-pink-500 dark:text-pink-300 border-pink-200 dark:border-pink-800/80 cursor-pointer'
                          : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 cursor-pointer'
                      }`}
                    >
                      <option value="Andrew" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium">
                        Andrew/Natalie
                      </option>
                      <option value="Rachel" className="bg-pink-50 dark:bg-pink-950 text-pink-500 dark:text-pink-300 font-medium">
                        Rachel
                      </option>
                      <option value="Leisure" className="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-medium">
                        Leisure
                      </option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop / Large Screen Table View */}
      <div className={`overflow-x-auto ${viewMode === 'cards' ? 'hidden' : viewMode === 'auto' ? 'hidden md:block' : 'block'}`}>
        <table className="w-full text-left text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 uppercase text-[11px] tracking-wider font-semibold">
              <th className="py-3.5 pl-4 pr-2 w-10">
                <input
                  type="checkbox"
                  checked={isAllPaginatedSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              <th
                onClick={() => handleSort('date')}
                className="py-3.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('description')}
                className="py-3.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Description</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('amount')}
                className="py-3.5 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Debit</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('amount')}
                className="py-3.5 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Credit</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th
                onClick={() => handleSort('category')}
                className="py-3.5 pr-4 pl-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Assigned Category</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                </div>
              </th>
              <th className="py-3.5 pr-4 pl-2 text-right">
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Active Transactions in Workspace</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                      Upload your Capital One PDF statement or CSV to categorize transactions, adjust credit splits, and carry over totals.
                    </p>
                    {onOpenUploadModal && (
                      <button
                        type="button"
                        onClick={onOpenUploadModal}
                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer transition-all active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Statement</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-slate-500">
                  {statusFilter === 'DELETED' && deletedCount === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                        <Trash2 className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No Deleted Records</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        You currently have no deleted records. Click the trash icon (<Trash2 className="w-3 h-3 inline text-rose-500" />) on any transaction row in the Active view to exclude it from totals.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('ACTIVE');
                          setCurrentPage(1);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer"
                      >
                        View Active Records ({activeCount})
                      </button>
                    </div>
                  ) : statusFilter === 'DELETED' && deletedCount > 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
                      <AlertTriangle className="w-8 h-8 text-amber-500 mb-1" />
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">0 Deleted Records Match Current Filters</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                        There {deletedCount === 1 ? 'is 1 deleted record' : `are ${deletedCount} deleted records`} in other categories or cards.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          onSelectCategoryFilter('ALL');
                          setSelectedCardFilter('ALL');
                          setTypeFilter('ALL');
                        }}
                        className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                      >
                        Clear Filters to View All {deletedCount} Deleted Records
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <SlidersHorizontal className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-sm">No transactions match the selected filters</p>
                      {deletedCount > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {deletedCount} deleted record{deletedCount === 1 ? '' : 's'} are hidden in the Deleted tab.
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            onSelectCategoryFilter('ALL');
                            setSelectedCardFilter('ALL');
                            setTypeFilter('ALL');
                          }}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Clear all filters
                        </button>
                        {deletedCount > 0 && (
                          <button
                            onClick={() => {
                              setStatusFilter('DELETED');
                              setCurrentPage(1);
                            }}
                            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                          >
                            View {deletedCount} Deleted Record{deletedCount === 1 ? '' : 's'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((tx) => {
                const isSelected = selectedIds.has(tx.id);

                return (
                  <tr
                    key={tx.id}
                    className={`group transition-colors ${
                      tx.isDeleted
                        ? isSelected
                          ? 'bg-rose-100/60 dark:bg-rose-950/60'
                          : 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70 dark:hover:bg-rose-950/30'
                        : isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Row Checkbox */}
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(tx.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-xs">
                      <div className={tx.isDeleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-400'}>
                        {tx.transactionDate}
                      </div>
                      {tx.postedDate && tx.postedDate !== tx.transactionDate && (
                        <div className="text-[10px] text-slate-400">Post: {tx.postedDate}</div>
                      )}
                    </td>

                    {/* Description - Unconstrained with full vendor name wrapping */}
                    <td className="py-3 px-3">
                      <div
                        className={`font-semibold break-words whitespace-normal min-w-[200px] leading-snug ${
                          tx.isDeleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {tx.description}
                      </div>
                      <div className="flex items-center flex-wrap gap-1.5 mt-1">
                        {/* Deleted Badge */}
                        {tx.isDeleted && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            Deleted
                          </span>
                        )}

                        {/* Record Title / Card Badge */}
                        {tx.cardNumber && (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${
                              tx.cardNumber.toLowerCase() === 'travel'
                                ? 'bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                                : tx.cardNumber.includes('3810')
                                ? 'bg-pink-50/80 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800'
                                : tx.cardNumber.includes('2642') || tx.cardNumber.includes('6744')
                                ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {tx.cardNumber.toLowerCase() === 'travel' ? (
                              <>
                                <Palmtree className="w-3 h-3 text-teal-600" />
                                Travel
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-3 h-3" />
                                {tx.cardNumber.length === 4 ? `...${tx.cardNumber}` : tx.cardNumber}
                              </>
                            )}
                          </span>
                        )}

                        {/* Category Label from imported file Category column - color coded */}
                        {(tx.rawCategory || tx.category) && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md border shadow-2xs ${getCategoryBadgeColor(
                              tx.rawCategory || tx.category
                            )}`}
                          >
                            {tx.rawCategory || tx.category}
                          </span>
                        )}

                        {isPaymentOrCredit(tx) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Payment / Credit
                          </span>
                        )}

                        {tx.isManuallyChanged ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            • Saved Manual Override
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            • Auto Rule
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Debit */}
                    <td
                      className={`py-3 px-3 text-right font-mono font-semibold ${
                        tx.isDeleted
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                    </td>

                    {/* Credit */}
                    <td
                      className={`py-3 px-3 text-right font-mono font-semibold ${
                        tx.isDeleted
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {tx.credit > 0 ? formatCurrency(tx.credit) : '—'}
                    </td>

                    {/* Categorization Dropdown (Core Requirement - Disabled while deleted) */}
                    <td className="py-3 px-3">
                      <div className="relative inline-block w-36">
                        <select
                          value={tx.category}
                          onChange={(e) => onUpdateCategory(tx.id, e.target.value as CategoryType)}
                          disabled={tx.isDeleted}
                          title={
                            tx.isDeleted
                              ? 'Cannot change bucket while record is deleted. Undelete this record first.'
                              : undefined
                          }
                          className={`w-full appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                            tx.isDeleted
                              ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
                              : tx.category === 'Andrew'
                              ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 cursor-pointer'
                              : tx.category === 'Rachel'
                              ? 'bg-pink-50/80 dark:bg-pink-950/40 text-pink-500 dark:text-pink-300 border-pink-200 dark:border-pink-800/80 cursor-pointer'
                              : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800 cursor-pointer'
                          }`}
                        >
                          <option value="Andrew" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium">
                            Andrew/Natalie
                          </option>
                          <option value="Rachel" className="bg-pink-50 dark:bg-pink-950 text-pink-500 dark:text-pink-300 font-medium">
                            Rachel
                          </option>
                          <option value="Leisure" className="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-medium">
                            Leisure
                          </option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                      </div>
                    </td>

                    {/* Actions Column: Delete / Undelete */}
                    <td className="py-3 pr-4 pl-2 text-right whitespace-nowrap">
                      {tx.isDeleted ? (
                        <button
                          type="button"
                          onClick={() => onUndeleteTransaction(tx.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors shadow-2xs cursor-pointer"
                          title="Undelete this record (restore to totals)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Undelete</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                          title="Delete record (removes from totals)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
          <span className="ml-2">
            Showing {(currentPage - 1) * pageSize + 1} -{' '}
            {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length} {statusFilter === 'DELETED' ? 'deleted records' : statusFilter === 'ALL' ? 'total records' : 'active records'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 font-semibold">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal: Add Manual Transaction */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Add New Transaction
              </h4>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Date
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Card No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3810, 2642, 6744"
                  value={newCard}
                  onChange={(e) => setNewCard(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Merchant
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flight to Miami (Travel)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Debit ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newDebit}
                    onChange={(e) => setNewDebit(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Credit ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newCredit}
                    onChange={(e) => setNewCredit(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as CategoryType)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  <option value="Andrew">Andrew/Natalie</option>
                  <option value="Rachel">Rachel</option>
                  <option value="Leisure">Leisure</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                >
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
