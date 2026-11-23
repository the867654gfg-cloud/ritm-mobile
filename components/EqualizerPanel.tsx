import { playerPanel, playerPanelFrame } from '../lib/player-panel';
import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { EQ_FREQUENCIES, EQ_PRESETS, EQ_MAX_GAIN, useMusic } from '../lib/music';
import { CROSSFADE_OPTIONS } from '../lib/browser-audio';

const speeds = [1, 0.5, 0.8, 1.25, 1.5, 2];
const presetLabels: Record<string, string> = { Flat: 'Ровный', 'Bass Boost': 'Больше баса', Acoustic: 'Акустика', Pop: 'Поп', Rock: 'Рок', Electronic: 'Электроника', Treble: 'Больше верхов', Presence: 'Больше верхов и середины', Vocals: 'Вокал вперёд', Soft: 'Мягкий звук' };

type Props = {
  close: () => void;
  normalization: boolean;
  setNormalization: (enabled: boolean) => void;
  crossfade: number;
  setCrossfade: (seconds: number) => void;
};

export function EqualizerPanel({ close, normalization, setNormalization, crossfade, setCrossfade }: Props) {
  const music = useMusic();
  const { width, height } = useWindowDimensions();
  const dark = useColorScheme() === 'dark';
  const { surface, border, muted, text, selected: pill } = playerPanel(dark);
  const panelBottom = (width < 780 ? 126 : 90) + 30;
  const playerWidth = Math.min(width * 0.96, 920);
  const preset = Object.entries(EQ_PRESETS).find(([, gains]) => gains.every((gain, i) => gain === music.eqGains[i]))?.[0];

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) close(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [close]);

  const chip = (label: string, onPress: () => void, selected = false, disabled = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected, disabled }}
      disabled={disabled} onPress={onPress} style={{
        minHeight: 36, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 9,
        backgroundColor: selected ? '#c91635' : pill,
      }}>
      <Text style={{ color: selected ? '#fff' : disabled ? muted : text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View accessibilityLabel="Настройки звука" style={{
      position: 'absolute', zIndex: 150, width: Math.min(218, width - 24),
      right: Math.max(12, (width - playerWidth) / 2), bottom: panelBottom,
      maxHeight: Math.max(0, Math.min(450, height - panelBottom - 12)),
      ...playerPanelFrame, backgroundColor: surface, borderColor: border, padding: 12, gap: 10, elevation: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: text, fontSize: 17, fontWeight: '800' }}>Эквалайзер</Text>
        <Switch accessibilityLabel="Включить эквалайзер" value={music.eqEnabled} onValueChange={music.setEqEnabled}
          trackColor={{ true: '#fa233b', false: border }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть эквалайзер" onPress={close} style={{ padding: 5 }}>
          <Ionicons name="close" color={muted} size={20} />
        </Pressable>
      </View>
      <ScrollView horizontal accessibilityLabel="Пресеты эквалайзера" showsHorizontalScrollIndicator
        style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 7, paddingBottom: 5 }}>
        {Object.entries(EQ_PRESETS).map(([name, gains]) =>
          chip(presetLabels[name] || name, () => music.applyPreset(gains), music.eqEnabled && preset === name, !music.eqEnabled))}
      </ScrollView>
      <ScrollView accessibilityLabel="Полосы частот и дополнительные настройки" style={{ flexGrow: 0, flexShrink: 1 }}
        contentContainerStyle={{ gap: 4, paddingBottom: 4 }} nestedScrollEnabled>
        {EQ_FREQUENCIES.map((hz, index) => {
          const gain = music.eqGains[index] ?? 0;
          return (
            <View key={hz} style={{ minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ color: muted, fontSize: 11, width: 42 }}>{hz < 1000 ? hz + ' Гц' : hz / 1000 + ' кГц'}</Text>
              {Platform.OS === 'web' ? (
                <input type="range" aria-label={hz + ' Гц'} aria-valuetext={gain + ' дБ'}
                  min={-EQ_MAX_GAIN} max={EQ_MAX_GAIN} step={1} value={gain} disabled={!music.eqEnabled}
                  onChange={event => music.setEqGain(index, Number(event.currentTarget.value))}
                  style={{ flex: 1, minWidth: 0, margin: 0, accentColor: '#fa233b' }} />
              ) : <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
                {chip('−', () => music.setEqGain(index, gain - 1), false, !music.eqEnabled)}
                {chip('+', () => music.setEqGain(index, gain + 1), false, !music.eqEnabled)}
              </View>}
              <Text style={{ color: muted, width: 35, textAlign: 'right', fontSize: 10 }}>{gain > 0 ? '+' : ''}{gain} дБ</Text>
            </View>
          );
        })}
        {chip('Сбросить эквалайзер', music.resetEq)}
        <View style={{ borderTopWidth: 1, borderColor: border, paddingTop: 8, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: text, fontSize: 12 }}>Ровная громкость</Text>
            <Switch accessibilityLabel="Ровная громкость" value={normalization} onValueChange={setNormalization} />
          </View>
          <Text style={{ color: text, fontSize: 12 }}>Плавный переход</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CROSSFADE_OPTIONS.map(seconds => chip(seconds ? seconds + ' с' : 'Выкл.', () => setCrossfade(seconds), crossfade === seconds))}
          </View>
        </View>
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderColor: border, paddingTop: 8, gap: 7 }}>
        <Text style={{ color: text, fontSize: 13, fontWeight: '700' }}>Скорость</Text>
        <ScrollView horizontal accessibilityLabel="Скорость воспроизведения" showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 6 }}>
          {speeds.map(speed => chip(speed + '×', () => music.setPlaybackSpeed(speed), music.playbackSpeed === speed))}
        </ScrollView>
      </View>
    </View>
  );
}
