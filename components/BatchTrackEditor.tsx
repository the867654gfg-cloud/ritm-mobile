import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CollectionPanel } from './CollectionTools';
import { Field, Notice, PrimaryButton } from './AuthUI';
import { splitTrackTitle } from '../lib/catalog-search';
import { TrackVersionPicker } from './TrackVersionPicker';
import { supabase } from '../lib/supabase';
import type { Track } from '../lib/music-data';
import type { TrackVersion } from '../lib/catalog-search';

type Fields = { id: string; title: string; artist: string; album: string; genre: string; version_kind: TrackVersion | null };
const readFields = (track: Track): Fields => ({
  id: track.id, title: track.title, artist: track.artist ?? '', album: track.album ?? '', genre: track.genre ?? '',
  version_kind: track.version_kind ?? null,
});
const textFields = [{ name: 'artist', label: 'Исполнитель', max: 100 }, { name: 'album', label: 'Альбом', max: 150 },
  { name: 'genre', label: 'Жанр', max: 80 }] as const;
export type TrackMetadata = Pick<Track, 'id' | 'title' | 'artist' | 'album' | 'genre' | 'version_kind'>;

export function BatchTrackEditor({ tracks, close, onSave }: { tracks: Track[]; close: () => void; onSave: (rows: TrackMetadata[]) => void }) {
  const [original] = useState(() => new Map(tracks.map(track => [track.id, readFields(track)])));
  const [rows, setRows] = useState(() => tracks.map(readFields));
  const [common, setCommon] = useState({ artist: '', album: '', genre: '' });
  const [commonVersion, setCommonVersion] = useState<TrackVersion | null>(null);
  const [opened, setOpened] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const change = (id: string, fields: Partial<Fields>) => setRows(previous => previous.map(row => row.id === id ? { ...row, ...fields } : row));
  const dirty = rows.flatMap(row => {
    const before = original.get(row.id)!;
    const patch: Record<string, string | null> = { id: row.id };
    for (const key of ['title', 'artist', 'album', 'genre', 'version_kind'] as const) {
      const after = typeof row[key] === 'string' ? row[key]!.trim() : null;
      if (after !== before[key]) patch[key] = after;
    }
    return Object.keys(patch).length > 1 ? [patch] : [];
  });
  const invalid = rows.some(row => !row.title.trim());

  async function save() {
    if (!supabase || invalid || busy || dirty.length === 0) return;
    setBusy(true);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('ritm_update_track_batch', { edits: dirty });
      if (error || !Array.isArray(data) || data.length !== dirty.length) throw new Error();
      onSave(data.map(row => ({ ...row, artist: row.artist ?? '', genre: row.genre ?? '' })));
    } catch { setMessage('Не удалось сохранить изменения. Проверь выбор и попробуй ещё раз.'); }
    finally { setBusy(false); }
  }

  return <CollectionPanel title={'Редактирование треков · ' + rows.length} close={busy ? () => {} : close}>
    {message ? <Notice kind="error" text={message} /> : null}
    <Text style={{ fontWeight: '800' }}>Общие поля</Text>
    <Text>Заполни нужные поля и примени их к выбранным трекам. Пустые общие поля пропускаются.</Text>
    {textFields.map(field => <Field key={field.name} label={field.label} value={common[field.name]} maxLength={field.max}
      onChangeText={value => setCommon(previous => ({ ...previous, [field.name]: value }))} />)}
    <TrackVersionPicker value={commonVersion} onChange={setCommonVersion} emptyLabel="Пропустить" />
    <PrimaryButton title="Применить общие поля" variant="soft" disabled={busy || (!commonVersion && !Object.values(common).some(value => value.trim()))} onPress={() => {
      const changed = Object.fromEntries(Object.entries(common).filter(([, value]) => value.trim()));
      setRows(previous => previous.map(row => ({ ...row, ...changed, version_kind: commonVersion ?? row.version_kind })));
    }} />
    <PrimaryButton title="Разобрать названия и убрать нумерацию" variant="soft" disabled={busy} onPress={() => {
      setRows(previous => previous.map(row => {
        const parsed = splitTrackTitle(row.title);
        return { ...row, title: parsed.title || row.title, artist: row.artist || parsed.artist };
      }));
    }} />
    <Text style={{ fontWeight: '800', marginTop: 4 }}>Проверка перед сохранением</Text>
    {rows.map(row => <View key={row.id} style={{ borderTopWidth: 1, borderColor: '#e8e8ec', paddingTop: 8, gap: 5 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: opened === row.id }} disabled={busy}
        onPress={() => setOpened(opened === row.id ? undefined : row.id)}>
        <Text style={{ fontWeight: '800', color: row.title.trim() ? '#25252e' : '#a61028' }}>{row.title.trim() || 'Укажи название'}</Text>
        <Text style={{ color: '#62626b' }}>{[row.artist, row.album, row.genre].filter(Boolean).join(' · ') || 'Открыть поля трека'}</Text>
      </Pressable>
      {opened === row.id && <>
        <Field label="Название" value={row.title} onChangeText={title => change(row.id, { title })} maxLength={150} />
        {textFields.map(field => <Field key={field.name} label={field.label} value={row[field.name]} maxLength={field.max}
          onChangeText={value => change(row.id, { [field.name]: value })} />)}
        <TrackVersionPicker value={row.version_kind} onChange={version_kind => change(row.id, { version_kind })} />
      </>}
    </View>)}
    <PrimaryButton title={'Сохранить изменения · ' + dirty.length} disabled={invalid || !dirty.length} loading={busy} onPress={() => void save()} />
  </CollectionPanel>;
}
