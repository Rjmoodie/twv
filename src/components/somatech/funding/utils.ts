/**
 * Utility functions for campaign-related operations
 */

/**
 * Formats a number as currency (USD)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

/**
 * Calculates funding progress percentage
 */
export const calculateProgress = (current: number, target: number): number => {
  return Math.min((current / target) * 100, 100);
};

/**
 * Calculates days remaining until deadline
 */
export const getDaysLeft = (deadline: string | undefined): number | null => {
  if (!deadline) return null;
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 3600 * 24));
  return days > 0 ? days : 0;
};

/**
 * Gets appropriate color class for campaign category badge
 */
export const getCategoryBadgeColor = (category: string): string => {
  const colors: Record<string, string> = {
    car: 'bg-blue-500',
    education: 'bg-accent',
    business: 'bg-purple-500',
    medical: 'bg-destructive/100',
    emergency: 'bg-warning/100',
    housing: 'bg-yellow-500',
    other: 'bg-gray-500'
  };
  return colors[category as keyof typeof colors] || 'bg-gray-500';
};

/**
 * Capitalizes first letter of a string
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};