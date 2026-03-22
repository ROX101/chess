import ReviewGame from "./ReviewGame";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ReviewGame id={id} />;
}
