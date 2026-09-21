import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CreditCard,
  Download,
  PieChart as PieChartIcon,
  FileSpreadsheet,
  DollarSign,
  Palmtree,
  Sliders,
  RotateCcw,
  Sparkles,
  Check,
  Edit3,
  Layers,
  ArrowRight,
  Info,
  BookmarkCheck,
  X,
  Scale,
} from 'lucide-react';
import { CategorySummary, CategoryType, CreditOverrides, RemainingBalances, SavedStatement, Transaction } from '../types';
import { formatCurrency, exportSummariesToCSV, exportTransactionsToCSV } from '../utils/csvHelper';
import { CATEGORY_COLORS } from '../utils/rulesEngine';
import { calculateCarriedOverTotals } from '../utils/statementHelper';

interface DashboardProps {
  transactions: Transaction[];
  creditOverrides?: CreditOverrides;
  onUpdateCreditOverride?: (category: CategoryType, amount: number | null, syncWithAndrew?: boolean) => void;
  onResetAllCreditOverrides?: () => void;
  onBulkUpdateCreditOverrides?: (updates: Partial<Record<CategoryType, number | null>>) => void;
  onSelectCategoryFilter?: (cat: string) => void;
  selectedCategoryFilter?: string;
  savedStatements?: SavedStatement[];
  activeStatementName?: string;
  remainingBalances?: RemainingBalances;
  onOpenRemainingBalanceModal?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  creditOverrides = {} as CreditOverrides,
  onUpdateCreditOverride,
  onResetAllCreditOverrides,
  onBulkUpdateCreditOverrides,
  onSelectCategoryFilter,
  selectedCategoryFilter,
  savedStatements = [],
  activeStatementName = 'Current Statement',
  remainingBalances,
  onOpenRemainingBalanceModal,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<'overview' | 'comparison' | 'timeline' | 'cards'>('overview');
  const [displayScope, setDisplayScope] = useState<'combined' | 'active' | 'carried'>('combined');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
  const [editingCreditCat, setEditingCreditCat] = useState<CategoryType | null>(null);
  const [tempCreditInput, setTempCreditInput] = useState<string>('');
  const creditInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingCreditCat && creditInputRef.current) {
      creditInputRef.current.focus();
      creditInputRef.current.select();
    }
  }, [editingCreditCat]);

  const overrides: CreditOverrides = creditOverrides || {};
  const hasSavedStatements = (savedStatements?.length || 0) > 0;

  const hasRemainingBalances = Boolean(
    remainingBalances?.enabled &&
      ((remainingBalances.Andrew || 0) !== 0 ||
        (remainingBalances.Rachel || 0) !== 0 ||
        (remainingBalances.Leisure || 0) !== 0)
  );

  const remainingAndrew = hasRemainingBalances ? (remainingBalances?.Andrew || 0) : 0;
  const remainingRachel = hasRemainingBalances ? (remainingBalances?.Rachel || 0) : 0;
  const remainingLeisure = hasRemainingBalances ? (remainingBalances?.Leisure || 0) : 0;
  const totalRemaining = Math.round((remainingAndrew + remainingRachel + remainingLeisure) * 100) / 100;

  // Only active (non-deleted) transactions contribute to totals, metrics, and charts
  const activeTransactions = useMemo(() => {
    return transactions.filter((t) => !t.isDeleted);
  }, [transactions]);

  const carriedOverTotals = useMemo(() => {
    return calculateCarriedOverTotals(savedStatements || []);
  }, [savedStatements]);

  // Dynamic set of transactions based on displayScope (Combined includes all saved + active)
  const transactionsInScope = useMemo(() => {
    if (displayScope === 'active' || (!hasSavedStatements && !hasRemainingBalances)) {
      return activeTransactions;
    }
    const savedTx = (savedStatements || []).flatMap((s) => s.transactions.filter((t) => !t.isDeleted));
    if (displayScope === 'carried') {
      return savedTx;
    }
    // 'combined'
    return [...savedTx, ...activeTransactions];
  }, [displayScope, hasSavedStatements, hasRemainingBalances, savedStatements, activeTransactions]);

  // Compute category summaries dynamically from active categorized transactions & credit overrides
  const {
    summaries,
    totalDebit,
    totalCredit, // raw transaction credits
    totalAllocatedCredit, // effective applied credits
    totalNet,
  } = useMemo(() => {
    let tDebit = 0;
    let tCredit = 0;

    const catMap: Record<CategoryType, { debit: number; credit: number; count: number }> = {
      Andrew: { debit: 0, credit: 0, count: 0 },
      Rachel: { debit: 0, credit: 0, count: 0 },
      Leisure: { debit: 0, credit: 0, count: 0 },
    };

    activeTransactions.forEach((tx) => {
      tDebit += tx.debit;
      tCredit += tx.credit;

      const cat: CategoryType = (tx.category as CategoryType) || 'Leisure';
      if (!catMap[cat]) {
        catMap[cat] = { debit: 0, credit: 0, count: 0 };
      }
      catMap[cat].debit += tx.debit;
      catMap[cat].credit += tx.credit;
      catMap[cat].count += 1;
    });

    const categories: CategoryType[] = ['Andrew', 'Rachel', 'Leisure'];
    let tAllocatedCredit = 0;

    const summaryList: CategorySummary[] = categories.map((cat) => {
      const item = catMap[cat] || { debit: 0, credit: 0, count: 0 };
      const rawCredit = item.credit;
      const isOverridden = typeof overrides[cat] === 'number' && !isNaN(Number(overrides[cat]));
      const allocatedCredit = isOverridden ? Number(overrides[cat]) : rawCredit;
      tAllocatedCredit += allocatedCredit;

      const net = item.debit - allocatedCredit;
      const colorConfig = CATEGORY_COLORS[cat];

      return {
        category: cat,
        totalDebit: item.debit,
        totalCredit: rawCredit,
        allocatedCredit,
        isCreditOverridden: isOverridden,
        statementNet: net,
        remainingBalance: 0,
        totalBalance: net,
        netSpend: net,
        count: item.count,
        percentage: 0, // calculated below
        color: colorConfig.fill,
        badgeBg: colorConfig.badgeBg,
        textColor: colorConfig.text,
      };
    });

    const calculatedTotalNet = tDebit - tAllocatedCredit;

    // Update percentages based on calculated Total Net Spend
    summaryList.forEach((s) => {
      s.percentage = calculatedTotalNet > 0
        ? (s.netSpend / calculatedTotalNet) * 100
        : s.count > 0
        ? (s.count / (activeTransactions.length || 1)) * 100
        : 0;
    });

    return {
      summaries: summaryList,
      totalDebit: tDebit,
      totalCredit: tCredit,
      totalAllocatedCredit: tAllocatedCredit,
      totalNet: calculatedTotalNet,
    };
  }, [activeTransactions, overrides]);

  // Card & Monthly breakdown calculated from transactionsInScope to reflect the selected scope
  const { cardBreakdown, monthlyBreakdown } = useMemo(() => {
    const cardMap: Record<string, { debit: number; credit: number; count: number; categories: Record<string, number> }> = {};
    const monthMap: Record<string, { andrew: number; rachel: number; leisure: number; total: number }> = {};

    transactionsInScope.forEach((tx) => {
      const cat: CategoryType = (tx.category as CategoryType) || 'Leisure';

      // Card breakdown
      const card = tx.cardNumber || 'Unknown';
      if (!cardMap[card]) {
        cardMap[card] = { debit: 0, credit: 0, count: 0, categories: {} };
      }
      cardMap[card].debit += tx.debit;
      cardMap[card].credit += tx.credit;
      cardMap[card].count += 1;
      cardMap[card].categories[cat] = (cardMap[card].categories[cat] || 0) + (tx.debit - tx.credit);

      // Monthly breakdown
      const dateStr = tx.transactionDate || tx.postedDate || '';
      let mKey = 'Unknown';
      if (dateStr.length >= 7) {
        mKey = dateStr.substring(0, 7); // YYYY-MM
      }
      if (!monthMap[mKey]) {
        monthMap[mKey] = { andrew: 0, rachel: 0, leisure: 0, total: 0 };
      }
      const net = tx.debit - tx.credit;
      if (cat === 'Andrew') monthMap[mKey].andrew += net;
      else if (cat === 'Rachel') monthMap[mKey].rachel += net;
      else monthMap[mKey].leisure += net;
      monthMap[mKey].total += net;
    });

    const cardList = Object.entries(cardMap).map(([cardNumber, stats]) => ({
      cardNumber,
      totalDebit: stats.debit,
      totalCredit: stats.credit,
      netSpend: stats.debit - stats.credit,
      count: stats.count,
      categories: stats.categories,
    }));

    const sortedMonths = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mKey, data]) => ({
        monthKey: mKey,
        ...data,
      }));

    return {
      cardBreakdown: cardList,
      monthlyBreakdown: sortedMonths,
    };
  }, [transactionsInScope]);

  // Compute stats per category
  const andrewSummary = summaries.find((s) => s.category === 'Andrew');
  const rachelSummary = summaries.find((s) => s.category === 'Rachel');
  const leisureSummary = summaries.find((s) => s.category === 'Leisure');

  const andrewGross = andrewSummary?.totalDebit || 0;
  const andrewAllocatedCredit = andrewSummary?.allocatedCredit || 0;
  const andrewNet = andrewSummary?.netSpend ?? (andrewGross - andrewAllocatedCredit);

  const rachelGross = rachelSummary?.totalDebit || 0;
  const rachelAllocatedCredit = rachelSummary?.allocatedCredit || 0;
  const rachelNet = rachelSummary?.netSpend ?? (rachelGross - rachelAllocatedCredit);

  const leisureGross = leisureSummary?.totalDebit || 0;
  const leisureAllocatedCredit = leisureSummary?.allocatedCredit || 0;
  const leisureNet = leisureSummary?.netSpend ?? (leisureGross - leisureAllocatedCredit);

  const hasAnyCreditOverride = Boolean(
    typeof overrides.Andrew === 'number' ||
    typeof overrides.Rachel === 'number' ||
    typeof overrides.Leisure === 'number'
  );

  const handleStartEditCredit = (cat: CategoryType, currentAllocated: number) => {
    setEditingCreditCat(cat);
    setTempCreditInput(currentAllocated.toFixed(2));
  };

  const handleSaveCreditOverride = (cat: CategoryType) => {
    const raw = tempCreditInput.trim().replace(/[$,\s]/g, '');
    if (!raw) {
      setEditingCreditCat(null);
      setTempCreditInput('');
      return;
    }

    const currentAlloc =
      cat === 'Andrew'
        ? andrewAllocatedCredit
        : cat === 'Rachel'
        ? rachelAllocatedCredit
        : leisureAllocatedCredit;

    let targetAmount: number | null = null;
    if (raw.startsWith('+')) {
      const added = parseFloat(raw.substring(1));
      if (!isNaN(added)) {
        targetAmount = Math.round((currentAlloc + added) * 100) / 100;
      }
    } else if (raw.startsWith('-')) {
      const subbed = parseFloat(raw.substring(1));
      if (!isNaN(subbed)) {
        targetAmount = Math.max(0, Math.round((currentAlloc - subbed) * 100) / 100);
      }
    } else {
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        targetAmount = Math.round(num * 100) / 100;
      }
    }

    if (targetAmount !== null) {
      // Manual edits on Leisure will automatically sync with Andrew (syncWithAndrew = true)
      onUpdateCreditOverride?.(cat, targetAmount, cat === 'Leisure');
    }
    setEditingCreditCat(null);
    setTempCreditInput('');
  };

  const handleQuickPreset = (preset: 'even' | 'all-andrew' | 'all-rachel' | 'all-leisure') => {
    if (preset === 'even') {
      const splitAmount = Math.round((totalCredit / 3) * 100) / 100;
      const leisureAmount = Math.round((totalCredit - splitAmount * 2) * 100) / 100;
      if (onBulkUpdateCreditOverrides) {
        onBulkUpdateCreditOverrides({
          Andrew: splitAmount,
          Rachel: splitAmount,
          Leisure: leisureAmount,
        });
      } else {
        onUpdateCreditOverride?.('Andrew', splitAmount, false);
        onUpdateCreditOverride?.('Rachel', splitAmount, false);
        onUpdateCreditOverride?.('Leisure', leisureAmount, false);
      }
    } else if (preset === 'all-andrew') {
      if (onBulkUpdateCreditOverrides) {
        onBulkUpdateCreditOverrides({ Andrew: totalCredit, Rachel: 0, Leisure: 0 });
      } else {
        onUpdateCreditOverride?.('Andrew', totalCredit, false);
        onUpdateCreditOverride?.('Rachel', 0, false);
        onUpdateCreditOverride?.('Leisure', 0, false);
      }
    } else if (preset === 'all-rachel') {
      if (onBulkUpdateCreditOverrides) {
        onBulkUpdateCreditOverrides({ Andrew: 0, Rachel: totalCredit, Leisure: 0 });
      } else {
        onUpdateCreditOverride?.('Andrew', 0, false);
        onUpdateCreditOverride?.('Rachel', totalCredit, false);
        onUpdateCreditOverride?.('Leisure', 0, false);
      }
    } else if (preset === 'all-leisure') {
      if (onBulkUpdateCreditOverrides) {
        onBulkUpdateCreditOverrides({ Andrew: 0, Rachel: 0, Leisure: totalCredit });
      } else {
        onUpdateCreditOverride?.('Andrew', 0, false);
        onUpdateCreditOverride?.('Rachel', 0, false);
        onUpdateCreditOverride?.('Leisure', totalCredit, false);
      }
    }
  };

  // Effective metrics based on displayScope (Combined Grand Total vs Active Statement vs Carried Over + Remaining Cutoff Balances)
  const effectiveTotals = useMemo(() => {
    if (displayScope === 'active' || (!hasSavedStatements && !hasRemainingBalances)) {
      return {
        totalNet,
        totalStatementNet: totalNet,
        totalRemaining: 0,
        totalDebit,
        totalCredit,
        totalAllocatedCredit,
        andrewGross,
        andrewAutoCredit: andrewSummary?.totalCredit || 0,
        andrewAllocatedCredit,
        andrewStatementNet: andrewNet,
        andrewRemaining: 0,
        andrewNet,
        andrewCount: andrewSummary?.count || 0,
        rachelGross,
        rachelAutoCredit: rachelSummary?.totalCredit || 0,
        rachelAllocatedCredit,
        rachelStatementNet: rachelNet,
        rachelRemaining: 0,
        rachelNet,
        rachelCount: rachelSummary?.count || 0,
        leisureGross,
        leisureAutoCredit: leisureSummary?.totalCredit || 0,
        leisureAllocatedCredit,
        leisureStatementNet: leisureNet,
        leisureRemaining: 0,
        leisureNet,
        leisureCount: leisureSummary?.count || 0,
      };
    }

    if (displayScope === 'carried' || activeTransactions.length === 0) {
      const cAndrewNet = carriedOverTotals.andrew.netSpend;
      const cRachelNet = carriedOverTotals.rachel.netSpend;
      const cLeisureNet = carriedOverTotals.leisure.netSpend;
      const cTotalNet = carriedOverTotals.totalNetSpend;

      return {
        totalNet: Math.round((cTotalNet + totalRemaining) * 100) / 100,
        totalStatementNet: cTotalNet,
        totalRemaining,
        totalDebit: carriedOverTotals.totalDebit,
        totalCredit: carriedOverTotals.totalCredit,
        totalAllocatedCredit: carriedOverTotals.totalAllocatedCredit,
        andrewGross: carriedOverTotals.andrew.debit,
        andrewAutoCredit: carriedOverTotals.andrew.credit,
        andrewAllocatedCredit: carriedOverTotals.andrew.allocatedCredit,
        andrewStatementNet: cAndrewNet,
        andrewRemaining: remainingAndrew,
        andrewNet: Math.round((cAndrewNet + remainingAndrew) * 100) / 100,
        andrewCount: carriedOverTotals.andrew.count,
        rachelGross: carriedOverTotals.rachel.debit,
        rachelAutoCredit: carriedOverTotals.rachel.credit,
        rachelAllocatedCredit: carriedOverTotals.rachel.allocatedCredit,
        rachelStatementNet: cRachelNet,
        rachelRemaining: remainingRachel,
        rachelNet: Math.round((cRachelNet + remainingRachel) * 100) / 100,
        rachelCount: carriedOverTotals.rachel.count,
        leisureGross: carriedOverTotals.leisure.debit,
        leisureAutoCredit: carriedOverTotals.leisure.credit,
        leisureAllocatedCredit: carriedOverTotals.leisure.allocatedCredit,
        leisureStatementNet: cLeisureNet,
        leisureRemaining: remainingLeisure,
        leisureNet: Math.round((cLeisureNet + remainingLeisure) * 100) / 100,
        leisureCount: carriedOverTotals.leisure.count,
      };
    }

    // Combined Grand Total (Active + Carried Over + Remaining Cutoff Balances)
    const combAndrewStmt = andrewNet + carriedOverTotals.andrew.netSpend;
    const combRachelStmt = rachelNet + carriedOverTotals.rachel.netSpend;
    const combLeisureStmt = leisureNet + carriedOverTotals.leisure.netSpend;
    const combTotalStmt = totalNet + carriedOverTotals.totalNetSpend;

    return {
      totalNet: Math.round((combTotalStmt + totalRemaining) * 100) / 100,
      totalStatementNet: combTotalStmt,
      totalRemaining,
      totalDebit: totalDebit + carriedOverTotals.totalDebit,
      totalCredit: totalCredit + carriedOverTotals.totalCredit,
      totalAllocatedCredit: totalAllocatedCredit + carriedOverTotals.totalAllocatedCredit,
      andrewGross: andrewGross + carriedOverTotals.andrew.debit,
      andrewAutoCredit: (andrewSummary?.totalCredit || 0) + carriedOverTotals.andrew.credit,
      andrewAllocatedCredit: andrewAllocatedCredit + carriedOverTotals.andrew.allocatedCredit,
      andrewStatementNet: combAndrewStmt,
      andrewRemaining: remainingAndrew,
      andrewNet: Math.round((combAndrewStmt + remainingAndrew) * 100) / 100,
      andrewCount: (andrewSummary?.count || 0) + carriedOverTotals.andrew.count,
      rachelGross: rachelGross + carriedOverTotals.rachel.debit,
      rachelAutoCredit: (rachelSummary?.totalCredit || 0) + carriedOverTotals.rachel.credit,
      rachelAllocatedCredit: rachelAllocatedCredit + carriedOverTotals.rachel.allocatedCredit,
      rachelStatementNet: combRachelStmt,
      rachelRemaining: remainingRachel,
      rachelNet: Math.round((combRachelStmt + remainingRachel) * 100) / 100,
      rachelCount: (rachelSummary?.count || 0) + carriedOverTotals.rachel.count,
      leisureGross: leisureGross + carriedOverTotals.leisure.debit,
      leisureAutoCredit: (leisureSummary?.totalCredit || 0) + carriedOverTotals.leisure.credit,
      leisureAllocatedCredit: leisureAllocatedCredit + carriedOverTotals.leisure.allocatedCredit,
      leisureStatementNet: combLeisureStmt,
      leisureRemaining: remainingLeisure,
      leisureNet: Math.round((combLeisureStmt + remainingLeisure) * 100) / 100,
      leisureCount: (leisureSummary?.count || 0) + carriedOverTotals.leisure.count,
    };
  }, [
    hasSavedStatements,
    hasRemainingBalances,
    displayScope,
    activeTransactions.length,
    totalNet,
    totalDebit,
    totalCredit,
    totalAllocatedCredit,
    totalRemaining,
    remainingAndrew,
    remainingRachel,
    remainingLeisure,
    andrewGross,
    andrewAllocatedCredit,
    andrewNet,
    andrewSummary,
    rachelGross,
    rachelAllocatedCredit,
    rachelNet,
    rachelSummary,
    leisureGross,
    leisureAllocatedCredit,
    leisureNet,
    leisureSummary,
    carriedOverTotals,
  ]);

  // Calculate unapplied money (Total statement credits available minus total credits applied to buckets)
  const unappliedCreditCombined = useMemo(() => {
    return Math.round((effectiveTotals.totalCredit - effectiveTotals.totalAllocatedCredit) * 100) / 100;
  }, [effectiveTotals.totalCredit, effectiveTotals.totalAllocatedCredit]);

  const activeUnappliedCredit = useMemo(() => {
    return Math.round((totalCredit - totalAllocatedCredit) * 100) / 100;
  }, [totalCredit, totalAllocatedCredit]);

  // When applying credits to active buckets, this is the amount to auto-apply to reach 100% applied
  const unappliedToApply = displayScope === 'combined' && hasSavedStatements
    ? unappliedCreditCombined
    : activeUnappliedCredit;

  // Auto-apply remaining unapplied statement credits to any of the 3 buckets
  const handleAutoApplyUnapplied = (cat: CategoryType) => {
    if (activeTransactions.length === 0) {
      alert("No active statement is currently open to allocate credits. Please upload or reopen a statement first.");
      return;
    }
    if (Math.abs(unappliedToApply) < 0.005) {
      return;
    }

    const currentAlloc =
      cat === 'Andrew'
        ? andrewAllocatedCredit
        : cat === 'Rachel'
        ? rachelAllocatedCredit
        : leisureAllocatedCredit;

    const newAmount = Math.round((currentAlloc + unappliedToApply) * 100) / 100;
    // Apply unapplied credits without syncing from Andrew, since this is unallocated pool money
    onUpdateCreditOverride?.(cat, newAmount, false);
  };

  const effectiveSummaries = useMemo<CategorySummary[]>(() => {
    const sumNet = effectiveTotals.totalNet;
    return [
      {
        category: 'Andrew' as CategoryType,
        totalDebit: effectiveTotals.andrewGross,
        totalCredit: 0,
        allocatedCredit: effectiveTotals.andrewAllocatedCredit,
        isCreditOverridden: andrewSummary?.isCreditOverridden,
        statementNet: effectiveTotals.andrewStatementNet,
        remainingBalance: effectiveTotals.andrewRemaining,
        totalBalance: effectiveTotals.andrewNet,
        netSpend: effectiveTotals.andrewNet,
        count: effectiveTotals.andrewCount,
        percentage: sumNet > 0 ? (effectiveTotals.andrewNet / sumNet) * 100 : 0,
        color: CATEGORY_COLORS.Andrew.color,
        badgeBg: CATEGORY_COLORS.Andrew.bg,
        textColor: CATEGORY_COLORS.Andrew.text,
      },
      {
        category: 'Rachel' as CategoryType,
        totalDebit: effectiveTotals.rachelGross,
        totalCredit: 0,
        allocatedCredit: effectiveTotals.rachelAllocatedCredit,
        isCreditOverridden: rachelSummary?.isCreditOverridden,
        statementNet: effectiveTotals.rachelStatementNet,
        remainingBalance: effectiveTotals.rachelRemaining,
        totalBalance: effectiveTotals.rachelNet,
        netSpend: effectiveTotals.rachelNet,
        count: effectiveTotals.rachelCount,
        percentage: sumNet > 0 ? (effectiveTotals.rachelNet / sumNet) * 100 : 0,
        color: CATEGORY_COLORS.Rachel.color,
        badgeBg: CATEGORY_COLORS.Rachel.bg,
        textColor: CATEGORY_COLORS.Rachel.text,
      },
      {
        category: 'Leisure' as CategoryType,
        totalDebit: effectiveTotals.leisureGross,
        totalCredit: 0,
        allocatedCredit: effectiveTotals.leisureAllocatedCredit,
        isCreditOverridden: leisureSummary?.isCreditOverridden,
        statementNet: effectiveTotals.leisureStatementNet,
        remainingBalance: effectiveTotals.leisureRemaining,
        totalBalance: effectiveTotals.leisureNet,
        netSpend: effectiveTotals.leisureNet,
        count: effectiveTotals.leisureCount,
        percentage: sumNet > 0 ? (effectiveTotals.leisureNet / sumNet) * 100 : 0,
        color: CATEGORY_COLORS.Leisure.color,
        badgeBg: CATEGORY_COLORS.Leisure.bg,
        textColor: CATEGORY_COLORS.Leisure.text,
      },
    ];
  }, [effectiveTotals, andrewSummary, rachelSummary, leisureSummary]);

  const handleExportSummary = () => {
    exportSummariesToCSV(
      effectiveSummaries,
      effectiveTotals.totalNet,
      effectiveTotals.totalDebit,
      effectiveTotals.totalAllocatedCredit
    );
  };

  const handleExportAll = () => {
    exportTransactionsToCSV(transactionsInScope.length > 0 ? transactionsInScope : activeTransactions);
  };

  // SVG Pie / Donut calculation
  const donutSlices = useMemo(() => {
    const positiveSummaries = effectiveSummaries.filter((s) => s.netSpend > 0);
    const sumPositive = positiveSummaries.reduce((acc, s) => acc + s.netSpend, 0);

    if (sumPositive === 0) return [];

    let currentAngle = -90; // Start at top
    return positiveSummaries.map((s) => {
      const sliceAngle = (s.netSpend / sumPositive) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle += sliceAngle;

      const radius = 80;
      const innerRadius = 52;
      const cx = 100;
      const cy = 100;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const x3 = cx + innerRadius * Math.cos(endRad);
      const y3 = cy + innerRadius * Math.sin(endRad);
      const x4 = cx + innerRadius * Math.cos(startRad);
      const y4 = cy + innerRadius * Math.sin(startRad);

      const largeArc = sliceAngle > 180 ? 1 : 0;

      const pathData = `
        M ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
        Z
      `;

      return {
        category: s.category,
        color: s.color,
        path: pathData,
        percentage: (s.netSpend / sumPositive) * 100,
        amount: s.netSpend,
      };
    });
  }, [effectiveSummaries]);

  return (
    <div className="space-y-6">
      {/* Remaining Cutoff Balances Banner */}
      {hasRemainingBalances ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                  Remaining Cutoff Balances Active:
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  Total Cutoff: {formatCurrency(totalRemaining)}
                </span>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                Baseline carried over into calculations &mdash; Andrew: <strong>{formatCurrency(remainingAndrew)}</strong> &bull; Rachel: <strong>{formatCurrency(remainingRachel)}</strong> &bull; Leisure: <strong>{formatCurrency(remainingLeisure)}</strong>
              </p>
            </div>
          </div>
          {onOpenRemainingBalanceModal && (
            <button
              type="button"
              onClick={onOpenRemainingBalanceModal}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-slate-800 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 transition-colors shadow-2xs cursor-pointer shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Scale className="w-3.5 h-3.5 text-amber-600" />
              Adjust Cutoff Balances
            </button>
          )}
        </div>
      ) : onOpenRemainingBalanceModal ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-950 dark:text-purple-200 uppercase tracking-wider">
                  Remaining Balances &amp; Statement Cutoff
                </span>
              </div>
              <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 mt-0.5">
                Set persistent starting cutoff balances across Andrew, Rachel, and Leisure without perpetually loading past PDF statements.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenRemainingBalanceModal}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xs active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
            title="Set starting cutoff balances for Andrew, Rachel, and Leisure"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Set Remaining Balance</span>
          </button>
        </div>
      ) : null}

      {/* Scope Selector Bar when there are saved statements or remaining cutoff balances */}
      {(hasSavedStatements || hasRemainingBalances) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Dashboard Scope:
                </span>
                <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300">
                  {displayScope === 'combined'
                    ? 'Combined Grand Total'
                    : displayScope === 'active'
                    ? `Active Statement: ${activeStatementName}`
                    : hasSavedStatements
                    ? `Carried-Over Baseline (${savedStatements.length} statements)`
                    : 'Remaining Cutoff Baseline'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {displayScope === 'combined'
                  ? `Totals include active file charges${hasSavedStatements ? `, ${savedStatements.length} saved statement(s)` : ''}${hasRemainingBalances ? `, and cutoff balances` : ''}.`
                  : displayScope === 'active'
                  ? `Showing only charges and credits from the active file (${activeStatementName}).`
                  : `Showing carried totals from saved statements${hasRemainingBalances ? ' plus stored cutoff balances' : ''}.`}
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-indigo-200 dark:border-indigo-800 shadow-xs text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setDisplayScope('combined')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                displayScope === 'combined'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Grand Total ({formatCurrency(totalNet + carriedOverTotals.totalNetSpend + totalRemaining)})
            </button>
            <button
              type="button"
              onClick={() => setDisplayScope('active')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                displayScope === 'active'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Active File ({formatCurrency(totalNet)})
            </button>
            <button
              type="button"
              onClick={() => setDisplayScope('carried')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                displayScope === 'carried'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Carried &amp; Cutoff ({formatCurrency(carriedOverTotals.totalNetSpend + totalRemaining)})
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid with Gross, Credits Applied (with override indicators), and Net Spend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Spending */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {(hasSavedStatements || hasRemainingBalances) && displayScope === 'combined'
                ? 'Combined Net Spend'
                : displayScope === 'carried'
                ? 'Carried & Cutoff Net'
                : 'Total Net Spend'}
            </span>
            <div className="p-2 bg-white/10 rounded-xl">
              <DollarSign className="w-4 h-4 text-slate-200" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center justify-between">
              <span>{formatCurrency(effectiveTotals.totalNet)}</span>
              {effectiveTotals.totalNet < 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-bold border border-emerald-400/30">
                  Credit Surplus
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-300 mt-2 pt-2 border-t border-white/10">
              <span>Gross: {formatCurrency(effectiveTotals.totalDebit)}</span>
              <span className="text-emerald-300 font-semibold">
                Credits: -{formatCurrency(effectiveTotals.totalAllocatedCredit)}
              </span>
            </div>
            {(hasSavedStatements || hasRemainingBalances) && displayScope !== 'active' && (
              <div className="mt-1.5 text-[10px] text-slate-400 space-y-0.5">
                <div>
                  Stmt Net: {formatCurrency(effectiveTotals.totalStatementNet)}
                  {effectiveTotals.totalRemaining !== 0 && (
                    <span> + Cutoff: {formatCurrency(effectiveTotals.totalRemaining)}</span>
                  )}
                </div>
                {hasSavedStatements && activeTransactions.length > 0 && displayScope === 'combined' && (
                  <div className="text-slate-400/80 text-[9px]">
                    Active: {formatCurrency(totalNet)} + Carried: {formatCurrency(carriedOverTotals.totalNetSpend)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Andrew Spending Card */}
        <div
          onClick={() => onSelectCategoryFilter?.(selectedCategoryFilter === 'Andrew' ? 'ALL' : 'Andrew')}
          className={`cursor-pointer group relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
            selectedCategoryFilter === 'Andrew'
              ? 'ring-2 ring-purple-500 border-purple-500'
              : 'border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-600 shadow-xs"></div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Andrew/Natalie Net
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {andrewSummary?.isCreditOverridden && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                  Override
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium border border-purple-200 dark:border-purple-800">
                2642 &amp; 6744
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-between">
              <span>{formatCurrency(effectiveTotals.andrewNet)}</span>
              {effectiveTotals.andrewNet < 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                  Credit Balance
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span>Gross: {formatCurrency(effectiveTotals.andrewGross)}</span>
                {effectiveTotals.andrewAllocatedCredit !== 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Credits: -{formatCurrency(effectiveTotals.andrewAllocatedCredit)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>{effectiveTotals.andrewCount} items</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {effectiveTotals.totalNet > 0
                    ? `${((effectiveTotals.andrewNet / effectiveTotals.totalNet) * 100).toFixed(1)}% of Total`
                    : effectiveTotals.andrewNet < 0
                    ? 'Credit Balance'
                    : '0%'}
                </span>
              </div>
              {(hasSavedStatements || hasRemainingBalances) && displayScope !== 'active' && (
                <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium pt-0.5">
                  Stmt Net: {formatCurrency(effectiveTotals.andrewStatementNet)}
                  {effectiveTotals.andrewRemaining !== 0 && (
                    <span> + Cutoff: {formatCurrency(effectiveTotals.andrewRemaining)}</span>
                  )}
                  {hasSavedStatements && activeTransactions.length > 0 && displayScope === 'combined' && (
                    <div className="text-[9px] text-purple-500/80">
                      Active: {formatCurrency(andrewNet)} + Carried: {formatCurrency(carriedOverTotals.andrew.netSpend)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rachel Spending Card */}
        <div
          onClick={() => onSelectCategoryFilter?.(selectedCategoryFilter === 'Rachel' ? 'ALL' : 'Rachel')}
          className={`cursor-pointer group relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
            selectedCategoryFilter === 'Rachel'
              ? 'ring-2 ring-pink-400 border-pink-400'
              : 'border-slate-200 dark:border-slate-800 hover:border-pink-200 dark:hover:border-pink-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-400 shadow-xs"></div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Rachel Net
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {rachelSummary?.isCreditOverridden && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                  Override
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-md bg-pink-50 dark:bg-pink-950/50 text-pink-600 dark:text-pink-300 font-medium border border-pink-200 dark:border-pink-800">
                3810
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-between">
              <span>{formatCurrency(effectiveTotals.rachelNet)}</span>
              {effectiveTotals.rachelNet < 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                  Credit Balance
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span>Gross: {formatCurrency(effectiveTotals.rachelGross)}</span>
                {effectiveTotals.rachelAllocatedCredit !== 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Credits: -{formatCurrency(effectiveTotals.rachelAllocatedCredit)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>{effectiveTotals.rachelCount} items</span>
                <span className="font-semibold text-pink-500 dark:text-pink-300">
                  {effectiveTotals.totalNet > 0
                    ? `${((effectiveTotals.rachelNet / effectiveTotals.totalNet) * 100).toFixed(1)}% of Total`
                    : effectiveTotals.rachelNet < 0
                    ? 'Credit Balance'
                    : '0%'}
                </span>
              </div>
              {(hasSavedStatements || hasRemainingBalances) && displayScope !== 'active' && (
                <div className="text-[10px] text-pink-500 dark:text-pink-300 font-medium pt-0.5">
                  Stmt Net: {formatCurrency(effectiveTotals.rachelStatementNet)}
                  {effectiveTotals.rachelRemaining !== 0 && (
                    <span> + Cutoff: {formatCurrency(effectiveTotals.rachelRemaining)}</span>
                  )}
                  {hasSavedStatements && activeTransactions.length > 0 && displayScope === 'combined' && (
                    <div className="text-[9px] text-pink-400/80">
                      Active: {formatCurrency(rachelNet)} + Carried: {formatCurrency(carriedOverTotals.rachel.netSpend)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Leisure Spending Card */}
        <div
          onClick={() => onSelectCategoryFilter?.(selectedCategoryFilter === 'Leisure' ? 'ALL' : 'Leisure')}
          className={`cursor-pointer group relative overflow-hidden bg-white dark:bg-slate-900 p-5 rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md ${
            selectedCategoryFilter === 'Leisure'
              ? 'ring-2 ring-sky-500 border-sky-500'
              : 'border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-sky-500 shadow-xs"></div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Leisure Net
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {leisureSummary?.isCreditOverridden && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                  Override
                </span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-medium border border-sky-200 dark:border-sky-800">
                Leisure
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-between">
              <span>{formatCurrency(effectiveTotals.leisureNet)}</span>
              {effectiveTotals.leisureNet < 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                  Credit Balance
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span>Gross: {formatCurrency(effectiveTotals.leisureGross)}</span>
                {effectiveTotals.leisureAllocatedCredit !== 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Credits: -{formatCurrency(effectiveTotals.leisureAllocatedCredit)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span>{effectiveTotals.leisureCount} items</span>
                <span className="font-semibold text-sky-600 dark:text-sky-400">
                  {effectiveTotals.totalNet > 0
                    ? `${((effectiveTotals.leisureNet / effectiveTotals.totalNet) * 100).toFixed(1)}% of Total`
                    : effectiveTotals.leisureNet < 0
                    ? 'Credit Balance'
                    : '0%'}
                </span>
              </div>
              {(hasSavedStatements || hasRemainingBalances) && displayScope !== 'active' && (
                <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium pt-0.5">
                  Stmt Net: {formatCurrency(effectiveTotals.leisureStatementNet)}
                  {effectiveTotals.leisureRemaining !== 0 && (
                    <span> + Cutoff: {formatCurrency(effectiveTotals.leisureRemaining)}</span>
                  )}
                  {hasSavedStatements && activeTransactions.length > 0 && displayScope === 'combined' && (
                    <div className="text-[9px] text-sky-500/80">
                      Active: {formatCurrency(leisureNet)} + Carried: {formatCurrency(carriedOverTotals.leisure.netSpend)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Credit Overrides & Allocations Control Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center flex-wrap gap-2">
                  Credit Allocations &amp; Manual Overrides
                  {hasAnyCreditOverride && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                      Active Overrides
                    </span>
                  )}
                  {hasSavedStatements && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                      Carried History Applied
                    </span>
                  )}
                  {Math.abs(unappliedToApply) > 0.005 ? (
                    <span
                      id="unapplied-credits-badge"
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                        unappliedToApply > 0
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      }`}
                      title={unappliedToApply > 0 ? `${formatCurrency(unappliedToApply)} statement credits not yet applied to any bucket` : `${formatCurrency(Math.abs(unappliedToApply))} credits over-allocated beyond statement total`}
                    >
                      {unappliedToApply > 0 ? (
                        <>
                          <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{formatCurrency(unappliedToApply)} Unapplied Money</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>{formatCurrency(Math.abs(unappliedToApply))} Over-Allocated</span>
                        </>
                      )}
                    </span>
                  ) : (
                    <span
                      id="unapplied-credits-badge"
                      className="text-xs px-2.5 py-0.5 rounded-full font-bold border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1"
                      title="100% of available statement credits have been applied across buckets"
                    >
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>100% Money Applied</span>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Total Statement Credits Available:{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatCurrency(effectiveTotals.totalCredit)}
                  </strong>
                  {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                    <span className="text-slate-500 dark:text-slate-400 font-normal">
                      {' '}({formatCurrency(carriedOverTotals.totalCredit)} carried over from {savedStatements.length} saved statement{savedStatements.length > 1 ? 's' : ''} + {formatCurrency(totalCredit)} from active file)
                    </span>
                  )}
                  {hasSavedStatements && activeTransactions.length === 0 && (
                    <span className="text-slate-500 dark:text-slate-400 font-normal">
                      {' '}(Carried over from {savedStatements.length} saved statement{savedStatements.length > 1 ? 's' : ''}, already applied)
                    </span>
                  )}
                  {!hasSavedStatements && (
                    <span className="text-slate-500 dark:text-slate-400 font-normal">
                      {' '}across current statement transactions.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Quick preset actions */}
          <div className="flex items-center flex-wrap gap-1.5">
            {onOpenRemainingBalanceModal && (
              <button
                type="button"
                onClick={onOpenRemainingBalanceModal}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer ${
                  hasRemainingBalances
                    ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700'
                    : 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 border-purple-200 dark:border-purple-800/80'
                }`}
                title="Store or adjust starting Remaining Balance cutoff baseline across Andrew, Rachel, and Leisure"
              >
                <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{hasRemainingBalances ? `Cutoff (${formatCurrency(totalRemaining)})` : 'Remaining Balance'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onResetAllCreditOverrides?.()}
              disabled={activeTransactions.length === 0}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              title={activeTransactions.length === 0 ? "Load active statement to adjust" : "Reset active buckets to auto-calculated transaction credit sum"}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Auto from Txns
            </button>

            {totalCredit > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('even')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800"
                  title="Split active statement credits evenly (1/3 each)"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Split Active 3-Ways
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPreset('all-rachel')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/40 dark:hover:bg-pink-900/40 text-pink-700 dark:text-pink-300 transition-colors border border-pink-200/80 dark:border-pink-900/60"
                  title="Apply 100% of active credits to Rachel"
                >
                  Active &rarr; Rachel
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickPreset('all-andrew')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 transition-colors border border-purple-200/80 dark:border-purple-900/60"
                  title="Apply 100% of active credits to Andrew/Natalie"
                >
                  Active &rarr; Andrew
                </button>
              </>
            )}
          </div>
        </div>

        {/* Carried History Notification Bar inside Credit Allocations */}
        {hasSavedStatements && (
          <div className="px-5 py-3 bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-950 dark:text-indigo-200">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <span className="font-bold">
                  Carried-Over Statement History ({savedStatements.length} Saved):
                </span>{' '}
                <span>
                  {activeTransactions.length === 0 ? (
                    <>
                      Totals and credit allocations ({formatCurrency(carriedOverTotals.totalAllocatedCredit)} credits applied, {formatCurrency(carriedOverTotals.totalNetSpend)} net spend) are <strong>already applied</strong>. When you load your next statement above, its numbers will directly account for these totals.
                    </>
                  ) : (
                    <>
                      Current view accounts for <strong>{formatCurrency(carriedOverTotals.totalAllocatedCredit)}</strong> carried credit and <strong>{formatCurrency(carriedOverTotals.totalNetSpend)}</strong> carried net spend from prior saved statements.
                    </>
                  )}
                </span>
              </div>
            </div>
            {activeTransactions.length > 0 && (
              <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                Combined Accounted Net: {formatCurrency(effectiveTotals.totalNet)}
              </div>
            )}
          </div>
        )}

        {/* 3 Bucket Control Cards Grid */}
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-slate-950/30">
          {/* Andrew Bucket */}
          <div className="p-4 rounded-xl border border-purple-200/80 dark:border-purple-900/50 bg-white dark:bg-slate-900/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-600" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">Andrew/Natalie</span>
                <span
                  title="Linked to Leisure: credit offset adjustments stay synchronized between Andrew/Natalie and Leisure"
                  className="text-[9px] px-1.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-bold border border-sky-200/60 dark:border-sky-800/60 cursor-help"
                >
                  ⇄ Leisure
                </span>
              </div>
              {andrewSummary?.isCreditOverridden ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  Manual Override
                </span>
              ) : hasSavedStatements && activeTransactions.length === 0 ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Carried Applied
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Gross Charges</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(effectiveTotals.andrewGross)}
                </span>
                {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Carried: {formatCurrency(carriedOverTotals.andrew.debit)} + Active: {formatCurrency(andrewGross)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Auto Credit Sum</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {formatCurrency(effectiveTotals.andrewAutoCredit)}
                </span>
                {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Carried: {formatCurrency(carriedOverTotals.andrew.credit)} + Active: {formatCurrency(andrewSummary?.totalCredit || 0)}
                  </div>
                )}
              </div>
            </div>

            {/* Credit Input / Edit Row */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Credit Offset Applied:</span>
                {andrewSummary?.isCreditOverridden && activeTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onUpdateCreditOverride?.('Andrew', null, false)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-0.5"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Revert Active to Auto
                  </button>
                )}
              </label>

              {editingCreditCat === 'Andrew' ? (
                <div className="space-y-1.5">
                  {hasSavedStatements && (
                    <div className="text-[11px] p-2 rounded-lg bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-300 flex justify-between border border-indigo-100 dark:border-indigo-900/60">
                      <span>Carried baseline:</span>
                      <strong>{formatCurrency(carriedOverTotals.andrew.allocatedCredit)}</strong>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none select-none">$</span>
                      <input
                        ref={creditInputRef}
                        type="text"
                        inputMode="decimal"
                        value={tempCreditInput}
                        onChange={(e) => setTempCreditInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCreditOverride('Andrew')}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                        placeholder="Active credit offset"
                        className="w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveCreditOverride('Andrew')}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                      title="Save override"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCreditCat(null);
                        setTempCreditInput('');
                      }}
                      className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {hasSavedStatements && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Combined Applied: <strong>{formatCurrency(carriedOverTotals.andrew.allocatedCredit + (Number(tempCreditInput) || 0))}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (activeTransactions.length === 0 && hasSavedStatements) {
                      alert("Credit allocations from saved statements are locked and applied. To adjust them, reopen the statement from the Saved Statements panel below, or load your next statement to allocate credits.");
                      return;
                    }
                    handleStartEditCredit('Andrew', andrewAllocatedCredit);
                  }}
                  className="group flex flex-col p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800 cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      -{formatCurrency(effectiveTotals.andrewAllocatedCredit)}
                    </span>
                    {activeTransactions.length > 0 ? (
                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-semibold flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                        Applied from History
                      </span>
                    )}
                  </div>
                  {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400/90 mt-0.5">
                      Carried: -{formatCurrency(carriedOverTotals.andrew.allocatedCredit)} + Active: -{formatCurrency(andrewAllocatedCredit)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto-Apply Unapplied Button */}
            <div className="pt-0.5">
              {unappliedToApply > 0.005 ? (
                <button
                  type="button"
                  id="auto-apply-andrew-btn"
                  onClick={() => handleAutoApplyUnapplied('Andrew')}
                  disabled={activeTransactions.length === 0}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer group"
                  title={`Auto-apply ${formatCurrency(unappliedToApply)} of unapplied money to Andrew/Natalie`}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:rotate-12 transition-transform" />
                    <span>Auto-Apply Unapplied</span>
                  </span>
                  <span className="font-extrabold px-1.5 py-0.5 rounded-md bg-purple-200/80 dark:bg-purple-900/90 text-purple-900 dark:text-purple-100 text-[11px]">
                    +{formatCurrency(unappliedToApply)}
                  </span>
                </button>
              ) : unappliedToApply < -0.005 ? (
                <button
                  type="button"
                  id="auto-apply-andrew-btn"
                  onClick={() => handleAutoApplyUnapplied('Andrew')}
                  disabled={activeTransactions.length === 0}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer"
                  title={`Subtract ${formatCurrency(Math.abs(unappliedToApply))} over-allocated credit from Andrew/Natalie to reconcile`}
                >
                  <span className="flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Reconcile Over-Allocation</span>
                  </span>
                  <span className="font-extrabold px-1.5 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/90 text-amber-900 dark:text-amber-100 text-[11px]">
                    {formatCurrency(unappliedToApply)}
                  </span>
                </button>
              ) : (
                <div
                  id="auto-apply-andrew-status"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60"
                  title="All statement credits are already 100% applied across buckets"
                >
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>All Money Applied</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    $0.00 unapplied
                  </span>
                </div>
              )}
            </div>

            {/* Calculated Net Result */}
            <div className="p-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-purple-900 dark:text-purple-300 font-semibold block">Net Due / Spend:</span>
                {(hasSavedStatements || hasRemainingBalances) && displayScope !== 'active' && (
                  <span className="text-[10px] text-purple-700/80 dark:text-purple-300/80 block">
                    Stmt: {formatCurrency(effectiveTotals.andrewStatementNet)}
                    {effectiveTotals.andrewRemaining !== 0 && (
                      <span> + Cutoff: {formatCurrency(effectiveTotals.andrewRemaining)}</span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-purple-900 dark:text-purple-200">
                  {formatCurrency(effectiveTotals.andrewNet)}
                </span>
                {effectiveTotals.andrewNet < 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Credit
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rachel Bucket */}
          <div className="p-4 rounded-xl border border-pink-200/80 dark:border-pink-900/50 bg-white dark:bg-slate-900/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-pink-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">Rachel</span>
              </div>
              {rachelSummary?.isCreditOverridden ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  Manual Override
                </span>
              ) : hasSavedStatements && activeTransactions.length === 0 ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Carried Applied
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Gross Charges</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(effectiveTotals.rachelGross)}
                </span>
                {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Carried: {formatCurrency(carriedOverTotals.rachel.debit)} + Active: {formatCurrency(rachelGross)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Auto Credit Sum</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {formatCurrency(effectiveTotals.rachelAutoCredit)}
                </span>
                {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Carried: {formatCurrency(carriedOverTotals.rachel.credit)} + Active: {formatCurrency(rachelSummary?.totalCredit || 0)}
                  </div>
                )}
              </div>
            </div>

            {/* Credit Input / Edit Row */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Credit Offset Applied:</span>
                {rachelSummary?.isCreditOverridden && activeTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onUpdateCreditOverride?.('Rachel', null, false)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-0.5"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Revert Active to Auto
                  </button>
                )}
              </label>

              {editingCreditCat === 'Rachel' ? (
                <div className="space-y-1.5">
                  {hasSavedStatements && (
                    <div className="text-[11px] p-2 rounded-lg bg-pink-50/60 dark:bg-pink-950/40 text-pink-900 dark:text-pink-300 flex justify-between border border-pink-100 dark:border-pink-900/60">
                      <span>Carried baseline:</span>
                      <strong>{formatCurrency(carriedOverTotals.rachel.allocatedCredit)}</strong>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none select-none">$</span>
                      <input
                        ref={creditInputRef}
                        type="text"
                        inputMode="decimal"
                        value={tempCreditInput}
                        onChange={(e) => setTempCreditInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCreditOverride('Rachel')}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                        placeholder="Active credit offset"
                        className="w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border border-pink-400 dark:border-pink-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-pink-500"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveCreditOverride('Rachel')}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                      title="Save override"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCreditCat(null);
                        setTempCreditInput('');
                      }}
                      className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {hasSavedStatements && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Combined Applied: <strong>{formatCurrency(carriedOverTotals.rachel.allocatedCredit + (Number(tempCreditInput) || 0))}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (activeTransactions.length === 0 && hasSavedStatements) {
                      alert("Credit allocations from saved statements are locked and applied. To adjust them, reopen the statement from the Saved Statements panel below, or load your next statement to allocate credits.");
                      return;
                    }
                    handleStartEditCredit('Rachel', rachelAllocatedCredit);
                  }}
                  className="group flex flex-col p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-pink-400 dark:hover:border-pink-500 bg-white dark:bg-slate-800 cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      -{formatCurrency(effectiveTotals.rachelAllocatedCredit)}
                    </span>
                    {activeTransactions.length > 0 ? (
                      <span className="text-[10px] text-slate-400 group-hover:text-pink-600 dark:group-hover:text-pink-400 font-semibold flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                        Applied from History
                      </span>
                    )}
                  </div>
                  {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400/90 mt-0.5">
                      Carried: -{formatCurrency(carriedOverTotals.rachel.allocatedCredit)} + Active: -{formatCurrency(rachelAllocatedCredit)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto-Apply Unapplied Button */}
            <div className="pt-0.5">
              {unappliedToApply > 0.005 ? (
                <button
                  type="button"
                  id="auto-apply-rachel-btn"
                  onClick={() => handleAutoApplyUnapplied('Rachel')}
                  disabled={activeTransactions.length === 0}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-pink-50 hover:bg-pink-100 dark:bg-pink-950/60 dark:hover:bg-pink-900/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer group"
                  title={`Auto-apply ${formatCurrency(unappliedToApply)} of unapplied money to Rachel`}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 group-hover:rotate-12 transition-transform" />
                    <span>Auto-Apply Unapplied</span>
                  </span>
                  <span className="font-extrabold px-1.5 py-0.5 rounded-md bg-pink-200/80 dark:bg-pink-900/90 text-pink-900 dark:text-pink-100 text-[11px]">
                    +{formatCurrency(unappliedToApply)}
                  </span>
                </button>
              ) : unappliedToApply < -0.005 ? (
                <button
                  type="button"
                  id="auto-apply-rachel-btn"
                  onClick={() => handleAutoApplyUnapplied('Rachel')}
                  disabled={activeTransactions.length === 0}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer"
                  title={`Subtract ${formatCurrency(Math.abs(unappliedToApply))} over-allocated credit from Rachel to reconcile`}
                >
                  <span className="flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Reconcile Over-Allocation</span>
                  </span>
                  <span className="font-extrabold px-1.5 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/90 text-amber-900 dark:text-amber-100 text-[11px]">
                    {formatCurrency(unappliedToApply)}
                  </span>
                </button>
              ) : (
                <div
                  id="auto-apply-rachel-status"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60"
                  title="All statement credits are already 100% applied across buckets"
                >
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>All Money Applied</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    $0.00 unapplied
                  </span>
                </div>
              )}
            </div>

            {/* Calculated Net Result */}
            <div className="p-2.5 rounded-lg bg-pink-50/60 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-pink-900 dark:text-pink-300 font-semibold block">Net Due / Spend:</span>
                {(hasSavedStatements || hasRemainingBalances) && displayScope !== 'active' && (
                  <span className="text-[10px] text-pink-700/80 dark:text-pink-300/80 block">
                    Stmt: {formatCurrency(effectiveTotals.rachelStatementNet)}
                    {effectiveTotals.rachelRemaining !== 0 && (
                      <span> + Cutoff: {formatCurrency(effectiveTotals.rachelRemaining)}</span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-pink-900 dark:text-pink-200">
                  {formatCurrency(effectiveTotals.rachelNet)}
                </span>
                {effectiveTotals.rachelNet < 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Credit
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Leisure Bucket */}
          <div className="p-4 rounded-xl border border-sky-200/80 dark:border-sky-900/50 bg-white dark:bg-slate-900/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-500" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">Leisure</span>
                <span
                  title="Linked to Andrew: credit offset adjustments stay synchronized between Andrew/Natalie and Leisure"
                  className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/60 dark:border-purple-800/60 cursor-help"
                >
                  ⇄ Andrew
                </span>
              </div>
              {leisureSummary?.isCreditOverridden ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                  Manual Override
                </span>
              ) : hasSavedStatements && activeTransactions.length === 0 ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Carried Applied
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Gross Charges</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(effectiveTotals.leisureGross)}
                </span>
                {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Carried: {formatCurrency(carriedOverTotals.leisure.debit)} + Active: {formatCurrency(leisureGross)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase">Auto Credit Sum</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  {formatCurrency(effectiveTotals.leisureAutoCredit)}
                </span>
                {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Carried: {formatCurrency(carriedOverTotals.leisure.credit)} + Active: {formatCurrency(leisureSummary?.totalCredit || 0)}
                  </div>
                )}
              </div>
            </div>

            {/* Credit Input / Edit Row */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Credit Offset Applied:</span>
                {leisureSummary?.isCreditOverridden && activeTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onUpdateCreditOverride?.('Leisure', null, true)}
                    className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-0.5"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Revert Active to Auto
                  </button>
                )}
              </label>

              {editingCreditCat === 'Leisure' ? (
                <div className="space-y-2">
                  {hasSavedStatements && (
                    <div className="text-[11px] p-2 rounded-lg bg-sky-50/60 dark:bg-sky-950/40 text-sky-900 dark:text-sky-300 flex justify-between border border-sky-100 dark:border-sky-900/60">
                      <span>Carried baseline:</span>
                      <strong>{formatCurrency(carriedOverTotals.leisure.allocatedCredit)}</strong>
                    </div>
                  )}

                  {/* Quick delta buttons inside editor */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Quick:</span>
                    {[10, 25, 50, 100].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(tempCreditInput.replace(/[$,\s]/g, '')) || leisureAllocatedCredit;
                          setTempCreditInput((current + step).toFixed(2));
                        }}
                        className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-800 transition-colors"
                      >
                        +{step}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseFloat(tempCreditInput.replace(/[$,\s]/g, '')) || leisureAllocatedCredit;
                        setTempCreditInput(Math.max(0, current - 25).toFixed(2));
                      }}
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                    >
                      -25
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none select-none">$</span>
                      <input
                        ref={creditInputRef}
                        type="text"
                        inputMode="decimal"
                        value={tempCreditInput}
                        onChange={(e) => setTempCreditInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveCreditOverride('Leisure')}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                        placeholder="e.g. 50.00 or +25"
                        className="w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border border-sky-400 dark:border-sky-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveCreditOverride('Leisure')}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                      title="Save override & sync Andrew"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCreditCat(null);
                        setTempCreditInput('');
                      }}
                      className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {(() => {
                    const raw = tempCreditInput.trim().replace(/[$,\s]/g, '');
                    let targetVal = leisureAllocatedCredit;
                    if (raw.startsWith('+')) {
                      const num = parseFloat(raw.substring(1));
                      if (!isNaN(num)) targetVal = leisureAllocatedCredit + num;
                    } else if (raw.startsWith('-')) {
                      const num = parseFloat(raw.substring(1));
                      if (!isNaN(num)) targetVal = Math.max(0, leisureAllocatedCredit - num);
                    } else {
                      const num = parseFloat(raw);
                      if (!isNaN(num)) targetVal = num;
                    }

                    const delta = Math.round((targetVal - leisureAllocatedCredit) * 100) / 100;
                    const projectedAndrew = Math.round((andrewAllocatedCredit - delta) * 100) / 100;
                    return (
                      <div className="text-[10px] p-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800 flex flex-col gap-0.5">
                        <span className="font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                          Auto-Sync with Andrew/Natalie:
                        </span>
                        {delta > 0 ? (
                          <span>
                            Adding +${delta.toFixed(2)} to Leisure will <strong>subtract -${delta.toFixed(2)}</strong> from Andrew/Natalie (New Andrew: {formatCurrency(projectedAndrew)}).
                          </span>
                        ) : delta < 0 ? (
                          <span>
                            Subtracting -${Math.abs(delta).toFixed(2)} from Leisure will <strong>add +${Math.abs(delta).toFixed(2)}</strong> to Andrew/Natalie (New Andrew: {formatCurrency(projectedAndrew)}).
                          </span>
                        ) : (
                          <span>Amounts will stay in sync (no net change).</span>
                        )}
                      </div>
                    );
                  })()}
                  {hasSavedStatements && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Combined Applied: <strong>{formatCurrency(carriedOverTotals.leisure.allocatedCredit + (parseFloat(tempCreditInput.replace(/[$,\s]/g, '')) || 0))}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (activeTransactions.length === 0 && hasSavedStatements) {
                      alert("Credit allocations from saved statements are locked and applied. To adjust them, reopen the statement from the Saved Statements panel below, or load your next statement to allocate credits.");
                      return;
                    }
                    handleStartEditCredit('Leisure', leisureAllocatedCredit);
                  }}
                  className="group flex flex-col p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500 bg-white dark:bg-slate-800 cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                      -{formatCurrency(effectiveTotals.leisureAllocatedCredit)}
                    </span>
                    {activeTransactions.length > 0 ? (
                      <span className="text-[10px] text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 font-semibold flex items-center gap-1">
                        <Edit3 className="w-3 h-3" /> Edit Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                        Applied from History
                      </span>
                    )}
                  </div>
                  {hasSavedStatements && activeTransactions.length > 0 && displayScope !== 'active' && (
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400/90 mt-0.5">
                      Carried: -{formatCurrency(carriedOverTotals.leisure.allocatedCredit)} + Active: -{formatCurrency(leisureAllocatedCredit)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto-Apply Unapplied Button */}
            <div className="pt-0.5">
              {unappliedToApply > 0.005 ? (
                <button
                  type="button"
                  id="auto-apply-leisure-btn"
                  onClick={() => handleAutoApplyUnapplied('Leisure')}
                  disabled={activeTransactions.length === 0}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer group"
                  title={`Auto-apply ${formatCurrency(unappliedToApply)} of unapplied money to Leisure`}
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 group-hover:rotate-12 transition-transform" />
                    <span>Auto-Apply Unapplied</span>
                  </span>
                  <span className="font-extrabold px-1.5 py-0.5 rounded-md bg-sky-200/80 dark:bg-sky-900/90 text-sky-900 dark:text-sky-100 text-[11px]">
                    +{formatCurrency(unappliedToApply)}
                  </span>
                </button>
              ) : unappliedToApply < -0.005 ? (
                <button
                  type="button"
                  id="auto-apply-leisure-btn"
                  onClick={() => handleAutoApplyUnapplied('Leisure')}
                  disabled={activeTransactions.length === 0}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 transition-all shadow-2xs hover:shadow-xs active:scale-[0.99] cursor-pointer"
                  title={`Subtract ${formatCurrency(Math.abs(unappliedToApply))} over-allocated credit from Leisure to reconcile`}
                >
                  <span className="flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Reconcile Over-Allocation</span>
                  </span>
                  <span className="font-extrabold px-1.5 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/90 text-amber-900 dark:text-amber-100 text-[11px]">
                    {formatCurrency(unappliedToApply)}
                  </span>
                </button>
              ) : (
                <div
                  id="auto-apply-leisure-status"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800/60"
                  title="All credits are already 100% applied across buckets"
                >
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>All Credits Applied</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    $0.00 unapplied
                  </span>
                </div>
              )}
            </div>

            {/* Calculated Net Result */}
            <div className="p-2.5 rounded-lg bg-sky-50/60 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-sky-900 dark:text-sky-300 font-semibold block">Net Due / Spend:</span>
                {(hasSavedStatements || hasRemainingBalances) && displayScope !== 'active' && (
                  <span className="text-[10px] text-sky-700/80 dark:text-sky-300/80 block">
                    Stmt: {formatCurrency(effectiveTotals.leisureStatementNet)}
                    {effectiveTotals.leisureRemaining !== 0 && (
                      <span> + Cutoff: {formatCurrency(effectiveTotals.leisureRemaining)}</span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-sky-900 dark:text-sky-200">
                  {formatCurrency(effectiveTotals.leisureNet)}
                </span>
                {effectiveTotals.leisureNet < 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Credit
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts and Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Chart View */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* Chart View Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Interactive Visualizations
              </h3>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveChartTab('overview')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeChartTab === 'overview'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Donut Share
              </button>
              <button
                onClick={() => setActiveChartTab('comparison')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeChartTab === 'comparison'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Gross vs Credits
              </button>
              <button
                onClick={() => setActiveChartTab('cards')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeChartTab === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                By Card No.
              </button>
              <button
                onClick={() => setActiveChartTab('timeline')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  activeChartTab === 'timeline'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Timeline
              </button>
            </div>
          </div>

          {/* Chart Content Body */}
          <div className="pt-6 min-h-[300px] flex items-center justify-center">
            {activeChartTab === 'overview' && (
              <div className="w-full flex flex-col md:flex-row items-center justify-around gap-6">
                {/* SVG Donut Chart */}
                <div className="relative w-56 h-56 flex-shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    {donutSlices.length === 0 ? (
                      <circle cx="100" cy="100" r="70" fill="none" stroke="#e2e8f0" strokeWidth="26" />
                    ) : (
                      donutSlices.map((slice) => (
                        <path
                          key={slice.category}
                          d={slice.path}
                          fill={slice.color}
                          className="transition-all duration-300 hover:opacity-85 cursor-pointer"
                          onMouseEnter={() => setHoveredSlice(slice.category)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          onClick={() =>
                            onSelectCategoryFilter?.(
                              selectedCategoryFilter === slice.category ? 'ALL' : slice.category
                            )
                          }
                        />
                      ))
                    )}
                  </svg>
                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-xs uppercase font-medium text-slate-400">
                      {hoveredSlice || (displayScope === 'active' ? 'Active Spend' : 'Net Due / Spend')}
                    </span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      {hoveredSlice
                        ? formatCurrency(effectiveSummaries.find((s) => s.category === hoveredSlice)?.netSpend || 0)
                        : formatCurrency(effectiveTotals.totalNet)}
                    </span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="flex-1 w-full space-y-3">
                  {effectiveSummaries.map((s) => {
                    const isSelected = selectedCategoryFilter === s.category;
                    return (
                      <div
                        key={s.category}
                        onClick={() => onSelectCategoryFilter?.(isSelected ? 'ALL' : s.category)}
                        onMouseEnter={() => setHoveredSlice(s.category)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-50 dark:bg-slate-800 border-indigo-400 dark:border-indigo-600'
                            : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3.5 h-3.5 rounded-md shadow-2xs shrink-0"
                            style={{ backgroundColor: s.color }}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                {s.category === 'Andrew' ? 'Andrew/Natalie' : s.category}
                              </span>
                              {s.isCreditOverridden && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                                  Manual Credit
                                </span>
                              )}
                              {s.remainingBalance ? (
                                <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Cutoff: {formatCurrency(s.remainingBalance)}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-xs text-slate-400 block">{s.count} transactions</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {formatCurrency(s.netSpend)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 block">
                            {s.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeChartTab === 'comparison' && (
              <div className="w-full space-y-5">
                {effectiveSummaries.map((s) => {
                  const maxVal = Math.max(
                    ...effectiveSummaries.map((x) => Math.max(x.totalDebit, Math.abs(x.netSpend), Math.abs(x.allocatedCredit))),
                    1
                  );
                  const debitPct = Math.min(100, Math.max(0, (s.totalDebit / maxVal) * 100));
                  const creditPct = Math.min(100, Math.max(0, (Math.abs(s.allocatedCredit) / maxVal) * 100));

                  return (
                    <div key={s.category} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></span>
                          {s.category === 'Andrew' ? 'Andrew/Natalie' : s.category}
                          {s.isCreditOverridden && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              (Manual Credit)
                            </span>
                          )}
                          {s.remainingBalance ? (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              (Cutoff: {formatCurrency(s.remainingBalance)})
                            </span>
                          ) : null}
                        </span>
                        <div className="flex gap-4 items-center">
                          <span className="text-slate-500">Gross: {formatCurrency(s.totalDebit)}</span>
                          {s.allocatedCredit !== 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Credits: -{formatCurrency(s.allocatedCredit)}
                            </span>
                          )}
                          <span className={`font-extrabold ${s.netSpend < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                            Net: {formatCurrency(s.netSpend)}
                          </span>
                        </div>
                      </div>

                      {/* Stacked / Dual Bar */}
                      <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex relative">
                        <div
                          style={{ width: `${debitPct}%`, backgroundColor: s.color }}
                          className="h-full rounded-l-full transition-all duration-500"
                          title={`Gross Charges: ${formatCurrency(s.totalDebit)}`}
                        />
                        {s.allocatedCredit > 0 && (
                          <div
                            style={{ width: `${creditPct}%` }}
                            className="h-full bg-emerald-400 opacity-90 transition-all duration-500"
                            title={`Credits Applied: -${formatCurrency(s.allocatedCredit)}`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeChartTab === 'cards' && (
              <div className="w-full space-y-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Distribution of charges by Card Number and corresponding category defaults:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cardBreakdown.map((card) => {
                    let cardDisplayName = card.cardNumber;
                    const isTravelCard = card.cardNumber.toLowerCase() === 'travel' || card.cardNumber.toLowerCase().includes('travel');

                    if (isTravelCard) {
                      cardDisplayName = 'Travel - Capital One Travel';
                    } else if (card.cardNumber.includes('2642') || card.cardNumber.endsWith('2642')) {
                      cardDisplayName = `${card.cardNumber} - Andrew`;
                    } else if (card.cardNumber.includes('3810') || card.cardNumber.endsWith('3810')) {
                      cardDisplayName = `${card.cardNumber} - Rachel`;
                    } else if (card.cardNumber.includes('6744') || card.cardNumber.endsWith('6744')) {
                      cardDisplayName = `${card.cardNumber} - Natalie`;
                    }

                    return (
                      <div
                        key={card.cardNumber}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isTravelCard ? (
                              <Palmtree className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            ) : (
                              <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                            <span className="font-bold text-sm text-slate-800 dark:text-white font-mono">
                              {cardDisplayName}
                            </span>
                          </div>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {card.count} txns
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-500">Net Charged:</span>
                          <span className="font-extrabold text-base text-slate-900 dark:text-white">
                            {formatCurrency(card.netSpend)}
                          </span>
                        </div>

                        {/* Mini category tags for this card */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-1.5">
                          {Object.entries(card.categories).map(([cat, amt]) => {
                            let tagLabel = cat;
                            if (cat === 'Andrew') {
                              if (card.cardNumber.includes('6744') || card.cardNumber.endsWith('6744')) {
                                tagLabel = 'Natalie';
                              } else {
                                tagLabel = 'Andrew';
                              }
                            }
                            return (
                              <span
                                key={cat}
                                className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                                  CATEGORY_COLORS[cat as CategoryType]?.badgeBg || 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {tagLabel}: {formatCurrency(Number(amt))}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeChartTab === 'timeline' && (
              <div className="w-full space-y-4">
                {monthlyBreakdown.length === 0 ? (
                  <div className="text-center text-slate-400 text-sm py-8">No date history available.</div>
                ) : (
                  <div className="space-y-3">
                    {monthlyBreakdown.map((m) => {
                      const maxMonthTotal = Math.max(...monthlyBreakdown.map((x) => x.total), 1);
                      const barWidth = Math.min(100, Math.max(10, (m.total / maxMonthTotal) * 100));

                      return (
                        <div key={m.monthKey} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span>{m.monthKey}</span>
                            <span>{formatCurrency(m.total)}</span>
                          </div>
                          <div className="h-5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex">
                            {m.andrew > 0 && (
                              <div
                                style={{ width: `${(m.andrew / m.total) * barWidth}%` }}
                                className="bg-purple-600 h-full"
                                title={`Andrew: ${formatCurrency(m.andrew)}`}
                              />
                            )}
                            {m.rachel > 0 && (
                              <div
                                style={{ width: `${(m.rachel / m.total) * barWidth}%` }}
                                className="bg-pink-400 h-full"
                                title={`Rachel: ${formatCurrency(m.rachel)}`}
                              />
                            )}
                            {m.leisure > 0 && (
                              <div
                                style={{ width: `${(m.leisure / m.total) * barWidth}%` }}
                                className="bg-sky-500 h-full"
                                title={`Leisure: ${formatCurrency(m.leisure)}`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Aggregated Summary Breakdown Table */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Category Summary Report
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeTransactions.length} Active Txns
              </span>
            </div>

            {/* Clean summary list */}
            <div className="mt-4 space-y-3">
              {effectiveSummaries.map((s) => {
                return (
                  <div
                    key={s.category}
                    className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }}></span>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {s.category === 'Andrew' ? 'Andrew/Natalie' : s.category}
                        </span>
                        {s.isCreditOverridden && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Override
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {formatCurrency(s.netSpend)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">Net Spend</span>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="block text-[10px] uppercase text-slate-400">Gross</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatCurrency(s.totalDebit)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-slate-400">
                          {s.isCreditOverridden ? 'Credit Override' : 'Credits Applied'}
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          -{formatCurrency(s.allocatedCredit)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] uppercase text-slate-400">Share</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {s.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total Summary Footer Box */}
          <div className="mt-5 p-4 rounded-xl bg-slate-900 text-white dark:bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  {hasSavedStatements && displayScope === 'combined'
                    ? 'Combined Total Net Spend'
                    : displayScope === 'carried'
                    ? 'Carried Total Net Spend'
                    : 'Grand Total Net Spend'}
                </span>
                <div className="text-xl font-black mt-0.5 text-white">
                  {formatCurrency(effectiveTotals.totalNet)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Gross: {formatCurrency(effectiveTotals.totalDebit)} &bull; Credits: -{formatCurrency(effectiveTotals.totalAllocatedCredit)}
                </div>
              </div>
              <button
                onClick={handleExportSummary}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                CSV Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Spending & Category Analytics Section Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Spending &amp; Category Analytics
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Live Reactivity Active
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time calculations automatically recompute whenever transactions are updated, reassigned, or when custom credit overrides are adjusted.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleExportSummary}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors border border-slate-300 dark:border-slate-700 shadow-2xs"
            title="Download CSV breakdown of categories, gross debits, credit offsets, and net spending"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Summary CSV</span>
          </button>

          <button
            onClick={handleExportAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-2xs"
            title="Download full categorized transactions list with assigned categories"
          >
            <Download className="w-4 h-4" />
            <span>Export Categorized CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
