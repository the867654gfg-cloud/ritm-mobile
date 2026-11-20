import { useState } from 'react';
import { Text, View } from 'react-native';
import { Field, PrimaryButton } from './AuthUI';
import { connectHomeLibrary, type HomeLibrary } from '../lib/home-library';
import type { Track } from '../lib/music-data';

export function HomeLibraryPanel({ connection, onConnect, play }: {
  connection: HomeLibrary | null;
  onConnect: (connection: HomeLibrary | null) => void;
  play: (track: Track, list: Track[]) => void;
}) {
  const [address, setAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [term, setTerm] = useState('');
  const [lastTerm, setLastTerm] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load(client: HomeLibrary, query: string, append = false) {
    const items = await client.songs(query, append ? tracks.length : 0);
    setTracks(append ? [...tracks, ...items] : items);
    setLastTerm(query);
    setMore(items.length === 40);
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Не удалось загрузить фонотеку.'); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12, paddingBottom: 16 }}>
    {connection ? <>
      <Text style={{ fontWeight: '700' }}>{connection.host}</Text>
      <Field label="Поиск в фонотеке" value={term} onChangeText={setTerm} />
      <PrimaryButton title="Найти треки" loading={busy} onPress={() => void run(() => load(connection, term.trim()))} />
      <PrimaryButton title="Отключить сервер" variant="soft" disabled={busy} onPress={() => {
        onConnect(null); setTracks([]); setTerm(''); setError('');
      }} />
      {!tracks.length && !busy && <Text>Треки не найдены. Попробуй поиск по названию или исполнителю.</Text>}
      {tracks.map(track => <PrimaryButton key={track.id} variant="soft"
        title={[track.title, track.artist].filter(Boolean).join(' · ')} onPress={() => play(track, tracks)} />)}
      {more && <PrimaryButton title="Показать ещё" variant="soft" disabled={busy} onPress={() => void run(() => load(connection, lastTerm, true))} />}
    </> : <>
      <Text>Подключи сервер Subsonic или Navidrome по HTTPS. Сервер должен разрешать запросы с сайта «Ритм.».</Text>
      <Field label="HTTPS-адрес сервера" value={address} onChangeText={setAddress} autoCapitalize="none" />
      <Field label="Логин сервера" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <Field label="Пароль сервера" value={password} onChangeText={setPassword} secure />
      <PrimaryButton title="Подключить" loading={busy} onPress={() => void run(async () => {
        const client = connectHomeLibrary(address, username, password);
        await client.ping();
        await load(client, '');
        onConnect(client);
        setPassword('');
      })} />
    </>}
    {!!error && <Text accessibilityLiveRegion="polite" style={{ color: '#b91738' }}>{error}</Text>}
  </View>;
}
