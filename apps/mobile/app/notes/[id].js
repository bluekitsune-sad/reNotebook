import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { noteService } from '../../src/services/noteService.js';

export default function NoteEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [note, setNote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef(null);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const n = await noteService.getNote(Number(id));
        if (n) {
          setNote(n);
          setTitle(n.title || '');
          setContent(n.content || '');
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to load note');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const save = useCallback(async () => {
    if (!note) return;
    try {
      setSaving(true);
      await noteService.updateNote(note.id, {
        title: title.trim(),
        content: content.trim(),
      });
      isDirtyRef.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [note, title, content]);

  const handleDelete = useCallback(async () => {
    if (!note) return;
    Alert.alert('Delete note', 'Move this note to trash?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await noteService.deleteNote(note.id);
            router.back();
          } catch (err) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  }, [note, router]);

  const autoSave = useCallback(
    (text, isTitle) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      isDirtyRef.current = true;
      if (isTitle) setTitle(text);
      else setContent(text);
      saveTimerRef.current = setTimeout(() => {
        save();
      }, 2000);
    },
    [save]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    router.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          {saved && <Text style={styles.savedLabel}>Saved</Text>}
          <TouchableOpacity onPress={save} disabled={saving}>
            <Text style={[styles.headerButton, saving && styles.disabled]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [save, saving, saved, router]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll}>
        <TextInput
          style={styles.titleInput}
          placeholder="Note title"
          placeholderTextColor="#bbb"
          value={title}
          onChangeText={(t) => autoSave(t, true)}
          returnKeyType="next"
          multiline
        />
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor="#bbb"
          value={content}
          onChangeText={(t) => autoSave(t, false)}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#999',
  },
  scroll: {
    flex: 1,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    minHeight: 50,
  },
  contentInput: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    minHeight: 400,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    color: '#aaa',
  },
  savedLabel: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '500',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  deleteText: {
    color: '#F44336',
    fontSize: 15,
    fontWeight: '500',
  },
});
