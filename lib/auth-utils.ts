// Чистые функции для форм входа и регистрации: проверка полей и тексты ошибок.
// Здесь нет зависимостей от React Native и Supabase, поэтому файл легко тестировать.

// Должно совпадать с ограничением profiles_username_format в supabase/auth-setup.sql
export const USERNAME_RE = /^[A-Za-z0-9_\u0400-\u04FF]{3,20}$/;
export const PASSWORD_MIN_LENGTH = 8;

export function validateUsername(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Введите имя пользователя';
  if (v.length < 3) return 'Минимум 3 символа';
  if (v.length > 20) return 'Максимум 20 символов';
  if (!USERNAME_RE.test(v)) return 'Только буквы, цифры и знак подчёркивания';
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Введите почту';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Похоже, в адресе ошибка';
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'Введите пароль';
  if (value.length < PASSWORD_MIN_LENGTH) return `Минимум ${PASSWORD_MIN_LENGTH} символов`;
  return null;
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string };

// Простая оценка надёжности: длина и разнообразие символов. Это подсказка, а не защита.
export function passwordStrength(value: string): Strength {
  if (!value) return { score: 0, label: '' };
  let points = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) points++;
  if (value.length >= 12) points++;
  if (/[a-zа-яё]/.test(value) && /[A-ZА-ЯЁ]/.test(value)) points++;
  if (/\d/.test(value)) points++;
  if (/[^A-Za-zА-Яа-яЁё0-9]/.test(value)) points++;
  // «Надёжным» пароль считается только от 12 символов
  if (value.length < 12) points = Math.min(points, 3);
  if (/^(.)\1+$/.test(value) || /^(password|qwerty|12345678|123456789|11111111)/i.test(value)) points = Math.min(points, 1);

  const score = Math.max(1, Math.min(4, points - (value.length < PASSWORD_MIN_LENGTH ? 1 : 0))) as 1 | 2 | 3 | 4;
  const labels = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный'];
  return { score, label: labels[score] };
}

type AuthErrorLike = { message?: string; code?: string; status?: number } | string | null | undefined;

// Переводит ответы Supabase на понятный русский язык
export function mapAuthError(err: AuthErrorLike): string {
  const message = (typeof err === 'string' ? err : err?.message || '').toLowerCase();
  const code = typeof err === 'object' && err ? (err.code || '').toLowerCase() : '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) return 'Неверная почта или пароль.';
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) return 'Почта не подтверждена. Перейдите по ссылке из письма.';
  if (code === 'user_already_exists' || message.includes('already registered')) return 'Эта почта уже зарегистрирована. Попробуйте войти.';
  if (code === 'weak_password' || message.includes('password should be at least') || message.includes('weak password')) return 'Слишком простой пароль. Придумайте подлиннее.';
  if (code === 'same_password' || message.includes('different from the old password')) return 'Новый пароль должен отличаться от старого.';
  if (code === 'over_email_send_rate_limit' || message.includes('email rate limit')) return 'Отправлено слишком много писем. Подождите немного и попробуйте снова.';
  if (code === 'over_request_rate_limit' || message.includes('for security purposes') || message.includes('rate limit')) return 'Слишком часто. Подождите минуту и повторите.';
  if (code === 'signup_disabled' || message.includes('signups not allowed')) return 'Регистрация сейчас отключена.';
  if (code === 'validation_failed' || message.includes('unable to validate email')) return 'Проверьте адрес почты.';
  if (message.includes('database error saving new user')) return 'Не удалось создать профиль. Попробуйте другое имя.';
  if (message.includes('failed to fetch') || message.includes('network')) return 'Нет соединения с сервером. Проверьте интернет.';
  if (message.includes('jwt') || message.includes('session') && message.includes('missing')) return 'Сессия устарела. Войдите заново.';
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}
