import { useMemo } from 'react';
import { PanResponder, Platform, Text, View } from 'react-native';

export function QueueOrderHandle({ title, index, count, move }: {
  title: string; index: number; count: number; move: (from: number, to: number) => void;
}) {
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => count > 1 && Math.abs(gesture.dy) >= 5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gesture) => {
      const destination = Math.min(count - 1, Math.max(0, index + Math.round(gesture.dy / 48)));
      move(index, destination);
    },
  }), [index, count, move]);
  return <View {...responder.panHandlers} accessible accessibilityLabel={'Переместить ' + title}
    accessibilityRole="adjustable" accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    onAccessibilityAction={event => move(index, index + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
    style={{ width: 40, height: 48, alignItems: 'center', justifyContent: 'center', ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}) }}>
    <Text style={{ fontSize: 22, color: '#bd4563' }}>≡</Text>
  </View>;
}
