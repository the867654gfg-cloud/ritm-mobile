import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { searchExternalCatalog, type ExternalTrack } from '../lib/catalog-search';

type Request = { term: string; sequence: number };
export function ExternalMusicSearch({ query, request, start }: { query: string; request: Request | null; start: () => void }) {
  const [results, setResults] = useState<ExternalTrack[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'ready' | 'error'>('idle');
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setResults([]);
    setShowAll(false);
    if (!request || request.term !== query || query.length < 2) { setStatus('idle'); return; }
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 14000);
    setStatus('searching');
    void searchExternalCatalog(query, controller.signal).then(rows => {
      if (!active) return;
      if (controller.signal.aborted) { setStatus('error'); return; }
      setResults(rows);
      setStatus('ready');
    }).catch(() => {
      if (active) setStatus('error');
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [query, request]);
  if (query.length < 2) return null;
  const external = (url: string) => { void Linking.openURL(url).catch(() => {}); };
  const term = encodeURIComponent(query);

  return <View style={styles.panel}>
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 150 }}>
        <Text accessibilityRole="header" style={styles.title}>Где ещё слушать</Text>
        <Text style={styles.muted}>Песни из Apple Music открываются в отдельном сервисе.</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={status === 'searching'} onPress={start} style={styles.action}>
        <Text style={styles.actionText}>{status === 'searching' ? 'Ищем…' : status === 'error' ? 'Повторить поиск' : 'Искать в Apple Music'}</Text>
      </Pressable>
    </View>
    {status === 'ready' && !results.length && <Text style={styles.muted}>Совпадений в Apple Music нет. Попробуй название вместе с именем исполнителя.</Text>}
    {status === 'error' && <Text style={styles.muted}>Каталог Apple Music временно не ответил. Можно открыть поиск в другом сервисе.</Text>}
    {results.slice(0, showAll ? 10 : 4).map(song => <Pressable key={song.id} accessibilityRole="link"
      accessibilityLabel={'Открыть в Apple Music: ' + song.artist + ' — ' + song.title}
      onPress={() => external(song.url)} style={styles.track}>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={styles.song}>{song.title}</Text>
        <Text numberOfLines={1} style={styles.muted}>{[song.artist, song.album].filter(Boolean).join(' · ')}</Text>
      </View>
      <Text style={styles.external}>Apple Music</Text>
    </Pressable>)}
    {results.length > 4 && <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)}>
      <Text style={styles.external}>{showAll ? 'Свернуть' : 'Показать ещё ' + (results.length - 4)}</Text>
    </Pressable>}
    <View style={styles.links}>
      <Pressable accessibilityRole="link" onPress={() => external('https://music.yandex.ru/search?text=' + term)}>
        <Text style={styles.external}>Поиск в Яндекс Музыке</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => external('https://www.youtube.com/results?search_query=' + term)}>
        <Text style={styles.external}>Поиск на YouTube</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { padding: 14, marginBottom: 14, gap: 10, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 18 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '800', color: '#22222a', marginBottom: 4 },
  song: { fontSize: 14, fontWeight: '700', color: '#22222a' },
  muted: { fontSize: 13, color: '#62626b' },
  action: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fae0e3', borderRadius: 11 },
  actionText: { fontSize: 13, fontWeight: '700', color: '#9d1530' },
  track: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: '#ececf1', paddingVertical: 7 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  external: { fontSize: 13, fontWeight: '700', color: '#9d1530' },
});
