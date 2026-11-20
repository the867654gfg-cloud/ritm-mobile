import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

type Props = {
  title: string;
  artist?: string;
  cover: ReactNode;
  time: number;
  duration: number;
  playing: boolean;
  shuffle: boolean;
  repeat: boolean;
  seek: (time: number) => void;
  close: () => void;
  kiosk?: boolean;
  kioskAction?: () => void;
  previous: () => void;
  next: () => void;
  togglePlay: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  equalizer: () => void;
  icon: (name: string, size: number, color: string) => ReactNode;
};

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
}

export function FullPlayer(props: Props) {
  const { width, height } = useWindowDimensions();
  const artSize = Math.min(width - 48, 420, Math.max(145, height - 375));
  const buttonSize = props.kiosk ? 64 : 46;
  const position = Math.min(props.time, Math.max(0, props.duration));

  function control(label: string, name: string, action: () => void, size: number, selected?: boolean) {
    const primary = name === 'play' || name === 'pause';
    return <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }} onPress={action}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: primary ? '#fa233b' : selected ? '#622533' : '#ffffff13', borderWidth: 1, borderColor: selected ? '#fa5468' : '#ffffff22' }}>
      {props.icon(name, primary ? 29 : 19, '#fff')}
    </Pressable>;
  }

  const safeArea = Platform.OS === 'web' ? {
    paddingTop: 'max(14px, env(safe-area-inset-top))',
    paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
  } : { paddingVertical: 18 };

  return <Modal animationType="fade" onRequestClose={props.close}>
    <View style={{ flex: 1, backgroundColor: '#18181f' }}>
      {Platform.OS === 'web' && <View pointerEvents="none" style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
        backgroundImage: 'radial-gradient(ellipse at 48% 17%, #56303d 0%, #292631 44%, #18181f 77%)',
      } as any} />}
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}>
        <View style={[{ width: '100%', maxWidth: 525, paddingHorizontal: 24, alignItems: 'center', gap: 17 }, safeArea] as any}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Text accessibilityRole="header" style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Сейчас играет</Text>
            {props.kiosk ? <Pressable accessibilityRole="button" onPress={props.kioskAction}><Text style={{ color: '#fff', padding: 12 }}>Выйти из киоска</Text></Pressable> : control('Свернуть плеер', 'close', props.close, 44)}
          </View>
          <View style={{ width: artSize, height: artSize, borderRadius: 27, overflow: 'hidden', backgroundColor: '#33313a' }}>
            {props.cover}
          </View>
          <View style={{ width: '100%', gap: 4 }}>
            <Text numberOfLines={2} style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{props.title}</Text>
            {!!props.artist && <Text numberOfLines={1} style={{ color: '#c9c5cf', fontSize: 15 }}>{props.artist}</Text>}
          </View>
          <View style={{ width: '100%' }}>
            {Platform.OS === 'web' && <input type="range" aria-label="Позиция воспроизведения"
              aria-valuetext={clock(position)} min={0} max={props.duration || 1} step={0.1} value={position}
              disabled={!props.duration} onChange={event => props.seek(Number(event.currentTarget.value))}
              style={{ width: '100%', height: 28, margin: 0, accentColor: '#fa233b', cursor: 'pointer' }} />}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#e5e0ea', fontVariant: ['tabular-nums'] }}>{clock(position)}</Text>
              <Text style={{ color: '#e5e0ea', fontVariant: ['tabular-nums'] }}>{clock(props.duration)}</Text>
            </View>
          </View>
          <View style={{ width: '100%', maxWidth: 350, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {!props.kiosk && control('Перемешать', 'shuffle', props.toggleShuffle, 43, props.shuffle)}
            {control('Предыдущий трек', 'play-skip-back', props.previous, buttonSize)}
            {control(props.playing ? 'Пауза' : 'Воспроизвести', props.playing ? 'pause' : 'play', props.togglePlay, props.kiosk ? 86 : 65)}
            {control('Следующий трек', 'play-skip-forward', props.next, buttonSize)}
            {!props.kiosk && control('Повтор трека', 'repeat', props.toggleRepeat, 43, props.repeat)}
          </View>
          {!props.kiosk && <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable accessibilityRole="button" onPress={props.equalizer}
              style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#ffffff13' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Эквалайзер</Text>
            </Pressable>
            {props.kioskAction && <Pressable accessibilityRole="button" onPress={props.kioskAction} style={{ padding: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Режим киоска</Text>
            </Pressable>}
          </View>}
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
