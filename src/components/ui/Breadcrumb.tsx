import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex items-center space-x-1.5 text-xs text-[#4a5e3a] py-2 px-4 overflow-x-auto no-scrollbar">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#3d6b2e] shrink-0" />}
            {item.path && !isLast ? (
              <Link
                to={item.path}
                className="hover:text-[#1e3a0f] hover:underline font-medium shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`shrink-0 ${isLast ? 'font-bold text-[#1e3a0f]' : ''}`}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
