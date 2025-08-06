/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { NodeInstance, SocketDef, Position } from '@/types';
import { argumentWalker, WalkerHandlers } from './argumentWalker';

let nextId = 0;
const getUniqueId = (prefix: string = 'id') => `${prefix}-${nextId++}`;

export const getIdentifier = (item: any): string => {
    if (item.type === 'group' && Array.isArray(item.content) && item.content.length > 0) {
        const firstKeyword = item.content.find(c => c.type === 'keyword');
        if (firstKeyword?.value) {
            return firstKeyword.value;
        }
    }
    return item.name || item.value || item.type || '';
};

// Function to generate all sockets for a node based on its current state
export const generateNodeSockets = (nodeInstance: NodeInstance): { inputs: SocketDef[], outputs: SocketDef[] } => {
  const allSockets: SocketDef[] = [];
  const nodeId = nodeInstance.id;
  const fullDefinition = nodeInstance.definition;
  const nodeDef = fullDefinition.nodeDef;
  const sourceFile = fullDefinition.sourceFile;

  // Add basic exec sockets based on the command's source file category.
  const isEventCommand = sourceFile && sourceFile.includes('/Event_Commands/');
  const isDirective = sourceFile && sourceFile.includes('/Directives/');
  const isMetaCommand = sourceFile && sourceFile.includes('/Meta_commands/');
  const isUtilityCommand = sourceFile && sourceFile.includes('/Utility/');

  if (isEventCommand || isDirective || isMetaCommand || isUtilityCommand) {
    allSockets.push({ id: `${nodeId}-exec_out`, name: 'exec_out', label: '▶', io: 'output', type: 'exec', dataType: 'Exec', nodeId });
    allSockets.push({ id: `${nodeId}-exec_in`, name: 'exec_in', label: '▶', io: 'input', type: 'exec', dataType: 'Exec', nodeId });
  }

  // Define handlers for the walker. T is SocketDef[].
  const handlers: WalkerHandlers<SocketDef[]> = {
      onPrimitive: ({ arg, key }) => {
          const dataType = arg.type;

          if (dataType === 'JSCode') {
            const baseSocket = { id: `${nodeId}-${key}`, name: key, dataType, nodeId, type: 'data' as const };
            // An input for the code itself, and an output for the evaluated result.
            return [
              { ...baseSocket, io: 'input', label: arg.label || arg.name || 'JS Code', dataType: 'Default' },
              { ...baseSocket, io: 'output', label: 'Result', dataType: 'Default' },
            ];
          }

          if (dataType === 'RawCode') {
              const baseSocket = { id: `${nodeId}-${key}`, name: key, dataType, nodeId };
              return [
                  // The input socket can accept any data type, and will use the field label.
                  {...baseSocket, io: 'input', type: 'data', dataType: 'Default', label: arg.label || arg.name || 'Input' },
                  // The output socket provides the result as a string, and can connect anywhere.
                  {...baseSocket, io: 'output', type: 'data', dataType: 'Default', label: 'Output' }
              ];
          }

          const baseSocket = { id: `${nodeId}-${key}`, name: key, label: arg.label || arg.name || arg.type, dataType, nodeId };
          return [
              {...baseSocket, io: 'input', type: 'data'},
              {...baseSocket, io: 'output', type: 'data'}
          ];
      },
      onExecBlock: ({ key }) => {
          const baseSocket = { id: `${nodeId}-${key}`, name: key, label: 'do', dataType: 'Exec', nodeId };
          return [
              {...baseSocket, io: 'output', type: 'exec'},
              {...baseSocket, io: 'input', type: 'exec'}
          ];
      },
      onRepeatable: ({ arg }, items) => {
        const allSockets = items.flat();
        if (arg.type === 'RawCode') {
            const inputs = allSockets.filter(s => s.io === 'input');
            const outputs = allSockets.filter(s => s.io === 'output');
            inputs.forEach((input, i) => input.label = `Code ${i + 1} In`);
            outputs.forEach((output, i) => output.label = `Code ${i + 1} Out`);
            return [...inputs, ...outputs];
        }
        return allSockets;
    },
      // The rest of the handlers just combine children results
      onChoice: (_, __, childResult) => childResult || [],
      onSubcommand: (_, childResults) => childResults.flat(),
      onBlock: (_, childResults) => childResults.flat(),
      onGroup: (_, childResults) => childResults.flat(),
      onArray: (_, itemResults) => itemResults.flat(),
      onBase: (_, arrayParamResult) => arrayParamResult || []
  };

  if (nodeInstance.isExpanded || !nodeDef.arguments?.length) {
      const generatedSockets = argumentWalker(nodeInstance, handlers);
      allSockets.push(...generatedSockets.flat());
  }

  return {
    inputs: allSockets.filter(s => s.io === 'input'),
    outputs: allSockets.filter(s => s.io === 'output'),
  };
};

