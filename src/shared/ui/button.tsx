import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "./cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-extrabold uppercase tracking-[0.05em] transition-[background-color,color,transform,opacity] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-black",
        secondary: "border border-line bg-surface text-ink hover:border-ink",
        ghost: "text-ink hover:bg-black/5",
        white: "bg-white text-ink hover:bg-ink hover:text-white",
        danger: "bg-sale text-white hover:bg-[#a50d26]",
      },
      size: {
        sm: "h-8 px-4 text-[10px]",
        md: "h-10 px-5 text-[11px]",
        lg: "h-[46px] px-7 text-[11px]",
        icon: "size-9 text-[11px]",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza el hijo (p. ej. `<Link>`) con los estilos del botón. */
    asChild?: boolean;
  };

export function Button({ className, variant, size, block, asChild, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size, block }), className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}
