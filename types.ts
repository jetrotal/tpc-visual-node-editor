/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Position { x: number; y: number; }

export interface SocketDef {
    id: string;
    nodeId: string;
    name: string;
    label: string;
    io: 'input' | 'output';
    type: 'exec' | 'data';
    dataType: string;
}

export interface NodeInstance {
  id: string;
  type: string;
  displayName: string;
  position: Position;
  definition: any;
  sockets: {
    inputs: SocketDef[];
    outputs: SocketDef[];
  };
  values: Record<string, any>;
  isExpanded: boolean;
  isVisible: boolean;
}

export interface Connection {
    id: string;
    fromNode: string;
    fromSocket: string;
    toNode: string;
    toSocket: string;
    resolvedValue?: string; // Optional resolved value from source node
}

export interface Graph {
    nodes: NodeInstance[];
    connections: Connection[];
}