import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MusicProvider } from '../lib/music';

export default function RootLayout() {
  return (
    <MusicProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
        <Stack.Screen name="upload" options={{ presentation: 'modal' }} />
      </Stack>
    </MusicProvider>
  );
}
