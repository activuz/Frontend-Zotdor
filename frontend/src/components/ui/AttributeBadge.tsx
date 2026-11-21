import React from 'react';

interface AttributeCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export const AttributeBadgeCard: React.FC<AttributeCardProps> = ({ icon, label, value }) => {
  return (
    <div className="bg-white p-3 rounded-2xl border border-[#c5d4a8] shadow-sm flex items-center space-x-3">
      <div className="w-10 h-10 rounded-xl bg-[#dce8c8]/60 text-[#1e3a0f] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#6b8f4e] block leading-none mb-1">
          {label}
        </span>
        <span className="text-xs sm:text-sm font-bold text-[#1e3a0f] truncate block font-display">
          {value}
        </span>
      </div>
    </div>
  );
};
