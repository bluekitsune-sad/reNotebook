import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, Text, StyleSheet } from 'react-native';
import { getDatabase } from '../src/storage/database.js';
import ConflictCard from '../src/components/ConflictCard.js';

export default function ConflictsScreen() {
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync(
          'SELECT * FROM conflicts WHERE status = ? ORDER BY created_at DESC',
          ['pending']
        );
        const parsed = rows.map((r) => ({
          ...r,
          localPayload: JSON.parse(r.local_payload || '{}'),
          serverPayload: JSON.parse(r.server_payload || '{}'),
        }));
        setConflicts(parsed);
      } catch (err) {
        console.error('Failed to load conflicts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleResolve = useCallback(async (changeId, resolution) => {
    try {
      const db = await getDatabase();
      await db.runAsync(
        'UPDATE conflicts SET status = ?, resolved_at = ? WHERE change_id = ?',
        ['resolved', new Date().toISOString(), changeId]
      );
      setConflicts((prev) => prev.filter((c) => c.change_id !== changeId));
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading conflicts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conflicts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ConflictCard conflict={item} onResolve={handleResolve} />
        )}
        contentContainerStyle={conflicts.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>No conflicts</Text>
            <Text style={styles.emptySubtitle}>
              All your notes are in sync across devices
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
