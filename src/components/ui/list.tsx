import * as React from "react";
import { cn } from "@/lib/utils";

/** A simple, semantic list primitive (ul/li) used for the Outputs panel's Files/Charts/Tables lists. */
function List({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="list" className={cn("divide-y divide-[#f2f1ec]", className)} {...props} />;
}

interface ListItemProps extends React.ComponentProps<"button"> {
  icon?: React.ReactNode;
  label: React.ReactNode;
  meta?: React.ReactNode;
}

function ListItem({ className, icon, label, meta, ...props }: ListItemProps) {
  return (
    <li>
      <button
        data-slot="list-item"
        className={cn(
          "flex w-full items-center gap-2.5 px-[15px] py-2.5 border-0 bg-transparent text-left cursor-pointer hover:bg-[#faf9f6]",
          className
        )}
        {...props}
      >
        {icon && <span className="text-[#8a8680] text-sm shrink-0">{icon}</span>}
        <span className="flex-1 text-[12.8px] font-medium text-[#3a3733] truncate">{label}</span>
        {meta && <span className="text-[10.5px] text-[#a8a49d] shrink-0">{meta}</span>}
      </button>
    </li>
  );
}

export { List, ListItem };
