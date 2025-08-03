
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import Preloader from './components/Preloader';
import { DATA_FILES } from '@/config';
import { Graph } from '@/types';
import { nodeFactory } from '@/engine/nodeFactory';
import { codeGenerator } from '@/engine/codeGenerator';

import { Sidebar } from '@/components/Sidebar';
import { NodeLibrary } from '@/components/NodeLibrary';
import { ReactFlowGraphEditor } from '@/components/ReactFlowGraphEditor';
import { CodePreview } from '@/components/CodePreview';

const generateSignature = (cmd: any): string => {
    let signature = cmd.base || cmd.command || '';
    if (cmd.array_parameter) {
        signature += '[...]';
    }
    if (cmd.subcommand) {
        signature += cmd.subcommand;
    }

    const generateArgsSignature = (args: any[]): string => {
        let argsSig = '';
        if (!args) return argsSig;

        for (const arg of args) {
            if (arg.optional) break;

            if (arg.type === 'keyword' || arg.type === 'assignment') {
                argsSig += ` ${arg.value}`;
            } else if (arg.type === 'Condition') {
                argsSig += ' (Condition)';
                break;
            } else if (arg.type === 'group') {
                if (arg.content) {
                    argsSig += ` ${generateArgsSignature(arg.content)}`;
                }
                break; 
            } else if (arg.type === 'base') {
                argsSig += ` ${arg.name}`;
                if (arg.array_parameter) argsSig += '[...]';
            }
            else {
                break;
            }
        }
        return argsSig.trim();
    };

    const argsSignature = generateArgsSignature(cmd.arguments);
    if (argsSignature) {
        signature += ` ${argsSignature}`;
    }
    
    return signature;
};


const App = () => {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [graph, setGraph] = useState<Graph>({ nodes: [], connections: [] });
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });

  useEffect(() => {
    const loadData = async () => {
      const allFiles = Object.values(DATA_FILES).flat();
      setLoadingProgress({ loaded: 0, total: allFiles.length });
      const loadedDefs: any[] = [];
      const seenTypes = new Set<string>();

      for (const filePath of allFiles) {
        try {
          const res = await fetch(filePath);
          const commands = await res.json();
          if (Array.isArray(commands)) {
              commands.forEach((cmd, i) => {
                  if (cmd.status === 'unclear') return;

                  const type = cmd.template || `${cmd.command || cmd.base || 'unnamed'}_${filePath}_${i}`;

                  if (seenTypes.has(type)) return;
                  seenTypes.add(type);

                  const displayName = cmd.command || cmd.base || 'Unnamed';
                  const signature = generateSignature(cmd);
                  const definition = nodeFactory.createNodeDefinition(cmd, type);
                  
                  loadedDefs.push({
                    ...definition,
                    sourceFile: filePath,
                    type,
                    displayName,
                    signature
                  });
              });
          }
        } catch (e) {
          console.error(`Failed to load ${filePath}`, e);
        }
        setLoadingProgress(prev => ({ ...prev, loaded: prev.loaded + 1 }));
      }
      setDefinitions(loadedDefs);
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    const code = codeGenerator.generate(graph);
    setGeneratedCode(code);
  }, [graph]);

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/tpc-node-editor', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeLibraryClick = useCallback((type: string) => {
    const def = definitions.find(d => d.type === type);
    if (def) {
      let position = { x: 200, y: 100 };
      if (graph.nodes.length > 0) {
        const xPositions = graph.nodes.map(n => n.position.x);
        const yPositions = graph.nodes.map(n => n.position.y);
        const maxX = Math.max(...xPositions);
        const minY = Math.min(...yPositions);
        position = { x: maxX + 320, y: minY }; // 320 is roughly node width + padding
      }
      const newNode = nodeFactory.createNodeInstance(def, position, def.displayName);
      setGraph(g => ({ ...g, nodes: [...g.nodes, newNode] }));
    }
  }, [definitions, graph.nodes]);

  // Handle drop events from ReactFlow
  useEffect(() => {
    const handleReactFlowDrop = (event: CustomEvent) => {
      const { type, position, reactFlowBounds } = event.detail;
      const def = definitions.find(d => d.type === type);
      if (def && reactFlowBounds) {
        // Convert screen coordinates to ReactFlow coordinates
        const reactFlowPosition = {
          x: position.x - reactFlowBounds.left - 140, // Account for node width
          y: position.y - reactFlowBounds.top - 20   // Account for node height
        };
        const newNode = nodeFactory.createNodeInstance(def, reactFlowPosition, def.displayName);
        setGraph(g => ({ ...g, nodes: [...g.nodes, newNode] }));
      }
    };

    window.addEventListener('reactflow-drop', handleReactFlowDrop as EventListener);
    return () => window.removeEventListener('reactflow-drop', handleReactFlowDrop as EventListener);
  }, [definitions]);

  const handleValueChange = useCallback((nodeId: string, key: string, value: any) => {
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === nodeId ? { ...n, values: {...n.values, [key]: value} } : n),
    }));
  }, [setGraph]);

  const handleRepeatableChange = useCallback((nodeId: string, listKey: string, action: 'add' | 'remove') => {
    setGraph(g => {
      const newNodes = g.nodes.map(n => {
        if (n.id === nodeId) {
          const newNode = { ...n, values: { ...n.values } };
          const countKey = `${listKey}_count`;
          const currentCount = newNode.values[countKey] || 0;

          if (action === 'add') {
            newNode.values[countKey] = currentCount + 1;
          } else if (action === 'remove' && currentCount > 0) {
            const newCount = currentCount - 1;
            newNode.values[countKey] = newCount;
            const prefixToRemove = `${listKey}_${newCount}_`;
            for (const key in newNode.values) {
              if (key.startsWith(prefixToRemove)) {
                delete newNode.values[key];
              }
            }
          }
          return newNode;
        }
        return n;
      });
      return {...g, nodes: newNodes };
    });
  }, [setGraph]);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === nodeId ? {...n, isExpanded: !n.isExpanded} : n)
    }));
  }, [setGraph]);

  const deleteNode = useCallback((nodeId: string) => {
    setGraph(g => {
      const newNodes = g.nodes.filter(n => n.id !== nodeId);
      const newConnections = g.connections.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId);
      return { nodes: newNodes, connections: newConnections };
    });
  }, [setGraph]);

  if (loading) {
    return <Preloader loaded={loadingProgress.loaded} total={loadingProgress.total} />;
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <Sidebar width={250}>
        <NodeLibrary definitions={definitions} onDragStart={handleDragStart} onClick={(e, type) => handleNodeLibraryClick(type)} />
      </Sidebar>
      <div style={{ flex: 1, display: 'flex' }}>
        <ReactFlowGraphEditor 
          graph={graph} 
          setGraph={setGraph}
          onValueChange={handleValueChange}
          onToggleExpansion={toggleNodeExpansion}
          onRepeatableChange={handleRepeatableChange}
          onDelete={deleteNode}
        />
      </div>
      <Sidebar width={350}>
        <CodePreview code={generatedCode} />
      </Sidebar>
    </div>
  );
};

export default App;