export type CtaSize = 'sm' | 'lg';

/**
 * Canonical CTA class builder, shared by every page that renders a `ctaSchema`
 * entry from the global content collection.
 *
 * `size` is optional: omit it to get the unsized base button class.
 */
export const getCtaClass = (variant?: string, size?: CtaSize): string => {
  const sizeClass = size ? ` btn-${size}` : '';

  if (variant === 'outline') return `btn-outline${sizeClass}`;
  if (variant === 'ghost') return `btn-ghost${sizeClass}`;
  if (variant === 'secondary') {
    return `btn${sizeClass} bg-primary-100 text-primary-700 hover:bg-primary-200`;
  }
  return `btn-primary${sizeClass}`;
};
