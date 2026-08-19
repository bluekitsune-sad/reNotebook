import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { apiFetch } from '../src/services/api.js';
import VisibilityToggle from '../src/components/VisibilityToggle.js';

export default function VisibilityScreen() {
  const [notes, setNotes] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [visibility, setVisibility] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [notesRes, devicesRes] = await Promise.all([
          apiFetch('/api/notes'),
          apiFetch('/api/devices'),
        ]);
        setNotes(notesRes.notes || []);
        setDevices(devicesRes.devices || []);
      } catch (err) {
        console.error('Failed to load visibility data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadVisibility = useCallback(async (noteId) => {
    if (!noteId) {
      setVisibility({});
      return;
    }
    try {
      const data = await apiFetch(`/api/visibility?noteId=${noteId}`);
      const map = {};
      (data.rules || []).forEach((r) => {
        map[r.device_id] = r.visible;
      });
      setVisibility(map);
    } catch (err) {
      console.error('Failed to load visibility:', err);
    }
  }, []);

  useEffect(() => {
    if (selectedNoteId) loadVisibility(selectedNoteId);
  }, [selectedNoteId, loadVisibility]);

  const handleToggle = useCallback((deviceId, visible) => {
    setVisibility((prev) => ({ ...prev, [deviceId]: visible }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedNoteId) return;
    setSaving(true);
    try {
      await apiFetch('/api/visibility', {
        method: 'PUT',
        body: JSON.stringify({
          noteId: selectedNoteId,
          rules: devices.map((d) => ({
            deviceId: d.device_id,
            visible: visibility[d.device_id] || false,
          })),
        }),
      });
      Alert.alert('Saved', 'Visibility rules updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to save visibility rules');
    } finally {
      setSaving(false);
    }
  }, [selectedNoteId, devices, visibility]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Select a note</Text>
      <FlatList
        horizontal
        data={notes}
        keyExtractor={(item) => String(item.id || item.server_id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.noteChip,
              selectedNoteId === (item.id || item.server_id) && styles.noteChipActive,
            ]}
            onPress={() => setSelectedNoteId(item.id || item.server_id)}
          >
            <Text
              style={[
                styles.noteChipText,
                selectedNoteId === (item.id || item.server_id) && styles.noteChipTextActive,
              ]}
              numberOfLines={1}
            >
              {item.title || 'Untitled'}
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
      />

      {selectedNoteId ? (
        <>
          <Text style={styles.sectionTitle}>Device visibility</Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => String(item.device_id)}
            renderItem={({ item }) => (
              <VisibilityToggle
                device={item}
                visible={visibility[item.device_id] || false}
                onToggle={(visible) => handleToggle(item.device_id, visible)}
              />
            )}
            contentContainerStyle={styles.deviceList}
          />
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Visibility Rules'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👁️</Text>
          <Text style={styles.emptyTitle}>Choose a note above</Text>
          <Text style={styles.emptySubtitle}>
            Control which devices can see each note
          </Text>
        </View>
      )}
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
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#999',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  chipList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  noteChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  noteChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  noteChipText: {
    fontSize: 14,
    color: '#333',
    maxWidth: 120,
  },
  noteChipTextActive: {
    color: '#fff',
  },
  deviceList: {
    paddingHorizontal: 16,
    gap: 4,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
});
