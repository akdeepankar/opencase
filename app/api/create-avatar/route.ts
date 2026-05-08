import { NextRequest } from "next/server";
import { createAvatar, generateImage, createDocument } from "../../lib/runway";

export async function POST(request: NextRequest) {
  try {
    const { name, personality, gender, topic, caseTitle, scenario, hint } = await request.json();

    if (!process.env.RUNWAYML_API_SECRET) {
      return Response.json({ error: "RUNWAYML_API_SECRET not configured" }, { status: 500 });
    }

    // 1. Create a knowledge document with case details
    console.log(`[Avatar] Creating knowledge document for case: ${caseTitle}`);
    const knowledgeDoc = await createDocument(
      `Case_${caseTitle.replace(/\s+/g, '_')}`,
      `Topic: ${topic}\nInvestigation: ${caseTitle}\nScenario: ${scenario}\nHints for Investigator: ${hint}`
    );

    // Determine voice based on gender
    const voiceId = gender === 'female' ? 'victoria' : 'vincent';

    // 2. Generate a case-specific detective portrait first (Animated Style)
    console.log(`[Avatar] Generating animated portrait for ${name} on topic ${topic}`);
    
    // Create a context-aware style based on the topic
    const expertStyle = (topic.toLowerCase().includes('photo') || topic.toLowerCase().includes('science') || topic.toLowerCase().includes('bio')) 
      ? "styled as a professional scientist or doctor in a high-tech lab coat" 
      : "styled as a classic sharp-dressed forensic investigator";

    const imageTask = await generateImage({
      promptText: `Animated style, 3D character design, professional cinematic headshot of a detective named ${name}. Straight face view, looking at camera. Personality: ${personality}. Topic: ${topic}. The character should be ${expertStyle}. Dark forensic aesthetic, clean lines, vibrant high-quality animation character art, digital painting`,
      ratio: '1080:1080'
    });
    
    const portraitUrl = imageTask.output?.[0] || "https://picsum.photos/seed/detective/800/800";

    // 3. Create the avatar using the generated portrait and knowledge doc
    // Note: We include a strict personality that guides the user without spoiling the answer.
    const avatar = await createAvatar({
      name,
      referenceImage: portraitUrl,
      personality: `${personality}. You are an investigative partner. CRITICAL RULE: DO NOT REVEAL THE SOLUTION OR ANSWER TO THE CASE. Instead, guide the investigator by suggesting they check specific tabs: the Forensic Lab (for combining clues), the Evidence Terminal (for CCTV and Audio intercepts), or the Case Dossier. Give subtle hints based on the scenario: ${scenario}`,
      startScript: `Detective ${name} online. I've initialized my neural link to the ${topic} case data. How can I assist with the ${caseTitle} investigation?`,
      voiceId: voiceId,
      documentIds: [knowledgeDoc.id],
      embed: true // Enable embedding as requested
    });

    return Response.json({ 
      avatar: {
        ...avatar,
        previewUrl: portraitUrl
      }
    });
  } catch (error: any) {
    console.error("Avatar creation API error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
