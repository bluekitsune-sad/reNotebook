import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fafafa' },
          headerTintColor: '#1a1a1a',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Synced Notepad' }}
        />
        <Stack.Screen
          name="notes/new"
          options={{ title: 'New Note', presentation: 'modal' }}
        />
        <Stack.Screen
          name="notes/[id]"
          options={{ title: 'Edit Note' }}
        />
        <Stack.Screen
          name="devices"
          options={{ title: 'Devices' }}
        />
        <Stack.Screen
          name="conflicts"
          options={{ title: 'Conflicts' }}
        />
      </Stack>
    </>
  );
}
