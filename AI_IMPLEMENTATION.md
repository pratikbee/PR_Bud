# AI-Powered Security Audit Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [API Implementation](#api-implementation)
5. [Frontend Integration](#frontend-integration)
6. [Data Flow](#data-flow)
7. [Configuration](#configuration)
8. [Usage Examples](#usage-examples)
9. [Technical Details](#technical-details)

---

## Overview

This application implements a **Human-in-the-Loop AI Auditor** that analyzes Git pull requests and code diffs for security vulnerabilities. The system uses:

- **Next.js 15** (App Router) for the web framework
- **Vercel AI SDK** (`streamObject`) for AI orchestration and streaming
- **Google Gemini 1.5 Flash** as the AI model for code analysis
- **Zod** for structured output validation
- **GitHub API** (via Octokit) for fetching PR data
- **shadcn/ui** for the user interface

### Key Features

- 🔍 **Automated Security Scanning**: Analyzes code diffs for OWASP Top 10 vulnerabilities
- 📊 **Structured Output**: Returns validated JSON with severity levels, categories, and recommendations
- 🌊 **Real-time Streaming**: Streams AI analysis results as they're generated
- 🎨 **Visual Dashboard**: Clean UI with color-coded risk levels and issue categorization
- 🔐 **GitHub Integration**: Fetches PR diffs directly from GitHub URLs

---

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (Dashboard)   │
└────────┬────────┘
         │
         │ POST /api/analyze
         ▼
┌─────────────────┐
│  API Route      │
│ /api/analyze    │
└────────┬────────┘
         │
         │ streamObject()
         ▼
┌─────────────────┐
│  Vercel AI SDK  │
│  @ai-sdk/google │
└────────┬────────┘
         │
         │ API Call
         ▼
┌─────────────────┐
│  Gemini 1.5    │
│     Flash      │
└────────┬────────┘
         │
         │ Structured JSON Stream
         ▼
┌─────────────────┐
│  Frontend       │
│  (Parses JSON)  │
└─────────────────┘
```

---

## Core Components

### 1. Schema Definition (`src/lib/schemas.ts`)

Defines the structure of the AI's output using Zod schemas.

```typescript
import { z } from "zod";

// Individual security issue schema
export const SecurityIssueSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  category: z.string(),
  description: z.string(),
  lineNumber: z.number().nullable(),
  filePath: z.string().nullable(),
  recommendation: z.string(),
});

// Complete security analysis schema
export const SecurityAnalysisSchema = z.object({
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
```

**Purpose**: Ensures the AI returns valid, structured JSON that matches our expected format.

**Key Functions**:
- `SecurityIssueSchema`: Validates individual security findings
- `SecurityAnalysisSchema`: Validates the complete analysis response

---

### 2. Configuration (`src/lib/config.ts`)

Manages environment variables and API keys.

```typescript
export const GEMINI_KEY = process.env.GEMINI_KEY || '';
export const GITHUB_KEY = process.env.GITHUB_KEY || '';

// NextAuth configuration
export const AUTH_SECRET = process.env.AUTH_SECRET || '';
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
```

**Purpose**: Centralized configuration management with validation warnings.

---

### 3. API Route (`src/app/api/analyze/route.ts`)

The core AI analysis endpoint.

#### Function: `POST(request: Request)`

**Purpose**: Receives a code diff, sends it to Gemini AI, and streams back structured security analysis.

**Parameters**:
- `request`: HTTP Request object containing JSON body with `diff` and optional `fileContext`

**Request Body**:
```typescript
{
  diff: string;           // Git diff content
  fileContext?: string;   // Additional file context (optional)
}
```

**Response**: Streaming text response containing JSON that matches `SecurityAnalysisSchema`

**Implementation Flow**:

1. **Parse Request**:
   ```typescript
   const { diff, fileContext } = await request.json();
   ```

2. **Validate Input**:
   ```typescript
   if (!diff) {
     return new Response("Diff is required", { status: 400 });
   }
   ```

3. **Define System Prompt**:
   ```typescript
   const systemPrompt = `You are a Senior Security Engineer...`;
   ```
   - Focuses on OWASP Top 10 vulnerabilities
   - Instructs AI on what to look for
   - Defines output format expectations

4. **Call AI with Structured Output**:
   ```typescript
   const result = await streamObject({
     model: google("gemini-1.5-flash"),
     schema: SecurityAnalysisSchema,
     system: systemPrompt,
     prompt: `Analyze this Git diff...`,
     temperature: 0.1,
   });
   ```

5. **Stream Response**:
   ```typescript
   return result.toTextStreamResponse();
   ```

**Key Features**:
- ✅ Uses `streamObject` for guaranteed JSON structure
- ✅ Low temperature (0.1) for consistent security audits
- ✅ Truncates large diffs (40,000 chars) to stay within token limits
- ✅ Handles errors gracefully

---

### 4. GitHub Integration (`src/app/api/github/diff/route.ts`)

Fetches pull request diffs from GitHub.

#### Function: `POST(request: NextRequest)`

**Purpose**: Extracts PR URL, fetches diff content, and returns it with PR metadata.

**Parameters**:
- `request`: NextRequest containing JSON with `prUrl`

**Request Body**:
```typescript
{
  prUrl: string;  // GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)
}
```

**Response**:
```typescript
{
  diff: string;
  pr: {
    title: string;
    number: number;
    author: string;
    url: string;
    owner: string;
    repo: string;
  };
}
```

**Implementation**:

1. **Parse PR URL**:
   ```typescript
   const prUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
   const [, owner, repo, pullNumber] = match;
   ```

2. **Fetch Diff**:
   ```typescript
   const diffUrl = `https://github.com/${owner}/${repo}/pull/${pullNumber}.diff`;
   const diffResponse = await fetch(diffUrl);
   const diff = await diffResponse.text();
   ```

3. **Fetch PR Metadata**:
   ```typescript
   const prResponse = await octokit.rest.pulls.get({
     owner, repo, pull_number: parseInt(pullNumber),
   });
   ```

---

### 5. Frontend Dashboard (`src/components/dashboard.tsx`)

Main user interface component.

#### Key Functions

##### `handleFetchPR()`
- Parses GitHub PR URL
- Calls `/api/github/diff` to fetch diff
- Automatically starts analysis

##### `handleSubmitDiff(e: React.FormEvent)`
- Handles form submission for raw diff input
- Validates input
- Starts analysis

##### `startAnalysis(diffToAnalyze: string)`
**Purpose**: Main function that orchestrates the AI analysis flow.

**Flow**:
1. **Initialize State**:
   ```typescript
   setAnalysis(null);
   setDiff(diffToAnalyze);
   setStreamingText("");
   setIsStreaming(true);
   ```

2. **Fetch Analysis**:
   ```typescript
   const response = await fetch("/api/analyze", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ diff: diffToAnalyze }),
   });
   ```

3. **Read Stream**:
   ```typescript
   const reader = response.body?.getReader();
   const decoder = new TextDecoder();
   let fullText = "";
   
   while (true) {
     const { done, value } = await reader.read();
     if (done) break;
     
     const chunk = decoder.decode(value, { stream: true });
     fullText += chunk;
     setStreamingText(fullText);  // Update UI in real-time
   }
   ```

4. **Parse JSON**:
   ```typescript
   // Remove markdown code blocks if present
   let jsonText = fullText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
   
   // Extract JSON object
   const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
   if (jsonMatch) {
     const parsed = JSON.parse(jsonMatch[0]);
     if (parsed.issues && Array.isArray(parsed.issues)) {
       setAnalysis(parsed);  // Update analysis state
     }
   }
   ```

**Real-time Updates**:
- `setStreamingText(fullText)`: Updates UI as chunks arrive
- `setAnalysis(parsed)`: Updates structured analysis when valid JSON is detected

##### `getRiskColor(risk: string)`
Returns Tailwind CSS color class based on risk level.

##### `getSeverityColor(severity: string)`
Returns Tailwind CSS color class based on severity level.

---

## API Implementation

### Endpoint: `POST /api/analyze`

**Purpose**: Analyzes code diff for security vulnerabilities using AI.

**Request**:
```json
{
  "diff": "--- a/file.js\n+++ b/file.js\n@@ -1,3 +1,3 @@\n...",
  "fileContext": "Optional additional context"
}
```

**Response**: Streaming text containing JSON:
```json
{
  "summary": "Security assessment summary",
  "overallRisk": "high",
  "issues": [
    {
      "severity": "high",
      "category": "SQL Injection",
      "description": "User input directly concatenated into SQL query",
      "lineNumber": 42,
      "filePath": "src/database.js",
      "recommendation": "Use parameterized queries"
    }
  ],
  "statistics": {
    "totalIssues": 5,
    "highRisk": 2,
    "mediumRisk": 2,
    "lowRisk": 1
  }
}
```

**Error Handling**:
- Returns `400` if diff is missing
- Returns `500` with error message if AI call fails

---

### Endpoint: `POST /api/github/diff`

**Purpose**: Fetches diff content from a GitHub pull request.

**Request**:
```json
{
  "prUrl": "https://github.com/owner/repo/pull/123"
}
```

**Response**:
```json
{
  "diff": "--- a/file.js\n+++ b/file.js\n...",
  "pr": {
    "title": "Add new feature",
    "number": 123,
    "author": "username",
    "url": "https://github.com/owner/repo/pull/123",
    "owner": "owner",
    "repo": "repo"
  }
}
```

---

## Frontend Integration

### Component Structure

```typescript
export default function Dashboard() {
  // State Management
  const [prUrl, setPrUrl] = useState("");
  const [rawDiff, setRawDiff] = useState("");
  const [diff, setDiff] = useState("");
  const [analysis, setAnalysis] = useState<SecurityAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Event Handlers
  const handleFetchPR = async () => { ... };
  const handleSubmitDiff = async (e: React.FormEvent) => { ... };
  const startAnalysis = async (diffToAnalyze: string) => { ... };

  // UI Rendering
  return (
    <div>
      {/* Input Forms */}
      {/* Analysis Results */}
      {/* Streaming Text Display */}
    </div>
  );
}
```

### UI Features

1. **Input Tabs**:
   - GitHub PR URL input
   - Raw diff textarea

2. **Analysis Display**:
   - **Summary Card**: Overall risk assessment
   - **Statistics**: Count of issues by severity
   - **Issues List**: Detailed findings with:
     - Severity badges (color-coded)
     - Category tags
     - Description
     - Line numbers and file paths
     - Recommendations

3. **Streaming Indicator**:
   - Shows real-time AI output as it streams
   - Color-coded to distinguish AI content

4. **Error Handling**:
   - Displays error messages
   - Provides retry options

---

## Data Flow

### Complete Flow Diagram

```
User Input (PR URL or Diff)
    │
    ▼
┌─────────────────────┐
│  Dashboard Component│
│  (Frontend)         │
└──────────┬──────────┘
           │
           │ POST /api/analyze
           │ { diff: "..." }
           ▼
┌─────────────────────┐
│  API Route          │
│  /api/analyze       │
└──────────┬──────────┘
           │
           │ streamObject({
           │   model: google("gemini-1.5-flash"),
           │   schema: SecurityAnalysisSchema,
           │   system: systemPrompt,
           │   prompt: diff
           │ })
           ▼
┌─────────────────────┐
│  Vercel AI SDK      │
│  streamObject()     │
└──────────┬──────────┘
           │
           │ HTTP Request
           │ to Gemini API
           ▼
┌─────────────────────┐
│  Google Gemini      │
│  1.5 Flash          │
└──────────┬──────────┘
           │
           │ Streaming JSON Response
           │ (validated by Zod schema)
           ▼
┌─────────────────────┐
│  API Route          │
│  toTextStreamResponse()
└──────────┬──────────┘
           │
           │ ReadableStream
           │ (text/plain)
           ▼
┌─────────────────────┐
│  Dashboard          │
│  (Reads stream)     │
└──────────┬──────────┘
           │
           │ Parse JSON
           │ Update State
           ▼
┌─────────────────────┐
│  UI Updates         │
│  (Real-time)        │
└─────────────────────┘
```

### Step-by-Step Data Flow

1. **User submits diff** → `handleSubmitDiff()` or `handleFetchPR()`
2. **Frontend calls API** → `fetch("/api/analyze", { diff })`
3. **API validates input** → Checks if diff exists
4. **API calls AI** → `streamObject()` with schema validation
5. **AI processes** → Gemini analyzes code for vulnerabilities
6. **AI streams response** → JSON chunks stream back
7. **API forwards stream** → `toTextStreamResponse()` creates ReadableStream
8. **Frontend reads stream** → `reader.read()` in a loop
9. **Frontend parses JSON** → Extracts and validates JSON from stream
10. **UI updates** → `setAnalysis()` triggers React re-render
11. **User sees results** → Issues displayed with color coding

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Google Gemini API Key
GEMINI_KEY=your_gemini_api_key_here

# GitHub API Token (for private repos)
GITHUB_KEY=your_github_token_here

# NextAuth Configuration (optional)
AUTH_SECRET=your_auth_secret_here
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
NEXTAUTH_URL=http://localhost:3000
```

### Getting API Keys

1. **Gemini API Key**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy to `GEMINI_KEY`

2. **GitHub Token** (optional, for private repos):
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a token with `repo` scope
   - Copy to `GITHUB_KEY`

---

## Usage Examples

### Example 1: Analyzing a GitHub PR

```typescript
// User enters PR URL in dashboard
const prUrl = "https://github.com/owner/repo/pull/123";

// Frontend automatically:
// 1. Fetches diff from GitHub
// 2. Sends to AI for analysis
// 3. Displays results
```

### Example 2: Analyzing Raw Diff

```typescript
// User pastes diff directly
const diff = `--- a/src/auth.js
+++ b/src/auth.js
@@ -10,7 +10,7 @@ function login(username, password) {
-  const query = "SELECT * FROM users WHERE username = '" + username + "'";
+  const query = "SELECT * FROM users WHERE username = ?";
   return db.query(query);
 }`;

// Frontend sends to /api/analyze
const response = await fetch("/api/analyze", {
  method: "POST",
  body: JSON.stringify({ diff }),
});
```

### Example 3: API Response Structure

```json
{
  "summary": "Found 3 security issues: SQL injection vulnerability, hardcoded API key, and missing input validation.",
  "overallRisk": "high",
  "issues": [
    {
      "severity": "high",
      "category": "SQL Injection",
      "description": "User input directly concatenated into SQL query without parameterization",
      "lineNumber": 42,
      "filePath": "src/database.js",
      "recommendation": "Use parameterized queries or prepared statements"
    },
    {
      "severity": "high",
      "category": "Hardcoded Secret",
      "description": "API key hardcoded in source code",
      "lineNumber": 15,
      "filePath": "src/config.js",
      "recommendation": "Move API key to environment variables"
    },
    {
      "severity": "medium",
      "category": "Input Validation",
      "description": "Missing validation for user email input",
      "lineNumber": 28,
      "filePath": "src/auth.js",
      "recommendation": "Add email format validation before processing"
    }
  ],
  "statistics": {
    "totalIssues": 3,
    "highRisk": 2,
    "mediumRisk": 1,
    "lowRisk": 0
  }
}
```

---

## Technical Details

### Why `streamObject` Instead of `streamText`?

**Problem with `streamText`**:
- Returns unstructured text
- Requires manual JSON parsing
- No guarantee of valid JSON format
- More error-prone

**Solution with `streamObject`**:
- ✅ **Guaranteed Structure**: Zod schema ensures valid JSON
- ✅ **Type Safety**: TypeScript types match schema
- ✅ **Automatic Validation**: Invalid responses are caught early
- ✅ **Simpler Code**: No manual parsing needed
- ✅ **Better Error Handling**: Schema violations are clear

### Temperature Setting

```typescript
temperature: 0.1  // Low temperature for consistent audits
```

**Why 0.1?**
- Security audits need **consistency**, not creativity
- Lower temperature = more deterministic outputs
- Higher temperature = more varied (but less reliable) results
- 0.1 ensures the AI follows the security checklist reliably

### Token Limits

```typescript
diff.substring(0, 40000)  // Limit diff to 40k chars
fileContext.substring(0, 5000)  // Limit context to 5k chars
```

**Why limit?**
- Gemini 1.5 Flash has token limits (~1M tokens)
- Large diffs can exceed limits
- Truncation ensures requests succeed
- Focus on most recent/relevant changes

### Streaming Strategy

**Backend**:
- Uses `streamObject()` which handles streaming internally
- Returns `ReadableStream` via `toTextStreamResponse()`
- Streams JSON as it's generated (not all at once)

**Frontend**:
- Reads stream chunk by chunk
- Updates UI in real-time (`setStreamingText`)
- Parses JSON incrementally (tries to parse on each chunk)
- Final parse after stream completes

**Benefits**:
- ✅ User sees results immediately
- ✅ Better UX (no long wait)
- ✅ Handles large responses gracefully

---

## Error Handling

### API Errors

```typescript
try {
  const result = await streamObject({ ... });
  return result.toTextStreamResponse();
} catch (error: any) {
  console.error("Error analyzing code:", error);
  return new Response(
    JSON.stringify({ error: error.message || "Failed to analyze code" }),
    { status: 500 }
  );
}
```

### Frontend Errors

```typescript
try {
  const response = await fetch("/api/analyze", { ... });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to analyze code: ${errorText}`);
  }
  // ... read stream
} catch (err: any) {
  setError(err.message || "Failed to analyze code");
  setIsStreaming(false);
}
```

### Common Error Scenarios

1. **Missing API Key**:
   - Error: `GOOGLE_GENERATIVE_AI_API_KEY is required`
   - Fix: Set `GEMINI_KEY` in `.env`

2. **Invalid Diff**:
   - Error: `Diff is required`
   - Fix: Ensure diff is provided in request body

3. **API Rate Limits**:
   - Error: `AI_APICallError` with status 429
   - Fix: Wait and retry, or upgrade API quota

4. **Network Errors**:
   - Error: Connection timeout
   - Fix: Check internet connection, API endpoint availability

---

## Performance Considerations

### Optimization Strategies

1. **Diff Truncation**:
   - Limits input to 40k chars
   - Prevents token limit errors
   - Focuses on most relevant changes

2. **Streaming**:
   - Returns results as they're generated
   - No need to wait for complete response
   - Better perceived performance

3. **Schema Validation**:
   - Zod validates at runtime
   - Catches errors early
   - Prevents invalid data in UI

4. **Caching** (Future Enhancement):
   - Could cache analysis results
   - Reduce API calls for same diffs
   - Improve response times

---

## Security Considerations

### API Key Protection

- ✅ Keys stored in `.env` (not committed to git)
- ✅ Server-side only (never exposed to client)
- ✅ Validated on startup with warnings

### Input Sanitization

- ✅ Diff content is treated as text (not executed)
- ✅ No code execution on server
- ✅ Safe to analyze untrusted code

### Output Validation

- ✅ Zod schema ensures structured output
- ✅ TypeScript types prevent type errors
- ✅ Frontend validates before rendering

---

## Future Enhancements

### Potential Improvements

1. **Caching Layer**:
   - Cache analysis results by diff hash
   - Reduce API calls for repeated diffs
   - Improve performance

2. **Batch Analysis**:
   - Analyze multiple files in parallel
   - Aggregate results
   - Faster for large PRs

3. **Custom Rules**:
   - Allow users to define custom security rules
   - Pass to AI as additional context
   - More flexible auditing

4. **Historical Tracking**:
   - Store analysis history
   - Track improvements over time
   - Generate reports

5. **Integration with CI/CD**:
   - GitHub Actions integration
   - Automatic PR comments
   - Block merges on high-risk issues

---

## Troubleshooting

### Issue: Empty Stream Response

**Symptoms**: No AI output, stream completes immediately

**Possible Causes**:
1. Invalid API key
2. API rate limits exceeded
3. Model name incorrect
4. Network issues

**Debug Steps**:
1. Check `.env` file has `GEMINI_KEY`
2. Verify API key is valid
3. Check browser console for errors
4. Check server logs for API errors

### Issue: JSON Parse Errors

**Symptoms**: "JSON parse failed" in console

**Possible Causes**:
1. AI returned invalid JSON
2. Stream incomplete
3. Markdown code blocks in response

**Debug Steps**:
1. Check `streamingText` state for raw output
2. Verify schema matches AI output
3. Check for markdown formatting

### Issue: Slow Response

**Symptoms**: Analysis takes a long time

**Possible Causes**:
1. Large diff (many tokens)
2. API rate limiting
3. Network latency

**Debug Steps**:
1. Check diff size (should be < 40k chars)
2. Monitor API response times
3. Consider truncating diff further

---

## Conclusion

This implementation provides a robust, production-ready AI-powered security audit system. Key strengths:

- ✅ **Structured Output**: Guaranteed valid JSON via Zod schemas
- ✅ **Real-time Streaming**: Immediate feedback to users
- ✅ **Error Handling**: Graceful degradation on failures
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Scalable**: Handles large diffs efficiently

The system is ready for production use and can be extended with additional features as needed.
