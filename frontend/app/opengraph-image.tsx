import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sightline – Free Website Performance Checker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #09090b 0%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: 80,
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(59,130,246,0.15)",
            border: "1px solid rgba(59,130,246,0.3)",
            borderRadius: 999,
            padding: "8px 20px",
            color: "#60a5fa",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 32,
          }}
        >
          Powered by Lighthouse v12 &amp; Gemini AI
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            background: "linear-gradient(90deg, #60a5fa, #34d399)",
            backgroundClip: "text",
            color: "transparent",
            lineHeight: 1.1,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Sightline
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: "#e4e4e7",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          Free Website Performance Checker
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 22,
            color: "#71717a",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Lighthouse scores · Web Vitals · Network Waterfall · AI Insights
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            fontSize: 18,
            color: "#3f3f46",
            letterSpacing: 1,
          }}
        >
          {(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sightline.page").replace("https://", "")}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
