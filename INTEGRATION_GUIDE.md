# Guia de Integração: Travelia Frontend + n8n Multi-Agent

Este documento serve como referência técnica detalhada para a LLM que gerencia o workflow do **n8n** e para desenvolvedores que queiram entender como o frontend se comunica com os agentes, quais formatos de dados são esperados e como funcionam os gatilhos automáticos na interface.

---

## 1. Arquitetura de Comunicação

O frontend se integra com o n8n através de chamadas HTTP ao nó **Chat Trigger** (ou um Webhook equivalente).

```
[ Frontend: chat.js ] ──(POST / HTTP)──> [ n8n: Chat Trigger ]
  ▲                                                │
  └────────(SSE Stream / JSON Response)────────────┘
```

### Configuração recomendada no Chat Trigger

Para o Travelia, o Chat Trigger deve ficar como endpoint público embedded, com CORS restrito ao domínio do site:

```text
public=true
mode=webhook
authentication=none
responseMode=streaming
allowedOrigins=https://travelia-financeiro.vercel.app,http://localhost:3000,http://localhost:5173,http://127.0.0.1:5500
loadPreviousSession=notSupported
allowFileUploads=false
```

Justificativas:

*   `streaming` melhora a percepção de velocidade em respostas longas do agente.
*   `allowedOrigins` não deve ficar como `*` em produção.
*   `loadPreviousSession` fica desligado por padrão para evitar execuções em carregamento de página. A memória do agente continua funcionando por `sessionId`.
*   Se o histórico visual for ativado no futuro, conecte o Chat Trigger e o Agent à mesma memória, conforme recomendação do n8n.

### Endpoints e Ações
O frontend envia requisições utilizando os seguintes parâmetros e estruturas:

#### A. Enviar Mensagem (`sendMessage`)
Enviado quando o usuário digita uma mensagem no chat ou clica em um chip de sugestão rápida.

*   **URL:** `POST <n8n_webhook_url>?action=sendMessage`
*   **Headers:** `Content-Type: application/json`
*   **Corpo da Requisição (JSON):**
    ```json
    {
      "action": "sendMessage",
      "sessionId": "b0a51f8a-fa9a-4cce-9b7e-3407ca878b8a",
      "chatInput": "Quero planejar uma viagem para Paris saindo de Florianópolis em outubro"
    }
    ```
*   **Formato de Resposta Esperado:** 
    - **Streaming (SSE):** O n8n deve retornar chunks de dados (`text/event-stream`). Cada evento contendo tokens de texto parciais formatados como JSON: `data: {"text": "token"}`.
    - **Não-Streaming (JSON):** Se o stream falhar, o frontend aceita um JSON completo contendo a resposta textual no campo `text` ou `output`.

### Boas práticas aplicadas no frontend

*   A URL do webhook é normalizada antes de salvar; `action` e `sessionId` antigos são removidos.
*   O site monta a URL com `URLSearchParams`, evitando concatenação frágil com `?` e `&`.
*   O envio usa `AbortController` com timeout de 180s.
*   O botão de envio e o input ficam bloqueados enquanto uma execução está em andamento.
*   Em erro real do n8n, o site mostra o erro ao usuário e não cai automaticamente em modo demo.
*   O carregamento de histórico é opcional e desligado por padrão.

#### B. Carregar Histórico (`loadPreviousSession`)
Chamado no carregamento da página para restaurar o histórico caso o usuário já possua um `sessionId` ativo.

*   **URL:** `GET <n8n_webhook_url>?action=loadPreviousSession&sessionId=<session_id>`
*   **Resposta Esperada (JSON):**
    ```json
    {
      "messages": [
        {
          "role": "user",
          "text": "Olá, quero ir para Lisboa"
        },
        {
          "role": "assistant",
          "text": "Olá! Verifiquei que para Lisboa (LIS)..."
        }
      ]
    }
    ```

---

## 2. Gatilhos Automáticos no Frontend (Parsing da Resposta)

O frontend do **Travelia** monitora ativamente as respostas retornadas pelo agente (via stream ou JSON final) em busca de palavras-chave e padrões para atualizar dinamicamente os elementos visuais.

