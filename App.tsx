/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import Preloader from './components/Preloader';
import { DATA_FILES } from '@/config';
import { Graph, NodeInstance, Connection } from '@/types';
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

  // This handles the real-time evaluation of special nodes like 'Evaluate JS Code'
  useEffect(() => {
    // Prevent evaluation during load or on an empty graph
    if (loading || graph.nodes.length === 0) return;

    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    const connectionsTo = new Map<string, Connection>();
    graph.connections.forEach(c => connectionsTo.set(c.toSocket, c));

    const getSocketValue = (node: NodeInstance, valueKey: string): any => {
        const socketId = `${node.id}-${valueKey}`;
        const connection = connectionsTo.get(socketId);
        if (connection) {
            const sourceNode = nodeMap.get(connection.fromNode);
            if (sourceNode) {
                const sourceSocketKey = connection.fromSocket.replace(`${connection.fromNode}-`, '');
                if (sourceNode.definition.nodeDef.command === 'Evaluate JS Code') {
                    return sourceNode.values[`${sourceSocketKey}_result`];
                }
                return getSocketValue(sourceNode, sourceSocketKey);
            }
        }
        return node.values[valueKey];
    };

    let needsUpdate = false;
    const newNodes = graph.nodes.map(n => {
        if (n.definition.nodeDef.command !== 'Evaluate JS Code') {
            return n;
        }
        
        const newNode = { ...n, values: { ...n.values } };
        const args = newNode.definition.nodeDef.arguments;

        const codeArgIndex = args.findIndex((a: any) => a.type === 'JSCode');
        if (codeArgIndex === -1) return n;
        const codeArg = args[codeArgIndex];

        const codeKey = `${codeArgIndex}_${codeArg.name}`;
        const resultKey = `${codeKey}_result`;
        const code = getSocketValue(newNode, codeKey);

        if (code === undefined || code === null || String(code).trim() === '') {
            if (newNode.values[resultKey] !== '') {
                newNode.values[resultKey] = '';
                needsUpdate = true;
            }
            return newNode;
        }

        // Collect variables
        const variables: { [key: string]: any } = {};
        const varGroupArgIndex = args.findIndex((a: any) => a.name === 'variable');

        if (varGroupArgIndex !== -1) {
            const varGroupArg = args[varGroupArgIndex];
            const varGroupKey = `${varGroupArgIndex}_${varGroupArg.name}`;
            const varCount = getSocketValue(newNode, `${varGroupKey}_count`) || 0;
            for (let i = 0; i < varCount; i++) {
                // name is at index 0, value is at index 1 within the group's content array.
                const nameKey = `${varGroupKey}_${i}_0_name`;
                const valueKey = `${varGroupKey}_${i}_1_value`;

                const varName = getSocketValue(newNode, nameKey);
                if (varName) {
                    const rawValue = getSocketValue(newNode, valueKey);
                    const parsedValue = !isNaN(parseFloat(rawValue)) && isFinite(rawValue) ? parseFloat(rawValue) : rawValue;
                    variables[varName] = parsedValue;
                }
            }
        }
        
        let resultString = '';
        try {
            const varNames = Object.keys(variables);
            const varValues = Object.values(variables);
            const evaluator = new Function(...varNames, `return ${code}`);
            const result = evaluator(...varValues);
            resultString = String(result ?? '');
        } catch (e) {
            resultString = `/* Error: ${(e as Error).message.replace(/\s/g, ' ')} */`;
        }

        if (newNode.values[resultKey] !== resultString) {
            newNode.values[resultKey] = resultString;
            needsUpdate = true;
        }
        
        return newNode;
    });

    if (needsUpdate) {
        setGraph(g => ({ ...g, nodes: newNodes }));
    }
  }, [graph, loading]);

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
      nodes: g.nodes.map(n => {
        if (n.id === nodeId) {
          return { ...n, values: {...n.values, [key]: value} };
        }
        return n;
      }),
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

  const toggleNodeVisibility = useCallback((nodeId: string) => {
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => n.id === nodeId ? { ...n, isVisible: !n.isVisible } : n)
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
    <div className="app-container">
      <Sidebar width={250}>
        <NodeLibrary definitions={definitions} onDragStart={handleDragStart} onClick={(e, type) => handleNodeLibraryClick(type)} />
      </Sidebar>
      <div className="main-content">
        <ReactFlowGraphEditor 
          graph={graph} 
          setGraph={setGraph}
          onValueChange={handleValueChange}
          onToggleExpansion={toggleNodeExpansion}
          onToggleVisibility={toggleNodeVisibility}
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