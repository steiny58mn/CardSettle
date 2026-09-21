import React from 'react';
import {
  CreditCard,
  PieChart,
  ShieldCheck,
  Download,
  FileSpreadsheet,
  Moon,
  Sun,
  Sparkles,
  HelpCircle,
  Layers,
  Wallet,
  Trash2,
  BookmarkCheck,
  Upload,
  Scale,
} from 'lucide-react';

interface NavbarProps {
  transactionCount: number;
  onOpenRules: () => void;
  onOpenUploadModal: () => void;
  onLoadSample: () => void;
  onExportAll: () => void;
  onExportSummary: () => void;
  onClearAll?: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  savedStatementsCount?: number;
  onSaveCurrentStatement?: () => void;
  onScrollToSavedStatements?: () => void;
  onOpenRemainingBalanceModal?: () => void;
  hasRemainingBalances?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  transactionCount,
  onOpenRules,
  onOpenUploadModal,
  onLoadSample,
  onExportAll,
  onExportSummary,
  onClearAll,
  darkMode,
  onToggleDarkMode,
  savedStatementsCount = 0,
  onSaveCurrentStatement,
  onScrollToSavedStatements,
  onOpenRemainingBalanceModal,
  hasRemainingBalances = false,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <a
            href="https://www.frostpointlabs.com"
            title="Frostpoint Labs"
            target="_blank"
            rel="noopener noreferrer"
            className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 hover:opacity-90 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <Wallet className="w-5 h-5" />
          </a>
          <div>
            <span className="font-black text-slate-900 dark:text-white tracking-tight text-base sm:text-lg">
              Credit Card <span className="text-indigo-600 dark:text-indigo-400">Analyzer</span>
            </span>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Upload Statement Button at the top */}
          <button
            onClick={onOpenUploadModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs hover:shadow active:scale-95 cursor-pointer"
            title="Upload a new PDF or CSV statement"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Statement</span>
          </button>

          {/* Rules Guide Button */}
          <button
            onClick={onOpenRules}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            title="View Active Categorization Rules"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">Rules Guide</span>
          </button>

          {/* Remaining Balance Cutoff Button */}
          {onOpenRemainingBalanceModal && (
            <button
              type="button"
              onClick={onOpenRemainingBalanceModal}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs active:scale-95 ${
                hasRemainingBalances
                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-300 dark:hover:border-purple-700 border-purple-200 dark:border-purple-800/80'
              }`}
              title="Store or adjust persistent Remaining Balance cutoff values for each bucket"
            >
              <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="hidden sm:inline">Remaining Balance</span>
              <span className="sm:hidden">Rem. Balance</span>
              {hasRemainingBalances && (
                <span className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-pulse" />
              )}
            </button>
          )}

          {/* Quick Demo Loader */}
          {transactionCount === 0 && (
            <button
              onClick={onLoadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Load Demo Data</span>
              <span className="sm:hidden">Demo</span>
            </button>
          )}

          {/* Export & Action Buttons */}
          <div className="flex items-center gap-1.5">
            {onClearAll && (
              <button
                onClick={onClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer"
                title="Clear current transactions or saved statements"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Clear All</span>
              </button>
            )}

            {transactionCount > 0 && (
              <>
                <button
                  onClick={onExportSummary}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                  title="Export summary breakdown CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Summary CSV</span>
                </button>

                {onSaveCurrentStatement && (
                  <button
                    onClick={onSaveCurrentStatement}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs cursor-pointer"
                    title="Finalize categories and save statement before loading next PDF"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save Statement</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                )}

                <button
                  onClick={onExportAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-xs cursor-pointer"
                  title="Export all categorized transactions"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">Export</span>
                </button>
              </>
            )}
          </div>

          {/* Saved Statements Indicator */}
          {savedStatementsCount > 0 && onScrollToSavedStatements && (
            <button
              onClick={onScrollToSavedStatements}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
              title="Jump to Saved Statements & Carried Totals"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{savedStatementsCount} Saved</span>
            </button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={onToggleDarkMode}
            type="button"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
