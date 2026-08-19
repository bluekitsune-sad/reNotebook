import { View, Text, Switch, StyleSheet } from 'react-native';

const TYPE_ICONS = {
  mobile: '📱',
  desktop: '💻',
  web: '🌐',
};

export default function VisibilityToggle({ device, visible, onToggle }) {
  const icon = TYPE_ICONS[device.type] || '📱';

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{device.name || 'Unknown device'}</Text>
        <Text style={styles.type}>{device.type}</Text>
      </View>
      <Switch
        value={visible}
        onValueChange={onToggle}
        trackColor={{ false: '#ccc', true: '#81C784' }}
        thumbColor={visible ? '#4CAF50' : '#f4f3f4'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    gap: 10,
  },
  icon: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  type: {
    fontSize: 12,
    color: '#999',
  },
});
