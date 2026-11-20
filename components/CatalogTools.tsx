import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { CollectionPanel } from './CollectionTools';
import { Field, Notice, PrimaryButton } from './AuthUI';
import type { Track } from '../lib/music-data';
import { supabase } from '../lib/supabase';
import { getWebFileContentType } from '../lib/track-cover';

export function EditTrack({ track, userId, close, onSave }: {
  track: Track; userId: string; close: () => void; onSave: (track: Track) => void;
}) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist ?? '');
  const [description, setDescription] = useState(track.description ?? '');
  const [genre, setGenre] = useState(track.genre);
  const [picture, setPicture] = useState<File>();
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!picture) { setPreview(''); return; }
    const url = URL.createObjectURL(picture);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);

  async function save() {
    if (!supabase || busy || !title.trim()) return;
    const db = supabase;
    const bucket = db.storage.from('music-storage');
    let newFile: string | undefined;
    setBusy(true);
    setError('');
    try {
      const fields: { title: string; artist: string; description: string; genre: string; cover_url?: string; cover_key?: null } = {
        title: title.trim(), artist: artist.trim(), description: description.trim(), genre: genre.trim(),
      };
      if (picture) {
        const extension = await getWebFileContentType(picture);
        newFile = userId + '/' + crypto.randomUUID() + '.' + extension;
        const upload = await bucket.upload(newFile, picture, { contentType: picture.type });
        if (upload.error) { newFile = undefined; throw upload.error; }
        fields.cover_url = bucket.getPublicUrl(newFile).data.publicUrl;
        fields.cover_key = null;
      }
      const result = await db.from('tracks').update(fields).eq('id', track.id).eq('user_id', userId).select('id').single();
      if (result.error) throw result.error;
      onSave({ ...track, ...fields });
    } catch (failure) {
      if (newFile) await bucket.remove([newFile]);
      setError(failure instanceof Error ? failure.message : 'Не удалось сохранить трек.');
    } finally { setBusy(false); }
  }

  return <CollectionPanel title="Редактировать трек" close={busy ? () => {} : close}>
    {error && <Notice kind="error" text={error} />}
    <Field label="Название" value={title} onChangeText={setTitle} maxLength={150} />
    <Field label="Исполнитель" value={artist} onChangeText={setArtist} maxLength={100} />
    <Field label="Жанр" value={genre} onChangeText={setGenre} maxLength={80} />
    <Field label="Описание" value={description} onChangeText={setDescription} maxLength={1000} />
    {preview ? <Image resizeMode="contain" source={{ uri: preview }} style={{ width: 120, height: 120 }} /> : null}
    {typeof document !== 'undefined' && <PrimaryButton title="Заменить обложку" variant="soft" disabled={busy} onPress={() => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) void getWebFileContentType(file).then(() => { setError(''); setPicture(file); }).catch(failure => setError(failure.message));
      };
      input.click();
    }} />}
    <PrimaryButton title="Сохранить" disabled={!title.trim()} loading={busy} onPress={() => void save()} />
  </CollectionPanel>;
}

type Report = { reporter: string; track_id: string; reason: string; created_at: string; reviewed_at: string | null };
export function ModerationPanel({ close, onVisibility }: {
  close: () => void; onVisibility: (trackId: string, hidden: boolean) => void;
}) {
  const [items, setItems] = useState<Report[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!supabase) return;
    setBusy(true);
    const db = supabase;
    try {
      const [reports, visibility] = await Promise.all([
        db.from('ritm_reports').select('reporter,track_id,reason,created_at,reviewed_at')
          .order('reviewed_at', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false }).limit(150),
        db.from('ritm_hidden_tracks').select('track_id'),
      ]);
      if (reports.error || visibility.error) throw new Error();
      const ids = [...new Set([...(reports.data ?? []), ...(visibility.data ?? [])].map(item => item.track_id))];
      const names = ids.length ? await db.from('tracks').select('id,title').in('id', ids) : null;
      if (names?.error) throw new Error();
      setHidden((visibility.data ?? []).map(item => item.track_id));
      setTitles(Object.fromEntries((names?.data ?? []).map(item => [item.id, item.title])));
      setItems(reports.data ?? []);
    } catch { setError('Не удалось загрузить модерацию.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  async function visibility(trackId: string, hide: boolean) {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    const db = supabase;
    const action = hide ? await db.from('ritm_hidden_tracks').insert({ track_id: trackId })
      : await db.from('ritm_hidden_tracks').delete().eq('track_id', trackId);
    if (action.error && !(hide && action.error.code === '23505')) {
      setError('Не удалось изменить видимость трека.');
      setBusy(false);
      return;
    }
    onVisibility(trackId, hide);
    await load();
  }

  return <CollectionPanel title="Модерация" close={close}>
    {error && <Notice kind="error" text={error} />}
    {busy ? <Text>Обновляем список…</Text> : null}
    {!busy && !items.length && <Text>Жалоб пока нет.</Text>}
    {items.map(report => <View key={report.reporter + ':' + report.track_id} style={{ gap: 8, paddingVertical: 8 }}>
      <Text style={{ fontWeight: '800' }}>{titles[report.track_id] || report.track_id}</Text>
      <Text>{report.reason}</Text>
      <Text>{report.reviewed_at ? 'Проверено' : new Date(report.created_at).toLocaleDateString('ru-RU')}</Text>
      {(titles[report.track_id] || report.track_id.startsWith('audius_')) && !hidden.includes(report.track_id) && <PrimaryButton title="Скрыть из каталога" variant="soft" disabled={busy} onPress={() => void visibility(report.track_id, true)} />}
      {!report.reviewed_at && <PrimaryButton title="Отметить проверенной" variant="soft" disabled={busy} onPress={async () => {
        if (!supabase || busy) return;
        setBusy(true);
        const { error: failure } = await supabase.from('ritm_reports').update({ reviewed_at: new Date().toISOString() })
          .eq('reporter', report.reporter).eq('track_id', report.track_id);
        if (failure) { setError('Не удалось сохранить статус жалобы.'); setBusy(false); }
        else await load();
      }} />}
    </View>)}
    {hidden.length > 0 && <Text style={{ fontWeight: '800', fontSize: 18 }}>Скрытые треки</Text>}
    {hidden.map(id => <PrimaryButton key={id} variant="soft" disabled={busy} title={'Вернуть · ' + (titles[id] || id)} onPress={() => void visibility(id, false)} />)}
  </CollectionPanel>;
}
