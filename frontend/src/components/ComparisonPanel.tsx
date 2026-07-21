import { useState } from 'react';
import {
  ComparisonResult,
  AtmStatusChange,
  AtmBalanceChange,
  ComponentChange,
} from '../lib/api';
import {
  ArrowLeftRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Banknote,
  Wrench,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
  ChevronDown,
} from 'lucide-react';

interface ComparisonPanelProps {
  comparison: ComparisonResult | null;
}

const formatAmount = (amount: number | null | undefined) =>
  amount == null
    ? 'N/A'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);

const formatTime = (date: string | null | undefined) =>
  date ? new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const levelDotClass: Record<string, string> = {
  critical: 'bg-red-500',
  low: 'bg-amber-500',
  healthy: 'bg-emerald-500',
};

const levelTextClass: Record<string, string> = {
  critical: 'text-red-600',
  low: 'text-amber-600',
  healthy: 'text-emerald-600',
};

// ── Small building blocks ────────────────────────────────────────────────────

function SummaryChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
}) {
  const toneClass =
    tone === 'good'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'bad'
        ? 'bg-red-50 text-red-700 border-red-200'
        : tone === 'warn'
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${toneClass} ${value === 0 ? 'opacity-40' : ''}`}>
      {icon}
      <span className="text-sm font-bold">{value}</span>
      {label}
    </span>
  );
}

function ComponentPill({ change, kind }: { change: ComponentChange; kind: 'fixed' | 'new' | 'ongoing' }) {
  const cls =
    kind === 'fixed'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : kind === 'new'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-amber-50 text-amber-700 border-amber-200';
  const icon =
    kind === 'fixed' ? <CheckCircle className="w-3 h-3" />
    : kind === 'new' ? <XCircle className="w-3 h-3" />
    : <AlertCircle className="w-3 h-3" />;

  const worsened = kind === 'ongoing' && change.previous_status !== change.current_status;
  const detail =
    kind === 'fixed' ? `was ${change.previous_status}`
    : kind === 'new' ? change.current_status
    : worsened ? `${change.previous_status} → ${change.current_status}`
    : change.current_status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cls}`}
      title={`${change.label}: ${change.previous_status} → ${change.current_status}${change.current_raw ? ` (${change.current_raw})` : ''}`}
    >
      {icon}
      {change.label}
      <span className="font-normal opacity-75">{detail}</span>
    </span>
  );
}

// ── Hardware changes column ──────────────────────────────────────────────────

