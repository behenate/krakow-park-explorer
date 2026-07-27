import { Linking, Platform } from 'react-native';

/**
 * Open the platform's native maps app at the given coordinates.
 * Falls back to Google Maps on the web if the native scheme fails.
 */
export function openNativeMaps(lat: number, lng: number, label: string) {
  const encoded = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${encoded}@${lat},${lng}`
      : `geo:0,0?q=${lat},${lng}(${encoded})`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  });
}
