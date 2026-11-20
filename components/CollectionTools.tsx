import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { getWebFileContentType } from '../lib/track-cover';
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

export function EditPlaylist({ playlist, userId, close, onSave, onDelete }: { playlist: UserPlaylist; userId: string; close: () => void; onSave: () => void; onDelete: () => void }) {
  const [title, setTitle] = useState(playlist.title);
  const [cover, setCover] = useState(playlist.cover ?? '');
  const [tracks, setTracks] = useState(playlist.tracks);
  const [jpeg, setJpeg] = useState<{ file: Blob; name: string; id: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function pickJpeg() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/jpeg' });
      if (result.canceled) return;
      const item = result.assets[0];
      if (!/\.jpe?g$/i.test(item.name)) throw new Error('Выбери файл JPEG.');
      const source = item.file ?? await (await fetch(item.uri)).blob();
      const file = source.slice(0, source.size, 'image/jpeg');
      await getWebFileContentType(file);
      setJpeg({ file, name: item.name, id: crypto.randomUUID() });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось прочитать файл JPEG.');
    } finally { setBusy(false); }
  }

  const move = (index: number, offset: number) => setTracks(previous => {
    const next = [...previous];
    const other = index + offset;
    if (other >= 0 && other < next.length) [next[index], next[other]] = [next[other], next[index]];
    return next;
  });
  const save = async () => {
    if (!supabase || busy || !title.trim()) return;
    if (!jpeg && cover.trim() && !/^https:\/\//i.test(cover.trim())) { setError('Укажите HTTPS-ссылку на обложку.'); return; }
    const db = supabase;
    setBusy(true);
    setError('');
    try {
      let coverUrl = cover.trim() || null;
      if (jpeg) {
        const bucket = db.storage.from('music-storage');
        const path = userId + '/playlist-covers/' + playlist.id + '/' + jpeg.id + '.jpg';
        const { error: failure } = await bucket.upload(path, jpeg.file, { contentType: 'image/jpeg', upsert: true });
        if (failure) throw failure;
        coverUrl = bucket.getPublicUrl(path).data.publicUrl;
      }
      const { error: failure } = await db.rpc('ritm_edit_playlist', {
        playlist_key: playlist.id, new_title: title.trim(), new_cover: coverUrl, track_keys: tracks.map(track => track.id),
      });
      if (failure) throw failure;
      onSave();
    } catch { setError('Не удалось сохранить плейлист. Попробуй ещё раз.'); }
    finally { setBusy(false); }
  };

  async function removePlaylist() {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure, data } = await supabase.from('user_playlists').delete()
        .eq('id', playlist.id).eq('user_id', userId).select('id');
      if (failure || data?.length !== 1) throw new Error();
      onDelete();
    } catch { setError('Не удалось удалить плейлист. Попробуй ещё раз.'); }
    finally { setBusy(false); }
  }

  return <CollectionPanel title="Редактировать плейлист" close={() => { if (!busy) close(); }}>
    {error ? <Notice kind="error" text={error} /> : null}
    <Field label="Название" value={title} onChangeText={setTitle} maxLength={80} />
    <Field label="Ссылка на обложку" value={cover} editable={!busy} onChangeText={value => { setCover(value); setJpeg(undefined); }} maxLength={2000} />
    <PrimaryButton title="Выбрать JPEG" variant="soft" disabled={busy} onPress={() => void pickJpeg()} />
    {!!jpeg && <Text>Выбран файл {jpeg.name}</Text>}
    {tracks.map((track, index) => <View key={track.id} style={{ gap: 5 }}>
      <Text style={{ fontWeight: '700' }}>{track.title}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <PrimaryButton title="Выше" variant="soft" disabled={index === 0} onPress={() => move(index, -1)} />
        <PrimaryButton title="Ниже" variant="soft" disabled={index === tracks.length - 1} onPress={() => move(index, 1)} />
        <PrimaryButton title="Убрать" variant="soft" onPress={() => setTracks(current => current.filter(item => item.id !== track.id))} />
      </View>
    </View>)}
    <PrimaryButton title="Сохранить изменения" loading={busy} onPress={() => void save()} />
    {confirmDelete ? <>
      <Text>Удалить плейлист и все записи в его списке?</Text>
      <PrimaryButton title="Подтвердить удаление" disabled={busy} variant="danger-outline" onPress={() => void removePlaylist()} />
      <PrimaryButton title="Отмена" disabled={busy} variant="soft" onPress={() => setConfirmDelete(false)} />
    </> : <PrimaryButton title="Удалить плейлист" disabled={busy} variant="danger-outline" onPress={() => setConfirmDelete(true)} />}
  </CollectionPanel>;
}

export function TrackList({ tracks, play }: { tracks: Track[]; play: (track: Track) => void }) {
  return <>{tracks.map(track => <PrimaryButton key={track.id} title={track.title} variant="soft" onPress={() => play(track)} />)}</>;
}
