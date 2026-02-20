import { createPortal } from "react-dom";

export default function ImageLightbox({ src, alt, isOpen, onClose }) {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl"
        />
      </div>
    </div>,
    document.body
  );
}
