import { ImageResponse } from "next/og";
import { site } from "@/lib/content";

export const alt = "Daniel Ariel — Senior AI Consultant & Senior Frontend Developer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0A0A0A",
          color: "#EDEDED",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#34D399", marginBottom: 24 }}>
          danielariel — Berlin
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>{site.name}</div>
        <div style={{ display: "flex", fontSize: 34, color: "#8F8F94", marginTop: 24 }}>
          Senior AI Consultant &amp; Senior Frontend Developer
        </div>
        <div
          style={{ display: "flex", width: 160, height: 6, background: "#34D399", marginTop: 40 }}
        />
      </div>
    ),
    size
  );
}
