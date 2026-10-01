import { useState } from 'react';
import { View, TextInput, FlatList, Text, Pressable, Image } from 'react-native';
import { useMusic } from '../../lib/music';
import { coverFor } from '../../lib/music-data';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const m = useMusic();

  const filtered = m.tracks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: '#121214', padding: 16 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Поиск песни..."
        placeholderTextColor="#666"
        style={{
          backgroundColor: '#1c1c22',
          color: '#fff',
          padding: 14,
          borderRadius: 12,
          marginBottom: 16,
          fontSize: 16,
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => m.playTrack(item)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
          >
            <Image source={coverFor(item.cover_key)} style={{ width: 40, height: 40, borderRadius: 6, marginRight: 12 }} />
            <Text style={{ color: '#fff', fontSize: 16 }}>{item.title}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
