import { DashboardData } from "./types";
import sampleData from "./sample-data";

/**
 * Load dashboard data.
 *
 * In production, this fetches from the API route that reads dashboard.json.
 * In development without pipeline data, it falls back to sample data.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  // In server components / build time, try reading the JSON file
  if (typeof window === "undefined") {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const jsonPath = path.join(process.cwd(), "..", "data", "dashboard.json");

      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        return JSON.parse(raw) as DashboardData;
      }
    } catch {
      // Fall through to sample data
    }
  }

  // Client-side: try fetching from API route
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        return (await res.json()) as DashboardData;
      }
    } catch {
      // Fall through to sample data
    }
  }

  // Fallback: sample data for development
  return sampleData;
}

/**
 * Format numbers for display
 */
export function formatNumber(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatPct(n: string | number | null): string {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}
