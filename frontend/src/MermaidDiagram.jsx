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

    const id = "mermaid-" + Math.random().toString(36).slice(2, 9);
    const el = containerRef.current;
    el.innerHTML = `<div class="mermaid" id="${id}">${chart}</div>`;

    try {
      mermaid.init(undefined, el.querySelectorAll(".mermaid"));
    } catch (e) {
      console.error("Mermaid render error:", e);
      el.innerHTML = "<p>Diagram could not be rendered.</p>";
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
