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

// ── Module-level pure helpers (no component state) ───────────────────────────

function hasError(raw: string | null | undefined, fieldKey: string): boolean {
  if (!raw) return false;
  const decoded = decodeField(raw, fieldKey);
  if (!decoded || !decoded.isConfigured) return false;
  return decoded.status !== 'OK';
}

function getStatusField(atmStatus: AtmStatus, key: string): string | null {
  const map: Record<string, string | null | undefined> = {
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
  return COLUMN_HEADERS.some(col => hasError(getStatusField(atmStatus, col.key), col.key));
}

// Severity level used for ranking and filtering. Unrecognized codes decode to
// 'Unknown' with an out-of-range level — rank them as warnings so they don't
// pass for healthy (they still show a problem chip via hasError).
function getEffectiveLevel(d: DecodedDeviceStatus): number {
  return d.status === 'Unknown' ? 3 : d.statusLevel;
}

// Returns the worst status level for a row (7=Critical, 3=Warning, 0=OK)
function getRowWorstLevel(atmStatus: AtmStatus): number {
  return Math.max(0, ...COLUMN_HEADERS.map(({ key }) => {
    const val = getStatusField(atmStatus, key);
    if (!val) return 0;
    const d = decodeField(val, key);
    if (!d || !d.isConfigured || d.status === 'OK') return 0;
    return getEffectiveLevel(d);
  }));
}

// Every failing component of a row, with its decoded status
function getRowIssues(atmStatus: AtmStatus): { key: string; label: string; decoded: DecodedDeviceStatus }[] {
  return COLUMN_HEADERS.flatMap(col => {
    const raw = getStatusField(atmStatus, col.key);
    if (!hasError(raw, col.key)) return [];
    const decoded = decodeField(raw, col.key);
    return decoded ? [{ key: col.key, label: col.label, decoded }] : [];
  });
}

function columnHasIssues(columnKey: string, rows: AtmStatus[]): boolean {
  return rows.some(s => hasError(getStatusField(s, columnKey), columnKey));
}

function getRowBorderClass(level: number): string {
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

// Subtle background on matrix cells that have a problem, so the eye jumps to them
function getCellTint(decoded: DecodedDeviceStatus | null): string {
  if (!decoded || !decoded.isConfigured || decoded.status === 'OK') return '';
  return getEffectiveLevel(decoded) >= 7 ? 'bg-red-50/70' : 'bg-amber-50/70';
}

function getStatusBadge(decoded: DecodedDeviceStatus | null) {
  if (!decoded || !decoded.isConfigured) return (
    <span className="text-slate-300 text-sm select-none">—</span>
  );

  // Healthy cells stay quiet so problems stand out
  if (decoded.status === 'OK') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500/70" title={decoded.displayLabel}>
        <CheckCircle className="w-3.5 h-3.5" />
        {decoded.displayLabel}
      </span>
    );
  }

  const bgColor = getStatusColor(decoded.status);
  let icon = null;
  switch (decoded.status) {
    case 'Warning':
    case 'Suspended':      icon = <AlertCircle className="w-3 h-3" />; break;
    case 'Critical':
    case 'Disabled':       icon = <XCircle className="w-3 h-3" />; break;
    case 'Not Configured': icon = <AlertCircle className="w-3 h-3 opacity-40" />; break;
    default:               icon = <AlertCircle className="w-3 h-3" />; break; // Unknown
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

type SeverityFilter = 'all' | 'critical' | 'warning';

export function AtmStatusTable({ statuses, hardwareFilter = 'all', onFilterChange, onAtmClick, searchTerm = '' }: AtmStatusTableProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  // Compact "Problems" view by default; full device matrix in "All ATMs" mode
  const compact = !showAdvanced;

  const issueCount = useMemo(
    () => statuses.filter(s => atmHasIssues(s)).length,
    [statuses]
  );

  // Worst severity per row, computed once per data refresh — the severity
  // counts, filters, sort, and row borders read this instead of re-decoding
  // 13 device codes on every call
  const rowLevels = useMemo(() => {
    const map = new Map<AtmStatus, number>();
    statuses.forEach(s => map.set(s, getRowWorstLevel(s)));
    return map;
  }, [statuses]);
  const levelOf = useCallback((s: AtmStatus) => rowLevels.get(s) ?? 0, [rowLevels]);

  // Rows after search, view scope, and component filter — severity not yet
  // applied, so the severity buttons can count what each one would reveal
  const scopedStatuses = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    let filtered = statuses.filter((s) =>
      s.atm_pid?.toLowerCase().includes(searchLower) ||
      s.atm_name?.toLowerCase().includes(searchLower) ||
      s.owner?.toLowerCase().includes(searchLower) ||
      s.branch?.toLowerCase().includes(searchLower)
    );
    if (!showAdvanced) {
      filtered = filtered.filter(s => atmHasIssues(s));
    }
    if (hardwareFilter !== 'all') {
      filtered = filtered.filter(s => hasError(getStatusField(s, hardwareFilter), hardwareFilter));
    }
    return filtered;
  }, [statuses, searchTerm, showAdvanced, hardwareFilter]);

  const severityCounts = useMemo(() => {
    let critical = 0, warning = 0;
    scopedStatuses.forEach(s => {
      const level = levelOf(s);
      if (level >= 7) critical++;
      else if (level >= 3) warning++;
    });
    return { critical, warning };
  }, [scopedStatuses, levelOf]);

  const filteredStatuses = useMemo(() => {
    let filtered = scopedStatuses;
    if (severityFilter === 'critical') {
      filtered = filtered.filter(s => levelOf(s) >= 7);
    } else if (severityFilter === 'warning') {
      filtered = filtered.filter(s => { const l = levelOf(s); return l >= 3 && l < 7; });
    }
    // Sort: when a column filter is active, that column's severity wins, then
    // overall worst severity. Keys are precomputed so the comparator does no
    // decoding (colLevel is 0 for every row when no column filter is active).
    const keyed = filtered.map(s => {
      let colLevel = 0;
      if (hardwareFilter !== 'all') {
        const d = decodeField(getStatusField(s, hardwareFilter), hardwareFilter);
        colLevel = d ? getEffectiveLevel(d) : 0;
      }
      return { s, colLevel, worst: levelOf(s) };
    });
    keyed.sort((a, b) => (b.colLevel - a.colLevel) || (b.worst - a.worst));
    return keyed.map(k => k.s);
  }, [scopedStatuses, severityFilter, hardwareFilter, levelOf]);

  const visibleColumns = useMemo(() => {
    if (showAdvanced) return COLUMN_HEADERS;
    return COLUMN_HEADERS.filter(col => columnHasIssues(col.key, filteredStatuses));
  }, [filteredStatuses, showAdvanced]);

  // Escape clears every active table filter (component and severity)
  useEffect(() => {
    if (hardwareFilter === 'all' && severityFilter === 'all') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFilterChange?.('all');
        setSeverityFilter('all');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hardwareFilter, severityFilter, onFilterChange]);

  const activeFilterLabel = hardwareFilter !== 'all'
    ? (COLUMN_HEADERS.find(c => c.key === hardwareFilter)?.label ?? hardwareFilter)
    : null;

  const handleColumnClick = useCallback((fieldKey: string) => {
    if (onFilterChange) {
      onFilterChange(hardwareFilter === fieldKey ? 'all' : fieldKey);
    }
  }, [onFilterChange, hardwareFilter]);

  const colSpan = compact ? 4 : visibleColumns.length + 3; // ATM + Branch (+ Problems) + Last Updated

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-100">

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-gradient-to-r from-slate-50 to-yellow-50">

        {/* Toggle: compact problems view / full matrix with all ATMs */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 border ${
            showAdvanced
              ? 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
              : 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200'
          }`}
          title={showAdvanced ? 'Show only ATMs with problems, one chip per problem' : 'Show every ATM with the full device matrix'}
        >
          {showAdvanced ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {showAdvanced ? 'All ATMs' : 'Problems'}
        </button>

        {/* Severity quick filter */}
        <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5" role="group" aria-label="Filter by severity">
          {([
            { value: 'all',      label: 'All',                                   active: 'bg-slate-800 text-white' },
            { value: 'critical', label: `Critical ${severityCounts.critical}`,  active: 'bg-red-600 text-white'   },
            { value: 'warning',  label: `Warnings ${severityCounts.warning}`,   active: 'bg-amber-500 text-white' },
          ] as { value: SeverityFilter; label: string; active: string }[]).map(opt => (
            <button
              key={opt.value}
              onClick={() => setSeverityFilter(opt.value)}
              aria-pressed={severityFilter === opt.value}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                severityFilter === opt.value ? opt.active : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

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
          {compact
            ? 'Click a problem to filter · Click row to expand'
            : 'Click column headers to filter · Click row to expand'}
        </p>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-auto max-h-[70vh]">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-gradient-to-r from-slate-50 to-yellow-50 sticky top-0 z-10">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50">
                ATM
              </th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50">
                Branch
              </th>
              {compact ? (
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50">
                  Problems
                </th>
              ) : (
                visibleColumns.map((header: { key: string; label: string }) => (
                  <th
                    key={header.key}
                    onClick={() => handleColumnClick(header.key)}
                    aria-label={`Filter by ${header.label}${hardwareFilter === header.key ? ' (active — click to clear)' : ''}`}
                    className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors relative group ${
                      hardwareFilter === header.key
                        ? 'bg-yellow-200 text-yellow-900'
                        : 'text-slate-600 bg-slate-50 hover:bg-yellow-100'
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
                ))
              )}
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-50">
                Last Updated
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-slate-100">
            {filteredStatuses.map((status: AtmStatus, rowIndex: number) => {
              const rowId = status.atm_pid ?? status.atm_name ?? (status.record_id != null ? String(status.record_id) : `row-${rowIndex}`);
              const isExpanded = expandedRowId === rowId;
              const issues = getRowIssues(status);
              const toggleRow = () => setExpandedRowId(isExpanded ? null : rowId);
              return (
                <Fragment key={rowId}>
                  <tr
                    onClick={toggleRow}
                    tabIndex={0}
                    role="button"
                    aria-expanded={isExpanded}
                    onKeyDown={(e: { key: string; preventDefault: () => void }) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(); }
                    }}
                    className={`${getRowBorderClass(levelOf(status))} hover:bg-yellow-50/60 transition-colors cursor-pointer focus:outline-none focus:bg-yellow-50`}
                  >
                    {/* ATM ID + Owner */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        {getStatusIcon(decodeAtmStatus(status.status))}
                        <div>
                          <div className="text-sm font-bold text-slate-900">{status.atm_pid}</div>
                          {(status.atm_name || status.owner) && (
                            <div className="text-xs text-slate-400 font-medium">{status.atm_name || status.owner}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-medium text-slate-600">
                      {status.branch || <span className="text-slate-300">—</span>}
                    </td>

                    {compact ? (
                      /* One clickable chip per failing component */
                      <td className="px-5 py-3.5">
                        {issues.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500/70">
                            <CheckCircle className="w-3.5 h-3.5" /> All OK
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {issues.map(issue => (
                              <button
                                key={issue.key}
                                onClick={(e: { stopPropagation: () => void }) => {
                                  e.stopPropagation();
                                  handleColumnClick(issue.key);
                                }}
                                title={`${issue.label}: ${issue.decoded.displayLabel} — click to show only ATMs with this problem`}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-shadow ${getStatusColor(issue.decoded.status)} ${
                                  hardwareFilter === issue.key ? 'ring-2 ring-yellow-400' : 'hover:shadow-sm'
                                }`}
                              >
                                {getEffectiveLevel(issue.decoded) >= 7
                                  ? <XCircle className="w-3 h-3" />
                                  : <AlertCircle className="w-3 h-3" />}
                                {issue.label}
                                <span className="font-normal opacity-75">{issue.decoded.displayLabel}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    ) : (
                      /* Full device matrix */
                      visibleColumns.map((col: { key: string; label: string }) => {
                        const decoded = decodeField(getStatusField(status, col.key), col.key);
                        return (
                          <td key={col.key} className={`px-5 py-3.5 whitespace-nowrap ${getCellTint(decoded)}`}>
                            {getStatusBadge(decoded)}
                          </td>
                        );
                      })
                    )}

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
                            {COLUMN_HEADERS.map(field => {
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
                : severityFilter !== 'all'
                  ? `No ATMs with ${severityFilter === 'critical' ? 'critical issues' : 'warnings'}`
                  : 'No ATMs with issues — all clear'}
          </p>
          {(activeFilterLabel || severityFilter !== 'all') && (
            <button
              onClick={() => { onFilterChange?.('all'); setSeverityFilter('all'); }}
              className="mt-3 text-xs text-yellow-600 hover:text-yellow-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
