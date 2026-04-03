import { decodeDeviceStatus, getStatusColor, getStatusIcon } from '../lib/hardwareStatusDecoder';
import { CheckCircle, AlertTriangle, XCircle, AlertCircle } from 'lucide-react';

interface HardwareStatusDetailProps {
  statusCode: string | null | undefined;
  label: string;
}

export function HardwareStatusDetail({ statusCode, label }: HardwareStatusDetailProps) {
  const decoded = decodeDeviceStatus(statusCode ?? null);

  if (!decoded) {
    return null;
  }

  const colorClass = getStatusColor(decoded.status);

  const getStatusIcon2 = () => {
    switch (decoded.status) {
      case 'OK':
        return <CheckCircle className="w-4 h-4" />;
      case 'Warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'Critical':
        return <XCircle className="w-4 h-4" />;
      case 'Not Configured':
        return <AlertCircle className="w-4 h-4 opacity-40" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${colorClass}`}
      title={`${decoded.device}: ${decoded.status} (${decoded.supply}${decoded.additional !== 'Fully Functional' ? `, ${decoded.additional}` : ''})`}
    >
      {getStatusIcon2()}
      <span>{label}</span>
      <span className="hidden sm:inline opacity-75">({decoded.status})</span>
    </div>
  );
}

export function HardwareStatusGrid({ statusCode }: { statusCode: string | null | undefined }) {
  const decoded = decodeDeviceStatus(statusCode ?? null);

  if (!decoded) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-slate-200 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase">Device</div>
          <div className="text-sm font-medium text-slate-900">{decoded.device}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase">Status</div>
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold ${getStatusColor(decoded.status)}`}>
            {getStatusIcon(decoded.status)} {decoded.status}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase">Supply</div>
          <div className="text-sm font-medium text-slate-900">{decoded.supply}</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase">State</div>
          <div className="text-sm font-medium text-slate-900">{decoded.additional}</div>
        </div>
      </div>
      {!decoded.isConfigured && (
        <div className="bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-600">
          This device is not installed or not configured in this ATM.
        </div>
      )}
    </div>
  );
}
