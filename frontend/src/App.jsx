import { useState, useEffect } from "react";
import axios from "axios";
import mermaid from "mermaid";
import "./App.css";

mermaid.initialize({ startOnLoad: false });

function App() {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diagramOk, setDiagramOk] = useState(false);
  const [diagramError, setDiagramError] = useState("");

  useEffect(() => {
    if (!result?.diagram_mermaid) {
      setDiagramOk(false);
      setDiagramError("");
      return;
    }
    try {
      mermaid.parse(result.diagram_mermaid);
      setDiagramOk(true);
      setDiagramError("");
      requestAnimationFrame(() => {
        mermaid.init(undefined, ".mermaid");
        const svgs = document.querySelectorAll(".mermaid svg");
        svgs.forEach((svg) => {
          svg.style.width = "100%";
          svg.style.height = "auto";
          svg.style.maxHeight = "480px";
          svg.style.background = "#ffffff";
          svg.style.borderRadius = "16px";
        });
      });
    } catch (e) {
      console.error("Mermaid parse error", e);
      setDiagramOk(false);
      setDiagramError("The model produced Mermaid code that could not be rendered.");
    }
  }, [result?.diagram_mermaid]);

  const handleAsk = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setDiagramOk(false);
    setDiagramError("");
    try {
      const res = await axios.post("http://localhost:8000/api/concept", {
        topic,
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError("Request failed. Make sure the FastAPI backend is running on :8000.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 16px",
        background:
          "radial-gradient(circle at top, #111827 0%, #020617 45%, #000000 100%)",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          background: "rgba(15,23,42,0.95)",
          borderRadius: 24,
          padding: 32,
          boxShadow:
            "0 24px 60px rgba(15,23,42,0.9), 0 0 0 1px rgba(148,163,184,0.15)",
          border: "1px solid rgba(148,163,184,0.3)",
          backdropFilter: "blur(18px)",
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#a5b4fc",
              marginBottom: 8,
            }}
          >
            ScholarViz
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: "#f9fafb",
              marginBottom: 8,
            }}
          >
            Cybersecurity Concept Explorer
          </h1>
          <p style={{ fontSize: 14, color: "#9ca3af", maxWidth: 640 }}>
            Type a cybersecurity topic and ScholarViz will generate a clear
            explanation, a structured diagram you can actually read, and recent
            scholarly citations.
          </p>
        </header>

        <section
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. LLM jailbreaks and prompt injection, SIEM pipeline, zero trust architecture"
            style={{
              flex: 1,
              minWidth: 260,
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.5)",
              backgroundColor: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={handleAsk}
            disabled={loading}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: "none",
              background:
                "linear-gradient(to right, #4f46e5, #7c3aed, #ec4899)",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Analyzing…" : "Generate"}
          </button>
        </section>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(127,29,29,0.85)",
              color: "#fee2e2",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {result && result.ok && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 5fr) minmax(0, 5fr)",
              gap: 24,
              alignItems: "stretch",
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  marginBottom: 8,
                }}
              >
                {result.topic}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#d1d5db",
                  whiteSpace: "pre-wrap",
                }}
              >
                {result.explanation}
              </p>

              <div style={{ marginTop: 24 }}>
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#e5e7eb",
                    marginBottom: 8,
                  }}
                >
                  Recent scholarly sources
                </h3>
                {result.citations && result.citations.length > 0 ? (
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 13,
                      color: "#cbd5f5",
                    }}
                  >
                    {result.citations.map((c, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        <div style={{ fontWeight: 500 }}>
                          {c.title}{" "}
                          {c.year ? (
                            <span style={{ color: "#9ca3af" }}>({c.year})</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>
                          {c.authors}
                          {c.venue ? ` · ${c.venue}` : ""}
                          {typeof c.cited_by_count === "number"
                            ? ` · cited ${c.cited_by_count}×`
                            : ""}
                        </div>
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 12,
                              color: "#4f46e5",
                              textDecoration: "underline",
                            }}
                          >
                            view paper
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#9ca3af",
                      margin: 0,
                    }}
                  >
                    No citations found for this topic.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e5e7eb",
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                Diagram
              </h3>
              {diagramOk && result.diagram_mermaid ? (
                <div
                  className="mermaid"
                  style={{
                    backgroundColor: "#f9fafb",
                    borderRadius: 20,
                    padding: 20,
                    border: "1px solid rgba(15,23,42,0.12)",
                    overflowX: "auto",
                    minHeight: 360,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#020617",
                  }}
                >
                  {result.diagram_mermaid}
                </div>
              ) : result.diagram_mermaid && diagramError ? (
                <div
                  style={{
                    fontSize: 13,
                    color: "#f87171",
                    background: "rgba(127,29,29,0.5)",
                    borderRadius: 12,
                    padding: 10,
                  }}
                >
                  {diagramError}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: 13,
                    color: "#9ca3af",
                  }}
                >
                  No diagram available for this query.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
