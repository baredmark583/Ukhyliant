import React from 'https://esm.sh/react';
import ReactDOM from 'https://esm.sh/react-dom/client';
import App from './App';
import { TonConnectUIProvider } from 'https://esm.sh/@tonconnect/ui-react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <TonConnectUIProvider 
      manifestUrl="https://ukhyliant.onrender.com/tonconnect-manifest.json"
      actionsConfiguration={{
        twaReturnUrl: 'https://t.me/Ukhyliantbot/ukhyliant_game'
      }}
    >
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);