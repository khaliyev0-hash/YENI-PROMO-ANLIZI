import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSortField: string;
  sortAsc: boolean;
  onSort: (field: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  title?: string;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  field,
  currentSortField,
  sortAsc,
  onSort,
  align = 'left',
  className = '',
  title
}) => {
  const isActive = currentSortField === field;

  const alignClasses =
    align === 'right'
      ? 'justify-end text-right'
      : align === 'center'
      ? 'justify-center text-center'
      : 'justify-start text-left';

  const defaultTitle = title || `${label} üzrə ${isActive ? (sortAsc ? 'Böyükdən Kiçiyə (Z-A / Azalan)' : 'Kiçikdən Böyüyə (A-Z / Artan)') : 'Böyükdən Kiçiyə'} sırala`;

  return (
    <th
      onClick={() => onSort(field)}
      className={`p-2.5 sm:p-3 cursor-pointer select-none transition-all group ${
        isActive
          ? 'bg-blue-100/70 text-blue-900 font-extrabold'
          : 'hover:bg-slate-200/80 text-slate-700'
      } ${className}`}
      title={defaultTitle}
    >
      <div className={`flex items-center space-x-1.5 ${alignClasses}`}>
        <span className="truncate">{label}</span>
        <span className="inline-flex shrink-0">
          {isActive ? (
            sortAsc ? (
              <ArrowUp className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      </div>
    </th>
  );
};
