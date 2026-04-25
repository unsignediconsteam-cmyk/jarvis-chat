const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [
	{ role: "assistant", content: "Sistema en línea." }
];

let isProcessing = false;

/* =========================
   💬 UI
========================= */

function addMessage(role, text) {
	const div = document.createElement("div");
	div.className = `message ${role}-message`;
	div.innerHTML = `<p>${text}</p>`;
	chatMessages.appendChild(div);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* =========================
   🚀 ENVIAR MENSAJE
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

	typingIndicator?.classList.add("visible");

	try {
		const res = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ messages: chatHistory })
		});

		if (!res.ok || !res.body) {
			throw new Error("API error");
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let fullText = "";

		// crear mensaje IA desde el inicio
		const assistantDiv = document.createElement("div");
		assistantDiv.className = "message assistant-message";
		assistantDiv.innerHTML = "<p></p>";
		chatMessages.appendChild(assistantDiv);

		const p = assistantDiv.querySelector("p");

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			const parsed = consumeSSE(buffer);
			buffer = parsed.buffer;

			for (const event of parsed.events) {
				if (event === "[DONE]") continue;

				try {
					const json = JSON.parse(event);

					let text = "";

					if (json.response) {
						text = json.response;
					} else if (json.choices?.[0]?.delta?.content) {
						text = json.choices[0].delta.content;
					}

					if (text) {
						fullText += text;
						p.textContent = fullText;
						chatMessages.scrollTop = chatMessages.scrollHeight;
					}
				} catch {}
			}
		}

		if (fullText) {
			chatHistory.push({
				role: "assistant",
				content: fullText
			});
		}

	} catch (err) {
		addMessage("assistant", "Error en el sistema.");
	} finally {
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		typingIndicator?.classList.remove("visible");
	}
}

/* =========================
   🧾 SSE PARSER
========================= */

function consumeSSE(buffer) {
	let clean = buffer.replace(/\r/g, "");
	const events = [];

	let index;
	while ((index = clean.indexOf("\n\n")) !== -1) {
		const raw = clean.slice(0, index);
		clean = clean.slice(index + 2);

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
   🎧 INPUT
========================= */

userInput.addEventListener("keydown", (e) => {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);
