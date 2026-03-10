import React from 'react';
import { Box } from '@mui/material';

/** Path from src/assets/icons/CheckCircleOutline.svg – inlined to avoid SVG import as URL in Module Federation. */
const CHECK_CIRCLE_OUTLINE_PATH =
  'M16.59 7.58L10 14.17L6.41 10.59L5 12L10 17L18 9L16.59 7.58ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.58 20 4 16.42 4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20Z';

interface CheckCircleOutlineIconProps {
  /** Theme-aware color (e.g. 'primary.main'). Omit to use primary.main. */
  color?: string;
  width?: number;
  height?: number;
}

/** Check circle outline icon (success indicator) – uses currentColor. Wrapper sets color from theme. Path matches CheckCircleOutline.svg. */
const CheckCircleOutlineIcon: React.FC<CheckCircleOutlineIconProps> = ({
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
      <path d={CHECK_CIRCLE_OUTLINE_PATH} fill="currentColor" />
    </svg>
  </Box>
);

export default CheckCircleOutlineIcon;