// ─── Decoder based on ATM_STATUS_FILE_FORMAT.md specification ───────────────

export interface DecodedDeviceStatus {
  device: string;
  deviceCode: string;
  status: 'OK' | 'Warning' | 'Suspended' | 'Critical' | 'Disabled' | 'Not Configured' | 'Unknown';
  statusLevel: number;
  supply: string;
  supplyCode: string;
  additional: string;
  additionalCode: string;
  isHealthy: boolean;
  isConfigured: boolean;
  raw: string;
  displayLabel: string; // Human-readable label shown in UI badges
}

// ─── Table 2: Device Identifiers (positions 1–2 of 8-char code) ─────────────
const DEVICE_IDENTIFIERS: Record<string, string> = {
  SF: 'Safe Door',
  CR: 'Card Reader',
  CB: 'Card Bin',
  EJ: 'Electronic Journal',
  PU: 'Receipt Printer',
  DI: 'Cash Dispenser',
  RJ: 'Reject Bin',
  C1: 'Cassette 1',
  C2: 'Cassette 2',
  C3: 'Cassette 3',
  C4: 'Cassette 4',
  C5: 'Cassette 5',
  C6: 'Cassette 6',
  C7: 'Cassette 7',
  EC: 'Encryptor',
  BT: 'Bill Trap',
  PR: 'Presenter',
  NA: 'Bunch Note Acceptor',
};

// ─── Table 3: Device Status (position 4 of 8-char code) ─────────────────────
const DEVICE_STATUS_MAP: Record<string, 'OK' | 'Warning' | 'Suspended' | 'Critical' | 'Disabled'> = {
  '0': 'OK',
  '3': 'Warning',
  '5': 'Suspended',
  '7': 'Critical',
  '9': 'Disabled',
};

// ─── Table 4: Supply Status (positions 5–6 of 8-char code) ──────────────────
const SUPPLY_STATUS_MAP: Record<string, string> = {
  '00': 'No Overfill Condition',
  '01': 'Sufficient Supply',
  '05': 'Low Supply',
  '06': 'Supplies Gone',
  '07': 'Overfill Condition',
  '08': 'Not Installed or Unknown',
  '09': 'Not Configured',
};

// ─── Table 5: Additional Data (positions 7–8 of 8-char code) ────────────────
// Fixed per spec: 00=Enabled/Closed, 01=In, 03=Open, 04=Out, 05=Disabled
const ADDITIONAL_DATA_MAP: Record<string, string> = {
  '00': 'Enabled / Closed',
  '01': 'In',
  '03': 'Open',
  '04': 'Out',
  '05': 'Disabled',
  '07': '—',
};

// ─── ATM General Status (positions 26–31 in DAT record, stored as `status`) ─
// This is a 3-char code, NOT an 8-char device code.
const ATM_GENERAL_STATUS: Record<string, { status: DecodedDeviceStatus['status']; label: string }> = {
  INS: { status: 'OK',       label: 'In Service'      },
  REP: { status: 'Critical', label: 'Repair'          },
  NOP: { status: 'Warning',  label: 'No Polling'      },
  OUT: { status: 'Critical', label: 'Out of Service'  },
  UNK: { status: 'Warning',  label: 'Unknown'         },
};

// ─── Network Status (positions 33–36 in DAT record, stored as `net`) ─────────
// This is a 3-char code, NOT an 8-char device code.
const NET_STATUS: Record<string, { status: DecodedDeviceStatus['status']; label: string }> = {
  ONL: { status: 'OK',       label: 'Online'  },
  OFF: { status: 'Critical', label: 'Offline' },
  UNK: { status: 'Warning',  label: 'Unknown' },
};

// ─── Decoder for ATM general status field ────────────────────────────────────
export function decodeAtmStatus(statusCode: string | null): DecodedDeviceStatus | null {
  if (!statusCode) return null;
  const trimmed = statusCode.trim().toUpperCase();
  if (!trimmed) return null;

  const mapped = ATM_GENERAL_STATUS[trimmed];
  if (!mapped) return null;

  const level = mapped.status === 'OK' ? 0 : mapped.status === 'Warning' ? 3 : 7;
  return {
    device: 'ATM',
    deviceCode: trimmed,
    status: mapped.status,
    statusLevel: level,
    supply: mapped.label,
    supplyCode: trimmed,
    additional: '',
    additionalCode: '',
    isHealthy: mapped.status === 'OK',
    isConfigured: true,
    raw: statusCode,
    displayLabel: mapped.label,
  };
}

