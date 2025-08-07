/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useLayoutEffect, useRef, useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, HandleProps } from '@xyflow/react';
import { SocketDef } from '@/types';
import { HandlePortalContext } from '@/contexts/HandlePortalContext';

interface SocketHandleProps {
  socket: SocketDef;
  isMainExec?: boolean;
  isStatic?: boolean; // For handles whose position is not determined by layout flow (e.g., collapsed nodes)
  staticTop?: number; // The static top position
}

export const SocketHandle: React.FC<SocketHandleProps & Omit<HandleProps, 'id'|'type'|'position'>> = ({ socket, isMainExec = false, isStatic = false, staticTop = 0, style, className, ...rest }) => {
  const portalContainers = useContext(HandlePortalContext);
  const placeholderRef = useRef<HTMLSpanElement>(null);
  // For dynamic handles, start with null `top` to indicate position is not yet calculated.
  const [top, setTop] = useState<number | null>(isStatic ? staticTop : null);

  useLayoutEffect(() => {
    // Static handles don't need calculation and this effect shouldn't run for them.
    if (isStatic) return;
    
    // For dynamic handles, we need the placeholder to exist.
    if (!placeholderRef.current) return;

    const placeholderEl = placeholderRef.current;
    
    // Calculate position relative to the custom-node ancestor by summing offsets.
    // This is more robust than getBoundingClientRect for nested, transformed elements.
    let topOffset = 0;
    let currentElement: HTMLElement | null = placeholderEl;
    
    while (currentElement && !currentElement.classList.contains('custom-node')) {
        topOffset += currentElement.offsetTop;
        currentElement = currentElement.offsetParent as HTMLElement | null;
    }

    // Center the handle vertically on the placeholder's calculated position.
    const calculatedTop = topOffset + (placeholderEl.offsetHeight / 2);

    // Use functional state update to avoid dependency on `top` and prevent re-render loops.
    // Only update if the position has changed significantly.
    setTop(prevTop => {
        if (prevTop === null || Math.abs(prevTop - calculatedTop) > 0.5) {
            return calculatedTop;
        }
        return prevTop;
    });
    // No dependency array means this effect runs on every render for dynamic handles,
    // which is what we need to react to any layout changes.
  });
  
  const isInput = socket.io === 'input';
  let handleId = socket.id.replace(`${socket.nodeId}-`, '');

  if (isMainExec) {
    handleId = `main_${handleId}`;
  }

  const handleIdWithDirection = isInput ? `${handleId}_in` : `${handleId}_out`;
  const position = isInput ? Position.Left : Position.Right;
  
  const handleClassName = [
    'socket-handle',
    socket.type,
    socket.io,
    className || '',
    isMainExec ? 'main-exec' : ''
  ].join(' ').trim();
  
  const dataTypeForColor = (socket.type === 'exec' ? 'Exec' : (socket.dataType || 'Default')).replace('..', '--');

  const finalStyle: React.CSSProperties = {
      backgroundColor: `var(--socket-color-${dataTypeForColor})`,
      top: `${top}px`, // Use the calculated or static top value
      ...style
  };

  const handleComponent = (
    <Handle
      id={handleIdWithDirection}
      type={isInput ? 'target' : 'source'}
      position={position}
      className={handleClassName}
      style={finalStyle}
      {...rest}
    />
  );
  
  const portalContainer = isInput ? portalContainers.left : portalContainers.right;

  return (
    <>
      {/* The placeholder must always be rendered for dynamic handles to keep the layout stable. */}
      {!isStatic && <span ref={placeholderRef} className="socket-handle-placeholder" />}
      {/* Only render the handle via portal when its container and position are ready. */}
      {portalContainer && top !== null && createPortal(handleComponent, portalContainer)}
    </>
  );
};