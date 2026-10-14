import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { YjsProvider } from './context/YjsContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <YjsProvider>
      <App />
    </YjsProvider>
  </React.StrictMode>
);
