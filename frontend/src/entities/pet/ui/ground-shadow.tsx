import { cx } from "@/shared/lib/cx";

/** Stepped pixel shadow under a pet, tinted with --pet-color. */
export function GroundShadow({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "absolute left-1/2 h-1.75 w-17.5 -translate-x-1/2 bg-pet opacity-13",
        "[clip-path:polygon(10%_0,90%_0,90%_25%,100%_25%,100%_75%,90%_75%,90%_100%,10%_100%,10%_75%,0_75%,0_25%,10%_25%)]",
        className,
      )}
    />
  );
}
