'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/Layout.js';
import DeviceList from '../../components/DeviceList.js';
import QRCode from '../../components/QRCode.js';
import useSync from '../../hooks/useSync.js';
import { apiFetch } from '../../services/api.js';

export default function DevicesPage() {
  const syncContext = useSync();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pairingUrl, setPairingUrl] = useState(null);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingExpiry, setPairingExpiry] = useState(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const expiryRef = useRef(null);

  const loadDevices = useCallback(async () => {
    try {
      const result = await apiFetch('/api/devices');
      setDevices(result.devices || []);
      if (result.currentDeviceId) {
        setDeviceId(result.currentDeviceId);
      }
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (!pairingExpiry) return;
    const tick = () => {
      const remaining = pairingExpiry - Date.now();
      if (remaining <= 0) {
        setPairingUrl(null);
        setPairingCode('');
        setPairingExpiry(null);
        clearInterval(expiryRef.current);
      }
    };
    expiryRef.current = setInterval(tick, 1000);
    return () => clearInterval(expiryRef.current);
  }, [pairingExpiry]);

  const handlePair = useCallback(async () => {
    setPairingLoading(true);
    try {
      const result = await apiFetch('/api/devices/pair', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'default' }),
      });
      setPairingUrl(result.qrData || result.pairingUrl || null);
      setPairingCode(result.verificationCode || '');
      setPairingExpiry(Date.now() + (result.expiresIn || 300) * 1000);
    } catch {
      alert('Failed to start pairing');
    } finally {
      setPairingLoading(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setPairingUrl(null);
    setPairingCode('');
    setPairingExpiry(null);
    clearInterval(expiryRef.current);
  }, []);

  const handleRename = useCallback(async (deviceId, newName) => {
    try {
      await apiFetch(`/api/devices/${deviceId}/rename`, {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      });
      await loadDevices();
    } catch {
      alert('Failed to rename device');
    }
  }, [loadDevices]);

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
          disabled={pairingLoading || (pairingUrl && pairingExpiry > Date.now())}
        >
          {pairingLoading ? 'Generating...' : 'Add Device'}
        </button>
      </div>

      {pairingUrl && (
        <QRCode
          url={pairingUrl}
          verificationCode={pairingCode}
          expiry={pairingExpiry}
          onDismiss={handleDismiss}
        />
      )}

      {loading ? (
        <div className="empty-state"><p>Loading devices...</p></div>
      ) : (
        <DeviceList
          devices={devices}
          currentDeviceId={deviceId}
          onRename={handleRename}
          onRevoke={handleRevoke}
        />
      )}
    </Layout>
  );
}
