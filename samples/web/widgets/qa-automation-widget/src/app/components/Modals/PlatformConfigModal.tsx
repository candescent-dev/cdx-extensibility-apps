import React from 'react';
import BaseModal from './BaseModal';
import { Box, Typography, Skeleton } from '@mui/material';

interface PlatformConfig {
  environment: string;
  apiBaseUrl: string;
  features: Record<string, boolean>;
}

interface PlatformConfigModalProps {
  config: PlatformConfig | null;
  onClose: () => void;
  /** Optional container element (e.g. widget root) so the modal opens near the embed point when embedded in a host. */
  container?: HTMLElement | null;
}

const CONFIG_FIELDS = [
  { label: 'Environment', key: 'environment' as const },
  { label: 'API URL', key: 'apiBaseUrl' as const },
  { label: 'Features', key: 'features' as const },
];

/**
 * Platform Config Modal component
 * @component
 */
const PlatformConfigModal: React.FC<PlatformConfigModalProps> = ({ config, onClose, container }) => {
  const loading = config === null;

  return (
    <BaseModal title="Platform Config" onClose={onClose} container={container}>
      <Box sx={{ p: '20px 24px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading ? (
          CONFIG_FIELDS.map(({ label }) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: '16px' }}>
              <Skeleton variant="text" width={100} height={20} />
              <Skeleton variant="text" width={200} height={20} />
            </Box>
          ))
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: '6px' }}>
              <Typography variant="body2" fontWeight={500} color="text.primary">
                Environment:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {config.environment || 'N/A'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: '6px' }}>
              <Typography variant="body2" fontWeight={500} color="text.primary">
                API URL:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {config.apiBaseUrl || 'N/A'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: '6px' }}>
              <Typography variant="body2" fontWeight={500} color="text.primary">
                Features:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {config.features
                  ? `${Object.values(config.features).filter(Boolean).length} enabled`
                  : 'N/A'}
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </BaseModal>
  );
};

export default PlatformConfigModal;