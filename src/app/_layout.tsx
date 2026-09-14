import {
  Figtree_400Regular,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { I18nProvider } from '@/i18n';
import { initAutoBackup } from '@/lib/backup';
// Side-effect import: defines the background location task on app launch,
// so arrival detection keeps working when the app is backgrounded.
import '@/lib/followingLocation';
import { ground } from '@/theme/tokens';

// App-wide: watch the store and write the auto-backup bundle. Must run from
// app start, not from the lazily-mounted Settings tab.
initAutoBackup();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Patched Caprasimo with Polish glyphs (scripts/patch-caprasimo-pl.py) —
    // upstream Caprasimo has no latin-ext, so ą/ę/ł/ż etc. fell back to the
    // system font. Same key as before, so fonts.heading keeps working.
    Caprasimo_400Regular: require('../../assets/fonts/CaprasimoPL.ttf'),
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <View style={{ flex: 1, backgroundColor: ground.bg }}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: ground.bg },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="park/[id]" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="stamp-success" options={{ animation: 'fade' }} />
            {/* Custom-trip preview: a real pushed screen, so the Android back
                gesture / button and the iOS edge swipe dismiss it. */}
            <Stack.Screen name="trip-preview" />
            <Stack.Screen name="stamp-viewer" options={{ presentation: 'modal' }} />
            <Stack.Screen
              name="milestone"
              options={{ presentation: 'transparentModal', animation: 'fade' }}
            />
          </Stack>
        </View>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
