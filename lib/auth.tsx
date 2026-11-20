import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, INITIAL_URL_HASH } from './supabase';
import { mapAuthError, validateUsername, validatePassword, validateEmail } from './auth-utils';
import { removeAvatarFile, savePendingAvatar, takePendingAvatar, uploadAvatar } from './avatar';

export type Profile = { id: string; username: string; avatar_url: string | null };

export type AuthResult = {
  ok: boolean;
  error?: string;
  code?: string;
  /** После регистрации нужно подтвердить почту (в Supabase включено подтверждение) */
  needsConfirmation?: boolean;
  /** Аккаунт создан, но фото загрузить не удалось */
  avatarError?: string;
};

type AuthContextType = {
  /** true, пока восстанавливается сохранённая сессия */
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signUp: (input: { username: string; email: string; password: string; avatar?: Blob | null }) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  updateUsername: (username: string) => Promise<AuthResult>;
  updateAvatar: (blob: Blob) => Promise<AuthResult>;
  removeAvatar: () => Promise<AuthResult>;
  /** true — свободно, false — занято, null — проверить не удалось */
  isUsernameAvailable: (username: string) => Promise<boolean | null>;
};

const NO_BACKEND = 'Сервис недоступен: не заданы ключи Supabase.';
const AuthContext = createContext<AuthContextType | null>(null);

