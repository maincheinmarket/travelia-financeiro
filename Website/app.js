/* ==========================================================================
   TRAVELIA CENTRAL APP & UI COORDINATOR (THEME, CANVAS, DEMO RESPONSE & SETUP)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial setups
    lucide.createIcons();
    initSettings();
    initTheme();
    initGlobe();
    initChat();

    // 2. Navigation / Event bindings
    document.getElementById('btn-start').addEventListener('click', enterDashboard);
    document.getElementById('logo-to-landing').addEventListener('click', exitToLanding);

    // Modal bindings
    document.getElementById('btn-settings').addEventListener('click', openSettingsModal);
    document.getElementById('btn-open-settings-landing').addEventListener('click', openSettingsModal);
    document.getElementById('btn-close-settings').addEventListener('click', closeSettingsModal);
    document.getElementById('btn-save-settings').addEventListener('click', saveSettingsForm);
    document.getElementById('btn-test-connection').addEventListener('click', testN8NConnection);

    // Tabs in Dashboard (Header)
    document.querySelectorAll('.dashboard-nav .nav-item').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.dashboard-nav .nav-item').forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const selectedTab = e.currentTarget.getAttribute('data-tab');
            appendSystemMessage(`Carregando painel de ${selectedTab.toUpperCase()}...`);
            
            // Interactive demonstration behavior
            if (selectedTab === 'hotels') {
                animateFlightRoute([-48.5482, -27.5954], "FLN", "FLN"); // zoom back to source
            }
        });
    });

    // 3. Mobile Navigation Bottom Tab Bar Event Listeners
    document.querySelectorAll('.mobile-bottom-nav .mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mobile-bottom-nav .mobile-nav-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');

            const targetPanel = e.currentTarget.getAttribute('data-mobile-panel');
            
            // Toggle panel active states
            document.querySelector('.chat-panel').classList.remove('mobile-visible');
            document.querySelector('.map-section').classList.remove('mobile-visible');
            document.querySelector('.data-section').classList.remove('mobile-visible');

            if (targetPanel === 'chat') {
                document.querySelector('.chat-panel').classList.add('mobile-visible');
            } else if (targetPanel === 'map') {
                document.querySelector('.map-section').classList.add('mobile-visible');
                setTimeout(() => { if (map) map.resize(); }, 150); // Redraw MapLibre canvas on resize
            } else if (targetPanel === 'data') {
                document.querySelector('.data-section').classList.add('mobile-visible');
            }
        });
    });

    // Setup first system message in chat
    setTimeout(() => {
        const config = getSettings();
        if (config.mode === 'demo') {
            appendSystemMessage("Aviso: O site está em MODO DEMO. A conversa é simulada simulando o fluxo multi-agente do n8n (Voos, Câmbio, Notícias e Globo interativo). Mude para 'Direct' nas configurações (⚙️) para conectar ao seu n8n.");
        }
        appendBotWelcomeMessage();
    }, 1000);
});

/* ==========================================================================
   SPA NAVIGATION
   ========================================================================== */
function enterDashboard() {
    document.getElementById('landing-page').className = 'section-hidden';
    document.getElementById('dashboard-page').className = 'section-active';
    
    // Set default visible panel on mobile
    document.querySelector('.chat-panel').classList.add('mobile-visible');
    document.querySelector('.map-section').classList.remove('mobile-visible');
    document.querySelector('.data-section').classList.remove('mobile-visible');
    
    // Reset active state for bottom nav buttons on entry
    document.querySelectorAll('.mobile-bottom-nav .mobile-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-mobile-panel') === 'chat') {
            btn.classList.add('active');
        }
    });

    // Resize map once container is visible to ensure correct canvas sizing
    setTimeout(() => {
        if (map) map.resize();
    }, 100);
}

function exitToLanding() {
    document.getElementById('dashboard-page').className = 'section-hidden';
    document.getElementById('landing-page').className = 'section-active';
}

