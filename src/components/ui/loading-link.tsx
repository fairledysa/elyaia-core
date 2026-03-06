// FILE: src/components/ui/loading-link.tsx
"use client";

import Link, { type LinkProps } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

type Props = LinkProps & {
  className?: string;
  children: React.ReactNode;
  onLoadingChange?: (v: boolean) => void;
};

export default function LoadingLink({
  className,
  children,
  onLoadingChange,
  ...props
}: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // أي تغير في المسار/الباراميتر = خلص التحميل
    setLoading(false);
    onLoadingChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, sp?.toString()]);

  return (
    <Link
      {...props}
      className={className}
      onClick={(e) => {
        props.onClick?.(e as any);
        if (e.defaultPrevented) return;
        setLoading(true);
        onLoadingChange?.(true);
      }}
    >
      {children}
    </Link>
  );
}
