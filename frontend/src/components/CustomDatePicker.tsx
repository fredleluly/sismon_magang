import React, { useState, useRef, useEffect } from 'react';
import './CustomDatePicker.css';

interface CustomDatePickerProps {
  value: string; // ISO Date String YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  slim?: boolean;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  placeholder = "Pilih Tanggal",
  slim = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse incoming value or default to current date
  const parsedValue = value ? new Date(value) : null;
  const [viewDate, setViewDate] = useState(parsedValue || new Date());

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    // Format to YYYY-MM-DD
    const yyyy = selectedDate.getFullYear();
    const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedDate.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const startDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  // Create grid arrays
  const blanks = Array.from({ length: startDayOfMonth }).map((_, i) => <div key={`blank-${i}`} className="cdp-day cdp-day-empty"></div>);
  const days = Array.from({ length: daysInMonth }).map((_, i) => {
    const day = i + 1;
    const isSelected = parsedValue && 
      parsedValue.getDate() === day && 
      parsedValue.getMonth() === viewDate.getMonth() && 
      parsedValue.getFullYear() === viewDate.getFullYear();
    
    const isToday = new Date().getDate() === day && 
      new Date().getMonth() === viewDate.getMonth() && 
      new Date().getFullYear() === viewDate.getFullYear();

    return (
      <button 
        key={`day-${day}`}
        type="button"
        className={`cdp-day ${isSelected ? 'cdp-day-selected' : ''} ${isToday ? 'cdp-day-today' : ''}`}
        onClick={() => handleSelectDay(day)}
      >
        {day}
      </button>
    );
  });

  const formattedDisplayValue = parsedValue ? 
    `${String(parsedValue.getDate()).padStart(2, '0')}/${String(parsedValue.getMonth() + 1).padStart(2, '0')}/${parsedValue.getFullYear()}` 
    : "";

  return (
    <div className={`cdp-container ${slim ? 'slim' : ''}`} ref={containerRef}>
      <button 
        type="button" 
        className={`cdp-trigger ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="cdp-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div className="cdp-value">
          {formattedDisplayValue ? <span>{formattedDisplayValue}</span> : <span className="cdp-placeholder">{placeholder}</span>}
        </div>
        <div className="cdp-chevron">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </button>

      {isOpen && (
        <div className="cdp-panel">
          <div className="cdp-header">
            <button type="button" className="cdp-nav" onClick={handlePrevMonth}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div className="cdp-month-year">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button type="button" className="cdp-nav" onClick={handleNextMonth}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
          </div>
          
          <div className="cdp-grid">
            {WEEKDAYS.map(wd => <div key={wd} className="cdp-weekday">{wd}</div>)}
            {blanks}
            {days}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
