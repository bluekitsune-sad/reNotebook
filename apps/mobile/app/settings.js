import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth.js';
import { useSync } from '../src/hooks/useSync.js';
import { useNetwork } from '../src/hooks/useNetwork.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isOnline } = useNetwork();
  const { syncState, lastSyncTime, pendingCount } = useSync(isOnline);
  const [clearing, setClearing] = useState(false);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  }, [logout, router]);

  const handleClearData = useCallback(() => {
    Alert.alert('Clear Local Data', 'This will remove all locally stored notes and sync data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await AsyncStorage.clear();
            Alert.alert('Done', 'Local data has been cleared.');
          } catch {
            Alert.alert('Error', 'Failed to clear data.');
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  }, []);

  const formatSyncState = (state) => {
    const map = {
      idle: 'Idle',
      checking: 'Checking...',
      pushing: 'Uploading changes...',
      applying: 'Downloading changes...',
      completed: 'Synced',
      error: 'Sync error',
    };
    return map[state] || state;
  };

  return (
    <ScrollView style={styles.container}>
      <Section title="Account">
        <InfoRow label="Display Name" value={user?.displayName || '—'} />
        <InfoRow label="Email" value={user?.email || '—'} />
      </Section>

      <Section title="Workspace">
        <InfoRow label="Workspace" value={user?.workspaceName || '—'} />
      </Section>

      <Section title="Sync">
        <InfoRow label="Status" value={formatSyncState(syncState)} />
        <InfoRow
          label="Last Sync"
          value={lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}
        />
        <InfoRow label="Pending Changes" value={String(pendingCount)} />
      </Section>

      <Section title="Data">
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={handleClearData}
          disabled={clearing}
        >
          {clearing ? (
            <ActivityIndicator color="#D32F2F" size="small" />
          ) : (
            <Text style={styles.dangerText}>Clear Local Data</Text>
          )}
        </TouchableOpacity>
      </Section>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Synced Notepad v0.1.0</Text>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 15,
    color: '#333',
  },
  infoValue: {
    fontSize: 15,
    color: '#888',
    maxWidth: '60%',
    textAlign: 'right',
  },
  dangerRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerText: {
    fontSize: 15,
    color: '#D32F2F',
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 32,
    marginHorizontal: 16,
    backgroundColor: '#D32F2F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    color: '#bbb',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 40,
  },
});
