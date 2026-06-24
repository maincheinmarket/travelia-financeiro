/* ==========================================================================
   TRAVELIA CHAT MODULE (N8N INTEGRATION, SSE STREAMING & PARSING)
   ========================================================================== */

let sessionId = '';
let isSendingMessage = false;
const iataCoordinates = {
    // Europa
    'CDG': [2.5500, 49.0097], // Paris CDG
    'ORY': [2.3652, 48.7262], // Paris Orly
    'LIS': [-9.1359, 38.7756], // Lisboa
    'MAD': [-3.5680, 40.4840], // Madrid
    'BCN': [2.0833, 41.2974], // Barcelona
    'FCO': [12.2389, 41.8003], // Roma Fiumicino
    'MXP': [8.7281, 45.6300], // Milão Malpensa
    'AMS': [4.7642, 52.3086], // Amsterdã
    'LHR': [-0.4543, 51.4700], // Londres Heathrow
    // América do Norte
    'MIA': [-80.2870, 25.7959], // Miami
    'JFK': [-73.7781, 40.6413], // Nova York JFK
    'YYZ': [-79.6248, 43.6777], // Toronto
    'MEX': [-99.0721, 19.4361], // Cidade do México
    'LAX': [-118.4085, 33.9416], // Los Angeles
    // América do Sul
    'EZE': [-58.5358, -34.8222], // Buenos Aires Ezeiza
    'SCL': [-70.7858, -33.3930], // Santiago
    'LIM': [-77.1147, -12.0219], // Lima
    'BOG': [-74.1447, 4.7016], // Bogotá
    'MVD': [-56.0305, -34.8384], // Montevidéu
    'FLN': [-48.5482, -27.5954], // Florianópolis
    // Ásia e Oriente Médio
    'NRT': [140.3929, 35.7720], // Tóquio Narita
    'HND': [139.7811, 35.5494], // Tóquio Haneda
    'ICN': [126.4407, 37.4602], // Seul
    'BKK': [100.7501, 13.6896], // Bangkok
    'SIN': [103.9915, 1.3644], // Singapura
    'DXB': [55.3644, 25.2532], // Dubai
    'DOH': [51.5651, 25.2611], // Doha
    'IST': [28.8146, 40.9769], // Istambul
};

const cityNames = {
    'CDG': 'Paris', 'ORY': 'Paris', 'LIS': 'Lisboa', 'MAD': 'Madri', 'BCN': 'Barcelona',
    'FCO': 'Roma', 'MXP': 'Milão', 'AMS': 'Amsterdã', 'LHR': 'Londres', 'MIA': 'Miami',
    'JFK': 'Nova York', 'YYZ': 'Toronto', 'MEX': 'Cidade do México', 'LAX': 'Los Angeles',
    'EZE': 'Buenos Aires', 'SCL': 'Santiago', 'LIM': 'Lima', 'BOG': 'Bogotá', 'MVD': 'Montevidéu',
    'NRT': 'Tóquio', 'HND': 'Tóquio', 'ICN': 'Seul', 'BKK': 'Bangkok', 'SIN': 'Singapura',
    'DXB': 'Dubai', 'DOH': 'Doha', 'IST': 'Istambul'
};

function initChat() {
    // Load or generate session
    sessionId = localStorage.getItem('travelia_session_id');
    if (!sessionId) {
        sessionId = generateUUID();
        localStorage.setItem('travelia_session_id', sessionId);
    }

    // Bind event listeners
    document.getElementById('btn-send-chat').addEventListener('click', handleSendClick);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendClick();
    });
    
    // Bind chips
    document.querySelectorAll('#chat-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const text = chip.getAttribute('data-text');
            document.getElementById('chat-input').value = text;
            handleSendClick();
        });
    });

    // Clear chat
    document.getElementById('btn-clear-chat').addEventListener('click', () => {
        const container = document.getElementById('chat-messages-container');
        container.innerHTML = '';
        appendSystemMessage('Histórico da conversa limpo. Nova sessão iniciada.');
        sessionId = generateUUID();
        localStorage.setItem('travelia_session_id', sessionId);
        clearRoutes();
        resetDataCards();
    });

    // Mic button triggers mockup
    const micBtn = document.getElementById('btn-voice-chat');
    const stopVoiceBtn = document.getElementById('btn-stop-voice');
    const voiceWave = document.getElementById('voice-wave');
    const inputWrapper = document.querySelector('.input-wrapper');

    micBtn.addEventListener('click', () => {
        voiceWave.style.display = 'flex';
        inputWrapper.style.display = 'none';
        simulateSpeechRecognition();
    });

    stopVoiceBtn.addEventListener('click', () => {
        voiceWave.style.display = 'none';
        inputWrapper.style.display = 'flex';
    });

    // Load session if settings allow
    loadHistory();
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function handleSendClick() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendMessage(text);
}

