import React, { useEffect, useState } from 'react';

function Toast({ message, type = 'info', onDismiss }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); setTimeout(onDismiss, 300); }, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg = type === 'success' ? 'bg-emerald-500/90' : type === 'error' ? 'bg-red-500/90' : 'bg-brand-grey-mid/90';
  return (
    <div className={`px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg backdrop-blur-sm border border-white/10 transition-all duration-300 ${bg} ${show ? 'animate-slide-up opacity-100' : 'opacity-0 translate-y-2'}`}>
      {message}
    </div>
  );
}

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => removeToast(t.id)} />)}
    </div>
  );
}
