import React, { memo, useMemo } from 'react';
import { NodeProps } from '@xyflow/react';
import { NodeInstance, SocketDef, Connection } from '@/types';
import { ArgumentRenderer } from '@/components/Argument';
import { SocketHandle } from '@/components/SocketHandle';

interface CustomNodeData {
  nodeData: NodeInstance;
  connections: Connection[];
  allNodes: NodeInstance[];
  onValueChange: (nodeId: string, key: string, value: any) => void;
  onToggleExpansion: (nodeId: string) => void;
  onRepeatableChange: (nodeId: string, key: string, type: 'add' | 'remove', index?: number) => void;
  onDelete: (nodeId: string) => void;
}

type CustomNodeProps = NodeProps & {
  data: CustomNodeData;
};

const ReactFlowCustomNodeComponent = memo(({ data, id, selected }: CustomNodeProps) => {
  const { nodeData, connections, allNodes, onValueChange, onToggleExpansion, onRepeatableChange, onDelete } = data;
  
  const hasComplexArgs = nodeData.definition.nodeDef.arguments?.length > 0 || nodeData.definition.nodeDef.array_parameter;

  // Filter exec outputs: always show main exec_out with unique ID to avoid conflicts
  const mainExecInputs = nodeData.sockets.inputs.filter(s => s.type === 'exec' && s.name === 'exec_in');
  const mainExecOutputs = nodeData.sockets.outputs.filter(s => s.type === 'exec' && s.name === 'exec_out');

  // Get unique data sockets by name to render handles for collapsed nodes
  const uniqueDataSockets = useMemo(() => {
    const seen = new Set<string>();
    return [...nodeData.sockets.inputs, ...nodeData.sockets.outputs]
      .filter(s => s.type === 'data')
      .filter(s => {
        if (seen.has(s.name)) {
          return false;
        } else {
          seen.add(s.name);
          return true;
        }
      });
  }, [nodeData.sockets]);

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, #2c3035, #1a1d21)',
        border: selected ? '2px solid #4a90e2' : '1px solid #444',
        borderRadius: '8px',
        minWidth: '180px',
        minHeight: '60px',
        position: 'relative',
        boxShadow: selected 
          ? '0 0 0 2px rgba(74, 144, 226, 0.3), 0 4px 12px rgba(0,0,0,0.4)' 
          : '0 2px 8px rgba(0,0,0,0.3)',
        overflow: 'visible',
      }}
    >
      {/* Main execution flow sockets - positioned at top */}
      {mainExecInputs.map((socket: SocketDef) => (
        <SocketHandle key={socket.id} socket={socket} isMainExec={true} style={{ top: '19px', left: '-7px' }} />
      ))}
      {mainExecOutputs.map((socket: SocketDef) => (
        <SocketHandle key={socket.id} socket={socket} isMainExec={true} style={{ top: '19px', right: '-7px' }} />
      ))}

      {/* Data sockets for collapsed nodes */}
      {!nodeData.isExpanded && uniqueDataSockets.map((socket, index) => {
        const topPosition = 60 + (index * 24);
        return (
          <React.Fragment key={`${socket.nodeId}-${socket.name}`}>
            {/* Input handle */}
            <SocketHandle socket={{...socket, io: 'input'}} style={{ top: `${topPosition}px`, left: '-7px' }} />
            {/* Output handle */}
            <SocketHandle socket={{...socket, io: 'output'}} style={{ top: `${topPosition}px`, right: '-7px' }} />
            {/* Socket label */}
            <div
              style={{
                position: 'absolute',
                top: `${topPosition - 7}px`,
                left: '20px',
                right: '20px',
                fontSize: '11px',
                color: '#e0e0e0',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                textAlign: 'center',
              }}
            >
              {socket.name}
            </div>
          </React.Fragment>
        );
      })}

      {/* Node header */}
      <div
        className="custom-drag-handle"
        style={{
          background: 'linear-gradient(145deg, #4a4f54, #3a3f44)',
          padding: '10px 12px',
          borderBottom: hasComplexArgs && nodeData.isExpanded ? '1px solid #555' : 'none',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          cursor: 'move',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasComplexArgs && (
            <button
              onClick={() => onToggleExpansion(nodeData.id)}
              style={{
                background: 'linear-gradient(145deg, #4a90e2, #357abd)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '10px',
                padding: '3px 6px',
                borderRadius: '3px',
                color: 'white',
                fontWeight: 'bold',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              {nodeData.isExpanded ? '▼' : '▶'}
            </button>
          )}
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '700',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            letterSpacing: '0.3px',
          }}>
            {nodeData.displayName}
          </span>
        </div>
        <button
          onClick={() => onDelete(nodeData.id)}
          style={{
            background: 'linear-gradient(145deg, #e74c3c, #c0392b)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '3px 6px',
            borderRadius: '3px',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        >
          ✕
        </button>
      </div>

      {/* Expanded arguments section */}
      {hasComplexArgs && nodeData.isExpanded && (
        <div
          style={{
            padding: '12px',
            background: '#1a1d21',
            borderRadius: '0 0 8px 8px',
            border: '1px solid #444',
            borderTop: 'none',
            marginTop: '-1px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <ArgumentRenderer 
            node={nodeData}
            sockets={nodeData.sockets}
            connections={connections}
            allNodes={allNodes}
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