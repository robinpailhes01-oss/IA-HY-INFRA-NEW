import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Boutons : tous en PILULE. Trois matières seulement —
// · default  : le marine, l'action principale (une par zone) ;
// · outline  : le verre blanc, l'action secondaire ;
// · secondary: la glace, une action de contexte dans une carte.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-[13.5px] font-medium tracking-[-0.012em] whitespace-nowrap outline-none select-none transition-[background-color,box-shadow,transform,color,filter] duration-200 [transition-timing-function:var(--ease-ios)] focus-visible:ring-4 focus-visible:ring-ocean/20 active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,#183f6d_0%,#0b2545_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(11,37,69,0.2),0_8px_18px_-8px_rgba(11,37,69,0.55)] hover:brightness-[1.12] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(11,37,69,0.2),0_12px_24px_-10px_rgba(11,37,69,0.6)]",
        outline:
          "border-white/90 bg-white/70 text-foreground shadow-[inset_0_1px_0_#fff,0_1px_2px_rgba(11,37,69,0.06),0_6px_16px_-10px_rgba(11,37,69,0.25)] backdrop-blur-xl hover:bg-white aria-expanded:bg-white",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[#d6e6f8] aria-expanded:bg-[#d6e6f8]",
        ghost:
          "text-ink-2 hover:bg-white/70 hover:text-foreground aria-expanded:bg-white/70 aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive/20",
        link: "rounded-md text-ocean underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3.5 text-[13px] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-[14.5px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
