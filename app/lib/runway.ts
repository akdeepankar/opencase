import RunwayML from '@runwayml/sdk';

/**
 * Centralized RunwayML client instance.
 * The SDK automatically looks for the RUNWAYML_API_SECRET environment variable.
 */
const client = new RunwayML({
  apiKey: process.env.RUNWAYML_API_SECRET,
});

export interface VideoGenerationOptions {
  promptText: string;
  ratio?: '1280:720' | '720:1280';
  duration?: number;
  seed?: number;
}

export interface ImageGenerationOptions {
  promptText: string;
  ratio?: '1024:1024' | '1080:1080' | '1168:880' | '1360:768' | '1440:1080' | '1080:1440' | '1808:768' | '1920:1080' | '1080:1920' | '2112:912' | '1280:720' | '720:1280' | '720:720' | '960:720' | '720:960' | '1680:720';
  seed?: number;
}

export interface SpeechGenerationOptions {
  promptText: string;
  presetId?: "Maya" | "Arjun" | "Serene" | "Bernard" | "Billy" | "Mark" | "Clint" | "Mabel" | "Chad" | "Leslie" | "Eleanor" | "Elias" | "Elliot" | "Grungle" | "Brodie" | "Sandra" | "Kirk" | "Kylie" | "Lara" | "Lisa" | "Malachi" | "Marlene" | "Martin" | "Miriam" | "Monster" | "Paula" | "Pip" | "Rusty" | "Ragnar" | "Xylar" | "Maggie" | "Jack" | "Katie" | "Noah" | "James" | "Rina" | "Ella" | "Mariah" | "Frank" | "Claudia" | "Niki" | "Vincent" | "Kendrick" | "Myrna" | "Tom" | "Wanda" | "Benjamin" | "Kiana" | "Rachel";
}

export interface AvatarCreationOptions {
  name: string;
  referenceImage: string;
  personality: string;
  voiceId?: "victoria" | "vincent" | "clara" | "drew" | "skye" | "max" | "morgan" | "felix" | "mia" | "marcus" | "summer" | "ruby" | "aurora" | "jasper" | "leo" | "adrian" | "nina" | "emma" | "blake" | "david" | "maya" | "nathan" | "sam" | "georgia" | "petra" | "adam" | "zach" | "violet" | "roman" | "luna";
  startScript?: string;
  documentIds?: string[];
  embed?: boolean;
}

/**
 * Centralized function to generate video using Runway's gen4.5 model.
 */
export async function generateVideo({
  promptText,
  ratio = '1280:720',
  duration = 5,
  seed,
}: VideoGenerationOptions) {
  try {
    console.log(`[Runway] Initializing Gen4.5 video generation for: "${promptText.substring(0, 50)}..."`);
    
    const task = await client.textToVideo.create({
      model: 'gen4.5',
      promptText,
      ratio,
      duration,
      seed,
    });

    let currentTask = await client.tasks.retrieve(task.id);
    while (currentTask.status !== 'SUCCEEDED' && currentTask.status !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      currentTask = await client.tasks.retrieve(task.id);
    }

    if (currentTask.status === 'FAILED') {
      throw new Error(`Runway video task failed: ${currentTask.failure || 'Unknown error'}`);
    }

    return currentTask;
  } catch (error) {
    console.error('[Runway] Video Generation Error:', error);
    throw error;
  }
}

/**
 * Centralized function to generate image using Runway's gen4_image model.
 */
export async function generateImage({
  promptText,
  ratio = '1280:720',
  seed,
}: ImageGenerationOptions) {
  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`[Runway] Initializing Gen4 image generation (Attempt ${attempts}/${maxAttempts}) for: "${promptText.substring(0, 50)}..."`);
      
      const task = await client.textToImage.create({
        model: 'gen4_image',
        promptText,
        ratio,
        seed,
      });

      let currentTask = await client.tasks.retrieve(task.id);
      while (currentTask.status !== 'SUCCEEDED' && currentTask.status !== 'FAILED') {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased poll time slightly
        currentTask = await client.tasks.retrieve(task.id);
      }

      if (currentTask.status === 'FAILED') {
        console.warn(`[Runway] Image task failed on attempt ${attempts}: ${currentTask.failure || 'Unknown error'}`);
        if (attempts < maxAttempts) {
          console.log(`[Runway] Retrying in 3 seconds...`);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`Runway image task failed: ${currentTask.failure || 'Unknown error'}`);
      }

      return currentTask;
    } catch (error) {
      if (attempts < maxAttempts) {
        console.error(`[Runway] Catch error on attempt ${attempts}, retrying...`, error);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      console.error('[Runway] Image Generation Error after max attempts:', error);
      throw error;
    }
  }
  throw new Error('Image generation failed after maximum retries');
}

/**
 * Centralized function to generate speech using Runway's eleven_multilingual_v2 model.
 * 
 * @param options - Generation parameters (prompt, voice preset)
 * @returns The generated task output including the audio URL
 */
