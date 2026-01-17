import { z } from "zod";

// Security issue schema for structured output
export const SecurityIssueSchema = z.object({
    severity: z.enum(["high", "medium", "low"]),
    category: z.string(),
    description: z.string(),
    lineNumber: z.number().nullable(),
    filePath: z.string().nullable(),
    recommendation: z.string(),
});

export const SecurityAnalysisSchema = z.object({
    summary: z.string(),
    overallRisk: z.enum(["high", "medium", "low"]),
    // Make optional so stream can start even if AI hasn't finished these sections
    issues: z.array(SecurityIssueSchema).optional().default([]),
    statistics: z.object({
        totalIssues: z.number(),
        highRisk: z.number(),
        mediumRisk: z.number(),
        lowRisk: z.number(),
    }).optional(),
});