### A. Detecção de Destino e Animação do Globo (IATA Codes)
O arquivo [chat.js](file:///c:/Users/alevi/Downloads/PJT/Website/chat.js) executa uma expressão regular (`/\b([A-Z]{3})\b/g`) sobre a resposta do bot para identificar códigos IATA de aeroportos (ex: `CDG`, `LIS`, `NRT`, `EZE`).

Quando um código IATA cadastrado é localizado na resposta do bot, o frontend executa automaticamente as seguintes ações:
1.  **Mapa 3D:** Chama `animateFlightRoute(destCoords, cityName, targetIata)` no [globe.js](file:///c:/Users/alevi/Downloads/PJT/Website/globe.js), que:
    *   Apaga rotas anteriores.
    *   Insere um marcador pulsante no destino.
    *   Traça uma linha de voo em formato de arco (Turf.js Great Circle) partindo de **FLN (Florianópolis)** até as coordenadas do IATA.
    *   Faz a câmera dar um zoom suave (`flyTo`) na área da rota.
2.  **Destination Card (Centro):** Exibe um popover sobre o mapa contendo dados como clima, idioma e um gráfico interativo de barras de horários de pico (ex: Coliseu para Roma, Torre Eiffel para Paris).
3.  **População dos Painéis de Dados (Direita):** Triga a carga visual dos painéis de Câmbio, Passagens, Notícias e Orçamento.

---

## 3. Diretrizes de Formatação para o Redator Final (n8n)

Para maximizar a experiência visual do site e garantir que o parsing ocorra perfeitamente, o agente do n8n (em especial o nó **Redator Final**) deve seguir as regras de formatação abaixo ao produzir sua resposta:

1.  **Destaque do Código IATA:**
    Sempre mencione o código IATA do aeroporto de destino em caixa alta de forma clara no texto.
    *   *Bom:* "...seu destino de interesse é **Paris (CDG)**..." ou "...passagens para **Lisboa (LIS)**..."
    *   *Evitar:* "...passagens para o aeroporto Charles de Gaulle em Paris..." (sem o código, o globo não animará).

2.  **Apresentação das Tarifas de Voos:**
    Mantenha valores numéricos legíveis e indique valores individuais e para casal em BRL.
    *   *Exemplo:* "A tarifa mais barata encontrada saindo de FLN é de R$ 4.200 individual ou R$ 8.400 para casal."

3.  **Uso de Markdown Estruturado:**
    Utilize títulos markdown (`####`) para criar seções bem demarcadas que serão renderizadas com cores e bordas premium no balão de chat do frontend.
    *   Use títulos como: `#### Relatório Executivo`, `#### Análise Cambial`, `#### Passagens Aéreas`, `#### Recomendação Final`.

4.  **Payload opcional para cards reais (`TRAVELIA_DATA`):**
    Além do texto em markdown, o Redator Final pode anexar ao final da resposta um comentário HTML invisível com JSON válido. O chat não exibe esse bloco, mas o frontend usa seus dados para preencher os cards laterais com valores reais retornados pelo n8n.

    ```html
    <!-- TRAVELIA_DATA_START
    {
      "recommended_iata": "LIS",
      "city": "Lisboa",
      "flights": [
        {
          "companhia_aerea": "TAP",
          "preco_individual": 4100,
          "preco_casal": 8200,
          "aviso_bagagem": "Valores não incluem bagagem despachada",
          "aviso_variacao": "Preços e disponibilidade podem mudar rapidamente"
        }
      ],
      "exchange": {
        "fiat": [
          { "moeda": "EUR", "variacao_percentual": -0.8 },
          { "moeda": "USD", "variacao_percentual": 1.4 }
        ],
        "cripto": [
          { "ativo": "BTC", "variacao_percentual": -3.2 }
        ]
      },
      "news": [
        { "titulo": "...", "fonte": "...", "data": "...", "link": "..." }
      ],
      "budget": {
        "total_brl": null,
        "breakdown": []
      }
    }
    TRAVELIA_DATA_END -->
    ```

    Regras:
    *   Use `null` quando não houver dado confiável.
    *   Não invente preço, câmbio, notícia ou orçamento.
    *   Mantenha o destino recomendado no campo `recommended_iata`, pois ele tem prioridade sobre outros IATAs encontrados no texto.

---

## 4. Funcionamento Detalhado dos Widgets (Painel Direito)

Caso o n8n forneça as cotações de câmbio e voos, o frontend popula e renderiza os seguintes componentes nativos baseados em canvas e HTML5:

### A. Widget de Análise Cambial (30 dias)
*   **USD e EUR:** Renderiza uma linha de tendência (sparkline) dinâmica em um elemento `<canvas>` baseada nos últimos 30 dias.
*   **Moeda de Destino:** Substitui o terceiro bloco pelo par de moedas correspondente (ex: `JPY / BRL` para Tóquio, `ARS / BRL` para Buenos Aires) atualizando as taxas e cor de tendência (verde ▲ para alta, vermelho ▼ para baixa).
*   **Bitcoin (BTC):** Exibe a flutuação da criptomoeda de forma separada como ativo alternativo.

### B. Widget de Passagens Aéreas
*   Mostra uma lista dos 3 voos mais baratos extraídos da SerpApi Google Flights.
*   Divide os preços em caixas separadas: preço **Individual** e preço **Casal** (preço individual multiplicado por 2, conforme as regras de negócio).
*   Dá destaque visual de menor preço com badge na primeira oferta.

### C. Widget de Economia & Notícias
*   Lista 3 headlines extraídas pelo agente com link direto, fonte da notícia e carimbo de data relativo (ex: "Hoje", "Ontem").

### D. Widget de Orçamento & Planejamento (Budget)
*   **Donut Chart:** Renderiza um gráfico circular dinâmico via canvas dividindo o orçamento em: Transporte/Voos, Hospedagem, Alimentação, Passeios.
*   **Total Estimado:** Atualiza o centro do donut com a soma total do orçamento da viagem calculada pelo agente em reais.
*   **Itinerário:** Apresenta abas interativas do Dia 1 ao Dia 5. Clicar nas abas muda instantaneamente a linha do tempo (timeline) na parte inferior com as atividades sugeridas.

---

## 5. Mapeamento de Coordenadas Cadastradas no Frontend

A tabela de coordenadas abaixo está pré-programada no frontend. Se o agente retornar qualquer um desses códigos IATA, o globo fará a rota instantaneamente:

| Código IATA | Cidade | Continente | Coordenadas [Longitude, Latitude] |
| :--- | :--- | :--- | :--- |
| **FLN** | Florianópolis (Origem) | América do Sul | `[-48.5482, -27.5954]` |
| **CDG / ORY** | Paris | Europa | `[2.5500, 49.0097]` / `[2.3652, 48.7262]` |
| **LIS** | Lisboa | Europa | `[-9.1359, 38.7756]` |
| **MAD** | Madrid | Europa | `[-3.5680, 40.4840]` |
| **BCN** | Barcelona | Europa | `[2.0833, 41.2974]` |
| **FCO** | Roma | Europa | `[12.2389, 41.8003]` |
| **MXP** | Milão | Europa | `[8.7281, 45.6300]` |
| **AMS** | Amsterdã | Europa | `[4.7642, 52.3086]` |
| **LHR** | Londres | Europa | `[-0.4543, 51.4700]` |
| **MIA** | Miami | América do Norte | `[-80.2870, 25.7959]` |
| **JFK** | Nova York | América do Norte | `[-73.7781, 40.6413]` |
| **YYZ** | Toronto | América do Norte | `[-79.6248, 43.6777]` |
| **MEX** | Cidade do México | América do Norte | `[-99.0721, 19.4361]` |
| **LAX** | Los Angeles | América do Norte | `[-118.4085, 33.9416]` |
| **EZE** | Buenos Aires | América do Sul | `[-58.5358, -34.8222]` |
| **SCL** | Santiago | América do Sul | `[-70.7858, -33.3930]` |
| **LIM** | Lima | América do Sul | `[-77.1147, -12.0219]` |
| **BOG** | Bogotá | América do Sul | `[-74.1447, 4.7016]` |
| **MVD** | Montevidéu | América do Sul | `[-56.0305, -34.8384]` |
| **NRT / HND** | Tóquio | Ásia | `[140.3929, 35.7720]` / `[139.7811, 35.5494]` |
| **ICN** | Seul | Ásia | `[126.4407, 37.4602]` |
| **BKK** | Bangkok | Ásia | `[100.7501, 13.6896]` |
| **SIN** | Singapura | Ásia | `[103.9915, 1.3644]` |
| **DXB** | Dubai | Oriente Médio | `[55.3644, 25.2532]` |
| **DOH** | Doha | Oriente Médio | `[51.5651, 25.2611]` |
| **IST** | Istambul | Oriente Médio | `[28.8146, 40.9769]` |
