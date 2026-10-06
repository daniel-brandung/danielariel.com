import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/lib/content";

export const alt = "Daniel Ariel — Senior AI Consultant & Senior Frontend Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#1A1C2B";
const SLATE = "#5A5F73";
const REDLINE = "#D42A62";

export default async function OgImage() {
  const photo = await readFile(join(process.cwd(), "public/daniel-ariel.jpg"), "base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 72,
          padding: "0 80px",
          background: "#FFFFFF",
          color: INK,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 18,
              color: REDLINE,
              border: `1px solid ${REDLINE}`,
              borderRadius: 4,
              padding: "6px 10px",
              marginBottom: 22,
            }}
          >
            danielariel.com
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 80,
              fontWeight: 700,
              letterSpacing: -2,
              padding: "2px 14px",
              border: `2px dashed ${REDLINE}`,
            }}
          >
            {site.name}
          </div>
          <div style={{ display: "flex", fontSize: 32, marginTop: 28 }}>
            {"Senior AI Consultant & Senior Frontend Developer"}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: SLATE, marginTop: 14 }}>
            {site.tagline}
          </div>
        </div>
        <img
          src={`data:image/jpeg;base64,${photo}`}
          alt=""
          width={336}
          height={420}
          style={{ borderRadius: 6, objectFit: "cover" }}
        />
      </div>
    ),
    size
  );
}
