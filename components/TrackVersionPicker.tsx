import { Pressable, Text, View } from 'react-native';
import { TRACK_VERSIONS, type TrackVersion } from '../lib/catalog-search';

export function TrackVersionPicker({ value, onChange, emptyLabel = 'По названию' }: {
  value: TrackVersion | null; onChange: (value: TrackVersion | null) => void; emptyLabel?: string;
}) {
  const options = [[null, emptyLabel] as const, ...Object.entries(TRACK_VERSIONS) as [TrackVersion, string][]];
  return <View style={{ gap: 6 }}>
    <Text style={{ color: '#292930', fontWeight: '700' }}>Версия трека</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([key, label]) => <Pressable key={key ?? 'default'} accessibilityRole="button" accessibilityState={{ selected: value === key }}
        onPress={() => onChange(key)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: value === key ? '#fa233b' : '#f0f0f4' }}>
        <Text style={{ color: value === key ? '#fff' : '#292930', fontWeight: '700' }}>{label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
