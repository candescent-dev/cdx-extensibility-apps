import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as React from 'react';
import { SANDBOX_ICON_SIZE } from './iconSizes';

export type SandboxMaterialIconProps = React.ComponentProps<typeof MaterialIcons>;

/**
 * Material Icons with playground defaults (`name`, `size`, `color`).
 */
export function SandboxMaterialIcon({
  size = SANDBOX_ICON_SIZE.rowLeading,
  ...rest
}: SandboxMaterialIconProps) {
  return <MaterialIcons size={size} {...rest} />;
}
