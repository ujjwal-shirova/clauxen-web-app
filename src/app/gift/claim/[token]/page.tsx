import { GiftClaimPageClient } from "@/components/gift-claim-page";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function GiftClaimPage({ params }: PageProps) {
  const { token } = await params;
  return <GiftClaimPageClient token={token} />;
}
