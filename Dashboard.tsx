import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AtmBalance, AtmStatus, fetchLatestBalances, fetchLatestStatuses, BALANCE_THRESHOLD_CRITICAL, BALANCE_THRESHOLD_LOW } from '../lib/api';
import { AtmBalanceCard } from './AtmBalanceCard';
import { AtmStatusTable } from './AtmStatusTable';
import { AtmDetailsModal } from './AtmDetailsModal';
import { TrendIndicator } from './TrendIndicator';
import { Search, AlertTriangle, CheckCircle, Activity, Clock, Zap, TrendingUp, Eye, EyeOff, WifiOff, Download, ChevronDown, ArrowUpDown } from 'lucide-react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { decodeField, decodeDeviceStatus } from '../lib/hardwareStatusDecoder';
import { snapshotManager, DataChange } from '../lib/dataContext';

const getBalancePct = (b: AtmBalance): number =>
  b.initial_balance_all
    ? ((b.remaining_balance_all || 0) / b.initial_balance_all) * 100
    : 0;


function csvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function SkeletonCard({ i }: { i: number }) {
  return (
    <div key={i} className="bg-white rounded-xl shadow-md p-6 border border-slate-100 animate-pulse">
      <div className="flex justify-between items-start mb-5">
        <div className="space-y-2">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="h-4 w-24 bg-slate-100 rounded" />
        </div>
        <div className="w-4 h-4 rounded-full bg-slate-200" />
      </div>
      <div className="space-y-3">
        <div className="h-12 bg-slate-100 rounded-lg" />
        <div className="h-12 bg-slate-100 rounded-lg" />
        <div className="h-12 bg-slate-100 rounded-lg" />
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="h-2.5 bg-slate-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  status: '#dc2626',
  net: '#f97316',
  crd_reader: '#eab308',
  dispenser: '#d946ef',
  encryptor: '#6366f1',
  depository: '#8b5cf6',
};

export function Dashboard() {
  const [balances, setBalances] = useState<AtmBalance[]>(() => {
    try { return JSON.parse(localStorage.getItem('atm_balances') || '[]'); }
    catch { return []; }
  });
  const [statuses, setStatuses] = useState<AtmStatus[]>(() => {
    try { return JSON.parse(localStorage.getItem('atm_statuses') || '[]'); }
    catch { return []; }
  });
  // loading = true only when no cached data exists (first-ever visit)
  const [loading, setLoading] = useState(() => {
    try { return !localStorage.getItem('atm_balances'); }
    catch { return true; }
  });
  const [searchTerm, setSearchTerm] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [selectedAtm, setSelectedAtm] = useState<AtmBalance | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'low' | 'critical'>(() => {
    const v = new URLSearchParams(window.location.search).get('filter');
    return (v === 'low' || v === 'critical') ? v : 'all';
  });
  const [refreshInterval, setRefreshInterval] = useState<10 | 60 | 300 | 600>(() => {
    try { const v = Number(localStorage.getItem('setting_refresh_interval')); return ([10, 60, 300, 600].includes(v) ? v : 60) as 10 | 60 | 300 | 600; } catch { return 60; }
  });
  const [hardwareFilter, setHardwareFilter] = useState<string>(() => new URLSearchParams(window.location.search).get('hw') ?? 'all');
  const [showHealthyBalance, setShowHealthyBalance] = useState(() => {
    try { return localStorage.getItem('setting_show_healthy') === 'true'; } catch { return false; }
  });
  const [dataChanges, setDataChanges] = useState<DataChange>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<'pct_asc' | 'pct_desc' | 'name' | 'branch'>(() => {
    try { const v = localStorage.getItem('setting_sort_by'); return (['pct_asc', 'pct_desc', 'name', 'branch'].includes(v ?? '') ? v : 'pct_asc') as 'pct_asc' | 'pct_desc' | 'name' | 'branch'; } catch { return 'pct_asc'; }
  });
  const [thresholdCritical, setThresholdCritical] = useState(() => {
    try { const v = Number(localStorage.getItem('setting_threshold_critical')); return (v > 0 && v < 99) ? v : BALANCE_THRESHOLD_CRITICAL; } catch { return BALANCE_THRESHOLD_CRITICAL; }
  });
  const [thresholdLow, setThresholdLow] = useState(() => {
    try {
      const c = Number(localStorage.getItem('setting_threshold_critical'));
      const safeC = (c > 0 && c < 99) ? c : BALANCE_THRESHOLD_CRITICAL;
      const v = Number(localStorage.getItem('setting_threshold_low'));
      return (v > safeC && v < 100) ? v : BALANCE_THRESHOLD_LOW;
    } catch { return BALANCE_THRESHOLD_LOW; }
  });
  const [prevBalances, setPrevBalances] = useState<AtmBalance[]>(() => {
    try { return JSON.parse(localStorage.getItem('atm_balances_prev') || '[]'); }
    catch { return []; }
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const balancesRef = useRef<AtmBalance[]>(balances);
  const thresholdRef = useRef({ critical: thresholdCritical, low: thresholdLow });
  // Start as true if cache exists — so first fetch runs as background refresh, not blocking load
  const hasLoadedRef = useRef((() => {
    try { return !!localStorage.getItem('atm_balances'); }
    catch { return false; }
  })());

  const fetchData = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    else setIsRefreshing(true);
    try {
      const [balanceData, statusData] = await Promise.all([
        fetchLatestBalances(),
        fetchLatestStatuses(),
      ]);

      if (balanceData?.length > 0) {
        if (balancesRef.current.length > 0) {
          setPrevBalances(balancesRef.current);
          try { localStorage.setItem('atm_balances_prev', JSON.stringify(balancesRef.current)); } catch { /* quota */ }
        }
        balancesRef.current = balanceData;
        setBalances(balanceData);
        try { localStorage.setItem('atm_balances', JSON.stringify(balanceData)); } catch { /* quota */ }
      }
      if (statusData?.length > 0) {
        setStatuses(statusData);
        try { localStorage.setItem('atm_statuses', JSON.stringify(statusData)); } catch { /* quota */ }
      }

      if (balanceData?.length > 0) {
        const fileName = balanceData[0].file_name ?? '';
        if (snapshotManager.isNewFile(fileName)) {
          const tc = thresholdRef.current.critical;
          const tl = thresholdRef.current.low;
          const balStats = {
            critical: balanceData.filter(b => getBalancePct(b) <= tc).length,
            low: balanceData.filter(b => { const p = getBalancePct(b); return p > tc && p <= tl; }).length,
            healthy: balanceData.filter(b => getBalancePct(b) > tl).length,
          };
          const hwStats = (statusData ?? []).reduce((acc: { healthy: number; errors: number; warnings: number }, s: AtmStatus) => {
            const decoded = [
              decodeField(s.status, 'status'), decodeField(s.net, 'net'),
              decodeDeviceStatus(s.crd_reader), decodeDeviceStatus(s.dispenser),
              decodeDeviceStatus(s.encryptor), decodeDeviceStatus(s.depository),
              decodeDeviceStatus(s.bil_cas1), decodeDeviceStatus(s.bil_cas2),
              decodeDeviceStatus(s.bil_cas3), decodeDeviceStatus(s.bil_cas4),
              decodeDeviceStatus(s.bil_cas5), decodeDeviceStatus(s.bil_cas6),
              decodeDeviceStatus(s.bil_cas7),
            ];
            const configured = decoded.filter(d => d?.isConfigured);
            if (configured.some(d => d?.status === 'Critical')) return { ...acc, errors: acc.errors + 1 };
            if (configured.some(d => d?.status === 'Warning' || d?.status === 'Suspended')) return { ...acc, warnings: acc.warnings + 1 };
            return { ...acc, healthy: acc.healthy + 1 };
          }, { healthy: 0, errors: 0, warnings: 0 });

          snapshotManager.updateSnapshot(
            fileName,
            balanceData[0].balance_date ?? '',
            balanceData,
            statusData ?? [],
            balStats,
            hwStats
          );
          setDataChanges(snapshotManager.getChanges());
        }
      }

      setLastUpdated(new Date());
      setFetchError(null);
    } catch {
      setFetchError('Cannot connect to server. Data may be outdated.');
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);

      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchData, refreshInterval * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData, refreshInterval]);

  // ── Close sort dropdown on outside click or Escape ───────────────────────
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSortDropdown(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // ── Stale data detection — recheck every 30s instead of at render time ───
  useEffect(() => {
    setIsStale(false);
    if (!lastUpdated) return;
    const check = () => setIsStale(Date.now() - lastUpdated.getTime() > 5 * 60 * 1000);
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  // ── Keep threshold ref in sync for use inside fetchData callback ──────────
  useEffect(() => { thresholdRef.current = { critical: thresholdCritical, low: thresholdLow }; }, [thresholdCritical, thresholdLow]);

  // ── Persist settings to localStorage ─────────────────────────────────────
  useEffect(() => { try { localStorage.setItem('setting_threshold_critical', String(thresholdCritical)); } catch { /* quota */ } }, [thresholdCritical]);
  useEffect(() => { try { localStorage.setItem('setting_threshold_low', String(thresholdLow)); } catch { /* quota */ } }, [thresholdLow]);
  useEffect(() => { try { localStorage.setItem('setting_sort_by', sortBy); } catch { /* quota */ } }, [sortBy]);
  useEffect(() => { try { localStorage.setItem('setting_refresh_interval', String(refreshInterval)); } catch { /* quota */ } }, [refreshInterval]);
  useEffect(() => { try { localStorage.setItem('setting_show_healthy', String(showHealthyBalance)); } catch { /* quota */ } }, [showHealthyBalance]);

  // ── URL state sync (searchTerm, filterStatus, hardwareFilter) ─────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    if (filterStatus !== 'all') params.set('filter', filterStatus);
    if (hardwareFilter !== 'all') params.set('hw', hardwareFilter);
    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [searchTerm, filterStatus, hardwareFilter]);

  // ── Browser notifications for new critical ATMs ───────────────────────────
  const prevCriticalRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading || balances.length === 0) return;
    const currentCritical = new Set(
      balances
        .filter((b: AtmBalance) => getBalancePct(b) <= thresholdCritical)
        .map((b: AtmBalance) => b.terminal_id ?? b.atm_id ?? b.atm_name ?? '')
        .filter(Boolean)
    );
    const newlyGoneCritical = [...currentCritical].filter(id => !prevCriticalRef.current.has(id));
    if (newlyGoneCritical.length > 0 && prevCriticalRef.current.size > 0) {
      if (Notification.permission === 'granted') {
        new Notification('ATM Critical Alert', {
          body: `${newlyGoneCritical.length} ATM${newlyGoneCritical.length > 1 ? 's' : ''} went critical: ${newlyGoneCritical.slice(0, 3).join(', ')}${newlyGoneCritical.length > 3 ? '…' : ''}`,
          icon: '/favicon.ico',
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    prevCriticalRef.current = currentCritical;
  }, [balances, thresholdCritical, loading]);

  const filteredBalances = useMemo(() => balances.filter((balance: AtmBalance) => {
    const matchesSearch =
      balance.atm_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      balance.atm_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      balance.terminal_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      balance.branch?.toString().includes(searchTerm);

    if (!matchesSearch) return false;

    const pct = getBalancePct(balance);

    if (filterStatus === 'all') return showHealthyBalance ? true : pct <= thresholdLow;
    if (filterStatus === 'critical') return pct <= thresholdCritical;
    if (filterStatus === 'low') return pct > thresholdCritical && pct <= thresholdLow;

    return true;
  }), [balances, searchTerm, filterStatus, showHealthyBalance, thresholdCritical, thresholdLow]);

  const sortedBalances = useMemo(() => [...filteredBalances].sort((a: AtmBalance, b: AtmBalance) => {
    if (sortBy === 'pct_asc') return getBalancePct(a) - getBalancePct(b);
    if (sortBy === 'pct_desc') return getBalancePct(b) - getBalancePct(a);
    if (sortBy === 'name') return (a.atm_name ?? '').localeCompare(b.atm_name ?? '');
    if (sortBy === 'branch') return (a.branch ?? '').localeCompare(b.branch ?? '');
    return 0;
  }), [filteredBalances, sortBy]);

  useEffect(() => {
    if (!selectedAtm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const idx = sortedBalances.findIndex((b: AtmBalance) => b.record_id === selectedAtm.record_id);
      if (idx === -1) return;
      if (e.key === 'ArrowLeft' && idx > 0) setSelectedAtm(sortedBalances[idx - 1]);
      if (e.key === 'ArrowRight' && idx < sortedBalances.length - 1) setSelectedAtm(sortedBalances[idx + 1]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAtm, sortedBalances]);

  const handleAtmClick = useCallback((atmPid: string) => {
    const match =
      balances.find((b: AtmBalance) => b.terminal_id === atmPid) ||
      balances.find((b: AtmBalance) => b.atm_id === atmPid) ||
      balances.find((b: AtmBalance) => b.atm_name === atmPid);
    if (match) setSelectedAtm(match);
  }, [balances]);

  const prevBalanceMap = useMemo(() => {
    const map = new Map<string, AtmBalance>();
    prevBalances.forEach((b: AtmBalance) => {
      const key = b.terminal_id ?? b.atm_id ?? b.atm_name ?? '';
      if (key) map.set(key, b);
    });
    return map;
  }, [prevBalances]);

  const stats = useMemo(() => ({
    total: balances.length,
    critical: balances.filter(b => getBalancePct(b) <= thresholdCritical).length,
    low: balances.filter(b => { const p = getBalancePct(b); return p > thresholdCritical && p <= thresholdLow; }).length,
  }), [balances, thresholdCritical, thresholdLow]);

  const balanceChartData = useMemo(() => [
    { name: `Critical (<${thresholdCritical}%)`, value: stats.critical, color: '#ef4444' },
    { name: `Low (${thresholdCritical}–${thresholdLow}%)`, value: stats.low, color: '#f59e0b' },
    { name: `Healthy (>${thresholdLow}%)`, value: stats.total - stats.critical - stats.low, color: '#10b981' },
  ], [stats, thresholdCritical, thresholdLow]);

  const hardwareStatusData = useMemo(() => statuses.reduce((acc: { healthy: number; errors: number; warnings: number }, s: AtmStatus) => {
    const decoded = [
      decodeField(s.status, 'status'), decodeField(s.net, 'net'),
      decodeDeviceStatus(s.crd_reader), decodeDeviceStatus(s.dispenser),
      decodeDeviceStatus(s.encryptor), decodeDeviceStatus(s.depository),
      decodeDeviceStatus(s.bil_cas1), decodeDeviceStatus(s.bil_cas2),
      decodeDeviceStatus(s.bil_cas3), decodeDeviceStatus(s.bil_cas4),
      decodeDeviceStatus(s.bil_cas5), decodeDeviceStatus(s.bil_cas6),
      decodeDeviceStatus(s.bil_cas7),
    ];
    const configured = decoded.filter(d => d?.isConfigured);
    if (configured.some(d => d?.status === 'Critical')) return { ...acc, errors: acc.errors + 1 };
    if (configured.some(d => d?.status === 'Warning' || d?.status === 'Suspended')) return { ...acc, warnings: acc.warnings + 1 };
    return { ...acc, healthy: acc.healthy + 1 };
  }, { healthy: 0, errors: 0, warnings: 0 }), [statuses]);

  const errorTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    statuses.forEach((status: AtmStatus) => {
      const components = [
        { name: 'status', value: status.status },
        { name: 'net', value: status.net },
        { name: 'crd_reader', value: status.crd_reader },
        { name: 'dispenser', value: status.dispenser },
        { name: 'encryptor', value: status.encryptor },
        { name: 'depository', value: status.depository },
      ];
      components.forEach(comp => {
        const decoded = decodeField(comp.value, comp.name);
        if (decoded && decoded.status === 'Critical' && decoded.isConfigured) {
          counts.set(comp.name, (counts.get(comp.name) ?? 0) + 1);
        }
      });
    });
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [statuses]);

  const errorTypeChartData = useMemo(() =>
    errorTypeData
      .map((item: { name: string; value: number }) => ({
        ...item,
        name: item.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        color: ERROR_TYPE_COLORS[item.name] || '#6b7280',
      }))
      .filter((item: { name: string; value: number; color: string }) => item.value > 0),
  [errorTypeData]);

  const hardwareChartData = useMemo(() => [
    { name: 'Healthy', value: hardwareStatusData.healthy, color: '#10b981' },
    { name: 'Errors', value: hardwareStatusData.errors, color: '#ef4444' },
    { name: 'Warnings', value: hardwareStatusData.warnings, color: '#f59e0b' },
  ].filter(item => item.value > 0), [hardwareStatusData]);

  const exportBalancesCSV = useCallback(() => {
    const headers = ['ATM Name', 'ATM ID', 'Terminal ID', 'Branch', 'Balance Date', 'Initial Balance', 'Remaining Balance', 'Remaining %', 'Withdrawals'];
    const rows = sortedBalances.map((b: AtmBalance) => [
      csvCell(b.atm_name),
      csvCell(b.atm_id),
      csvCell(b.terminal_id),
      csvCell(b.branch),
      csvCell(b.balance_date),
      csvCell(b.initial_balance_all),
      csvCell(b.remaining_balance_all),
      csvCell(b.initial_balance_all ? (((b.remaining_balance_all ?? 0) / b.initial_balance_all) * 100).toFixed(1) : ''),
      csvCell(b.no_withdrawals_all),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atm-balances-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedBalances]);

  const exportStatusCSV = useCallback(() => {
    const headers = ['ATM ID', 'Branch', 'Owner', 'Status', 'Network', 'Card Reader', 'Dispenser', 'Printer', 'Door', 'Encryptor', 'Card Bin', 'Reject Bin', 'Depository', 'Cassette 5', 'Cassette 6', 'Cassette 7', 'Updated'];
    const rows = statuses.map((s: AtmStatus) => [
      csvCell(s.atm_pid),
      csvCell(s.branch),
      csvCell(s.owner),
      csvCell(s.status),
      csvCell(s.net),
      csvCell(s.crd_reader),
      csvCell(s.dispenser),
      csvCell(s.print_user),
      csvCell(s.door),
      csvCell(s.encryptor),
      csvCell(s.card_bin),
      csvCell(s.rej_bin),
      csvCell(s.depository),
      csvCell(s.bil_cas5),
      csvCell(s.bil_cas6),
      csvCell(s.bil_cas7),
      csvCell(s.file_date ? new Date(s.file_date).toLocaleString() : ''),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atm-hardware-status-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [statuses]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-yellow-50">
      <header className="bg-[#FEE600] border-b border-yellow-400 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Zap className="w-8 h-8 text-black" />
                <h1 className="text-4xl font-bold text-black">Raiffeisen Atm Monitoring</h1>
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <p className="text-black/70">Real-time monitoring of ATM balances and hardware status</p>
                {isRefreshing && (
                  <span className="flex items-center gap-1.5 text-xs text-black/60">
                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Refreshing...
                  </span>
                )}
                {lastUpdated && !isRefreshing && (
                  <span className={`text-xs px-2 py-1 rounded ${isStale ? 'bg-red-600 text-white' : 'bg-black/10 text-black/70'}`}>
                    {isStale ? 'Stale — ' : ''}Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-6 sm:mt-0 flex flex-col items-end gap-2">
              <div className="flex items-center gap-3 bg-black/10 backdrop-blur-sm px-4 py-3 rounded-lg border border-black/20">
                <Clock className="w-5 h-5 text-black/70" />
                <span className="text-sm font-medium text-black hidden xs:inline">Refresh:</span>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  {[10, 60, 300, 600].map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setRefreshInterval(interval as 10 | 60 | 300 | 600)}
                      aria-label={`Refresh every ${interval === 10 ? '10 seconds' : interval === 60 ? '1 minute' : interval === 300 ? '5 minutes' : '10 minutes'}`}
                      aria-pressed={refreshInterval === interval}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                        refreshInterval === interval
                          ? 'bg-black text-[#FEE600] shadow-lg'
                          : 'bg-black/10 text-black hover:bg-black/20'
                      }`}
                    >
                      {interval === 10 ? '10s' : interval === 60 ? '1m' : interval === 300 ? '5m' : '10m'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={fetchData}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/10 hover:bg-black/20 text-black text-xs font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-black/20"
                aria-label="Refresh data now"
              >
                <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isRefreshing ? 'Refreshing…' : 'Refresh now'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {fetchError && (
        <div role="alert" aria-live="polite" aria-atomic="true" className="bg-red-600 text-white px-6 py-3 flex items-center justify-center gap-3">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">{fetchError}</span>
          <button
            onClick={fetchData}
            className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-yellow-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-yellow-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total ATMs</p>
                  {loading ? <div className="h-10 w-14 bg-slate-200 animate-pulse rounded mt-2" /> : <p className="text-4xl font-bold text-slate-900 mt-2">{stats.total}</p>}
                  {dataChanges.balanceChange && (() => { const d = (dataChanges.balanceChange.critical ?? 0) + (dataChanges.balanceChange.low ?? 0) + (dataChanges.balanceChange.healthy ?? 0); return d !== 0 ? <span className={`inline-flex items-center gap-0.5 text-xs font-semibold mt-1 px-2 py-0.5 rounded-full ${d > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d}</span> : null; })()}
                </div>
                <Activity className="w-12 h-12 text-yellow-400 opacity-80" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-red-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-red-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Critical</p>
                  {loading ? <div className="h-10 w-14 bg-slate-200 animate-pulse rounded mt-2" /> : <p className="text-4xl font-bold text-red-600 mt-2">{stats.critical}</p>}
                  {dataChanges.balanceChange && (() => { const d = dataChanges.balanceChange.critical ?? 0; return d !== 0 ? <span className={`inline-flex items-center gap-0.5 text-xs font-semibold mt-1 px-2 py-0.5 rounded-full ${d > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d} vs last</span> : null; })()}
                </div>
                <AlertTriangle className="w-12 h-12 text-red-400 opacity-80" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-amber-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Low Balance</p>
                  {loading ? <div className="h-10 w-14 bg-slate-200 animate-pulse rounded mt-2" /> : <p className="text-4xl font-bold text-amber-600 mt-2">{stats.low}</p>}
                  {dataChanges.balanceChange && (() => { const d = dataChanges.balanceChange.low ?? 0; return d !== 0 ? <span className={`inline-flex items-center gap-0.5 text-xs font-semibold mt-1 px-2 py-0.5 rounded-full ${d > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d} vs last</span> : null; })()}
                </div>
                <AlertTriangle className="w-12 h-12 text-amber-400 opacity-80" />
              </div>
            </div>
          </div>

          <div className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-100 hover:border-emerald-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Healthy</p>
                  {loading ? <div className="h-10 w-14 bg-slate-200 animate-pulse rounded mt-2" /> : <p className="text-4xl font-bold text-emerald-600 mt-2">{stats.total - stats.critical - stats.low}</p>}
                  {dataChanges.balanceChange && (() => { const d = dataChanges.balanceChange.healthy ?? 0; return d !== 0 ? <span className={`inline-flex items-center gap-0.5 text-xs font-semibold mt-1 px-2 py-0.5 rounded-full ${d > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d} vs last</span> : null; })()}
                </div>
                <CheckCircle className="w-12 h-12 text-emerald-400 opacity-80" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-bold text-slate-900">Balance Distribution</h3>
              </div>
              {dataChanges.balanceChange && (() => {
                const d = dataChanges.balanceChange.critical ?? 0;
                if (d === 0) return <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">No change</span>;
                return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${d > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d} critical</span>;
              })()}
            </div>
            {balanceChartData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={balanceChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ value }) => `${value}`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {balanceChartData.map((entry: { name: string; value: number; color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} ATMs`} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-500">No balance data available</div>
            )}
            {dataChanges.balanceChange && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Critical</span>
                  <TrendIndicator change={dataChanges.balanceChange.critical} isPositive={false} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Low</span>
                  <TrendIndicator change={dataChanges.balanceChange.low} isPositive={false} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Healthy</span>
                  <TrendIndicator change={dataChanges.balanceChange.healthy} isPositive={true} />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">Hardware Status</h3>
              </div>
              {dataChanges.hardwareChange && (() => {
                const d = dataChanges.hardwareChange.errors ?? 0;
                if (d === 0) return <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">No change</span>;
                return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${d > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{d > 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d} errors</span>;
              })()}
            </div>
            {hardwareChartData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={hardwareChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ value }) => `${value}`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {hardwareChartData.map((entry: { name: string; value: number; color: string }, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} ATMs`} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-500">No hardware data available</div>
            )}
            {dataChanges.hardwareChange && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Healthy</span>
                  <TrendIndicator change={dataChanges.hardwareChange.healthy} isPositive={true} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Errors</span>
                  <TrendIndicator change={dataChanges.hardwareChange.errors} isPositive={false} />
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Warnings</span>
                  <TrendIndicator change={dataChanges.hardwareChange.warnings} isPositive={false} />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-bold text-slate-900">Critical Errors</h3>
            </div>
            {errorTypeChartData.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={errorTypeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ value }) => `${value}`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {errorTypeChartData.map((entry: { name: string; value: number; color: string }, index: number) => (
                        <Cell key={`error-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} errors`} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-500">No errors detected</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-slate-100">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by ATM name, ID, terminal, or branch..."
                value={searchTerm}
                onChange={(e: { target: HTMLInputElement }) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent bg-slate-50 focus:bg-white transition-all duration-200"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['all', 'critical', 'low'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2.5 rounded-lg font-medium transition-all duration-200 capitalize ${
                    filterStatus === status
                      ? status === 'all'
                        ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/40'
                        : status === 'critical'
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/40'
                          : 'bg-amber-600 text-white shadow-lg shadow-amber-600/40'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Thresholds</span>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Critical ≤
              <input
                type="number"
                min={1}
                max={thresholdLow - 1}
                value={thresholdCritical}
                onChange={(e: { target: HTMLInputElement }) => {
                  const val = Number(e.target.value);
                  setThresholdCritical(Math.max(1, Math.min(val, thresholdLow - 1)));
                }}
                className="w-16 px-2 py-1 border border-slate-200 rounded-md text-sm text-center focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              %
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Low ≤
              <input
                type="number"
                min={thresholdCritical + 1}
                max={99}
                value={thresholdLow}
                onChange={(e: { target: HTMLInputElement }) => {
                  const val = Number(e.target.value);
                  setThresholdLow(Math.min(99, Math.max(val, thresholdCritical + 1)));
                }}
                className="w-16 px-2 py-1 border border-slate-200 rounded-md text-sm text-center focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
              %
            </label>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">ATM Balance Overview</h2>
            <div className="flex items-center gap-2">
              {/* Custom sort dropdown */}
              <div ref={sortDropdownRef} className="relative">
                <button
                  onClick={() => setShowSortDropdown((prev: boolean) => !prev)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-yellow-400 shadow-sm hover:shadow-md transition-all duration-200 text-slate-700 text-sm font-medium cursor-pointer group"
                >
                  <ArrowUpDown className="w-4 h-4 text-yellow-500" />
                  <span>
                    {sortBy === 'pct_asc' ? 'Worst first' : sortBy === 'pct_desc' ? 'Best first' : sortBy === 'name' ? 'Name A–Z' : 'Branch A–Z'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showSortDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showSortDropdown && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort by</p>
                    </div>
                    {([
                      { value: 'pct_asc',  label: 'Balance ↑', sub: 'Worst first' },
                      { value: 'pct_desc', label: 'Balance ↓', sub: 'Best first'  },
                      { value: 'name',     label: 'Name A–Z',  sub: 'Alphabetical' },
                      { value: 'branch',   label: 'Branch A–Z',sub: 'By branch'   },
                    ] as { value: typeof sortBy; label: string; sub: string }[]).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSortDropdown(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors duration-150 ${
                          sortBy === opt.value
                            ? 'bg-yellow-50 text-yellow-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className={`text-xs ${sortBy === opt.value ? 'text-yellow-600' : 'text-slate-400'}`}>{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={exportBalancesCSV}
                disabled={sortedBalances.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors duration-200 text-slate-600 hover:text-slate-900 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
                aria-label="Export current view to CSV"
                title={sortedBalances.length === 0 ? 'No data to export' : 'Export current view to CSV'}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              {filterStatus === 'all' && (
                <button
                  onClick={() => setShowHealthyBalance(!showHealthyBalance)}
                  className="p-2 rounded-lg hover:bg-slate-200 transition-colors duration-200 text-slate-600 hover:text-slate-900"
                  aria-label={showHealthyBalance ? 'Hide healthy ATMs' : 'Show healthy ATMs'}
                  aria-pressed={showHealthyBalance}
                  title={showHealthyBalance ? 'Hide healthy' : 'Show healthy'}
                >
                  {showHealthyBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} i={i} />)
              : sortedBalances.map((balance: AtmBalance) => (
                  <AtmBalanceCard
                    key={balance.record_id ?? balance.terminal_id ?? balance.atm_id ?? balance.atm_name}
                    balance={balance}
                    prevBalance={prevBalanceMap.get(balance.terminal_id ?? balance.atm_id ?? balance.atm_name ?? '')}
                    onClick={() => setSelectedAtm(balance)}
                    thresholdCritical={thresholdCritical}
                    thresholdLow={thresholdLow}
                  />
                ))
            }
          </div>
          {!loading && sortedBalances.length === 0 && (
            <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-slate-100">
              <p className="text-slate-500 text-lg">No ATMs match your search criteria</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-slate-900">Hardware Status</h2>
            <button
              onClick={exportStatusCSV}
              disabled={statuses.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors duration-200 text-slate-600 hover:text-slate-900 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-100 disabled:hover:text-slate-600"
              aria-label="Export hardware status to CSV"
              title={statuses.length === 0 ? 'No data to export' : 'Export hardware status to CSV'}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
          <p className="text-sm text-slate-600 mb-6">Click a row to open ATM details · Click column headers to filter · Esc to clear filter</p>
          <AtmStatusTable
            searchTerm={searchTerm}
            statuses={statuses}
            hardwareFilter={hardwareFilter}
            onFilterChange={setHardwareFilter}
            onAtmClick={handleAtmClick}
          />
        </div>
      </main>

      {selectedAtm && (
        <AtmDetailsModal
          balance={selectedAtm}
          status={
            statuses.find((s: AtmStatus) => s.atm_pid === selectedAtm.terminal_id) ||
            statuses.find((s: AtmStatus) => s.atm_pid === selectedAtm.atm_id) ||
            statuses.find((s: AtmStatus) => s.atm_name === selectedAtm.atm_name) ||
            null
          }
          onClose={() => setSelectedAtm(null)}
        />
      )}
    </div>
  );
}
