import { useEffect, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { Field, Notice, PrimaryButton } from './AuthUI';
import { supabase } from '../lib/supabase';
import type { UserPlaylist } from '../lib/user-library';
import type { Track } from '../lib/music-data';

export function CollectionPanel({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#13131ac0', padding: 16 }}>
      <View style={{ width: '100%', maxWidth: 560, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 23, fontWeight: '900' }}>{title}</Text>
          {children}
          <PrimaryButton title="Закрыть" variant="soft" onPress={close} />
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

export function EditPlaylist({ playlist, close, onSave }: { playlist: UserPlaylist; close: () => void; onSave: () => void }) {
  const [title, setTitle] = useState(playlist.title);
  const [cover, setCover] = useState(playlist.cover ?? '');
  const [tracks, setTracks] = useState(playlist.tracks);
  const [shared, setShared] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void supabase?.from('ritm_playlist_links').select('playlist_id').eq('playlist_id', playlist.id).maybeSingle().then(result => {
      if (result.error) setError('Не удалось проверить доступ по ссылке.');
      else setShared(Boolean(result.data));
    });
  }, [playlist.id]);
  const move = (index: number, offset: number) => setTracks(previous => {
    const next = [...previous];
    const other = index + offset;
    if (other >= 0 && other < next.length) [next[index], next[other]] = [next[other], next[index]];
    return next;
  });
  const save = async () => {
    if (!supabase || busy || !title.trim()) return;
    if (cover.trim() && !/^https:\/\//i.test(cover.trim())) { setError('Укажите HTTPS-ссылку на обложку.'); return; }
    setBusy(true);
    const { error: failure } = await supabase.rpc('ritm_edit_playlist', {
      playlist_key: playlist.id, new_title: title.trim(), new_cover: cover.trim() || null, track_keys: tracks.map(track => track.id),
    });
    setBusy(false);
    if (failure) setError('Не удалось сохранить плейлист.');
    else onSave();
  };
  const toggleLink = async () => {
    if (!supabase || shared === undefined || busy) return;
    setBusy(true);
    const { error: failure } = await supabase.rpc('ritm_toggle_playlist_link', { playlist_key: playlist.id, enabled: !shared });
    setBusy(false);
    if (failure) setError('Не удалось изменить доступ по ссылке.');
    else setShared(!shared);
  };
  return <CollectionPanel title="Редактировать плейлист" close={close}>
    {error ? <Notice kind="error" text={error} /> : null}
    <Field label="Название" value={title} onChangeText={setTitle} maxLength={80} />
    <Field label="Ссылка на обложку" value={cover} onChangeText={setCover} maxLength={2000} />
    {tracks.map((track, index) => <View key={track.id} style={{ gap: 5 }}>
      <Text style={{ fontWeight: '700' }}>{track.title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <PrimaryButton title="Выше" variant="soft" disabled={index === 0} onPress={() => move(index, -1)} />
        <PrimaryButton title="Ниже" variant="soft" disabled={index === tracks.length - 1} onPress={() => move(index, 1)} />
        <PrimaryButton title="Убрать" variant="soft" onPress={() => setTracks(current => current.filter(item => item.id !== track.id))} />
      </View>
    </View>)}
    <PrimaryButton title="Сохранить изменения" loading={busy} onPress={() => void save()} />
    <PrimaryButton title={shared ? 'Отключить публичную ссылку' : 'Открыть доступ по ссылке'} variant="soft" disabled={shared === undefined || busy} onPress={() => void toggleLink()} />
    {shared && typeof window !== 'undefined' && <Text selectable>{new URL('?playlist=' + playlist.id, window.location.href).href}</Text>}
  </CollectionPanel>;
}

export function TrackList({ tracks, play }: { tracks: Track[]; play: (track: Track) => void }) {
  return <>{tracks.map(track => <PrimaryButton key={track.id} title={track.title} variant="soft" onPress={() => play(track)} />)}</>;
}
