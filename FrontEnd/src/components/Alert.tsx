import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import clsx from 'clsx';

interface AlertProps {
  type?: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  onClose,
}) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };

  const icons = {
    error: <FiAlertCircle className="text-red-600" />,
    success: <FiCheckCircle className="text-green-600" />,
    info: <FiInfo className="text-blue-600" />,
  };

  return (
    <div
      className={clsx(
        'border rounded-lg p-4 flex items-start justify-between gap-4',
        styles[type]
      )}
    >
      <div className="flex items-start gap-3">
        {icons[type]}
        <div>
          {title && <h3 className="font-medium">{title}</h3>}
          <p className="text-sm">{message}</p>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="hover:opacity-70">
          <FiX />
        </button>
      )}
    </div>
  );
};
