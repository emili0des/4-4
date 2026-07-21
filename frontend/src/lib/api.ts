const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7143';

// Fields are optional because the API omits properties that are null in the
// database — an absent field arrives as `undefined`, never as `null`.
export interface AtmBalance {
  record_id?: number | null;
  file_name?: string | null;
  balance_date?: string | null;
  atm_name?: string | null;
  atm_id?: string | null;
  terminal_id?: string | null;
  branch?: string | null;
  initial_balance_all?: number | null;
  remaining_balance_all?: number | null;
  no_transactions_all?: number | null;
  no_withdrawals_all?: number | null;
  eur_initial?: number | null;
  eur_remaining?: number | null;
  timestamp?: string | null;
}

export interface AtmStatus {
  record_id?: number | null;
  file_name?: string | null;
  file_date?: string | null;
  atm_pid?: string | null;
  atm_name?: string | null;
  status?: string | null;
  net?: string | null;
  crd_reader?: string | null;
  dispenser?: string | null;
  encryptor?: string | null;
  depository?: string | null;
  bil_cas1?: string | null;
  bil_cas2?: string | null;
  bil_cas3?: string | null;
  bil_cas4?: string | null;
  bil_cas5?: string | null;
  bil_cas6?: string | null;
  bil_cas7?: string | null;
  print_user?: string | null;
  door?: string | null;
  card_bin?: string | null;
  rej_bin?: string | null;
  owner?: string | null;
  sup_vs?: string | null;
  branch?: string | null;
}

// ── File-to-file comparison (computed on the backend) ────────────────────────
// Note: the API omits null properties, so nullable fields may be missing entirely.

export interface ComparisonFile {
  file_name?: string | null;
  file_date?: string | null;
}

export interface ComponentChange {
  component: string;
  label: string;
  previous_raw?: string | null;
  current_raw?: string | null;
  previous_status: string;
  current_status: string;
}

export interface AtmStatusChange {
  atm_pid?: string | null;
  atm_name?: string | null;
  branch?: string | null;
  fully_recovered: boolean;
  fixed: ComponentChange[];
  new_errors: ComponentChange[];
  ongoing: ComponentChange[];
}

export interface StatusComparisonSummary {
  fixed_count: number;
  new_count: number;
  ongoing_count: number;
  atms_fully_recovered: number;
  atms_degraded: number;
}

export interface StatusComparison {
  current_file: ComparisonFile;
  previous_file: ComparisonFile;
  summary: StatusComparisonSummary;
  atms: AtmStatusChange[];
  atms_added: string[];
  atms_removed: string[];
}

export interface AtmBalanceChange {
  terminal_id?: string | null;
  atm_id?: string | null;
  atm_name?: string | null;
  branch?: string | null;
  previous_remaining?: number | null;
  current_remaining?: number | null;
  delta?: number | null;
  previous_pct: number;
  current_pct: number;
  previous_level: 'critical' | 'low' | 'healthy';
  current_level: 'critical' | 'low' | 'healthy';
  change_type: 'refilled' | 'dropped' | 'unchanged';
  is_fixed: boolean;
}

export interface BalanceComparisonSummary {
  refilled_count: number;
  recovered_count: number;
  went_critical_count: number;
  still_critical_count: number;
}

export interface BalanceComparison {
  current_file: ComparisonFile;
  previous_file: ComparisonFile;
  summary: BalanceComparisonSummary;
  atms: AtmBalanceChange[];
}

export interface ComparisonResult {
  has_previous_status_file: boolean;
  has_previous_balance_file: boolean;
  status_comparison?: StatusComparison | null;
  balance_comparison?: BalanceComparison | null;
}

export const BALANCE_THRESHOLD_CRITICAL = 20; // % remaining
export const BALANCE_THRESHOLD_LOW = 50;      // % remaining

const FETCH_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLatestBalances(): Promise<AtmBalance[]> {
  const response = await fetchWithTimeout(`${API_URL}/api/atm/balances`);
  if (!response.ok) {
    throw new Error(`Failed to fetch balances: ${response.status}`);
  }
  return response.json();
}

export async function fetchLatestStatuses(): Promise<AtmStatus[]> {
  const response = await fetchWithTimeout(`${API_URL}/api/atm/statuses`);
  if (!response.ok) {
    throw new Error(`Failed to fetch statuses: ${response.status}`);
  }
  return response.json();
}

export async function fetchComparison(
  criticalThreshold: number,
  lowThreshold: number
): Promise<ComparisonResult> {
  const params = new URLSearchParams({
    criticalThreshold: String(criticalThreshold),
    lowThreshold: String(lowThreshold),
  });
  const response = await fetchWithTimeout(`${API_URL}/api/atm/comparison?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch comparison: ${response.status}`);
  }
  return response.json();
}
