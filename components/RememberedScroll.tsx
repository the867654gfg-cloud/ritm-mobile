import { useRef, type ComponentProps } from 'react';
import { ScrollView } from 'react-native';

export function RememberedScroll({ position, ...props }: ComponentProps<typeof ScrollView> & { position: { y: number } }) {
  const view = useRef<ScrollView>(null);
  const target = useRef(position.y);
  const restoring = useRef(target.current > 0);
  const viewport = useRef(0);
  const content = useRef(0);
  function restore() {
    if (!restoring.current || !viewport.current || content.current - viewport.current < target.current) return;
    restoring.current = false;
    view.current?.scrollTo({ y: target.current, animated: false });
  }
  return <ScrollView {...props} ref={view} scrollEventThrottle={32}
    onLayout={event => { viewport.current = event.nativeEvent.layout.height; restore(); }}
    onContentSizeChange={(_, height) => { content.current = height; restore(); }}
    onScroll={event => {
      const y = event.nativeEvent.contentOffset.y;
      if (restoring.current && y === 0) return;
      restoring.current = false;
      position.y = y;
    }} />;
}
