import { ImageResponse } from "next/og";
import { PALETTE } from "@beacon/core";

export const alt =
  "43% of public subagents declare no tools list and silently inherit everything, including Bash.";
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
            fontSize: "26px",
            fontWeight: 600,
            color: PALETTE.fog,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: "18px",
          }}
        >
          The State of Claude Code Agents &amp; Commands
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "220px",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            color: PALETTE.fail,
          }}
        >
          43%
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "38px",
            fontWeight: 700,
            lineHeight: 1.25,
            color: PALETTE.foam,
            maxWidth: "980px",
            marginTop: "18px",
          }}
        >
          of public subagents declare no tools list — silently inheriting everything, including Bash
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            color: PALETTE.fog,
            marginTop: "40px",
          }}
        >
          Skill Crossroads — skillcrossroads.com
        </div>
      </div>
    ),
    { ...size }
  );
}
