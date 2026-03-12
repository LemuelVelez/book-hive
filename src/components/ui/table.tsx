import * as React from "react";

import { cn } from "@/lib/utils";

type TableProps = React.ComponentPropsWithoutRef<"table"> & {
  containerClassName?: string;
  containerProps?: React.ComponentPropsWithoutRef<"div">;
};

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      [
        "a",
        "button",
        "input",
        "textarea",
        "select",
        "option",
        "label",
        '[contenteditable="true"]',
        '[role="button"]',
        '[role="link"]',
        "[data-no-drag-scroll='true']",
      ].join(",")
    )
  );
}

const Table = React.forwardRef<HTMLDivElement, TableProps>(
  ({ className, containerClassName, containerProps, ...props }, ref) => {
    const {
      className: containerPropsClassName,
      style: containerPropsStyle,
      onPointerDown: containerOnPointerDown,
      onPointerMove: containerOnPointerMove,
      onPointerUp: containerOnPointerUp,
      onPointerCancel: containerOnPointerCancel,
      onClickCapture: containerOnClickCapture,
      onDragStart: containerOnDragStart,
      ...restContainerProps
    } = containerProps ?? {};

    const containerRef = React.useRef<HTMLDivElement | null>(null);

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const [isDragging, setIsDragging] = React.useState(false);
    const [isScrollable, setIsScrollable] = React.useState(false);

    const dragStateRef = React.useRef<{
      pointerId: number | null;
      startX: number;
      startScrollLeft: number;
      dragging: boolean;
    }>({
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
      dragging: false,
    });

    const suppressClickRef = React.useRef(false);
    const clickResetTimerRef = React.useRef<number | null>(null);

    const updateScrollableState = React.useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      setIsScrollable(el.scrollWidth > el.clientWidth + 1);
    }, []);

    React.useEffect(() => {
      updateScrollableState();
    }, [props.children, updateScrollableState]);

    React.useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      updateScrollableState();

      const onResize = () => updateScrollableState();
      window.addEventListener("resize", onResize);

      let resizeObserver: ResizeObserver | null = null;

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => updateScrollableState());
        resizeObserver.observe(el);
      }

      return () => {
        window.removeEventListener("resize", onResize);
        resizeObserver?.disconnect();
      };
    }, [updateScrollableState]);

    React.useEffect(() => {
      return () => {
        if (clickResetTimerRef.current != null) {
          window.clearTimeout(clickResetTimerRef.current);
        }
      };
    }, []);

    const resetDrag = React.useCallback((pointerId?: number) => {
      const el = containerRef.current;
      const current = dragStateRef.current;

      if (pointerId != null && current.pointerId !== pointerId) return;

      if (el && current.pointerId != null) {
        try {
          el.releasePointerCapture(current.pointerId);
        } catch {
          // no-op
        }
      }

      if (current.dragging) {
        suppressClickRef.current = true;

        if (clickResetTimerRef.current != null) {
          window.clearTimeout(clickResetTimerRef.current);
        }

        clickResetTimerRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
          clickResetTimerRef.current = null;
        }, 0);
      }

      dragStateRef.current = {
        pointerId: null,
        startX: 0,
        startScrollLeft: 0,
        dragging: false,
      };

      setIsDragging(false);
    }, []);

    const handlePointerDown = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        containerOnPointerDown?.(event);
        if (event.defaultPrevented) return;

        const el = containerRef.current;
        if (!el) return;

        if (event.button !== 0) return;
        if (event.pointerType === "touch") return;
        if (isInteractiveTarget(event.target)) return;
        if (el.scrollWidth <= el.clientWidth + 1) return;

        dragStateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startScrollLeft: el.scrollLeft,
          dragging: false,
        };

        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          // no-op
        }
      },
      [containerOnPointerDown]
    );

    const handlePointerMove = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        containerOnPointerMove?.(event);

        const el = containerRef.current;
        const current = dragStateRef.current;

        if (!el) return;
        if (current.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - current.startX;

        if (!current.dragging && Math.abs(deltaX) > 4) {
          current.dragging = true;
          setIsDragging(true);
        }

        if (!current.dragging) return;

        event.preventDefault();
        el.scrollLeft = current.startScrollLeft - deltaX;
      },
      [containerOnPointerMove]
    );

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        containerOnPointerUp?.(event);
        resetDrag(event.pointerId);
      },
      [containerOnPointerUp, resetDrag]
    );

    const handlePointerCancel = React.useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        containerOnPointerCancel?.(event);
        resetDrag(event.pointerId);
      },
      [containerOnPointerCancel, resetDrag]
    );

    const handleClickCapture = React.useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          suppressClickRef.current = false;
        }

        containerOnClickCapture?.(event);
      },
      [containerOnClickCapture]
    );

    const handleDragStart = React.useCallback(
      (event: React.DragEvent<HTMLDivElement>) => {
        if (isDragging) {
          event.preventDefault();
          return;
        }

        containerOnDragStart?.(event);
      },
      [containerOnDragStart, isDragging]
    );

    return (
      <div
        ref={containerRef}
        data-slot="table-container"
        className={cn(
          "relative w-full overflow-x-auto touch-pan-x",
          isScrollable && !isDragging && "cursor-grab",
          isScrollable && isDragging && "cursor-grabbing select-none",
          containerClassName,
          containerPropsClassName
        )}
        style={{
          WebkitOverflowScrolling: "touch",
          userSelect: isDragging ? "none" : containerPropsStyle?.userSelect,
          ...containerPropsStyle,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={handleClickCapture}
        onDragStart={handleDragStart}
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