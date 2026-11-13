"use client";

import { useEffect, useState } from "react";

const GALLOP_FRAMES = Array.from({ length: 10 }, (_, index) =>
  `/nouky-gallop/frame-${String(index).padStart(2, "0")}.webp`,
);

export default function NoukyRunningLoader() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let active = true;
    let timer;
    const images = GALLOP_FRAMES.map((src) => {
      const image = new Image();
      image.src = src;
      return image;
    });

    Promise.all(images.map((image) => image.decode().catch(() => {}))).then(() => {
      if (active) timer = window.setInterval(() => setFrame((current) => (current + 1) % GALLOP_FRAMES.length), 100);
    });

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="nouky-loading" role="status" aria-live="polite">
      <div className="nouky-loading-scene" aria-hidden="true">
        <div className="nouky-running-shadow" />
        <div className="nouky-running-sequence">
          <img alt="" className="nouky-gallop-frame" src={GALLOP_FRAMES[frame]} />
        </div>
      </div>
      <p className="nouky-loading-eyebrow">Nouky prend son élan</p>
      <h2>Ton QCM arrive bientôt…</h2>
      <p>Il prépare une série adaptée à ta matière.</p>
    </div>
  );
}
