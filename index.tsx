/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import './styles/main.css';
import './styles/components.css';
import './styles/react-flow.css';
import './styles/preloader.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}