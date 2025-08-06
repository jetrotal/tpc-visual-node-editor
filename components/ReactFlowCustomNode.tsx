import React, { memo, useMemo, useContext } from 'react';
import { NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { NodeInstance, SocketDef, Connection } from '@/types';
import { ArgumentRenderer } from '@/components/Argument';
import { SocketHandle } from '@/components/SocketHandle';
import { GraphContext } from '@/contexts/GraphContext';

interface CustomNodeData {
  nodeData: NodeInstance;
  onValueChange: (nodeId: string, key: string, value: any) => void;
  onToggleExpansion: (nodeId: string) => void;
  onToggleVisibility: (nodeId: string) => void;
  onRepeatableChange: (nodeId: string, key: string, type: 'add' | 'remove', index?: number) => void;
  onDelete: (nodeId: string) => void;
}

type CustomNodeProps = NodeProps & {
  data: CustomNodeData;
};

const ReactFlowCustomNodeComponent = memo(({ data, id, selected }: CustomNodeProps) => {
  const { nodeData, onValueChange, onToggleExpansion, onRepeatableChange, onDelete, onToggleVisibility } = data;
  const { graph } = useContext(GraphContext)!;

  const hasComplexArgs = nodeData.definition.nodeDef.arguments?.length > 0 || nodeData.definition.nodeDef.array_parameter;

  // Filter exec outputs: always show main exec_out with unique ID to avoid conflicts
  const mainExecInputs = nodeData.sockets.inputs.filter(s => s.type === 'exec' && s.name === 'exec_in');
  const mainExecOutputs = nodeData.sockets.outputs.filter(s => s.type === 'exec' && s.name === 'exec_out');

  // Get unique data sockets by name to render handles for collapsed nodes
  const collapsedSockets = useMemo(() => {
    if (nodeData.isExpanded) return [];
    const socketsByName = new Map<string, { input?: SocketDef; output?: SocketDef }>();

    for (const socket of [...nodeData.sockets.inputs, ...nodeData.sockets.outputs]) {
      if (socket.type !== 'data') continue;
      if (!socketsByName.has(socket.name)) {
        socketsByName.set(socket.name, {});
      }
      const entry = socketsByName.get(socket.name)!;
      if (socket.io === 'input') {
        entry.input = socket;
      } else {
        entry.output = socket;
      }
    }
    return Array.from(socketsByName.entries());
  }, [nodeData.sockets, nodeData.isExpanded]);
  
  const enrichedConnections = useMemo(() => {
    return graph.connections.map(conn => {
      const sourceNode = graph.nodes.find(n => n.id === conn.fromNode);
      if (!sourceNode) return conn;
      
      const socketKey = conn.fromSocket.replace(`${conn.fromNode}-`, '');
      const value = sourceNode.values[socketKey];
      
      return {
        ...conn,
        resolvedValue: value || `Connected from ${conn.fromNode}`
      };
    });
  }, [graph.connections, graph.nodes]);


  return (
    <div className={`custom-node ${selected ? 'selected' : ''} ${!nodeData.isVisible ? 'hidden' : ''}`}>
      {/* Main execution flow sockets - positioned at top */}
      {mainExecInputs.map((socket: SocketDef) => (
        <SocketHandle key={`${socket.id}-in`} socket={socket} isMainExec={true} style={{ top: '37px' }} />
      ))}
      {mainExecOutputs.map((socket: SocketDef) => (
        <SocketHandle key={`${socket.id}-out`} socket={socket} isMainExec={true} style={{ top: '37px' }} />
      ))}

      {/* Data sockets for collapsed nodes */}
      {collapsedSockets.map(([name, sockets], index) => {
        const topPosition = 60 + (index * 24);
        return (
          <React.Fragment key={`${nodeData.id}-${name}`}>
            {/* Input handle */}
            {sockets.input && <SocketHandle key={`${sockets.input.id}-in`} socket={sockets.input} style={{ top: `${topPosition}px` }} />}
            {/* Output handle */}
            {sockets.output && <SocketHandle key={`${sockets.output.id}-out`} socket={sockets.output} style={{ top: `${topPosition}px` }} />}
            {/* Socket label */}
            <div className="collapsed-socket-label" style={{ top: `${topPosition - 7}px` }}>
              {name}
            </div>
          </React.Fragment>
        );
      })}

      {/* Node header */}
      <div className={`custom-drag-handle custom-node-header ${hasComplexArgs && nodeData.isExpanded ? 'expanded' : ''}`}>
        <div className="header-left">
          {hasComplexArgs && (
            <button
              onClick={() => onToggleExpansion(nodeData.id)}
              className="icon-button"
              aria-expanded={nodeData.isExpanded}
              aria-label={nodeData.isExpanded ? 'Collapse node arguments' : 'Expand node arguments'}
              title={nodeData.isExpanded ? 'Collapse' : 'Expand'}
            >
              {nodeData.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          <span className="custom-node-title">
            {nodeData.displayName}
          </span>
        </div>
        <div className="header-right">
            <button
                onClick={() => onToggleVisibility(nodeData.id)}
                title={nodeData.isVisible ? 'Hide from generated code' : 'Show in generated code'}
                className="icon-button"
                aria-label={nodeData.isVisible ? 'Hide node from generated code' : 'Show node in generated code'}
            >
                {nodeData.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button
              onClick={() => onDelete(nodeData.id)}
              className="icon-button icon-button-danger"
              aria-label="Delete node"
              title="Delete node"
            >
              <X size={16} />
            </button>
        </div>
      </div>

      {/* Expanded arguments section */}
      {hasComplexArgs && nodeData.isExpanded && (
        <div className="custom-node-body">
          <ArgumentRenderer 
            node={nodeData}
            sockets={nodeData.sockets}
            connections={enrichedConnections}
            allNodes={graph.nodes}
            onValueChange={onValueChange}
            onRepeatableChange={onRepeatableChange}
          />
        </div>
      )}
    </div>
  );
});

ReactFlowCustomNodeComponent.displayName = 'ReactFlowCustomNode';

export { ReactFlowCustomNodeComponent as ReactFlowCustomNode };