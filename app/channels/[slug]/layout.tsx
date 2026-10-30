import { notFound } from "next/navigation";
import { syncJobs } from "@/lib/sync";
import { getChannel } from "@/lib/store";

/** Pull in any finished agent jobs before rendering a channel page. */
export default async function ChannelLayout(props: LayoutProps<"/channels/[slug]">) {
  const { slug } = await props.params;
  await syncJobs();
  if (!(await getChannel(slug))) notFound();
  return <div className="mx-auto max-w-6xl space-y-6">{props.children}</div>;
}
