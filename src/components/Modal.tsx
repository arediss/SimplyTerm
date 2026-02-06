import { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

function Modal({ isOpen, onClose, title, children, width = "md" }: ModalProps) {
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

  const widthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
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
