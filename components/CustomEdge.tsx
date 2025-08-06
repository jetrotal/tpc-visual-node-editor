/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import {
  EdgeProps,
  getSmoothStepPath,
  useReactFlow,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import { X } from 'lucide-react';


export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  zIndex,
}: EdgeProps & { zIndex?: number }) => {
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  
  // This ref stores the "permanent" z-index, based on selection.
  const baseZIndex = useRef<number | undefined>(zIndex);

  // This effect keeps the baseZIndex ref in sync with the zIndex from props,
  // but ignores the temporary value used for hovering.
  useEffect(() => {
    if (zIndex !== 9999) {
      baseZIndex.current = zIndex;
    }
  }, [zIndex]);

  // This effect synchronizes the hover state with the edge's z-index in the React Flow state.
  // It runs after the render, ensuring that any state updates from click events (which change `selected` and `zIndex` props) are processed first.
  useEffect(() => {
    if (isHovered) {
      // On hover, bring to the very front.
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, zIndex: 9999 } : e))
      );
    } else {
      // When hover ends, restore to its base z-index.
      // We only do this if the edge's current zIndex is the temporary hover one
      // to avoid unnecessary updates on initial render or other state changes.
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id === id && e.zIndex === 9999) {
            return { ...e, zIndex: baseZIndex.current };
          }
          return e;
        })
      );
    }
  }, [id, isHovered, setEdges]);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt: React.MouseEvent) => {
    evt.stopPropagation();
    setEdges((es) => es.filter((e) => e.id !== id));
  };

  const onMouseEnter = () => setIsHovered(true);
  const onMouseLeave = () => setIsHovered(false);

  const showButton = isHovered || selected;
  const displayZIndex = isHovered ? 9999 : zIndex;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: showButton
            ? ((style.strokeWidth as number) || 2) + 2
            : style.strokeWidth,
        }}
      />
      {/* A wider, invisible path for easier hovering */}
      <path
        className="react-flow__edge-path edge-hover-path"
        d={edgePath}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      <EdgeLabelRenderer>
        {showButton && (
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              zIndex: displayZIndex,
            }}
            className="nodrag nopan edge-label"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            <button
              className="edge-delete-button"
              onClick={onEdgeClick}
              title="Delete connection"
              aria-label="Delete connection"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};