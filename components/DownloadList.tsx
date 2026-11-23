import { searchQueries } from '../lib/search-layout';
import { searchScore } from '../lib/catalog-search';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import type { Track } from '../lib/music-data';
import { bytesLabel, qualityLabel, type SavedTrack, type Transfer } from '../lib/download-status';

export function DownloadList({ tracks, transfers, query, play, remove, cancel, retry }: {
  tracks: SavedTrack[]; transfers: Transfer[]; query: string; play: (track: Track) => void;
  remove: (track: Track) => void; cancel: (id: string) => void; retry: (transfer: Transfer) => void;
}) {
  const text = useColorScheme() === 'dark' ? '#fff' : '#18181a';
  const queries = searchQueries(query);
  const matches = tracks.filter(track => !queries.length || queries.some(term => searchScore(term, track.title, track.artist) > 0));
  if (!tracks.length && !transfers.length) return null;
  const storedBytes = tracks.reduce((sum, track) => sum + (track.downloadedBytes ?? 0), 0);
  const measured = tracks.some(track => track.downloadedBytes !== undefined);
  const incompleteTotal = measured && tracks.some(track => track.downloadedBytes === undefined);
  return <View style={{ gap: 8, marginBottom: 14 }}>
    <Text accessibilityRole="header" style={{ fontWeight: '800', color: text }}>Скачанные</Text>
    {measured && <Text style={{ color: text, opacity: 0.7 }}>{(incompleteTotal ? 'Учтено не менее ' : 'Занято ') + bytesLabel(storedBytes)}</Text>}
    {transfers.map(item => {
      const progress = item.total ? Math.min(100, Math.floor(item.received / item.total * 100)) : undefined;
      return <View key={item.track.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: text }}>{item.track.title}</Text>
          <Text style={{ color: text, opacity: 0.7 }}>{item.error || (progress !== undefined ? `Скачивается · ${progress}%` : bytesLabel(item.received) || 'Ожидание')}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => item.error ? retry(item) : cancel(item.track.id)}>
          <Text style={{ color: text }}>{item.error ? 'Повторить' : 'Отменить'}</Text>
        </Pressable>
      </View>;
    })}
    {tracks.length > 0 && !matches.length && <Text style={{ color: text }}>Среди скачанных совпадений нет.</Text>}
    {matches.map(track => <View key={track.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Слушать ' + track.title} onPress={() => play(track)} style={{ flex: 1, paddingVertical: 5 }}>
        <Text numberOfLines={1} style={{ color: text, fontWeight: '700' }}>{track.title}</Text>
        <Text numberOfLines={1} style={{ color: text, opacity: 0.7 }}>{[track.artist, qualityLabel(track.downloadedQuality), bytesLabel(track.downloadedBytes)].filter(Boolean).join(' · ')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={'Удалить скачанный трек ' + track.title} onPress={() => remove(track)}>
        <Text style={{ color: text }}>Удалить</Text>
      </Pressable>
    </View>)}
  </View>;
}
