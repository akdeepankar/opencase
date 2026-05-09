import { NextRequest } from "next/server";
import { generateImage, generateVideo, generateSpeech } from "../../lib/runway";

export async function POST(request: NextRequest) {
  try {
    const { prompts, type = 'image' } = await request.json();

    if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return Response.json(
        { error: "An array of prompts is required" },
        { status: 400 }
      );
    }

    if (!process.env.RUNWAYML_API_SECRET) {
      return Response.json(
        { error: "RUNWAYML_API_SECRET is not configured." },
        { status: 500 }
      );
    }

    console.log(`[Evidence] Generating ${prompts.length} evidence items of type ${type}...`);

    const results = [];
    for (let i = 0; i < prompts.length; i++) {
      const item = prompts[i];
      try {
        let task;
        if (type === 'video') {
          task = await generateVideo({
            promptText: item.prompt,
            ratio: (item.ratio as '1280:720') || '1280:720',
          });
        } else if (type === 'speech') {
          task = await generateSpeech({
            promptText: item.prompt,
            presetId: (item.presetId as any) || 'Bernard',
          });
        } else {
          task = await generateImage({
            promptText: item.prompt,
            ratio: (item.ratio as any) || '1280:720',
          });
        }

        const outputUrl = task.output?.[0] || null;
        results.push({ status: 'fulfilled', value: { id: item.id, url: outputUrl } });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
      }
      
      // Add a 1 second stagger between tasks to avoid hitting concurrency limits
      if (i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const generatedItems = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        console.error(`[Evidence] Failed to generate ${type} for ${prompts[index].id}:`, result.reason);
        return { id: prompts[index].id, url: null, error: String(result.reason) };
      }
    });

    return Response.json({ items: generatedItems });
  } catch (error) {
    console.error("[Evidence] Generation error:", error);
    return Response.json(
      { error: "Internal server error during evidence generation" },
      { status: 500 }
    );
  }
}
