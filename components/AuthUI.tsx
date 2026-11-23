import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Image, TextInputProps } from 'react-native';
import { passwordStrength } from '../lib/auth-utils';

// Цвета совпадают со стилем каталога (светлая тема, акцент #fa233b)
export const COLORS = {
  accent: '#fa233b',
  accentSoft: 'rgba(250, 35, 59, 0.1)',
  bg: '#f2f2f7',
  card: '#ffffff',
  text: '#1c1c1e',
  muted: '#8e8e93',
  border: '#e5e5ea',
  danger: '#d70015',
  success: '#1f9d55',
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  error?: string | null;
  hint?: string;
  hintColor?: string;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  editable?: boolean;
};

export function Field({
  label, value, onChangeText, placeholder, secure, keyboardType, autoComplete, autoCapitalize = 'none',
  maxLength, error, hint, hintColor, onBlur, onSubmitEditing, editable = true,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 }}>{label}</Text>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', backgroundColor: editable ? '#fff' : '#f7f7fa', borderRadius: 12, borderWidth: 1.5,
          borderColor: error ? COLORS.danger : focused ? COLORS.accent : COLORS.border,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#b0b0b8"
          secureTextEntry={!!secure && !visible}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          onSubmitEditing={onSubmitEditing}
          style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 14, fontSize: 16, color: COLORS.text, outlineStyle: 'none' as any }}
        />
        {secure ? (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} style={{ paddingHorizontal: 14 }}>
            <Text style={{ color: COLORS.muted, fontSize: 13, fontWeight: '600' }}>{visible ? 'Скрыть' : 'Показать'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={{ color: COLORS.danger, fontSize: 12, marginTop: 5 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: hintColor || COLORS.muted, fontSize: 12, marginTop: 5 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  title, onPress, loading, disabled, variant = 'solid',
}: { title: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'solid' | 'soft' | 'danger-outline' }) {
  const off = loading || disabled;
  const styles = {
    solid: { bg: COLORS.accent, fg: '#fff', border: 'transparent' },
    soft: { bg: COLORS.accentSoft, fg: COLORS.accent, border: 'transparent' },
    'danger-outline': { bg: 'transparent', fg: COLORS.danger, border: COLORS.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ busy: loading, disabled: !!off }} disabled={!!off}
      onPress={onPress}
      style={{
        backgroundColor: styles.bg, borderColor: styles.border, borderWidth: 1.5, paddingVertical: 14, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: off ? 0.55 : 1, outlineStyle: 'none' as any,
      }}
    >
      {loading ? <ActivityIndicator size="small" color={styles.fg} /> : null}
      <Text style={{ color: styles.fg, fontWeight: '800', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Notice({ kind, text }: { kind: 'error' | 'success' | 'info'; text: string }) {
  const c = { error: [COLORS.danger, 'rgba(215,0,21,0.08)'], success: [COLORS.success, 'rgba(31,157,85,0.1)'], info: [COLORS.muted, '#f2f2f7'] }[kind];
  return (
    <View style={{ backgroundColor: c[1], borderRadius: 10, padding: 12, marginBottom: 14 }}>
      <Text style={{ color: c[0], fontSize: 13, lineHeight: 18, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const AVATAR_COLORS = ['#fa233b', '#ff9500', '#34c759', '#0a84ff', '#af52de', '#5e5ce6'];

// Круглый аватар. Если фото нет или оно не загрузилось, показывается первая буква имени.
export function AvatarCircle({ uri, name, size = 40, ring = false }: { uri?: string | null; name?: string; size?: number; ring?: boolean }) {
  const [failed, setFailed] = useState(false);
  const base = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = ring ? { borderWidth: 1.5, borderColor: COLORS.accent } : {};
  if (uri && !failed) {
    return <Image source={{ uri }} onError={() => setFailed(true)} style={[base, ringStyle, { backgroundColor: COLORS.border }]} />;
  }
  const label = (name || '?').trim();
  const hash = [...label].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return (
    <View style={[base, ringStyle, { backgroundColor: AVATAR_COLORS[hash % AVATAR_COLORS.length], alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{label.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export function AvatarPicker({
  uri, name, onPick, onRemove, busy, caption,
}: { uri?: string | null; name?: string; onPick: () => void; onRemove?: () => void; busy?: boolean; caption?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 }}>
      <Pressable onPress={busy ? undefined : onPick} style={{ outlineStyle: 'none' as any }}>
        <AvatarCircle uri={uri} name={name} size={76} />
        {busy ? (
          <View style={{ position: 'absolute', inset: 0, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' } as any}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        ) : null}
      </Pressable>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={busy ? undefined : onPick} style={{ backgroundColor: COLORS.accentSoft, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, outlineStyle: 'none' as any }}>
            <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 13 }}>{uri ? 'Изменить фото' : 'Выбрать фото'}</Text>
          </Pressable>
          {uri && onRemove ? (
            <Pressable onPress={busy ? undefined : onRemove} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, outlineStyle: 'none' as any }}>
              <Text style={{ color: COLORS.muted, fontWeight: '600', fontSize: 13 }}>Убрать</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>{caption || 'JPG, PNG или WebP. Фото обрежется до квадрата.'}</Text>
      </View>
    </View>
  );
}

export function StrengthBar({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  const color = ['#d1d1d6', '#ff3b30', '#ff9500', '#34c759', '#1f9d55'][score];
  return (
    <View style={{ marginTop: -6, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= score ? color : '#e5e5ea' }} />
        ))}
      </View>
      <Text style={{ color, fontSize: 12, marginTop: 4, fontWeight: '600' }}>Надёжность: {label}</Text>
    </View>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Text style={{ fontSize: size, fontWeight: '900', color: '#000', letterSpacing: -0.5 }}>
      Ритм<Text style={{ color: COLORS.accent }}>.</Text>
    </Text>
  );
}
