import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const widthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

function Modal({ isOpen, onClose, title, children, width = "md" }: Readonly<ModalProps>) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" style={{ contain: "layout" }}>
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drag zone — allows moving the window even with modal open */}
      <div
        role="presentation"
        className="absolute top-0 left-0 right-0 h-10 z-[51] cursor-default"
        onMouseDown={(e) => {
          if (e.buttons === 1) {
            e.preventDefault();
            getCurrentWindow().startDragging();
          }
        }}
      />

      {/* Modal with floating title */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`
          relative w-full ${widthClasses[width]} mx-4
          bg-mantle border border-surface-0/60 rounded-2xl
          shadow-2xl shadow-black/50
          animate-scale-in
        `}
      >
        {/* Floating Title - above modal */}
        <h2 className="absolute -top-10 left-0 right-0 text-center text-lg font-semibold text-text">
          {title}
        </h2>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
