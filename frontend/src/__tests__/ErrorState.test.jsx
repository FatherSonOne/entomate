/**
 * ErrorState Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorState from '../components/vc/ErrorState';

describe('ErrorState', () => {
  it('should render with default message when no message provided', () => {
    render(<ErrorState />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An error occurred while loading this page.')).toBeInTheDocument();
  });

  it('should render with custom message', () => {
    render(<ErrorState message="Failed to load meetings" />);

    expect(screen.getByText('Failed to load meetings')).toBeInTheDocument();
  });

  it('should show Try Again button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should not show Try Again button when onRetry is not provided', () => {
    render(<ErrorState message="Error" />);

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('should call onRetry when Try Again button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should render the icon', () => {
    const { container } = render(<ErrorState />);

    // Default icon is AlertTriangle from lucide-react, rendered as SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should accept a custom icon component', () => {
    function CustomIcon({ size, style }) {
      return <span data-testid="custom-icon" style={style}>Icon</span>;
    }

    render(<ErrorState icon={CustomIcon} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
