/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export const Sidebar = ({ children, width }: { children: React.ReactNode, width: number }) => (
  <div style={{ width: `${width}px`, height: '100vh', backgroundColor: 'var(--bg-color-light)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid var(--border-color)', overflowY: 'auto' }}>
    {children}
  </div>
);
