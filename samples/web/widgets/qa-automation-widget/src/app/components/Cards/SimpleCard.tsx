import React from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

interface SimpleCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
}

/**
 * Simple card component for displaying information with an icon
 * @component
 */
const SimpleCard: React.FC<SimpleCardProps> = ({ title, subtitle, icon, onClick }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      sx={{
        cursor: 'pointer',
        width: '100%',
        '&:hover': { boxShadow: 2 },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} color="text.primary">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        {icon}
      </CardContent>
    </Card>
  );
};

export default SimpleCard;