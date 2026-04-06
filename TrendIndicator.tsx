interface TrendIndicatorProps {
  change: number;
  isPositive: boolean; // true = increase is good (e.g. healthy count), false = increase is bad (e.g. errors)
}

export function TrendIndicator({ change, isPositive }: TrendIndicatorProps) {
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <span className="text-base leading-none">→</span>
        No change
      </span>
    );
  }

  const isGood = isPositive ? change > 0 : change < 0;
  const arrow = change > 0 ? '↑' : '↓';
  const sign = change > 0 ? '+' : '';

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      isGood
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-red-100 text-red-700'
    }`}>
      {arrow} {sign}{change}
    </span>
  );
}
