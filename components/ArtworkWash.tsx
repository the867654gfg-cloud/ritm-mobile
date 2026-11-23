import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, StyleSheet, View } from 'react-native';

export function ArtworkWash({ uri, opacity }: { uri?: string; opacity: number }) {
  const [previous, setPrevious] = useState<string>();
  const current = useRef(uri);
  current.current = uri;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.stopAnimation();
    fade.setValue(0);
    if (!uri) setPrevious(undefined);
    return () => fade.stopAnimation();
  }, [fade, uri]);

  if (!uri && !previous) return null;
  const imageStyle = [StyleSheet.absoluteFill, { width: '100%' as const, height: '100%' as const }];
  return (
    <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity }]}>
      {!!previous && previous !== uri && <Image source={{ uri: previous }} style={imageStyle} resizeMode="cover" blurRadius={36} />}
      {!!uri && <Animated.Image key={uri} source={{ uri }} style={[imageStyle, { opacity: uri === previous ? 1 : fade }]}
        resizeMode="cover" blurRadius={36} fadeDuration={0}
        onLoad={() => {
          if (current.current !== uri || uri === previous) return;
          Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' })
            .start(({ finished }) => { if (finished && current.current === uri) setPrevious(uri); });
        }}
        onError={() => { if (current.current === uri) setPrevious(undefined); }} />}
    </View>
  );
}
