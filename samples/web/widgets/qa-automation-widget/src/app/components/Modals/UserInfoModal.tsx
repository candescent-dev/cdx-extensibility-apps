import React from 'react';
import { UserContext } from '@cdx-extensions/di-sdk-types';
import BaseModal from './BaseModal';
import { Box, Typography, Skeleton } from '@mui/material';

interface UserInfoModalProps {
  user?: UserContext;
  onClose: () => void;
  /** Optional container element (e.g. widget root) so the modal opens near the embed point when embedded in a host. */
  container?: HTMLElement | null;
}

const USER_FIELDS = [
  { label: 'GUID', key: 'guid' as const },
  { label: 'First Name', key: 'firstName' as const },
  { label: 'Last Name', key: 'lastName' as const },
  { label: 'Full Name', key: 'fullName' as const },
  { label: 'Username', key: 'userName' as const },
  { label: 'Email', key: 'email' as const },
  { label: 'Institution User ID', key: 'institutionUserId' as const },
  { label: 'Institution User Role', key: 'institutionUserRole' as const },
  { label: 'Institution User Type', key: 'institutionUserType' as const },
  { label: 'Institution ID', key: 'institutionId' as const },
];

/**
 * User Information Modal component
 * @component
 */
const UserInfoModal: React.FC<UserInfoModalProps> = ({ user, onClose, container }) => {
  const loading = user === undefined;

  return (
    <BaseModal title="User Information" onClose={onClose} container={container}>
      <Box sx={{ p: '20px 24px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {loading ? (
          USER_FIELDS.map(({ label }) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: '16px' }}>
              <Skeleton variant="text" width={140} height={20} />
              <Skeleton variant="text" width={180} height={20} />
            </Box>
          ))
        ) : (
          USER_FIELDS.map(({ label, key }) => (
            <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: '6px' }}>
              <Typography variant="body2" fontWeight={500} color="text.primary">
                {label}:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.[key] || 'N/A'}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </BaseModal>
  );
};

export default UserInfoModal;
