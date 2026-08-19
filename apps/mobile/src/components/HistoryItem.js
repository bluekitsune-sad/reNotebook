import { View, Text, StyleSheet } from 'react-native';

const EVENT_COLORS = {
  create: '#4CAF50',
  update: '#2196F3',
  delete: '#F44336',
  sync: '#9C27B0',
  pair: '#FF9800',
  revoke: '#F44336',
};

function relativeTimestamp(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HistoryItem({ event }) {
  const typeLower = (event.event_type || 'update').toLowerCase();
  const label = typeLower.charAt(0).toUpperCase() + typeLower.slice(1);
  const color = EVENT_COLORS[typeLower] || '#888';
  const time = relativeTimestamp(event.timestamp);

  return (
    <View style={styles.container}>
      <View style={[styles.typeBadge, { backgroundColor: color }]}>
        <Text style={styles.typeText}>{label}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.device} numberOfLines={1}>
          {event.device_name || 'Unknown device'}
        </Text>
        {event.note_title && (
          <Text style={styles.note} numberOfLines={1}>
            {event.note_title}
          </Text>
        )}
      </View>
      <Text style={styles.time}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginHorizontal: 16,
    marginVertical: 3,
    gap: 10,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  info: {
    flex: 1,
  },
  device: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  note: {
    fontSize: 12,
    color: '#999',
  },
  time: {
    fontSize: 12,
    color: '#aaa',
    fontVariant: ['tabular-nums'],
  },
});
