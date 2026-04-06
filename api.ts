const API_URL = import.meta.env.VITE_API_URL || 'https://localhost:7143';

export interface AtmBalance {
  record_id: number | null;
  file_name: string | null;
  balance_date: string | null;
  atm_name: string | null;
  atm_id: string | null;
  terminal_id: string | null;
  branch: string | null;
  initial_balance_all: number | null;
  remaining_balance_all: number | null;
  no_transactions_all: number | null;
  no_withdrawals_all: number | null;
  eur_initial: number | null;
  eur_remaining: number | null;
  timestamp: string | null;
}

export interface AtmStatus {
  record_id: number | null;
  file_name: string | null;
  file_date: string | null;
  atm_pid: string | null;
  atm_name: string | null;
  status: string | null;
  net: string | null;
  crd_reader: string | null;
  dispenser: string | null;
  encryptor: string | null;
  depository: string | null;
  bil_cas1: string | null;
  bil_cas2: string | null;
  bil_cas3: string | null;
  bil_cas4: string | null;
  bil_cas5: string | null;
  bil_cas6: string | null;
  bil_cas7: string | null;
  print_user: string | null;
  door: string | null;
  card_bin: string | null;
  rej_bin: string | null;
  owner: string | null;
  sup_vs: string | null;
  branch: string | null;
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
