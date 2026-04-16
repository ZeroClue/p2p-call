import { useRef, useState, useCallback } from 'react';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

// Helper to calculate the distance between two touch points
const getDistance = (touches: React.TouchList): number => {
  const [touch1, touch2] = [touches[0], touches[1]];
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
};

/**
 * A pure state management hook for implementing pinch-to-zoom functionality.
 * It does not directly manipulate the DOM. Instead, it returns the zoom state
 * and event handlers, allowing the component to apply the styles.
 */
export const usePinchToZoom = () => {
  const [zoom, setZoom] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const initialDistanceRef = useRef<number | null>(null);
  const lastZoomRef = useRef(1);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      setIsPinching(true);
      initialDistanceRef.current = getDistance(event.touches);
      lastZoomRef.current = zoom;
    }
  }, [zoom]);

  const onTouchMove = useCallback((event: React.TouchEvent) => {
    if (event.touches.length === 2 && initialDistanceRef.current) {
      event.preventDefault();
      
      const newDistance = getDistance(event.touches);
      const scale = newDistance / initialDistanceRef.current;
      
      let newZoom = lastZoomRef.current * scale;
      
      // Clamp the zoom level to prevent extreme values
      newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));
      
      setZoom(newZoom);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    setIsPinching(false);
    initialDistanceRef.current = null;
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setIsPinching(false);
  }, []);

  return { zoom, setZoom, onTouchStart, onTouchMove, onTouchEnd, resetZoom, isPinching };
};