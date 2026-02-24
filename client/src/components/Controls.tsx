import React from "react";
export function Controls(props: {
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  paused: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, padding: 12 }}>
      <button onClick={props.onPrev}>◀ Prev</button>
      <button onClick={props.onPlayPause}>{props.paused ? "▶ Play" : "⏸ Pause"}</button>
      <button onClick={props.onNext}>Next ▶</button>
    </div>
  );
}
