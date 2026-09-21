import React, { useState } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  Edit2,
  CheckCircle2,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  ArrowRight,
  PlusCircle,
  AlertCircle,
  Check,
  X,
  Scale,
} from 'lucide-react';
import { RemainingBalances, SavedStatement, SavedStatementTotals } from '../types';
import { formatCurrency, exportTransactionsToCSV } from '../utils/csvHelper';

interface SavedStatementsPanelProps {
  savedStatements: SavedStatement[];
  carriedOverTotals: SavedStatementTotals;
  activeStatementName: string;
  activeTotals: SavedStatementTotals;
  onReopenStatement: (statementId: string) => void;
  onDeleteStatement: (statementId: string) => void;
  onClearAllSaved: () => void;
  onSaveCurrentStatement: () => void;
  activeTransactionCount: number;
  onRenameStatement?: (statementId: string, newName: string) => void;
  remainingBalances?: RemainingBalances;
  onOpenRemainingBalanceModal?: () => void;
}

export const SavedStatementsPanel: React.FC<SavedStatementsPanelProps> = ({
  savedStatements,
  carriedOverTotals,
  activeStatementName,
  activeTotals,
  onReopenStatement,
  onDeleteStatement,
  onClearAllSaved,
  onSaveCurrentStatement,
  activeTransactionCount,
  onRenameStatement,
  remainingBalances,
  onOpenRemainingBalanceModal,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedStatementId, setExpandedStatementId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);

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

  if (savedStatements.length === 0 && activeTransactionCount === 0 && !hasRemainingBalances) {
    return null;
  }

  const grandTotal = activeTotals.totalNetSpend + carriedOverTotals.totalNetSpend;
  const effectiveGrandTotal = Math.round((grandTotal + totalRemaining) * 100) / 100;

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveRename = (id: string) => {
    if (editingName.trim()) {
      onRenameStatement?.(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
      {/* Header bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-purple-50/20 dark:from-slate-900 dark:via-indigo-950/20 dark:to-purple-950/20 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Multi-Statement Carryover
              </h2>
              {savedStatements.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {savedStatements.length} Saved {savedStatements.length === 1 ? 'Statement' : 'Statements'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Lock and roll forward monthly statement totals and custom credit allocations to next files.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {onOpenRemainingBalanceModal && (
            <button
              type="button"
              onClick={onOpenRemainingBalanceModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xs active:scale-95 cursor-pointer ${
                hasRemainingBalances
                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Store persistent Remaining Balance cutoff values for each bucket to stop loading statements perpetually"
            >
              <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>{hasRemainingBalances ? `Cutoff Active (${formatCurrency(totalRemaining)})` : 'Remaining Balance'}</span>
            </button>
          )}

          {activeTransactionCount > 0 && (
            <button
              type="button"
              onClick={onSaveCurrentStatement}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Save current active workspace statement & carry forward totals"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save &amp; Carry Over</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Remaining Balance Cutoff Active Banner */}
          {hasRemainingBalances && (
            <div className="p-3.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-600 text-white shrink-0 shadow-xs">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-950 dark:text-purple-200">
                      Remaining Balance Cutoff Active:
                    </span>
                    <span className="font-extrabold text-purple-700 dark:text-purple-300">
                      {formatCurrency(totalRemaining)} Total
                    </span>
                    {remainingBalances?.asOfDate && (
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                        (As of {remainingBalances.asOfDate})
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-purple-900/80 dark:text-purple-300/80 flex items-center flex-wrap gap-3 mt-0.5">
                    <span>Andrew/Natalie: <strong>{formatCurrency(remainingBalances?.Andrew || 0)}</strong></span>
                    <span>Rachel: <strong>{formatCurrency(remainingBalances?.Rachel || 0)}</strong></span>
                    <span>Leisure: <strong>{formatCurrency(remainingBalances?.Leisure || 0)}</strong></span>
                  </div>
                </div>
              </div>
              {onOpenRemainingBalanceModal && (
                <button
                  type="button"
                  onClick={onOpenRemainingBalanceModal}
                  className="self-start sm:self-auto px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700 border border-purple-200 dark:border-purple-700 transition-colors cursor-pointer shadow-2xs"
                >
                  Adjust Cutoff
                </button>
              )}
            </div>
          )}

          {/* Top Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Active Statement Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Workspace
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                  {activeStatementName}
                </span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrency(activeTotals.totalNetSpend)}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <span>{activeTransactionCount} items</span>
                <span>Gross: {formatCurrency(activeTotals.totalDebit)}</span>
              </div>
            </div>

            {/* Total Carried Over Card */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Total Carried Over
                </span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {savedStatements.length} saved statement{savedStatements.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="text-xl font-extrabold text-indigo-950 dark:text-indigo-100">
                {formatCurrency(carriedOverTotals.totalNetSpend)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300 pt-1 border-t border-indigo-200/80 dark:border-indigo-800/60">
                <span className="text-purple-600 dark:text-purple-400 font-semibold">
                  A: {formatCurrency(carriedOverTotals.andrew.netSpend)}
                </span>
                <span className="text-pink-600 dark:text-pink-400 font-semibold">
                  R: {formatCurrency(carriedOverTotals.rachel.netSpend)}
                </span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold">
                  L: {formatCurrency(carriedOverTotals.leisure.netSpend)}
                </span>
              </div>
            </div>

            {/* Combined Grand Total Card */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                  Combined Grand Total
                </span>
                <span className="text-xs font-semibold text-indigo-200">
                  {activeTransactionCount + carriedOverTotals.count} total txns
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {formatCurrency(effectiveGrandTotal)}
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/10 text-indigo-200">
                <span>Active ({formatCurrency(activeTotals.totalNetSpend)})</span>
                {hasRemainingBalances ? (
                  <span>+ Carried &amp; Cutoff ({formatCurrency(carriedOverTotals.totalNetSpend + totalRemaining)})</span>
                ) : (
                  <span>+ Carried ({formatCurrency(carriedOverTotals.totalNetSpend)})</span>
                )}
              </div>
            </div>
          </div>

          {/* List of Saved Statements */}
          {savedStatements.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Saved Statements Carried Over ({savedStatements.length})
                </h3>
                {isConfirmingClearAll ? (
                  <div className="flex items-center gap-1.5 text-xs animate-fade-in">
                    <span className="text-rose-600 font-bold">Clear all history?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearAllSaved();
                        setIsConfirmingClearAll(false);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer"
                    >
                      Yes, Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearAll(false)}
                      className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAll(true)}
                    className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear Carried-Over History
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {savedStatements.map((stmt, idx) => {
                  const isItemExpanded = expandedStatementId === stmt.id;
                  const isEditingThis = editingId === stmt.id;
                  const isConfirmingDelete = confirmDeleteId === stmt.id;

                  return (
                    <div
                      key={stmt.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-2xs"
                    >
                      <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            {isEditingThis ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(stmt.id);
                                    if (e.key === 'Escape') handleCancelRename();
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                  autoFocus
                                  className="px-2 py-0.5 text-xs font-bold rounded border border-indigo-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveRename(stmt.id)}
                                  className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                  title="Save name"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelRename}
                                  className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                  title="Cancel"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {stmt.name}
                                </span>
                                {onRenameStatement && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartRename(stmt.id, stmt.name)}
                                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                                    title="Rename statement"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                                {stmt.fileName && stmt.fileName !== stmt.name && (
                                  <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                    ({stmt.fileName})
                                  </span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {stmt.savedAt}
                              </span>
                              <span>•</span>
                              <span>{stmt.totals.count} transactions</span>
                            </div>
                          </div>
                        </div>

                        {/* Statement totals pill & actions */}
                        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                          <div className="text-right mr-1">
                            <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                              {formatCurrency(stmt.totals.totalNetSpend)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              A: {formatCurrency(stmt.totals.andrew.netSpend)} | R: {formatCurrency(stmt.totals.rachel.netSpend)} | L: {formatCurrency(stmt.totals.leisure.netSpend)}
                            </div>
                          </div>

                          {/* Toggle breakdown */}
                          <button
                            type="button"
                            onClick={() => setExpandedStatementId(isItemExpanded ? null : stmt.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title={isItemExpanded ? 'Hide breakdown' : 'Show details'}
                          >
                            {isItemExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {/* Reopen in editor button */}
                          <button
                            type="button"
                            onClick={() => onReopenStatement(stmt.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-95 shadow-2xs cursor-pointer"
                            title="Load back into active workspace to edit transactions, reassign categories, and adjust credit allocations"
                          >
                            <Edit2 className="w-3 h-3 text-indigo-200" />
                            <span>Edit</span>
                          </button>

                          {/* Export CSV */}
                          <button
                            type="button"
                            onClick={() => exportTransactionsToCSV(stmt.transactions, `${stmt.name.replace(/[^a-z0-9]/gi, '_')}.csv`)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Download CSV for this statement"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          {isConfirmingDelete ? (
                            <div className="flex items-center gap-1 text-[11px] animate-fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteStatement(stmt.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(stmt.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              title="Remove statement from carried-over list"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable breakdown for this statement */}
                      {isItemExpanded && (
                        <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-purple-700 dark:text-purple-300">Andrew/Natalie:</span>
                            <div className="mt-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                              <span>Net: <strong>{formatCurrency(stmt.totals.andrew.netSpend)}</strong></span>
                              <span className="text-[10px] text-slate-400">Gross: {formatCurrency(stmt.totals.andrew.debit)}</span>
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-pink-700 dark:text-pink-300">Rachel:</span>
                            <div className="mt-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                              <span>Net: <strong>{formatCurrency(stmt.totals.rachel.netSpend)}</strong></span>
                              <span className="text-[10px] text-slate-400">Gross: {formatCurrency(stmt.totals.rachel.debit)}</span>
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-sky-700 dark:text-sky-300">Leisure:</span>
                            <div className="mt-1 flex items-center justify-between text-slate-600 dark:text-slate-300">
                              <span>Net: <strong>{formatCurrency(stmt.totals.leisure.netSpend)}</strong></span>
                              <span className="text-[10px] text-slate-400">Gross: {formatCurrency(stmt.totals.leisure.debit)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