// Куда вернуть пользователя после перехода по ссылке из письма (с учётом baseUrl на GitHub Pages)
function siteUrl(): string | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return window.location.origin + (Constants.expoConfig?.experiments?.baseUrl ?? '') + '/';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const user = session?.user ?? null;

  const loadProfile = useCallback(async (u: User) => {
    if (!supabase) return;
    const { data, error } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', u.id).maybeSingle();
    if (!error && data) {
      setProfile(data as Profile);
      return;
    }
    // Запасной вариант, пока таблица profiles не создана: берём данные из метаданных аккаунта
    setProfile({
      id: u.id,
      username: u.user_metadata?.username || u.email?.split('@')[0] || 'Пользователь',
      avatar_url: u.user_metadata?.avatar_url ?? null,
    });
  }, []);

  const saveAvatarUrl = useCallback(async (userId: string, url: string | null, fallbackName: string) => {
    if (!supabase) return;
    // upsert, чтобы работало и для старых аккаунтов, у которых строки в profiles ещё нет
    const { error } = await supabase.from('profiles').upsert({ id: userId, username: fallbackName, avatar_url: url }, { onConflict: 'id', ignoreDuplicates: false });
    if (error) throw error;
    await supabase.auth.updateUser({ data: { avatar_url: url } });
    setProfile((p) => (p ? { ...p, avatar_url: url } : p));
  }, []);

  // Аватарка, выбранная при регистрации, пока почта не была подтверждена
  const applyPendingAvatar = useCallback(async (u: User) => {
    const blob = await takePendingAvatar(u.email);
    if (!blob) return;
    try {
      const url = await uploadAvatar(u.id, blob);
      const name = u.user_metadata?.username || `user_${u.id.replace(/-/g, '').slice(0, 8)}`;
      // username берём актуальный из профиля, чтобы upsert не перезаписал его
      const { data } = await supabase!.from('profiles').select('username').eq('id', u.id).maybeSingle();
      await saveAvatarUrl(u.id, url, data?.username ?? name);
    } catch (e) {
      console.warn('Не удалось загрузить ожидавшую аватарку', e);
    }
  }, [saveAvatarUrl]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) {
        await loadProfile(data.session.user);
        await applyPendingAvatar(data.session.user);
        // Пользователь пришёл по ссылке «Забыли пароль»: показываем форму нового пароля
        if (INITIAL_URL_HASH.includes('type=recovery')) {
          try { router.replace('/reset-password'); } catch {}
        }
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'INITIAL_SESSION') return; // это уже обработал getSession выше
      setSession(next);
      if (!next?.user) {
        setProfile(null);
        return;
      }
      // Внутри этого обработчика нельзя напрямую обращаться к Supabase (возможна взаимная блокировка), поэтому откладываем
      setTimeout(async () => {
        if (event === 'PASSWORD_RECOVERY') {
          try { router.replace('/reset-password'); } catch {}
        }
        await loadProfile(next.user);
        if (event === 'SIGNED_IN') await applyPendingAvatar(next.user);
      }, 0);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, applyPendingAvatar]);

  const isUsernameAvailable = useCallback(async (username: string): Promise<boolean | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.rpc('username_available', { name: username.trim() });
    if (error || typeof data !== 'boolean') return null; // функции нет или сбой: окончательно решит база
    return data;
  }, []);

  const signUp: AuthContextType['signUp'] = async ({ username, email, password, avatar }) => {
    if (!supabase) return { ok: false, error: NO_BACKEND };
    const invalid = validateUsername(username) || validateEmail(email) || validatePassword(password);
    if (invalid) return { ok: false, error: invalid };

    const free = await isUsernameAvailable(username);
    if (free === false) return { ok: false, error: 'Это имя уже занято.' };

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim() }, emailRedirectTo: siteUrl() },
    });
    if (error) return { ok: false, error: mapAuthError(error), code: error.code };

    // Если подтверждение почты включено, для уже существующего адреса Supabase не возвращает ошибку,
    // а отдаёт пользователя без identities (так скрывается, зарегистрирована ли почта)
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return { ok: false, error: 'Эта почта уже зарегистрирована. Попробуйте войти.' };
    }

    if (data.session && data.user) {
      // Подтверждение почты отключено: пользователь уже вошёл
      let avatarError: string | undefined;
      if (avatar) {
        try {
          const url = await uploadAvatar(data.user.id, avatar);
          await saveAvatarUrl(data.user.id, url, username.trim());
        } catch (e: any) {
          avatarError = mapAvatarError(e);
        }
      }
      return { ok: true, needsConfirmation: false, avatarError };
    }

    // Нужно подтвердить почту: запоминаем фото и загрузим его при первом входе
    if (avatar) await savePendingAvatar(email, avatar);
    return { ok: true, needsConfirmation: true };
  };

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    if (!supabase) return { ok: false, error: NO_BACKEND };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: mapAuthError(error), code: error.code };
    return { ok: true };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  };

  const resendConfirmation: AuthContextType['resendConfirmation'] = async (email) => {
    if (!supabase) return { ok: false, error: NO_BACKEND };
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: siteUrl() } });
    return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
  };

  const requestPasswordReset: AuthContextType['requestPasswordReset'] = async (email) => {
    if (!supabase) return { ok: false, error: NO_BACKEND };
    const emailError = validateEmail(email);
    if (emailError) return { ok: false, error: emailError };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: siteUrl() });
    return error ? { ok: false, error: mapAuthError(error) } : { ok: true };
  };

  const updatePassword: AuthContextType['updatePassword'] = async (password) => {
    if (!supabase) return { ok: false, error: NO_BACKEND };
    const invalid = validatePassword(password);
    if (invalid) return { ok: false, error: invalid };
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { ok: false, error: mapAuthError(error), code: error.code } : { ok: true };
  };

  const updateUsername: AuthContextType['updateUsername'] = async (username) => {
    if (!supabase || !user) return { ok: false, error: NO_BACKEND };
    const name = username.trim();
    const invalid = validateUsername(name);
    if (invalid) return { ok: false, error: invalid };
    if (profile && profile.username === name) return { ok: true };

    // Смена только регистра в собственном имени ("ivan" -> "Ivan") не считается занятым именем
    const sameNameDifferentCase = profile?.username.toLowerCase() === name.toLowerCase();
    if (!sameNameDifferentCase && (await isUsernameAvailable(name)) === false) return { ok: false, error: 'Это имя уже занято.' };

    const { error } = await supabase.from('profiles').upsert({ id: user.id, username: name, avatar_url: profile?.avatar_url ?? null }, { onConflict: 'id' });
    if (error) {
      return { ok: false, error: error.code === '23505' ? 'Это имя уже занято.' : 'Не удалось сохранить имя. Проверьте, что в Supabase выполнен скрипт auth-setup.sql.' };
    }
    await supabase.auth.updateUser({ data: { username: name } });
    setProfile((p) => (p ? { ...p, username: name } : p));
    return { ok: true };
  };

  const updateAvatar: AuthContextType['updateAvatar'] = async (blob) => {
    if (!user) return { ok: false, error: 'Сначала войдите в аккаунт.' };
    try {
      const url = await uploadAvatar(user.id, blob);
      await saveAvatarUrl(user.id, url, profile?.username ?? `user_${user.id.replace(/-/g, '').slice(0, 8)}`);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: mapAvatarError(e) };
    }
  };

  const removeAvatar: AuthContextType['removeAvatar'] = async () => {
    if (!user) return { ok: false, error: 'Сначала войдите в аккаунт.' };
    try {
      await removeAvatarFile(user.id);
      await saveAvatarUrl(user.id, null, profile?.username ?? `user_${user.id.replace(/-/g, '').slice(0, 8)}`);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: mapAvatarError(e) };
    }
  };

  return (
    <AuthContext.Provider
      value={{ loading, session, user, profile, signUp, signIn, signOut, resendConfirmation, requestPasswordReset, updatePassword, updateUsername, updateAvatar, removeAvatar, isUsernameAvailable }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function mapAvatarError(e: any): string {
  const msg = String(e?.message || '').toLowerCase();
  if (msg.includes('schema cache') || msg.includes('relation') || msg.includes('profiles')) return 'Таблица профилей не создана. Выполните скрипт auth-setup.sql в Supabase.';
  if (msg.includes('bucket not found')) return 'Не найдено хранилище аватарок. Выполните скрипт auth-setup.sql в Supabase.';
  if (msg.includes('row-level security') || msg.includes('not allowed') || msg.includes('unauthorized')) return 'Нет прав на загрузку. Проверьте политики из auth-setup.sql.';
  if (msg.includes('mime') || msg.includes('type')) return 'Этот формат не поддерживается. Используйте JPG, PNG или WebP.';
  if (msg.includes('size') || msg.includes('too large') || msg.includes('exceeded')) return 'Файл слишком большой.';
  return 'Не удалось загрузить фото. Попробуйте ещё раз.';
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth нужно вызывать внутри <AuthProvider>');
  return ctx;
}
