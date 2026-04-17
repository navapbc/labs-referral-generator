import { NextResponse } from "next/server";
import { LOCATION_FETCH_TIMEOUT } from "@/config/timeouts";

interface FCCCounty {
  FIPS: string;
  name: string;
}

interface FCCState {
  FIPS: string;
  code: string;
  name: string;
}

export interface FCCResponse {
  status: string;
  County?: FCCCounty;
  State?: FCCState;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = searchParams.get("latitude");
  const longitude = searchParams.get("longitude");

  if (!latitude || !longitude) {
    const missingParams: string[] = [];
    if (!latitude) missingParams.push("latitude");
    if (!longitude) missingParams.push("longitude");

    const errorMessage =
      missingParams.length === 1
        ? `Missing parameter: ${missingParams[0]}`
        : `Missing parameters: ${missingParams.join(", ")}`;

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      format: "json",
      latitude,
      longitude,
    });

    const fccUrl = `https://geo.fcc.gov/api/census/block/find?${params.toString()}`;

    const fccResponse = await fetch(fccUrl, {
      signal: AbortSignal.timeout(LOCATION_FETCH_TIMEOUT),
    });
    if (!fccResponse.ok) {
      return NextResponse.json(
        { error: "FCC API request failed" },
        { status: fccResponse.status },
      );
    }

    const fccData = (await fccResponse.json()) as FCCResponse;

    // Strip " County" suffix from county name if present, for consistency
    if (fccData.County?.name) {
      fccData.County.name = fccData.County.name.replace(/ County$/i, "");
    }

    return NextResponse.json(fccData);
  } catch (error) {
    console.error("Error fetching from FCC API:", error);
    return NextResponse.json(
      { error: "Failed to fetch from FCC API" },
      { status: 500 },
    );
  }
}
