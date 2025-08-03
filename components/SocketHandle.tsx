/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { Handle, Position, HandleProps } from '@xyflow/react';
import { SocketDef } from '@/types';
import { SOCKET_COLORS } from '@/config';

interface SocketHandleProps {
  socket: SocketDef;
  isMainExec?: boolean;
}

export const SocketHandle: React.FC<SocketHandleProps & Omit<HandleProps, 'id'|'type'|'position'>> = ({ socket, isMainExec = false, style, ...rest }) => {
  const isInput = socket.io === 'input';
  let handleId = socket.id.replace(`${socket.nodeId}-`, '');

  if (isMainExec) {
    handleId = `main_${handleId}`;
  }

  const handleIdWithDirection = isInput ? `${handleId}_in` : `${handleId}_out`;
  const position = isInput ? Position.Left : Position.Right;
  const socketColor = socket.type === 'exec' ? SOCKET_COLORS.Exec : (SOCKET_COLORS[socket.dataType] || SOCKET_COLORS.Default);

  const baseStyle: React.CSSProperties = {
    width: '12px',
    height: '12px',
    border: '2px solid var(--bg-color-lighter)',
    backgroundColor: socketColor,
    cursor: 'crosshair',
  };

  const execBaseTransform = 'rotate(45deg)';
  const execStyle: React.CSSProperties = {
    ...baseStyle,
    width: '14px',
    height: '14px',
    borderRadius: '0px',
  };

  const dataStyle: React.CSSProperties = {
    ...baseStyle,
    borderRadius: '50%',
  };
  
  const { transform: parentTransform, ...restOfStyle } = style || {};

  const finalTransform = [
    ...(socket.type === 'exec' ? [execBaseTransform] : []),
    ...(parentTransform ? [parentTransform] : [])
  ].join(' ').trim();
  
  const finalStyle = {
      ...(socket.type === 'exec' ? execStyle : dataStyle),
      ...restOfStyle,
      ...(finalTransform ? { transform: finalTransform } : {})
  };

  return (
    <Handle
      id={handleIdWithDirection}
      type={isInput ? 'target' : 'source'}
      position={position}
      style={finalStyle}
      {...rest}
    />
  );
};