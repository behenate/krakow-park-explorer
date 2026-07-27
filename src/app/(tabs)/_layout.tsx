import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FollowingBanner } from '@/components/FollowingBanner';
import { Icon, IconName } from '@/components/Icon';
import { useI18n } from '@/i18n';
import { useAppStore } from '@/store';
import { fonts, ground, radii } from '@/theme/tokens';

const TAB_ICONS: Record<string, IconName> = {
  index: 'pin',
  route: 'route',
  booklet: 'book',
  settings: 'sli',
};

function TabBar({ state, descriptors, navigation }: any) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const labels: Record<string, string> = {
    index: t('tabExplore'),
    route: t('tabRoute'),
    booklet: t('tabBooklet'),
    settings: t('tabSettings'),
  };
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route: any, i: number) => {
        const focused = state.index === i;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={labels[route.name]}
            onPress={onPress}
            style={styles.item}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon name={TAB_ICONS[route.name]} size={22} color={focused ? ground.accent : ground.textMuted} />
            </View>
            <Text style={[styles.label, focused && styles.labelActive]}>{labels[route.name]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const onboardingDone = useAppStore((s) => s.settings.onboardingDone);
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <>
      <FollowingBanner />
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="route" />
        <Tabs.Screen name="booklet" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    // Lighter than the cream page ground and distinct from the white map
    // sheet (per design: map / sheet / tab bar are three separate surfaces).
    backgroundColor: ground.surfaceLight,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(32,30,29,0.08)',
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52, justifyContent: 'center' },
  iconWrap: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  iconWrapActive: { backgroundColor: ground.accentTint },
  label: { fontFamily: fonts.body, fontSize: 13, color: ground.textMuted },
  labelActive: { color: ground.accent, fontFamily: fonts.bodySemi },
});
