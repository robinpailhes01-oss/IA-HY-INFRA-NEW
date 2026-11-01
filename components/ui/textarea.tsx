import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-[18px] border border-[rgba(11,37,69,0.1)] bg-white/75 px-4 py-2.5 text-base shadow-[inset_0_1px_2px_rgba(11,37,69,0.04)] transition-[border-color,box-shadow,background-color] duration-200 outline-none placeholder:text-muted-foreground focus-visible:border-ocean/50 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-ocean/12 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
