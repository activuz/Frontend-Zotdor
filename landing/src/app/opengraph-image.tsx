import { ImageResponse } from "next/og";

// Social preview (Telegram, Facebook). Colors are the DESIGN.md tokens: page, ink, brand.
export const runtime = "edge";
export const alt = "Zotdor.uz — chorva mollari auksioni";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#eef2dc",
          color: "#1e3a0f",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 44 }}>
          Zotdor<span style={{ color: "#3d6b2e" }}>.uz</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, lineHeight: 1.05 }}>Chorvangizni auksionda soting</div>
          <div style={{ fontSize: 36, marginTop: 28, color: "#4a5e3a", fontFamily: "sans-serif" }}>
            Narxni xaridorlar belgilaydi, gʻolibni siz tanlaysiz
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#3d6b2e", fontFamily: "sans-serif" }}>
          web.zotdor.uz
        </div>
      </div>
    ),
    size,
  );
}
