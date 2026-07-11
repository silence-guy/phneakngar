import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Product brand mark (light + dark SVGs under /public).
 * Use for marketing, shell, and any place that should show the ភ្នាក់ងារ icon.
 */
export function BrandMark({
  size = 32,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <Image
        src="/logo-mark.svg"
        alt="ភ្នាក់ងារ"
        width={size}
        height={size}
        priority={priority}
        className="dark:hidden"
      />
      <Image
        src="/logo-mark-dark.svg"
        alt="ភ្នាក់ងារ"
        width={size}
        height={size}
        priority={priority}
        className="hidden dark:block"
      />
    </span>
  );
}
