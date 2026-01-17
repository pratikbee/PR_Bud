# Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [API Architecture](#api-architecture)
7. [Frontend Architecture](#frontend-architecture)
8. [State Management](#state-management)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)
11. [Performance Considerations](#performance-considerations)
12. [Scalability](#scalability)

---

## System Overview

The **AI Security Auditor** is a Next.js 15 application that provides automated security analysis of Git pull requests and code diffs using Google's Gemini AI model. The system follows a serverless architecture pattern optimized for Vercel deployment.

### Core Principles
- **Serverless First**: All API routes are serverless functions
- **Streaming by Default**: Real-time AI responses via streaming
- **Type Safety**: Full TypeScript with Zod schema validation
- **Component-Based UI**: Modular React components with shadcn/ui
- **Human-in-the-Loop**: AI provides insights, humans make decisions

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              React Dashboard Component                 │  │
│  │  • useObject Hook (Streaming)                         │  │
│  │  • State Management                                   │  │
│  │  • UI Rendering                                       │  │
│  └──────────────────┬───────────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────────┘
                      │ HTTP/HTTPS
                      │ POST /api/analyze
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Server (Vercel)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Route Layer                          │  │
│  │  ┌────────────────┐  ┌──────────────────────────┐ │  │
│  │  │ /api/analyze    │  │ /api/github/diff          │ │  │
│  │  │                 │  │                           │ │  │
│  │  │ • streamObject  │  │ • Octokit Client          │ │  │
│  │  │ • Gemini AI     │  │ • GitHub API              │ │  │
│  │  │ • Schema Valid  │  │ • PR Diff Fetch          │ │  │
│  │  └────────────────┘  └──────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬──────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐         ┌──────────────────┐
│  Google AI    │         │   GitHub API     │
│  (Gemini)     │         │                  │
│               │         │  • PR Metadata   │
│  • v1 API     │         │  • Diff Content  │
│  • Streaming  │         │  • File Context  │
│  • Structured │         │                  │
└───────────────┘         └──────────────────┘
```

---

## Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 18.2.0
- **Styling**: Tailwind CSS 4
- **Component Library**: shadcn/ui (Radix UI primitives)
- **AI Integration**: `@ai-sdk/react` (experimental_useObject)
- **Markdown**: react-markdown

### Backend
- **Runtime**: Node.js (serverless functions)
- **AI SDK**: Vercel AI SDK (`ai` package)
- **AI Provider**: `@ai-sdk/google` (Gemini 1.5 Flash)
- **GitHub Integration**: Octokit
- **Validation**: Zod

### Infrastructure
- **Hosting**: Vercel (serverless)
- **Environment**: Edge/Node.js runtime
- **Streaming**: ReadableStream API

---

## Component Architecture

### Directory Structure

```
src/
├── app/
│   ├── api/
│   │   ├── analyze/
│   │   │   └── route.ts          # AI analysis endpoint
│   │   ├── github/
│   │   │   └── diff/
│   │   │       └── route.ts      # GitHub PR diff fetcher
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts      # NextAuth handlers
│   ├── page.tsx                  # Root page (Dashboard)
│   └── layout.tsx                 # Root layout
├── components/
│   ├── dashboard.tsx             # Main dashboard component
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       └── ...
├── lib/
│   ├── config.ts                 # Environment variables
│   ├── schemas.ts                # Zod schemas
│   ├── utils.ts                  # Utility functions
│   └── auth.ts                   # NextAuth configuration
└── auth.ts                       # NextAuth config (root)
```

### Component Hierarchy

```
App (Root Layout)
└── Dashboard
    ├── Input Section
    │   ├── PR URL Input
    │   └── Raw Diff Input
    ├── Diff Viewer
    │   ├── Filter Buttons
    │   └── Syntax Highlighted Diff
    ├── AI Analysis (Streaming)
    │   ├── Summary
    │   └── Issues List
    └── Security Scoreboard
        ├── Statistics
        └── Detailed Issues
```

---

## Data Flow

### 1. User Input Flow

```
User Action
    │
    ├─→ Enter PR URL
    │   │
    │   └─→ POST /api/github/diff
    │       │
    │       ├─→ Parse URL (owner/repo/pull/number)
    │       ├─→ Fetch .diff from GitHub
    │       ├─→ Fetch PR metadata (Octokit)
    │       └─→ Return { diff, pr }
    │
    └─→ Paste Raw Diff
        │
        └─→ Direct to analysis
```

### 2. AI Analysis Flow

```
Diff Available
    │
    └─→ POST /api/analyze
        │
        ├─→ Validate Input
        ├─→ Truncate Diff (30k chars)
        │
        ├─→ streamObject({
        │     model: google("gemini-1.5-flash-8b"),
        │     schema: SecurityAnalysisSchema,
        │     output: "object",
        │     prompt: systemPrompt + diff
        │   })
        │
        ├─→ Gemini API (v1 endpoint)
        │   │
        │   ├─→ Stream JSON chunks
        │   └─→ Validate against Zod schema
        │
        └─→ toTextStreamResponse()
            │
            └─→ Frontend (useObject hook)
                │
                ├─→ Parse streaming JSON
                ├─→ Update UI in real-time
                └─→ Display complete analysis
```

### 3. State Management Flow

```
Component State (useState)
    │
    ├─→ Local State
    │   ├─→ prUrl, rawDiff, diff
    │   ├─→ isLoading, error
    │   └─→ showAdded, showRemoved, showContext
    │
    └─→ AI State (useObject)
        ├─→ object (streaming partial data)
        ├─→ isLoading (streaming status)
        ├─→ error (validation errors)
        └─→ submit (trigger analysis)
```

---

## API Architecture

### Endpoint: `/api/analyze`

**Purpose**: Stream security analysis from Gemini AI

**Method**: `POST`

**Request Body**:
```typescript
{
  diff: string;           // Required: Git diff content
  fileContext?: string;  // Optional: Additional file context
}
```

**Response**: Streaming text response
- Format: Text stream with JSON chunks
- Protocol: `toTextStreamResponse()` (Vercel AI SDK)
- Content-Type: `text/plain; charset=utf-8`

**Implementation Details**:
```typescript
// Key Configuration
const google = createGoogleGenerativeAI({
  apiKey: GEMINI_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1", // Stable v1
});

const result = await streamObject({
  model: google("gemini-1.5-flash-8b"),
  schema: SecurityAnalysisSchema,
  output: "object",  // Critical for v1 compatibility
  prompt: systemPrompt + diff,
});
```

**Error Handling**:
- 400: Missing diff
- 500: AI API errors, validation failures

---

### Endpoint: `/api/github/diff`

**Purpose**: Fetch PR diff from GitHub

**Method**: `POST`

**Request Body**:
```typescript
{
  prUrl: string;  // GitHub PR URL
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
- Uses Octokit for authenticated requests
- Falls back to public `.diff` URL for unauthenticated access
- Parses PR URL with regex pattern

---

## Frontend Architecture

### Component: `Dashboard`

**Location**: `src/components/dashboard.tsx`

**Responsibilities**:
1. User input handling (PR URL, raw diff)
2. AI analysis orchestration
3. Real-time streaming UI updates
4. Diff visualization with syntax highlighting
5. Security issue display and filtering

**Key Hooks**:
- `useState`: Local component state
- `useEffect`: Side effects and error handling
- `useObject`: AI streaming integration

**State Structure**:
```typescript
{
  // Input State
  prUrl: string;
  rawDiff: string;
  diff: string;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Filter State
  showAdded: boolean;
  showRemoved: boolean;
  showContext: boolean;
  
  // AI State (from useObject)
  object: Partial<SecurityAnalysis> | undefined;
  isLoading: boolean;
  error: Error | undefined;
}
```

### Diff Visualization

**Features**:
- **Syntax Highlighting**: Color-coded by line type
  - Green: Added lines (`+`)
  - Red: Removed lines (`-`)
  - Cyan: File headers
  - Blue: Hunk headers (`@@`)
  - Gray: Context lines

- **Security Issue Highlighting**:
  - Yellow background for lines with issues
  - Ring effect for high-severity issues
  - Hover tooltips with issue details
  - Badge indicators on hover

- **Filtering**:
  - Toggle buttons for Added/Removed/Context
  - Real-time filtering without re-rendering entire diff
  - Visual state indicators

---

## State Management

### Local Component State

**Pattern**: React `useState` hooks

**State Variables**:
- `prUrl`: GitHub PR URL input
- `rawDiff`: Raw diff textarea input
- `diff`: Processed diff to display
- `isLoading`: GitHub fetch loading state
- `error`: Error messages
- `showAdded/showRemoved/showContext`: Diff filter toggles

### AI Streaming State

**Pattern**: `useObject` hook from `@ai-sdk/react`

**State Variables**:
- `object`: Partial streaming object (updates in real-time)
- `isLoading`: Streaming status
- `error`: Validation/API errors
- `submit`: Function to trigger analysis

**State Updates**:
- `object` updates incrementally as AI streams
- Each chunk updates the partial object
- Final object validated against Zod schema

### Derived State

**Pattern**: Computed from `object`

```typescript
const analysis: SecurityAnalysis | null = object ? {
  summary: object.summary ?? "",
  overallRisk: object.overallRisk ?? "low",
  issues: object.issues ?? [],
  statistics: {
    totalIssues: object.statistics?.totalIssues ?? 0,
    // ... other stats
  },
} : null;
```

---

## Security Architecture

### API Key Management

**Storage**: Environment variables (`.env`)

**Access Pattern**:
```typescript
// Server-side only
export const GEMINI_KEY = process.env.GEMINI_KEY || '';
export const GITHUB_KEY = process.env.GITHUB_KEY || '';
```

**Security Measures**:
- ✅ Never exposed to client
- ✅ Validated on module load
- ✅ Explicit API key passing to providers
- ✅ `.env` in `.gitignore`

### Input Validation

**Backend**:
- Request body validation
- Diff length limits (30k chars)
- URL pattern validation for PR URLs

**Frontend**:
- Form validation before submission
- Error state management
- User-friendly error messages

### Schema Validation

**Pattern**: Zod schemas for AI output

**Benefits**:
- Type safety
- Runtime validation
- Prevents malformed data in UI
- Handles partial streaming data gracefully

---

## Deployment Architecture

### Vercel Serverless Functions

**Runtime**: Node.js

**Configuration**:
```typescript
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
```

**Scaling**:
- Automatic scaling per request
- Cold start optimization
- Edge runtime available (not used for streaming)

### Environment Variables

**Required**:
- `GEMINI_KEY`: Google AI API key
- `GITHUB_KEY`: GitHub personal access token (optional)

**Optional** (NextAuth):
- `AUTH_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `NEXTAUTH_URL`

### Build Process

```
npm run build
    │
    ├─→ TypeScript compilation
    ├─→ Next.js optimization
    ├─→ Serverless function bundling
    └─→ Static asset generation
```

---

## Performance Considerations

### Streaming Optimization

**Strategy**: Progressive rendering

- UI updates as data streams in
- No waiting for complete response
- Better perceived performance

### Diff Processing

**Optimizations**:
- Truncation to 30k characters (prevents token overflow)
- Line-by-line parsing (efficient)
- Conditional rendering (only visible lines)

### Caching Strategy

**Current**: No caching

**Future Enhancements**:
- Cache analysis results by diff hash
- Reduce API calls for repeated diffs
- Improve response times

### Bundle Size

**Optimizations**:
- Tree-shaking enabled
- Code splitting by route
- Dynamic imports for heavy components

---

## Scalability

### Current Limitations

1. **Diff Size**: 30k character limit
2. **Concurrent Requests**: Vercel function limits
3. **API Rate Limits**: Gemini API quotas

### Scaling Strategies

**Horizontal Scaling**:
- Serverless functions scale automatically
- No manual infrastructure management
- Pay-per-use model

**Vertical Scaling**:
- Increase diff size limits (if needed)
- Upgrade API quotas
- Optimize prompt engineering

**Future Enhancements**:
- Batch processing for large PRs
- Parallel file analysis
- Result caching layer
- Queue system for high-volume usage

---

## API Integration Details

### Google Gemini Integration

**Provider**: `@ai-sdk/google`

**Configuration**:
```typescript
const google = createGoogleGenerativeAI({
  apiKey: GEMINI_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1",
});
```

**Model Selection**:
- Primary: `gemini-1.5-flash-8b` (8B variant, higher free tier limits)
- Fallback: `gemini-1.5-flash-002` (specific version)
- Fallback: `models/gemini-1.5-flash` (with prefix)
- Fallback: `gemini-1.5-flash` (base name)

**Why v1 Endpoint**:
- Stable production API
- Better compatibility with API keys
- Avoids v1beta 404 errors
- Supports structured outputs via prompt steering

### GitHub Integration

**Library**: Octokit

**Authentication**:
- Personal Access Token (optional)
- Public PRs work without auth
- Private repos require token

**Endpoints Used**:
- `GET /repos/{owner}/{repo}/pulls/{pull_number}`: PR metadata
- `.diff` URL: Raw diff content

---

## Error Handling Architecture

### Backend Error Handling

**Pattern**: Try-catch with structured responses

```typescript
try {
  // API logic
} catch (error: any) {
  console.error("Error:", error.message);
  return new Response(
    JSON.stringify({ error: error.message }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
```

**Error Types**:
- Validation errors (400)
- API errors (500)
- Network errors (handled by SDK)

### Frontend Error Handling

**Pattern**: Error boundaries + state management

```typescript
const { object, error, submit } = useObject({
  api: "/api/analyze",
  schema: SecurityAnalysisSchema,
  onError: (error: Error) => {
    setError(error.message);
  },
});
```

**Error Display**:
- Inline error messages
- User-friendly formatting
- Retry mechanisms

---

## Schema Architecture

### Zod Schema Definition

**Location**: `src/lib/schemas.ts`

**Structure**:
```typescript
SecurityIssueSchema = {
  severity: "high" | "medium" | "low",
  category: string,
  description: string,
  lineNumber: number | null,
  filePath: string | null,
  recommendation: string,
}

SecurityAnalysisSchema = {
  summary: string,
  overallRisk: "high" | "medium" | "low",
  issues: SecurityIssueSchema[] (optional),
  statistics: {
    totalIssues: number,
    highRisk: number,
    mediumRisk: number,
    lowRisk: number,
  } (optional),
}
```

**Design Decisions**:
- `issues` and `statistics` are optional to support partial streaming
- Nullable fields for optional data
- Enum types for constrained values

---

## Streaming Architecture

### Backend Streaming

**Implementation**: `streamObject` + `toTextStreamResponse()`

**Flow**:
1. `streamObject()` creates streaming result
2. `toTextStreamResponse()` converts to ReadableStream
3. Stream sent to client via HTTP response
4. Client reads chunks incrementally

### Frontend Streaming

**Implementation**: `useObject` hook

**Flow**:
1. Hook sends POST request
2. Receives ReadableStream
3. Parses JSON chunks incrementally
4. Updates `object` state on each chunk
5. UI re-renders with partial data

**Benefits**:
- Real-time feedback
- Better UX (no long waits)
- Handles large responses gracefully

---

## UI/UX Architecture

### Design System

**Base**: shadcn/ui components

**Customization**:
- Tailwind CSS for styling
- Color-coded AI content
- Responsive design
- Dark mode support

### Color Coding Strategy

**AI-Generated Content**:
- Summary: Purple
- Findings: Blue
- Recommendations: Emerald
- Streaming indicator: Blue with pulse

**Diff Display**:
- Added lines: Green
- Removed lines: Red
- Security issues: Yellow
- File headers: Cyan
- Hunk headers: Blue

### Accessibility

**Features**:
- Semantic HTML
- ARIA labels (via Radix UI)
- Keyboard navigation
- Screen reader support

---

## Testing Strategy

### Current State

**Manual Testing**: Primary method

**Test Scenarios**:
1. PR URL input and fetch
2. Raw diff input
3. AI analysis streaming
4. Error handling
5. Filter toggles

### Future Testing

**Unit Tests**:
- Schema validation
- URL parsing
- Diff parsing logic

**Integration Tests**:
- API route testing
- Streaming behavior
- Error scenarios

**E2E Tests**:
- Full user workflows
- UI interactions
- Real API calls (stubbed)

---

## Monitoring & Observability

### Current Logging

**Backend**:
- Console.error for errors
- Request/response logging
- API call status

**Frontend**:
- Console.log for debugging
- Error state display
- Streaming status indicators

### Future Enhancements

**Recommended**:
- Structured logging (JSON)
- Error tracking (Sentry)
- Performance monitoring
- Analytics for usage patterns

---

## Migration & Versioning

### API Versioning

**Current**: No versioning

**Future**: Add `/api/v1/` prefix if needed

### Schema Evolution

**Strategy**: Backward-compatible changes

- Add optional fields only
- Don't remove required fields
- Version schemas if breaking changes needed

---

## Security Best Practices

### Implemented

✅ API keys server-side only
✅ Input validation
✅ Schema validation
✅ Error message sanitization
✅ HTTPS only (Vercel default)

### Recommendations

- Rate limiting (Vercel Pro)
- Request size limits
- API key rotation
- Audit logging
- Content Security Policy headers

---

## Performance Metrics

### Current Performance

**Typical Response Times**:
- GitHub diff fetch: 1-3 seconds
- AI analysis start: < 1 second
- First chunk: 2-5 seconds
- Complete analysis: 10-30 seconds (depends on diff size)

**Optimization Opportunities**:
- Diff truncation (already implemented)
- Prompt optimization
- Model selection (8b variant for speed)
- Caching layer

---

## Future Architecture Enhancements

### Planned Features

1. **Caching Layer**
   - Redis for analysis results
   - Diff hash-based keys
   - TTL management

2. **Batch Processing**
   - Multiple file analysis
   - Parallel processing
   - Aggregated results

3. **Custom Rules Engine**
   - User-defined security rules
   - Rule templates
   - Rule validation

4. **Historical Tracking**
   - Analysis history
   - Trend analysis
   - Improvement tracking

5. **CI/CD Integration**
   - GitHub Actions
   - Automated PR comments
   - Merge blocking rules

---

## Conclusion

This architecture provides a scalable, maintainable foundation for the AI Security Auditor. The serverless design ensures automatic scaling, while the streaming architecture provides excellent user experience. The modular component structure allows for easy extension and customization.

**Key Strengths**:
- ✅ Type-safe throughout
- ✅ Real-time streaming
- ✅ Clean separation of concerns
- ✅ Production-ready error handling
- ✅ Scalable serverless architecture

**Areas for Growth**:
- Caching layer
- Advanced filtering
- Batch processing
- Historical analytics
- CI/CD integration
