import { Image, type ImageProps } from 'expo-image';

import { useImageUri } from '@/lib/image-store';

/** <Image> for booklet pictures stored on the device (file://, data:, or web IndexedDB "idb:" keys). */
export function StoredImage({ uri, ...rest }: Omit<ImageProps, 'source'> & { uri: string }) {
  const resolved = useImageUri(uri);
  return <Image {...rest} source={resolved ? { uri: resolved } : undefined} />;
}
