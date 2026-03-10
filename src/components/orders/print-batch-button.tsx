// FILE: src/components/orders/print-batch-button.tsx
"use client";

export default function PrintBatchButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-black text-white px-4 py-2 rounded-lg"
    >
      طباعة
    </button>
  );
}
