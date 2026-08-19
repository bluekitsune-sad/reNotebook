import { View, Text, StyleSheet } from 'react-native';
import { SYNC_STATE } from '@synced-notepad/shared';

const STATUS_CONFIG = {
  [SYNC_STATE.IDLE]: { color: '#4CAF50', label: 'Synced' },
  [SYNC_STATE.CHECKING]: { color: '#FF9800', label: 'Checking...' },
  [SYNC_STATE.PULLING]: { color: '#FF9800', label: 'Pulling...' },
  [SYNC_STATE.APPLYING]: { color: '#FF9800', label: 'Applying...' },
  [SYNC_STATE.PUSHING]: { color: '#FF9800', label: 'Syncing...' },
  [SYNC_STATE.COMPLETED]: { color: '#4CAF50', label: 'Synced' },
  [SYNC_STATE.ERROR]: { color: '#F44336', label: 'Sync error' },
};

export default function SyncStatusBar({ syncState, pendingCount, isOnline, syncError }) {
  if (!isOnline) {
    return (
      <View style={[styles.container, { backgroundColor: '#FF9800' }]}>
        <Text style={styles.text}>Offline — changes saved locally</Text>
        {pendingCount > 0 && (
          <Text style={styles.badge}>{pendingCount} pending</Text>
        )}
      </View>
    );
  }

  const config = STATUS_CONFIG[syncState] || STATUS_CONFIG[SYNC_STATE.IDLE];

  return (
    <View style={[styles.container, { backgroundColor: config.color }]}>
      <View style={styles.row}>
        <View style={styles.dot} />
        <Text style={styles.text}>{config.label}</Text>
      </View>
      {pendingCount > 0 && syncState === SYNC_STATE.IDLE && (
        <Text style={styles.badge}>{pendingCount} pending</Text>
      )}
      {syncError && syncState === SYNC_STATE.ERROR && (
        <Text style={styles.error}>{syncError}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  badge: {
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  error: {
    color: '#fff',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
