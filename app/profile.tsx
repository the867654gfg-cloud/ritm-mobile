import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { CreatorStats } from '../components/CreatorStats';
import { pickAvatar } from '../lib/avatar';
import { validatePassword, validateUsername } from '../lib/auth-utils';
import { AvatarPicker, COLORS, Field, Notice, PrimaryButton, StrengthBar } from '../components/AuthUI';

type Msg = { kind: 'error' | 'success'; text: string } | null;

export default function ProfileScreen() {
  const { user, profile, loading, signOut, updateUsername, updateAvatar, removeAvatar, updatePassword, isUsernameAvailable } = useAuth();

  const [name, setName] = useState('');
  const [nameState, setNameState] = useState<'idle' | 'checking' | 'free' | 'taken'>('idle');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<Msg>(null);
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => { if (profile) setName(profile.username); }, [profile?.username]);

  const nameChanged = !!profile && name.trim() !== profile.username;
  const nameError = nameChanged ? validateUsername(name) || (nameState === 'taken' ? 'Это имя уже занято' : null) : null;

  // Живая проверка нового имени (своё имя в другом регистре занятым не считается)
  useEffect(() => {
    setNameState('idle');
    if (!profile || !nameChanged || validateUsername(name)) return;
    if (name.trim().toLowerCase() === profile.username.toLowerCase()) return;
    setNameState('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      const free = await isUsernameAvailable(name);
      if (!cancelled) setNameState(free === false ? 'taken' : 'free');
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [name, profile?.username]);

  if (loading) return <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center' }}><ActivityIndicator color={COLORS.accent} /></View>;
  if (!user) return <Redirect href="/sign-in" />;

  const username = profile?.username ?? '';

  const changeAvatar = async () => {
    setAvatarMsg(null);
    const picked = await pickAvatar();
    if (!picked) return;
    if (picked.error || !picked.avatar) return setAvatarMsg({ kind: 'error', text: picked.error || 'Не удалось выбрать фото.' });
    setAvatarBusy(true);
    const r = await updateAvatar(picked.avatar.blob);
    setAvatarBusy(false);
    setAvatarMsg(r.ok ? { kind: 'success', text: 'Фото обновлено.' } : { kind: 'error', text: r.error || 'Не удалось загрузить фото.' });
  };

  const dropAvatar = async () => {
    setAvatarMsg(null);
    setAvatarBusy(true);
    const r = await removeAvatar();
    setAvatarBusy(false);
    setAvatarMsg(r.ok ? { kind: 'success', text: 'Фото удалено.' } : { kind: 'error', text: r.error || 'Не удалось удалить фото.' });
  };

  const saveName = async () => {
    setNameMsg(null);
    setNameBusy(true);
    const r = await updateUsername(name);
    setNameBusy(false);
    setNameMsg(r.ok ? { kind: 'success', text: 'Имя сохранено.' } : { kind: 'error', text: r.error || 'Не удалось сохранить имя.' });
  };

  const savePassword = async () => {
    setPwMsg(null);
    const invalid = validatePassword(password);
    if (invalid) return setPwMsg({ kind: 'error', text: invalid });
    if (password !== confirm) return setPwMsg({ kind: 'error', text: 'Пароли не совпадают' });
    setPwBusy(true);
    const r = await updatePassword(password);
    setPwBusy(false);
    if (r.ok) { setPwMsg({ kind: 'success', text: 'Пароль изменён.' }); setPassword(''); setConfirm(''); }
    else setPwMsg({ kind: 'error', text: r.error || 'Не удалось сменить пароль.' });
  };

  const logout = async () => {
    await signOut();
    router.replace('/');
  };

  const card = { backgroundColor: COLORS.card, borderRadius: 18, padding: 22, marginBottom: 16 } as const;
  const heading = { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 14 } as const;

  return (
    <SafeAreaView nativeID="ritm-profile" style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={8} style={{ outlineStyle: 'none' as any }}>
              <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 15 }}>← Назад</Text>
            </Pressable>
            <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text }}>Профиль</Text>
            <View style={{ width: 56 }} />
          </View>

          <View style={card}>
            <Text style={heading}>Фото</Text>
            {avatarMsg ? <Notice kind={avatarMsg.kind} text={avatarMsg.text} /> : null}
            <AvatarPicker uri={profile?.avatar_url} name={username} onPick={changeAvatar} onRemove={dropAvatar} busy={avatarBusy} />
          </View>

          <View style={card}>
            <Text style={heading}>Имя пользователя</Text>
            {nameMsg ? <Notice kind={nameMsg.kind} text={nameMsg.text} /> : null}
            <Field
              label="Имя"
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoComplete="username"
              error={nameError}
              hint={nameState === 'checking' ? 'Проверяем имя…' : nameState === 'free' ? 'Имя свободно' : '3–20 символов: буквы, цифры, _'}
              hintColor={nameState === 'free' ? COLORS.success : undefined}
              onSubmitEditing={nameChanged && !nameError ? saveName : undefined}
            />
            <PrimaryButton title="Сохранить имя" onPress={saveName} loading={nameBusy} disabled={!nameChanged || !!nameError || nameState === 'checking'} />
          </View>

          <View style={card}>
            <Text style={heading}>Почта</Text>
            <Field label="Адрес для входа" value={user.email ?? ''} onChangeText={() => {}} editable={false} />
          </View>

          <View style={card}>
            <Text style={heading}>Сменить пароль</Text>
            {pwMsg ? <Notice kind={pwMsg.kind} text={pwMsg.text} /> : null}
            <Field label="Новый пароль" value={password} onChangeText={setPassword} placeholder="Минимум 8 символов" secure autoComplete="new-password" />
            <StrengthBar password={password} />
            <Field label="Повторите пароль" value={confirm} onChangeText={setConfirm} placeholder="Ещё раз" secure autoComplete="new-password" onSubmitEditing={savePassword} />
            <PrimaryButton title="Сменить пароль" onPress={savePassword} loading={pwBusy} disabled={!password} variant="soft" />
          </View>

          <CreatorStats userId={user.id} />
          <PrimaryButton title="Выйти из аккаунта" onPress={logout} variant="danger-outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
