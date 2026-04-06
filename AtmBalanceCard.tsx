import { AtmBalance } from '../lib/api';
import { Banknote, TrendingDown, Wallet } from 'lucide-react';

interface AtmBalanceCardProps {
  balance: AtmBalance;
  prevBalance?: AtmBalance;
  onClick: () => void;
  thresholdCritical: number;
  thresholdLow: number;
}

export function AtmBalanceCard({ balance, prevBalance, onClick, thresholdCritical, thresholdLow }: AtmBalanceCardProps) {
  const remainingPercentage = balance.initial_balance_all
    ? ((balance.remaining_balance_all || 0) / balance.initial_balance_all) * 100
    : 0;

  const getStatusColor = (percentage: number) => {
    if (percentage > thresholdLow) return 'bg-emerald-500';
    if (percentage > thresholdCritical) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const dispensed = (balance.initial_balance_all ?? 0) - (balance.remaining_balance_all ?? 0);

  const prevRemaining = prevBalance?.remaining_balance_all ?? null;
  const currRemaining = balance.remaining_balance_all ?? null;
  const delta = (prevRemaining !== null && currRemaining !== null) ? currRemaining - prevRemaining : null;
  const wasRefilled = delta !== null && delta > 0;
  const deltaPct = (prevRemaining !== null && prevRemaining > 0 && delta !== null)
    ? Math.abs(delta / prevRemaining * 100).toFixed(1)
    : null;

  const getDeltaBadge = () => {
    if (delta === null) return null;
    if (wasRefilled) return (
      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
        ↑ REFILLED
      </span>
    );
    if (delta < 0 && deltaPct !== null) return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
        ↓ −{deltaPct}%
      </span>
    );
    return null;
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e: { key: string }) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="group bg-white rounded-xl shadow-md hover:shadow-xl active:shadow-md active:scale-[0.98] transition-all duration-200 cursor-pointer p-6 border border-slate-100 hover:border-slate-200 overflow-hidden relative touch-manipulation select-none"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-50/0 to-yellow-50/0 group-hover:from-yellow-50 group-hover:to-yellow-50/40 transition-all duration-300" />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-yellow-600 transition-colors">
              {balance.atm_name || balance.atm_id || 'Unknown ATM'}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-500 font-medium">{balance.terminal_id}</p>
              {balance.branch && (
                <span className="text-xs px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
                  Branch {balance.branch}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getDeltaBadge()}
            <div className={`w-4 h-4 rounded-full shadow-lg ${getStatusColor(remainingPercentage)} animate-pulse`} />
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group-hover:bg-yellow-50 transition-colors">
            <div className="flex items-center gap-2 text-slate-600">
              <Wallet className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-medium">Remaining</span>
            </div>
            <span className="font-bold text-slate-900">
              {formatCurrency(balance.remaining_balance_all)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group-hover:bg-yellow-50 transition-colors">
            <div className="flex items-center gap-2 text-slate-600">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium">Dispensed</span>
            </div>
            <span className="text-slate-700 font-semibold">
              {formatCurrency(dispensed)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group-hover:bg-yellow-50 transition-colors">
            <div className="flex items-center gap-2 text-slate-600">
              <Banknote className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium">Withdrawals</span>
            </div>
            <span className="text-slate-700 font-semibold">{balance.no_withdrawals_all || 0}</span>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-500 mb-3 font-medium">
              <span>
                {balance.balance_date
                  ? new Date(balance.balance_date).toLocaleDateString()
                  : 'No date'}
              </span>
              <span className="font-bold text-slate-700">{remainingPercentage.toFixed(0)}% remaining</span>
            </div>
            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getStatusColor(remainingPercentage)} transition-all duration-500 rounded-full`}
                style={{ width: `${remainingPercentage}%` }}
              />
            </div>
            {delta !== null && delta !== 0 && (
              <div className={`mt-2 text-xs font-medium ${wasRefilled ? 'text-emerald-600' : 'text-red-500'}`}>
                {wasRefilled
                  ? `+${formatCurrency(delta)} added since last check`
                  : `−${formatCurrency(Math.abs(delta))} since last check`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
