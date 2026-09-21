import React, { useState, useEffect } from 'react';
import {
  X,
  Scale,
  Sparkles,
  Info,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  History,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { CategoryType, RemainingBalances, SavedStatementTotals } from '../types';
import { formatCurrency } from '../utils/csvHelper';

interface RemainingBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalances: RemainingBalances;
  onSave: (
    newBalances: RemainingBalances,
    options: { clearSavedStatements: boolean; clearActiveTransactions: boolean }
  ) => void;
  onClear: () => void;
  currentNetByBucket: {
    Andrew: number;
    Rachel: number;
    Leisure: number;
    total: number;
  };
  savedStatementCount: number;
  activeTransactionCount: number;
}

export const RemainingBalanceModal: React.FC<RemainingBalanceModalProps> = ({
  isOpen,
  onClose,
  currentBalances,
  onSave,
  onClear,
  currentNetByBucket,
  savedStatementCount,
  activeTransactionCount,
}) => {
  const [andrewInput, setAndrewInput] = useState('');
  const [rachelInput, setRachelInput] = useState('');
  const [leisureInput, setLeisureInput] = useState('');
  const [asOfDate, setAsOfDate] = useState('');
  const [notes, setNotes] = useState('');
  const [clearSavedStatements, setClearSavedStatements] = useState(true);
  const [clearActiveTransactions, setClearActiveTransactions] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAndrewInput(currentBalances.Andrew ? currentBalances.Andrew.toFixed(2) : '0.00');
      setRachelInput(currentBalances.Rachel ? currentBalances.Rachel.toFixed(2) : '0.00');
      setLeisureInput(currentBalances.Leisure ? currentBalances.Leisure.toFixed(2) : '0.00');
      setAsOfDate(
        currentBalances.asOfDate ||
          new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      );
      setNotes(currentBalances.notes || '');
      setClearSavedStatements(savedStatementCount > 0);
      setClearActiveTransactions(false);
      setShowClearConfirm(false);
    }
  }, [isOpen, currentBalances, savedStatementCount]);

  if (!isOpen) return null;

  const parseNumber = (val: string): number => {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100;
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, rawVal: string) => {
    let clean = rawVal.replace(/[^0-9.-]/g, '');
    // Allow leading minus
    const isNegative = clean.startsWith('-');
    clean = clean.replace(/-/g, '');
    if (isNegative) clean = '-' + clean;

    const dotIndex = clean.indexOf('.');
    if (dotIndex !== -1) {
      const whole = clean.substring(0, dotIndex);
      const dec = clean.substring(dotIndex + 1).replace(/\./g, '').substring(0, 2);
      clean = `${whole}.${dec}`;
    }
    setter(clean);
  };

  const handleFillCurrentNet = () => {
    setAndrewInput(currentNetByBucket.Andrew.toFixed(2));
    setRachelInput(currentNetByBucket.Rachel.toFixed(2));
    setLeisureInput(currentNetByBucket.Leisure.toFixed(2));
    setNotes((prev) =>
      prev ? prev : `Snapshot cutoff based on ${savedStatementCount} prior statement(s)`
    );
  };

  const andrewNum = parseNumber(andrewInput);
  const rachelNum = parseNumber(rachelInput);
  const leisureNum = parseNumber(leisureInput);
  const totalBalance = Math.round((andrewNum + rachelNum + leisureNum) * 100) / 100;

  const handleSave = () => {
    const newBalances: RemainingBalances = {
      Andrew: andrewNum,
      Rachel: rachelNum,
      Leisure: leisureNum,
      enabled: true,
      asOfDate: asOfDate.trim(),
      notes: notes.trim(),
    };
    onSave(newBalances, {
      clearSavedStatements,
      clearActiveTransactions,
    });
    onClose();
  };

  const hasExistingBalance =
    currentBalances.enabled &&
    (currentBalances.Andrew !== 0 || currentBalances.Rachel !== 0 || currentBalances.Leisure !== 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Remaining Balance &amp; Statement Cutoff
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Establish a persistent baseline balance to stop loading statements perpetually.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Explanation banner */}
          <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">How Remaining Balances Work:</span>
              <p className="text-slate-600 dark:text-slate-300">
                Instead of loading months or years of statements continuously, you can lock in everyone&apos;s
                current balance as a permanent cutoff. All future uploaded statements will add their charges
                and credits on top of these remaining balances.
              </p>
            </div>
          </div>

          {/* Quick Snapshot Pre-fill button */}
          {(savedStatementCount > 0 || activeTransactionCount > 0) && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Quick Snapshot from Current Data
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Current Combined Net: Andrew ({formatCurrency(currentNetByBucket.Andrew)}) • Rachel (
                  {formatCurrency(currentNetByBucket.Rachel)}) • Leisure ({formatCurrency(currentNetByBucket.Leisure)})
                </p>
              </div>
              <button
                type="button"
                onClick={handleFillCurrentNet}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/60 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 transition-all shrink-0 cursor-pointer"
              >
                Copy Current Net Values
              </button>
            </div>
          )}

          {/* Bucket Inputs */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              Remaining Balance by Bucket ($)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Andrew */}
              <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                    Andrew / Natalie
                  </span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">
                    Starting
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">
                    $
                  </span>
                  <input
                    type="text"
                    value={andrewInput}
                    onChange={(e) => handleInputChange(setAndrewInput, e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-sm font-bold rounded-lg bg-white dark:bg-slate-800 border border-purple-300 dark:border-purple-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Rachel */}
              <div className="p-3 rounded-xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-200 dark:border-pink-900/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-900 dark:text-pink-300">Rachel</span>
                  <span className="text-[10px] text-pink-600 dark:text-pink-400 font-semibold">
                    Starting
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">
                    $
                  </span>
                  <input
                    type="text"
                    value={rachelInput}
                    onChange={(e) => handleInputChange(setRachelInput, e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-sm font-bold rounded-lg bg-white dark:bg-slate-800 border border-pink-300 dark:border-pink-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              {/* Leisure */}
              <div className="p-3 rounded-xl bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-900 dark:text-sky-300">Leisure</span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                    Starting
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">
                    $
                  </span>
                  <input
                    type="text"
                    value={leisureInput}
                    onChange={(e) => handleInputChange(setLeisureInput, e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-6 pr-3 py-1.5 text-sm font-bold rounded-lg bg-white dark:bg-slate-800 border border-sky-300 dark:border-sky-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Total balance preview */}
            <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
              <span className="text-xs font-semibold text-slate-300">
                Combined Baseline Cutoff Balance:
              </span>
              <span className="text-base font-extrabold text-white">
                {formatCurrency(totalBalance)}
              </span>
            </div>
          </div>

          {/* As of Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Cutoff Date / Label
              </label>
              <input
                type="text"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                placeholder="e.g. As of Aug 31, 2026"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Notes / Reference (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Settled prior statements via Venmo"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Cutoff options: Clear past statements */}
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2.5">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Perpetual Statement Cutoff Options
            </span>

            {savedStatementCount > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={clearSavedStatements}
                  onChange={(e) => setClearSavedStatements(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Clear {savedStatementCount} past saved statement{savedStatementCount !== 1 ? 's' : ''}{' '}
                    upon saving
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Recommended: Since their net impact is now stored in these Remaining Balances, clearing
                    them avoids loading older statements perpetually.
                  </p>
                </div>
              </label>
            )}

            {activeTransactionCount > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={clearActiveTransactions}
                  onChange={(e) => setClearActiveTransactions(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Also clear current active workspace transactions ({activeTransactionCount} items)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Check this if you are ready to upload a completely fresh subsequent statement.
                  </p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          {hasExistingBalance ? (
            showClearConfirm ? (
              <div className="flex items-center gap-1.5 text-xs animate-fade-in">
                <span className="text-rose-600 font-bold">Reset cutoff?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Yes, Reset
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Reset Remaining Balances to $0
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Remaining Balances</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
