import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import { AtmStatus } from '../lib/api';
import { CheckCircle, XCircle, AlertCircle, ChevronDown, Eye, EyeOff, X, Filter, ExternalLink } from 'lucide-react';
import { decodeField, decodeAtmStatus, getStatusColor, DecodedDeviceStatus } from '../lib/hardwareStatusDecoder';

interface AtmStatusTableProps {
  statuses: AtmStatus[];
  hardwareFilter?: string;
  onFilterChange?: (filter: string) => void;
  onAtmClick?: (atmPid: string) => void;
  searchTerm?: string;
}

const COLUMN_HEADERS = [
  { key: 'status',     label: 'ATM Status'   },
  { key: 'net',        label: 'Network'       },
  { key: 'crd_reader', label: 'Card Reader'   },
  { key: 'dispenser',  label: 'Dispenser'     },
  { key: 'print_user', label: 'Printer'       },
  { key: 'door',       label: 'Safe Door'     },
  { key: 'encryptor',  label: 'Encryptor'     },
  { key: 'card_bin',   label: 'Card Bin'      },
  { key: 'rej_bin',    label: 'Reject Bin'    },
  { key: 'depository', label: 'Depository'    },
  { key: 'bil_cas5',   label: 'Cassette 5'   },
  { key: 'bil_cas6',   label: 'Cassette 6'   },
  { key: 'bil_cas7',   label: 'Cassette 7'   },
] as const;

// All device fields shown in the details bar (full set, regardless of visible columns)
const DETAIL_FIELDS = [
  { key: 'status',     label: 'ATM Status'  },
  { key: 'net',        label: 'Network'     },
  { key: 'crd_reader', label: 'Card Reader' },
  { key: 'dispenser',  label: 'Dispenser'   },
  { key: 'print_user', label: 'Printer'     },
  { key: 'door',       label: 'Safe Door'   },
  { key: 'encryptor',  label: 'Encryptor'   },
  { key: 'card_bin',   label: 'Card Bin'    },
  { key: 'rej_bin',    label: 'Reject Bin'  },
  { key: 'depository', label: 'Depository'  },
  { key: 'bil_cas5',   label: 'Cassette 5'  },
  { key: 'bil_cas6',   label: 'Cassette 6'  },
  { key: 'bil_cas7',   label: 'Cassette 7'  },
] as const;

// ── Module-level pure helpers (no component state) ───────────────────────────

function hasError(raw: string | null | undefined, fieldKey: string): boolean {
  if (!raw) return false;
  const decoded = decodeField(raw, fieldKey);
  if (!decoded || !decoded.isConfigured) return false;
  return decoded.status !== 'OK';
}

function getStatusField(atmStatus: AtmStatus, key: string): string | null {
  const map: Record<string, string | null> = {
    status:     atmStatus.status,
    net:        atmStatus.net,
    crd_reader: atmStatus.crd_reader,
    dispenser:  atmStatus.dispenser,
    print_user: atmStatus.print_user,
    door:       atmStatus.door,
    encryptor:  atmStatus.encryptor,
    card_bin:   atmStatus.card_bin,
    rej_bin:    atmStatus.rej_bin,
    depository: atmStatus.depository,
    bil_cas5:   atmStatus.bil_cas5,
    bil_cas6:   atmStatus.bil_cas6,
    bil_cas7:   atmStatus.bil_cas7,
  };
  return map[key] ?? null;
}

function atmHasIssues(atmStatus: AtmStatus): boolean {
  return (
    hasError(atmStatus.status, 'status') ||
    hasError(atmStatus.net, 'net') ||
    hasError(atmStatus.crd_reader, 'crd_reader') ||
    hasError(atmStatus.dispenser, 'dispenser') ||
    hasError(atmStatus.encryptor, 'encryptor') ||
    hasError(atmStatus.depository, 'depository') ||
    hasError(atmStatus.bil_cas5, 'bil_cas5') ||
    hasError(atmStatus.bil_cas6, 'bil_cas6') ||
    hasError(atmStatus.bil_cas7, 'bil_cas7')
  );
}

// Returns the worst status level for a row (7=Critical, 3=Warning, 0=OK)
function getRowWorstLevel(atmStatus: AtmStatus): number {
  const fields: [string, string | null | undefined][] = [
    ['status', atmStatus.status], ['net', atmStatus.net],
    ['crd_reader', atmStatus.crd_reader], ['dispenser', atmStatus.dispenser],
    ['encryptor', atmStatus.encryptor], ['depository', atmStatus.depository],
    ['bil_cas5', atmStatus.bil_cas5], ['bil_cas6', atmStatus.bil_cas6],
    ['bil_cas7', atmStatus.bil_cas7],
  ];
  return Math.max(0, ...fields.map(([key, val]) => {
    if (!val) return 0;
    const d = decodeField(val, key);
    return (d?.isConfigured && d.statusLevel < 99) ? d.statusLevel : 0;
  }));
}

function columnHasIssues(columnKey: string, rows: AtmStatus[]): boolean {
  return rows.some(s => hasError(getStatusField(s, columnKey), columnKey));
}

