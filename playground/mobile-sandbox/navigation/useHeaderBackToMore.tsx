import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import {
  type NavigationProp,
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';

import { SandboxMaterialIcon } from '../icons/SandboxMaterialIcon';
import { SANDBOX_ICON_SIZE } from '../icons/iconSizes';
import { useBrandingContext } from '@cdx-extensions/di-sdk-mobile';
import { brandingUiColors } from '../utils/brandingUiColors';
import type { RootTabParamList } from './types';

type MoreBackTabName = keyof Pick<RootTabParamList, 'AgentChat' | 'Payments' | 'Transfers'>;

/**
 * When a tab was opened from the More menu (`fromMore` param), show a header back control
 * that returns to the More tab. Params are cleared when the screen loses focus.
 */
export function useHeaderBackToMore<T extends MoreBackTabName>(_scope: T) {
  const navigation = useNavigation<NavigationProp<RootTabParamList>>();
  const route = useRoute<RouteProp<RootTabParamList, T>>();
  const { theme } = useBrandingContext();
  const ui = brandingUiColors(theme);

  const fromMore = route.params?.fromMore === true;

  React.useLayoutEffect(() => {
    if (!fromMore) {
      navigation.setOptions({
        headerLeft: undefined,
        headerBackVisible: true,
      });
      return;
    }
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.navigate('More')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.headerBackHit}
          accessibilityRole="button"
          accessibilityLabel="Back to More menu"
        >
          <SandboxMaterialIcon
            name="arrow-back"
            size={SANDBOX_ICON_SIZE.header}
            color={ui.headerForegroundColor}
          />
        </Pressable>
      ),
    });
  }, [fromMore, navigation, ui.headerForegroundColor]);

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        if (route.params?.fromMore) {
          navigation.setParams({ fromMore: undefined } as Partial<RootTabParamList[T]>);
        }
      };
    }, [navigation, route.params?.fromMore]),
  );
}

const styles = StyleSheet.create({
  headerBackHit: {
    marginLeft: 4,
    padding: 4,
  },
});
