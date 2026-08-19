'use client';

import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout.js';
import DeviceList from '../../components/DeviceList.js';
import useSync from '../../hooks/useSync.js';
import { apiFetch } from '../../services/api.js';

export default function DevicesPage() {
  const syncContext = useSync();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pairingUrl, setPairingUrl] = useState(null);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const result = await apiFetch('/api/devices');
      setDevices(result.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handlePair = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await apiFetch('/api/devices/pair', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'default' }),
      });
      setPairingUrl(result.qrData || result.pairingUrl || null);
      setPairingCode(result.verificationCode || '');
    } catch {
      alert('Failed to start pairing');
    } finally {
      setPairingLoading(false);
    }
  }, []);

  const handleRevoke = useCallback(async (deviceId) => {
    if (!window.confirm('Revoke this device? It will no longer be able to sync.')) return;
    try {
      await apiFetch(`/api/devices/${deviceId}/revoke`, { method: 'POST' });
      await loadDevices();
    } catch {
      alert('Failed to revoke device');
    }
  }, [loadDevices]);

  return (
    <Layout syncContext={syncContext}>
      <div className="page-header">
        <h1>Devices</h1>
        <button
          className="btn-primary btn-sm"
          onClick={handlePair}
          disabled={pairingLoading}
        >
          {pairingLoading ? 'Generating...' : 'Add Device'}
        </button>
      </div>

      {pairingUrl && (
        <div className="qr-area">
          <div style={{
            width: 192,
            height: 192,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8125rem',
            color: 'var(--color-text-secondary)',
            wordBreak: 'break-all',
            padding: '0.5rem',
            textAlign: 'center',
          }}>
            {pairingUrl}
          </div>
          {pairingCode && (
            <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              Code: {pairingCode}
            </div>
          )}
          <p>Scan this QR code or enter the URL on your other device</p>
          <button className="btn-ghost btn-sm" onClick={() => { setPairingUrl(null); setPairingCode(''); }}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p>Loading devices...</p></div>
      ) : (
        <DeviceList devices={devices} onRevoke={handleRevoke} />
      )}
    </Layout>
  );
}