function HardwareChangeRow({ atm }: { atm: AtmStatusChange }) {
  return (
    <div className={`p-3 rounded-lg border ${
      atm.new_errors.length > 0
        ? 'border-red-200 bg-red-50/40'
        : atm.fully_recovered
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-bold text-slate-900">{atm.atm_name || atm.atm_pid}</span>
          <span className="ml-2 text-xs text-slate-400 font-medium">{atm.atm_pid}{atm.branch ? ` · Branch ${atm.branch}` : ''}</span>
        </div>
        {atm.fully_recovered && (
          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle className="w-3 h-3" /> RECOVERED
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {atm.fixed.map(c => <ComponentPill key={`f-${c.component}`} change={c} kind="fixed" />)}
        {atm.new_errors.map(c => <ComponentPill key={`n-${c.component}`} change={c} kind="new" />)}
        {atm.ongoing.map(c => <ComponentPill key={`o-${c.component}`} change={c} kind="ongoing" />)}
      </div>
    </div>
  );
}

// ── Balance changes column ───────────────────────────────────────────────────

function balanceBadge(atm: AtmBalanceChange) {
  if (atm.is_fixed) return { text: 'RECOVERED', cls: 'bg-emerald-100 text-emerald-700' };
  if (atm.change_type === 'refilled') return { text: 'REFILLED', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200' };
  if (atm.previous_level === 'critical' && atm.current_level === 'critical')
    return { text: 'STILL CRITICAL', cls: 'bg-red-100 text-red-700' };
  if (atm.current_level === 'critical') return { text: 'WENT CRITICAL', cls: 'bg-red-100 text-red-700' };
  if (atm.current_level === 'low') return { text: 'LOW', cls: 'bg-amber-100 text-amber-700' };
  return null;
}

function BalanceChangeRow({ atm }: { atm: AtmBalanceChange }) {
  const badge = balanceBadge(atm);
  const delta = atm.delta ?? 0;
  return (
    <div className={`p-3 rounded-lg border ${
      atm.current_level === 'critical'
        ? 'border-red-200 bg-red-50/40'
        : atm.is_fixed
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm font-bold text-slate-900">{atm.atm_name || atm.terminal_id}</span>
          <span className="ml-2 text-xs text-slate-400 font-medium">{atm.terminal_id}{atm.branch ? ` · Branch ${atm.branch}` : ''}</span>
        </div>
        {badge && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          <span className={`inline-flex items-center gap-1 ${levelTextClass[atm.previous_level]}`}>
            <span className={`w-2 h-2 rounded-full ${levelDotClass[atm.previous_level]}`} />
            {atm.previous_pct}%
          </span>
          <ArrowLeftRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={`inline-flex items-center gap-1 ${levelTextClass[atm.current_level]}`}>
            <span className={`w-2 h-2 rounded-full ${levelDotClass[atm.current_level]}`} />
            {atm.current_pct}%
          </span>
        </div>
        {delta !== 0 && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {delta > 0 ? '+' : '−'}{formatAmount(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function ComparisonPanel({ comparison }: ComparisonPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!comparison) return null;

  const status = comparison.status_comparison ?? null;
  const balance = comparison.balance_comparison ?? null;

  if (!status && !balance) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100 mb-8 flex items-center gap-3 text-slate-500">
        <ArrowLeftRight className="w-5 h-5 flex-shrink-0 text-slate-400" />
        <span className="text-sm">
          File comparison needs at least two report files — it will appear automatically once the next report arrives.
        </span>
      </div>
    );
  }

  const fileInfo = status ?? balance;
  const statusAtms = status?.atms ?? [];
  const balanceAtms = balance?.atms ?? [];

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-100 mb-8 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className="w-full px-6 py-4 flex flex-wrap items-center gap-3 bg-gradient-to-r from-slate-50 to-yellow-50 border-b border-slate-100 text-left hover:from-yellow-50 hover:to-yellow-50 transition-colors"
        aria-expanded={!collapsed}
      >
        <ArrowLeftRight className="w-6 h-6 text-yellow-600 flex-shrink-0" />
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-lg font-bold text-slate-900">Changes vs Previous Report</h2>
          <p className="text-xs text-slate-500 font-medium">
            {fileInfo?.previous_file?.file_name ?? '—'} ({formatTime(fileInfo?.previous_file?.file_date)})
            {' → '}
            {fileInfo?.current_file?.file_name ?? '—'} ({formatTime(fileInfo?.current_file?.file_date)})
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {status && (
            <>
              <SummaryChip icon={<CheckCircle className="w-3.5 h-3.5" />} label="errors fixed" value={status.summary.fixed_count} tone="good" />
              <SummaryChip icon={<XCircle className="w-3.5 h-3.5" />} label="new errors" value={status.summary.new_count} tone="bad" />
              <SummaryChip icon={<AlertCircle className="w-3.5 h-3.5" />} label="ongoing" value={status.summary.ongoing_count} tone="warn" />
            </>
          )}
          {balance && (
            <>
              <SummaryChip icon={<Banknote className="w-3.5 h-3.5" />} label="refilled" value={balance.summary.refilled_count} tone="good" />
              <SummaryChip icon={<XCircle className="w-3.5 h-3.5" />} label="went critical" value={balance.summary.went_critical_count} tone="bad" />
              <SummaryChip icon={<AlertCircle className="w-3.5 h-3.5" />} label="still critical" value={balance.summary.still_critical_count} tone="warn" />
            </>
          )}
          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hardware changes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-5 h-5 text-slate-600" />
              <h3 className="font-bold text-slate-900">Hardware Changes</h3>
              {status && status.summary.atms_fully_recovered > 0 && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {status.summary.atms_fully_recovered} ATM{status.summary.atms_fully_recovered > 1 ? 's' : ''} recovered
                </span>
              )}
            </div>
            {!status ? (
              <p className="text-sm text-slate-400 py-6 text-center">No previous status file to compare.</p>
            ) : statusAtms.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <CheckCircle className="w-4 h-4" /> No hardware errors in either file.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {statusAtms.map(atm => (
                  <HardwareChangeRow key={atm.atm_pid ?? atm.atm_name ?? ''} atm={atm} />
                ))}
              </div>
            )}
            {status && (status.atms_added.length > 0 || status.atms_removed.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {status.atms_added.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />
                    New in report: {status.atms_added.join(', ')}
                  </span>
                )}
                {status.atms_removed.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <MinusCircle className="w-3.5 h-3.5 text-red-400" />
                    Missing from report: {status.atms_removed.join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Balance changes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="w-5 h-5 text-slate-600" />
              <h3 className="font-bold text-slate-900">Balance Changes</h3>
              {balance && balance.summary.recovered_count > 0 && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {balance.summary.recovered_count} recovered
                </span>
              )}
            </div>
            {!balance ? (
              <p className="text-sm text-slate-400 py-6 text-center">No previous balance file to compare.</p>
            ) : balanceAtms.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <CheckCircle className="w-4 h-4" /> No balance changes — everything healthy.
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {balanceAtms.map(atm => (
                  <BalanceChangeRow key={atm.terminal_id ?? atm.atm_id ?? atm.atm_name ?? ''} atm={atm} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
