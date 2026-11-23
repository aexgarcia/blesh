"use client";

import { DropdownMenu as Primitive } from "radix-ui";

import { cn } from "./cn";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;

export function DropdownMenuContent({ className, align = "end", ...props }: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align={align}
        sideOffset={6}
        className={cn("z-50 min-w-52 rounded-[14px] border border-line bg-surface p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]", className)}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuItem({ className, tone, ...props }: React.ComponentProps<typeof Primitive.Item> & { tone?: "danger" }) {
  return (
    <Primitive.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-card data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:text-muted",
        tone === "danger" && "text-sale [&_svg]:text-sale",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator() {
  return <Primitive.Separator className="my-1 h-px bg-line" />;
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label className={cn("px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted", className)} {...props} />;
}
