/**
 * Mobile Sandbox entry point.
 *
 * BrandingProvider wraps the entire tree so every screen and widget can
 * call useBranding() / useBrandingContext() and receive the currently
 * selected mock branding. The default mock is 'branding-default'.
 *
 * PlatformSDK.init() wires the harness MobilePlatform as the active
 * platform, so widgets calling PlatformSDK.getInstance().useBranding()
 * get the same context-driven branding.
 */
import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppTabs } from './navigation/tabs';

import { PlatformSDK } from '@cdx-extensions/di-sdk';
import { MobilePlatform, BrandingProvider } from '@cdx-extensions/di-sdk-mobile';

PlatformSDK.init({ platform: MobilePlatform.getInstance() });

export default function App() {
  return (
    <BrandingProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppTabs />
        </NavigationContainer>
      </SafeAreaProvider>
    </BrandingProvider>
  );
}
