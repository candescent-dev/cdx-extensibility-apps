import * as React from 'react';
import CandescentMarkSvg from '../assets/candescent-symbol.svg';

type Props = {
  size: number;
};

/**
 * Header mark from `assets/candescent-symbol.svg` (bundled via `react-native-svg-transformer`).
 */
export function CandescentHeaderMark({ size }: Props) {
  return <CandescentMarkSvg width={size} height={size} accessible={false} />;
}
