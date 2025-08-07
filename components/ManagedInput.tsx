/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';

interface ManagedInputProps {
  initialValue: string | number;
  onCommit: (value: string | number) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'textarea';
  className?: string;
  inputProps?: any;
  debounceMs?: number;
}

export const ManagedInput: React.FC<ManagedInputProps> = ({
  initialValue,
  onCommit,
  placeholder,
  type = 'text',
  className = 'input-base',
  inputProps = {},
  debounceMs = 300,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const isBlurring = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Effect for auto-resizing
  useEffect(() => {
    if (inputRef.current && measureRef.current) {
      // Determine content for width measurement
      let contentForWidth = String(value);
      if (type === 'textarea') {
        const lines = String(value).split('\n');
        contentForWidth = lines.reduce((longest, current) => (current.length > longest.length ? current : longest), '');
      }

      // Use placeholder if value is empty for a minimum width
      if (!contentForWidth && placeholder) {
        contentForWidth = placeholder;
      }
      
      measureRef.current.textContent = contentForWidth || ' '; // Use a space to prevent collapse to 0

      // Horizontal resize
      const newWidth = measureRef.current.offsetWidth + (type === 'textarea' ? 0 : 2);
      inputRef.current.style.width = `${newWidth}px`;

      // Vertical resize for textarea
      if (type === 'textarea') {
        inputRef.current.style.height = 'auto'; // Reset height
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
      }
    }
  }, [value, placeholder, type]);


  // Sync with external changes if the input is not focused
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
        setValue(initialValue);
    }
  }, [initialValue]);

  // Debounced commit effect
  useEffect(() => {
    // Don't commit if the value is the same as the initial prop,
    // as this could be an external update.
    if (value === initialValue) {
      return;
    }

    const handler = setTimeout(() => {
        // Do not commit if a blur event is happening, as it will handle the commit.
        if (!isBlurring.current) {
            onCommitRef.current(value);
        }
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, initialValue, debounceMs]);

  const handleCommit = () => {
    isBlurring.current = true;
    if (String(value) !== String(initialValue)) {
      onCommit(value);
    }
    // Reset the flag shortly after
    setTimeout(() => { isBlurring.current = false; }, 100);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      handleCommit();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
        setValue(initialValue);
        inputRef.current?.blur();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e);
  };

  const onTextareaFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Height is handled by the main effect, but let's ensure it's correct on focus.
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  const commonProps = {
    ...inputProps,
    ref: inputRef,
    value: value ?? '',
    onBlur: handleCommit,
    onKeyDown: handleKeyDown,
    placeholder,
    className,
    style: {
      minWidth: '100%',
    },
  };

  const measureSpanClassName = `${className} measure-span ${type === 'textarea' ? 'measure-span-textarea' : ''}`;

  return (
    <div style={{ position: 'relative', display: 'block', width: '100%' }}>
      <span ref={measureRef} className={measureSpanClassName} />
      {type === 'textarea' ? (
        <textarea
          rows={1}
          {...commonProps}
          onChange={handleTextareaInput}
          onFocus={onTextareaFocus}
        />
      ) : (
        <input
          type={type}
          {...commonProps}
          onChange={handleChange}
        />
      )}
    </div>
  );
};