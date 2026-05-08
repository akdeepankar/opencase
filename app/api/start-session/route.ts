import { NextRequest } from "next/server";
import { createRealtimeSession } from "../../lib/runway";

export async function POST(request: NextRequest) {
  try {
    const { avatarId, isPreset } = await request.json();

    if (!avatarId) {
      return Response.json({ error: "Avatar ID is required" }, { status: 400 });
    }

    if (!process.env.RUNWAYML_API_SECRET) {
      return Response.json({ error: "RUNWAYML_API_SECRET not configured" }, { status: 500 });
    }

    const session = await createRealtimeSession(avatarId, isPreset);

    return Response.json({ 
      sessionId: session.id, 
      sessionKey: session.sessionKey 
    });
  } catch (error: any) {
    console.error("Session creation API error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
