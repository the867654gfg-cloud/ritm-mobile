import { useEffect, useState } from 'react';
import { Platform, ScrollView, Text, View, Image } from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, Field, Notice, PrimaryButton } from '../components/AuthUI';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Draft, discardDraft, publishDraft, saveDraft } from '../lib/publishing';
import { getWebFileContentType } from '../lib/track-cover';

const limit = 50 * 1024 * 1024;
const audioTypes: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg' };

export default function UploadScreen() {
  const { user, loading } = useAuth();
  const [audio, setAudio] = useState<Blob>();
  const [cover, setCover] = useState<Blob>();
  const [preview, setPreview] = useState('');
  const [artwork, setArtwork] = useState('');
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<Draft>();
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>();

  useEffect(() => {
    setDrafts([]);
    setEditing(undefined);
    const db = supabase;
    if (!db || !user) return;
    let active = true;
    void db.from('ritm_drafts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data, error }) => {
      if (!active) return;
      if (error) setMessage({ kind: 'error', text: 'Не удалось загрузить черновики.' });
      else setDrafts(data ?? []);
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const url = audio ? URL.createObjectURL(audio) : '';
    setPreview(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [audio]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const url = cover ? URL.createObjectURL(cover) : '';
    setArtwork(url);
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [cover]);

  async function pick(image: boolean) {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: image ? 'image/*' : 'audio/*' });
      if (result.canceled) return;
      const file = result.assets[0];
      const blob = file.file ?? await (await fetch(file.uri)).blob();
      const type = image ? blob.type : audioTypes[file.name.split('.').pop()?.toLowerCase() ?? ''];
      const allowed = image ? ['image/jpeg', 'image/png', 'image/webp'].includes(type) : Boolean(type);
      if (!allowed || !blob.size || blob.size > (image ? 5 * 1024 * 1024 : limit)) {
        throw new Error(image ? 'Выберите JPG, PNG или WebP до 5 МБ.' : 'Выберите MP3, WAV, FLAC, M4A, AAC или OGG до 50 МБ.');
      }
      if (image) {
        await getWebFileContentType(blob);
        setCover(blob);
      }
      else {
        setAudio(blob.slice(0, blob.size, type));
        setDuration(0);
        setTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 150));
      }
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    }
  }

  async function addDraftBatch() {
    if (!user || busy) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true });
      if (result.canceled) return;
      setBusy(true);
      const saved: Draft[] = [];
      let rejected = 0;
      for (const file of result.assets) {
        const type = audioTypes[file.name.split('.').pop()?.toLowerCase() ?? ''];
        if (!type || (file.size ?? 0) > limit) { rejected++; continue; }
        try {
          const blob = file.file ?? await (await fetch(file.uri)).blob();
          if (!blob.size || blob.size > limit) { rejected++; continue; }
          const name = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 150);
          saved.push(await saveDraft(user.id, { title: name || 'Без названия', artist: '', genre: '', description: '', duration: 0 }, blob.slice(0, blob.size, type)));
        } catch { rejected++; }
      }
      setDrafts(previous => [...saved, ...previous]);
      setMessage({ kind: rejected ? 'error' : 'success', text: 'Черновиков сохранено: ' + saved.length + (rejected ? '. Не удалось сохранить: ' + rejected : '.') });
    } catch { setMessage({ kind: 'error', text: 'Не удалось выбрать файлы.' }); }
    finally { setBusy(false); }
  }

  async function submit(publish: boolean) {
    if (!user || !supabase || !title.trim() || (!editing && !audio) || busy || (publish && !rights)) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const fields = { title: title.trim(), artist: artist.trim(), genre: genre.trim(), description: description.trim(), duration };
      let draft = editing;
      if (draft) {
        const result = await supabase.from('ritm_drafts').update(fields).eq('id', draft.id).select().single();
        if (result.error) throw result.error;
        draft = result.data;
      } else if (audio) draft = await saveDraft(user.id, fields, audio, cover);
      if (!draft) return;
      const saved = draft;
      setEditing(saved);
      setDrafts(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
      setAudio(undefined);
      setCover(undefined);
      if (publish) {
        await publishDraft(saved);
        await discardDraft(saved);
        setEditing(undefined);
        setDrafts(previous => previous.filter(item => item.id !== saved.id));
        setTitle('');
        setRights(false);
      }
      setMessage({ kind: 'success', text: publish ? 'Трек опубликован.' : 'Черновик сохранён в аккаунте.' });
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message || 'Операция не завершилась. Попробуйте ещё раз.' });
    } finally { setBusy(false); }
  }

  async function openDraft(draft: Draft) {
    setEditing(draft);
    setAudio(undefined);
    setCover(undefined);
    setTitle(draft.title);
    setArtist(draft.artist || '');
    setGenre(draft.genre || '');
    setDescription(draft.description || '');
    setDuration(draft.duration);
    setRights(false);
    const storage = supabase?.storage.from('ritm-drafts');
    setPreview((await storage?.createSignedUrl(draft.audio_path, 600))?.data?.signedUrl ?? '');
    setArtwork(draft.cover_path ? (await storage?.createSignedUrl(draft.cover_path, 600))?.data?.signedUrl ?? '' : '');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, width: '100%', maxWidth: 660, alignSelf: 'center' }}>
        <PrimaryButton title="Назад" variant="soft" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
        <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '900' }}>Публикация трека</Text>
        {message && <Notice kind={message.kind} text={message.text} />}
        {!loading && !user && <PrimaryButton title="Войти для загрузки" onPress={() => router.replace('/sign-in')} />}
        {user && <>
          {drafts.map(draft => <PrimaryButton key={draft.id} variant="soft" title={'Черновик · ' + draft.title} disabled={busy} onPress={() => void openDraft(draft)} />)}
          {editing && <PrimaryButton title="Создать новый трек" variant="soft" disabled={busy} onPress={() => {
            setEditing(undefined); setTitle(''); setArtist(''); setGenre(''); setDescription(''); setPreview(''); setArtwork(''); setRights(false);
          }} />}
          {!editing && <View style={{ gap: 8 }}>
            <PrimaryButton title="Выбрать аудио" disabled={busy} onPress={() => void pick(false)} />
            <PrimaryButton title="Загрузить несколько в черновики" variant="soft" disabled={busy} onPress={() => void addDraftBatch()} />
            <PrimaryButton title="Выбрать обложку" variant="soft" disabled={busy} onPress={() => void pick(true)} />
          </View>}
          {artwork ? <Image source={{ uri: artwork }} style={{ width: 130, height: 130, borderRadius: 14 }} /> : null}
          {Platform.OS === 'web' && preview ? <audio key={preview} controls src={preview} onLoadedMetadata={event => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value)) setDuration(Math.round(value));
          }} /> : null}
          <Field label="Название" value={title} onChangeText={setTitle} maxLength={150} />
          <Field label="Исполнитель" value={artist} onChangeText={setArtist} maxLength={100} />
          <Field label="Жанр" value={genre} onChangeText={setGenre} maxLength={80} />
          <Field label="Описание и теги" value={description} onChangeText={setDescription} maxLength={1000} />
          <Text>Публикуйте только записи, на распространение которых у вас есть право. Черновик доступен только вам, опубликованный трек появляется в каталоге.</Text>
          <PrimaryButton title={(rights ? '☑ ' : '☐ ') + 'У меня есть права на публикацию'} variant="soft" onPress={() => setRights(!rights)} />
          <PrimaryButton title="Сохранить черновик" variant="soft" disabled={!title.trim() || (!editing && !audio) || busy} onPress={() => void submit(false)} />
          <PrimaryButton title="Опубликовать" loading={busy} disabled={!rights || !title.trim() || (!editing && !audio)} onPress={() => void submit(true)} />
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}
