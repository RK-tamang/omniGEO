import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth-session";
import { backendEnabled, backendMe } from "@/server/backend-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json(
      { user: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Prefer live backend identity (authoritative plan/workspace) when available.
  if (session.backendToken && backendEnabled()) {
    const result = await backendMe(session.backendToken);
    if (result.ok && result.data.user) {
      const user = result.data.user;
      return NextResponse.json(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            plan: user.plan,
            workspaceId: user.workspaceId,
            workspaceName: user.workspaceName,
            source: "backend",
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    {
      user: {
        email: session.email,
        name: session.name,
        plan: session.plan,
        workspaceId: session.workspaceId,
        source: session.backendToken ? "backend-session" : "local",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
