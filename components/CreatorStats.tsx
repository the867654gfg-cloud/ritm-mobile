import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Field, Notice, PrimaryButton } from './AuthUI';

type Daily = { track_id: string; day: string; source: string; plays: number; listens: number };
type Song = { id: string; title: string };
const sourceNames: Record<string, string> = {
  artist: 'Страница автора', shared: 'Общий плейлист', catalog: 'Каталог', library: 'Медиатека', playlist: 'Подборки', other: 'Другие разделы',
};

export function CreatorStats({ userId }: { userId: string }) {
  const [bio, setBio] = useState('');
  const [bioReady, setBioReady] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>();
  const [songs, setSongs] = useState<Song[]>([]);
  const [rows, setRows] = useState<Daily[]>();
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const previousStart = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let active = true;
    void Promise.all([
      db.from('profiles').select('bio').eq('id', userId).single(),
      db.from('tracks').select('id,title').eq('user_id', userId),
      db.from('ritm_daily_plays').select('track_id,day,source,plays,listens').gte('day', previousStart),
    ]).then(([profile, tracks, stats]) => {
      if (!active) return;
      if (profile.data) { setBio(profile.data.bio); setBioReady(true); }
      if (tracks.error || stats.error || profile.error) setMessage({ kind: 'error', text: 'Часть данных автора временно недоступна.' });
      if (!tracks.error && !stats.error) { setSongs(tracks.data ?? []); setRows(stats.data ?? []); }
    });
    return () => { active = false; };
  }, [userId, previousStart]);
  const recent = (rows ?? []).filter(row => row.day >= weekStart);
  const total = (items: Daily[], field: 'plays' | 'listens' = 'listens') => items.reduce((sum, row) => sum + Number(row[field]), 0);
  const week = total(recent);
  const previous = total((rows ?? []).filter(row => row.day < weekStart));
  const top = songs.map(song => ({ ...song, count: total(recent.filter(row => row.track_id === song.id)) })).filter(song => song.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  const sources = [...new Set(recent.map(row => row.source))];
  return <View style={{ gap: 10, padding: 20, borderRadius: 18, marginBottom: 16, backgroundColor: '#fff' }}>
    <Text style={{ fontSize: 17, fontWeight: '800' }}>Страница автора</Text>
    {message && <Notice kind={message.kind} text={message.text} />}
    <Field label="О себе" value={bio} onChangeText={setBio} maxLength={600} editable={bioReady} />
    <PrimaryButton title="Сохранить описание" variant="soft" disabled={!bioReady} onPress={async () => {
      const result = await supabase?.from('profiles').update({ bio: bio.trim() }).eq('id', userId);
      setMessage(result && !result.error ? { kind: 'success', text: 'Описание сохранено.' } : { kind: 'error', text: 'Не удалось сохранить описание.' });
    }} />
    <Text style={{ fontSize: 17, fontWeight: '800' }}>Статистика моих треков</Text>
    {rows && <>
      <Text>Сегодня (UTC) · {total(recent.filter(row => row.day === today), 'plays')} запусков, {total(recent.filter(row => row.day === today))} прослушиваний</Text>
      <Text>За последние 7 дней · {total(recent, 'plays')} запусков, {week} прослушиваний</Text>
      <Text>К предыдущим 7 дням · {week - previous > 0 ? '+' : ''}{week - previous}</Text>
      {top.length > 0 && <Text style={{ fontWeight: '800' }}>Популярные треки за 7 дней</Text>}
      {top.map(song => <Text key={song.id}>{song.title} · {song.count}</Text>)}
      {sources.length > 0 && <Text style={{ fontWeight: '800' }}>Откуда запускали треки</Text>}
      {sources.map(source => <Text key={source}>{sourceNames[source] || source} · {total(recent.filter(row => row.source === source), 'plays')} запусков</Text>)}
    </>}
  </View>;
}
