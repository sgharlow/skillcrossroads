import { ImageResponse } from "next/og";
import { PALETTE } from "@beacon/core";

export const alt = "Skill Crossroads — Know before you ship.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: PALETTE.ink,
          backgroundImage: `linear-gradient(160deg, ${PALETTE.ink} 0%, ${PALETTE.ink2} 100%)`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "36px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              backgroundColor: PALETTE.beam,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: "30px",
              fontWeight: 700,
              color: PALETTE.foam,
              letterSpacing: "-0.01em",
            }}
          >
            Skill Crossroads
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "68px",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: PALETTE.foam,
            maxWidth: "980px",
          }}
        >
          Every skill hits a crossroads before you ship it.
        </div>
        <div
          style={{
            display: "flex",
            gap: "22px",
            marginTop: "44px",
          }}
        >
          <div style={{ display: "flex", fontSize: "26px", fontWeight: 700, color: PALETTE.pass }}>Ship</div>
          <div style={{ display: "flex", fontSize: "26px", fontWeight: 700, color: PALETTE.warn }}>Fix</div>
          <div style={{ display: "flex", fontSize: "26px", fontWeight: 700, color: PALETTE.fail }}>Rethink</div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            color: PALETTE.fog,
            marginTop: "40px",
          }}
        >
          skillcrossroads.com
        </div>
      </div>
    ),
    { ...size }
  );
}
