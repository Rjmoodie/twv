/**
 * ConfirmDialog — reusable destructive-action confirmation.
 *
 * Replaces window.confirm() across the app. Renders an AlertDialog with:
 *   - A clear title and description explaining the consequence
 *   - A labelled destructive confirm button
 *   - A cancel button that closes without action
 *
 * Usage:
 *   <ConfirmDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Disconnect Chase?"
 *     description="Future syncs will stop. Your existing data won't be deleted."
 *     confirmLabel="Disconnect"
 *     onConfirm={handleDisconnect}
 *   />
 */

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  title:         string;
  description:   string;
  /** Extra detail shown below description — use for consequences */
  detail?:       string;
  confirmLabel?: string;
  cancelLabel?:  string;
  /** 'destructive' = red confirm button, 'default' = primary button */
  variant?:      'destructive' | 'default';
  onConfirm:     () => void | Promise<void>;
  loading?:      boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'destructive',
  onConfirm,
  loading,
}: ConfirmDialogProps) {
  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>{description}</p>
              {detail && (
                <p className="text-xs text-muted-foreground/80 leading-relaxed border-t border-border/40 pt-2">
                  {detail}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            )}
          >
            {loading ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
