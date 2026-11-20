import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { validatePassword } from '../lib/auth-utils';
import { COLORS, Field, Logo, Notice, PrimaryButton, StrengthBar } from '../components/AuthUI';

// Сюда попадают по ссылке из письма «Забыли пароль»
export default function ResetPasswordScreen() {
  const { user, loading, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    setError(null);
    const invalid = validatePassword(password);
    if (invalid) return setError(invalid);
    if (password !== confirm) return setError('Пароли не совпадают');
    setBusy(true);
    const r = await updatePassword(password);
    setBusy(false);
    if (r.ok) setSaved(true);
    else setError(r.error || 'Не удалось сменить пароль.');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: COLORS.card, borderRadius: 22, padding: 26, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4 }}>
          <View style={{ marginBottom: 18 }}><Logo /></View>

          {loading ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginVertical: 24 }} />
          ) : saved ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>Пароль изменён</Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 18 }}>Теперь можно пользоваться сайтом с новым паролем.</Text>
              <PrimaryButton title="На главную" onPress={() => router.replace('/')} />
            </>
          ) : !user ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>Ссылка не подошла</Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 18, lineHeight: 20 }}>Ссылка для сброса пароля недействительна или устарела. Запросите новую.</Text>
              <PrimaryButton title="Запросить новую ссылку" onPress={() => router.replace('/sign-in?mode=forgot')} />
            </>
          ) : (
            <>
              <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4 }}>Новый пароль</Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 20 }}>Придумайте пароль, которым будете входить на сайт.</Text>
              {error ? <Notice kind="error" text={error} /> : null}
              <Field label="Новый пароль" value={password} onChangeText={setPassword} placeholder="Минимум 8 символов" secure autoComplete="new-password" />
              <StrengthBar password={password} />
              <Field label="Повторите пароль" value={confirm} onChangeText={setConfirm} placeholder="Ещё раз" secure autoComplete="new-password" onSubmitEditing={submit} />
              <PrimaryButton title="Сохранить пароль" onPress={submit} loading={busy} />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
