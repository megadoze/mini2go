import PersonMiniCard from "./personMiniCard";

export function GuestMiniCardForAdmin({ guest }: { guest?: any | null }) {
  const guestId = guest?.id ?? null;
  return (
    <PersonMiniCard
      title="Guest"
      name={guest?.full_name}
      email={guest?.email}
      phone={guest?.phone}
      avatar_url={guest?.avatar_url}
      to={guestId ? `/admin/users/${guestId}` : null}
    />
  );
}
