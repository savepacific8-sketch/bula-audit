import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);

  const handleTouchStart = useCallback((e) => {
    // Only activate when scrolled to top
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setPullY(Math.min(dy * 0.45, THRESHOLD + 20));
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      setPullY(THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPullY(0);
    startY.current = null;
  }, [pullY, onRefresh]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const showIndicator = pullY > 8 || refreshing;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'relative' }}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          className="flex items-center justify-center"
          style={{
            height: `${Math.max(pullY, refreshing ? THRESHOLD : 0)}px`,
            overflow: 'hidden',
            transition: refreshing ? 'none' : 'height 0.15s ease',
          }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full bg-card border border-border shadow-md"
            style={{ opacity: progress }}
          >
            <RefreshCw
              className="w-4 h-4 text-primary"
              style={{
                transform: `rotate(${progress * 360}deg)`,
                animation: refreshing ? 'spin 0.7s linear infinite' : 'none',
              }}
            />
          </div>
        </div>
      )}
      <div
        style={{
          transform: `translateY(${refreshing ? THRESHOLD : pullY > 0 ? pullY : 0}px)`,
          transition: pulling.current ? 'none' : 'transform 0.25s ease',
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}