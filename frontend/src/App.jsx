import { useState } from "react";
import axios from "axios";
import MermaidDiagram from "./MermaidDiagram";

function App() {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showFigureSummary, setShowFigureSummary] = useState(false);

  const handleAnalyze = async () => {
    setError("");
    setResult(null);
    setShowFigureSummary(false);
    if (!topic.trim()) return;

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:8000/api/concept", {
        topic,
      });
      setResult(res.data);
    } catch (e) {
      console.error(e);
      setError("Request failed. Make sure the FastAPI backend is running on :8000.");
    } finally {
      setLoading(false);
    }
  };

  const citations = result?.citations || [];
  const hasFigure = !!result?.figure_image_url;
  const hasMermaid = !!result?.diagram_mermaid;

  return (
    <div
      style={{
        minHeight: "100vh",
        margin: 0,
        padding: "32px 0",
        background: "radial-gradient(circle at top, #1e293b 0, #020617 55%, #000 100%)",
        color: "#e5e7eb",
        fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: "1120px",
          margin: "0 auto",
          padding: "0 20px",
        }}
      >
        <header style={{ marginBottom: 32, textAlign: "center" }}>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "#64748b",
              marginBottom: 8,
            }}
          >
            ScholarViz
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Cybersecurity Concept Explorer
          </h1>
          <p style={{ fontSize: 14, color: "#94a3b8" }}>
            Type a cybersecurity topic and ScholarViz will generate a clear explanation,
            a visual diagram or extracted figure, and recent scholarly citations.
          </p>
        </header>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 24,
            background: "rgba(15,23,42,0.9)",
            borderRadius: 999,
            padding: "8px 10px 8px 16px",
            border: "1px solid rgba(148,163,184,0.24)",
          }}
        >
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Zero trust architectures for microservices"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: "#e5e7eb",
              fontSize: 14,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAnalyze();
            }}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#f9fafb",
              background:
                "linear-gradient(135deg, rgba(96,165,250,1), rgba(14,165,233,1))",
              boxShadow: "0 10px 25px rgba(37,99,235,0.35)",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Analyzing..." : "Analyze Concept"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: "10px 14px",
              borderRadius: 12,
              background: "rgba(127,29,29,0.2)",
              color: "#fecaca",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {result && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
              gap: 20,
              alignItems: "flex-start",
            }}
          >
            <section
              style={{
                background: "rgba(15,23,42,0.96)",
                borderRadius: 20,
                padding: 20,
                border: "1px solid rgba(148,163,184,0.22)",
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 6,
                }}
              >
                Summary
              </h2>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#cbd5f5",
                  whiteSpace: "pre-wrap",
                }}
              >
                {result.summary}
              </p>
            </section>

            <section
              style={{
                background: "rgba(15,23,42,0.96)",
                borderRadius: 20,
                padding: 20,
                border: "1px solid rgba(148,163,184,0.22)",
              }}
            >
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                Diagrams
              </h2>

              {hasFigure || hasMermaid ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: hasFigure && hasMermaid ? "1fr 1fr" : "1fr",
                    gap: 12,
                    alignItems: "stretch",
                  }}
                >
                  {hasFigure && (
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          marginBottom: 6,
                          color: "#e5e7eb",
                        }}
                      >
                        Research figure
                      </div>
                      <div
                        style={{
                          borderRadius: 18,
                          overflow: "hidden",
                          background: "#020617",
                          border: "1px solid rgba(148,163,184,0.3)",
                        }}
                      >
                        <img
                          src={result.figure_image_url}
                          alt={result.figure_caption || "Extracted research figure"}
                          style={{
                            display: "block",
                            width: "100%",
                            height: "auto",
                          }}
                        />
                      </div>
                      {result.figure_caption && (
                        <p
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: "#9ca3af",
                          }}
                        >
                          {result.figure_caption}
                        </p>
                      )}

                      {result.figure_summary && (
                        <div
                          style={{
                            marginTop: 10,
                          }}
                        >
                          <button
                            onClick={() =>
                              setShowFigureSummary((prev) => !prev)
                            }
                            style={{
                              border: "none",
                              borderRadius: 999,
                              padding: "6px 14px",
                              fontSize: 13,
                              fontWeight: 500,
                              color: "#0f172a",
                              background:
                                "linear-gradient(135deg, rgba(248,250,252,1), rgba(226,232,240,1))",
                              cursor: "pointer",
                            }}
                          >
                            Summary
                          </button>
                          {showFigureSummary && (
                            <p
                              style={{
                                marginTop: 8,
                                fontSize: 13,
                                lineHeight: 1.6,
                                color: "#cbd5f5",
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {result.figure_summary}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {hasMermaid && (
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          marginBottom: 6,
                          color: "#e5e7eb",
                        }}
                      >
                        Mermaid architecture view
                      </div>
                      <MermaidDiagram chart={result.diagram_mermaid} />
                      {!hasFigure && (
                        <p
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: "#94a3b8",
                          }}
                        >
                          No strongly relevant research figure was found for this topic,
                          so a Mermaid diagram was generated instead.
                        </p>
                      )}
                    </div>
                  )}
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
            </section>
          </div>
        )}

        {result && citations.length > 0 && (
          <section
            style={{
              marginTop: 20,
              background: "rgba(15,23,42,0.96)",
              borderRadius: 20,
              padding: 20,
              border: "1px solid rgba(148,163,184,0.22)",
            }}
          >
            <h2
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              Most recent citations
            </h2>
            <ol style={{ paddingLeft: 18, fontSize: 14 }}>
              {citations.map((c, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <strong>{c.title}</strong>
                  {c.year && ` (${c.year})`}
                  {c.venue && (
                    <span>
                      {" "}
                      · <em>{c.venue}</em>
                    </span>
                  )}
                  <br />
                  {c.authors && (
                    <span style={{ color: "#9ca3af" }}>{c.authors}</span>
                  )}
                  {c.url && (
                    <div>
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 13, color: "#60a5fa" }}
                      >
                        link
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
