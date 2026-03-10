import React from 'react';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

/**
 * Loading spinner component
 * @component
 * @param {Object} props - Component props
 * @param {number} [props.size=20] - Spinner size in pixels
 * @param {string} [props.color='#9E9E9E'] - Spinner color
 * @returns {JSX.Element} Loading spinner SVG
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 20,
  color = '#9E9E9E',
}) => (
  <div style={{ display: 'inline-block' }}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="loading-spinner"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="31.416"
        strokeDashoffset="31.416"
        fill="none"
        opacity="0.3"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="31.416"
        strokeDashoffset="23.562"
        fill="none"
        style={{
          transformOrigin: '12px 12px',
          animation: 'spin 1s linear infinite',
        }}
      />
    </svg>
  </div>
);

export default LoadingSpinner;