import React, { useEffect, useState } from 'https://esm.sh/react';

interface NotificationToastProps {
  notification: {
    message: string;
    type: 'success' | 'error';
  } | null;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ notification }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 2800); // A bit less than the App's timeout to allow for fade-out
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!notification) {
    return null;
  }

  const isSuccess = notification.type === 'success';
  const borderColorClass = isSuccess ? 'border-l-[var(--accent-color)]' : 'border-l-[var(--error-color)]';

  return (
    <div
      className={`fixed bottom-28 left-1/2 -translate-x-1/2 w-11/12 max-w-sm px-4 py-3 shadow-2xl text-white font-semibold flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/90 backdrop-blur-sm z-[100] border-l-4 ${borderColorClass} ${visible ? 'animate-toast-in' : 'animate-toast-out'}`}
    >
      <span className="text-sm" dangerouslySetInnerHTML={{ __html: notification.message }} />
      <style>{`
        @keyframes toast-in {
          0% { transform: translate(-50%, 150%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes toast-out {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, 150%); opacity: 0; }
        }
        .animate-toast-in { animation: toast-in 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .animate-toast-out { animation: toast-out 0.3s cubic-bezier(0.5, 0, 0.75, 0) forwards; }
      `}</style>
    </div>
  );
};

export default NotificationToast;