function appendUserMessage(text) {
    const container = document.getElementById('chat-messages-container');
    const msg = document.createElement('div');
    msg.className = 'message user-message';
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function appendSystemMessage(text) {
    const container = document.getElementById('chat-messages-container');
    const msg = document.createElement('div');
    msg.className = 'message system-msg';
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// Renders the typing bubble and returns the elements to update
function createBotTypingBubble() {
    const container = document.getElementById('chat-messages-container');
    const msg = document.createElement('div');
    msg.className = 'message bot-message';
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    
    msg.appendChild(indicator);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    
    return {
        messageBubble: msg,
        indicator: indicator
    };
}

// Main Send Message Function
async function sendMessage(text) {
    if (isSendingMessage) {
        appendSystemMessage('Aguarde a resposta atual do Concierge antes de enviar outra mensagem.');
        return;
    }

    appendUserMessage(text);

    const config = getSettings();
    if (config.mode === 'demo') {
        simulateDemoResponse(text);
        return;
    }

    if (!config.url) {
        appendSystemMessage('Aviso: URL do webhook do n8n não configurada. Por favor, clique no ícone de configurações (⚙️) no canto superior direito para inserir a URL.');
        return;
    }

    isSendingMessage = true;
    setSendButtonLoading(true);

    const bubbleInfo = createBotTypingBubble();
    const botBubble = bubbleInfo.messageBubble;
    const typingIndicator = bubbleInfo.indicator;

    try {
        const response = await fetchWithTimeout(buildN8NUrl(config.url, { action: 'sendMessage' }), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: "sendMessage",
                sessionId: sessionId,
                chatInput: text
            })
        }, 180000);

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`n8n HTTP ${response.status}${errorText ? `: ${errorText.slice(0, 160)}` : ''}`);
        }

        typingIndicator.remove();

        const contentType = response.headers.get('content-type') || '';
        
        // Handle SSE / Streaming responses
        if (contentType.includes('text/event-stream')) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const parsedTokens = parseSSEChunk(chunk);
                
                accumulatedText += parsedTokens;
                
                // Parse markdown in real-time. Internal integration payloads stay hidden.
                const displayText = stripTraveliaData(accumulatedText);
                botBubble.innerHTML = typeof marked.parse === 'function' ? marked.parse(displayText) : displayText;
                document.getElementById('chat-messages-container').scrollTop = document.getElementById('chat-messages-container').scrollHeight;
            }
            
            // Post-stream finished: run parsers
            parseAndApplyDetails(accumulatedText);
        } else {
            // Standard JSON/text response
            const raw = await response.text();
            const responseText = extractResponseText(raw);
            const displayText = stripTraveliaData(responseText);
            botBubble.innerHTML = typeof marked.parse === 'function' ? marked.parse(displayText) : displayText;
            document.getElementById('chat-messages-container').scrollTop = document.getElementById('chat-messages-container').scrollHeight;
            parseAndApplyDetails(responseText);
        }

    } catch (err) {
        console.error("Erro na requisição n8n:", err);
        typingIndicator.remove();
        const message = err.name === 'AbortError'
            ? 'A resposta do n8n excedeu o tempo limite. Verifique execuções pendentes, rate limits e tempo das APIs externas.'
            : err.message;
        botBubble.innerHTML = `<span class="font-error">Falha ao se comunicar com o n8n: ${message}</span>`;
    } finally {
        isSendingMessage = false;
        setSendButtonLoading(false);
    }
}

function setSendButtonLoading(isLoading) {
    const button = document.getElementById('btn-send-chat');
    const input = document.getElementById('chat-input');
    if (!button || !input) return;

    button.disabled = isLoading;
    input.disabled = isLoading;
    button.innerHTML = isLoading ? '<i data-lucide="loader-2"></i>' : '<i data-lucide="send"></i>';
    lucide.createIcons();
}

function stripTraveliaData(text) {
    return text.replace(/<!--\s*TRAVELIA_DATA_START[\s\S]*?TRAVELIA_DATA_END\s*-->/g, '').trim();
}

function extractResponseText(raw) {
    if (!raw) return '';

    try {
        const data = JSON.parse(raw);
        if (typeof data === 'string') return data;
        return data.text ||
            data.output ||
            data.message ||
            data.response ||
            data.data?.text ||
            data.data?.output ||
            JSON.stringify(data);
    } catch (e) {
        return raw;
    }
}

function extractTraveliaData(text) {
    const markerMatch = text.match(/<!--\s*TRAVELIA_DATA_START\s*([\s\S]*?)\s*TRAVELIA_DATA_END\s*-->/);
    if (!markerMatch) return null;

    try {
        return JSON.parse(markerMatch[1]);
    } catch (e) {
        console.warn('Payload TRAVELIA_DATA inválido.', e);
        return null;
    }
}

// Parse standard SSE streams from n8n
function parseSSEChunk(chunk) {
    let result = '';
    const lines = chunk.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.substring(5).trim();
            if (dataStr === '[DONE]') continue;
            
            try {
                const jsonObj = JSON.parse(dataStr);
                // Extract whatever output is sent by n8n (text, data, token)
                result += jsonObj.text ||
                    jsonObj.output ||
                    jsonObj.message ||
                    jsonObj.token ||
                    jsonObj.chunk ||
                    jsonObj.content ||
                    jsonObj.data?.text ||
                    jsonObj.data?.output ||
                    '';
            } catch (e) {
                // If it's not valid JSON, treat it as raw text
                result += dataStr;
            }
        }
    }
    return result;
}

