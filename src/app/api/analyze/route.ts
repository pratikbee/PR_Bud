// app/api/analyze/route.ts
import { google } from "@ai-sdk/google";
import { streamObject } from "ai";
import { SecurityAnalysisSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const { diff } = await request.json();

    const result = streamObject({
      model: google("gemini-1.5-flash-8b"), // Use 1.5 Flash 8B - higher free tier limits
      schema: SecurityAnalysisSchema,
      system: `You are a Senior Security Engineer analyzing Git diffs for security vulnerabilities.
Your response must be a valid JSON object matching the requested schema.`,
      prompt: `Analyze the following Git diff for security vulnerabilities:

${diff.substring(0, 30000)}`,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Audit Stream Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}