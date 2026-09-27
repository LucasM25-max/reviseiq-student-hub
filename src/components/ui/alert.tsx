import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("flex gap-3 rounded-lg border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-border bg-muted text-foreground",
      error: "border-destructive-border bg-destructive-surface text-foreground",
      success: "border-success-border bg-success-surface text-foreground",
      warning: "border-warning-border bg-warning-surface text-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

const icons = {
  info: Info,
  error: XCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
} as const;

const iconColour = {
  info: "text-muted-foreground",
  error: "text-destructive",
  success: "text-success",
  warning: "text-warning",
} as const;

export type AlertProps = React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & { title?: string };

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const key = variant ?? "info";
  const Icon = icons[key];

  return (
    <div
      role={key === "error" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconColour[key])} aria-hidden="true" />
      <div className="space-y-1">
        {title ? <p className="leading-tight font-medium">{title}</p> : null}
        {children ? <div className="text-muted-foreground">{children}</div> : null}
      </div>
    </div>
  );
}
