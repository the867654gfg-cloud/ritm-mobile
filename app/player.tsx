import { useState } from 'react';
import { View, Text, Pressable, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMusic } from '../lib/music';
import { coverFor, time } from '../lib/music-data';

function PlayIcon({ isPlaying }: { isPlaying: boolean }) {
  if (isPlaying) {
    return (
      <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 4, height: 16, backgroundColor: '#000', borderRadius: 2 }} />
        <View style={{ width: 4, height: 16, backgroundColor: '#000', borderRadius: 2 }} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 14,
        borderRightWidth: 0,
        borderTopWidth: 9,
        borderBottomWidth: 9,
        borderLeftColor: '#000',
        borderRightColor: 'transparent',
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        marginLeft: 3,
      }}
    />
  );
}

export default function PlayerModal() {
  const m = useMusic();
  const track = m.currentTrack;

  if (!track) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#232219' }}>
      <View style={{ padding: 20, flex: 1, justifyContent: 'space-between' }}>
        {/* Шапка */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
            <Text style={{ color: '#ffe600', fontSize: 16, fontWeight: 'bold' }}>✕ Свернуть</Text>
          </Pressable>

          <Text style={{ color: '#d9d5b8', fontSize: 15, fontWeight: '600' }}>
            {m.queueTitle || 'Ритм Плеер'}
          </Text>

          <Pressable
            onPress={m.toggleEq}
            style={{ backgroundColor: m.showEq ? '#ffe600' : '#333124', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}
          >
            <Text style={{ color: m.showEq ? '#000' : '#ffe600', fontWeight: 'bold', fontSize: 12 }}>🎛️ EQ</Text>
          </Pressable>
        </View>

        {/* Обложка трека */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1b14', padding: 16, borderRadius: 20, marginVertical: 10, borderWidth: 1, borderColor: '#333125' }}>
          <Image source={coverFor(track)} style={{ width: 128, height: 128, borderRadius: 16, marginRight: 18 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: 'bold' }} numberOfLines={2}>
              {track.title}
            </Text>
            <Text style={{ color: '#a3a088', fontSize: 14, marginTop: 6 }}>
              {track.genre || 'Ритм Mobile'}
            </Text>
          </View>
        </View>

        {/* Перемотка */}
        <View style={{ marginBottom: 10 }}>
          <Pressable
            onPress={(e) => {
              if (!m.duration) return;
              let ratio = 0;
              if (Platform.OS === 'web' && e.nativeEvent) {
                const target = e.currentTarget || e.target;
                if (target && target.getBoundingClientRect) {
                  const rect = target.getBoundingClientRect();
                  const clientX = e.nativeEvent.clientX ?? e.clientX ?? 0;
                  ratio = (clientX - rect.left) / rect.width;
                }
              } else {
                const locX = e.nativeEvent?.locationX ?? 0;
                ratio = locX / 300;
              }
              ratio = Math.max(0, Math.min(1, ratio));
              m.seek(ratio * m.duration);
            }}
            style={{ height: 10, backgroundColor: '#3d3b2c', borderRadius: 5, overflow: 'hidden', justifyContent: 'center' }}
          >
            <View
              pointerEvents="none"
              style={{ width: `${Math.min(100, (m.position / Math.max(1, m.duration)) * 100)}%`, height: '100%', backgroundColor: '#ffe600' }}
            />
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={{ color: '#88856e', fontSize: 12 }}>{time(m.position)}</Text>
            <Text style={{ color: '#88856e', fontSize: 12 }}>{time(m.duration)}</Text>
          </View>
        </View>

        {/* Кнопки управления */}
        <View
          style={{
            flexDirection: 'row',
            justify: 'space-around',
            alignItems: 'center',
            backgroundColor: '#1c1b14',
            paddingVertical: 14,
            paddingHorizontal: 10,
            borderRadius: 32,
            borderWidth: 1,
            borderColor: '#383628',
          }}
        >
          <Pressable onPress={() => m.seekBy(-10)} style={{ padding: 6 }}>
            <Text style={{ color: '#ffe600', fontSize: 13, fontWeight: 'bold' }}>-10s</Text>
          </Pressable>

          <Pressable onPress={m.previous} style={{ padding: 6 }}>
            <Text style={{ color: '#d9d5b8', fontSize: 20 }}>⏮</Text>
          </Pressable>

          <Pressable
            onPress={m.togglePlay}
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#ffe600',
              justify: 'center',
              alignItems: 'center',
            }}
          >
            <PlayIcon isPlaying={m.isPlaying} />
          </Pressable>

          <Pressable onPress={m.next} style={{ padding: 6 }}>
            <Text style={{ color: '#d9d5b8', fontSize: 20 }}>⏭</Text>
          </Pressable>

          <Pressable onPress={() => m.seekBy(10)} style={{ padding: 6 }}>
            <Text style={{ color: '#ffe600', fontSize: 13, fontWeight: 'bold' }}>+10s</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
