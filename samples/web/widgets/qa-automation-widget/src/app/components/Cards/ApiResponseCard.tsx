import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { CheckCircleOutlineIcon, ErrorOutlineIcon, CloseIcon } from '../Icons';

interface ApiResponseCardProps {
  testResult: 'success' | 'error';
  testResponse: any;
  /** HTTP status code from the response (e.g. 200, 404, 500). Shown instead of generic OK/Error when set. */
  statusCode?: number | null;
  /** Request URL that was called (e.g. /api/demo/account-summary). Shown in the card when set. */
  requestUrl?: string | null;
  /** HTTP method (e.g. GET, POST). Displayed with requestUrl when set. */
  requestMethod?: string;
  /** Called when the user clicks the close button. When provided, a close (X) button is shown. */
  onClose?: () => void;
  formatJSON: (obj: any, indent?: number) => string;
}

/**
 * API Response Card component
 * @component
 */
const ApiResponseCard: React.FC<ApiResponseCardProps> = ({
  testResult,
  testResponse,
  statusCode,
  requestUrl,
  requestMethod = 'GET',
  onClose,
  formatJSON,
}) => {
  const [copied, setCopied] = useState(false);
  if (!testResponse) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatJSON(testResponse));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const statusLabel =
    statusCode != null ? `Status: ${statusCode}` : testResult === 'success' ? 'Status: OK' : 'Status: Error';

  return (
    <Card sx={{ width: '100%', bgcolor: 'grey.50' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1,
          px: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {testResult === 'success' ? (
            <CheckCircleOutlineIcon />
          ) : (
            <ErrorOutlineIcon />
          )}
          <Typography variant="subtitle1" fontWeight={600} color="text.primary">
            API Response
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy response'} placement="left">
            <IconButton
              onClick={handleCopy}
              aria-label="Copy API response"
              size="small"
              sx={{
                p: 0.5,
                minWidth: 32,
                minHeight: 32,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                  borderColor: 'text.secondary',
                },
                '& svg': { width: 18, height: 18 },
              }}
            >
              {copied ? (
                <CheckIcon sx={{ fontSize: 18 }} color="success" />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
          {onClose && (
            <Tooltip title="Close" placement="left">
              <IconButton
                onClick={onClose}
                aria-label="Close API response"
                size="small"
                sx={{
                  p: 0.5,
                  minWidth: 32,
                  minHeight: 32,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                  '&:hover': {
                    bgcolor: 'action.selected',
                    borderColor: 'text.secondary',
                  },
                  '& svg': { width: 18, height: 18 },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
      {requestUrl && (
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50',
          }}
        >
          <Typography
            variant="body2"
            component="code"
            sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
          >
            {requestMethod} {requestUrl}
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <Typography
          variant="body2"
          color={testResult === 'success' ? 'text.secondary' : 'error.main'}
        >
          {statusLabel}
        </Typography>
      </Box>
      <CardContent sx={{ bgcolor: 'grey.50' }}>
        <Typography
          component="pre"
          variant="body2"
          sx={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
            m: 0,
          }}
        >
          {formatJSON(testResponse)}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default ApiResponseCard;