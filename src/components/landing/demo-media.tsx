import camera from "@/assets/demo/produto-camera.jpg";
import fone from "@/assets/demo/produto-fone.jpg";
import projetor from "@/assets/demo/produto-projetor.jpg";
import suporte from "@/assets/demo/produto-suporte.jpg";
import estudioAntes from "@/assets/demo/estudio-antes.jpg";
import estudioDepois from "@/assets/demo/estudio-depois.jpg";

import { cn } from "@/lib/utils";

export const demoImages = { fone, suporte, projetor, camera, estudioAntes, estudioDepois };

/** Miniatura de produto demonstrativo usada nos mockups da landing. */
export function ProductThumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "block shrink-0 overflow-hidden rounded-lg border border-border/60 bg-background",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={512}
        height={512}
        className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
      />
    </span>
  );
}
