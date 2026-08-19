import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/services/api.js';

const PAIRING_EXPIRY_SECONDS = 300;

export default function PairingScreen() {
  const router = useRouter();
  const [pairingData, setPairingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [remaining, setRemaining] = useState(PAIRING_EXPIRY_SECONDS);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch('/api/pairing', { method: 'POST' });
        setPairingData(data);
        if (data.expiresAt) {
          const secs = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
          setRemaining(secs);
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to start pairing session');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
  const seconds = String(remaining % 60).padStart(2, '0');

  const handleCopyToken = useCallback(() => {
    if (pairingData?.token) {
      const { Clipboard } = require('react-native');
      Clipboard.setString(pairingData.token);
      Alert.alert('Copied', 'Pairing token copied to clipboard');
    }
  }, [pairingData]);

  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Pairing', 'Discard this pairing session?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => router.back() },
    ]);
  }, [router]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Starting pairing...</Text>
      </View>
    );
  }

  if (remaining <= 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.expiredIcon}>⏰</Text>
        <Text style={styles.expiredTitle}>Pairing expired</Text>
        <Text style={styles.expiredSubtitle}>
          The pairing window has closed. Go back and try again.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>QR Pairing</Text>
        <Text style={styles.cardSubtitle}>
          Scan this code from the other device or enter the pairing token manually
        </Text>

        <View style={styles.qrContainer}>
          <Text style={styles.qrText}>
            {pairingData?.token
              ? Array.from(pairingData.token).map((ch, i) => ((i > 0 && i % 16 === 0) ? '\n' : '')).join('')
              : ''}
          </Text>
          <Text style={styles.qrToken}>
            {pairingData?.token || '--------'}
          </Text>
        </View>

        <View style={styles.timerRow}>
          <Text style={styles.timerLabel}>Expires in</Text>
          <Text style={[styles.timerValue, remaining < 60 && styles.timerWarning]}>
            {minutes}:{seconds}
          </Text>
        </View>

        {pairingData?.verificationCode && (
          <View style={styles.verifyContainer}>
            <Text style={styles.verifyLabel}>Verification Code</Text>
            <Text style={styles.verifyCode}>{pairingData.verificationCode}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.copyButton} onPress={handleCopyToken}>
          <Text style={styles.copyButtonText}>Copy Pairing Token</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    padding: 16,
    justifyContent: 'center',
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#999',
    marginTop: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  qrContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  qrText: {
    fontSize: 10,
    color: '#666',
    fontFamily: 'monospace',
  },
  qrToken: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginTop: 8,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerLabel: {
    fontSize: 14,
    color: '#888',
  },
  timerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4CAF50',
    fontVariant: ['tabular-nums'],
  },
  timerWarning: {
    color: '#F44336',
  },
  verifyContainer: {
    alignItems: 'center',
    gap: 4,
  },
  verifyLabel: {
    fontSize: 13,
    color: '#888',
  },
  verifyCode: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2196F3',
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  copyButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  expiredIcon: {
    fontSize: 48,
  },
  expiredTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  expiredSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
