import { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { noteService } from '../../src/services/noteService.js';

export default function NewNoteScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!title.trim() && !content.trim()) {
      Alert.alert('Empty note', 'Please add a title or some content.');
      return;
    }

    try {
      setSaving(true);
      await noteService.createNote({
        title: title.trim(),
        content: content.trim(),
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }, [title, content, router]);

  useEffect(() => {
    router.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.headerButton, saving && styles.disabled]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [handleSave, saving, router]);

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
          onChangeText={setTitle}
          autoFocus
          returnKeyType="next"
          multiline
        />
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor="#bbb"
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    minHeight: 300,
  },
  headerButton: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    color: '#aaa',
  },
});
