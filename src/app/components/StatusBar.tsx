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

  const tones = {
    info: 'border-blue-200',
    success: 'border-emerald-200',
    warning: 'border-amber-200',
    error: 'border-red-200',
  };

  const iconTones = {
    info: 'text-blue-600',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-red-600',
  };

  const Icon = icons[status.type];

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm text-gray-800 shadow-lg sm:left-auto sm:max-w-sm ${tones[status.type]}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${iconTones[status.type]}`} />
      <span className="min-w-0">{status.message}</span>
    </div>
  );
}
