import { notFound } from "next/navigation";
import { ingestDoneJobs } from "@/lib/jobs";
import { getChannel } from "@/lib/store";

/** Pull in any finished agent jobs before rendering a channel page. */
export default async function ChannelLayout(props: LayoutProps<"/channels/[slug]">) {
  const { slug } = await props.params;
  await ingestDoneJobs();
  if (!(await getChannel(slug))) notFound();
  return <div className="mx-auto max-w-6xl space-y-6">{props.children}</div>;
}
