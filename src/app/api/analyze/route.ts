import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamObject } from "ai";
import { SecurityAnalysisSchema } from "@/lib/schemas";
import { GEMINI_KEY } from "@/lib/config";

// Force dynamic rendering to enable streaming
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Validate API key on module load
if (!GEMINI_KEY) {
  console.error("GEMINI_KEY is not set in environment variables!");
  throw new Error("GEMINI_KEY is required");
}

// Create Google provider with explicit API key and force stable v1 endpoint
// This prevents the SDK from trying to use v1beta which causes 404 errors
const google = createGoogleGenerativeAI({
  apiKey: GEMINI_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1", // Force stable v1 endpoint
  structuredOutputs: false, // Disable native structured outputs to avoid 400 error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any); // Type assertion needed as TypeScript types may not include this yet

export async function POST(request: Request) {
  try {
    const { diff } = await request.json();

    if (!diff) {
      return new Response("No diff provided", { status: 400 });
    }

    // Merge system instructions into the prompt (v1 doesn't support systemInstruction field)
    const result = await streamObject({
      model: google("gemini-1.5-flash"),
      schema: SecurityAnalysisSchema,
      output: "object",
      prompt: `
You are a Senior Security Engineer. Analyze this Git diff:
${diff.substring(0, 30000)}

Identify security issues like leaked secrets or SQL injection. 
Your response must be a valid JSON object matching the requested schema.
      `,
    });

    return result.toTextStreamResponse();

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze code";
    console.error("Audit Stream Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}