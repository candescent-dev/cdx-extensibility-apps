import React from 'react';
import { Container } from '@mui/material';

interface MaterialContainerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const MaterialContainer: React.FC<MaterialContainerProps> = ({ children, style }) => {
  return (
    <Container style={style}>
      {children}
    </Container>
  );
};

export default MaterialContainer;