// FILE: src/components/ui/switch.tsx
"use client";

import * as React from "react";
import * as SwitchPr from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPr.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPr.Root>
>(({ className, ...props }, ref) => (
  <SwitchPr.Root
    ref={ref}
    dir="ltr" // ✅ FIX: Radix switch flips in RTL, keep switch itself LTR
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
  >
    <SwitchPr.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPr.Root>
));
Switch.displayName = SwitchPr.Root.displayName;

export { Switch };
