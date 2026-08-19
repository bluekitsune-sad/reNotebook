'use client';

export default function DeviceList({ devices, onRevoke }) {
  const getDeviceIcon = (type) => {
    switch (type) {
      case 'web': return '\uD83D\uDDA5\uFE0F';
      case 'mobile': return '\uD83D\uDCF1';
      case 'desktop': return '\uD83D\uDCBB';
      default: return '\uD83D\uDCBB';
    }
  };

  const getBadgeClass = (status) => {
    switch (status) {
      case 'active': return 'badge--active';
      case 'pending': return 'badge--pending';
      case 'revoked': return 'badge--revoked';
      default: return '';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (devices.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">&#128241;</div>
        <h3>No devices paired</h3>
        <p>Add a device to start syncing your notes</p>
      </div>
    );
  }

  return (
    <div className="device-list">
      {devices.map((device) => (
        <div key={device.id} className="device-item">
          <div className="device-info">
            <div className="device-icon">{getDeviceIcon(device.type)}</div>
            <div>
              <div className="device-name">{device.name}</div>
              <div className="device-meta">
                {device.type} &middot; Last seen {formatDate(device.lastSeenAt || device.createdAt)}
              </div>
            </div>
          </div>
          <div className="device-actions">
            <span className={`badge ${getBadgeClass(device.status)}`}>
              {device.status}
            </span>
            {device.status !== 'revoked' && (
              <button
                className="btn-ghost btn-sm"
                onClick={() => onRevoke(device.id)}
                title="Revoke device"
              >
                Revoke
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
