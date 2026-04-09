import React from 'react';
import { Box } from '@mui/material';

/** Inlined path; avoids SVG-as-URL in Module Federation. */
const BOLT_PATH =
  'M11 21H9.99999L11 14H7.49999C6.91999 14 6.92999 13.68 7.11999 13.34C7.30999 13 7.16999 13.26 7.18999 13.22C8.47999 10.94 10.42 7.54 13 3H14L13 10H16.5C16.99 10 17.06 10.33 16.97 10.51L16.9 10.66C12.96 17.55 11 21 11 21Z';

interface BoltIconProps {
  /** Theme-aware color (e.g. 'primary.main'). Omit to use primary.main. */
  color?: string;
  width?: number;
  height?: number;
}

/** Bolt icon – uses currentColor. Wrapper sets color from theme. */
const BoltIcon: React.FC<BoltIconProps> = ({
  color = 'primary.main',
  width = 24,
  height = 24,
}) => (
  <Box
    component="span"
    sx={{
      color,
      display: 'inline-flex',
      lineHeight: 0,
    }}
  >
    <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={BOLT_PATH} fill="currentColor" />
    </svg>
  </Box>
);

export default BoltIcon;