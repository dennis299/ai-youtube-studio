import { listChannels } from "@/lib/store";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks } from "@/components/nav-links";

/** Sticky sidebar on md+, top bar with a drawer below that. */
export async function Sidebar() {
  const channels = (await listChannels()).map((c) => ({ slug: c.slug, name: c.name }));
  return (
    <>
      <MobileNav channels={channels} />
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-7 overflow-y-auto border-r bg-sidebar/80 px-4 py-6 md:flex">
        <Brand />
        <NavLinks channels={channels} />
        <p className="mt-auto px-2.5 text-xs leading-relaxed text-muted-foreground/70">
          Runs locally. Your keys stay in <code className="text-[11px]">data/</code>.
        </p>
      </aside>
    </>
  );
}
