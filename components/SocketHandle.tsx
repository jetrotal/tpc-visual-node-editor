/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Handle, Position, HandleProps } from '@xyflow/react';
import { SocketDef } from '@/types';

interface SocketHandleProps {
  socket: SocketDef;
  isMainExec?: boolean;
}

export const SocketHandle: React.FC<SocketHandleProps & Omit<HandleProps, 'id'|'type'|'position'>> = ({ socket, isMainExec = false, style, className, ...rest }) => {
  const isInput = socket.io === 'input';
  let handleId = socket.id.replace(`${socket.nodeId}-`, '');

  if (isMainExec) {
    handleId = `main_${handleId}`;
  }

  const handleIdWithDirection = isInput ? `${handleId}_in` : `${handleId}_out`;
  const position = isInput ? Position.Left : Position.Right;
  
  const handleClassName = [
    'socket-handle',
    socket.type, // 'exec' or 'data'
    socket.io, // 'input' or 'output'
    className || '',
    isMainExec ? 'main-exec' : ''
  ].join(' ').trim();
  
  const dataTypeForColor = (socket.type === 'exec' ? 'Exec' : (socket.dataType || 'Default')).replace('..', '--');

  const finalStyle: React.CSSProperties = {
      backgroundColor: `var(--socket-color-${dataTypeForColor})`,
      ...style
  };

  if (socket.type === 'exec') {
    if (isMainExec) {
      // Main exec sockets are positioned close to the node body, consistent with data sockets.
      if (isInput) {
        finalStyle.left = '-8px';
      } else {
        finalStyle.right = '-8px';
      }
    } else {
      // Nested exec sockets are positioned further out.
      if (isInput) {
        finalStyle.left = '-24px';
      } else {
        finalStyle.right = '-21px';
      }
    }
  }

  return (
    <Handle
      id={handleIdWithDirection}
      type={isInput ? 'target' : 'source'}
      position={position}
      className={handleClassName}
      style={finalStyle}
      {...rest}
    />
  );
};