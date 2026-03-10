import React from 'react';

export interface WidgetContainerProps {
  children: React.ReactNode;
  /**
   * When true (standalone), use compact max-width and center. When false (embedded), expand to fill host container.
   */
  standalone?: boolean;
  /** Max-width when standalone (default 560). Ignored when embedded. */
  maxWidth?: number;
  /** Outer padding in pixels (default 16). */
  padding?: number;
  /** Gap between child sections in pixels (default 24). */
  gap?: number;
}

const DEFAULT_PADDING_PX = 16;
const DEFAULT_GAP_PX = 24;

/**
 * Wrapper for widget content that behaves like PlatformAppContainer:
 * provides a consistent container layout and styling regardless of host theme.
 * When embedded (standalone=false), expands to fill the host layout.
 * All styles are applied manually so the widget is host-agnostic.
 */
const WidgetContainer: React.FC<WidgetContainerProps> = ({
  children,
  standalone = false,
  maxWidth = 560,
  padding = DEFAULT_PADDING_PX,
  gap = DEFAULT_GAP_PX,
}) => {
  const containerStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    maxWidth: standalone ? maxWidth : '100%',
    marginLeft: standalone ? 'auto' : 0,
    marginRight: standalone ? 'auto' : 0,
    padding: `${padding}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: `${gap}px`,
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    boxShadow: '0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)',
    boxSizing: 'border-box',
  };

  return <div style={containerStyle}>{children}</div>;
};

export default WidgetContainer;