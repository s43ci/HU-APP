import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { formatReport, logError } from '@/lib/log';

/** Shown when a screen crashes while rendering. Uses plain styles so it works even if the store failed. */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    logError('screen', error);
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F4F8', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#17172B' }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: '#7C7C93', textAlign: 'center', lineHeight: 20 }}>{error.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#493BEA', borderRadius: 999, paddingHorizontal: 26, paddingVertical: 13, marginTop: 10 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try again</Text>
      </Pressable>
      <Pressable onPress={async () => Share.share({ message: await formatReport() })} style={{ paddingVertical: 10 }}>
        <Text style={{ color: '#493BEA', fontWeight: '600' }}>Share error log</Text>
      </Pressable>
      <Pressable onPress={() => router.replace('/')} style={{ paddingVertical: 6 }}>
        <Text style={{ color: '#7C7C93' }}>Go home</Text>
      </Pressable>
    </View>
  );
}
