import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Refurb Genius" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <RequireAuth>
      <RequireAdmin>
        <div className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Admin</h1>
          <p className="mt-2 text-sm text-muted-foreground">Platform administration panel.</p>
        </div>
      </RequireAdmin>
    </RequireAuth>
  );
}
