import Image from "next/image";
import { clsx } from "@/lib/cn";

/**
 * The ARGUS NOVA mark. The artwork lives in one place —
 * /public/argus-nova-transparent.svg — and is loaded from there, so the
 * transparent ring sits cleanly on the dark UI.
 */
export function ArgusMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/argus-nova-transparent.svg"
      alt=""
      width={size}
      height={size}
      className={clsx("block", className)}
      unoptimized
    />
  );
}
