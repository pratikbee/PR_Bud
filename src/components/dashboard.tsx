"use client";

import { useState } from "react";
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
  const [analysis, setAnalysis] = useState<SecurityAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleFetchPR = async () => {
    if (!prUrl.trim()) {
      setError("Please enter a GitHub PR URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDiff("");
    setAnalysis(null);

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

      // Automatically start analysis
      await startAnalysis(data.diff);
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
    setAnalysis(null);
    
    // Start analysis with the diff
    await startAnalysis(rawDiff);
  };

  const startAnalysis = async (diffToAnalyze: string) => {
    setAnalysis(null);
    setDiff(diffToAnalyze);
    setStreamingText("");
    setIsStreaming(true);
    setError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff: diffToAnalyze }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze code");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamingText(fullText);

        // Try to extract JSON from the stream
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.issues && Array.isArray(parsed.issues)) {
              setAnalysis(parsed);
            }
          } catch (e) {
            // Not valid JSON yet, continue streaming
          }
        }
      }

      // Final attempt to parse JSON after stream completes
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.issues && Array.isArray(parsed.issues)) {
            setAnalysis(parsed);
          }
        } catch (e) {
          // If JSON parsing fails, just display the text
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze code");
    } finally {
      setIsStreaming(false);
    }
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
                <Button type="submit" disabled={isStreaming}>
                  {isStreaming ? "Analyzing..." : "Analyze Diff"}
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
            <CardTitle>Code Diff</CardTitle>
            <CardDescription>Raw diff content being analyzed</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto max-h-[400px] p-4 bg-muted rounded-md text-sm font-mono">
              <code>{diff}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {(isStreaming || streamingText) && (
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis</CardTitle>
            <CardDescription>
              {isStreaming ? "Analyzing code in real-time..." : "Analysis complete"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{streamingText}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Security Scoreboard</CardTitle>
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
                <ReactMarkdown>{analysis.summary}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Issues</CardTitle>
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
                    <p className="text-sm">{issue.description}</p>
                    {issue.recommendation && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-semibold mb-1">Recommendation:</p>
                        <p className="text-sm">{issue.recommendation}</p>
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
