import { StyleSheet, TextInput, View } from 'react-native';

import { Font } from '@/constants/theme';
import { useApp } from '@/store/app-store';
import { Txt } from './ui';

export function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { palette: p } = useApp();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Txt weight="semibold" size={14} muted>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={p.textMuted}
        autoCapitalize="none"
        {...rest}
        style={[styles.input, { backgroundColor: p.surface, borderColor: p.border, color: p.text, fontFamily: Font.medium }, style]}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
});
