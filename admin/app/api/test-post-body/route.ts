import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const text = await req.text();
  const body = text ? JSON.parse(text) : {};
  return NextResponse.json({ ok: true, body });
}