export async function generateSpeech({
  promptText,
  presetId = 'Bernard', // Defaulting to Bernard (authoritative detective voice)
}: SpeechGenerationOptions) {
  try {
    console.log(`[Runway] Initializing Text-to-Speech generation for: "${promptText.substring(0, 50)}..." using voice ${presetId}`);
    
    const task = await client.textToSpeech.create({
      model: 'eleven_multilingual_v2',
      promptText,
      voice: {
        type: 'runway-preset',
        presetId: presetId,
      },
    });

    let currentTask = await client.tasks.retrieve(task.id);
    while (currentTask.status !== 'SUCCEEDED' && currentTask.status !== 'FAILED') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Audio is very fast
      currentTask = await client.tasks.retrieve(task.id);
    }

    if (currentTask.status === 'FAILED') {
      throw new Error(`Runway speech task failed: ${currentTask.failure || 'Unknown error'}`);
    }

    return currentTask;
  } catch (error) {
    console.error('[Runway] Speech Generation Error:', error);
    throw error;
  }
}

/**
 * Centralized function to create an AI Avatar using Runway's avatars API.
 * 
 * @param options - Avatar parameters (name, image, personality, voice, script, docs)
 * @returns The created avatar object
 */
export async function createAvatar({
  name,
  referenceImage,
  personality,
  voiceId = 'adrian',
  startScript,
  documentIds,
  embed,
}: AvatarCreationOptions) {
  try {
    console.log(`[Runway] Creating AI Avatar: ${name}`);
    
    const avatar = await client.avatars.create({
      name,
      referenceImage,
      personality,
      voice: {
        type: 'runway-live-preset',
        presetId: voiceId,
      },
      startScript,
      documentIds,
      imageProcessing: 'optimize', // Always optimize for best forensic quality
    });

    return avatar;
  } catch (error) {
    console.error('[Runway] Avatar Creation Error:', error);
    throw error;
  }
}

/**
 * Create a new knowledge document with the specified content.
 * 
 * @param name - The name of the document
 * @param text - The content of the document
 * @returns The created document object
 */
export async function createDocument(name: string, text: string) {
  try {
    console.log(`[Runway] Creating Knowledge Document: ${name}`);
    
    const document = await client.documents.create({
      name,
      content: text,
    });

    return document;
  } catch (error) {
    console.error('[Runway] Document Creation Error:', error);
    throw error;
  }
}

/**
 * Create a new realtime session with the specified avatar.
 * 
 * @param avatarId - The ID of the custom avatar
 * @returns The created session object
 */
export async function createRealtimeSession(avatarId: string, isPreset: boolean = false) {
  try {
    console.log(`[Runway] Starting Realtime Session for ${isPreset ? 'Preset' : 'Custom'} Avatar: ${avatarId}`);
    
    const avatar = isPreset 
      ? { type: 'runway-preset' as const, presetId: avatarId as any }
      : { type: 'custom' as const, avatarId: avatarId };

    // 1. First ensure the avatar itself is READY if it's a custom one
    if (!isPreset) {
      console.log(`[Runway] Verifying Avatar readiness: ${avatarId}`);
      const AVATAR_POLL_TIMEOUT = 60_000;
      const AVATAR_POLL_INTERVAL = 2_000;
      const avatarDeadline = Date.now() + AVATAR_POLL_TIMEOUT;
      let hasRetried = false;

      while (Date.now() < avatarDeadline) {
        const avatarDetail = await client.avatars.retrieve(avatarId);
        if (avatarDetail.status === 'READY') {
          console.log(`[Runway] Avatar ${avatarId} is READY.`);
          break;
        }
        
        if (avatarDetail.status === 'FAILED') {
          // Attempt a one-time retry by updating the reference image
          if (!hasRetried && avatarDetail.referenceImageUri) {
            console.log(`[Runway] Avatar FAILED. Attempting reconstructive update...`);
            await client.avatars.update(avatarId, {
              referenceImage: avatarDetail.referenceImageUri
            });
            hasRetried = true;
            await new Promise(r => setTimeout(r, 5000)); // Give it a head start
            continue;
          }
          throw new Error(`Avatar processing failed: ${avatarDetail.status}`);
        }
        
        console.log(`[Runway] Avatar ${avatarId} still ${avatarDetail.status}. Waiting...`);
        await new Promise(r => setTimeout(r, AVATAR_POLL_INTERVAL));
        if (Date.now() >= avatarDeadline) throw new Error('Avatar processing timed out');
      }
    }

    // 2. Create the session
    const { id: sessionId } = await client.realtimeSessions.create({
      model: 'gwm1_avatars',
      avatar,
    });

    // 3. Poll until session is ready to get the sessionKey
    const TIMEOUT_MS = 30_000;
    const POLL_INTERVAL_MS = 1_000;
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline) {
      const session = await client.realtimeSessions.retrieve(sessionId);

      if (session.status === 'READY') return session;

      if (session.status === 'COMPLETED' || session.status === 'FAILED' || session.status === 'CANCELLED') {
        throw new Error(`Session ${session.status.toLowerCase()} before becoming ready`);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error('Session creation timed out');
  } catch (error) {
    console.error('[Runway] Realtime Session Error:', error);
    throw error;
  }
}


