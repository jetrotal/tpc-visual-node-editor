/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Graph } from '@/types';

export const GraphContext = React.createContext<{ graph: Graph } | null>(null);