/* ==========================================================================
   THEME SWITCHING (DARK / LIGHT)
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('travelia_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcons(savedTheme);

    const toggleLanding = document.getElementById('landing-theme-toggle');
    const toggleDash = document.getElementById('dashboard-theme-toggle');

    const handleThemeToggle = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('travelia_theme', newTheme);
        updateThemeToggleIcons(newTheme);
        
        // Redraw canvas charts to match theme colors
        const activeIata = document.getElementById('dest-subtitle') ? document.getElementById('dest-subtitle').textContent.split(': ')[1] : '';
        if (activeIata) {
            populateExchange(activeIata);
            populateBudget(cityNames[activeIata] || "Destino");
        }
    };

    toggleLanding.addEventListener('click', handleThemeToggle);
    toggleDash.addEventListener('click', handleThemeToggle);
}

function updateThemeToggleIcons(theme) {
    const icon = theme === 'dark' ? 'sun' : 'moon';
    document.getElementById('landing-theme-toggle').innerHTML = `<i data-lucide="${icon}"></i>`;
    document.getElementById('dashboard-theme-toggle').innerHTML = `<i data-lucide="${icon}"></i>`;
    lucide.createIcons();
}

/* ==========================================================================
   SETTINGS MODAL & LOCALSTORAGE
   ========================================================================== */
function initSettings() {
    let url = localStorage.getItem('travelia_n8n_url') || '';
    let mode = localStorage.getItem('travelia_conn_mode') || 'demo';

    document.getElementById('n8n-webhook-url').value = url;
    document.getElementById('n8n-cors-mode').value = mode;

    updateConnectionIndicator(mode, url ? 'configured' : 'not_configured');
}

function getSettings() {
    return {
        url: localStorage.getItem('travelia_n8n_url') || '',
        mode: localStorage.getItem('travelia_conn_mode') || 'demo'
    };
}

function openSettingsModal() {
    document.getElementById('settings-modal').classList.add('open');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('open');
}

function saveSettingsForm() {
    const url = document.getElementById('n8n-webhook-url').value.trim();
    const mode = document.getElementById('n8n-cors-mode').value;

    localStorage.setItem('travelia_n8n_url', url);
    localStorage.setItem('travelia_conn_mode', mode);

    closeSettingsModal();
    appendSystemMessage(`Configurações salvas: Modo ${mode.toUpperCase()} ativo.`);
    
    // Clear and restore welcome
    document.getElementById('chat-messages-container').innerHTML = '';
    if (mode === 'demo') {
        appendSystemMessage("O site está em MODO DEMO. A conversa é simulada. Mude para 'Direct' para usar n8n.");
    }
    appendBotWelcomeMessage();
    updateConnectionIndicator(mode, url ? 'configured' : 'not_configured');
}

function updateConnectionIndicator(mode, status) {
    const dot = document.querySelector('#conn-status .status-dot');
    const txt = document.querySelector('#conn-status .status-txt');

    if (mode === 'demo') {
        dot.className = 'status-dot online';
        txt.textContent = 'Modo Demo (Simulação)';
        return;
    }

    if (status === 'testing') {
        dot.className = 'status-dot testing';
        txt.textContent = 'Testando conexão...';
    } else if (status === 'connected') {
        dot.className = 'status-dot online';
        txt.textContent = 'Conectado ao n8n';
    } else if (status === 'failed') {
        dot.className = 'status-dot offline';
        txt.textContent = 'Erro ao conectar';
    } else {
        dot.className = 'status-dot offline';
        txt.textContent = 'n8n não configurado';
    }
}

async function testN8NConnection() {
    const url = document.getElementById('n8n-webhook-url').value.trim();
    if (!url) {
        alert("Insira a URL do webhook para testar.");
        return;
    }

    updateConnectionIndicator('direct', 'testing');

    try {
        const res = await fetch(`${url}?action=loadPreviousSession&sessionId=test_session`, {
            method: 'GET'
        });
        
        if (res.ok || res.status === 405 || res.status === 400 || res.status === 401) {
            // Some webhook endpoints response 405 on GET but are alive
            updateConnectionIndicator('direct', 'connected');
            alert("Sucesso! Conexão detectada com o webhook do n8n.");
        } else {
            throw new Error(`Código de status: ${res.status}`);
        }
    } catch (e) {
        console.error(e);
        updateConnectionIndicator('direct', 'failed');
        alert(`Erro de conexão: ${e.message}. Verifique a URL e garanta que o CORS esteja ativo no n8n.`);
    }
}

/* ==========================================================================
   DATA RENDERERS: CANVAS SPARKLINE & DONUT
   ========================================================================== */

// Draw trend lines (sparkline)
function drawSparkline(canvasId, isUp) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const theme = document.documentElement.getAttribute('data-theme');
    ctx.strokeStyle = isUp ? '#2ec4b6' : '#e71d36';

    const points = [];
    const step = canvas.width / 10;
    
    // Generate simulated 10 points fluctuating
    let val = 10;
    for (let i = 0; i <= 10; i++) {
        val += (Math.random() - (isUp ? 0.45 : 0.55)) * 6;
        points.push({ x: i * step, y: Math.max(2, Math.min(canvas.height - 2, val)) });
    }

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
}

