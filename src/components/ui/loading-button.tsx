// FILE: src/components/ui/loading-button.tsx
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & {
  loading?: boolean;
};

export function LoadingButton({
  loading,
  disabled,
  children,
  ...props
}: Props) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
