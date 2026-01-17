import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";
import { GITHUB_KEY } from "@/lib/config";

const octokit = new Octokit({
  auth: GITHUB_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prUrl } = await request.json();

    if (!prUrl) {
      return NextResponse.json(
        { error: "PR URL is required" },
        { status: 400 }
      );
    }

    // Parse GitHub PR URL: https://github.com/owner/repo/pull/123
    const prUrlPattern = /github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
    const match = prUrl.match(prUrlPattern);

    if (!match) {
      return NextResponse.json(
        { error: "Invalid GitHub PR URL format" },
        { status: 400 }
      );
    }

    const [, owner, repo, pullNumber] = match;

    // Fetch PR diff
    const diffUrl = `https://github.com/${owner}/${repo}/pull/${pullNumber}.diff`;
    const diffResponse = await fetch(diffUrl);

    if (!diffResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch PR diff. Make sure the PR is publicly accessible." },
        { status: diffResponse.status }
      );
    }

    const diff = await diffResponse.text();

    // Fetch PR details for metadata
    const prResponse = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: parseInt(pullNumber),
    });

    return NextResponse.json({
      diff,
      pr: {
        title: prResponse.data.title,
        number: prResponse.data.number,
        author: prResponse.data.user?.login,
        url: prResponse.data.html_url,
        owner,
        repo,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch PR diff";
    console.error("Error fetching GitHub diff:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
