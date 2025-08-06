/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Graph, NodeInstance, Connection } from '@/types';
import { argumentWalker, WalkerHandlers } from './argumentWalker';
import { getIdentifier } from './nodeFactory';

export const codeGenerator = {
  generate(graph: Graph): string {
    const { nodes, connections } = graph;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    const connectionsFrom = new Map<string, Connection[]>();
    connections.forEach(c => {
        if (!connectionsFrom.has(c.fromSocket)) {
            connectionsFrom.set(c.fromSocket, []);
        }
        connectionsFrom.get(c.fromSocket)!.push(c);
    });

    const connectionsTo = new Map<string, Connection>();
    connections.forEach(c => connectionsTo.set(c.toSocket, c));

    const getSocketValue = (node: NodeInstance, valueKey: string): any => {
        const socketId = `${node.id}-${valueKey}`;
        const connection = connectionsTo.get(socketId);
        if (connection) {
            const sourceNode = nodeMap.get(connection.fromNode);
            if (sourceNode) {
                const sourceSocketKey = connection.fromSocket.replace(`${connection.fromNode}-`, '');
                
                // For JSCode, the output value is stored with a `_result` suffix.
                if (sourceNode.definition.nodeDef.command === 'Evaluate JS Code') {
                  return sourceNode.values[`${sourceSocketKey}_result`];
                }

                return getSocketValue(sourceNode, sourceSocketKey);
            }
        }
        return node.values[valueKey];
    };
    
    const traverse = (node: NodeInstance | undefined, indent: string): string => {
        if (!node) return '';

        // First, get the code from the rest of the chain by traversing forward
        const execOutSocket = node.sockets.outputs.find(s => s.name === 'exec_out');
        let nextCode = '';
        if (execOutSocket) {
            const execOutConns = connectionsFrom.get(execOutSocket.id);
            if (execOutConns && execOutConns.length > 0) {
                 const nextNode = nodeMap.get(execOutConns[0].toNode);
                 if (nextNode) {
                    nextCode = traverse(nextNode, indent);
                 }
            }
        }

        // If the current node is hidden, just return the code from the rest of the chain
        if (!node.isVisible) {
            return nextCode;
        }

        // Otherwise, build the current node's code
        const currentNodeCode = buildNodeCode(node, indent);
        
        // And join them, only adding a newline if both exist
        if (currentNodeCode && nextCode) {
            return `${currentNodeCode}\n${nextCode}`;
        }
        
        // Return whichever one is not empty
        return currentNodeCode || nextCode;
    };

    const codeGenHandlers = (indent: string): WalkerHandlers<string> => ({
        onPrimitive: ({ arg, key, node }) => {
            if (arg.type === 'JSCode') {
                // This node doesn't generate code by itself. Its value is exposed via its output socket.
                if (node.definition.nodeDef.command === 'Evaluate JS Code') {
                    return null;
                }
                
                const jsCodeToRun = getSocketValue(node, key);
                if (!jsCodeToRun) return null;
                try {
                    const result = new Function(`return ${jsCodeToRun}`)();
                    return String(result ?? '');
                } catch (e) {
                    console.error("JS evaluation error:", e);
                    return `/* Error evaluating JS: ${(e as Error).message.replace(/\s/g, ' ')} */`;
                }
            }
            
            const val = getSocketValue(node, key);
            if (arg.optional && (val === undefined || val === null || val === '')) return null;
            
            const finalVal = (val === undefined || val === null) ? '' : val;

            if (arg.prefix) {
                return `${arg.prefix}${String(finalVal)}`;
            }
            if (arg.is_identifier) {
                return String(finalVal);
            }
            if (arg.type === 'String') return `"${String(finalVal)}"`;
            if (arg.type === 'RawCode') return String(finalVal);
            return String(finalVal);
        },
        onKeyword: ({ arg }) => {
            if (arg.value === '.hidden') return null; // Prevent '.hidden' from ever appearing in code
            return arg.value;
        },
        onChoice: (_, __, childResult) => childResult,
        onSubcommand: ({ arg }, childResults) => {
            let result = arg.name || '';
            const children = [...childResults];

            if (arg.array_parameter) {
                const arrayParamValue = children.shift();
                if (arrayParamValue) result += `[${arrayParamValue}]`;
            }

            const childrenToJoin = children.filter(c => c !== null && c !== undefined);

            if (childrenToJoin.length > 0) {
                const hasBlock = Array.isArray(arg.arguments) && arg.arguments.some(a => a.type === 'block');
                const joiner = hasBlock ? ' ' : ', ';
                const argsString = childrenToJoin.join(joiner);
                result += hasBlock ? ` ${argsString}` : `(${argsString})`;
            }
            return result;
        },
        onBlock: ({ arg }, childResults) => {
             const namePart = arg.name ? `${arg.name} ` : '';
             if (Array.isArray(arg.content)) {
                const blockContent = childResults.join(`\n${indent}  `);
                if (blockContent) {
                   return `${namePart}{\n${indent}  ${blockContent}\n${indent}}`;
                }
                return `${namePart}{}`;
             }
             return null;
        },
        onExecBlock: ({ key, node }) => {
            const blockSocketId = `${node.id}-${key}`;
            const blockConns = connectionsFrom.get(blockSocketId);
            if(blockConns && blockConns.length > 0) {
                 const nextNode = nodeMap.get(blockConns[0].toNode);
                 if (nextNode) {
                    const blockCode = traverse(nextNode, indent + '  ');
                    return `{\n${blockCode}\n${indent}}`;
                 }
            }
            return '{}';
        },
        onGroup: (_, childResults) => childResults.join(' '),
        onArray: ({ arg }, itemResults) => {
            const separator = arg.separator || ', ';
            const content = itemResults.join(separator);
            const [start_delim, end_delim] = arg.delimiters || ['[', ']'];
            return `${start_delim}${content}${end_delim}`;
        },
        onBase: ({ arg }, arrayParamResult) => {
            let baseResult = arg.name || '';
            if (arg.array_parameter && arrayParamResult) {
                baseResult += `[${arrayParamResult}]`;
            }
            return baseResult;
        },
        onRepeatable: ({ arg }, items) => {
            const hasBlockInArgs = arg.type === 'block' 
                || (arg.type === 'subcommand' && Array.isArray(arg.arguments) && arg.arguments.some((a: any) => a.type === 'block'))
                || (arg.type === 'group' && Array.isArray(arg.content) && arg.content.some((a: any) => a.type === 'block'));

            let joiner = arg.repeatable_joiner;
            if (!joiner) {
                joiner = hasBlockInArgs ? `\n${indent}` : ' ';
            } else if (joiner === '\n') {
                joiner = `\n${indent}`;
            }
            return items.join(joiner);
        },
    });

    const buildNodeCode = (node: NodeInstance, indent: string): string => {
        if (node.definition.nodeDef.command === 'Evaluate JS Code') {
            return '';
        }
        
        const def = node.definition.nodeDef;
        if (!def) return `${indent}// Error: Missing definition for node ${node.type}\n`;

        let codeLine = '';
        if (Object.prototype.hasOwnProperty.call(def, 'base')) {
            codeLine = def.base || ''; // Handles string and null cases. `null` becomes empty string.
        } else {
            codeLine = def.command || ''; // Fallback for commands that only have 'command'
        }

        const valueGetter = (key: string) => getSocketValue(node, key);
        const handlers = codeGenHandlers(indent);
        
        const argParts = argumentWalker<string>(node, handlers, valueGetter);
        
        if (def.array_parameter && argParts.length > 0) {
            const arrayParamValue = argParts.shift(); // The first part is the array_parameter
            if (arrayParamValue) {
                codeLine += `[${arrayParamValue}]`;
            }
        }
        
        if (def.subcommand) {
            codeLine += def.subcommand;
        }
        
        const argString = argParts.filter(Boolean).join(' ');
        
        if (codeLine && argString) {
          codeLine += ` ${argString}`;
        } else if (argString) {
          codeLine = argString;
        }

        return indent + codeLine;
    };
    
    const startNodes = nodes.filter(n => 
        n.sockets.inputs.some(s => s.type === 'exec') &&
        !connections.some(c => c.toNode === n.id && c.toSocket.endsWith('-exec_in'))
    );

    return startNodes.map(sn => traverse(sn, '')).filter(Boolean).join('\n\n');
  }
};