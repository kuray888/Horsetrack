import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserIdFromRequest } from "@/lib/supabaseAdmin";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Limite raisonnable : une note post-séance dure rarement plus de 2 minutes,
 * soit ~2 Mo en AAC 128 kbps. On accepte jusqu'à 10 Mo pour couvrir les formats
 * moins compressés, bien en-deçà de la limite Whisper (25 Mo). */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "Fichier audio manquant" }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 413 });
  }

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "fr",
      // Aide Whisper à reconnaître le vocabulaire équestre
      prompt: "Note de journal d'équitation : séance, cheval, galop, trot, pas, longe, obstacle, dressage, cavalier.",
    });

    return NextResponse.json({ text: transcription.text.trim() });
  } catch (e) {
    console.error("[transcribe] Whisper error", e);
    return NextResponse.json({ error: "Transcription impossible" }, { status: 502 });
  }
}
