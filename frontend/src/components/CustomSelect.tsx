import React, { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder || 'Pilih...';

  return (
    <div className="cs-wrap" ref={ref}>
      <button
        className={`cs-trigger ${open ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span className="cs-trigger-text">{selectedLabel}</span>
        <svg className="cs-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      {open && (
        <div className="cs-panel">
          <div className="cs-panel-list">
            {options.map(opt => (
              <button
                key={opt.value}
                className={`cs-option ${value === opt.value ? 'selected' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                type="button"
              >
                {value === opt.value && (
                  <svg className="cs-check" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
