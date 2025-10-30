import { useState, useEffect } from 'react';
import type { ClipFilters } from '../../types/filters';
import './FilterPanel.css';

interface FilterPanelProps {
  filters: ClipFilters | undefined;
  onUpdate: (filters: ClipFilters | undefined) => void;
  onClose: () => void;
}

export function FilterPanel({ filters, onUpdate, onClose }: FilterPanelProps) {
  const [brightness, setBrightness] = useState(filters?.brightness || 0);
  const [contrast, setContrast] = useState(filters?.contrast || 0);
  const [saturation, setSaturation] = useState(filters?.saturation || 0);

  // Sync filters when props change
  useEffect(() => {
    setBrightness(filters?.brightness || 0);
    setContrast(filters?.contrast || 0);
    setSaturation(filters?.saturation || 0);
  }, [filters]);

  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
    const newFilters: ClipFilters = {
      ...(filters || {}),
      brightness: value === 0 ? undefined : value,
    };
    // Remove brightness if it's 0 to keep filters clean
    if (value === 0 && !newFilters.contrast && !newFilters.saturation) {
      onUpdate(undefined);
    } else {
      onUpdate(newFilters);
    }
  };

  const handleContrastChange = (value: number) => {
    setContrast(value);
    const newFilters: ClipFilters = {
      ...(filters || {}),
      contrast: value === 0 ? undefined : value,
    };
    if (value === 0 && !newFilters.brightness && !newFilters.saturation) {
      onUpdate(undefined);
    } else {
      onUpdate(newFilters);
    }
  };

  const handleSaturationChange = (value: number) => {
    setSaturation(value);
    const newFilters: ClipFilters = {
      ...(filters || {}),
      saturation: value === 0 ? undefined : value,
    };
    if (value === 0 && !newFilters.brightness && !newFilters.contrast) {
      onUpdate(undefined);
    } else {
      onUpdate(newFilters);
    }
  };

  const handleReset = () => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    onUpdate(undefined);
  };

  const hasActiveFilters = brightness !== 0 || contrast !== 0 || saturation !== 0;

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h3>Video Filters</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="filter-controls">
        <div className="filter-group">
          <label>
            Brightness
            <span className="filter-value">{brightness}</span>
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={brightness}
            onChange={(e) => handleBrightnessChange(Number(e.target.value))}
            className="filter-slider"
          />
          <div className="filter-range-labels">
            <span>-100</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>

        <div className="filter-group">
          <label>
            Contrast
            <span className="filter-value">{contrast}</span>
          </label>
          <input type="range"
            min="-100"
            max="100"
            value={contrast}
            onChange={(e) => handleContrastChange(Number(e.target.value))}
            className="filter-slider"
          />
          <div className="filter-range-labels">
            <span>-100</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>

        <div className="filter-group">
          <label>
            Saturation
            <span className="filter-value">{saturation}</span>
          </label>
          <input
            type="range"
            min="-100"
            max="100"
            value={saturation}
            onChange={(e) => handleSaturationChange(Number(e.target.value))}
            className="filter-slider"
          />
          <div className="filter-range-labels">
            <span>-100</span>
            <span>0</span>
            <span>+100</span>
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <button className="reset-button" onClick={handleReset}>
          Reset Filters
        </button>
      )}
    </div>
  );
}

