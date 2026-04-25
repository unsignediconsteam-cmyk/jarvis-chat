const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

/* =========================
   🧠 VOZ PRO SIN CORTES
========================= */

let voiceQueue = [];
let speaking = false;

function speakQueue(text) {
	if (!text) return;

	voiceQueue.push(text);
	if (!speaking) processQueue();
}

function processQueue() {
	if (voiceQueue.length === 0) {
		speaking = false;
		return;
	}

	speaking = true;

	const text = voiceQueue.shift();
	const u = new SpeechSynthesisUtterance(text);

	let voices = speechSynthesis.getVoices();

	const female =
		voices.find(v => v.lang === "es-ES" && /female|lucia|paula|monica/i.test(v.name)) ||
		voices.find(v => v.lang === "es-ES") ||
		voices[0];

	if (female) u.voice = female;

	u.lang = "es-ES";
	u.rate = 1.45;
	u.pitch = 1.3;

	u.onend = () => processQueue();

	speechSynthesis.speak(u);
}

/* =========================
   📦 ESTADO CHAT
========================= */

let chatHistory = [
	{
		role: "assistant",
		content: "Sistema JARVIS en línea.",
	},
];

let isProcessing = false;

/* =========================
   ✍️ INPUT
========================= */

userInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);

/* =========================
   🚀 ENVIAR MENSAJE REAL
========================= */

async function sendMessage(textFromVoice = null) {
	const message = textFromVoice || userInput.value.trim();
	if (!message || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChat("user", message);

	userInput.value = "";

	typingIndicator?.classList.add("visible");

	chatHistory.push({ role: "user", content: message });

	try {
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";
		assistantMessageEl.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantMessageEl);

		const assistantTextEl = assistantMessageEl.querySelector("p");

		const response = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory }),
		});

		if (!response.ok || !response.body) {
			throw new Error("API error");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let responseText = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;

			for (const data of parsed.events) {
				if (data === "[DONE]") continue;

				try {
					const json = JSON.parse(data);

					let content = "";

					if (json.response) {
						content = json.response;
					} else if (json.choices?.[0]?.delta?.content) {
						content = json.choices[0].delta.content;
					}

					if (content) {
						responseText += content;

						assistantTextEl.textContent = responseText;
						chatMessages.scrollTop = chatMessages.scrollHeight;

						/* 🔊 voz por frases */
						const parts = responseText.split(/[.,!?]/);
						const last = parts.slice(-2).join(" ").trim();

						if (last.length > 30) {
							speakQueue(last);
						}
					}
				} catch (e) {}
			}
		}

		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });

			// 🔊 hablar final completo (asegura cierre natural)
			speakQueue(responseText);
		}

	} catch (err) {
		addMessageToChat("assistant", "Error en el sistema.");
	} finally {
		typingIndicator?.classList.remove("visible");

		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
	}
}

/* =========================
   💬 UI
========================= */

function addMessageToChat(role, content) {
	const el = document.createElement("div");
	el.className = `message ${role}-message`;
	el.innerHTML = `<p>${content}</p>`;
	chatMessages.appendChild(el);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* =========================
   🔁 SSE PARSER
========================= */

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let i;

	while ((i = normalized.indexOf("\n\n")) !== -1) {
		const raw = normalized.slice(0, i);
		normalized = normalized.slice(i + 2);

		const lines = raw.split("\n");
		const dataLines = [];

		for (const l of lines) {
			if (l.startsWith("data:")) {
				dataLines.push(l.slice(5).trim());
			}
		}

		if (dataLines.length) {
			events.push(dataLines.join("\n"));
		}
	}

	return { events, buffer: normalized };
}

/* =========================
   🎤 WAKE WORD (ARREGLADO)
========================= */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SR) {
	const rec = new SR();
	rec.lang = "es-ES";
	rec.continuous = true;

	rec.onresult = (e) => {
		const text =
			e.results[e.results.length - 1][0].transcript.toLowerCase();

		if (text.includes("jarvis")) {
			// ❌ antes: “sí señor”
			// ✅ ahora: dispara chat real
			sendMessage("jarvis");
		}
	};

	rec.onend = () => rec.start();
	rec.start();
}
