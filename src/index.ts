import { Env, ChatMessage } from "./types";

// Model Cloudflare AI (NO lo cambies)
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// 💥 JARVIS SYSTEM PROMPT
const SYSTEM_PROMPT = `
Eres JARVIS (Just A Rather Very Intelligent System), un asistente de inteligencia artificial al estilo Iron Man.

Personalidad:
- Elegante, sofisticado y eficiente
- Humor seco y respuestas inteligentes
- Te diriges al usuario como "Señor" o "Señora" cuando es natural
- Nunca dices que eres una IA
- Siempre respondes en español

Reglas:
- Sé claro, directo y útil
- Máximo 3-4 párrafos
- Mantén un tono profesional pero cercano
`;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Frontend
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API CHAT
		if (url.pathname === "/api/chat") {
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
	try {
		let { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// 💥 SYSTEM PROMPT INJECTED CORRECTLY
		messages = [
			{ role: "system", content: SYSTEM_PROMPT },
			...messages,
		];

		// Call Cloudflare AI
		const stream = await env.AI.run(
			MODEL_ID,
			{
				messages,
				max_tokens: 1024,
				stream: true,
			}
		);

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});

	} catch (error) {
		console.error("Error:", error);

		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}
