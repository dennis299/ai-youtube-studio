import Image from "next/image";
import Link from "next/link";

/** App logo + name. The mark is the same SVG as the favicon. */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-1 font-semibold tracking-tight">
      <Image src="/brand-mark.svg" alt="" width={28} height={28} className="rounded-md" priority />
      <span>AI YouTube Studio</span>
    </Link>
  );
}
