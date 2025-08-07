/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export interface HandlePortalContextType {
  left: HTMLDivElement | null;
  right: HTMLDivElement | null;
}

export const HandlePortalContext = React.createContext<HandlePortalContextType>({ left: null, right: null });
