function extractNodes(mermaidText) {
  const src = String(mermaidText || "");
  const re = /[A-Za-z0-9_]+\[([^\]]+)\]/g;
  const labels = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(src)) !== null) {
    const lab = (m[1] || "").trim();
    if (lab && !seen.has(lab)) {
      seen.add(lab);
      labels.push(lab);
    }
  }
  if (!labels.length) {
    return [{ title: "Diagram not parsed", note: "No node labels were found in the Mermaid text." }];
  }
  return labels.map((lab, i) => ({
    title: `Step ${i + 1}: ${lab}`,
    note: `Focus on the node "${lab}". Explain what it does in the security flow.`,
  }));
}

export function initLessonPlayer(options = {}) {
  const mermaidText =
    options.mermaid ||
    (typeof window !== "undefined" ? window.CURRENT_MERMAID : "") ||
    "";

  const frames = extractNodes(mermaidText);
  let idx = 0;

  const titleId = options.titleId || "lessonTitle";
  const noteId = options.noteId || "lessonNote";
  const prevId = options.prevId || "lessonPrev";
  const nextId = options.nextId || "lessonNext";
  const startId = options.startId || "lessonStart";

  const titleEl = document.getElementById(titleId);
  const noteEl = document.getElementById(noteId);
  const prevBtn = document.getElementById(prevId);
  const nextBtn = document.getElementById(nextId);
  const startBtn = document.getElementById(startId);

  if (!titleEl || !noteEl) {
    return;
  }

  function render() {
    const frame = frames[idx];
    titleEl.textContent = frame.title;
    noteEl.textContent = frame.note;
  }

  function go(delta) {
    idx = (idx + delta + frames.length) % frames.length;
    render();
  }

  if (prevBtn) {
    prevBtn.onclick = function () {
      go(-1);
    };
  }

  if (nextBtn) {
    nextBtn.onclick = function () {
      go(1);
    };
  }

  if (startBtn) {
    startBtn.onclick = function () {
      idx = 0;
      render();
    };
  }

  render();
}
