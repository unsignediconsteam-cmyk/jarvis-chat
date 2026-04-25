document.addEventListener("DOMContentLoaded", () => {

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

if (!chatMessages || !userInput || !sendButton) {
	console.error("HUD o DOM roto");
	return;
}

let chatHistory = [
	{ role: "assistant", content: "JARVIS activo." }
];

let isProcessing = false;

/* =========================
   🔊 VOZ JARVIS
========================= */
function speak(text) {
	if (!text) return;

	const u = new SpeechSynthesisUtterance(text);
	const voices = speechSynthesis.getVoices();

	u.voice = voices.find(v => v.lang === "es-ES") || voices[0];

	u.lang = "es-ES";
	u.rate = 1.35;
	u.pitch = 1.3;

	speechSynthesis.cancel();
	speechSynthesis.speak(u);
}

/* =========================
   💬 UI
========================= */
function addMessage(role, text) {
	const div = document.createElement("div");
	div.className = `message ${role}-message`;
	div.textContent = text;
	chatMessages.appendChild(div);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* =========================
   🚀 CHAT
========================= */
async function sendMessage() {
	const message = userInput.value.trim();
	if (!message || isProcessing) return;

	isProcessing = true;

	userInput.value = "";
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessage("user", message);
	chatHistory.push({ role: "user", content: message });

	typingIndicator.style.display = "block";

	try {
		const res = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory })
		});

		const reader = res.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let full = "";

		const ai = document.createElement("div");
		ai.className = "message assistant-message";
		const p = document.createElement("p");
		ai.appendChild(p);
		chatMessages.appendChild(ai);

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			const parsed = parseSSE(buffer);
			buffer = parsed.buffer;

			for (const ev of parsed.events) {
				if (ev === "[DONE]") continue;

				try {
					const json = JSON.parse(ev);

					let text =
						json.response ||
						json.choices?.[0]?.delta?.content ||
						"";

					if (text) {
						full += text;
						p.textContent = full;
						chatMessages.scrollTop = chatMessages.scrollHeight;
					}
				} catch {}
			}
		}

		if (full) {
			chatHistory.push({ role: "assistant", content: full });
			speak(full);
		}

	} catch (e) {
		addMessage("assistant", "ERROR JARVIS CORE");
	} finally {
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		typingIndicator.style.display = "none";
	}
}

/* =========================
   SSE
========================= */
function parseSSE(buffer) {
	let clean = buffer.replace(/\r/g, "");
	const events = [];

	let i;
	while ((i = clean.indexOf("\n\n")) !== -1) {
		const raw = clean.slice(0, i);
		clean = clean.slice(i + 2);

		const lines = raw.split("\n");
		const data = lines
			.filter(l => l.startsWith("data:"))
			.map(l => l.replace("data:", "").trim())
			.join("\n");

		if (data) events.push(data);
	}

	return { events, buffer: clean };
}

/* =========================
   INPUT
========================= */
sendButton.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

});
