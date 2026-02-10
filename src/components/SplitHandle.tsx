import { useRef, useCallback, useEffect } from "react";

interface SplitHandleProps {
  direction: "horizontal" | "vertical";
  onDrag: (delta: number) => void;
  onDragStart?: () => void;
}

export function SplitHandle({ direction, onDrag, onDragStart }: SplitHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef(0);
  const onDragRef = useRef(onDrag);
  const onDragStartRef = useRef(onDragStart);
  const rafPending = useRef(false);

  // Keep the refs up-to-date on every render
  onDragRef.current = onDrag;
  onDragStartRef.current = onDragStart;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startPos.current = direction === "horizontal" ? e.clientY : e.clientX;
      document.body.classList.add(direction === "horizontal" ? "split-dragging-h" : "split-dragging-v");
      onDragStartRef.current?.();
    },
    [direction]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();

      if (rafPending.current) return;
      rafPending.current = true;

      const currentPos = direction === "horizontal" ? e.clientY : e.clientX;

      requestAnimationFrame(() => {
        rafPending.current = false;
        if (!isDragging.current) return;
        const delta = currentPos - startPos.current;
        startPos.current = currentPos;
        onDragRef.current(delta);
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      rafPending.current = false;
      document.body.classList.remove("split-dragging-h", "split-dragging-v");
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction]);

  return (
    <div
      ref={handleRef}
      role="separator"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      className={`
        ${direction === "horizontal" ? "h-1 cursor-row-resize" : "w-1 cursor-col-resize"}
        hover:bg-accent/30 active:bg-accent/50 transition-colors
        flex-shrink-0
      `}
    />
  );
}
