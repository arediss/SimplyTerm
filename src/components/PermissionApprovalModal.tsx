import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';
import { getPermissionInfo, sortPermissionsByRisk, type RiskLevel } from '../plugins/permissionInfo';

interface PermissionApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  pluginName: string;
  permissions: string[];
}

const dotColor: Record<RiskLevel, string> = {
  high: 'bg-error',
  medium: 'bg-warning',
  low: 'bg-success',
};

function PermissionApprovalModal({
  isOpen,
  onClose,
  onApprove,
  pluginName,
  permissions,
}: Readonly<PermissionApprovalModalProps>) {
  const sorted = sortPermissionsByRisk(permissions);
  const hasHighRisk = sorted.some((p) => getPermissionInfo(p).risk === 'high');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Permissions" width="md">
      <div className="space-y-4">
        <div>
          <p className="text-sm text-text font-medium">{pluginName}</p>
          <p className="text-xs text-text-muted">This plugin needs the following permissions to work:</p>
        </div>

        {hasHighRisk && (
          <div className="flex items-center gap-2 p-2.5 bg-error/10 rounded-lg">
            <AlertTriangle size={14} className="text-error flex-shrink-0" />
            <p className="text-xs text-error">
              This plugin requests sensitive permissions. Only approve if you trust the source.
            </p>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
          {sorted.map((perm) => {
            const info = getPermissionInfo(perm);
            return (
              <div key={perm} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-0/20">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[info.risk]}`} />
                <span className="text-sm text-text">{info.label}</span>
                <span className="text-xs text-text-muted truncate">{info.description}</span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-surface-0/50 text-text-muted text-sm font-medium rounded-lg hover:bg-surface-0 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            className="flex-1 py-2.5 bg-accent text-crust text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default PermissionApprovalModal;
