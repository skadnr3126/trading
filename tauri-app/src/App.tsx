import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

type PythonResponse = {
  ok: boolean;
  message?: string;
  result?: number;
  error?: string;
};

function App() {
  const [left, setLeft] = useState("12");
  const [right, setRight] = useState("30");
  const [response, setResponse] = useState<PythonResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function callPython(action: "ping" | "add") {
    setError("");
    setLoading(true);

    try {
      const result = await invoke<PythonResponse>("call_python", {
        request: {
          action,
          left: Number(left),
          right: Number(right),
        },
      });
      setResponse(result);
    } catch (caughtError) {
      setResponse(null);
      setError(String(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <section className="card">
        <p className="eyebrow">Tauri → Rust → Python → Rust → Tauri</p>
        <h1>Python 실행 흐름 예제</h1>
        <p className="description">
          버튼을 누르면 Rust가 Python을 실행하고 JSON을 전달합니다. Python의 JSON 응답이 다시 이 화면에 표시됩니다.
        </p>

        <div className="actions">
          <button disabled={loading} onClick={() => callPython("ping")}>
            Python 연결 확인
          </button>
        </div>

        <div className="number-row">
        <input
          type="number"
          value={left}
          onChange={(event) => setLeft(event.currentTarget.value)}
          aria-label="첫 번째 숫자"
        />
          <span>+</span>
          <input
            type="number"
            value={right}
            onChange={(event) => setRight(event.currentTarget.value)}
            aria-label="두 번째 숫자"
          />
          <button disabled={loading} onClick={() => callPython("add")}>
            Python으로 더하기
          </button>
        </div>

        <div className="response">
          <strong>Python 응답</strong>
          {loading && <p>Python을 실행하는 중…</p>}
          {error && <pre className="error">{error}</pre>}
          {response && <pre>{JSON.stringify(response, null, 2)}</pre>}
          {!loading && !error && !response && <p>아직 응답이 없습니다.</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
