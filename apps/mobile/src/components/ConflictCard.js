import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ConflictCard({ conflict, onResolve }) {
  const localPayload = conflict.localPayload || {};
  const serverPayload = conflict.serverPayload || {};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conflict detected</Text>
      <Text style={styles.noteName}>{localPayload.title || serverPayload.title || 'Untitled'}</Text>

      <View style={styles.versions}>
        <View style={styles.version}>
          <Text style={styles.versionLabel}>Local</Text>
          <Text style={styles.versionContent} numberOfLines={3}>
            {localPayload.content || '(empty)'}
          </Text>
        </View>
        <View style={styles.version}>
          <Text style={styles.versionLabel}>Remote</Text>
          <Text style={styles.versionContent} numberOfLines={3}>
            {serverPayload.content || '(empty)'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.keepLocal]}
          onPress={() => onResolve(conflict.changeId, 'keep_local')}
        >
          <Text style={styles.buttonText}>Keep local</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.keepRemote]}
          onPress={() => onResolve(conflict.changeId, 'keep_remote')}
        >
          <Text style={styles.buttonText}>Keep remote</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.mergeButton]}
          onPress={() => onResolve(conflict.changeId, 'merge')}
        >
          <Text style={styles.buttonText}>Merge</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#FF9800',
    gap: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  noteName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  versions: {
    flexDirection: 'row',
    gap: 10,
  },
  version: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  versionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
  },
  versionContent: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  keepLocal: {
    backgroundColor: '#2196F3',
  },
  keepRemote: {
    backgroundColor: '#9C27B0',
  },
  mergeButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
