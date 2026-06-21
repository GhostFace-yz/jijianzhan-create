import * as React from "react";
import { cn } from "@/lib/utils";

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

interface FieldErrorProps extends React.ComponentProps<"div"> {
  errors?: string[];
}

function FieldError({ errors, className, ...props }: FieldErrorProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div
      data-slot="field-error"
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {errors.map((error, index) => (
        <p key={index}>{error}</p>
      ))}
    </div>
  );
}

export { Field, FieldError };
