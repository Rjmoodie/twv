/**
 * BottomSheet — dialog that slides up from the bottom on mobile,
 * centered on desktop. Drop-in replacement for Dialog.
 */
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const BottomSheet = DialogPrimitive.Root;
export const BottomSheetTrigger = DialogPrimitive.Trigger;
export const BottomSheetClose = DialogPrimitive.Close;

const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = "BottomSheetOverlay";

interface BottomSheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Max height on mobile (default: 90vh). Accepts any CSS value. */
  maxHeightMobile?: string;
}

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  BottomSheetContentProps
>(({ className, children, maxHeightMobile = "90dvh", ...props }, ref) => (
  <DialogPrimitive.Portal>
    <BottomSheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile: pinned to bottom, slides up
        "fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-2xl border-t border-x border-border/60 bg-card shadow-elev-3",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        "duration-300",
        // Desktop: center modal
        "sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%]",
        "sm:w-full sm:max-w-lg sm:rounded-2xl sm:border",
        "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
        "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]",
        "sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      style={{ maxHeight: maxHeightMobile } as React.CSSProperties}
      {...props}
    >
      {/* Drag handle — mobile only */}
      <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-border" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-6">
        {children}
      </div>

      {/* Close button */}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
BottomSheetContent.displayName = "BottomSheetContent";

const BottomSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 pb-4", className)} {...props} />
);
BottomSheetHeader.displayName = "BottomSheetHeader";

const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

const BottomSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-2 pt-4 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
);
BottomSheetFooter.displayName = "BottomSheetFooter";

export {
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetFooter,
};
