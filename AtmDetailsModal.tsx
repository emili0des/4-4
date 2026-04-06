import { useEffect, useRef } from 'react';
import { AtmBalance, AtmStatus } from '../lib/api';
import { X, Banknote, Activity, HardDrive } from 'lucide-react';
import { decodeField, getStatusColor, getStatusIcon } from '../lib/hardwareStatusDecoder';

interface AtmDetailsModalProps {
  balance: AtmBalance;
  status: AtmStatus | null;
  onClose: () => void;
}

export function AtmDetailsModal({ balance, status, onClose }: AtmDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Focus the modal on open
    modalRef.current?.focus();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getComponentStatus = (componentStatus: string | null | undefined, fieldKey = 'device') => {
    const decoded = decodeField(componentStatus ?? null, fieldKey);
    if (!decoded) return { color: 'text-gray-500', bg: 'bg-gray-100', text: 'Unknown', icon: '?', details: '' };

    const colorClass = getStatusColor(decoded.status);
    const colorMap: Record<string, { text: string; bg: string }> = {
      'bg-emerald-50 text-emerald-700 border-emerald-200': { text: 'text-emerald-700', bg: 'bg-emerald-100' },
      'bg-amber-50 text-amber-700 border-amber-200': { text: 'text-amber-700', bg: 'bg-amber-100' },
      'bg-orange-50 text-orange-700 border-orange-200': { text: 'text-orange-700', bg: 'bg-orange-100' },
      'bg-red-50 text-red-700 border-red-200': { text: 'text-red-700', bg: 'bg-red-100' },
      'bg-slate-50 text-slate-700 border-slate-200': { text: 'text-slate-700', bg: 'bg-slate-100' },
    };

    const colors = colorMap[colorClass] || { text: 'text-gray-700', bg: 'bg-gray-100' };

    return {
      color: colors.text,
      bg: colors.bg,
      text: decoded.displayLabel,
      icon: getStatusIcon(decoded.status),
      status: decoded.status,
      details: decoded.additional
        ? `${decoded.supply}, ${decoded.additional}`
        : decoded.supply,
    };
  };

  const dispensedAll = (balance.initial_balance_all ?? 0) - (balance.remaining_balance_all ?? 0);
  const isDualCurrency = balance.eur_initial != null && balance.eur_initial > 0;
  const dispensedEur = (balance.eur_initial ?? 0) - (balance.eur_remaining ?? 0);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain outline-none"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900">
              {balance.atm_name || balance.atm_id || 'ATM Details'}
            </h2>
            <p className="text-sm text-gray-500">{balance.terminal_id}</p>
          </div>
          {/* Large tap target for mobile */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="bg-yellow-50 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Banknote className="w-5 h-5 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-900">Balance Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">All Currency</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Initial Balance:</span>
                    <span className="font-medium">{formatCurrency(balance.initial_balance_all)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Dispensed:</span>
                    <span className="font-medium">{formatCurrency(dispensedAll)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Remaining:</span>
                    <span className="font-semibold text-lg">{formatCurrency(balance.remaining_balance_all)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="text-sm text-gray-600">Total Transactions:</span>
                    <span className="font-medium">{balance.no_transactions_all || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Withdrawals:</span>
                    <span className="font-medium">{balance.no_withdrawals_all || 0}</span>
                  </div>
                </div>
              </div>

              {isDualCurrency && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">EUR Currency</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Initial Balance:</span>
                      <span className="font-medium">{formatCurrency(balance.eur_initial)} EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Dispensed:</span>
                      <span className="font-medium">{formatCurrency(dispensedEur)} EUR</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Remaining:</span>
                      <span className="font-semibold text-lg">{formatCurrency(balance.eur_remaining)} EUR</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!status && (
            <div className="bg-gray-50 rounded-lg p-6 flex items-center gap-3 text-gray-500">
              <Activity className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">No hardware status data available for this ATM.</span>
            </div>
          )}

          {status && (
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-gray-700" />
                <h3 className="text-lg font-semibold text-gray-900">Hardware Status</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Overall Status:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.status, 'status').bg} ${getComponentStatus(status.status, 'status').color}`} title={getComponentStatus(status.status, 'status').details}>
                      {getComponentStatus(status.status, 'status').text}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Network:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.net, 'net').bg} ${getComponentStatus(status.net, 'net').color}`} title={getComponentStatus(status.net, 'net').details}>
                      {getComponentStatus(status.net, 'net').text}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Card Reader:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.crd_reader).bg} ${getComponentStatus(status.crd_reader).color}`} title={getComponentStatus(status.crd_reader).details}>
                      {getComponentStatus(status.crd_reader).text}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Dispenser:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.dispenser).bg} ${getComponentStatus(status.dispenser).color}`} title={getComponentStatus(status.dispenser).details}>
                      {getComponentStatus(status.dispenser).text}
                    </span>
                  </div>
                  {status.print_user !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Printer (User):</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.print_user).bg} ${getComponentStatus(status.print_user).color}`} title={getComponentStatus(status.print_user).details}>
                        {getComponentStatus(status.print_user).text}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {status.door !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Door:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.door).bg} ${getComponentStatus(status.door).color}`} title={getComponentStatus(status.door).details}>
                        {getComponentStatus(status.door).text}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Encryptor:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.encryptor).bg} ${getComponentStatus(status.encryptor).color}`} title={getComponentStatus(status.encryptor).details}>
                      {getComponentStatus(status.encryptor).text}
                    </span>
                  </div>
                  {status.card_bin !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Card Bin:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.card_bin).bg} ${getComponentStatus(status.card_bin).color}`} title={getComponentStatus(status.card_bin).details}>
                        {getComponentStatus(status.card_bin).text}
                      </span>
                    </div>
                  )}
                  {status.rej_bin !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Reject Bin:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.rej_bin).bg} ${getComponentStatus(status.rej_bin).color}`} title={getComponentStatus(status.rej_bin).details}>
                        {getComponentStatus(status.rej_bin).text}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Depository:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComponentStatus(status.depository).bg} ${getComponentStatus(status.depository).color}`} title={getComponentStatus(status.depository).details}>
                      {getComponentStatus(status.depository).text}
                    </span>
                  </div>
                </div>
              </div>

              {(status.bil_cas1 || status.bil_cas2 || status.bil_cas3 || status.bil_cas4 || status.bil_cas5 || status.bil_cas6 || status.bil_cas7) && (
                <div className="mt-6 pt-6 border-t border-gray-300">
                  <div className="flex items-center gap-2 mb-3">
                    <HardDrive className="w-4 h-4 text-gray-700" />
                    <h4 className="font-medium text-gray-900">Bill Cassettes</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {status.bil_cas1 && (
                      <div className="text-center p-2 bg-white rounded border border-gray-200" title={getComponentStatus(status.bil_cas1).details}>
                        <div className="text-xs text-gray-500 mb-1">Cassette 1</div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getComponentStatus(status.bil_cas1).bg} ${getComponentStatus(status.bil_cas1).color}`}>
                          {getComponentStatus(status.bil_cas1).text}
                        </span>
                      </div>
                    )}
                    {status.bil_cas2 && (
                      <div className="text-center p-2 bg-white rounded border border-gray-200" title={getComponentStatus(status.bil_cas2).details}>
                        <div className="text-xs text-gray-500 mb-1">Cassette 2</div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getComponentStatus(status.bil_cas2).bg} ${getComponentStatus(status.bil_cas2).color}`}>
                          {getComponentStatus(status.bil_cas2).text}
                        </span>
                      </div>
                    )}
                    {status.bil_cas3 && (
                      <div className="text-center p-2 bg-white rounded border border-gray-200" title={getComponentStatus(status.bil_cas3).details}>
                        <div className="text-xs text-gray-500 mb-1">Cassette 3</div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getComponentStatus(status.bil_cas3).bg} ${getComponentStatus(status.bil_cas3).color}`}>
                          {getComponentStatus(status.bil_cas3).text}
                        </span>
                      </div>
                    )}
                    {status.bil_cas4 && (
                      <div className="text-center p-2 bg-white rounded border border-gray-200" title={getComponentStatus(status.bil_cas4).details}>
                        <div className="text-xs text-gray-500 mb-1">Cassette 4</div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getComponentStatus(status.bil_cas4).bg} ${getComponentStatus(status.bil_cas4).color}`}>
                          {getComponentStatus(status.bil_cas4).text}
                        </span>
                      </div>
                    )}
                    {status.bil_cas5 && (
                      <div className="text-center p-2 bg-white rounded border border-gray-200" title={getComponentStatus(status.bil_cas5).details}>
                        <div className="text-xs text-gray-500 mb-1">Cassette 5</div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getComponentStatus(status.bil_cas5).bg} ${getComponentStatus(status.bil_cas5).color}`}>
                          {getComponentStatus(status.bil_cas5).text}
                        </span>
                      </div>
                    )}
                    {status.bil_cas6 && (
                      <div className="text-center p-2 bg-white rounded border border-gray-200" title={getComponentStatus(status.bil_cas6).details}>
                        <div className="text-xs text-gray-500 mb-1">Cassette 6</div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getComponentStatus(status.bil_cas6).bg} ${getComponentStatus(status.bil_cas6).color}`}>
                          {getComponentStatus(status.bil_cas6).text}
                        </span>
                      </div>
                    )}
                    {status.bil_cas7 && (
                      <div className="text-center p-2 bg-white rounded border border-gray-200" title={getComponentStatus(status.bil_cas7).details}>
                        <div className="text-xs text-gray-500 mb-1">Cassette 7</div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getComponentStatus(status.bil_cas7).bg} ${getComponentStatus(status.bil_cas7).color}`}>
                          {getComponentStatus(status.bil_cas7).text}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 text-xs text-gray-500">
                Last updated: {status.file_date ? new Date(status.file_date).toLocaleString() : 'Unknown'}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Balance Date:</span>
                <p className="font-medium">
                  {balance.balance_date ? new Date(balance.balance_date).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">File Name:</span>
                <p className="font-medium">{balance.file_name}</p>
              </div>
              {status && (
                <>
                  <div>
                    <span className="text-gray-600">Owner:</span>
                    <p className="font-medium">{status.owner || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Branch:</span>
                    <p className="font-medium">{balance.branch || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Safe-area spacer for iPhone home indicator */}
        <div className="sm:hidden" style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </div>
    </div>
  );
}
