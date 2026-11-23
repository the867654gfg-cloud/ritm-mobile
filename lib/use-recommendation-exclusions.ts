import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function useRecommendationExclusions(userId?: string) {
  const [loaded, setLoaded] = useState<{ owner: string; ids: string[] }>();
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void AsyncStorage.getItem('ritm_recommendations_hidden_' + userId).then(value => {
      if (!active) return;
      let ids: string[] = [];
      try {
        const saved: unknown = JSON.parse(value ?? '[]');
        if (Array.isArray(saved)) ids = saved.filter((item): item is string => typeof item === 'string');
      } catch {}
      setLoaded({ owner: userId, ids });
    }).catch(() => { if (active) setLoaded({ owner: userId, ids: [] }); });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (loaded?.owner !== userId || !loaded) return;
    void AsyncStorage.setItem('ritm_recommendations_hidden_' + loaded.owner, JSON.stringify(loaded.ids)).catch(() => {});
  }, [loaded, userId]);
  const toggle = useCallback((id: string) => {
    if (!userId) return;
    setLoaded(previous => {
      const ids = previous?.owner === userId ? previous.ids : [];
      return { owner: userId, ids: ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] };
    });
  }, [userId]);
  return [loaded?.owner === userId ? loaded?.ids ?? [] : [], toggle] as const;
}
