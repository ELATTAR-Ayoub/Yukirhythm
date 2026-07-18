"use client";

import { CaretSortIcon } from "@radix-ui/react-icons";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrackSort } from "./library-utils";

const LABELS: Record<TrackSort, string> = {
  recent: "Recently added",
  alpha: "Alphabetical",
};

interface SortControlProps {
  sort: TrackSort;
  onChange: (sort: TrackSort) => void;
}

/** Track-list sort picker. */
export default function SortControl({ sort, onChange }: SortControlProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Sort tracks">
          <CaretSortIcon className="mr-1.5 h-3.5 w-3.5" />
          {LABELS[sort]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(LABELS) as TrackSort[]).map((key) => (
          <DropdownMenuItem key={key} onClick={() => onChange(key)}>
            {LABELS[key]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
