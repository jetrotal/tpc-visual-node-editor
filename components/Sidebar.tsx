/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export const Sidebar = ({ children, width }: { children: React.ReactNode, width: number }) => (
  <div className="sidebar" style={{ width: `${width}px` }}>
    {children}
  </div>
);
