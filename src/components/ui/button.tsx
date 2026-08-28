import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Solid variants: swap to neutral muted when disabled so the color doesn't just wash out
        default:     "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-px shadow-[0_1px_2px_hsl(var(--primary)/0.3),0_6px_20px_hsl(var(--primary)/0.35)] hover:shadow-[0_2px_4px_hsl(var(--primary)/0.35),0_12px_28px_hsl(var(--primary)/0.45)] transition-all disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:translate-y-0",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
        // app-specific aliases
        primary:     "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-px shadow-[0_1px_2px_hsl(var(--primary)/0.3),0_6px_20px_hsl(var(--primary)/0.35)] hover:shadow-[0_2px_4px_hsl(var(--primary)/0.35),0_12px_28px_hsl(var(--primary)/0.45)] transition-all disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:translate-y-0",
        danger:      "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
        // Subtle variants: opacity reduction is fine here
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40",
        outline:     "border border-border bg-background hover:bg-accent/10 hover:text-foreground disabled:opacity-40",
        ghost:       "hover:bg-accent/10 hover:text-foreground disabled:opacity-40",
        link:        "text-primary underline-offset-4 hover:underline p-0 h-auto disabled:opacity-40",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm:      "h-8 rounded-lg px-3 text-xs",
        md:      "h-10 px-4",
        lg:      "h-11 rounded-xl px-6 text-base",
        icon:    "h-10 w-10",
      },
      loading: { true: "pointer-events-none opacity-70" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, asChild = false, children, ...props }, ref) => {
    const cls = cn(buttonVariants({ variant, size, loading }), className);
    const shared = { "aria-disabled": loading || props.disabled, ...props };

    if (asChild) {
      // Slot requires exactly one React element child — never inject the spinner here
      return (
        <Slot ref={ref} className={cls} {...shared}>
          {children}
        </Slot>
      );
    }

    return (
      <button ref={ref} className={cls} {...shared}>
        {loading && (
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
