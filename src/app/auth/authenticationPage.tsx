import { AuthenticationForm } from "@/components/authenticationForm";

export default function AuthenticationPage() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: 16,
      }}
    >
      <div style={{ width: 400, maxWidth: "100%" }}>
        <AuthenticationForm />
      </div>
    </div>
  );
}
