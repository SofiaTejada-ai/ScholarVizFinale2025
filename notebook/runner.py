from dataclasses import dataclass
from typing import Dict, Any, List


@dataclass
class NotebookResult:
    artifacts: Dict[str, Any]


class NotebookRunner:
    def __init__(self, timeout_s: int = 10):
        self.timeout_s = timeout_s

    def run(self, cells: List[str]) -> NotebookResult:
        ns: Dict[str, Any] = {"ARTIFACTS": {}}
        for code in cells:
            exec(code, ns, ns)
        artifacts = ns.get("ARTIFACTS", {})
        if not isinstance(artifacts, dict):
            artifacts = {}
        return NotebookResult(artifacts=artifacts)

    def stop(self) -> None:
        return
