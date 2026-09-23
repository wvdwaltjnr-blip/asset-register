import AssetDetailClient from "./AssetDetailClient";

export default async function AssetDetailPage(props: PageProps<"/assets/[id]">) {
  const { id } = await props.params;
  return <AssetDetailClient id={id} />;
}
