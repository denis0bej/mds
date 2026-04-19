import { useState } from "react";

const TestAI = () => {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setResponse("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: prompt, state: {} }),
      });
      const data = await res.json();
      setResponse(data.response);
    } catch (err) {
      setResponse("Eroare la apel.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Test AI</h1>
      <textarea
        rows={4}
        style={{ width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
        placeholder="Scrie ceva..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <br />
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Se încarcă..." : "Trimite"}
      </button>
      {response && (
        <div style={{ marginTop: "2rem", whiteSpace: "pre-wrap" }}>
          <strong>Răspuns:</strong>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
};

export default TestAI;