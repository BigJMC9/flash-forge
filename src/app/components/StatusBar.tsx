import { useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

export function StatusBar() {
  const { status, setStatus } = useApp();

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => {
        setStatus(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [status, setStatus]);

  if (!status) return null;

  const icons = {
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle,
  };

  const colors = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  };

  const Icon = icons[status.type];

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg border flex items-center gap-3 shadow-lg z-50 ${colors[status.type]}`}
    >
      <Icon className="w-5 h-5" />
      <span>{status.message}</span>
    </div>
  );
}
