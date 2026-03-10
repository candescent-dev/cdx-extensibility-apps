import React from 'react';
import { Modal, Box, Typography, IconButton } from '@mui/material';
import { CloseIcon } from '../Icons';

interface BaseModalProps {
  title: string;
  onClose: () => void;
  /** When set (e.g. widget root element), the modal is rendered inside this container so it opens near the embed point instead of the host page center. */
  container?: HTMLElement | null;
  children: React.ReactNode;
}

/**
 * Base Modal component
 * @component
 */
const BaseModal: React.FC<BaseModalProps> = ({ title, onClose, container, children }) => {
  return (
    <Modal
      open
      onClose={onClose}
      container={container ?? undefined}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 4,
          width: '90%',
          minWidth: 480,
          maxWidth: 600,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: '20px 28px',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="h6" fontWeight={600} color="text.primary">
            {title}
          </Typography>
          <IconButton onClick={onClose} aria-label="Close" size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        {children}
      </Box>
    </Modal>
  );
};

export default BaseModal;