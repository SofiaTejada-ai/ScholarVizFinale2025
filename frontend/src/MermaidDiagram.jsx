import { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
});

function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!chart || !containerRef.current) return;

    const el = containerRef.current;
    const id = "mermaid-" + Math.random().toString(36).slice(2, 9);

    try {
      if (typeof mermaid.parse === "function") {
        mermaid.parse(chart);
      } else if (
        mermaid.mermaidAPI &&
        typeof mermaid.mermaidAPI.parse === "function"
      ) {
        mermaid.mermaidAPI.parse(chart);
      }
    } catch (e) {
      console.error("Mermaid syntax error:", e);
      el.innerHTML =
        "<div style='padding:12px;font-size:13px;color:#e5e7eb;'>Diagram could not be rendered from the generated Mermaid description.</div>";
      return;
    }

    el.innerHTML = `<div class="mermaid" id="${id}">${chart}</div>`;

    try {
      mermaid.init(undefined, el.querySelectorAll(".mermaid"));
    } catch (e) {
      console.error("Mermaid render error:", e);
      el.innerHTML =
        "<div style='padding:12px;font-size:13px;color:#e5e7eb;'>Diagram could not be rendered.</div>";
    }
  }, [chart]);

  if (!chart) return null;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        minHeight: "260px",
        borderRadius: "18px",
        padding: "16px",
        background: "#020617",
        overflow: "auto",
      }}
    />
  );
}

export default MermaidDiagram;
