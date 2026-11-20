import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { EQ_FREQUENCIES, EQ_PRESETS, EQ_MAX_GAIN, useMusic } from '../lib/music';
import { CROSSFADE_OPTIONS } from '../lib/browser-audio';

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

type CustomPreset = { name: string; gains: number[] };
type Props = {
  close: () => void;
  saveData: boolean;
  setSaveData: (enabled: boolean) => void;
  normalization: boolean;
  setNormalization: (enabled: boolean) => void;
  crossfade: number;
  setCrossfade: (seconds: number) => void;
  keyboardHelp?: () => void;
};

export function EqualizerPanel({ close, saveData, setSaveData, normalization, setNormalization, crossfade, setCrossfade, keyboardHelp }: Props) {
  const music = useMusic();
  const narrow = useWindowDimensions().width < 630;
  const preset = Object.entries(EQ_PRESETS).find(([, gains]) => gains.every((gain, i) => gain === music.eqGains[i]))?.[0];
  const customKey = 'ritm_custom_eq_presets';
  const [custom, setCustom] = useState<CustomPreset[]>(() => {
    try {
      const values = JSON.parse(localStorage.getItem(customKey) || '[]');
      return Array.isArray(values) ? values.filter(item => typeof item?.name === 'string' &&
        Array.isArray(item.gains) && item.gains.length === EQ_FREQUENCIES.length && item.gains.every(Number.isFinite)).slice(0, 20) : [];
    } catch { return []; }
  });
  const [presetName, setPresetName] = useState('');
  const [presetNotice, setPresetNotice] = useState('');
  const [removeName, setRemoveName] = useState<string | null>(null);
  useEffect(() => {
    try { localStorage.setItem(customKey, JSON.stringify(custom)); } catch {}
  }, [custom]);

  function savePreset() {
    const name = presetName.trim();
    if (!name) return;
    const existing = custom.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (existing) { setPresetNotice('Пресет с таким именем уже есть. Введи другое имя.'); return; }
    if (custom.length >= 20) { setPresetNotice('Можно хранить до 20 своих пресетов.'); return; }
    setCustom([...custom, { name, gains: [...music.eqGains] }]);
    setPresetName('');
    setPresetNotice('Пресет сохранён.');
  }
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
        <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Мои пресеты</Text>
        {custom.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {custom.map(item => <View key={item.name} style={{ flexDirection: 'row', gap: 4 }}>
            <Chip text={item.name} selected={item.gains.every((gain, i) => gain === music.eqGains[i])} onPress={() => music.applyPreset(item.gains)} />
            <Pressable accessibilityRole="button" accessibilityLabel={'Удалить пресет ' + item.name}
              onPress={() => setRemoveName(item.name)} style={{ paddingHorizontal: 10, justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 20 }}>×</Text>
            </Pressable>
          </View>)}
        </View>}
        {removeName && <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text style={{ color: '#fff' }}>Удалить «{removeName}»?</Text>
          <Chip text="Удалить" onPress={() => { setCustom(custom.filter(item => item.name !== removeName)); setRemoveName(null); }} />
          <Chip text="Отмена" onPress={() => setRemoveName(null)} />
        </View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput value={presetName} accessibilityLabel="Название пресета" placeholder="Название пресета" placeholderTextColor="#ddd"
            maxLength={32} onChangeText={value => { setPresetName(value); setPresetNotice(''); }} onSubmitEditing={savePreset}
            style={{ flex: 1, minWidth: 0, padding: 10, borderRadius: 13, color: '#fff', backgroundColor: '#ffffff18', borderColor: '#ffffff30', borderWidth: 1 }} />
          <Chip text="Сохранить" onPress={savePreset} />
        </View>
        {!!presetNotice && <Text accessibilityLiveRegion="polite" style={{ color: '#fff' }}>{presetNotice}</Text>}
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: '#ffffff26', paddingTop: 13 }}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: normalization }} onPress={() => setNormalization(!normalization)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 7 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Ровная громкость</Text>
            <Text style={{ color: '#fff', fontWeight: '700', borderRadius: 14, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5,
              backgroundColor: normalization ? '#b02137' : '#ffffff21' }}>{normalization ? 'Вкл.' : 'Выкл.'}</Text>
          </Pressable>
          <Pressable accessibilityRole="switch" aria-checked={saveData} onPress={() => setSaveData(!saveData)}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Экономия интернета</Text>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{saveData ? 'Вкл.' : 'Выкл.'}</Text>
          </Pressable>
          <Text style={{ color: '#eeeef2', fontSize: 13 }}>Плавный переход между треками</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {CROSSFADE_OPTIONS.map(seconds => <Chip key={seconds} text={seconds ? seconds + ' с' : 'Выкл.'}
              selected={crossfade === seconds} onPress={() => setCrossfade(seconds)} />)}
          </View>
        </View>
        <Text style={{ color: '#eeeef2', fontSize: 13, fontWeight: '700' }}>Скорость воспроизведения</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {speeds.map(speed => <Chip key={speed} text={speed + '×'} selected={music.playbackSpeed === speed} onPress={() => music.setPlaybackSpeed(speed)} />)}
        </View>
        {keyboardHelp && <View style={{ alignItems: 'flex-start' }}><Chip text="Горячие клавиши" onPress={keyboardHelp} /></View>}
      </ScrollView>
    </View>
  </Modal>;
}
