import React, { useRef, useEffect } from 'react';
import './CanvasViewport.css';

const CanvasViewport: React.FC = () => {
  const elRef = useRef<HTMLDivElement>(null);

  // Placeholder pan/zoom – to be replaced with a full canvas implementation later.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      offsetX += dx;
      offsetY += dy;
      el.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1)`;
      startX = e.clientX;
      startY = e.clientY;
    };
    const onMouseUp = () => {
      isPanning = false;
    };
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div className="canvas-viewport" ref={elRef}>Canvas placeholder – pan/zoom demo</div>
  );
};

export default CanvasViewport;
