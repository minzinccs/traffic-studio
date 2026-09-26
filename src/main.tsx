import React from 'react';
import ReactDOM from 'react-dom/client';
import { WorkspaceRoot } from './features/workspaces';
import './styles.css';
import './theme.css';
import './motion.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceRoot />
  </React.StrictMode>,
);
