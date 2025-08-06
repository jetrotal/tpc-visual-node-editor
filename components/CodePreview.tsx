/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

export const CodePreview = ({ code }: { code: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setIsCopied(true);
  };

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => setIsCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  // Reset copy button text if code changes
  useEffect(() => {
    setIsCopied(false);
  }, [code]);

  const codeLines = code.split('\n');

  return (
    <div className="code-preview">
      <div className="code-preview-header">
        <h2>Generated Code</h2>
        <button
          onClick={handleCopy}
          className="icon-button"
          disabled={!code}
          aria-label={isCopied ? 'Copied' : 'Copy code'}
          title={isCopied ? 'Copied' : 'Copy code'}
        >
          {isCopied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      <div className="code-preview-code-wrapper">
        {code ? (
          <pre className="code-preview-code">
            {codeLines.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </pre>
        ) : (
          <div className="code-preview-placeholder">
            // Drag nodes onto the canvas to start
          </div>
        )}
      </div>
    </div>
  );
};