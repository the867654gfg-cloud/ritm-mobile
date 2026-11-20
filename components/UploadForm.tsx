import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View, Image } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Field, Notice, PrimaryButton } from './AuthUI';
import { publishTrack, uploadPlaylistCover, type TrackFields } from '../lib/publishing';
import { saveUploadPlaylist, type UserPlaylist } from '../lib/user-library';
import { getWebFileContentType } from '../lib/track-cover';
import { audioTags } from '../lib/audio-tags';
import { TrackVersionPicker } from './TrackVersionPicker';

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

export function UploadForm({ userId, onPublished }: { userId: string; onPublished?: (playlistCreated?: boolean) => void }) {
  const [tracks, setTracks] = useState<SelectedTrack[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>();
  const operation = useRef(false);
  const playlistJob = useRef<UserPlaylist>();
  const [createPlaylist, setCreatePlaylist] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [playlistJpeg, setPlaylistJpeg] = useState<Blob>();
  const playlistArtwork = usePreview(playlistJpeg);
  const canCreatePlaylist = tracks.length >= 6 || Boolean(playlistJob.current);
  const wantsPlaylist = canCreatePlaylist && createPlaylist;
  const canSubmit = rights && (tracks.length > 0 || Boolean(playlistJob.current?.tracks.length)) &&
    tracks.every(track => track.title.trim()) && (!wantsPlaylist || Boolean(playlistTitle.trim()));
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

  function pickPlaylistCover() {
    void run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/jpeg' });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!/\.jpe?g$/i.test(file.name)) throw new Error('Выбери JPEG до 5 МБ.');
      const blob = file.file ?? await (await fetch(file.uri)).blob();
      const jpeg = blob.slice(0, blob.size, 'image/jpeg');
      await getWebFileContentType(jpeg);
      setPlaylistJpeg(jpeg);
    });
  }

  function submit() {
    if (!canSubmit) return;
    void run(async () => {
      if (wantsPlaylist && !playlistJob.current) {
        playlistJob.current = { id: crypto.randomUUID(), title: playlistTitle.trim(), tracks: [] };
      }
      const playlist = playlistJob.current;
      if (playlist && playlistJpeg && !playlist.cover) {
        setProgress('Загружаем общую обложку…');
        playlist.cover = await uploadPlaylistCover(userId, playlist.id, playlist.id, playlistJpeg);
      }
      let published = 0;
      const failed: string[] = [];
      for (const [index, track] of tracks.entries()) {
        setProgress('Публикация ' + (index + 1) + ' из ' + tracks.length + ' · ' + track.title);
        try {
          const { audio, cover, id, filename, ...fields } = track;
          const metadata = { ...fields, title: fields.title.trim(), artist: fields.artist.trim(),
            album: fields.album.trim(), genre: fields.genre.trim(), description: fields.description.trim() };
          const stored = await publishTrack(userId, id, metadata, audio, cover, playlist?.cover);
          playlist?.tracks.push({ ...metadata, ...stored, id, user_id: userId });
          published++;
          setTracks(previous => previous.filter(item => item.id !== id));
        } catch { failed.push(track.title); }
      }
      if (published) onPublished?.();
      if (failed.length) {
        setMessage({ kind: 'error', text: 'Опубликовано: ' + published + '. Осталось в списке: ' + failed.length + '. Проверь подключение и попробуй снова.' });
      } else {
        if (playlist) {
          setProgress('Сохраняем плейлист…');
          await saveUploadPlaylist(userId, playlist);
          playlistJob.current = undefined;
          setCreatePlaylist(false);
          setPlaylistTitle('');
          setPlaylistJpeg(undefined);
          onPublished?.(true);
        }
        setRights(false);
        setEditingId(undefined);
        setMessage({ kind: 'success', text: playlist
          ? 'Плейлист «' + playlist.title + '» создан. Треков: ' + playlist.tracks.length + '.'
          : 'Опубликовано треков: ' + published + '.' });
      }
    });
  }

  return <>
    <PrimaryButton title="Выбрать аудио" disabled={busy || Boolean(playlistJob.current)} onPress={pickAudio} />
    <Text accessibilityLiveRegion="polite" style={{ fontWeight: '700' }}>Выбрано песен: {tracks.length}</Text>
    {canCreatePlaylist && <View style={{ gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#fff' }}>
      <PrimaryButton title={(createPlaylist ? '☑ ' : '☐ ') + 'Создать плейлист'} variant="soft"
        disabled={busy || Boolean(playlistJob.current)} onPress={() => setCreatePlaylist(!createPlaylist)} />
      {wantsPlaylist && <>
        <Field label="Название плейлиста" value={playlistTitle} onChangeText={setPlaylistTitle} maxLength={80}
          editable={!busy && !playlistJob.current} />
        <PrimaryButton title="Выбрать общую обложку JPEG" variant="soft"
          disabled={busy || Boolean(playlistJob.current)} onPress={pickPlaylistCover} />
        {playlistArtwork && <Image accessibilityLabel="Общая обложка" source={{ uri: playlistArtwork }} style={{ width: 100, height: 100, borderRadius: 12 }} />}
      </>}
    </View>}
    {tracks.map(track => <View key={track.id} style={{ gap: 8, borderRadius: 14, padding: 12, backgroundColor: '#fff' }}>
      <Text style={{ fontWeight: '700' }}>{track.title || track.filename}</Text>
      {track.title !== track.filename && <Text style={{ color: '#62626e' }}>{track.filename}</Text>}
      <View style={{ gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
        <PrimaryButton title={editingId === track.id ? 'Свернуть' : 'Редактировать'} variant="soft" disabled={busy}
          onPress={() => setEditingId(editingId === track.id ? undefined : track.id)} />
        <PrimaryButton title="Убрать из списка" variant="soft" disabled={busy}
          onPress={() => {
            if (tracks.length === 1 && !playlistJob.current?.tracks.length) playlistJob.current = undefined;
            setTracks(previous => previous.filter(item => item.id !== track.id));
          }} />
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
    <PrimaryButton title="Опубликовать" loading={Boolean(progress)} disabled={busy || !canSubmit} onPress={submit} />
  </>;
}