// Draw donut budget chart
function drawBudgetDonutChart(data) {
    const canvas = document.getElementById('budget-donut-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Read colors dynamically from CSS tokens
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#FFA666';
    const textMutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#a09e9c';

    const colors = [primaryColor, '#2ec4b6', '#ff9f1c', textMutedColor];
    let total = data.reduce((sum, item) => sum + item.value, 0);
    
    let startAngle = -Math.PI / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 5;
    const innerRadius = outerRadius - 12;

    data.forEach((slice, index) => {
        const sliceAngle = (slice.value / total) * 2 * Math.PI;

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();

        startAngle += sliceAngle;
    });

    // Populate Legend
    const legendContainer = document.getElementById('budget-legend-container');
    legendContainer.innerHTML = '';
    
    data.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = `
            <div class="legend-label">
                <span class="legend-dot" style="background-color: ${colors[index % colors.length]}"></span>
                <span>${item.name}</span>
            </div>
            <span class="legend-val">${item.percentage}%</span>
        `;
        legendContainer.appendChild(div);
    });
}

function resetDataCards() {
    document.getElementById('flights-container').innerHTML = '<div class="no-data-msg">Aguardando dados de destino do Concierge...</div>';
    document.getElementById('news-container').innerHTML = '<div class="no-data-msg">Nenhuma notícia carregada.</div>';
    document.getElementById('destination-info-panel').style.display = 'none';
    document.getElementById('budget-total-val').textContent = 'R$ 0';
    document.getElementById('budget-legend-container').innerHTML = '';
    
    const donut = document.getElementById('budget-donut-chart');
    if (donut) {
        const ctx = donut.getContext('2d');
        ctx.clearRect(0, 0, donut.width, donut.height);
    }
}

/* ==========================================================================
   DYNAMIC POPULATORS FOR DATA CARDS (triggered from parsed chat keywords)
   ========================================================================== */

function populateExchange(iata) {
    let rateUsd = '+1.4%';
    let rateEur = '-0.8%';
    let rateLocal = '+0.5%';
    let rateBtc = '-3.2%';
    
    let localName = 'USD / BRL';
    if (['EUR', 'CDG', 'ORY', 'LIS', 'MAD', 'BCN', 'FCO', 'MXP', 'AMS', 'LHR'].includes(iata)) {
        localName = 'EUR / BRL';
        rateLocal = '-0.8%';
    } else if (['NRT', 'HND'].includes(iata)) {
        localName = 'JPY / BRL';
        rateLocal = '+2.1%';
    } else if (['EZE'].includes(iata)) {
        localName = 'ARS / BRL';
        rateLocal = '-14.3%';
    }

    document.getElementById('currency-dest-name').textContent = localName;

    const usdEl = document.querySelector('#currency-usd .trend-pct');
    usdEl.textContent = rateUsd;
    usdEl.className = 'trend-pct font-success';
    drawSparkline('sparkline-usd', true);

    const eurEl = document.querySelector('#currency-eur .trend-pct');
    eurEl.textContent = rateEur;
    eurEl.className = 'trend-pct font-error';
    drawSparkline('sparkline-eur', false);

    const destEl = document.querySelector('#currency-dest .trend-pct');
    destEl.textContent = rateLocal;
    destEl.className = rateLocal.includes('+') ? 'trend-pct font-success' : 'trend-pct font-error';
    drawSparkline('sparkline-dest', rateLocal.includes('+'));

    const btcEl = document.querySelector('#currency-btc .trend-pct');
    btcEl.textContent = rateBtc;
    btcEl.className = 'trend-pct font-error';
    drawSparkline('sparkline-btc', false);
}

