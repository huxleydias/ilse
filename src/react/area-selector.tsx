import { useState, useCallback, useEffect } from 'react';

interface AreaRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface AreaSelectorProps {
  active: boolean;
  onCapture: (rect: AreaRect) => void;
  onCancel: () => void;
}

export function AreaSelector({ active, onCapture, onCancel }: AreaSelectorProps) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if ((e.target as Element).closest('[data-ilse-toolbar]')) return;
    e.preventDefault();
    setStart({ x: e.clientX, y: e.clientY });
    setCurrent({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!start) return;
    setCurrent({ x: e.clientX, y: e.clientY });
  }, [start]);

  const handleMouseUp = useCallback(() => {
    if (!start || !current) return;

    const rect: AreaRect = {
      top: Math.min(start.y, current.y),
      left: Math.min(start.x, current.x),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y),
    };

    setStart(null);
    setCurrent(null);

    // Minimum size to avoid accidental clicks
    if (rect.width > 10 && rect.height > 10) {
      onCapture(rect);
    }
  }, [start, current, onCapture]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setStart(null);
      setCurrent(null);
      onCancel();
    }
  }, [onCancel]);

  useEffect(() => {
    if (!active) return;

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [active, handleMouseDown, handleMouseMove, handleMouseUp, handleKeyDown]);

  if (!active || !start || !current) return null;

  const rect = {
    top: Math.min(start.y, current.y),
    left: Math.min(start.x, current.x),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: '2px dashed #6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        pointerEvents: 'none',
        zIndex: 99998,
        borderRadius: 2,
      }}
    />
  );
}
