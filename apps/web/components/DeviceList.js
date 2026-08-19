'use client';

import { useState, useRef, useEffect } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return 'never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function InlineRename({ name, deviceId, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(deviceId, trimmed);
    } else {
      setValue(name);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="device-rename-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setValue(name); setEditing(false); }
        }}
      />
    );
  }

  return (
    <span className="device-name-text" onClick={() => setEditing(true)} title="Click to rename">
      {name}
    </span>
  );
}

function DeviceIcon({ type }) {
  const iconMap = {
    web: '🌐',
    mobile: '📱',
    desktop: '💻',
  };
  return <span className="device-type-icon">{iconMap[type] || '💻'}</span>;
}

export default function DeviceList({ devices, currentDeviceId, onRename, onRevoke }) {
  const [confirmRevoke, setConfirmRevoke] = useState(null);

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
      {devices.map((device) => {
        const isOwner = device.id === currentDeviceId || device.isOwner;
        const isPending = device.status === 'pending';
        const isRevoked = device.status === 'revoked';

        return (
          <div key={device.id} className={`device-item ${isRevoked ? 'device-item--revoked' : ''}`}>
            <div className="device-info">
              <div className={`device-icon ${isRevoked ? 'device-icon--revoked' : ''}`}>
                <DeviceIcon type={device.type} />
              </div>
              <div className="device-details">
                <div className="device-name-row">
                  <InlineRename
                    name={device.name}
                    deviceId={device.id}
                    onSave={onRename}
                  />
                  {isOwner && <span className="badge badge--owner">This device</span>}
                  {isPending && <span className="badge badge--pending">Pending approval</span>}
                </div>
                <div className="device-meta">
                  <span className="device-type-label">{device.type}</span>
                  <span className="device-meta-sep">&middot;</span>
                  <span>Last seen {timeAgo(device.lastSeenAt || device.createdAt)}</span>
                  {device.hiddenNoteCount != null && device.hiddenNoteCount > 0 && (
                    <>
                      <span className="device-meta-sep">&middot;</span>
                      <span className="device-hidden-count">Hidden notes: {device.hiddenNoteCount}</span>
                    </>
                  )}
                </div>
                {isPending && (
                  <div className="device-pending-hint">
                    Pairing request pending — owner must confirm on their device
                  </div>
                )}
              </div>
            </div>
            <div className="device-actions">
              {!isOwner && !isRevoked && (
                confirmRevoke === device.id ? (
                  <div className="device-revoke-confirm">
                    <span>Revoke?</span>
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => { onRevoke(device.id); setConfirmRevoke(null); }}
                    >
                      Yes
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => setConfirmRevoke(null)}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-ghost btn-sm btn-revoke"
                    onClick={() => setConfirmRevoke(device.id)}
                    title="Revoke device"
                  >
                    Revoke
                  </button>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