function populateFlights(cityName, iata) {
    const container = document.getElementById('flights-container');
    container.innerHTML = '';

    const flightOptions = {
        'CDG': [
            { airline: 'Air France', indiv: 4200, casal: 8400, bag: 'Sem bagagem incluída' },
            { airline: 'TAP Portugal', indiv: 4450, casal: 8900, bag: 'Mala de bordo incluída' },
            { airline: 'LATAM Airlines', indiv: 4890, casal: 9780, bag: 'Sem bagagem incluída' }
        ],
        'LIS': [
            { airline: 'TAP Portugal', indiv: 4100, casal: 8200, bag: 'Sem bagagem' },
            { airline: 'Azul Express', indiv: 4320, casal: 8640, bag: 'Sem bagagem' },
            { airline: 'LATAM Airlines', indiv: 4950, casal: 9900, bag: 'Bagagem incluída' }
        ],
        'NRT': [
            { airline: 'Qatar Airways', indiv: 7400, casal: 14800, bag: '2 Malas incluídas' },
            { airline: 'Emirates', indiv: 7800, casal: 15600, bag: '2 Malas incluídas' },
            { airline: 'Ana Cargo / United', indiv: 8900, casal: 17800, bag: '1 Mala incluída' }
        ],
        'EZE': [
            { airline: 'Aerolíneas Argentinas', indiv: 1650, casal: 3300, bag: 'Sem bagagem' },
            { airline: 'GOL Linhas Aéreas', indiv: 1820, casal: 3640, bag: 'Mala de bordo incluída' },
            { airline: 'Flybondi', indiv: 1420, casal: 2840, bag: 'Apenas item pessoal' }
        ],
        'default': [
            { airline: 'LATAM Airlines', indiv: 3500, casal: 7000, bag: 'Valores sujeitos a alteração' },
            { airline: 'GOL Linhas Aéreas', indiv: 3820, casal: 7640, bag: 'Sem bagagem' }
        ]
    };

    const flights = flightOptions[iata] || flightOptions['default'];

    flights.forEach((f, idx) => {
        const item = document.createElement('div');
        item.className = `flight-item ${idx === 0 ? 'cheapest' : ''}`;
        item.innerHTML = `
            <div class="flight-top">
                <span class="airline-info"><i data-lucide="plane"></i> ${f.airline}</span>
                <span class="flight-warnings">${f.bag}</span>
            </div>
            <div class="flight-prices">
                <div class="price-box">
                    <span class="lbl">Individual</span>
                    <span class="val">R$ ${f.indiv.toLocaleString('pt-BR')}</span>
                </div>
                <div class="price-box">
                    <span class="lbl">Casal (x2)</span>
                    <span class="val">R$ ${f.casal.toLocaleString('pt-BR')}</span>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
    lucide.createIcons();
}

function populateNews(cityName) {
    const container = document.getElementById('news-container');
    container.innerHTML = '';

    const headlines = [
        { title: `Taxa de juros e inflação pressionam turismo em ${cityName}`, source: 'Valor Econômico', date: 'Hoje' },
        { title: `Mercado financeiro local ajusta projeções cambiais para o próximo trimestre`, source: 'Bloomberg Linea', date: 'Ontem' },
        { title: `Demanda por viagens de luxo para ${cityName} sobe 15% apesar do câmbio`, source: 'Forbes Brasil', date: 'Há 3 dias' }
    ];

    headlines.forEach(news => {
        const item = document.createElement('div');
        item.className = 'news-item';
        item.innerHTML = `
            <a href="#" onclick="return false;">
                <h5>${news.title}</h5>
                <div class="news-meta">
                    <span>${news.source}</span>
                    <span>${news.date}</span>
                </div>
            </a>
        `;
        container.appendChild(item);
    });
}

function populateBudget(cityName) {
    // Standard luxury values
    let totalBRL = 24800;
    let breakdown = [
        { name: 'Transporte / Voos', value: 35, percentage: 35 },
        { name: 'Hospedagem', value: 40, percentage: 40 },
        { name: 'Alimentação', value: 15, percentage: 15 },
        { name: 'Passeios & Outros', value: 10, percentage: 10 }
    ];

    if (cityName.includes('Paris') || cityName.includes('Roma')) {
        totalBRL = 29500;
    } else if (cityName.includes('Tóquio')) {
        totalBRL = 42000;
        breakdown[0].value = 45; // Flights are expensive to Japan
        breakdown[0].percentage = 45;
        breakdown[1].value = 35;
        breakdown[1].percentage = 35;
    } else if (cityName.includes('Buenos Aires')) {
        totalBRL = 12500;
        breakdown[0].value = 25;
        breakdown[0].percentage = 25;
        breakdown[1].value = 45;
        breakdown[1].percentage = 45;
    }

    document.getElementById('budget-total-val').textContent = `R$ ${totalBRL.toLocaleString('pt-BR')}`;
    drawBudgetDonutChart(breakdown);

    // Setup interactive day selector timeline
    setupTimeline(cityName);
}

function setupTimeline(cityName) {
    const timeline = document.getElementById('day-timeline-content');
    const container = document.getElementById('day-selectors-container');
    
    // Reset day active selectors
    document.querySelectorAll('.day-selectors .day-btn').forEach((btn, idx) => {
        btn.classList.remove('active');
        if (idx === 0) btn.classList.add('active');
    });

    const dayItineraries = {
        'default': {
            1: [
                { time: '10:00', title: `Chegada em ${cityName} e check-in no hotel de luxo.` },
                { time: '13:00', title: 'Almoço em restaurante local contemporâneo.' },
                { time: '16:00', title: 'Tour privativo introdutório pela área central.' }
            ],
            2: [
                { time: '09:00', title: 'Visita guiada ao principal ponto turístico sem filas.' },
                { time: '13:00', title: 'Almoço no bistrô com estrela Michelin.' },
                { time: '15:30', title: 'Sessão de compras ou passeio de barco privativo.' }
            ],
            3: [
                { time: '10:00', title: 'Passeio cultural a museu histórico.' },
                { time: '14:00', title: 'Experiência gastronômica com degustação de vinhos.' }
            ],
            4: [
                { time: '09:30', title: 'Day-trip para vilarejo histórico nos arredores.' },
                { time: '19:00', title: 'Jantar exclusivo de despedida no rooftop da cidade.' }
            ],
            5: [
                { time: '10:00', title: 'Manhã livre para relaxamento e spa do hotel.' },
                { time: '15:00', title: 'Transfer executivo para o aeroporto de retorno.' }
            ]
        }
    };

    const renderDay = (day) => {
        timeline.innerHTML = '';
        const items = dayItineraries['default'][day] || dayItineraries['default'][1];
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'timeline-item';
            div.innerHTML = `
                <span class="timeline-time">${item.time}</span>
                <span class="timeline-title">${item.title}</span>
            `;
            timeline.appendChild(div);
        });
    };

    // Render Day 1 by default
    renderDay(1);

    // Bind click events on day buttons
    document.querySelectorAll('.day-selectors .day-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.day-selectors .day-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const day = e.currentTarget.getAttribute('data-day');
            renderDay(parseInt(day));
        };
    });
}

/* ==========================================================================
   BOT CONCIERGE WELCOME & DEMO CHAT ACTIONS
   ========================================================================== */
function appendBotWelcomeMessage() {
    const container = document.getElementById('chat-messages-container');
    const msg = document.createElement('div');
    msg.className = 'message bot-message';
    msg.innerHTML = `
        <p>Olá! Sou o seu <strong>Concierge de Viagens e Consultor Financeiro</strong>.</p>
        <p>Para planejarmos a melhor experiência personalizada para você saindo de <strong>Florianópolis (FLN)</strong>, por favor me informe:</p>
        <ol>
            <li>Qual o seu destino de interesse (ex: Europa, Paris, Tóquio, Argentina)?</li>
            <li>Quando gostaria de viajar (ida e volta)?</li>
            <li>Qual a sua moeda de preferência (ex: Euro, Dólar, BRL)?</li>
        </ol>
        <p><em>Posso inferir a melhor época e opções se você me disser apenas o continente ou tipo de clima desejado!</em></p>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// Simulated responses in MODO DEMO for testing all components
function simulateDemoResponse(text) {
    const bubbleInfo = createBotTypingBubble();
    const botBubble = bubbleInfo.messageBubble;
    const typingIndicator = bubbleInfo.indicator;

    setTimeout(() => {
        typingIndicator.remove();
        
        const lowerText = text.toLowerCase();
        let responseHTML = '';

        if (lowerText.includes('paris') || lowerText.includes('europa') || lowerText.includes('frança')) {
            responseHTML = `
                <h4>Relatório Executivo de Viagem: Paris (CDG)</h4>
                <p>Com base em suas preferências, elaborei este planejamento financeiro exclusivo para <strong>Paris, França</strong>.</p>
                
                <h4>Câmbio & Risco Financeiro</h4>
                <p>O <strong>Euro (EUR)</strong> apresentou oscilação de <strong>-0.8%</strong> nos últimos 30 dias frente ao Real (BRL), cotado atualmente a <strong>R$ 6,12</strong>. Este recuo recente abre uma janela favorável para antecipação de compra de moeda local.</p>
                
                <h4>Passagens Aéreas</h4>
                <p>A melhor rota partindo de <strong>Florianópolis (FLN)</strong> com destino a <strong>Paris (CDG)</strong> em outubro tem tarifa de <strong>R$ 4.200 (Individual)</strong> ou <strong>R$ 8.400 (Casal)</strong> pela Air France, com paradas rápidas em São Paulo. <em>(Valores não incluem bagagem despachada)</em>.</p>
                
                <h4>Notícias Econômicas Importantes</h4>
                <ul>
                    <li>A taxa de inflação na Zona do Euro se estabilizou, mantendo os custos de hotéis e gastronomia estáveis para o outono europeu.</li>
                    <li>Procura por viagens internacionais de luxo aumentou 15%, gerando recomendação de reserva imediata para garantir tarifas.</li>
                </ul>
                
                <h4>Recomendação do Concierge</h4>
                <p>Recomendo a emissão imediata da passagem pela tarifa Air France e a aquisição do câmbio EUR em parcelas até a data do embarque.</p>
            `;
            botBubble.innerHTML = responseHTML;
            parseAndApplyDetails("CDG"); // trigger CDG coordinates
        } 
        else if (lowerText.includes('tóquio') || lowerText.includes('japão') || lowerText.includes('ásia')) {
            responseHTML = `
                <h4>Relatório Executivo de Viagem: Tóquio (HND)</h4>
                <p>Aqui está o seu planejamento financeiro de luxo exclusivo para <strong>Tóquio, Japão</strong>.</p>
                
                <h4>Câmbio & Risco Financeiro</h4>
                <p>O <strong>Iene Japonês (JPY)</strong> está operando em alta de <strong>+2.1%</strong> em relação ao Real, cotado atualmente a R$ 0,035. Recomenda-se cautela com gastos locais de cartão.</p>
                
                <h4>Passagens Aéreas</h4>
                <p>Encontramos voos premium com a Qatar Airways saindo de <strong>FLN</strong> para <strong>Tóquio (HND)</strong> por <strong>R$ 7.400 (Individual)</strong>, incluindo excelente serviço de bordo e 2 malas despachadas.</p>
                
                <h4>Contexto de Mercado</h4>
                <p>O Banco do Japão ajustou suas políticas de taxas de juros levemente, gerando flutuações nas cotações locais. A demanda de turistas internacionais permanece muito alta.</p>
                
                <h4>Recomendação Final</h4>
                <p>Tóquio oferece um ótimo valor de hospedagem em hotéis de alto padrão se reservado com antecedência.</p>
            `;
            botBubble.innerHTML = responseHTML;
            parseAndApplyDetails("HND"); // trigger Tokyo coordinates
        }
        else if (lowerText.includes('buenos') || lowerText.includes('argentina') || lowerText.includes('eze')) {
            responseHTML = `
                <h4>Relatório Executivo de Viagem: Buenos Aires (EZE)</h4>
                <p>Planejamento de viagem para a vibrante capital argentina <strong>Buenos Aires (EZE)</strong>.</p>
                
                <h4>Câmbio & Risco Financeiro</h4>
                <p>O Peso Argentino (ARS) desvalorizou <strong>-14.3%</strong> contra o Real nos últimos 30 dias. Viajar para a Argentina continua oferecendo excelente custo-benefício financeiro para portadores de Reais.</p>
                
                <h4>Passagens Aéreas</h4>
                <p>Voos diretos e rápidos pela Aerolíneas Argentinas saindo de <strong>FLN</strong> por <strong>R$ 1.650 (Individual)</strong> ou R$ 3.300 (Casal). Excelente custo de transporte.</p>
                
                <h4>Recomendação</h4>
                <p>Aproveite a gastronomia sofisticada de Palermo e os hotéis boutique de Recoleta com valores extremamente convidativos.</p>
            `;
            botBubble.innerHTML = responseHTML;
            parseAndApplyDetails("EZE"); // trigger Buenos Aires coordinates
        }
        else {
            responseHTML = `
                <p>Recebi sua mensagem. Em modo simulação, digite <strong>"Paris"</strong>, <strong>"Tóquio"</strong> ou <strong>"Buenos Aires"</strong> para ver a animação completa de voos no globo 3D, cotações cambiais e itinerário.</p>
                <p>Se preferir testar em tempo real, conecte a URL do seu webhook do n8n nas configurações do painel superior direito ⚙️.</p>
            `;
            botBubble.innerHTML = responseHTML;
        }

        document.getElementById('chat-messages-container').scrollTop = document.getElementById('chat-messages-container').scrollHeight;

    }, 1500);
}
