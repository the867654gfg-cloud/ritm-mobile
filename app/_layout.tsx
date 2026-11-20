import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { MusicProvider } from '../lib/music';
import { useEffect } from 'react';
import { registerOfflineShell } from '../lib/offline';

export default function RootLayout() {
  useEffect(registerOfflineShell, []);
  return (
    <AuthProvider>
      <MusicProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
          <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
        </Stack>
      </MusicProvider>
    </AuthProvider>
  );
}
