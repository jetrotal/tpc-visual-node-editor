/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, children, align = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = useCallback(() => setIsOpen(prev => !prev), []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown();
    }
  }, [toggleDropdown]);

  return (
    <div className="dropdown-menu-wrapper" ref={wrapperRef}>
      <div 
        className="dropdown-trigger" 
        onClick={toggleDropdown} 
        onKeyDown={handleKeyDown}
        role="button" 
        tabIndex={0} 
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {trigger}
      </div>
      {isOpen && (
        <div 
          className={`dropdown-content align-${align}`} 
          role="menu"
          onClick={(e) => {
            // Check if a menu item (not a submenu trigger) was clicked and close the menu
            if ((e.target as HTMLElement).closest('.dropdown-item')) {
              setIsOpen(false);
            }
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};