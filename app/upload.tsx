import { ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, PrimaryButton } from '../components/AuthUI';
import { UploadForm } from '../components/UploadForm';
import { useAuth } from '../lib/auth';

export default function UploadScreen() {
  const { user, loading } = useAuth();
  return <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, width: '100%', maxWidth: 660, alignSelf: 'center' }}>
      <PrimaryButton title="Назад" variant="soft" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '900' }}>Публикация треков</Text>
      {!loading && !user && <PrimaryButton title="Войти для загрузки" onPress={() => router.replace('/sign-in')} />}
      {user && <UploadForm key={user.id} userId={user.id} />}
    </ScrollView>
  </SafeAreaView>;
}
