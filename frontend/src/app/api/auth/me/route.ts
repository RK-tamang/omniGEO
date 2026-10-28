import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from '@/lib/api-client';
import { backendMe } from "@/lib/api-client";

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

  if (session.backendToken) {
    const result = await backendMe(session.backendToken);
    if (result.ok && (result.data?.user || result.data)) {
      const user = result.data.user || result.data;
      return NextResponse.json(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name ?? user.display_name ?? session.name,
            plan: user.plan ?? session.plan,
            workspaceId: user.workspaceId ?? session.workspaceId,
            source: "api",
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
        source: session.backendToken ? "api-session" : "local",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}