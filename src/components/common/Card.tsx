import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  hoverable = false,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-subtle transition-all duration-200',
          hoverable && 'hover:shadow-card hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
