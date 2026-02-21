import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import sampleData from "@/lib/sample-data";

export async function GET() {
  // Try reading real pipeline data
  const dataPath = join(process.cwd(), "..", "data", "dashboard.json");

  if (existsSync(dataPath)) {
    try {
      const raw = readFileSync(dataPath, "utf-8");
      const data = JSON.parse(raw);
      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      });
    } catch (err) {
      console.error("Error reading dashboard.json:", err);
    }
  }

  // Fallback to sample data
  return NextResponse.json(sampleData, {
    headers: {
      "Cache-Control": "public, s-maxage=60",
      "X-Data-Source": "sample",
    },
  });
}
