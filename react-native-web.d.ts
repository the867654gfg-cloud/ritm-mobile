// Веб-свойства стилей, которые понимает react-native-web, но нет в типах React Native.
// Без этого файла TypeScript ругается на outlineStyle, backdropFilter и boxShadow.
import 'react-native';

declare module 'react-native' {
  interface ViewStyle {
    outlineStyle?: 'none' | 'solid' | 'dotted' | 'dashed';
    backdropFilter?: string;
    boxShadow?: string;
    cursor?: string;
  }
  interface TextStyle {
    outlineStyle?: 'none' | 'solid' | 'dotted' | 'dashed';
  }
}
