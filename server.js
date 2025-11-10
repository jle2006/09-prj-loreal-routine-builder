// Minimal Node server (no external libs). Requires Node 18+ for global fetch.
const http = require("http");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_KEY) {
  console.error(
    "Set OPENAI_API_KEY environment variable before running server."
  );
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/openai") {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { messages } = JSON.parse(body);

      // Forward to OpenAI Chat Completions
      const openaiRes = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o", // or whichever model you want
            messages,
            max_tokens: 500,
          }),
        }
      );

      const data = await openaiRes.json();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error("Server error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    // 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
# macOS / Linux
export OPENAI_API_KEY="https://loreal-chatbot.lejenna737.workers.dev/"
node server.js