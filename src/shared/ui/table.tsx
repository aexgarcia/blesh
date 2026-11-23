import { cn } from "./cn";

/** Tabla con scroll horizontal en móvil. */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-[13px]", className)} {...props} />
    </div>
  );
}

export function THead(props: React.ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TBody(props: React.ComponentProps<"tbody">) {
  return <tbody className="[&>tr:last-child]:border-0" {...props} />;
}

export function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("border-b border-line", className)} {...props} />;
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn("whitespace-nowrap px-6 py-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted", className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-6 py-4 align-middle", className)} {...props} />;
}
