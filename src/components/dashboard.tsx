"use client";

import { useState, useEffect } from "react";
import { experimental_useObject as useObject } from "@ai-sdk/react";
import { SecurityAnalysisSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";

type SecurityIssue = {
  severity: "high" | "medium" | "low";
  category: string;
  description: string;
  lineNumber: number | null;
  filePath: string | null;
  recommendation: string;
};

type SecurityAnalysis = {
  summary: string;
  overallRisk: "high" | "medium" | "low";
  issues: SecurityIssue[];
  statistics: {
    totalIssues: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
};

export default function Dashboard() {
  const [prUrl, setPrUrl] = useState("");
  const [rawDiff, setRawDiff] = useState("");
  const [diff, setDiff] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Diff filter states
  const [showAdded, setShowAdded] = useState(true);
  const [showRemoved, setShowRemoved] = useState(true);
  const [showContext, setShowContext] = useState(true);

  // Use useObject hook for structured streaming
  // This hook handles the Zod validation and streaming state automatically
  const { object, submit, isLoading: isAnalyzing, error: objectError } = useObject({
    api: "/api/analyze",
    schema: SecurityAnalysisSchema,
    onError: (error: Error) => {
      console.error("AI Analysis Error:", error);
      setError(error.message || "Failed to analyze code");
    },
    // Optional: useful for debugging the final parsed object
    onFinish: ({ object: finalObject }: { object: any }) => {
      console.log("Full Audit Result:", finalObject);
    },
  });

  // Update error state if objectError changes
  useEffect(() => {
    if (objectError) {
      setError(objectError.message || "Failed to analyze code");
    }
  }, [objectError]);

  // Improved mapping with aggressive optional chaining for partial streaming data
  // During streaming, object is "partial" - summary might exist but statistics might not yet
  const analysis: SecurityAnalysis | null = object ? {
    summary: object.summary ?? "",
    overallRisk: (object.overallRisk as "high" | "medium" | "low") ?? "low",
    issues: object.issues ?? [],
    statistics: {
      totalIssues: object.statistics?.totalIssues ?? 0,
      highRisk: object.statistics?.highRisk ?? 0,
      mediumRisk: object.statistics?.mediumRisk ?? 0,
      lowRisk: object.statistics?.lowRisk ?? 0,
    },
  } : null;

  // Debug: Log raw stream object to see what's coming through
  console.log("Raw Stream Object:", object);

  const handleFetchPR = async () => {
    if (!prUrl.trim()) {
      setError("Please enter a GitHub PR URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDiff("");

    try {
      const response = await fetch("/api/github/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch PR diff");
      }

      const data = await response.json();
      setDiff(data.diff);
      setRawDiff(data.diff);

      // Automatically start analysis using useObject
      submit({ diff: data.diff });
    } catch (err: any) {
      setError(err.message || "Failed to fetch PR");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitDiff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawDiff.trim()) {
      setError("Please paste a diff");
      return;
    }

    setError(null);
    setDiff(rawDiff);
    
    // Start analysis using useObject
    submit({ diff: rawDiff });
  };

  const getRiskColor = (risk: "high" | "medium" | "low") => {
    switch (risk) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getSeverityColor = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">AI Security Auditor</h1>
        <p className="text-muted-foreground">
          Analyze GitHub PRs and diffs for security vulnerabilities with AI-powered code review
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Input Method</CardTitle>
          <CardDescription>
            Provide a GitHub PR URL or paste a raw diff file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pr-url" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pr-url">GitHub PR URL</TabsTrigger>
              <TabsTrigger value="raw-diff">Raw Diff</TabsTrigger>
            </TabsList>

            <TabsContent value="pr-url" className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="https://github.com/owner/repo/pull/123"
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleFetchPR} disabled={isLoading}>
                  {isLoading ? "Fetching..." : "Fetch & Analyze"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="raw-diff" className="space-y-4">
              <form onSubmit={handleSubmitDiff} className="space-y-4">
                <Textarea
                  placeholder="Paste your .diff file content here..."
                  value={rawDiff}
                  onChange={(e) => setRawDiff(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <Button type="submit" disabled={isAnalyzing}>
                  {isAnalyzing ? "Analyzing..." : "Analyze Diff"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {diff && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Code Diff</CardTitle>
                <CardDescription>Raw diff content being analyzed</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {analysis && analysis.issues.length > 0 && (
                  <Badge variant="destructive" className="font-mono text-xs">
                    {analysis.issues.length} issue{analysis.issues.length !== 1 ? 's' : ''} found
                  </Badge>
                )}
                <Badge variant="outline" className="font-mono text-xs">
                  {diff.split('\n').length} lines
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground mr-2">Filters:</span>
              <Button
                variant={showAdded ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAdded(!showAdded)}
                className="h-7 text-xs"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></div>
                Added
              </Button>
              <Button
                variant={showRemoved ? "default" : "outline"}
                size="sm"
                onClick={() => setShowRemoved(!showRemoved)}
                className="h-7 text-xs"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 mr-1.5"></div>
                Removed
              </Button>
              <Button
                variant={showContext ? "default" : "outline"}
                size="sm"
                onClick={() => setShowContext(!showContext)}
                className="h-7 text-xs"
              >
                <div className="w-2 h-2 rounded-full bg-slate-500 mr-1.5"></div>
                Context
              </Button>
            </div>
            <div className="overflow-auto max-h-[600px] border rounded-lg bg-slate-950 dark:bg-slate-900 relative">
              <div className="sticky top-0 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-800 dark:border-slate-700 px-4 py-2 flex items-center gap-4 text-xs text-slate-400 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded border border-green-500/50 bg-green-950/30"></div>
                  <span>Added</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded border border-red-500/50 bg-red-950/30"></div>
                  <span>Removed</span>
                </div>
                {analysis && analysis.issues.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded border-2 border-yellow-500 bg-yellow-500/20"></div>
                    <span>Security Issue</span>
                  </div>
                )}
              </div>
              <div className="p-4 font-mono text-xs leading-relaxed">
                {diff.split('\n').map((line, index) => {
                  // Check if this line has a security issue
                  const lineNumber = index + 1;
                  const hasIssue = analysis?.issues.some(issue => 
                    issue.lineNumber === lineNumber || 
                    (issue.filePath && line.includes(issue.filePath))
                  );
                  const issue = analysis?.issues.find(issue => 
                    issue.lineNumber === lineNumber || 
                    (issue.filePath && line.includes(issue.filePath))
                  );
                  
                  // Parse diff lines
                  if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) {
                    // File header lines
                    return (
                      <div key={index} className="text-cyan-400 dark:text-cyan-300 py-1 border-b border-slate-800 dark:border-slate-700">
                        {line}
                      </div>
                    );
                  } else if (line.startsWith('@@')) {
                    // Hunk header
                    return (
                      <div key={index} className="text-blue-400 dark:text-blue-300 py-2 font-semibold bg-slate-900/50 dark:bg-slate-800/50">
                        {line}
                      </div>
                    );
                  } else if (line.startsWith('+') && !line.startsWith('+++')) {
                    // Added line
                    if (!showAdded) return null;
                    const issueClass = hasIssue && issue && issue.severity === 'high' 
                      ? 'bg-yellow-950/40 dark:bg-yellow-900/20 border-yellow-500/70 ring-2 ring-yellow-500/30' 
                      : hasIssue 
                      ? 'bg-yellow-950/20 dark:bg-yellow-900/10 border-yellow-500/50' 
                      : 'bg-green-950/20 dark:bg-green-900/10 border-green-500/50';
                    return (
                      <div 
                        key={index} 
                        className={`text-green-400 dark:text-green-300 ${issueClass} py-0.5 px-2 border-l-2 relative group`}
                        title={issue ? `${issue.severity.toUpperCase()}: ${issue.category} - ${issue.description}` : undefined}
                      >
                        <span className="text-green-500/70 mr-2 select-none">+</span>
                        <span className="whitespace-pre">{line.substring(1)}</span>
                        {hasIssue && issue && (
                          <div className="absolute right-2 top-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Badge 
                              variant={issue.severity === 'high' ? 'destructive' : issue.severity === 'medium' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {issue.severity}
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                    // Removed line
                    if (!showRemoved) return null;
                    return (
                      <div key={index} className="text-red-400 dark:text-red-300 bg-red-950/20 dark:bg-red-900/10 py-0.5 px-2 border-l-2 border-red-500/50">
                        <span className="text-red-500/70 mr-2 select-none">-</span>
                        <span className="whitespace-pre">{line.substring(1)}</span>
                      </div>
                    );
                  } else if (line.startsWith(' ')) {
                    // Context line
                    if (!showContext) return null;
                    return (
                      <div key={index} className="text-slate-400 dark:text-slate-500 py-0.5 px-2">
                        <span className="text-slate-600 dark:text-slate-700 mr-2 select-none"> </span>
                        <span className="whitespace-pre">{line.substring(1)}</span>
                      </div>
                    );
                  } else {
                    // Other lines (metadata, etc.)
                    return (
                      <div key={index} className="text-slate-500 dark:text-slate-600 py-0.5 px-2 italic">
                        {line}
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stream-aware loading state - show loading only if no data has arrived yet */}
      {isAnalyzing && !object?.summary && (
        <Card>
          <CardContent className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg animate-pulse">
            <div className="text-center">
              <div className="text-lg font-medium text-blue-600 dark:text-blue-400">
                🤖 Gemini is scanning your code...
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Identifying vulnerabilities in real-time
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show summary and issues as they stream in */}
      {object?.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-blue-600 dark:text-blue-400">🤖 AI Analysis</span>
              {isAnalyzing && (
                <span className="text-xs text-blue-500 animate-pulse">● Streaming</span>
              )}
            </CardTitle>
            <CardDescription>
              {isAnalyzing ? "Analyzing code in real-time..." : "Analysis complete"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-blue-600 dark:text-blue-400">
                <p className="font-semibold mb-2">Summary:</p>
                <p>{object.summary}</p>
              </div>
              
              {/* Show issues as they appear during streaming */}
              {object.issues && object.issues.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2 text-sm text-muted-foreground">
                    Issues Found: {object.issues.length}
                    {isAnalyzing && " (streaming...)"}
                  </p>
                  <div className="space-y-2">
                    {object.issues.map((issue: any, index: number) => (
                      <div key={index} className="p-2 bg-muted rounded text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{issue?.category ?? "Unknown"}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            issue?.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                            issue?.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }`}>
                            {issue?.severity ?? 'low'}
                          </span>
                        </div>
                        {issue?.description && (
                          <p className="mt-1 text-muted-foreground">{issue.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span>Security Scoreboard</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">(AI Generated)</span>
                </CardTitle>
                <Badge variant={getRiskColor(analysis.overallRisk)}>
                  {analysis.overallRisk.toUpperCase()} Risk
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{analysis.statistics.totalIssues}</div>
                  <div className="text-sm text-muted-foreground">Total Issues</div>
                </div>
                <div className="text-center p-4 bg-destructive/10 rounded-lg">
                  <div className="text-2xl font-bold text-destructive">
                    {analysis.statistics.highRisk}
                  </div>
                  <div className="text-sm text-muted-foreground">High Risk</div>
                </div>
                <div className="text-center p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {analysis.statistics.mediumRisk}
                  </div>
                  <div className="text-sm text-muted-foreground">Medium Risk</div>
                </div>
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold">{analysis.statistics.lowRisk}</div>
                  <div className="text-sm text-muted-foreground">Low Risk</div>
                </div>
              </div>
              <div className="prose prose-sm max-w-none">
                <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 p-4 rounded-r-md">
                  <h3 className="text-purple-700 dark:text-purple-300 font-semibold mb-2 text-sm uppercase tracking-wide">
                    AI Summary
                  </h3>
                  <div className="text-purple-800 dark:text-purple-200">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="text-purple-800 dark:text-purple-200 mb-2">{children}</p>,
                        strong: ({ children }) => <strong className="text-purple-900 dark:text-purple-100 font-semibold">{children}</strong>,
                        code: ({ children }) => <code className="text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-1 rounded">{children}</code>,
                      }}
                    >
                      {analysis.summary}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Security Issues</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">(AI Detected)</span>
              </CardTitle>
              <CardDescription>Detailed breakdown of identified vulnerabilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.issues.map((issue, index) => (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getSeverityColor(issue.severity)}>
                            {issue.severity}
                          </Badge>
                          <span className="font-semibold">{issue.category}</span>
                        </div>
                        {issue.filePath && (
                          <div className="text-sm text-muted-foreground">
                            {issue.filePath}
                            {issue.lineNumber && `:${issue.lineNumber}`}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">AI Finding: </span>
                      {issue.description}
                    </div>
                    {issue.recommendation && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 rounded-md">
                        <p className="text-sm font-semibold mb-1 text-emerald-700 dark:text-emerald-300">AI Recommendation:</p>
                        <p className="text-sm text-emerald-800 dark:text-emerald-200">{issue.recommendation}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
