/**
 * Main Entry Point
 * Initializes React application with Redux Provider and React Router
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { store } from './store';
import './index.css';

// Debug logger for development
const DEBUG_LOG = (message: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    console.log(`[DEBUG] ${new Date().toISOString()} - Main: ${message}`, data ?? '');
  }
};

DEBUG_LOG('Initializing SpendWise Pro Client');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);

DEBUG_LOG('React app mounted');
