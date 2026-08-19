'use client';

function DeviceTypeIcon({ type }) {
  const icons = { web: '\uD83C\uDF10', mobile: '\uD83D\uDCF1', desktop: '\uD83D\uDCBB' };
  return <span>{icons[type] || '\uD83D\uDCBB'}</span>;
}

export default function VisibilityToggle({ devices, visibility, noteTitle, onToggle, saving }) {
  if (devices.length === 0) {
    return (
      <div className="empty-state">
        <p>No active devices to configure</p>
      </div>
    );
  }

  return (
    <div className="visibility-toggle-panel">
      <h3 className="panel-title">Device visibility for &ldquo;{noteTitle}&rdquo;</h3>
      <p className="panel-subtitle">
        {saving ? 'Saving...' : 'Toggle which devices can see this note'}
      </p>
      <ul className="visibility-device-list">
        {devices.map((device) => {
          const isVisible = visibility[device.id] !== false;
          const deviceId = device.id;
          return (
            <li key={deviceId} className="visibility-device-row">
              <div className="visibility-device-info">
                <DeviceTypeIcon type={device.type} />
                <span className="visibility-device-name">{device.name}</span>
              </div>
              <button
                className={`visibility-switch ${isVisible ? 'visibility-switch--on' : 'visibility-switch--off'}`}
                onClick={() => onToggle(deviceId, !isVisible)}
                disabled={saving}
                role="switch"
                aria-checked={isVisible}
                aria-label={`Toggle visibility for ${device.name}`}
              >
                <span className="visibility-switch-thumb" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
