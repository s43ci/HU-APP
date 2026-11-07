import { StyleSheet, TextInput, View } from 'react-native';

import { Font, Type } from '@/constants/theme';
import { useApp } from '@/store/app-store';
import { Txt } from './ui';

export function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { palette: p } = useApp();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Txt weight="medium" size={Type.tiny} muted style={{ marginLeft: 4 }}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={p.textFaint}
        autoCapitalize="none"
        {...rest}
        style={[styles.input, { backgroundColor: p.surface, borderColor: p.border, color: p.text, fontFamily: Font.regular }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 13, fontSize: 14.5 },
});
