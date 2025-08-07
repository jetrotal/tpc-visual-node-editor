/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Graph, Connection } from '@/types';
import { nodeFactory, getUniqueId } from '@/engine/nodeFactory';

export const importParser = {
  parse(script: string, definitions: any[], fileName: string): Graph {
    const evalJsDef = definitions.find(d => d.nodeDef?.command === 'Evaluate JS Code');
    const rawCodeDef = definitions.find(d => d.nodeDef?.command === 'Generate Raw Code');

    if (!evalJsDef || !rawCodeDef) {
      console.error("Required node definitions for 'Evaluate JS Code' or 'Generate Raw Code' not found.");
      return { nodes: [], connections: [] };
    }

    const graph: Graph = { nodes: [], connections: [] };
    const yPos = 100;
    const xEval = 100;
    const xRaw = 600;

    // 1. Create the main "Evaluate JS Code" node for the header
    const evalNode = nodeFactory.createNodeInstance(evalJsDef, { x: xEval, y: yPos }, 'File Header');
    evalNode.values = {
      ...evalNode.values,
      // Variable group for filename
      '0_variable_count': 1,
      '0_variable_0_0_name': 'filename',
      '0_variable_0_1_value': fileName,
      // JS code to generate the header string. This code runs in the node.
      '1_code': `\`// Code from \${filename}
// ====================================
      
\``
    };
    graph.nodes.push(evalNode);

    // 2. Create a "Generate Raw Code" node with two inputs: one for the header, one for the script.
    const rawCodeNode = nodeFactory.createNodeInstance(rawCodeDef, { x: xRaw, y: yPos }, 'Imported TPC Code');
    
    // It will have 2 inputs: one for the header, and one for the entire script.
    rawCodeNode.values['0_code_count'] = 2;

    // The first input (index 0) is for the header from the connected node.
    // The second input (index 1) will contain the entire script.
    rawCodeNode.values['0_code_1_code'] = script;
    graph.nodes.push(rawCodeNode);

    // 3. Connect the header evaluation node to the first input of the raw code node
    const connection: Connection = {
      id: getUniqueId('edge'),
      fromNode: evalNode.id,
      fromSocket: `${evalNode.id}-1_code`, // Output socket for the JS result
      toNode: rawCodeNode.id,
      toSocket: `${rawCodeNode.id}-0_code_0_code` // The first RawCode input
    };
    graph.connections.push(connection);
    
    return graph;
  }
};