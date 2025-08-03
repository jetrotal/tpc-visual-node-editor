/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

export const CodePreview = ({ code }: { code: string }) => (
  <>
    <h2 style={{ margin: '10px 0', fontSize: '1.2em' }}>Generated Code</h2>
    <pre style={{ flex: 1, overflow: 'auto', backgroundColor: 'var(--bg-color)', padding: '15px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>
      {code || '// Drag nodes onto the canvas to start'}
    </pre>
  </>
);
