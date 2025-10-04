import PersonMiniCard from "./personMiniCard";

export function HostMiniCard({ host }: { host?: any | null }) {
  const hostId = host?.id ?? null;
  return (
    <PersonMiniCard
      title="Host"
      name={host?.full_name}
      email={host?.email}
      phone={host?.phone}
      avatar_url={host?.avatar_url}
      to={hostId ? `/hosts/${hostId}` : null}
    />
  );
}
