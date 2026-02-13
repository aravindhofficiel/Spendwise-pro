/**
 * Loading Spinner Component
 * Shows loading state with a spinner
 */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Get spinner size classes
 */
const getSizeClasses = (size: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'w-4 h-4';
    case 'lg':
      return 'w-12 h-12';
    default:
      return 'w-8 h-8';
  }
};

/**
 * Loading Spinner Component
 */
const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${getSizeClasses(
          size
        )} border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
};

export default LoadingSpinner;
