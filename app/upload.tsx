import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View, Image } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, Field, Notice, PrimaryButton } from '../components/AuthUI';
import { useAuth } from '../lib/auth';
import { publishTrack, type TrackFields } from '../lib/publishing';
import { getWebFileContentType } from '../lib/track-cover';
import { audioTags } from '../lib/audio-tags';
import { TrackVersionPicker } from '../components/TrackVersionPicker';

const limit = 50 * 1024 * 1024;
const audioTypes: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg' };

type SelectedTrack = TrackFields & { id: string; filename: string; audio: Blob; cover?: Blob };

function usePreview(blob?: Blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const next = blob ? URL.createObjectURL(blob) : '';
    setUrl(next);
    return () => { if (next) URL.revokeObjectURL(next); };
  }, [blob]);
  return url;
}

export default function UploadScreen() {
  const { user, loading } = useAuth();
  return <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, width: '100%', maxWidth: 660, alignSelf: 'center' }}>
      <PrimaryButton title="Назад" variant="soft" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '900' }}>Публикация треков</Text>
      {!loading && !user && <PrimaryButton title="Войти для загрузки" onPress={() => router.replace('/sign-in')} />}
      {user && <UploadForm key={user.id} userId={user.id} />}
    </ScrollView>
  </SafeAreaView>;
}

