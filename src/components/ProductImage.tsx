import placeholderProduct from '@/assets/placeholder-product.png';
import placeholderManual from '@/assets/placeholder-manual-item.png';

interface Props {
  src?: string | null;
  itemType?: 'product' | 'manual';
  alt?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-20 w-20',
};

export default function ProductImage({ src, itemType = 'product', alt = '', className = '', size = 'md' }: Props) {
  const imgSrc = src || (itemType === 'manual' ? placeholderManual : placeholderProduct);

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      className={`rounded-lg object-cover ${sizeClasses[size]} ${className}`}
    />
  );
}
