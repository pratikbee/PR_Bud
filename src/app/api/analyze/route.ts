import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { z } from "zod";
import { GEMINI_KEY } from "@/lib/config";

// Security issue schema for structured output
const SecurityIssueSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  category: z.string(),
  description: z.string(),
  lineNumber: z.number().nullable(),
  filePath: z.string().nullable(),
  recommendation: z.string(),
});

const SecurityAnalysisSchema = z.object({
  summary: z.string(),
  overallRisk: z.enum(["high", "medium", "low"]),
  issues: z.array(SecurityIssueSchema),
  statistics: z.object({
    totalIssues: z.number(),
    highRisk: z.number(),
    mediumRisk: z.number(),
    lowRisk: z.number(),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Support both direct diff and useChat format
    const diff = body.diff || "";
    const fileContext = body.fileContext || "";

    if (!diff || diff.trim() === "") {
      return new Response("Diff is required", { status: 400 });
    }

    const systemPrompt = `You are a Senior Security Engineer conducting a code review. Your task is to analyze the provided Git diff and identify security vulnerabilities, code quality issues, and potential improvements.

Focus on:
1. SQL Injection vulnerabilities
2. XSS (Cross-Site Scripting) vulnerabilities
3. Hardcoded secrets, API keys, or credentials
4. Authentication and authorization flaws
5. Insecure data handling (encryption, hashing)
6. Inefficient or vulnerable loops and algorithms
7. Missing input validation and sanitization
8. Security misconfigurations
9. Dependency vulnerabilities
10. Error handling that leaks sensitive information

For each issue found, provide:
- Severity level (high/medium/low)
- Category (e.g., "SQL Injection", "Hardcoded Secret", "Input Validation")
- Clear description
- Line number if applicable
- File path if applicable
- Actionable recommendation

Be thorough but practical. Prioritize actual security risks over style preferences.`;

    const result = await streamText({
      model: google("gemini-2.0-flash-exp"),
      system: systemPrompt,
      prompt: `Analyze this Git diff for security vulnerabilities and return your analysis as JSON with this exact structure:

{
  "summary": "Brief summary of the security assessment",
  "overallRisk": "high" | "medium" | "low",
  "issues": [
    {
      "severity": "high" | "medium" | "low",
      "category": "Issue category name",
      "description": "Detailed description",
      "lineNumber": 123 or null,
      "filePath": "path/to/file" or null,
      "recommendation": "How to fix this"
    }
  ],
  "statistics": {
    "totalIssues": 0,
    "highRisk": 0,
    "mediumRisk": 0,
    "lowRisk": 0
  }
}

Git diff:
\`\`\`
${diff}
\`\`\`
${fileContext ? `\nAdditional file context:\n\`\`\`\n${fileContext}\n\`\`\`` : ""}`,
      temperature: 0.3,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Error analyzing code:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to analyze code" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
