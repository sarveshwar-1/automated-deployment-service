import React from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => (
  <div
    className={clsx(
      'bg-white rounded-lg shadow-md hover:shadow-lg',
      'transition-shadow duration-200 p-6',
      className
    )}
  >
    {children}
  </div>
);
