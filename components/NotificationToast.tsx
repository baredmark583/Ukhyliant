
import React, { useEffect, useState } from 'react';

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
  const bgColor = isSuccess ? 'bg-green-500' : 'bg-red-500';
  const icon = isSuccess ? '✅' : '❌';

  return (
    <div
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 shadow-lg text-white font-semibold flex items-center gap-3 border border-black/20
                  ${bgColor} ${visible ? 'animate-toast-in' : 'animate-toast-out'}`}
    >
      <span className="text-xl">{icon}</span>
      <span>{notification.message}</span>
      <style>{`
        @keyframes toast-in {
          0% { transform: translate(-50%, 100%); opacity: 0; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes toast-out {
          0% { transform: translate(-50%, 0); opacity: 1; }
          100% { transform: translate(-50%, 100%); opacity: 0; }
        }
        .animate-toast-in { animation: toast-in 0.3s ease-out forwards; }
        .animate-toast-out { animation: toast-out 0.3s ease-in forwards; }
      `}</style>
    </div>
  );
};

export default NotificationToast;