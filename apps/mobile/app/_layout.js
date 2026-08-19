import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/hooks/useAuth.js';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#fafafa' },
          headerTintColor: '#1a1a1a',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen
          name="login"
          options={{ title: 'Log In', headerShown: false }}
        />
        <Stack.Screen
          name="register"
          options={{ title: 'Create Account', headerShown: false }}
        />
        <Stack.Screen
          name="index"
          options={{ title: 'Synced Notepad' }}
        />
        <Stack.Screen
          name="settings"
          options={{ title: 'Settings' }}
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
        <Stack.Screen
          name="pairing"
          options={{ title: 'Pair Device', presentation: 'modal' }}
        />
        <Stack.Screen
          name="visibility"
          options={{ title: 'Note Visibility' }}
        />
        <Stack.Screen
          name="history"
          options={{ title: 'Audit History' }}
        />
      </Stack>
    </AuthProvider>
  );
}
