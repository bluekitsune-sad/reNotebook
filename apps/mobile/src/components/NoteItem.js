import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function NoteItem({ note, onPress }) {
  const preview = note.content
    ? note.content.substring(0, 100).replace(/\n/g, ' ')
    : 'Empty note';

  const date = note.updated_at
    ? new Date(note.updated_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <TouchableOpacity style={styles.container} onPress={() => onPress(note)} activeOpacity={0.7}>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {note.title || 'Untitled'}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
        <Text style={styles.date}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    gap: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  preview: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});
