import { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNotes } from '../src/hooks/useNotes.js';
import { useSync } from '../src/hooks/useSync.js';
import { useNetwork } from '../src/hooks/useNetwork.js';
import { useAuth } from '../src/hooks/useAuth.js';
import NoteItem from '../src/components/NoteItem.js';
import SyncStatusBar from '../src/components/SyncStatusBar.js';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { notes, loading, search, searchQuery, refresh } = useNotes();
  const { syncState, pendingCount, lastSyncTime, syncError, sync } = useSync(isOnline);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    if (isOnline) await sync();
    setRefreshing(false);
  }, [refresh, sync, isOnline]);

  const handleNotePress = useCallback(
    (note) => {
      router.push(`/notes/${note.id}`);
    },
    [router]
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.greeting} numberOfLines={1}>
          {user?.displayName ? `Hi, ${user.displayName}` : 'Synced Notepad'}
        </Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.settingsText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <SyncStatusBar
        syncState={syncState}
        pendingCount={pendingCount}
        isOnline={isOnline}
        syncError={syncError}
      />

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={search}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {lastSyncTime && (
        <Text style={styles.lastSync}>
          Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
        </Text>
      )}

      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <NoteItem note={item} onPress={handleNotePress} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={notes.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + button to create your first note
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/devices')}
        >
          <Text style={styles.secondaryText}>Devices</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/conflicts')}
        >
          <Text style={styles.secondaryText}>Conflicts</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/notes/new')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  settingsText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    color: '#1a1a1a',
  },
  lastSync: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    fontSize: 11,
    color: '#aaa',
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
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
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  secondaryText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 70,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
});