// ─── Decoder for network status field ────────────────────────────────────────
export function decodeNetStatus(statusCode: string | null): DecodedDeviceStatus | null {
  if (!statusCode) return null;
  const trimmed = statusCode.trim().toUpperCase();
  if (!trimmed) return null;

  const mapped = NET_STATUS[trimmed];
  if (!mapped) return null;

  const level = mapped.status === 'OK' ? 0 : mapped.status === 'Warning' ? 3 : 7;
  return {
    device: 'Network',
    deviceCode: trimmed,
    status: mapped.status,
    statusLevel: level,
    supply: mapped.label,
    supplyCode: trimmed,
    additional: '',
    additionalCode: '',
    isHealthy: mapped.status === 'OK',
    isConfigured: true,
    raw: statusCode,
    displayLabel: mapped.label,
  };
}

// ─── Decoder for 8-character device status codes ─────────────────────────────
export function decodeDeviceStatus(statusCode: string | null): DecodedDeviceStatus | null {
  if (!statusCode) return null;

  const trimmed = statusCode.trim().toUpperCase();

  // Blank (8 spaces) = device fully functional
  if (trimmed === '') {
    return {
      device: 'Device',
      deviceCode: '',
      status: 'OK',
      statusLevel: 0,
      supply: 'Sufficient Supply',
      supplyCode: '01',
      additional: 'Enabled / Closed',
      additionalCode: '00',
      isHealthy: true,
      isConfigured: true,
      raw: statusCode,
      displayLabel: 'OK',
    };
  }

  // 8 dashes = device not configured / disconnected
  if (trimmed.includes('-')) {
    return {
      device: 'Device',
      deviceCode: '',
      status: 'Not Configured',
      statusLevel: 99,
      supply: 'Not Available',
      supplyCode: '',
      additional: 'Not Installed',
      additionalCode: '',
      isHealthy: false,
      isConfigured: false,
      raw: statusCode,
      displayLabel: 'Not Installed',
    };
  }

  if (trimmed.length >= 8) {
    const deviceCode = trimmed.substring(0, 2);
    const statusChar = trimmed[3]; // position 4 (0-indexed 3)
    const supplyCode = trimmed.substring(4, 6);
    const additionalCode = trimmed.substring(6, 8);

    const device = DEVICE_IDENTIFIERS[deviceCode] || `Device (${deviceCode})`;
    const status = DEVICE_STATUS_MAP[statusChar] || 'Unknown';
    const supply = SUPPLY_STATUS_MAP[supplyCode] || `Supply (${supplyCode})`;
    const additional = ADDITIONAL_DATA_MAP[additionalCode] || `State (${additionalCode})`;

    const parsedLevel = parseInt(statusChar, 10);
    const statusLevel = Number.isNaN(parsedLevel) ? 99 : parsedLevel;

    // All-zeros = completely normal
    const isAllNormal = statusChar === '0' && supplyCode === '01' && additionalCode === '00';
    const isBlankNormal = statusChar === '0' && supplyCode === '00' && additionalCode === '00';
    const isNormal = isAllNormal || isBlankNormal;

    const resolvedStatus = isNormal ? 'OK' : status;
    const resolvedLevel = isNormal ? 0 : statusLevel;

    return {
      device,
      deviceCode,
      status: resolvedStatus,
      statusLevel: resolvedLevel,
      supply: isNormal ? 'Sufficient Supply' : supply,
      supplyCode,
      additional: isNormal ? 'Enabled / Closed' : additional,
      additionalCode,
      isHealthy: isNormal || (statusLevel === 0 && supplyCode === '01' && additionalCode === '00'),
      isConfigured: supplyCode !== '08' && supplyCode !== '09',
      raw: statusCode,
      displayLabel: resolvedStatus,
    };
  }

  return null;
}

// ─── Pick correct decoder by field key ───────────────────────────────────────
export function decodeField(raw: string | null, fieldKey: string): DecodedDeviceStatus | null {
  if (fieldKey === 'status') return decodeAtmStatus(raw);
  if (fieldKey === 'net') return decodeNetStatus(raw);
  return decodeDeviceStatus(raw);
}

// ─── UI helpers ──────────────────────────────────────────────────────────────
export function getStatusColor(
  status: 'OK' | 'Warning' | 'Suspended' | 'Critical' | 'Disabled' | 'Not Configured' | 'Unknown'
): string {
  switch (status) {
    case 'OK':             return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Warning':        return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Suspended':      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Critical':       return 'bg-red-50 text-red-700 border-red-200';
    case 'Disabled':       return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'Not Configured': return 'bg-slate-50 text-slate-400 border-slate-200';
    default:               return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

export function getStatusIcon(
  status: 'OK' | 'Warning' | 'Suspended' | 'Critical' | 'Disabled' | 'Not Configured' | 'Unknown'
): string {
  switch (status) {
    case 'OK':             return '✓';
    case 'Warning':        return '⚠';
    case 'Suspended':      return '⏸';
    case 'Critical':       return '✕';
    case 'Disabled':       return '○';
    case 'Not Configured': return '−';
    default:               return '?';
  }
}
