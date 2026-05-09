import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an expert educational game designer. You create detective-style investigation cases that teach users about a given topic.

You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanation.

The JSON must follow this EXACT structure:
{
  "investigation_title": "string (a creative, cinematic title for this investigation — NOT just the topic name. Example: if topic is 'Quantum Physics', title could be 'The Quantum Enigma' or 'Shadows of the Subatomic')",
  "character": {
    "name": "string (a unique detective name fitting the topic)",
    "personality": "string",
    "tone": "string",
    "expertise": "string",
    "gender": "string ('male' or 'female')"
  },
  "cases": [
    {
      "case_id": 1,
      "title": "string",
      "scenario": "string",
      "character_dialogue": "string",
      "evidence": {
        "type": "image or video",
        "description": "string (detailed description containing a hidden 4-digit year that acts as the terminal_code)",
        "generation_prompt": "string",
        "hidden_clue": "string"
      },
      "terminal_code": "string (the 4-digit year found in the evidence description)",
      "question": "string",
      "expected_answer": "string",
      "acceptable_variations": ["string", "string", "string"],
      "hint": "string",
      "explanation": "string",
      "difficulty": "string (Beginner, Intermediate, or Expert)",
      "lab_items": [
        { "id": "short_id", "label": "Display Name", "icon": "emoji", "type": "text" }
      ],
      "lab_combinations": [
        { "items": ["id1", "id2"], "prompt": "image generation prompt for RunwayML showing forensic analysis result", "clue": "text clue revealed when these two items are combined" }
      ]
    }
  ]
}

RULES:
- Generate exactly 3 cases.
- Cases 1 and 3 must have evidence type "image", case 2 must have type "video".
- Difficulty must progress: Beginner, Intermediate, Expert.
- Each case MUST include a "terminal_code" (a 4-digit year, e.g., 1984).
- You MUST mention this year subtly within the "evidence.description" (e.g., "A weathered document from 1984 lies on the table").
- Each case must teach a DIFFERENT important concept of the topic.
- The character should have a consistent personality across all dialogues.
- Each case MUST have exactly 4 lab_items with unique short ids, relevant labels, appropriate emoji icons, and type "text". Note: A 'Visual Scan' tool (id: "visual") is automatically added to every case, so you do not need to list it in lab_items, but you SHOULD use it in lab_combinations.
- Each case MUST have exactly 6 lab_combinations. At least 2 of these combinations MUST involve the "visual" item (id: "visual") combined with one of your 4 custom items. Each combination needs a descriptive image generation prompt (for AI image generation showing forensic analysis) and a clue string that gives the player a hint about solving the case.
- Each case MUST include a "lab_hint" string (a brief suggestion for the player on what items to try connecting in the forensic lab, e.g., "Try connecting the DNA sample to the Visual Scan tool").
- Each case MUST include a "terminal_video_prompt" (a descriptive prompt for generating a short CCTV-style security footage clip, grainy, high-angle, or surveillance-oriented related to the case) and a "terminal_audio_text" (a short 1-2 sentence report or confession to be converted to speech).
- The "expected_answer" MUST be exactly one word.
- The "question" should be designed so it can be answered with that single word.`;

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== "string") {
      return Response.json(
        { error: "A topic is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY is not configured. Add it to your .env.local file." },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate 3 detective cases for the topic: "${topic}"`,
        },
      ],
    });

    // Extract text from the response content
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';

    if (!text) {
      return Response.json(
        { error: "No content generated from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON from the response
    let parsed;
    try {
      const cleaned = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", text.substring(0, 500));
      return Response.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    return Response.json(parsed);
  } catch (error) {
    console.error("Generate cases error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
