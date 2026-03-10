// FILE: src/components/orders/print-button.tsx
"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
      type="button"
    >
      طباعة
    </button>
  );
}
