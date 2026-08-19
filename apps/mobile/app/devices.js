import { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, Text, StyleSheet, TouchableOpacity,
  Alert, TextInput, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../src/services/api.js';
import DeviceCard from '../src/components/DeviceCard.js';

export default function DevicesScreen() {
  const router = useRouter();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDevices = useCallback(async () => {
    try {
      const data = await apiFetch('/api/devices');
      setDevices(data.devices || []);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDevices();
  }, [loadDevices]);

  const handleAddDevice = useCallback(() => {
    router.push('/pairing');
  }, [router]);

  const handleRename = useCallback(async (deviceId, newName) => {
    if (!newName.trim()) return;
    try {
      await apiFetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName.trim() }),
      });
      setDevices((prev) =>
        prev.map((d) => (d.device_id === deviceId ? { ...d, name: newName.trim() } : d))
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to rename device');
    }
  }, []);

  const handleRevoke = useCallback((deviceId, deviceName) => {
    Alert.alert(
      'Revoke Device',
      `Remove "${deviceName}" from your synced devices? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/devices/${deviceId}`, { method: 'DELETE' });
              setDevices((prev) => prev.filter((d) => d.device_id !== deviceId));
            } catch (err) {
              Alert.alert('Error', 'Failed to revoke device');
            }
          },
        },
      ]
    );
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading devices...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
        <Text style={styles.addButtonText}>+ Add Device</Text>
      </TouchableOpacity>

      <FlatList
        data={devices}
        keyExtractor={(item) => String(item.device_id)}
        renderItem={({ item }) => (
          <DeviceCard
            device={item}
            isOwner={item.is_owner}
            onRename={handleRename}
            onRevoke={handleRevoke}
          />
        )}
        contentContainerStyle={devices.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔗</Text>
            <Text style={styles.emptyTitle}>No devices paired</Text>
            <Text style={styles.emptySubtitle}>
              Pair another device to sync your notes across platforms
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#999',
  },
  addButton: {
    backgroundColor: '#2196F3',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  list: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
