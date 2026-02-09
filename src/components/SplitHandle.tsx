import { useRef, useCallback, useEffect } from "react";

interface SplitHandleProps {
  direction: "horizontal" | "vertical";
  onDrag: (delta: number) => void;
}

export function SplitHandle({ direction, onDrag }: SplitHandleProps) {
  const handleRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startPos.current = direction === "horizontal" ? e.clientY : e.clientX;
      document.body.style.cursor = direction === "horizontal" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    },
    [direction]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = direction === "horizontal" ? e.clientY : e.clientX;
      const delta = currentPos - startPos.current;
      startPos.current = currentPos;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, onDrag]);

  return (
    <div
      ref={handleRef}
      onMouseDown={handleMouseDown}
      className={`
        ${direction === "horizontal" ? "h-1 cursor-row-resize" : "w-1 cursor-col-resize"}
        hover:bg-accent/30 active:bg-accent/50 transition-colors
        flex-shrink-0
      `}
    />
  );
}
