import React from 'react';
import { Beef, Milk, Sparkles, Zap, PawPrint, Grid } from 'lucide-react';
import { CategoryId } from '../../types';

interface CategoryIconProps {
  id: CategoryId | 'all';
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ id, className = "w-5 h-5", size }) => {
  switch (id) {
    case 'gosht':
      return <Beef className={className} size={size} />;
    case 'sut-tuxum':
      return <Milk className={className} size={size} />;
    case 'korkam':
      return <Sparkles className={className} size={size} />;
    case 'sport-transport':
      return <Zap className={className} size={size} />;
    case 'pet':
      return <PawPrint className={className} size={size} />;
    case 'all':
    default:
      return <Grid className={className} size={size} />;
  }
};