// Scan agent text for details
function parseAndApplyDetails(text) {
    const traveliaData = extractTraveliaData(text);
    const textForParsing = stripTraveliaData(text);

    // 1. Look for IATA Codes (3 uppercase letters bounded by boundaries)
    const iataRegex = /\b([A-Z]{3})\b/g;
    let match;
    let foundIatas = [];
    
    while ((match = iataRegex.exec(textForParsing)) !== null) {
        const code = match[1];
        if (iataCoordinates[code] && code !== 'FLN') {
            foundIatas.push(code);
        }
    }

    const recommendedIata = traveliaData?.recommended_iata || traveliaData?.destino_iata;
    if (recommendedIata && iataCoordinates[recommendedIata] && recommendedIata !== 'FLN') {
        foundIatas.unshift(recommendedIata);
    }

    const uniqueIatas = [...new Set(foundIatas)];

    if (uniqueIatas.length > 0) {
        // Target the first unique destination IATA
        const targetIata = uniqueIatas[0];
        const coords = iataCoordinates[targetIata];
        const cityName = traveliaData?.city || traveliaData?.cidade || cityNames[targetIata] || "Destino";
        
        // Trigger Globe flyTo and route animation
        animateFlightRoute(coords, cityName, targetIata);
        
        // Show/update destination overlay panel
        updateDestinationPanel(cityName, targetIata);
        
        // Update flight details card
        populateFlights(cityName, targetIata, traveliaData?.flights || traveliaData?.voos);

        // Update exchange rate details
        populateExchange(targetIata, traveliaData?.exchange || traveliaData?.cambio);
        
        // Populate news card
        populateNews(cityName, traveliaData?.news || traveliaData?.noticias);

        // Populate budget
        populateBudget(cityName, traveliaData?.budget || traveliaData?.orcamento);
    }
}

// Update the overlay cards when IATA detected
function updateDestinationPanel(cityName, iata) {
    const panel = document.getElementById('destination-info-panel');
    panel.style.display = 'flex';
    
    document.getElementById('dest-title').textContent = cityName;
    document.getElementById('dest-subtitle').textContent = `Destino IATA: ${iata}`;
    
    // Dynamic values based on destination
    let ticket = '€16.00';
    let exchange = '1 BRL = 0.16 EUR';
    let weather = '22°C (71°F) Parcialmente Nublado';
    let lang = 'Português / Inglês';

    if (['NRT', 'HND'].includes(iata)) {
        ticket = '¥1,500';
        exchange = '1 BRL = 28.5 JPY';
        weather = '18°C (64°F) Ensolarado';
        lang = 'Japonês';
    } else if (['EZE'].includes(iata)) {
        ticket = '$12,000 ARS';
        exchange = '1 BRL = 162.2 ARS';
        weather = '15°C (59°F) Nublado';
        lang = 'Espanhol';
    } else if (['LIS'].includes(iata)) {
        ticket = '€12.00';
        exchange = '1 BRL = 0.16 EUR';
        weather = '24°C (75°F) Ensolarado';
        lang = 'Português';
    }

    document.getElementById('dest-val-ticket').textContent = ticket;
    document.getElementById('dest-val-exchange').textContent = exchange;
    document.getElementById('dest-val-weather').textContent = weather;
    document.getElementById('dest-val-lang').textContent = lang;
    
    document.getElementById('btn-close-dest-card').onclick = () => {
        panel.style.display = 'none';
    };
}

// Mock voice recognition
function simulateSpeechRecognition() {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('voice-wave');
    const inputWrapper = document.querySelector('.input-wrapper');
    
    setTimeout(() => {
        input.value = "Quero planejar uma viagem para Paris saindo de Florianópolis em outubro.";
        container.style.display = 'none';
        inputWrapper.style.display = 'flex';
    }, 3000);
}

// Load previous history (best effort mockup)
async function loadHistory() {
    const config = getSettings();
    if (config.mode === 'demo' || !config.url || !config.loadHistory) return;

    try {
        const response = await fetchWithTimeout(buildN8NUrl(config.url, {
            action: 'loadPreviousSession',
            sessionId
        }), {}, 15000);
        if (response.ok) {
            const data = await response.json();
            // n8n returns messages array if memory contains data
            if (data && data.messages) {
                const container = document.getElementById('chat-messages-container');
                container.innerHTML = ''; // Clear defaults
                
                data.messages.forEach(msg => {
                    const bubble = document.createElement('div');
                    if (msg.role === 'user' || msg.type === 'human') {
                        bubble.className = 'message user-message';
                        bubble.textContent = msg.text || msg.content;
                    } else {
                        bubble.className = 'message bot-message';
                        bubble.innerHTML = typeof marked.parse === 'function' ? marked.parse(msg.text || msg.content) : (msg.text || msg.content);
                    }
                    container.appendChild(bubble);
                });
                container.scrollTop = container.scrollHeight;
            }
        }
    } catch (e) {
        console.warn("Sem histórico carregado do n8n.", e);
    }
}
