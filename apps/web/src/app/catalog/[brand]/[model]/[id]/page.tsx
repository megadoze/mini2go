export default async function VehiclePage({
  params,
}: {
  params: Promise<{ brand: string; model: string; id: string }>;
}) {
  const { brand, model, id } = await params;

  return (
    <div style={{ padding: 20 }}>
      <h1>Карточка</h1>
      <p>brand: {brand}</p>
      <p>model: {model}</p>
      <p>id: {id}</p>
    </div>
  );
}
