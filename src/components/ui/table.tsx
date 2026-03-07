import * as React from "react";

import { cn } from "@/lib/utils";

type TableProps = React.ComponentPropsWithoutRef<"table"> & {
  containerClassName?: string;
  containerProps?: React.ComponentPropsWithoutRef<"div">;
};

const Table = React.forwardRef<HTMLDivElement, TableProps>(
  ({ className, containerClassName, containerProps, ...props }, ref) => {
    const { className: containerPropsClassName, ...restContainerProps } =
      containerProps ?? {};

    return (
      <div
        ref={ref}
        data-slot="table-container"
        className={cn(
          "relative w-full overflow-x-auto",
          containerClassName,
          containerPropsClassName
        )}
        {...restContainerProps}
      >
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </div>
    );
  }
);

Table.displayName = "Table";

function TableHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

function TableBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

function TableRow({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  );
}

function TableHead({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};