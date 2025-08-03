/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useCallback } from 'react';
import { NodeInstance, SocketDef, Connection } from '@/types';
import { getIdentifier } from '@/engine/nodeFactory';
import { argumentWalker, WalkerHandlers } from '@/engine/argumentWalker';
import { SocketHandle } from '@/components/SocketHandle';

interface ArgumentRendererProps {
    node: NodeInstance;
    sockets: { inputs: SocketDef[]; outputs: SocketDef[] };
    connections: Connection[];
    allNodes: NodeInstance[];
    onValueChange: (nodeId: string, key: string, value: any) => void;
    onRepeatableChange: (nodeId: string, listKey: string, action: 'add' | 'remove') => void;
}

// Helper to render the actual input controls
const renderInputControl = (
    key: string,
    arg: any,
    node: NodeInstance,
    onValueChange: ArgumentRendererProps['onValueChange'],
    connection?: Connection,
    allNodes?: NodeInstance[]
) => {
    const isConnected = !!connection;
    const style: React.CSSProperties = {width: '100%', padding:'6px', backgroundColor: 'var(--bg-color)', border:'1px solid var(--border-color)', borderRadius:'3px', color:'var(--text-color)', display: 'block'};

    if (arg.prefix) {
        style.paddingLeft = '20px';
    }

    if (isConnected && connection) {
        const sourceNode = allNodes?.find(n => n.id === connection.fromNode);
        const socketKey = connection.fromSocket.replace(`${connection.fromNode}-`, '');
        const connectedValue = sourceNode?.values[socketKey] || `Connected from ${connection.fromNode}`;
        
        const disabledStyle: React.CSSProperties = {...style, backgroundColor: '#2a2d31', opacity: 0.9, cursor: 'not-allowed', color: '#9ca3af', fontStyle: 'italic'};
        return <input type="text" value={connectedValue} disabled style={disabledStyle} title={`Connected from ${connection.fromNode}`} />;
    }

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onValueChange(node.id, key, e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };
    const onTextareaFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    };
    const textareaStyle: React.CSSProperties = {...style, resize: 'none', overflowY: 'hidden', minHeight: '28px', fontFamily: 'var(--font-mono)', paddingTop: '8px', paddingBottom: '8px' };
    const placeholder = arg.label || arg.name || arg.type;

    switch(arg.type) {
        case 'String':
        case 'Condition':
        case 'Expression':
        case 'Value':
             return <textarea rows={1} value={node.values[key] ?? ''} onChange={handleTextareaInput} onFocus={onTextareaFocus} placeholder={placeholder} style={textareaStyle}/>;
        case 'Variable':
        case 'Switch':
             return <input type='text' value={node.values[key] ?? ''} onChange={(e) => onValueChange(node.id, key, e.target.value)} placeholder={placeholder} style={style}/>;
        case 'Numeric':
            return <input type='number' value={node.values[key] ?? ''} onChange={(e) => onValueChange(node.id, key, e.target.value)} placeholder={placeholder} style={style}/>;
        case 'Numeric..Numeric':
             return <input type='text' value={node.values[key] ?? ''} onChange={(e) => onValueChange(node.id, key, e.target.value)} placeholder="e.g. 1..5" style={style}/>;
        default: return null;
    }
};

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
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
                    <input
                        type="checkbox"
                        id={enabledKey}
                        checked={isEnabled}
                        onChange={e => onValueChange(node.id, enabledKey, e.target.checked)}
                        style={{ marginTop: '4px' }}
                    />
                    <div style={{ flex: 1 }}>
                        <label htmlFor={enabledKey} style={{ cursor: 'pointer', fontSize: '0.85em', fontWeight: 500 }}>
                            {labelText}
                        </label>
                        <div style={{ opacity: isEnabled ? 1 : 0.6, pointerEvents: isEnabled ? 'all' : 'none', paddingTop: '4px' }}>
                            {isEnabled && content}
                        </div>
                    </div>
                </div>
            );
        },
        onRepeatable: ({ arg, key }, items, count) => {
            const name = getIdentifier(arg);
            return (
                <div style={{borderLeft: '2px solid #555', paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch'}}>
                    <div style={{fontWeight: 'bold', fontSize: '0.85em', color: 'var(--primary-color)'}}>{name}</div>
                    {items.map((item, i) => (
                        <div key={i} style={{border: '0px solid var(--border-color)', borderRadius: '4px', padding: '8px'}}>
                           {item}
                        </div>
                    ))}
                     <div style={{display: 'flex', gap: '5px', marginTop: '5px'}}>
                        <button onClick={() => onRepeatableChange(node.id, key, 'add')} style={{flex: 1, cursor: 'pointer'}} >➕ Add {name}</button>
                        {count > 0 && <button onClick={() => onRepeatableChange(node.id, key, 'remove')} style={{flex: 1, cursor: 'pointer'}}>➖ Remove</button>}
                    </div>
                </div>
            );
        },
        onPrimitive: ({ arg, key }) => {
            const socketId = `${node.id}-${key}`;
            const connection = connections.find(c => c.toSocket === socketId);
            
            const inputSocketDef = sockets.inputs.find(s => s.id === socketId);
            const outputSocketDef = sockets.outputs.find(s => s.id === socketId);
            
            const handleStyle: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)' };

            return (
                 <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', position: 'relative' }}>
                    {inputSocketDef && <SocketHandle socket={inputSocketDef} style={{...handleStyle, left: '-18px' }} />}
                    <span style={{ fontSize: '0.8em', fontFamily: 'var(--font-mono)', minWidth: '60px' }}>{arg.label || arg.name || arg.originalType || arg.type}</span>
                    <div style={{ flex: 1, position: 'relative' }}>
                        {arg.prefix && (
                            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: '#aaa', pointerEvents: 'none' }}>
                                {arg.prefix}
                            </span>
                        )}
                        {renderInputControl(key, arg, node, onValueChange, connection, allNodes)}
                    </div>
                    {outputSocketDef && <SocketHandle socket={outputSocketDef} style={{...handleStyle, right: '-18px' }} />}
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
                    <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                        {choiceLabel && <label style={{fontSize: '0.8em'}}>{choiceLabel}</label>}
                        <select value={selectedValue} onChange={(e) => onValueChange(node.id, key, e.target.value)} style={{flex: 1, padding:'6px', backgroundColor: 'var(--bg-color)', border:'1px solid var(--border-color)', borderRadius:'3px', color:'var(--text-color)'}}>
                            {isOptional && <option value="__none__">None</option>}
                            {arg.options?.map((opt:any, i:number) => {
                                const identifier = getIdentifier(opt);
                                const label = opt.label || identifier;
                                return <option key={i} value={identifier}>{label}</option>
                            })}
                        </select>
                    </div>
                    {childResult && (
                        <div style={{paddingTop: '5px', marginLeft: '10px'}}>
                             {childResult}
                        </div>
                    )}
                </div>
            );
        },
        onBlock: ({}, childResults) => (
             <div style={{borderLeft: '2px solid var(--border-color)', paddingLeft: '10px', marginLeft: '6px', marginTop: '5px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                {childResults}
            </div>
        ),
        onExecBlock: ({ key }) => {
            const socketId = `${node.id}-${key}`;
            const inputSocketDef: SocketDef = { id: socketId, name: key, label: 'do', io: 'input', type: 'exec', dataType: 'Exec', nodeId: node.id };
            const outputSocketDef: SocketDef = { ...inputSocketDef, io: 'output' };
            const handleStyle: React.CSSProperties = { position: 'absolute', top: '50%', transform: 'translateY(-50%)' };

            return (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', position: 'relative', padding: '4px 0' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <SocketHandle socket={inputSocketDef} style={{...handleStyle, left: '-18px' }} />
                        <span style={{ fontSize: '0.75em', fontFamily: 'var(--font-mono)', color: '#ffffff', marginLeft: '8px' }}>in</span>
                    </div>
                    <div style={{ flex: 1, height: '1px', backgroundColor: '#444', margin: '0 8px' }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.75em', fontFamily: 'var(--font-mono)', color: '#ffffff', marginRight: '8px' }}>out</span>
                        <SocketHandle socket={outputSocketDef} style={{...handleStyle, right: '-18px' }} />
                    </div>
                </div>
            );
        },
        onSubcommand: ({ arg }, childResults) => (
            <div style={{borderLeft: '2px solid var(--primary-color)', margin: '4px 0', paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
                    <label style={{fontSize: '0.9em', opacity: 0.9, fontWeight: '500'}}>{arg.name}</label>
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
                <div style={{borderLeft: '2px solid #555', paddingLeft: '10px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                        <span style={{fontWeight: 'bold', fontSize: '1.2em'}}>{startDelim}</span>
                        <span style={{fontWeight: 'bold', fontSize: '0.85em', color: 'var(--primary-color)'}}>{label}</span>
                        <span style={{fontWeight: 'bold', fontSize: '1.2em'}}>{endDelim}</span>
                    </div>
                    {items.map((item, i) => (
                        <div key={i} style={{border: '1px solid var(--border-color)', borderRadius: '4px', padding: '8px'}}>
                            {item}
                        </div>
                    ))}
                    <div style={{display: 'flex', gap: '5px', marginTop: '5px'}}>
                        <button onClick={() => onRepeatableChange(node.id, key, 'add')} style={{flex: 1, cursor: 'pointer'}} >➕ Add {label}</button>
                        {count > 0 && <button onClick={() => onRepeatableChange(node.id, key, 'remove')} style={{flex: 1, cursor: 'pointer'}}>➖ Remove</button>}
                    </div>
                </div>
            );
        },
        onBase: ({ arg }, arrayParamResult) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{fontWeight: 500}}>{arg.name}</span>
                {arg.array_parameter && (
                    <>
                        <span style={{fontSize: '1.2em'}}>[</span>
                        <div style={{flex: 1}}>{arrayParamResult}</div>
                        <span style={{fontSize: '1.2em'}}>]</span>
                    </>
                )}
            </div>
        ),
    }), [node, sockets, connections, allNodes, onValueChange, onRepeatableChange]);

    const renderedArgs = argumentWalker(node, handlers());

    return <>{renderedArgs}</>;
}