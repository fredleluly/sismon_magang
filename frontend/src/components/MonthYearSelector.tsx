import React, { useState, useRef, useEffect } from 'react';
import './MonthYearSelector.css';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const YEARS = [2024, 2025, 2026, 2027];

interface MonthYearSelectorProps {
  bulan: number;
  tahun: number;
  onBulanChange: (bulan: number) => void;
  onTahunChange: (tahun: number) => void;
}

const MonthYearSelector: React.FC<MonthYearSelectorProps> = ({
  bulan, tahun, onBulanChange, onTahunChange
}) => {
  const [openDropdown, setOpenDropdown] = useState<'bulan' | 'tahun' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrev = () => {
    if (bulan === 1) {
      onBulanChange(12);
      onTahunChange(tahun - 1);
    } else {
      onBulanChange(bulan - 1);
    }
    setOpenDropdown(null);
  };

  const handleNext = () => {
    if (bulan === 12) {
      onBulanChange(1);
      onTahunChange(tahun + 1);
    } else {
      onBulanChange(bulan + 1);
    }
    setOpenDropdown(null);
  };

  const selectBulan = (b: number) => {
    onBulanChange(b);
    setOpenDropdown(null);
  };

  const selectTahun = (y: number) => {
    onTahunChange(y);
    setOpenDropdown(null);
  };

  return (
    <div className="mys-container" ref={containerRef}>
      <button className="mys-nav" onClick={handlePrev} aria-label="Bulan sebelumnya">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>

      <div className="mys-center">
        <svg className="mys-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>

        {/* Bulan Dropdown */}
        <div className="mys-dropdown-wrap">
          <button
            className={`mys-trigger ${openDropdown === 'bulan' ? 'active' : ''}`}
            onClick={() => setOpenDropdown(openDropdown === 'bulan' ? null : 'bulan')}
          >
            <span>{MONTHS[bulan - 1]}</span>
            <svg className="mys-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          {openDropdown === 'bulan' && (
            <div className="mys-panel">
              <div className="mys-panel-list">
                {MONTHS.map((m, i) => (
                  <button
                    key={i}
                    className={`mys-option ${bulan === i + 1 ? 'selected' : ''}`}
                    onClick={() => selectBulan(i + 1)}
                  >
                    {bulan === i + 1 && (
                      <svg className="mys-check" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    )}
                    <span>{m}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tahun Dropdown */}
        <div className="mys-dropdown-wrap">
          <button
            className={`mys-trigger ${openDropdown === 'tahun' ? 'active' : ''}`}
            onClick={() => setOpenDropdown(openDropdown === 'tahun' ? null : 'tahun')}
          >
            <span>{tahun}</span>
            <svg className="mys-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
          {openDropdown === 'tahun' && (
            <div className="mys-panel mys-panel-narrow">
              <div className="mys-panel-list">
                {YEARS.map(y => (
                  <button
                    key={y}
                    className={`mys-option ${tahun === y ? 'selected' : ''}`}
                    onClick={() => selectTahun(y)}
                  >
                    {tahun === y && (
                      <svg className="mys-check" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    )}
                    <span>{y}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <button className="mys-nav" onClick={handleNext} aria-label="Bulan berikutnya">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  );
};

export default MonthYearSelector;
