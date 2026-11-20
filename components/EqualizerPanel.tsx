import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { EQ_FREQUENCIES, EQ_PRESETS, EQ_MAX_GAIN, useMusic } from '../lib/music';

const speeds = [0.5, 0.8, 1, 1.25, 1.5, 2];
const presetLabels: Record<string, string> = { Flat: 'Ровный', 'Bass Boost': 'Больше баса', Acoustic: 'Акустика', Pop: 'Поп', Rock: 'Рок', Electronic: 'Электроника' };
const backdrop = Platform.OS === 'web' ? { backdropFilter: 'blur(35px) saturate(180%)' } : {};

function Chip({ text, selected, onPress }: { text: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
    style={{ borderRadius: 15, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1,
      borderColor: selected ? '#fa6070' : 'rgba(255,255,255,0.2)', backgroundColor: selected ? 'rgba(250,35,59,0.75)' : 'rgba(255,255,255,0.10)' }}>
    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{text}</Text>
  </Pressable>;
}

export function EqualizerPanel({ close }: { close: () => void }) {
  const music = useMusic();
  const narrow = useWindowDimensions().width < 630;
  const preset = Object.entries(EQ_PRESETS).find(([, gains]) => gains.every((gain, i) => gain === music.eqGains[i]))?.[0];
  return <Modal transparent animationType="fade" onRequestClose={close}>
    <View style={{ flex: 1, backgroundColor: 'rgba(16,16,24,0.45)', padding: 14, justifyContent: 'center', alignItems: 'center' }}>
      <Pressable accessibilityElementsHidden onPress={close} style={{ position: 'absolute', inset: 0 } as any} />
      <ScrollView style={[{ width: '100%', maxWidth: 790, maxHeight: '94%', backgroundColor: 'rgba(25,25,30,0.45)',
        borderRadius: 34, borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)' }, backdrop] as any}
        contentContainerStyle={{ padding: narrow ? 16 : 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Эквалайзер</Text>
            <Text style={{ color: '#eeeef2', marginTop: 3 }}>12 полос · {preset ? presetLabels[preset] : 'Ручная настройка'}</Text>
          </View>
          <Chip text="Закрыть" onPress={close} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {Object.entries(EQ_PRESETS).map(([name, gains]) =>
            <Chip key={name} text={presetLabels[name] || name} selected={preset === name} onPress={() => music.applyPreset(gains)} />)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderRadius: 18, backgroundColor: 'rgba(18,18,26,0.35)', paddingVertical: 9 }}>
          {EQ_FREQUENCIES.map((hz, index) => {
            const value = music.eqGains[index] || 0;
            return <View key={hz} style={{ width: narrow ? '16.66%' : '8.33%', alignItems: 'center', paddingVertical: 7, gap: 5 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{value > 0 ? '+' : ''}{value} дБ</Text>
              {Platform.OS === 'web' ? <input type="range" aria-label={hz + ' Гц'} aria-valuetext={value + ' дБ'}
                min={-EQ_MAX_GAIN} max={EQ_MAX_GAIN} step={1} value={value}
                onChange={event => music.setEqGain(index, Number(event.currentTarget.value))}
                style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 26, height: narrow ? 79 : 116, accentColor: '#fa233b', cursor: 'ns-resize', margin: 0 }} />
                : <><Chip text="+" onPress={() => music.setEqGain(index, value + 1)} /><Chip text="−" onPress={() => music.setEqGain(index, value - 1)} /></>}
              <Text style={{ color: '#ededf1', fontSize: 12 }}>{hz < 1000 ? hz : hz / 1000 + 'к'}</Text>
            </View>;
          })}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <Text style={{ color: '#eeeef2', fontSize: 13 }}>Полоса регулируется от −12 до +12 дБ</Text>
          <Pressable accessibilityRole="button" onPress={music.resetEq}
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fa233b' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Сбросить эквалайзер</Text>
          </Pressable>
        </View>
        <Text style={{ color: '#eeeef2', fontSize: 13, fontWeight: '700' }}>Скорость воспроизведения</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {speeds.map(speed => <Chip key={speed} text={speed + '×'} selected={music.playbackSpeed === speed} onPress={() => music.setPlaybackSpeed(speed)} />)}
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
