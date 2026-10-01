import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function SignInModal() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase!.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      Alert.alert('Ошибка', error.message);
    } else {
      Alert.alert('Письмо отправлено', 'Проверьте почту и перейдите по ссылке.');
      router.back();
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#121214', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Вход по Magic Link</Text>
      <Text style={{ color: '#888', marginBottom: 24 }}>Введите email, и мы отправим ссылку для входа без пароля.</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#666"
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ backgroundColor: '#1c1c22', color: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 }}
      />
      <Pressable
        onPress={handleLogin}
        disabled={loading}
        style={{ backgroundColor: '#00f2fe', padding: 16, borderRadius: 12, alignItems: 'center' }}
      >
        <Text style={{ color: '#000', fontWeight: 'bold' }}>{loading ? 'Отправка...' : 'Получить ссылку'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
