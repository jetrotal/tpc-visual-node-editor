/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { NodeInstance } from '@/types';
import { getIdentifier } from '@/engine/nodeFactory';

export interface WalkerContext<T> {
    node: NodeInstance;
    arg: any;
    prefix: string;
    key: string;
    // Walk a single argument. The walker decides how based on the arg's type.
    walk: (arg: any, newPrefix: string) => T | null;
    // Get the value from the node's state
    getValue: (key: string) => any;
}

export interface WalkerHandlers<T> {
    onOptional?: (ctx: WalkerContext<T>, isEnabled: boolean, content: T | null) => T;
    onRepeatable?: (ctx: WalkerContext<T>, items: T[], count: number) => T;
    onPrimitive?: (ctx: WalkerContext<T>) => T;
    onKeyword?: (ctx: WalkerContext<T>) => T;
    onChoice?: (ctx: WalkerContext<T>, selectedOption: any | null, childResult: T | null) => T;
    onSubcommand?: (ctx: WalkerContext<T>, childResults: T[]) => T;
    onBlock?: (ctx: WalkerContext<T>, childResults: T[]) => T; // Container
    onExecBlock?: (ctx: WalkerContext<T>) => T; // Connectable
    onGroup?: (ctx: WalkerContext<T>, childResults: T[]) => T;
    onArray?: (ctx: WalkerContext<T>, itemResults: T[]) => T;
    onBase?: (ctx: WalkerContext<T>, arrayParamResult: T | null) => T;
}

function _walk<T>(
    node: NodeInstance,
    arg: any,
    prefix: string,
    handlers: WalkerHandlers<T>,
    getValue: (key: string) => any
): T | null {
    const name = getIdentifier(arg);
    // some args like group don't have a name, but need to be processed
    if (!name && !['group', 'block', 'Array'].includes(arg.type)) return null;

    const key = `${prefix}${name}`;

    const context: WalkerContext<T> = {
        node,
        arg,
        prefix,
        key,
        getValue,
        walk: (subArg, newPrefix) => _walk(node, subArg, newPrefix, handlers, getValue),
    };
    
    // Optional choices are handled by the onChoice handler itself (by adding a "None" option)
    // Other optional types are handled here with a checkbox wrapper.
    if (arg.optional && arg.type !== 'choice') {
        const enabledKey = arg.type === 'keyword' ? key : `${key}_enabled`;
        const isEnabled = !!getValue(enabledKey);

        if (handlers.onOptional) {
            const contentArg = { ...arg, optional: false };
            const contentResult = isEnabled ? _walk(node, contentArg, prefix, handlers, getValue) : null;
            return handlers.onOptional(context, isEnabled, contentResult);
        } else if (!isEnabled) {
            // If no handler, just skip if not enabled
            return null;
        }
    }
    
    if (arg.repeatable && handlers.onRepeatable) {
        const count = getValue(`${key}_count`) || 0;
        const items: T[] = [];
        for (let i = 0; i < count; i++) {
            const itemResult = context.walk({ ...arg, repeatable: false, optional: false }, `${prefix}${name}_${i}_`);
            if (itemResult !== null) items.push(itemResult);
        }
        return handlers.onRepeatable(context, items, count);
    }
    
    switch(arg.type) {
        case 'String':
        case 'Numeric':
        case 'Variable':
        case 'Switch':
        case 'Condition':
        case 'Expression':
        case 'Value':
        case 'Numeric..Numeric':
            return handlers.onPrimitive ? handlers.onPrimitive(context) : null;
        
        case 'assignment':
        case 'keyword':
            return handlers.onKeyword ? handlers.onKeyword(context) : null;

        case 'choice':
            if (handlers.onChoice) {
                const selectedValue = getValue(key);
                const selectedOption = arg.options?.find((o: any) => getIdentifier(o) === selectedValue);
                let childResult: T | null = null;
                if (selectedOption && selectedValue !== '__none__') {
                    childResult = context.walk({...selectedOption, name: getIdentifier(selectedOption)}, `${key}_`);
                }
                return handlers.onChoice(context, selectedOption, childResult);
            }
            return null;
        
        case 'block':
            if (Array.isArray(arg.content)) { // Container
                if (handlers.onBlock) {
                    const children = arg.content.map((subArg: any, i:number) => context.walk(subArg, `${key}_${i}_`)).filter((r): r is T => r !== null);
                    return handlers.onBlock(context, children);
                }
            } else { // Executable
                if (handlers.onExecBlock) return handlers.onExecBlock(context);
            }
            return null;

        case 'subcommand':
            if (handlers.onSubcommand) {
                const children: T[] = [];
                if (arg.array_parameter) {
                    const arrayParamResult = context.walk({ ...arg.array_parameter, name: 'array_param' }, `${key}_`);
                    if (arrayParamResult !== null) children.push(arrayParamResult);
                }
                if (arg.arguments) {
                    const argChildren = arg.arguments.map((subArg: any, i: number) => context.walk(subArg, `${key}_${i}_`)).filter((r): r is T => r !== null);
                    children.push(...argChildren);
                }
                return handlers.onSubcommand(context, children);
            }
            return null;
            
        case 'group':
            if (handlers.onGroup && arg.content) {
                const children = arg.content.map((subArg: any, i: number) => context.walk(subArg, `${prefix}${i}_`)).filter((r): r is T => r !== null);
                return handlers.onGroup(context, children);
            }
            return null;
            
        case 'Array':
            if (handlers.onArray && arg.content) {
                const count = getValue(`${key}_count`) || 0;
                const items: T[] = [];
                for (let i = 0; i < count; i++) {
                    const itemResult = context.walk({ ...arg.content, repeatable: false }, `${key}_${i}_`);
                    if (itemResult !== null) items.push(itemResult);
                }
                return handlers.onArray(context, items);
            }
            // Fallback for Array without content, treat as primitive
            if (handlers.onPrimitive) {
                // Treat as a string input, but keep the 'Array' type for labeling if needed.
                const arrayAsPrimitiveArg = { ...arg, type: 'String', originalType: 'Array', name: arg.name || 'array' };
                return handlers.onPrimitive({ ...context, arg: arrayAsPrimitiveArg });
            }
            return null;

        case 'base':
            if (handlers.onBase) {
                let arrayParamResult: T | null = null;
                if (arg.array_parameter) {
                    arrayParamResult = context.walk({...arg.array_parameter, name: 'array_param'}, `${key}_`);
                }
                return handlers.onBase(context, arrayParamResult);
            }
            return null;
    }
    
    return null;
}

export function argumentWalker<T>(
    node: NodeInstance,
    handlers: WalkerHandlers<T>,
    getValue?: (key: string) => any
): T[] {
    const valueGetter = getValue || ((key: string) => node.values[key]);

    const results: T[] = [];
    const def = node.definition.nodeDef;
    
    const walk = (arg: any, prefix: string) => _walk(node, arg, prefix, handlers, valueGetter);

    if (def.array_parameter) {
        const res = walk({ ...def.array_parameter, name: 'array_param' }, '');
        if (res !== null) results.push(res);
    }
    
    if (def.arguments) {
        def.arguments.forEach((arg, i) => {
            const res = walk(arg, `${i}_`);
            if (res !== null) results.push(res);
        });
    }

    return results;
}