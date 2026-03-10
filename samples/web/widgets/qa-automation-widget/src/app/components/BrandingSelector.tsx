import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Box,
  Typography,
  Stack,
} from '@mui/material';

/**
 * Branding option for selector (id + name). Aligns with BrandingOption from
 * @cdx-extensions/di-sdk-types (extensibility-sdk-types). BrandingConfig is
 * defined only in web-harness (extensibility-sdk-web-harness).
 */
export interface BrandingOption {
  id: string;
  name: string;
}

/**
 * Props for the BrandingSelector component
 */
interface BrandingSelectorProps {
  /** The currently selected branding ID */
  selectedBranding: string;
  /** Callback function when branding selection changes */
  onBrandingChange: (brandingId: string) => void;
  /** Array of available branding options */
  brandingOptions: BrandingOption[];
}

/**
 * BrandingSelector Component
 *
 * Provides a UI for selecting branding themes. Displays a dropdown for branding selection.
 *
 * @param props - The BrandingSelector props
 * @returns The rendered branding selector component
 */
export const BrandingSelector: React.FC<BrandingSelectorProps> = ({
  selectedBranding,
  onBrandingChange,
  brandingOptions,
}) => {
  /**
   * Handles branding dropdown selection change
   *
   * @param event - The select change event containing the new value
   */
  const handleChange = (event: SelectChangeEvent<string>) => {
    onBrandingChange(event.target.value);
  };

  return (
    <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
      <Typography variant="h6" gutterBottom>
        Theme Configuration
      </Typography>
      <Stack spacing={2}>
        <FormControl fullWidth>
          <InputLabel id="branding-select-label">Branding Theme</InputLabel>
          <Select
            labelId="branding-select-label"
            id="branding-select"
            value={selectedBranding}
            label="Branding Theme"
            onChange={handleChange}
          >
            {brandingOptions.length > 0 ? (
              brandingOptions.map(option => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))
            ) : (
              <MenuItem value="" disabled>
                Loading options...
              </MenuItem>
            )}
          </Select>
        </FormControl>
      </Stack>
    </Box>
  );
};
