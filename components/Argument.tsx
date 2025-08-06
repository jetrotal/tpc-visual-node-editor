/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useCallback } from 'react';
import { Plus, Minus } from 'lucide-react';
import { NodeInstance, SocketDef, Connection } from '@/types';
import { getIdentifier } from '@/engine/nodeFactory';
import { argumentWalker, WalkerHandlers } from '@/engine/argumentWalker';
import { SocketHandle } from '@/components/SocketHandle';
import { ManagedInput } from './ManagedInput';

interface ArgumentRendererProps {
    node: NodeInstance;
    sockets: { inputs: SocketDef[]; outputs: SocketDef[] };
    connections: Connection[];
    allNodes: NodeInstance[];
    onValueChange: (nodeId: string, key: string, value: any) => void;
    onRepeatableChange: (nodeId: string, listKey: string, action: 'add' | 'remove') => void;
}

export function ArgumentRenderer(props: ArgumentRendererProps) {
    const { node, sockets, connections, allNodes, onValueChange, onRepeatableChange } = props;

    // Memoize handlers to prevent re-creation on every render
    const handlers = useCallback((): WalkerHandlers<React.ReactNode> => ({
        onOptional: ({ arg, key }, isEnabled, content) => {
            const enabledKey = arg.type === 'keyword' ? key : `${key}_enabled`;
            const labelText = getIdentifier(arg);
            
            // Ensure the value exists in the state
            if (node.values[enabledKey] === undefined) {
                Promise.resolve().then(() => onValueChange(node.id, enabledKey, false));
            }
            
            return (
                <div className="argument-optional-group">
                    <input
                        type="checkbox"
                        id={enabledKey}
                        checked={isEnabled}
                        onChange={e => onValueChange(node.id, enabledKey, e.target.checked)}
                    />
                    <div className="flex-1">
                        <label htmlFor={enabledKey} className="argument-optional-label">
                            {labelText}
                        </label>
                        <div className={`argument-optional-content ${isEnabled ? '' : 'disabled'}`}>
                            {isEnabled && content}
                        </div>
                    </div>
                </div>
            );
        },
        onRepeatable: ({ arg, key }, items, count) => {
            const name = getIdentifier(arg);
            return (
                <div className="argument-repeatable-group">
                    <div className="argument-repeatable-title">{name}</div>
                    {items.map((item, i) => (
                        <div key={i} className="argument-repeatable-item">
                           {item}
                        </div>
                    ))}
                     <div className="argument-repeatable-controls">
                        <button className="button button-primary" onClick={() => onRepeatableChange(node.id, key, 'add')}>
                            <Plus size={14} /> Add {name}
                        </button>
                        {count > 0 && 
                            <button className="button button-danger" onClick={() => onRepeatableChange(node.id, key, 'remove')}>
                                <Minus size={14} /> Remove
                            </button>
                        }
                    </div>
                </div>
            );
        },
        onPrimitive: ({ arg, key }) => {
            const socketId = `${node.id}-${key}`;
            const connection = connections.find(c => c.toSocket === socketId);
            
            const inputSocketDef = sockets.inputs.find(s => s.id === socketId);
            const outputSocketDef = sockets.outputs.find(s => s.id === socketId);
            const isConnected = !!connection;

            const renderManagedInput = () => {
                const placeholder = arg.label || arg.name || arg.type;
                let inputType: 'text' | 'number' | 'textarea' = 'text';

                switch(arg.type) {
                    case 'String':
                    case 'Condition':
                    case 'Expression':
                    case 'Value':
                    case 'RawCode':
                    case 'JSCode':
                        inputType = 'textarea';
                        break;
                    case 'Numeric':
                        inputType = 'number';
                        break;
                    case 'Numeric..Numeric':
                    case 'Variable':
                    case 'Switch':
                        inputType = 'text';
                        break;
                    default: return null;
                }

                return <ManagedInput
                    initialValue={node.values[key] ?? ''}
                    onCommit={(value) => onValueChange(node.id, key, value)}
                    type={inputType}
                    placeholder={placeholder}
                    inputProps={{ 'data-prefix': !!arg.prefix }}
                />
            };

            return (
                 <div className="argument-primitive">
                    {inputSocketDef && <SocketHandle key={`${inputSocketDef.id}-in`} socket={inputSocketDef} className="abs-center-y" />}
                    <span className="argument-primitive-label">{arg.label || arg.name || arg.originalType || arg.type}</span>
                    <div className="argument-primitive-input-wrapper">
                        {arg.prefix && (
                            <span className="argument-input-prefix">
                                {arg.prefix}
                            </span>
                        )}
                        {isConnected ? (
                             <input type="text" value={connection.resolvedValue ?? ''} disabled className="input-base" title={`Connected from ${connection.fromNode}`} />
                        ) : (
                            renderManagedInput()
                        )}
                    </div>
                    {outputSocketDef && <SocketHandle key={`${outputSocketDef.id}-out`} socket={outputSocketDef} className="abs-center-y" />}
                </div>
            );
        },
        onKeyword: () => null, // Keywords are handled by onOptional
        onChoice: ({ arg, key, getValue }, selectedOption, childResult) => {
            const isOptional = !!arg.optional;
            const firstOptionIdentifier = arg.options?.[0] ? getIdentifier(arg.options[0]) : '';
            const defaultValue = isOptional ? '__none__' : firstOptionIdentifier;
            const selectedValue = getValue(key) ?? defaultValue;
            
            if (getValue(key) === undefined) {
                Promise.resolve().then(() => onValueChange(node.id, key, defaultValue));
            }
            
            const choiceLabel = arg.label === undefined ? (arg.name || 'Choice') : arg.label;
            
            return (
                <div>
                    <div className="argument-choice-group">
                        {choiceLabel && <label>{choiceLabel}</label>}
                        <select value={selectedValue} onChange={(e) => onValueChange(node.id, key, e.target.value)} className="input-base">
                            {isOptional && <option value="__none__">None</option>}
                            {arg.options?.map((opt:any, i:number) => {
                                const identifier = getIdentifier(opt);
                                const label = opt.label || identifier;
                                return <option key={i} value={identifier}>{label}</option>
                            })}
                        </select>
                    </div>
                    {childResult && (
                        <div className="argument-choice-child">
                             {childResult}
                        </div>
                    )}
                </div>
            );
        },
        onBlock: ({}, childResults) => (
             <div className="argument-block">
                {childResults}
            </div>
        ),
        onExecBlock: ({ key }) => {
            const socketId = `${node.id}-${key}`;
            const inputSocketDef: SocketDef = { id: socketId, name: key, label: 'do', io: 'input', type: 'exec', dataType: 'Exec', nodeId: node.id };
            const outputSocketDef: SocketDef = { ...inputSocketDef, io: 'output' };

            return (
                <div className="argument-exec-block">
                    <div className="handle-wrapper">
                        <SocketHandle socket={inputSocketDef} className="abs-center-y" />
                        <span className="label in">in</span>
                    </div>
                    <div className="divider" />
                    <div className="handle-wrapper">
                        <span className="label out">out</span>
                        <SocketHandle socket={outputSocketDef} className="abs-center-y" />
                    </div>
                </div>
            );
        },
        onSubcommand: ({ arg }, childResults) => (
            <div className="argument-subcommand">
                <div className="argument-subcommand-header">
                    <label>{arg.name}</label>
                    {/* Render array_parameter first if it exists */}
                    {arg.array_parameter && childResults[0]}
                </div>
                {/* Render other arguments */}
                {arg.array_parameter ? childResults.slice(1) : childResults}
            </div>
        ),
        onGroup: (_, childResults) => <>{childResults}</>,
        onArray: ({ arg, key }, items) => {
            const arrayContent = arg.content;
            if (!arrayContent) return null;
            const contentIdentifier = getIdentifier(arrayContent);
            const label = arg.name || contentIdentifier || 'Item';
            const [startDelim, endDelim] = arg.delimiters || ['[', ']'];
            const count = items.length;

            return (
                <div className="argument-array-group">
                    <div className="argument-array-title">
                        <span className="delim">{startDelim}</span>
                        <span>{label}</span>
                        <span className="delim">{endDelim}</span>
                    </div>
                    {items.map((item, i) => (
                        <div key={i} className="argument-array-item">
                            {item}
                        </div>
                    ))}
                    <div className="argument-array-controls">
                        <button className="button button-primary" onClick={() => onRepeatableChange(node.id, key, 'add')}>
                            <Plus size={14} /> Add {label}
                        </button>
                        {count > 0 && 
                            <button className="button button-danger" onClick={() => onRepeatableChange(node.id, key, 'remove')}>
                                <Minus size={14} /> Remove
                            </button>
                        }
                    </div>
                </div>
            );
        },
        onBase: ({ arg }, arrayParamResult) => (
            <div className="argument-base-group">
                <span className="name">{arg.name}</span>
                {arg.array_parameter && (
                    <>
                        <span className="delim">[</span>
                        <div className="array-param-wrapper">{arrayParamResult}</div>
                        <span className="delim">]</span>
                    </>
                )}
            </div>
        ),
    }), [node, sockets, connections, allNodes, onValueChange, onRepeatableChange]);

    const renderedArgs = argumentWalker(node, handlers());

    return <>{renderedArgs}</>;
}
