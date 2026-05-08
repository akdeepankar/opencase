import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch (e) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    topic,
    caseTitle,
    question,
    expectedAnswer,
    acceptableVariations,
    userAnswer,
  } = body;

  try {
    if (!userAnswer || !expectedAnswer) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Fallback: simple string matching
      const normalizedUser = userAnswer.toLowerCase().trim();
      const normalizedExpected = expectedAnswer.toLowerCase().trim();
      const variations = (acceptableVariations || []).map((v: string) =>
        v.toLowerCase().trim()
      );

      const isCorrect =
        normalizedExpected.includes(normalizedUser) ||
        normalizedUser.includes(normalizedExpected) ||
        variations.some(
          (v: string) =>
            normalizedUser.includes(v) || v.includes(normalizedUser)
        );

      return Response.json({
        correct: isCorrect,
        feedback: isCorrect
          ? "Correct! Well deduced, detective."
          : "Not quite right. Look more carefully at the evidence.",
      });
    }

    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 256,
      system: 'You evaluate student answers in an educational detective game. Respond with ONLY valid JSON: {"correct": true/false, "feedback": "string"}',
      messages: [
        {
          role: "user",
          content: `Topic: ${topic}
Case: ${caseTitle}
Question: ${question}
Expected Answer: ${expectedAnswer}
Acceptable Variations: ${(acceptableVariations || []).join(", ")}
Student's Answer: ${userAnswer}

Evaluate if the student's answer is conceptually correct. Be somewhat generous — if they demonstrate understanding of the core concept even with imperfect wording, mark it correct. Give brief 1-2 sentence feedback.`,
        },
      ],
    });

    // Extract text from the response content
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '';

    if (!text) {
      // Fallback to simple matching
      const normalizedUser = userAnswer.toLowerCase().trim();
      const normalizedExpected = expectedAnswer.toLowerCase().trim();
      const isCorrect =
        normalizedExpected.includes(normalizedUser) ||
        normalizedUser.includes(normalizedExpected);

      return Response.json({
        correct: isCorrect,
        feedback: isCorrect
          ? "Correct! Excellent deduction."
          : "Not quite. Review the evidence again.",
      });
    }

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    return Response.json({
      correct: !!parsed.correct,
      feedback: parsed.feedback || "Answer evaluated.",
    });
  } catch (error) {
    console.error("Evaluate error:", error);
    // Final fallback matching
    const normalizedUser = (userAnswer || "").toLowerCase().trim();
    const normalizedExpected = (expectedAnswer || "").toLowerCase().trim();
    const isCorrect = normalizedUser && normalizedExpected && (normalizedExpected.includes(normalizedUser) || normalizedUser.includes(normalizedExpected));
    
    return Response.json(
      { 
        correct: isCorrect || false, 
        feedback: isCorrect ? "Correct! Excellent deduction." : "Evaluation failed, but try reviewing the evidence again." 
      }
    );
  }
}
