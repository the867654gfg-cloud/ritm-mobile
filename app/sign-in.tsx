import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import { pickAvatar, PickedAvatar } from '../lib/avatar';
import { validateEmail, validatePassword, validateUsername } from '../lib/auth-utils';
import { AvatarPicker, COLORS, Field, Logo, Notice, PrimaryButton, StrengthBar } from '../components/AuthUI';

type Mode = 'login' | 'register' | 'forgot';
type Done = { type: 'confirm'; email: string } | { type: 'welcome'; avatarError?: string } | { type: 'reset'; email: string } | null;
type UsernameState = 'idle' | 'checking' | 'free' | 'taken';

const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function SignInScreen() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const { user, loading, signIn, signUp, resendConfirmation, requestPasswordReset, isUsernameAvailable } = useAuth();

  const [mode, setMode] = useState<Mode>(modeParam === 'register' ? 'register' : modeParam === 'forgot' ? 'forgot' : 'login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
  const [avatarNote, setAvatarNote] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [usernameState, setUsernameState] = useState<UsernameState>('idle');
  const [done, setDone] = useState<Done>(null);

  // Уже вошёл (например, открыл страницу по прямой ссылке), значит экран входа не нужен.
  // leaving не даёт этому редиректу сработать второй раз после успешного входа.
  const leaving = useRef(false);
  useEffect(() => {
    if (!loading && user && !done && !busy && !leaving.current) {
      leaving.current = true;
      router.replace('/');
    }
  }, [loading, user, done, busy]);

  // Проверка занятости имени прямо во время ввода (с паузой, чтобы не слать запрос на каждую букву)
  useEffect(() => {
    if (mode !== 'register') return;
    setUsernameState('idle');
    if (validateUsername(username)) return;
    setUsernameState('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      const free = await isUsernameAvailable(username);
      if (!cancelled) setUsernameState(free === false ? 'taken' : 'free');
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, mode, isUsernameAvailable]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setCanResend(false);
    setSubmitted(false);
    setTouched({});
    setPassword('');
    setConfirm('');
  };

  const errors = {
    username: validateUsername(username) || (usernameState === 'taken' ? 'Это имя уже занято' : null),
    email: validateEmail(email),
    password: mode === 'login' ? (password ? null : 'Введите пароль') : validatePassword(password),
    confirm: confirm === password ? null : 'Пароли не совпадают',
  };
  const shown = (k: keyof typeof errors) => (submitted || touched[k] ? errors[k] : null);
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const handlePickAvatar = async () => {
    setAvatarNote(null);
    const res = await pickAvatar();
    if (!res) return;
    if (res.error) setAvatarNote(res.error);
    else if (res.avatar) setAvatar(res.avatar);
  };

  const submit = async () => {
    if (busy) return;
    setSubmitted(true);
    setError(null);
    setInfo(null);
    setCanResend(false);

    if (mode === 'login') {
      if (errors.email || errors.password) return;
      setBusy(true);
      const r = await signIn(email, password);
      setBusy(false);
      if (!r.ok) {
        setError(r.error || 'Не удалось войти.');
        setCanResend(r.code === 'email_not_confirmed');
        return;
      }
      leaving.current = true;
      goHome();
    } else if (mode === 'register') {
      if (errors.username || errors.email || errors.password || errors.confirm) return;
      setBusy(true);
      const r = await signUp({ username, email, password, avatar: avatar?.blob });
      if (!r.ok) {
        setBusy(false);
        setError(r.error || 'Не удалось создать аккаунт.');
        return;
      }
      setDone(r.needsConfirmation ? { type: 'confirm', email: email.trim() } : { type: 'welcome', avatarError: r.avatarError });
      setBusy(false);
    } else {
      if (errors.email) return;
      setBusy(true);
      const r = await requestPasswordReset(email);
      setBusy(false);
      if (!r.ok) setError(r.error || 'Не удалось отправить письмо.');
      else setDone({ type: 'reset', email: email.trim() });
    }
  };

  const resend = async () => {
    setBusy(true);
    const r = await resendConfirmation(email);
    setBusy(false);
    if (r.ok) { setInfo('Письмо отправлено ещё раз. Проверьте почту, в том числе папку «Спам».'); setError(null); setCanResend(false); }
    else setError(r.error || 'Не удалось отправить письмо.');
  };

  const title = mode === 'login' ? 'С возвращением' : mode === 'register' ? 'Создайте аккаунт' : 'Восстановление пароля';
  const subtitle =
    mode === 'login' ? 'Войдите, чтобы загружать треки и хранить свою музыку.'
    : mode === 'register' ? 'Имя, почта и пароль. Фото по желанию.'
    : 'Укажите почту, мы отправим ссылку для создания нового пароля.';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: COLORS.card, borderRadius: 22, padding: 26,
            shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <Logo />
            <Pressable onPress={() => router.replace('/')} hitSlop={8} style={{ outlineStyle: 'none' as any }}>
              <Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: '600' }}>На главную</Text>
            </Pressable>
          </View>

          {done ? (
            <DoneCard done={done} onContinue={() => {
              if (done.type === 'welcome') { leaving.current = true; router.replace('/'); }
              else { setDone(null); switchMode('login'); }
            }} />
          ) : (
            <>
              {mode !== 'forgot' ? (
                <View style={{ flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 12, padding: 4, marginBottom: 20 }}>
                  {(['login', 'register'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => switchMode(m)}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: mode === m ? '#fff' : 'transparent', outlineStyle: 'none' as any }}
                    >
                      <Text style={{ fontWeight: '800', fontSize: 14, color: mode === m ? COLORS.accent : COLORS.muted }}>{m === 'login' ? 'Вход' : 'Регистрация'}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 4 }}>{title}</Text>
              <Text style={{ fontSize: 14, color: COLORS.muted, marginBottom: 20, lineHeight: 20 }}>{subtitle}</Text>

              {error ? <Notice kind="error" text={error} /> : null}
              {info ? <Notice kind="success" text={info} /> : null}
              {canResend ? (
                <Pressable onPress={resend} style={{ marginTop: -6, marginBottom: 14, outlineStyle: 'none' as any }}>
                  <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 13 }}>Отправить письмо с подтверждением ещё раз</Text>
                </Pressable>
              ) : null}

              {mode === 'register' ? (
                <>
                  <AvatarPicker uri={avatar?.previewUri} name={username} onPick={handlePickAvatar} onRemove={() => setAvatar(null)} />
                  {avatarNote ? <Notice kind="error" text={avatarNote} /> : null}
                  <Field
                    label="Имя пользователя"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="например, ivan_music"
                    autoComplete="username"
                    maxLength={20}
                    onBlur={touch('username')}
                    error={shown('username')}
                    hint={usernameState === 'checking' ? 'Проверяем имя…' : usernameState === 'free' ? 'Имя свободно' : '3–20 символов: буквы, цифры, _'}
                    hintColor={usernameState === 'free' ? COLORS.success : undefined}
                  />
                </>
              ) : null}

              <Field
                label="Почта"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                onBlur={touch('email')}
                error={shown('email')}
                onSubmitEditing={mode === 'forgot' ? submit : undefined}
              />

              {mode !== 'forgot' ? (
                <Field
                  label="Пароль"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'register' ? 'Минимум 8 символов' : 'Ваш пароль'}
                  secure
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  onBlur={touch('password')}
                  error={shown('password')}
                  onSubmitEditing={mode === 'login' ? submit : undefined}
                />
              ) : null}

              {mode === 'register' ? (
                <>
                  <StrengthBar password={password} />
                  <Field
                    label="Повторите пароль"
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Ещё раз"
                    secure
                    autoComplete="new-password"
                    onBlur={touch('confirm')}
                    error={shown('confirm')}
                    onSubmitEditing={submit}
                  />
                </>
              ) : null}

              {mode === 'login' ? (
                <Pressable onPress={() => switchMode('forgot')} style={{ alignSelf: 'flex-end', marginTop: -4, marginBottom: 16, outlineStyle: 'none' as any }}>
                  <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 13 }}>Забыли пароль?</Text>
                </Pressable>
              ) : (
                <View style={{ height: 6 }} />
              )}

              <PrimaryButton
                title={mode === 'login' ? 'Войти' : mode === 'register' ? 'Создать аккаунт' : 'Отправить ссылку'}
                onPress={submit}
                loading={busy}
              />

              {mode === 'forgot' ? (
                <Pressable onPress={() => switchMode('login')} style={{ alignSelf: 'center', marginTop: 16, outlineStyle: 'none' as any }}>
                  <Text style={{ color: COLORS.muted, fontWeight: '700', fontSize: 13 }}>Вернуться ко входу</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DoneCard({ done, onContinue }: { done: NonNullable<Done>; onContinue: () => void }) {
  const text =
    done.type === 'confirm' ? { title: 'Проверьте почту', body: `Мы отправили письмо на ${done.email}. Перейдите по ссылке из письма, чтобы подтвердить адрес, и затем войдите. Если письма нет, загляните в папку «Спам».`, button: 'Перейти ко входу' }
    : done.type === 'reset' ? { title: 'Письмо отправлено', body: `Если адрес ${done.email} зарегистрирован, на него придёт ссылка для создания нового пароля.`, button: 'Вернуться ко входу' }
    : { title: 'Добро пожаловать!', body: 'Аккаунт создан, вы уже вошли.', button: 'Начать слушать' };
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(31,157,85,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 30, color: COLORS.success, fontWeight: '800' }}>✓</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 }}>{text.title}</Text>
      <Text style={{ fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 21, marginBottom: 18 }}>{text.body}</Text>
      {done.type === 'welcome' && done.avatarError ? <Notice kind="error" text={`Фото не загрузилось: ${done.avatarError} Добавить его можно позже в профиле.`} /> : null}
      <View style={{ alignSelf: 'stretch' }}>
        <PrimaryButton title={text.button} onPress={onContinue} />
      </View>
    </View>
  );
}
