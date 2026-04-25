const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// 🔊 VOZ JARVIS
const speak = (text) => {
	if (!text) return;
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.lang = "es-ES";
	utterance.rate = 1;
	utterance.pitch = 1;
	speechSynthesis.speak(utterance);
};

let chatHistory = [
	{
		role: "assistant",
		content: "Buenos días señor. JARVIS en línea. ¿En qué puedo ayudarle?",
	},
];

let isProcessing = false;

// Auto resize input
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Enter to send
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", sendMessage);

/* =========================
   🎤 MICRÓFONO JARVIS
========================= */

const SpeechRecognition =
	window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
	recognition.lang = "es-ES";
	recognition.continuous = false;
}

function startMic() {
	if (!recognition) {
		alert("Micrófono no soportado en este navegador");
		return;
	}
	recognition.start();
}

if (recognition) {
	recognition.onresult = (event) => {
		const text = event.results[0][0].transcript;
		userInput.value = text;
		sendMessage();
	};
}

/* =========================
   🚀 ENVIAR MENSAJE
========================= */

async function sendMessage() {
	const message = userInput.value.trim();
	if (!message || isProcessing) return;

	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	addMessageToChat("user", message);

	userInput.value = "";
	userInput.style.height = "auto";

	typingIndicator.classList.add("visible");

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
			throw new Error("Error en respuesta");
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();

		let buffer = "";
		let responseText = "";

		const updateUI = () => {
			assistantTextEl.textContent = responseText;
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};

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
						updateUI();
					}
				} catch (e) {}
			}
		}

		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });

			// 🔊 JARVIS HABLA
			speak(responseText);
		}
	} catch (error) {
		addMessageToChat(
			"assistant",
			"Error del sistema. No he podido procesar la solicitud."
		);
	} finally {
		typingIndicator.classList.remove("visible");

		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

/* =========================
   💬 CHAT UI
========================= */

function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;
	messageEl.innerHTML = `<p>${content}</p>`;
	chatMessages.appendChild(messageEl);
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

/* =========================
   SSE PARSER
========================= */

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;

	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const raw = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);

		const lines = raw.split("\n");
		const dataLines = [];

		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice(5).trim());
			}
		}

		if (dataLines.length) {
			events.push(dataLines.join("\n"));
		}
	}

	return { events, buffer: normalized };
}
