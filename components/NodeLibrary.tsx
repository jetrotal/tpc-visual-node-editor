

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { DATA_FILES } from '@/config';

interface NodeLibraryProps {
    definitions: any[];
    onDragStart: (e: React.DragEvent, type: string) => void;
    onClick: (e: React.MouseEvent, type: string) => void;
}

export const NodeLibrary = ({ definitions, onDragStart, onClick }: NodeLibraryProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
        Directives: true,
    });

    const toggleCategory = (category: string) => {
        setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };
    
    const filteredDefs = useMemo(() => {
        if (!searchTerm) return definitions;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return definitions.filter(d => 
            (d.displayName && d.displayName.toLowerCase().includes(lowerCaseSearch)) ||
            (d.signature && d.signature.toLowerCase().includes(lowerCaseSearch)) ||
            d.type.toLowerCase().includes(lowerCaseSearch) ||
            (d.nodeDef?.description && d.nodeDef.description.toLowerCase().includes(lowerCaseSearch))
        );
    }, [definitions, searchTerm]);

    return (
        <>
            <h2 style={{ margin: '10px 0', fontSize: '1.2em' }}>Nodes</h2>
            <input 
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '8px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-color)' }}
            />
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {Object.entries(DATA_FILES).map(([category, files]) => {
                    const categoryNodes = filteredDefs.filter(def => {
                        const defCategoryPath = def.sourceFile.substring(0, def.sourceFile.lastIndexOf('/'));
                        return files.some(f => f.startsWith(defCategoryPath));
                    });

                    if (categoryNodes.length === 0) return null;
                    
                    const isCollapsed = !!collapsedCategories[category];

                    return (
                        <div key={category}>
                            <h3 
                                onClick={() => toggleCategory(category)}
                                style={{ 
                                    marginTop: '20px', 
                                    fontSize: '1em', 
                                    color: 'var(--primary-color)', 
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <span style={{ marginRight: '8px', display: 'inline-block', transition: 'transform 0.2s ease-in-out', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}}>▼</span>
                                {category.replace(/_/g, ' ')}
                            </h3>
                            {!isCollapsed && (
                                <div>
                                    {categoryNodes.map(def => (
                                        <div
                                            key={def.type}
                                            draggable
                                            onDragStart={(e) => onDragStart(e, def.type)}
                                            onClick={(e) => onClick(e, def.type)}
                                            title={def.type}
                                            style={{ padding: '10px', backgroundColor: 'var(--bg-color-lighter)', borderRadius: '4px', marginBottom: '8px', cursor: 'pointer', userSelect: 'none', borderLeft: '3px solid var(--primary-color)' }}>
                                            <div style={{ fontWeight: '500' }}>{def.displayName}</div>
                                            <div style={{ fontSize: '0.8em', fontFamily: 'var(--font-mono)', opacity: 0.7, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {def.signature}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
};