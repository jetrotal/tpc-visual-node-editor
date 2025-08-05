
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  Background,
  Controls,
  MiniMap,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  NodeTypes,
  EdgeTypes,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  EdgeSelectionChange,
} from '@xyflow/react';

import { Graph, NodeInstance, Connection as CustomConnection } from '@/types';
import { ReactFlowCustomNode } from '@/components/ReactFlowCustomNode';
import { CustomEdge } from '@/components/CustomEdge';
import { SOCKET_COLORS } from '@/config';
import { generateNodeSockets } from '@/engine/nodeFactory';
import { GraphContext } from '@/contexts/GraphContext';


interface ReactFlowGraphEditorProps {
  graph: Graph;
  setGraph: React.Dispatch<React.SetStateAction<Graph>>;
  onValueChange: (nodeId: string, key: string, value: any) => void;
  onToggleExpansion: (nodeId: string) => void;
  onRepeatableChange: (nodeId: string, listKey: string, action: 'add' | 'remove') => void;
  onDelete: (nodeId: string) => void;
}

const nodeTypes: NodeTypes = {
  customNode: ReactFlowCustomNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

const ReactFlowComponent = ({
  graph,
  setGraph,
  onValueChange,
  onToggleExpansion,
  onRepeatableChange,
  onDelete,
}: ReactFlowGraphEditorProps) => {
  // Initialize ReactFlow state from our custom graph
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChangeFromHook] = useEdgesState([]);
  const { fitView } = useReactFlow();
  const prevNodeCountRef = useRef(graph.nodes.length);
  const zIndexCounter = useRef(1);

  // Handle z-index on edge selection
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeFromHook(changes);

      const selectionChanges = changes.filter(
        (change): change is EdgeSelectionChange => change.type === 'select'
      );

      if (selectionChanges.length > 0) {
        setEdges((eds) => {
          const newEds = eds.map(e => ({...e})); // Create a new array to ensure re-render
          selectionChanges.forEach((change) => {
            const edge = newEds.find((e) => e.id === change.id);
            if (edge) {
              if (change.selected) {
                // On selection, bring to front by incrementing the counter
                edge.zIndex = zIndexCounter.current++;
              } else {
                // On deselection, reset z-index to send it to the back
                edge.zIndex = 0;
              }
            }
          });
          return newEds;
        });
      }
    },
    [onEdgesChangeFromHook, setEdges]
  );

  // Wrapper for delete operation to update both main graph and ReactFlow state
  const handleDeleteNode = useCallback((nodeId: string) => {
    // Update main graph state
    onDelete(nodeId);
    
    // Update ReactFlow state immediately to prevent crashes
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [onDelete, setNodes, setEdges]);

  // Convert our custom graph format to ReactFlow format
  const convertToReactFlowNodes = useCallback((nodes: NodeInstance[]): Node[] => {
    return nodes.map((node) => {
      // Generate current sockets based on node state
      const sockets = generateNodeSockets(node);
      const updatedNode = {
        ...node,
        sockets: {
          inputs: sockets.inputs,
          outputs: sockets.outputs
        }
      };

      return {
        id: node.id,
        type: 'customNode',
        position: node.position,
        data: {
          nodeData: updatedNode,
          onValueChange,
          onToggleExpansion,
          onRepeatableChange,
          onDelete: handleDeleteNode,
        },
        dragHandle: '.custom-drag-handle',
        draggable: true,
      };
    });
  }, [onValueChange, onToggleExpansion, onRepeatableChange, handleDeleteNode]);

  const convertToReactFlowEdges = useCallback((connections: CustomConnection[]): Edge[] => {
    return connections.map((conn) => {
      // Find the source node and regenerate its sockets to get current state
      const sourceNode = graph.nodes.find((n) => n.id === conn.fromNode);
      let sourceSocket;
      
      if (sourceNode) {
        const sockets = generateNodeSockets(sourceNode);
        sourceSocket = sockets.outputs.find((s) => s.id === conn.fromSocket);
      }
      
      let strokeColor = '#4a90e2'; // default blue
      let strokeWidth = 2;
      
      if (sourceSocket?.type === 'exec') {
        strokeColor = '#ffffff'; // white for exec connections
        strokeWidth = 3;
      } else if (sourceSocket?.dataType) {
        // Use socket colors for data connections
        strokeColor = SOCKET_COLORS[sourceSocket.dataType] || SOCKET_COLORS.Default;
        strokeWidth = 2;
      }
      
      return {
        id: conn.id,
        source: conn.fromNode,
        target: conn.toNode,
        sourceHandle: (conn.fromSocket.includes('exec_out') ? 'main_' : '') + conn.fromSocket.replace(`${conn.fromNode}-`, '') + '_out', // Add main_ prefix for main exec and _out suffix for source
        targetHandle: (conn.toSocket.includes('exec_in') ? 'main_' : '') + conn.toSocket.replace(`${conn.toNode}-`, '') + '_in', // Add main_ prefix for main exec and _in suffix for target
        style: { 
          stroke: strokeColor,
          strokeWidth,
          opacity: 0.8,
        },
        type: 'customEdge',
        animated: sourceSocket?.type === 'exec', // animate exec connections
      };
    });
  }, [graph.nodes]);

  const [isDragging, setIsDragging] = useState(false);

  // Sync graph changes to ReactFlow state
  useEffect(() => {
    const reactFlowNodes = convertToReactFlowNodes(graph.nodes);
    const reactFlowEdgesFromGraph = convertToReactFlowEdges(graph.connections);
    
    setNodes(reactFlowNodes);
    setEdges(currentEdges => {
        return reactFlowEdgesFromGraph.map(newEdge => {
            const currentEdge = currentEdges.find(e => e.id === newEdge.id);
            if (currentEdge) {
                // Preserve selection and z-index from React Flow's internal state
                return {
                    ...newEdge,
                    selected: currentEdge.selected,
                    zIndex: currentEdge.zIndex,
                };
            }
            return newEdge;
        });
    });

    if (graph.nodes.length > prevNodeCountRef.current) {
        // use timeout to ensure nodes are rendered before fitting view
        setTimeout(() => {
            fitView({ padding: graph.nodes.length <= 1 ? 2.5 : 0.4, duration: 200 });
        }, 10);
    }
    prevNodeCountRef.current = graph.nodes.length;
  }, [graph.nodes, graph.connections, convertToReactFlowNodes, convertToReactFlowEdges, setNodes, setEdges, fitView]);

  // Sync ReactFlow changes back to our custom graph format
  useEffect(() => {
    if (nodes.length === 0 || isDragging) return; // Avoid processing during drag and empty state
    
    const updatedNodes = nodes.map((node) => {
      const originalNode = graph.nodes.find((n) => n.id === node.id);
      if (originalNode) {
        return {
          ...originalNode,
          position: node.position,
        };
      }
      return originalNode!;
    }).filter(Boolean);

    const updatedConnections = edges.map((edge) => ({
      id: edge.id,
      fromNode: edge.source,
      toNode: edge.target,
      fromSocket: `${edge.source}-${edge.sourceHandle?.replace(/_out$/, '').replace(/^main_/, '') || ''}`,
      toSocket: `${edge.target}-${edge.targetHandle?.replace(/_in$/, '').replace(/^main_/, '') || ''}`,
    }));

    // Only update if there are actual changes to prevent infinite loops
    const hasNodeChanges = updatedNodes.length === graph.nodes.length && 
      updatedNodes.some((node, i) => {
        const originalNode = graph.nodes.find(n => n.id === node.id);
        return !originalNode || 
               Math.abs(node.position.x - originalNode.position.x) > 0.1 || 
               Math.abs(node.position.y - originalNode.position.y) > 0.1;
      });

    const hasConnectionChanges = updatedConnections.length !== graph.connections.length ||
      updatedConnections.some((conn, i) => {
        const originalConn = graph.connections.find(c => c.id === conn.id);
        return !originalConn || 
               conn.fromSocket !== originalConn.fromSocket ||
               conn.toSocket !== originalConn.toSocket;
      });

    if (hasNodeChanges || hasConnectionChanges) {
      setGraph({
        nodes: updatedNodes,
        connections: updatedConnections,
      });
    }
  }, [nodes, edges, graph.nodes, graph.connections, setGraph, isDragging]);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Validate connection types
      const sourceNode = graph.nodes.find((n) => n.id === connection.source);
      const targetNode = graph.nodes.find((n) => n.id === connection.target);
      
      if (!sourceNode || !targetNode) return;

      // Generate current sockets for both nodes
      const sourceSockets = generateNodeSockets(sourceNode);
      const targetSockets = generateNodeSockets(targetNode);

      // Reconstruct full socket IDs for lookup (remove _in/_out suffixes and main_ prefix)
      const sourceHandleBase = connection.sourceHandle?.replace(/_out$/, '').replace(/^main_/, '') || '';
      const targetHandleBase = connection.targetHandle?.replace(/_in$/, '').replace(/^main_/, '') || '';
      const sourceSocketId = `${connection.source}-${sourceHandleBase}`;
      const targetSocketId = `${connection.target}-${targetHandleBase}`;
      
      const sourceSocket = sourceSockets.outputs.find(
        (s) => s.id === sourceSocketId
      );
      const targetSocket = targetSockets.inputs.find(
        (s) => s.id === targetSocketId
      );

      if (!sourceSocket || !targetSocket) {
        console.warn('Socket not found:', { sourceSocketId, targetSocketId });
        return;
      }

      // Validate socket types (exec to exec, data to data)
      if (sourceSocket.type !== targetSocket.type) {
        console.warn('Cannot connect different socket types');
        return;
      }

      // For data sockets, check data type compatibility
      if (
        sourceSocket.type === 'data' &&
        sourceSocket.dataType !== targetSocket.dataType &&
        sourceSocket.dataType !== 'Default' &&
        targetSocket.dataType !== 'Default'
      ) {
        console.warn(`Type mismatch: cannot connect ${sourceSocket.dataType} to ${targetSocket.dataType}`);
        return;
      }

      setEdges((eds) => addEdge(connection, eds));
    },
    [graph.nodes, setEdges]
  );

  // Handle drag and drop from node library
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/tpc-node-editor');
      if (!type) return;

      // Get ReactFlow bounds for coordinate conversion
      const reactFlowWrapper = event.currentTarget as HTMLElement;
      const reactFlowBounds = reactFlowWrapper.getBoundingClientRect();

      const dropEvent = new CustomEvent('reactflow-drop', {
        detail: {
          type,
          position: {
            x: event.clientX,
            y: event.clientY,
          },
          reactFlowBounds,
        },
      });
      window.dispatchEvent(dropEvent);
    },
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle node drag events to prevent state sync during dragging
  const onNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onNodeDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: '#1a1d21',
      }} 
      onDrop={onDrop} 
      onDragOver={onDragOver}
    >
      <GraphContext.Provider value={{ graph }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Strict}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          minZoom={0.1}
          maxZoom={2}
          style={{ background: '#1a1d21' }}
          defaultEdgeOptions={{
            type: 'customEdge',
            style: { 
              stroke: '#4a90e2', 
              strokeWidth: 2 
            },
          }}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={20} 
            size={1}
            color="#444"
            style={{ opacity: 0.6 }}
          />
          <Controls 
            style={{
              background: '#2c3035',
              border: '1px solid #444',
              borderRadius: '8px',
            }}
          />
          <MiniMap 
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              if (node.type === 'customNode') return '#4a90e2';
              return '#2c3035';
            }}
            style={{
              backgroundColor: '#1a1d21',
              border: '1px solid #444',
              borderRadius: '8px',
            }}
            maskColor="rgba(26, 29, 33, 0.8)"
          />
          <Panel position="top-left">
            <div style={{ 
              backgroundColor: 'var(--bg-color)', 
              padding: '8px', 
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              fontSize: '0.8em',
              color: 'var(--text-color)'
            }}>
              Nodes: {nodes.length} | Connections: {edges.length}
            </div>
          </Panel>
        </ReactFlow>
      </GraphContext.Provider>
    </div>
  );
};

export const ReactFlowGraphEditor = (props: ReactFlowGraphEditorProps) => (
  <ReactFlowProvider>
    <ReactFlowComponent {...props} />
  </ReactFlowProvider>
);
