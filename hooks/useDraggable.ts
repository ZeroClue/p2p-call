import { useRef, useCallback, useEffect } from 'react';

export const useDraggable = (ref: React.RefObject<HTMLDivElement | null>) => {
  const posRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!ref.current) return;
      event.preventDefault();

      const newX = event.clientX - offsetRef.current.x;
      const newY = event.clientY - offsetRef.current.y;

      posRef.current = { x: newX, y: newY };
      ref.current.style.transform = `translate(${newX}px, ${newY}px)`;
    },
    [ref],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      event.preventDefault();
      if (!ref.current) return;

      try {
        ref.current.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer may not be captured
      }
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      isDraggingRef.current = false;

      if (ref.current) ref.current.style.cursor = 'move';
      document.body.style.userSelect = 'auto';
    },
    [ref, handlePointerMove],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('button')) {
        return;
      }
      event.preventDefault();
      if (!ref.current) return;

      offsetRef.current = {
        x: event.clientX - posRef.current.x,
        y: event.clientY - posRef.current.y,
      };

      ref.current.setPointerCapture(event.pointerId);
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      isDraggingRef.current = true;

      ref.current.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [ref, handlePointerMove, handlePointerUp],
  );

  useEffect(() => {
    const handleResize = () => {
      if (ref.current) {
        ref.current.style.transform = 'translate(0px, 0px)';
        posRef.current = { x: 0, y: 0 };
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ref]);

  useEffect(() => {
    return () => {
      if (isDraggingRef.current) {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.body.style.userSelect = 'auto';
      }
    };
  }, [handlePointerMove, handlePointerUp]);

  return { onPointerDown };
};
