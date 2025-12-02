import { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";

const outerStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f4f5fb",
  padding: "32px 16px",
  fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif",
};

const cardStyle = {
  width: "100%",
  maxWidth: "880px",
  background: "#ffffff",
  borderRadius: "16px",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
  padding: "28px 32px 32px",
};

const titleStyle = {
  fontSize: "1.9rem",
  fontWeight: 700,
  letterSpacing: "0.03em",
  margin: 0,
};

const subtitleStyle = {
  marginTop: "8px",
  fontSize: "0.95rem",
  color: "#6b7280",
};

const labelStyle = {
  fontSize: "0.85rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#6b7280",
};

const inputStyle = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #d1d5db",
  fontSize: "0.96rem",
  outline: "none",
};

const buttonStyle = {
  padding: "10px 18px",
  borderRadius: "999px",
  border: "none",
  background: "#111827",
  color: "white",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const buttonDisabledStyle = {
  ...buttonStyle,
  opacity: 0.6,
  cursor: "default",
};

const errorStyle = {
  marginTop: "10px",
  color: "#b91c1c",
  fontSize: "0.9rem",
};

const sectionTitleStyle = {
  fontSize: "1.2rem",
  fontWeight: 600,
  margin: "0 0 8px 0",
};

const explanationBoxStyle = {
  marginTop: "8px",
  padding: "16px 18px",
  borderRadius: "12px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  fontSize: "0.98rem",
  lineHeight: 1.6,
  color: "#111827",
};

const citationsTitleStyle = {
  marginTop: "24px",
  marginBottom: "8px",
  fontSize: "1rem",
  fontWeight: 600,
};

const citationListStyle = {
  margin: 0,
  paddingLeft: "20px",
  fontSize: "0.9rem",
  color: "#374151",
};

const citationItemStyle = {
  marginBottom: "8px",
};

function App() {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await axios.post("http://localhost:8000/api/concept", {
        topic: trimmed,
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={outerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>ScholarViz</h1>
        <p style={subtitleStyle}>
          Enter any cybersecurity or AI-security concept and get a concise,
          research-aware explanation with recent citations.
        </p>

        <div style={{ marginTop: 24 }}>
          <label style={labelStyle}>Concept or question</label>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAsk();
              }}
              placeholder="e.g. Large language model jailbreaks and prompt injection attacks"
              style={inputStyle}
            />
            <button
              onClick={handleAsk}
              style={loading ? buttonDisabledStyle : buttonStyle}
              disabled={loading}
            >
              {loading ? "Thinking..." : "Explain"}
            </button>
          </div>
          {error && <p style={errorStyle}>{error}</p>}
        </div>

        {result && result.ok && (
          <div style={{ marginTop: 32 }}>
            <h2 style={sectionTitleStyle}>{result.topic}</h2>
            <div style={explanationBoxStyle}>
              <ReactMarkdown>
                {result.combined_answer || result.summary}
              </ReactMarkdown>
            </div>

            {result.citations && result.citations.length > 0 && (
              <>
                <h3 style={citationsTitleStyle}>Most recent citations</h3>
                <ol style={citationListStyle}>
                  {result.citations.map((c, i) => (
                    <li key={i} style={citationItemStyle}>
                      <strong>{c.title}</strong>{" "}
                      {c.year ? `(${c.year})` : null}{" "}
                      {c.venue ? <em>· {c.venue}</em> : null}
                      <br />
                      {c.authors && <span>{c.authors}</span>}
                      <br />
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer">
                          link
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
