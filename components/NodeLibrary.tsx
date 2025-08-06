

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
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
        <div className="node-library">
            <h2>Nodes</h2>
            <input 
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="node-library-search"
            />
            <div className="node-library-list">
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
                                className="node-library-category"
                                aria-expanded={!isCollapsed}
                            >
                                <span className={`node-library-category-arrow ${isCollapsed ? 'collapsed' : ''}`}>
                                    <ChevronDown size={16} />
                                </span>
                                <span>{category.replace(/_/g, ' ')}</span>
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
                                            className="node-library-item">
                                            <div className="node-library-item-name">{def.displayName}</div>
                                            <div className="node-library-item-sig">
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
        </div>
    );
};