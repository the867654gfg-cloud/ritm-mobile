import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { getWebFileContentType } from '../lib/track-cover';
import { Modal, ScrollView, Text, View, Image, Pressable } from 'react-native';
import { Field, Notice, PrimaryButton } from './AuthUI';
import { supabase } from '../lib/supabase';
import { addTracksToPlaylist, type UserPlaylist } from '../lib/user-library';
import type { Track } from '../lib/music-data';

export function CollectionPanel({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <Modal transparent animationType="fade" onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#13131ac0', padding: 16 }}>
      <View style={{ width: '100%', maxWidth: 700, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 23, fontWeight: '900' }}>{title}</Text>
          {children}
          <PrimaryButton title="Закрыть" variant="soft" onPress={close} />
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

export function EditPlaylist({ playlist, choices, userId, close, onSave, onDelete }: { playlist: UserPlaylist; choices: Track[]; userId: string; close: () => void; onSave: () => void; onDelete: () => void }) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description || '');
  const [preview, setPreview] = useState(playlist.cover);
  const [added, setAdded] = useState<Track[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const existing = new Set([...playlist.tracks, ...added].map(track => track.id));
  const matches = Array.from(new Map(choices.map(track => [track.id, track])).values()).filter(track =>
    !existing.has(track.id) && (track.title + ' ' + (track.artist || '')).toLowerCase().includes(query.trim().toLowerCase()));
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
      setPreview(item.uri);
      setJpeg({ file, name: item.name, id: crypto.randomUUID() });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось прочитать файл JPEG.');
    } finally { setBusy(false); }
  }

  const save = async () => {
    if (!supabase || busy) return;
    const db = supabase;
    setBusy(true);
    setError('');
    try {
      let coverUrl = playlist.cover || null;
      if (jpeg) {
        const bucket = db.storage.from('music-storage');
        const path = userId + '/playlist-covers/' + playlist.id + '/' + jpeg.id + '.jpg';
        const { error: failure } = await bucket.upload(path, jpeg.file, { contentType: 'image/jpeg', upsert: true });
        if (failure) throw failure;
        coverUrl = bucket.getPublicUrl(path).data.publicUrl;
      }
      {
        const { error } = await db.from('user_playlists').update({ title: title.trim() || playlist.title, description: description.trim(), cover_url: coverUrl }).eq('id', playlist.id).eq('user_id', userId);
        if (error) throw error;
      }
      if (!await addTracksToPlaylist(userId, playlist.id, added, playlist.tracks.length)) throw new Error();
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

  return <CollectionPanel title="Редактирование плейлиста" close={() => { if (!busy) close(); }}>
    {error ? <Notice kind="error" text={error} /> : null}
    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start', paddingVertical: 12 }}>
      <Pressable accessibilityLabel="Выбрать JPEG" disabled={busy} onPress={() => void pickJpeg()} style={{ width: 98, height: 98, borderRadius: 8, backgroundColor: '#eef0f3', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
        {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: '100%' }} /> : <><Text style={{ fontSize: 32, color: '#9ba5b3' }}>＋</Text><Text style={{ color: '#7d8998', fontSize: 12 }}>Обложка</Text></>}
      </Pressable>
      <View style={{ flex: 1, gap: 12 }}><Field label="Название" value={title} onChangeText={setTitle} maxLength={80} />
        <Field label="Описание плейлиста" value={description} onChangeText={setDescription} maxLength={1000} /></View>
    </View>
    {!!jpeg && <Text>Выбран файл {jpeg.name}</Text>}
    <PrimaryButton title="Добавить трек" variant="soft" disabled={busy} onPress={() => setChoosing(value => !value)} />
    {choosing && <>
      <Field label="Найти трек" value={query} onChangeText={setQuery} />
      {matches.slice(0, 40).map(track => <PrimaryButton key={track.id} variant="soft" disabled={busy}
        title={[track.artist, track.title].filter(Boolean).join(' · ')} onPress={() => setAdded(previous => [...previous, track])} />)}
      {!matches.length && <Text>Подходящих треков нет.</Text>}
    </>}
    {added.length > 0 && <Text>К добавлению: {added.length}</Text>}
    <View style={{ minHeight: 150, justifyContent: 'center', gap: 8 }}>
      {playlist.tracks.length + added.length === 0 ? <Text style={{ textAlign: 'center', color: '#8c97a5' }}>♫
Здесь пока нет аудиозаписей</Text> : [...playlist.tracks, ...added].map(track => <Text key={track.id} style={{ padding: 8 }}>{[track.artist, track.title].filter(Boolean).join(' · ')}</Text>)}
    </View>
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
