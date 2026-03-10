import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('<LoadingSpinner />', () => {
  it('renders the loading spinner', () => {
    render(<LoadingSpinner />);

    const spinner = document.querySelector('.loading-spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with custom size and color', () => {
    render(<LoadingSpinner size={32} color="#1976d2" />);

    const svg = document.querySelector('.loading-spinner');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });
});
