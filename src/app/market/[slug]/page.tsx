import { MarketDetail } from "@/components/MarketDetail";

export const dynamic = "force-dynamic";

// Deep-linkable full-page detail (the dashboard uses a drawer with the same
// component).
export default async function MarketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="max-w-2xl">
      <MarketDetail slug={slug} />
    </div>
  );
}