function UploadForm({ userId }: { userId: string }) {
  const [tracks, setTracks] = useState<SelectedTrack[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>();
  const operation = useRef(false);
  const editing = tracks.find(track => track.id === editingId);
  const preview = usePreview(editing?.audio);
  const artwork = usePreview(editing?.cover);

  function edit(id: string, fields: Partial<TrackFields> & { cover?: Blob }) {
    setTracks(previous => previous.map(track => track.id === id ? { ...track, ...fields } : track));
  }

  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setMessage(undefined);
    try { await action(); }
    catch (error) { setMessage({ kind: 'error', text: (error as Error).message || 'Не удалось выполнить операцию.' }); }
    finally { operation.current = false; setBusy(false); setProgress(''); }
  }

  function pickAudio() {
    void run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true });
      if (result.canceled) return;
      const selected: SelectedTrack[] = [];
      let rejected = 0;
      for (const file of result.assets) {
        const type = audioTypes[file.name.split('.').pop()?.toLowerCase() ?? ''];
        if (!type || (file.size ?? 0) > limit) { rejected++; continue; }
        try {
          const blob = file.file ?? await (await fetch(file.uri)).blob();
          if (!blob.size || blob.size > limit) { rejected++; continue; }
          const audio = blob.slice(0, blob.size, type);
          const tags = await audioTags(audio, file.name);
          selected.push({ ...tags, description: '', version_kind: null, filename: file.name, id: crypto.randomUUID(), audio });
        } catch { rejected++; }
      }
      if (selected.length) {
        setTracks(previous => [...previous, ...selected]);
        setRights(false);
        if (tracks.length === 0 && selected.length === 1) setEditingId(selected[0].id);
      }
      if (rejected) setMessage({ kind: 'error', text: 'Пропущено файлов: ' + rejected + '. Подойдут MP3, WAV, FLAC, M4A, AAC и OGG до 50 МБ.' });
    });
  }

  function pickCover(id: string) {
    void run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
      if (result.canceled) return;
      const file = result.assets[0];
      const blob = file.file ?? await (await fetch(file.uri)).blob();
      if (!blob.size || blob.size > 5 * 1024 * 1024) throw new Error('Выбери JPG, PNG или WebP до 5 МБ.');
      await getWebFileContentType(blob);
      edit(id, { cover: blob });
    });
  }

  function submit() {
    if (!rights || !tracks.length || tracks.some(track => !track.title.trim())) return;
    void run(async () => {
      let published = 0;
      const failed: string[] = [];
      for (const [index, track] of tracks.entries()) {
        setProgress('Публикация ' + (index + 1) + ' из ' + tracks.length + ' · ' + track.title);
        try {
          const { audio, cover, id, filename, ...fields } = track;
          await publishTrack(userId, id, { ...fields, title: fields.title.trim(), artist: fields.artist.trim(),
            album: fields.album.trim(), genre: fields.genre.trim(), description: fields.description.trim() }, audio, cover);
          published++;
          setTracks(previous => previous.filter(item => item.id !== id));
        } catch { failed.push(track.title); }
      }
      if (failed.length) {
        setMessage({ kind: 'error', text: 'Опубликовано: ' + published + '. Осталось в списке: ' + failed.length + '. Проверь подключение и попробуй снова.' });
      } else {
        setRights(false);
        setEditingId(undefined);
        setMessage({ kind: 'success', text: 'Опубликовано треков: ' + published + '.' });
      }
    });
  }

  return <>
    <PrimaryButton title="Выбрать аудио" disabled={busy} onPress={pickAudio} />
    <Text accessibilityLiveRegion="polite" style={{ fontWeight: '700' }}>Выбрано песен: {tracks.length}</Text>
    {tracks.map(track => <View key={track.id} style={{ gap: 8, borderRadius: 14, padding: 12, backgroundColor: '#fff' }}>
      <Text style={{ fontWeight: '700' }}>{track.title || track.filename}</Text>
      {track.title !== track.filename && <Text style={{ color: '#62626e' }}>{track.filename}</Text>}
      <View style={{ gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
        <PrimaryButton title={editingId === track.id ? 'Свернуть' : 'Редактировать'} variant="soft" disabled={busy}
          onPress={() => setEditingId(editingId === track.id ? undefined : track.id)} />
        <PrimaryButton title="Убрать из списка" variant="soft" disabled={busy}
          onPress={() => setTracks(previous => previous.filter(item => item.id !== track.id))} />
      </View>
      {editingId === track.id && <>
        <PrimaryButton title="Выбрать обложку" variant="soft" disabled={busy} onPress={() => pickCover(track.id)} />
        {artwork ? <Image source={{ uri: artwork }} style={{ width: 130, height: 130, borderRadius: 14 }} /> : null}
        {Platform.OS === 'web' && preview ? <audio key={preview} controls src={preview} onLoadedMetadata={event => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) edit(track.id, { duration: Math.round(value) });
        }} /> : null}
        <Field label="Название" value={track.title} editable={!busy} onChangeText={title => edit(track.id, { title })} maxLength={150} />
        <Field label="Исполнитель" value={track.artist} editable={!busy} onChangeText={artist => edit(track.id, { artist })} maxLength={100} />
        <Field label="Альбом" value={track.album} editable={!busy} onChangeText={album => edit(track.id, { album })} maxLength={150} />
        <Field label="Жанр" value={track.genre} editable={!busy} onChangeText={genre => edit(track.id, { genre })} maxLength={80} />
        <View pointerEvents={busy ? 'none' : 'auto'}><TrackVersionPicker value={track.version_kind} onChange={version_kind => edit(track.id, { version_kind })} /></View>
        <Field label="Описание и теги" value={track.description} editable={!busy} onChangeText={description => edit(track.id, { description })} maxLength={1000} />
      </>}
    </View>)}
    <Text>Публикуй только записи, на распространение которых у тебя есть право.</Text>
    <PrimaryButton title={(rights ? '☑ ' : '☐ ') + 'У меня есть права на публикацию'} variant="soft" disabled={busy} onPress={() => setRights(!rights)} />
    {!!progress && <Text accessibilityLiveRegion="polite">{progress}</Text>}
    {message && <Notice kind={message.kind} text={message.text} />}
    <PrimaryButton title="Опубликовать" loading={Boolean(progress)} disabled={busy || !rights || !tracks.length || tracks.some(track => !track.title.trim())} onPress={submit} />
  </>;
}
