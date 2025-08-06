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
  
  // This ref helps us know if a commit is happening because of a blur event
  const isBlurring = useRef(false);
  // This ref stores the latest onCommit function to avoid dependency issues in useEffect
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

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
    // Auto-resize
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  const onTextareaFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Auto-resize on focus
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
  };

  if (type === 'textarea') {
    return (
      <textarea
        rows={1}
        {...commonProps}
        onChange={handleTextareaInput}
        onFocus={onTextareaFocus}
      />
    );
  }

  return (
    <input
      type={type}
      {...commonProps}
      onChange={handleChange}
    />
  );
};