function getRowBorderClass(atmStatus: AtmStatus): string {
  const level = getRowWorstLevel(atmStatus);
  if (level >= 7) return 'border-l-4 border-l-red-500';
  if (level >= 3) return 'border-l-4 border-l-amber-400';
  return 'border-l-4 border-l-emerald-400';
}

function getStatusIcon(decoded: DecodedDeviceStatus | null) {
  if (!decoded) return <AlertCircle className="w-5 h-5 text-gray-300" />;
  switch (decoded.status) {
    case 'OK':        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    case 'Warning':
    case 'Suspended': return <AlertCircle className="w-5 h-5 text-amber-500" />;
    case 'Critical':
    case 'Disabled':  return <XCircle className="w-5 h-5 text-red-500" />;
    default:          return <AlertCircle className="w-5 h-5 text-gray-300" />;
  }
}

function getStatusBadge(decoded: DecodedDeviceStatus | null) {
  if (!decoded || !decoded.isConfigured) return (
    <span className="text-slate-300 text-sm select-none">—</span>
  );

  const bgColor = getStatusColor(decoded.status);
  let icon = null;
  switch (decoded.status) {
    case 'OK':             icon = <CheckCircle className="w-3 h-3" />; break;
    case 'Warning':
    case 'Suspended':      icon = <AlertCircle className="w-3 h-3" />; break;
    case 'Critical':
    case 'Disabled':       icon = <XCircle className="w-3 h-3" />; break;
    case 'Not Configured': icon = <AlertCircle className="w-3 h-3 opacity-40" />; break;
  }

  const tooltipParts = [decoded.supply, decoded.additional].filter(p => p && p !== '—').join(' · ');
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bgColor}`}
      title={tooltipParts || decoded.displayLabel}
    >
      {icon}
      {decoded.displayLabel}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AtmStatusTable({ statuses, hardwareFilter = 'all', onFilterChange, onAtmClick, searchTerm = '' }: AtmStatusTableProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const issueCount = useMemo(
    () => statuses.filter(s => atmHasIssues(s)).length,
    [statuses]
  );

  const filteredStatuses = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    let filtered = statuses.filter((s) =>
      s.atm_pid?.toLowerCase().includes(searchLower) ||
      s.branch?.toLowerCase().includes(searchLower)
    );
    if (!showAdvanced) {
      filtered = filtered.filter(s => atmHasIssues(s));
    }
    if (hardwareFilter !== 'all') {
      filtered = filtered.filter(s => hasError(getStatusField(s, hardwareFilter), hardwareFilter));
    }
    // Sort: when a column filter is active, sort by that column's severity first;
    // otherwise sort by overall worst severity across all components.
    return [...filtered].sort((a, b) => {
      if (hardwareFilter !== 'all') {
        const aLevel = decodeField(getStatusField(a, hardwareFilter), hardwareFilter)?.statusLevel ?? 0;
        const bLevel = decodeField(getStatusField(b, hardwareFilter), hardwareFilter)?.statusLevel ?? 0;
        if (bLevel !== aLevel) return bLevel - aLevel;
      }
      return getRowWorstLevel(b) - getRowWorstLevel(a);
    });
  }, [statuses, searchTerm, hardwareFilter, showAdvanced]);

  const visibleColumns = useMemo(() => {
    if (showAdvanced) return COLUMN_HEADERS;
    return COLUMN_HEADERS.filter(col => columnHasIssues(col.key, filteredStatuses));
  }, [filteredStatuses, showAdvanced]);

  // #6 — Escape key clears active column filter
  useEffect(() => {
    if (hardwareFilter === 'all') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFilterChange?.('all'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hardwareFilter, onFilterChange]);

  const activeFilterLabel = hardwareFilter !== 'all'
    ? (COLUMN_HEADERS.find(c => c.key === hardwareFilter)?.label ?? hardwareFilter)
    : null;

  const handleColumnClick = useCallback((fieldKey: string) => {
    if (onFilterChange) {
      onFilterChange(hardwareFilter === fieldKey ? 'all' : fieldKey);
    }
  }, [onFilterChange, hardwareFilter]);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-100">

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-gradient-to-r from-slate-50 to-yellow-50">

        {/* Toggle: Issues Only / All ATMs */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 border ${
            showAdvanced
              ? 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
              : 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
          }`}
        >
          {showAdvanced ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showAdvanced ? 'All ATMs' : 'Issues Only'}
        </button>

        {/* Summary counts */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="px-2 py-1 bg-slate-100 rounded-md">
            {filteredStatuses.length} shown
          </span>
          {issueCount > 0 && (
            <span className="px-2 py-1 bg-red-50 text-red-600 rounded-md border border-red-100">
              {issueCount} with issues
            </span>
          )}
          {issueCount === 0 && statuses.length > 0 && (
            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">
              All healthy
            </span>
          )}
        </div>

        {/* Active filter chip */}
        {activeFilterLabel && (
          <div className="flex items-center gap-1.5 ml-1 px-3 py-1.5 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-full text-xs font-semibold">
            <Filter className="w-3 h-3" />
            {activeFilterLabel}
            <button
              onClick={() => onFilterChange?.('all')}
              aria-label={`Clear ${activeFilterLabel} filter`}
              className="ml-0.5 hover:text-yellow-900"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Hint */}
        <p className="ml-auto text-xs text-slate-400 hidden sm:block">
          Click row to expand · Click column headers to filter
        </p>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-gradient-to-r from-slate-50 to-yellow-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                ATM
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                Branch
              </th>
              {visibleColumns.map((header: { key: string; label: string }) => (
                <th
                  key={header.key}
                  onClick={() => handleColumnClick(header.key)}
                  aria-label={`Filter by ${header.label}${hardwareFilter === header.key ? ' (active — click to clear)' : ''}`}
                  className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors relative group ${
                    hardwareFilter === header.key
                      ? 'bg-yellow-200 text-yellow-900'
                      : 'text-slate-600 hover:bg-yellow-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {header.label}
                    <ChevronDown className={`w-3 h-3 transition-opacity ${
                      hardwareFilter === header.key ? 'opacity-100 text-yellow-700' : 'opacity-30 group-hover:opacity-80'
                    }`} />
                  </div>
                  {hardwareFilter === header.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
                  )}
                </th>
              ))}
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                Last Updated
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-slate-100">
            {filteredStatuses.map((status: AtmStatus) => {
              const rowId = status.atm_pid ?? status.atm_name ?? (status.record_id != null ? String(status.record_id) : `row-${Math.random()}`);
              const isExpanded = expandedRowId === rowId;
              const colSpan = visibleColumns.length + 3; // ATM + Branch + Last Updated
              return (
                <Fragment key={rowId}>
                  <tr
                    onClick={() => setExpandedRowId(isExpanded ? null : rowId)}
                    className={`${getRowBorderClass(status)} hover:bg-yellow-50/60 transition-colors cursor-pointer`}
                  >
                    {/* ATM ID + Owner */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        {getStatusIcon(decodeAtmStatus(status.status))}
                        <div>
                          <div className="text-sm font-bold text-slate-900">{status.atm_pid}</div>
                          {status.owner && (
                            <div className="text-xs text-slate-400 font-medium">{status.owner}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-slate-600">
                      {status.branch || <span className="text-slate-300">—</span>}
                    </td>

                    {/* Device status badges */}
                    {visibleColumns.map((col: { key: string; label: string }) => (
                      <td key={col.key} className="px-5 py-3.5 whitespace-nowrap">
                        {getStatusBadge(decodeField(getStatusField(status, col.key), col.key))}
                      </td>
                    ))}

                    {/* Last Updated */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-400">
                      {status.file_date
                        ? new Date(status.file_date).toLocaleString()
                        : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>

                  {/* ── Details bar ─────────────────────────────────── */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={colSpan} className="p-0 bg-slate-50 border-b border-slate-200">
                        <div className="px-6 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Device Breakdown — {status.atm_pid}
                            </p>
                            {onAtmClick && status.atm_pid && (
                              <button
                                onClick={(e: { stopPropagation: () => void }) => {
                                  e.stopPropagation();
                                  onAtmClick(status.atm_pid!);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-yellow-700 bg-yellow-100 hover:bg-yellow-200 border border-yellow-300 rounded-lg transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open full details
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                            {DETAIL_FIELDS.map(field => {
                              const raw = getStatusField(status, field.key);
                              const decoded = decodeField(raw, field.key);
                              if (!decoded) return null;
                              const colorClass = getStatusColor(decoded.status);
                              const showSupply = decoded.isConfigured && decoded.supply && decoded.supply !== 'Sufficient Supply' && decoded.supply !== '—';
                              const showAdditional = decoded.isConfigured && decoded.additional && decoded.additional !== 'Enabled / Closed' && decoded.additional !== '—';
                              return (
                                <div key={field.key} className={`rounded-lg border p-3 ${colorClass}`}>
                                  <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">{field.label}</p>
                                  <p className="text-sm font-semibold">{decoded.displayLabel}</p>
                                  {showSupply && (
                                    <p className="text-xs mt-0.5 opacity-75">{decoded.supply}</p>
                                  )}
                                  {showAdditional && (
                                    <p className="text-xs opacity-75">{decoded.additional}</p>
                                  )}
                                  {raw && raw.trim() && !raw.trim().startsWith('-') && (
                                    <p className="text-xs font-mono opacity-40 mt-1 truncate">{raw.trim()}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Empty state ────────────────────────────────────────────── */}
      {filteredStatuses.length === 0 && (
        <div className="text-center py-14 text-slate-400">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-300" />
          <p className="text-sm font-semibold text-slate-500">
            {statuses.length === 0
              ? 'No ATM status data available'
              : activeFilterLabel
                ? `No ATMs have issues with ${activeFilterLabel}`
                : 'No ATMs with issues — all clear'}
          </p>
          {activeFilterLabel && (
            <button
              onClick={() => onFilterChange?.('all')}
              className="mt-3 text-xs text-yellow-600 hover:text-yellow-700 underline"
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
