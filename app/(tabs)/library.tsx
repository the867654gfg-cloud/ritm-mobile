import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useMusic } from '../../lib/music';

export default function LibraryScreen() {
  const m = useMusic();

  return (
    <View style={{ flex: 1, backgroundColor: '#121214', padding: 16, justifyContent: 'center', alignItems: 'center' }}>
      {m.session ? (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 20, marginBottom: 8 }}>Ваш аккаунт активен</Text>
          <Text style={{ color: '#888', marginBottom: 20 }}>{m.session.user.email}</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Войдите в аккаунт</Text>
          <Text style={{ color: '#888', textAlign: 'center', marginBottom: 20 }}>
            Чтобы сохранять избранные треки и создавать плейлисты.
          </Text>
          <Pressable
            onPress={() => router.push('/sign-in')}
            style={{ backgroundColor: '#00f2fe', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
          >
            <Text style={{ color: '#000', fontWeight: 'bold' }}>Войти по email</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
