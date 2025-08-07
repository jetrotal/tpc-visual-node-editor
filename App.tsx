/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Preloader from './components/Preloader';
import { DATA_FILES } from '@/config';
import { Graph, NodeInstance, Connection } from '@/types';
import { nodeFactory, getUniqueId } from '@/engine/nodeFactory';
import { codeGenerator } from '@/engine/codeGenerator';
import { importParser } from '@/engine/importParser';
import { LayoutGrid } from 'lucide-react';

import { Sidebar } from '@/components/Sidebar';
import { NodeLibrary } from '@/components/NodeLibrary';
import { ReactFlowGraphEditor } from '@/components/ReactFlowGraphEditor';
import { CodePreview } from '@/components/CodePreview';
import { DropdownMenu } from '@/components/DropdownMenu';
import { Modal } from '@/components/Modal';

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

const downloadJson = (content: object, fileName: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(content, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}


const App = () => {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [graph, setGraph] = useState<Graph>({ nodes: [], connections: [] });
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ loaded: 0, total: 0 });
  const [projectName, setProjectName] = useState<string | null>(null);

  type ModalType = null | 'newProject' | 'saveAs';
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [promptValue, setPromptValue] = useState('');
  const promptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeModal === 'saveAs' && promptInputRef.current) {
      setTimeout(() => {
        promptInputRef.current?.focus();
        promptInputRef.current?.select();
      }, 100);
    }
  }, [activeModal]);

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
  
  const confirmNewProject = useCallback(() => {
    setGraph({ nodes: [], connections: [] });
    setProjectName(null);
    setActiveModal(null);
  }, []);
  
  const handleNewProject = useCallback(() => {
      setActiveModal('newProject');
  }, []);

  const confirmSaveProjectAs = useCallback(() => {
    const fileName = promptValue.trim();
    if (fileName) {
        const finalFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
        downloadJson(graph, finalFileName);
        setProjectName(finalFileName);
    }
    setActiveModal(null);
  }, [graph, promptValue]);

  const handleSaveProjectAs = useCallback(() => {
    setPromptValue(projectName || 'tpc-project.json');
    setActiveModal('saveAs');
  }, [projectName]);

  const handleSaveProject = useCallback(() => {
      if (projectName) {
          downloadJson(graph, projectName);
      } else {
          handleSaveProjectAs();
      }
  }, [graph, projectName, handleSaveProjectAs]);

  const handleLoadProject = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            try {
                const text = await readFileAsText(file);
                const loadedGraph = JSON.parse(text);
                // A simple validation to check if the file is a valid graph
                if (loadedGraph.nodes && loadedGraph.connections) {
                    setGraph(loadedGraph);
                    setProjectName(file.name);
                } else {
                    alert('Invalid project file format.');
                }
            } catch (error) {
                console.error("Failed to load project:", error);
                alert(`Failed to load project file. ${error instanceof Error ? error.message : ''}`);
            }
        }
    };
    input.click();
  }, []);

  const handleImportProject = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            try {
                const text = await readFileAsText(file);
                const loadedGraph: Graph = JSON.parse(text);

                if (loadedGraph.nodes && loadedGraph.connections) {
                    setGraph(currentGraph => {
                        const idMap = new Map<string, string>();
                        
                        let offsetX = 0;
                        if (currentGraph.nodes.length > 0) {
                            const xPositions = currentGraph.nodes
                                .map(n => n.position?.x)
                                .filter(x => typeof x === 'number' && isFinite(x));
    
                            if (xPositions.length > 0) {
                                offsetX = Math.max(...xPositions) + 350;
                            }
                        }
                        
                        const newNodes = loadedGraph.nodes.map(loadedNode => {
                            const definition = definitions.find(d => d.type === loadedNode.type);
                            if (!definition) {
                                console.warn(`Definition for type "${loadedNode.type}" not found. Skipping node.`);
                                return null;
                            }

                            const newPosition = {
                                x: loadedNode.position.x + offsetX,
                                y: loadedNode.position.y
                            };

                            const newNode = nodeFactory.createNodeInstance(definition, newPosition, loadedNode.displayName);
                            
                            // Re-hydrate state from the loaded node
                            newNode.values = { ...newNode.values, ...loadedNode.values };
                            newNode.isExpanded = loadedNode.isExpanded;
                            newNode.isVisible = loadedNode.isVisible;
                            
                            idMap.set(loadedNode.id, newNode.id);
                            return newNode;
                        }).filter((n): n is NodeInstance => n !== null);

                        const newConnections = loadedGraph.connections.map(conn => {
                            const newFromNode = idMap.get(conn.fromNode);
                            const newToNode = idMap.get(conn.toNode);

                            if (!newFromNode || !newToNode) {
                                return null;
                            }
                            
                            const fromSocketName = conn.fromSocket.replace(`${conn.fromNode}-`, '');
                            const toSocketName = conn.toSocket.replace(`${conn.toNode}-`, '');

                            return {
                                ...conn,
                                id: getUniqueId('edge'),
                                fromNode: newFromNode,
                                toNode: newToNode,
                                fromSocket: `${newFromNode}-${fromSocketName}`,
                                toSocket: `${newToNode}-${toSocketName}`,
                            };
                        }).filter((c): c is Connection => c !== null);

                        return {
                            nodes: [...currentGraph.nodes, ...newNodes],
                            connections: [...currentGraph.connections, ...newConnections],
                        };
                    });
                } else {
                    alert('Invalid project file format.');
                }
            } catch (error) {
                console.error("Failed to import project:", error);
                alert(`Failed to import project file. ${error instanceof Error ? error.message : ''}`);
            }
        }
    };
    input.click();
  }, [definitions]);


  const handleImportText = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.tpc';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            try {
                const text = await readFileAsText(file);
                const newGraph = importParser.parse(text, definitions, file.name);
                setGraph(newGraph);
            } catch (error) {
                console.error("Failed to import text file:", error);
                alert(`Failed to import text file. ${error instanceof Error ? error.message : ''}`);
            }
        }
    };
    input.click();
  }, [definitions, setGraph]);


  if (loading) {
    return <Preloader loaded={loadingProgress.loaded} total={loadingProgress.total} />;
  }

  return (
    <div className="root-layout">
      <header className="app-header">
        <div className="header-left-section">
            <LayoutGrid className="header-logo" size={24} aria-hidden="true" />
            <h1 className="header-title">TPC Visual Node Editor</h1>
        </div>
        <div className="menu-bar">
            <DropdownMenu trigger={<button className="menu-button">File</button>} align="right">
                <button className="dropdown-item" onClick={handleNewProject}>New Project</button>
                <div className="dropdown-separator" />
                <button className="dropdown-item" onClick={handleLoadProject}>Load Project...</button>
                <div className="dropdown-separator" />
                <button className="dropdown-item" onClick={handleSaveProject}>
                    Save Project {projectName ? `(${projectName})` : ''}
                </button>
                <button className="dropdown-item" onClick={handleSaveProjectAs}>Save Project As...</button>
            </DropdownMenu>
            <DropdownMenu trigger={<button className="menu-button">Import</button>} align="right">
                <button className="dropdown-item" onClick={handleImportText}>From Text File...</button>
                <button className="dropdown-item" onClick={handleImportProject}>From Project...</button>
            </DropdownMenu>
        </div>
      </header>
      <main className="app-main">
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
      </main>
      <footer className="app-footer">
        <p>A visual, node-based editor for the TPC scripting language.</p>
      </footer>

      <Modal
        isOpen={activeModal === 'newProject'}
        onClose={() => setActiveModal(null)}
        title="New Project"
        footer={
          <>
            <button className="button" onClick={() => setActiveModal(null)}>Cancel</button>
            <button className="button button-danger" onClick={confirmNewProject}>Confirm</button>
          </>
        }
      >
        <p>Are you sure you want to start a new project? Any unsaved changes will be lost.</p>
      </Modal>

      <Modal
        isOpen={activeModal === 'saveAs'}
        onClose={() => setActiveModal(null)}
        title="Save Project As"
        footer={
          <>
            <button className="button" onClick={() => setActiveModal(null)}>Cancel</button>
            <button className="button button-primary" onClick={confirmSaveProjectAs}>Save</button>
          </>
        }
      >
        <p>Enter file name for the project:</p>
        <input
          ref={promptInputRef}
          type="text"
          className="input-base"
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmSaveProjectAs(); } }}
        />
      </Modal>

    </div>
  );
};

export default App;