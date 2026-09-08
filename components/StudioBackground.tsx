"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { BackdropGate } from "../hooks/useBackdropGate";
import type { BackgroundMode } from "../types/studio";

// Ba nền động của React Bits kéo theo ogl hoặc three, nên chỉ tải khi người dùng thật sự chọn.
// Cả ba đều dựng WebGL trong useEffect nên không dựng sẵn phía máy chủ.
const MoltenMetal = dynamic(() => import("./backgrounds/MoltenMetal"), { ssr: false });
const GradientWaves = dynamic(() => import("./backgrounds/GradientWaves"), { ssr: false });
const LiquidEther = dynamic(() => import("./backgrounds/LiquidEther"), { ssr: false });

/**
 * Bảng màu chỉnh theo tông xanh rêu của giao diện (app/globals.css) thay cho tím hồng mặc định
 * của React Bits. Muốn đổi tông nền chỉ cần sửa các hằng số trong khối này.
 */
const palettes = {
  molten: { shadow: "#1d3326", mid: "#6f8f63", highlight: "#dfe8cf" },
  waves: { horizon: "#26382c", wave: "#6d8a6f", crest: "#cfdcbd" },
  liquid: ["#2f4a38", "#7d9a6c", "#c3d2b1"],
};

/** WebGL hỏng giữa chừng thì bỏ nền đi, thay vì để lỗi làm sập cả trang. */
class BackdropBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

type StudioBackgroundProps = {
  mode: BackgroundMode;
  gate: BackdropGate;
  /** Tắt hẳn nền lúc ghi hình để nhường GPU cho canvas dựng bản ghi. */
  paused: boolean;
};

export function StudioBackground({ mode, gate, paused }: StudioBackgroundProps) {
  if (mode === "default" || paused || gate !== "ready") return null;
  return (
    <div className="studio-backdrop" aria-hidden="true">
      {/* Đổi nền là dựng lại từ đầu, đồng thời xóa trạng thái hỏng của lần trước. */}
      <BackdropBoundary key={mode}>
        {mode === "molten" && <MoltenMetal
          color1={palettes.molten.shadow} color2={palettes.molten.mid} color3={palettes.molten.highlight}
          speed={.22} scale={3.4} glow={1.5} brightness={1.15} opacity={.5} mouseStrength={.22} grainIntensity={.04} />}
        {mode === "waves" && <GradientWaves
          horizonColor={palettes.waves.horizon} waveColor={palettes.waves.wave} crestColor={palettes.waves.crest}
          speed={.28} amplitude={2.5} fogDepth={20} detail="medium" brightness={.95} opacity={.6} parallaxStrength={.35} grainIntensity={.04} />}
        {mode === "liquid" && <LiquidEther
          colors={palettes.liquid} resolution={.4} cursorSize={120} mouseForce={16} autoSpeed={.35} autoIntensity={1.8} />}
      </BackdropBoundary>
    </div>
  );
}
