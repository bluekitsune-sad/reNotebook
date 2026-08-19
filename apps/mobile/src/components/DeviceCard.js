import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';

const TYPE_ICONS = {
  mobile: '📱',
  desktop: '💻',
  web: '🌐',
};

function relativeTime(dateStr) {
  if (!dateStr) return 'Never';
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

export default function DeviceCard({ device, isOwner, onRename, onRevoke }) {
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(device.name || '');
  const inputRef = useRef(null);

  const icon = TYPE_ICONS[device.type] || '📱';
  const isActive = device.status === 'active';
  const statusColor = isActive ? '#4CAF50' : '#F44336';
  const statusLabel = isActive ? 'Active' : 'Inactive';
  const lastSeen = relativeTime(device.last_synced_at);

  const handleStartEdit = () => {
    if (device.is_owner) return;
    setNameValue(device.name || '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSaveEdit = () => {
    setEditing(false);
    if (nameValue.trim() && nameValue.trim() !== device.name) {
      onRename?.(device.device_id, nameValue.trim());
    }
  };

  const handleLongPress = () => {
    if (device.is_owner) return;
    Alert.alert(
      device.name || 'Device',
      'What would you like to do?',
      [
        { text: 'Rename', onPress: handleStartEdit },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => onRevoke?.(device.device_id, device.name || 'Device'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[styles.container, device.is_owner && styles.ownerContainer]}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{icon}</Text>

      <View style={styles.info}>
        {editing ? (
          <View style={styles.editRow}>
            <TextInput
              ref={inputRef}
              style={styles.nameInput}
              value={nameValue}
              onChangeText={setNameValue}
              onBlur={handleSaveEdit}
              onSubmitEditing={handleSaveEdit}
              selectTextOnFocus
            />
            <TouchableOpacity style={styles.saveEdit} onPress={handleSaveEdit}>
              <Text style={styles.saveEditText}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.name}>{device.name || 'Unknown device'}</Text>
        )}

        <Text style={styles.meta}>
          {device.type} · Last seen: {lastSeen}
        </Text>
      </View>

      <View style={styles.badges}>
        {device.is_owner && (
          <View style={styles.ownerBadge}>
            <Text style={styles.ownerBadgeText}>You</Text>
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusBadgeText}>{statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
  ownerContainer: {
    borderColor: '#2196F3',
    borderWidth: 1,
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
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#2196F3',
    paddingVertical: 2,
  },
  saveEdit: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  saveEditText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: '#888',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2196F3',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});
