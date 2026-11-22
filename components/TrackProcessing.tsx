import { useEffect, useState } from 'react';
import { Pressable, Text, View, useColorScheme } from 'react-native';
import { supabase } from '../lib/supabase';

type Job = { track_id: string; status: 'queued' | 'processing' | 'ready' | 'error' };
const labels = { queued: 'В очереди HLS', processing: 'Обрабатывается', ready: 'HLS готов', error: 'Ошибка обработки' };

export function useTrackProcessing(owner: string | undefined, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<{ owner: string; jobs: Record<string, Job['status']> } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const client = supabase;
    if (!client || !owner || !enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const jobs: Record<string, Job['status']> = {};
      const limit = 250;
      for (let start = 0; ; start += limit) {
        const response = await client.from('ritm_media_jobs').select('track_id,status').eq('owner_id', owner)
          .order('track_id').range(start, start + limit - 1).abortSignal(controller.signal);
        if (controller.signal.aborted || response.error) return;
        for (const job of response.data as Job[]) jobs[job.track_id] = job.status;
        if (response.data.length < limit) break;
      }
      setSnapshot({ owner, jobs });
      timer = setTimeout(load, 15_000);
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [owner, enabled, revision]);
  return {
    jobs: snapshot?.owner === owner ? snapshot?.jobs : undefined,
    refresh: () => setRevision(value => value + 1),
  };
}

export function TrackProcessing({ trackId, status, refresh }: { trackId: string; status?: Job['status']; refresh: () => void }) {
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const text = useColorScheme() === 'dark' ? '#fff' : '#18181a';
  if (!status) return null;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
    <Text style={{ color: text, opacity: 0.75, fontSize: 12 }}>{retryFailed && status === 'error' ? 'Не удалось перезапустить обработку' : labels[status]}</Text>
    {status === 'error' && <Pressable accessibilityRole="button" disabled={retrying} onPress={async () => {
      if (!supabase) return;
      setRetrying(true);
      setRetryFailed(false);
      try {
        const { data, error } = await supabase.rpc('ritm_retry_media_job', { track_key: trackId });
        if (error || !data) setRetryFailed(true);
        else refresh();
      } catch { setRetryFailed(true); }
      finally { setRetrying(false); }
    }}><Text style={{ color: text }}>Повторить</Text></Pressable>}
  </View>;
}