export const nodeFactory = {
  createNodeDefinition: (jsonDef: any, type: string) => {
    const nodeDef = { ...jsonDef, type };
    const defaultValues: Record<string, any> = {};
    
    const processArgsForDefaults = (args: any[], prefix: string) => {
      args.forEach((arg, i) => {
        const argName = getIdentifier(arg);
        let currentKey: string;
        
        if (arg.type === 'group') {
            if (arg.content) processArgsForDefaults(arg.content, `${prefix}${i}_`);
            return;
        }
        
        currentKey = `${prefix}${argName}`;

        if (arg.optional && arg.type !== 'choice') {
            const enabledKey = arg.type === 'keyword' ? currentKey : `${currentKey}_enabled`;
            if (defaultValues[enabledKey] === undefined) defaultValues[enabledKey] = false;
        }

        if (arg.repeatable) {
            if (defaultValues[`${currentKey}_count`] === undefined) defaultValues[`${currentKey}_count`] = arg.optional ? 0 : 1;
            const count = defaultValues[`${currentKey}_count`];
            for (let j = 0; j < count; j++) {
                processArgsForDefaults([{...arg, repeatable: false}], `${currentKey}_${j}_`);
            }
            return;
        }

        switch (arg.type) {
            case 'String':
            case 'Numeric':
            case 'Variable':
            case 'Switch':
            case 'Condition':
            case 'Expression':
            case 'Value':
            case 'Numeric..Numeric':
            case 'RawCode':
            case 'JSCode':
                if (defaultValues[currentKey] === undefined) defaultValues[currentKey] = '';
                break;
            case 'keyword':
                if (defaultValues[currentKey] === undefined) defaultValues[currentKey] = false;
                break;
            case 'choice':
                if (defaultValues[currentKey] === undefined) {
                    const firstOpt = arg.options?.[0];
                    if (arg.optional) {
                        defaultValues[currentKey] = '__none__';
                    } else if (firstOpt) {
                        const firstOptId = getIdentifier(firstOpt);
                        defaultValues[currentKey] = firstOptId;
                        
                        const subArg = {...firstOpt, name: firstOptId};
                        processArgsForDefaults([subArg], `${currentKey}_`);
                    }
                }
                break;
            case 'subcommand':
                if (arg.array_parameter) {
                     const arrayArg = {...arg.array_parameter, name: 'array_param'};
                     processArgsForDefaults([arrayArg], `${currentKey}_`);
                }
                if (arg.arguments) {
                    processArgsForDefaults(arg.arguments, `${currentKey}_`);
                }
                break;
            case 'block':
                 if (Array.isArray(arg.content)) {
                    processArgsForDefaults(arg.content, `${currentKey}_`);
                 }
                break;
            case 'Array':
                if (defaultValues[`${currentKey}_count`] === undefined) defaultValues[`${currentKey}_count`] = arg.optional ? 0 : 1;
                const count = defaultValues[`${currentKey}_count`];
                if (arg.content) {
                    for (let j = 0; j < count; j++) {
                        processArgsForDefaults([arg.content], `${currentKey}_${j}_`);
                    }
                }
                break;
        }
      });
    }

    processArgsForDefaults(jsonDef.arguments || [], '');

    if (jsonDef.array_parameter) {
       const arrayArg = {...jsonDef.array_parameter, name: 'array_param'};
       processArgsForDefaults([arrayArg], '');
    }

    return { nodeDef, defaultValues };
  },

  createNodeInstance: (def: any, position: Position, displayName: string): NodeInstance => {
    const nodeId = getUniqueId('node');
    const hasComplexArgs = def.nodeDef.arguments?.length > 0 || !!def.nodeDef.array_parameter;

    // Create a temporary instance to pass to the socket generator
    // This is required because generateNodeSockets depends on properties of the instance
    const tempInstance: NodeInstance = {
      id: nodeId,
      type: def.type,
      displayName,
      position,
      definition: def,
      sockets: { inputs: [], outputs: [] }, // Temporary empty
      values: { ...def.defaultValues },
      isExpanded: !!hasComplexArgs,
      isVisible: true,
    };
    
    // Now generate the real sockets for the instance
    const sockets = generateNodeSockets(tempInstance);
    
    // Return the final, complete instance
    return {
      ...tempInstance,
      sockets,
    };
  },
};