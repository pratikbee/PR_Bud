/**
 * Environment variables configuration
 * Exports environment variables from .env file
 */

export const GEMINI_KEY = process.env.GEMINI_KEY || '';
export const GITHUB_KEY = process.env.GITHUB_KEY || '';

// NextAuth configuration
export const AUTH_SECRET = process.env.AUTH_SECRET || '';
export const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
export const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

// Validate required environment variables
if (!GEMINI_KEY) {
  console.warn('GEMINI_KEY is not set in environment variables');
}

if (!GITHUB_KEY) {
  console.warn('GITHUB_KEY is not set in environment variables');
}
