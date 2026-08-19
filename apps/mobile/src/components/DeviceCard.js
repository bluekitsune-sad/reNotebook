import { View, Text, StyleSheet } from 'react-native';

const TYPE_ICONS = {
  mobile: '📱',
  desktop: '💻',
  web: '🌐',
};

export default function DeviceCard({ device }) {
  const icon = TYPE_ICONS[device.type] || '📱';
  const statusColor = device.status === 'active' ? '#4CAF50' : '#F44336';
  const lastSync = device.last_synced_at
    ? new Date(device.last_synced_at).toLocaleDateString()
    : 'Never';

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{device.name || 'Unknown device'}</Text>
        <Text style={styles.meta}>
          {device.type} · Last sync: {lastSync}
        </Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  icon: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  meta: {
    fontSize: 13,
    color: '#888',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
