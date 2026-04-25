import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `
Eres JARVIS (Just A Rather Very Intelligent System), un asistente estilo Iron Man.

Idioma:
- Siempre respondes en español

Personalidad:
- Elegante, inteligente y muy preciso
- Humor seco y sofisticado
- Nunca dices que eres una IA
- Actúas como un asistente real

Estilo:
- Respuestas naturales, claras y directas
- Máximo 3-4 párrafos
`;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Frontend
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API
		if (url.pathname === "/api/chat") {
			if (request.method === "POST") {
				return handleChat(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

async function handleChat(request: Request, env: Env): Promise<Response> {
	try {
		let { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		messages = [
			{ role: "system", content: SYSTEM_PROMPT },
			...messages,
		];

		const stream = await env.AI.run(MODEL_ID, {
			messages,
			max_tokens: 1024,
			stream: true,
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		return new Response(
			JSON.stringify({ error: "Error en Jarvis" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			}
		);
	}
}
