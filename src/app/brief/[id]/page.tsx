import { FocusedBrief } from "@/components/focused-brief";

export const metadata = {
  title: "Brief",
};

/**
 * The focused brief route. `/brief/new` streams a freshly-requested brief (input
 * handed over via sessionStorage by the studio); `/brief/<generatedAt>` opens a
 * saved brief from local history.
 */
export default async function BriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FocusedBrief id={decodeURIComponent(id)} />;
}
