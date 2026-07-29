/**
 * TypingIndicator Component
 *
 * Shows visual feedback when the agent is processing
 */

import React from 'react';
import type { BrandingConfig } from '../types/branding';
import { defaultBranding } from '../types/branding';

interface TypingIndicatorProps {
  branding: BrandingConfig;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ branding }) => {
  // Use provided branding or fallback to default
  const effectiveBranding = branding || defaultBranding;

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: effectiveBranding.spacing.medium,
    maxWidth: '70%',
    backgroundColor: effectiveBranding.colors.surface,
    borderRadius: '12px',
    marginBottom: effectiveBranding.spacing.small,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  const dotStyle: React.CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: effectiveBranding.colors.textSecondary,
    margin: '0 3px',
    animation: 'typingAnimation 1.4s infinite',
  };

  return (
    <>
      <style>
        {`
          @keyframes typingAnimation {
            0%, 60%, 100% {
              transform: translateY(0);
            }
            30% {
              transform: translateY(-10px);
            }
          }

          .typing-dot:nth-child(1) {
            animation-delay: 0s;
          }

          .typing-dot:nth-child(2) {
            animation-delay: 0.2s;
          }

          .typing-dot:nth-child(3) {
            animation-delay: 0.4s;
          }
        `}
      </style>
      <div style={containerStyle}>
        <div className="typing-dot" style={dotStyle}></div>
        <div className="typing-dot" style={dotStyle}></div>
        <div className="typing-dot" style={dotStyle}></div>
      </div>
    </>
  );
};
