import Link from "next/link";
import { Button, ButtonProps } from "./button";

export function LinkButton({ href, children, ...rest }: { href: string; children: React.ReactNode } & Omit<ButtonProps, 'asChild'>) {
  return (
    <Button asChild {...rest}>
      <Link href={href} prefetch={false}>{children}</Link>
    </Button>
  );
}

