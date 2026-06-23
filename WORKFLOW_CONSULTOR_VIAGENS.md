# Workflow: Consultor de Viagens Financeiro

## Objetivo

Este workflow no n8n implementa um consultor de viagens financeiro com arquitetura multi-agente. Ele conversa com o usuário, coleta preferências de viagem, consulta dados externos de câmbio, voos e notícias econômicas, e entrega um relatório final em tom luxo/persuasivo com base financeira objetiva.

O workflow está no n8n com o nome:

```text
Consultor de Viagens Financeiro (Multi-Agent)
```

ID do workflow:

```text
3jsyAK3vWufht9QF
```

## Arquitetura Geral

O fluxo usa o padrão:

```text
Chat Trigger
  -> Supervisor / Concierge
      -> Analista de Cambio
      -> Emissor de Passagens
      -> Analista Economico
      -> Redator Final
```

O Supervisor é o único nó conectado ao fluxo principal do chat. Os demais agentes são ferramentas LangChain conectadas ao Supervisor via `ai_tool`.

Essa arquitetura evita loops no fluxo principal: existe apenas uma conexão `main`, do `Chat Trigger` para o Supervisor. Todas as chamadas aos especialistas acontecem como ferramentas internas do agente.

## Entrada do Usuário

O usuário pode escrever em linguagem natural.

Exemplo:

```text
Quero planejar uma viagem para Paris em outubro, saindo de Florianopolis. Prefiro portugues e quero ver os valores em euro.
```

O sistema foi alinhado para aceitar destino em texto livre. O Supervisor tenta inferir o código IATA quando for seguro. Se houver ambiguidade, ele pergunta ao usuário.

Exemplos:

```text
Paris -> CDG ou ORY; se ambíguo, perguntar.
Lisboa -> LIS.
Toquio -> HND ou NRT; se ambíguo, perguntar.
```

Se faltarem datas de ida e volta, o Supervisor deve perguntar antes de acionar o subagente de passagens.

## Modelo dos Agentes

### Supervisor

Nó:

```text
Supervisor (Concierge)1
```

Modelo conectado:

```text
Groq (Llama 4 Scout - Supervisor)
```

Tipo do modelo:

```text
@n8n/n8n-nodes-langchain.lmChatGroq
```

Modelo:

```text
meta-llama/llama-4-scout-17b-16e-instruct
```

Temperatura:

```text
0
```

Limite de saída:

```text
maxTokensToSample=4096
```

Observação sobre limite Groq:

```text
No plano gratuito atual, o qwen/qwen3.6-27b tinha limite prático observado de 8000 TPM.
O orquestrador foi trocado para meta-llama/llama-4-scout-17b-16e-instruct, que tem limite gratuito publicado de 30K TPM.
O pedido total conta prompt + tools + memória + maxTokensToSample.
Por isso o Supervisor pode voltar a usar 4096 tokens de saída com mais estabilidade.
```

Responsabilidade:

- Conversar com o usuário.
- Trabalhar com o mínimo input possível do usuário.
- Não perguntar idioma; inferir pelo país, continente ou destino.
- Não perguntar moeda quando for inferível; usar BRL como base e destacar moeda local ou moeda pedida.
- Escolher destinos candidatos quando o usuário informar algo amplo como continente, país, região, praia, frio ou barato.
- Comparar destinos por preço antes de recomendar.
- Inferir datas relativas quando possível.
- Tentar inferir IATA quando seguro.
- Decidir a ordem correta de acionamento dos subagentes.
- Evitar chamadas repetidas às mesmas ferramentas.
- Consolidar os dados dos especialistas e enviar ao Redator Final.
- Responder ao usuário apenas com o resultado final quando a análise estiver completa.

O Llama 4 Scout foi escolhido para o Supervisor porque oferece TPM gratuito maior no Groq e esta é a função mais pesada do workflow: entender intenção, inferir dados, comparar destinos, evitar loops e chamar ferramentas na ordem certa.

Regra de data atual:

```text
O prompt do Supervisor usa $now em America/Sao_Paulo para gerar a data atual dinamicamente.
```

Interpretação obrigatória de datas relativas:

```text
hoje = data atual
amanhã = data atual + 1 dia
daqui 10 dias = data atual + 10 dias
semana que vem = viagem padrão de 5 noites, ida na terça-feira da próxima semana civil e volta no domingo seguinte
mês que vem = viagem padrão de 7 noites, ida na segunda terça-feira do próximo mês civil e volta 7 dias depois
dia/mês sem ano = próxima ocorrência futura, nunca data passada
```

Regra de consultoria proativa:

```text
O cliente geralmente não sabe exatamente o destino ideal.
Se ele disser "quero ir para Europa mês que vem", o Supervisor não deve perguntar cidade, idioma ou moeda.
Ele deve inferir datas, escolher destinos candidatos, comparar voos por menor preço e entregar opções.
```

Destinos candidatos padrão por região:

```text
Europa: LIS, MAD, BCN, CDG, FCO, MXP, AMS, LHR
América do Norte: MIA, JFK, YYZ, MEX, LAX
América do Sul: EZE, SCL, LIM, BOG, MVD
Ásia: NRT, HND, ICN, BKK, SIN
Oriente Médio: DXB, DOH, IST
África: CPT, JNB, CMN, CAI
```

Limite operacional:

```text
Comparar até 5 destinos candidatos por solicitação sem pedir autorização adicional.
```

### Analista de Cambio

Nó:

```text
Analista de Cambio
```

Modelo:

```text
OpenRouter (GPT OSS 120b - Cambio)
openai/gpt-oss-120b:free
```

Base URL:

```text
https://openrouter.ai/api/v1
```

Temperatura:

```text
0
```

Missão:

Obter flutuação dos últimos 30 dias contra BRL para:

```text
USD, EUR, GBP, NOK, SEK, CNY, JPY, BTC
```

Ferramentas conectadas:

```text
Frankfurter API (Fiat 30d)
CoinGecko API (BTC 30d)
```

APIs:

```text
Frankfurter:
https://api.frankfurter.app/{data_inicio}..{data_fim}?from=BRL&to=USD,EUR,GBP,NOK,SEK,CNY,JPY

CoinGecko:
https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=brl&days=30&interval=daily
```

Saída esperada:

```json
{
  "base": "BRL",
  "periodo_dias": 30,
  "fiat": [
    {
      "moeda": "USD",
      "cotacao_inicio": null,
      "cotacao_fim": null,
      "variacao_percentual": null,
      "fonte": "Frankfurter"
    }
  ],
  "cripto": [
    {
      "ativo": "BTC",
      "preco_inicio_brl": null,
      "preco_fim_brl": null,
      "variacao_percentual": null,
      "fonte": "CoinGecko"
    }
  ],
  "observacoes": []
}
```

Regras:

- Nunca inventar dados.
- Usar `null` quando a API não trouxer campo suficiente.
- Retornar JSON estrito.

### Emissor de Passagens

Nó:

```text
Emissor de Passagens1
```

Modelo:

```text
OpenRouter (GPT OSS 120b - Passagens)
openai/gpt-oss-120b:free
```

Base URL:

```text
https://openrouter.ai/api/v1
```

Temperatura:

```text
0
```

Missão:

Buscar os 3 voos mais baratos usando SerpApi Google Flights para um destino IATA por chamada, sempre saindo de Florianópolis:

```text
departure_id=FLN
```

Ferramenta conectada:

```text
SerpApi Google Flights (FLN)
```

Endpoint:

```text
https://serpapi.com/search.json
```

Parâmetros principais:

```text
engine=google_flights
departure_id=FLN
arrival_id=<IATA inferido ou confirmado>
outbound_date=<YYYY-MM-DD>
return_date=<YYYY-MM-DD>
type=1
adults=1
currency=BRL
hl=pt-br
gl=br
sort_by=2
```

Observações:

- `type=1` indica ida e volta.
- `sort_by=2` ordena por preço.
- A SerpApi retorna voos em `best_flights` e/ou `other_flights`.
- O preço individual fica no campo `price`.
- A companhia pode ser obtida em `flights[0].airline`.
- Quando o usuário informar destino amplo, o Supervisor pode chamar este subagente múltiplas vezes, uma por IATA candidato, para comparar preço.
- O Emissor continua pesquisando apenas um destino IATA por chamada.

Saída esperada:

```json
{
  "origem": "FLN",
  "destino_texto": "Paris",
  "destino_iata": "CDG",
  "moeda": "BRL",
  "criterio": "menor_preco",
  "voos": [
    {
      "companhia_aerea": "Airline",
      "preco_individual": 3500,
      "preco_casal": 7000,
      "moeda": "BRL",
      "aviso_bagagem": "Valores nao incluem bagagem despachada",
      "aviso_variacao": "Precos e disponibilidade podem mudar rapidamente"
    }
  ],
  "fonte": "SerpApi Google Flights",
  "observacoes": []
}
```

Regras:

- Não chamar este agente sem `arrival_id`, `outbound_date` e `return_date`.
- Combinar `best_flights` e `other_flights`.
- Ordenar por `price` ascendente.
- Retornar apenas os 3 menores preços.
- Multiplicar `preco_individual` por 2 para `preco_casal`.
- Nunca inventar dados.

### Analista Economico

Nó:

```text
Analista Economico
```

Modelo:

```text
OpenRouter (GPT OSS 120b - Economico)
openai/gpt-oss-120b:free
```

Base URL:

```text
https://openrouter.ai/api/v1
```

Temperatura:

```text
0
```

Missão:

Pesquisar notícias econômicas recentes sobre:

```text
Economia [Pais/Continente]
```

Ferramenta conectada:

```text
SerpApi Tool (Google News)
```

Endpoint:

```text
https://serpapi.com/search.json
```

Parâmetros:

```text
engine=google_news
q=Economia <Pais/Continente>
hl=pt-BR
gl=br
so=1
```

Observações:

- `so=1` ordena por data.
- A resposta principal vem em `news_results`.
- Campos relevantes: `title`, `source.name`, `link`, `date`, `iso_date`.

Saída esperada:

```json
{
  "consulta": "Economia Europa",
  "noticias": [
    {
      "titulo": "...",
      "fonte": "...",
      "data": "...",
      "iso_date": "...",
      "link": "...",
      "resumo": "..."
    }
  ],
  "fonte": "SerpApi Google News"
}
```

Regras:

- Retornar 3 manchetes.
- Usar apenas itens retornados pela ferramenta.
- Nunca inventar manchetes.
- Retornar JSON estrito.

### Redator Final

Nó:

```text
Redator Final1
```

Modelo:

```text
OpenRouter (Gemma-4-26b - Redator)
google/gemma-4-26b-a4b-it:free
```

Base URL:

```text
https://openrouter.ai/api/v1
```

Temperatura:

```text
0.7
```

Missão:

Receber o JSON consolidado com:

- voos;
- câmbio;
- notícias econômicas;
- destino;
- datas;
- preferências do usuário.

Transformar isso em relatório final humano, empático e persuasivo.

Tom:

```text
Luxo/persuasivo, com seção financeira objetiva.
```

Estrutura esperada:

1. Resumo executivo.
2. Destino e período.
3. Câmbio e risco financeiro.
4. Voos por menor preço.
5. Contexto econômico recente.
6. Recomendação final.

Regras:

- Responder no idioma solicitado pelo usuário.
- Usar BRL como base financeira.
- Destacar também a moeda escolhida pelo usuário.
- Preservar avisos:

```text
Valores nao incluem bagagem despachada
Precos, disponibilidade e cambio podem mudar rapidamente
```

- Não inventar preços, datas, companhias, aeroportos, manchetes ou percentuais.
- Se algum bloco de dados estiver incompleto, explicar a limitação de forma elegante e objetiva.

## Memória

O workflow usa memória persistente em Supabase Postgres.

Arquitetura atual:

```text
uma memória Postgres separada por agente
```

Tipo:

```text
@n8n/n8n-nodes-langchain.memoryPostgresChat
```

Nós e tabelas:

```text
Memoria Supervisor  -> public.n8n_chat_histories      -> contextWindowLength=2
Memoria Cambio      -> public.n8n_memory_cambio       -> contextWindowLength=2
Memoria Passagens   -> public.n8n_memory_passagens    -> contextWindowLength=2
Memoria Economico   -> public.n8n_memory_economico    -> contextWindowLength=2
Memoria Redator     -> public.n8n_memory_redator      -> contextWindowLength=2
```

Configuração:

```text
sessionIdType=fromInput
```

Credencial n8n:

```text
Postgres account
```

Memória conectada a:

```text
Memoria Supervisor -> Supervisor (Concierge)1
Memoria Cambio -> Analista de Cambio
Memoria Passagens -> Emissor de Passagens1
Memoria Economico -> Analista Economico
Memoria Redator -> Redator Final1
```

O objetivo da separação é evitar que saídas JSON dos especialistas poluam o histórico do Supervisor, reduzindo loops e consumo de tokens no Groq. O controle de fluxo continua no Supervisor.

## Supabase

Projeto Supabase:

```text
yowxxtvzzqxpwdjjozng
```

URL:

```text
https://yowxxtvzzqxpwdjjozng.supabase.co
```

Conexão n8n:

Usar Postgres via Supabase Session Pooler, não Direct Connection.

Motivo:

O direct connection resolve para IPv6 e pode falhar no n8n Cloud com:

```text
connect ENETUNREACH ... :5432
```

Formato correto do pooler:

```text
Host: aws-0-REGIAO.pooler.supabase.com
Port: 5432
Database: postgres
User: postgres.yowxxtvzzqxpwdjjozng
Password: senha do banco
SSL: Require
Ignore SSL Issues: ON, se o n8n reclamar de self-signed certificate
```

## Estrutura do Banco

### public.n8n_chat_histories

Tabela usada pelo `Postgres Chat Memory` do n8n.

Colunas:

```text
id bigint primary key
session_id varchar(255)
message jsonb
created_at timestamptz
```

Uso:

- Armazena mensagens `human` e `ai`.
- Usada automaticamente pelo nó de memória.

### public.travel_user_preferences

Tabela para preferências estruturadas.

Colunas principais:

```text
session_id
idioma
moeda_preferida
moeda_base
continente
destino_texto
destino_iata
outbound_date
return_date
preferencias jsonb
ultima_recomendacao jsonb
```

Uso previsto:

- Guardar preferências extraídas da conversa.
- Facilitar retomada de contexto e personalização.

### public.travel_agent_events

Tabela opcional para auditoria de agentes.

Colunas:

```text
session_id
agent_name
event_type
payload jsonb
created_at
```

Uso previsto:

- Logar chamadas de ferramentas.
- Guardar saídas intermediárias.
- Auditar decisões do Supervisor e especialistas.

### Views

```text
travel_memory_sessions
travel_recent_messages
travel_preferences_overview
```

As views foram criadas com:

```text
security_invoker = true
```

O Security Advisor do Supabase foi verificado e ficou sem lints.

## Credenciais no n8n

Credenciais atuais relevantes:

```text
OpenAI account
Query Auth account
Groq account
Postgres account
```

Uso:

```text
Groq account:
  usado pelo Supervisor/Llama 4 Scout.

OpenAI account:
  usado pelos modelos OpenAI Chat Model apontando para OpenRouter.
  A credencial deve ter API key do OpenRouter.
  O Base URL dos nós deve permanecer em https://openrouter.ai/api/v1.

Query Auth account:
  usado pela SerpApi em query param api_key.

Postgres account:
  usado pela memória persistente Supabase Postgres.
```

## APIs Externas

### Groq

Usado apenas no Supervisor.

```text
Modelo: meta-llama/llama-4-scout-17b-16e-instruct
```

### OpenRouter

Usado nos especialistas e no Redator.

```text
Base URL: https://openrouter.ai/api/v1
```

Modelos:

```text
openai/gpt-oss-120b:free
google/gemma-4-26b-a4b-it:free
```

### SerpApi

Usada para:

- Google Flights;
- Google News.

Autenticação:

```text
api_key via query param
```

### Frankfurter

Usada para câmbio fiat.

Não exige credencial.

### CoinGecko

Usada para BTC/BRL.

Não exige credencial na configuração atual.

## Fluxo de Execução Esperado

1. Usuário inicia conversa.
2. Supervisor pergunta:

```text
Qual continente prefere?
Qual idioma?
Qual moeda?
```

3. Supervisor coleta ou pergunta destino e datas.
4. Se destino estiver em texto livre, tenta inferir IATA.
5. Se IATA ou datas estiverem ambíguos, pergunta ao usuário.
6. Quando houver dados suficientes, chama:

```text
Analista de Cambio
Emissor de Passagens
Analista Economico
Redator Final
```

7. Redator Final gera o relatório.
8. Supervisor retorna o relatório ao usuário.
9. A conversa é salva em `n8n_chat_histories`.

## Regras Para Evitar Loops

- Só o Supervisor está no fluxo principal.
- Subagentes são ferramentas, não nós `main`.
- O Supervisor deve seguir a ordem obrigatória de ferramentas.
- O Supervisor não deve chamar a mesma ferramenta novamente se já recebeu dados válidos para a mesma solicitação.
- O Emissor de Passagens não deve ser chamado sem:

```text
arrival_id
outbound_date
return_date
```

- O Redator Final deve ser chamado apenas depois de receber dados dos especialistas ou explicação clara de dados ausentes.

## Prompts Atuais

Os system prompts foram atualizados para usar blocos XML-like, como:

```text
<PAPEL>
<MISSÃO>
<REGRAS_ESTRITAS>
```

Objetivo:

- reduzir alucinações;
- deixar o Supervisor apenas como coordenador;
- impedir que especialistas conversem com o usuário;
- forçar Câmbio, Passagens e Econômico a retornarem exclusivamente JSON;
- evitar loops de ferramenta;
- preservar o Redator Final como único responsável por transformar os dados em resposta humana.

Resumo dos prompts:

```text
Supervisor:
  Concierge Executivo de Viagens de Luxo.
  Coordena os subagentes.
  Não calcula e não inventa preços.
  Pergunta continente/destino, idioma e moeda.
  Só aciona ferramentas quando houver IATA, datas e moeda.
  Responde ao usuário somente com o texto do Redator Final quando o relatório estiver completo.

Analista de Cambio:
  Analista Financeiro Quantitativo.
  Sem personalidade e sem conversa.
  Usa Frankfurter e CoinGecko.
  Responde exclusivamente JSON válido.

Emissor de Passagens:
  Analista de Emissão Aérea.
  Usa SerpApi Google Flights.
  Origem sempre FLN.
  Ordena por menor preço.
  Calcula preco_casal = preco_individual * 2.
  Responde exclusivamente JSON válido.

Analista Economico:
  Jornalista de Dados Económicos.
  Usa SerpApi Google News.
  Retorna apenas 3 manchetes em JSON.

Redator Final:
  Copywriter de turismo de luxo e finanças.
  Recebe JSONs dos especialistas.
  Escreve o relatório final no idioma solicitado.
  Pode usar emojis e negritos.
  Não inventa números nem fatos.
```

## Testes Já Realizados

Teste mínimo:

```text
Chat input: Ola, quero planejar uma viagem.
```

Resultado:

```text
Execution success
Memoria Supervisor: load/save success
Groq Qwen Supervisor: success
Supervisor: success
```

Memória confirmada no Supabase:

```text
human: Ola, quero planejar uma viagem.
ai: resposta inicial do concierge.
```

View validada:

```text
public.travel_memory_sessions
```

## Próximos Passos Recomendados

1. Testar conversa completa com:

```text
continente
idioma
moeda
destino em texto livre
datas de ida e volta
```

2. Validar se o Supervisor infere IATA corretamente.
3. Validar chamadas SerpApi Flights e News.
4. Validar se os especialistas usam a memória sem poluir a conversa.
5. Adicionar, se necessário, um nó/ferramenta para salvar preferências estruturadas em `travel_user_preferences`.
6. Adicionar logging opcional em `travel_agent_events` para auditoria das decisões e respostas intermediárias.

## Último Teste Observado

Execução manual `15`:

```text
Status: error
Último nó: Supervisor (Concierge)1
Erro principal: Groq rate limit no modelo qwen/qwen3.6-27b
Limite informado: 8000 TPM
Solicitado: 7552 tokens
```

Também foi observado no contexto da execução:

```text
SerpApi Google Flights (FLN): 401 Invalid API key
```

Correções aplicadas após esse teste:

- Memória separada por agente.
- Contexto do Supervisor ajustado para 4 interações.
- Contexto dos especialistas reduzido para 2 interações.
- Orquestrador trocado de qwen/qwen3.6-27b para meta-llama/llama-4-scout-17b-16e-instruct por causa do TPM gratuito maior.
- Saída máxima do Supervisor ajustada para 4096 tokens.
- Prompt do Supervisor reforçado para usar datas futuras quando o usuário informar dia/mês sem ano.

Execução manual `17`:

```text
Status: success
Observação: o Supervisor consumiu o limite de 1024 tokens anterior e retornou saída vazia com finish_reason=length, sem chamar ferramentas.
Correção posterior: orquestrador migrado para Llama 4 Scout, maxTokensToSample ajustado para 4096 e prompt reforçado para não gastar tokens com raciocínio textual.
```

Execução manual `18`:

```text
Status: running
Observação: ficou pendurada no Chat Trigger antes de chegar ao Supervisor; não validou SerpApi.
```

Correção adicional aplicada:

```text
Base URL recolocado explicitamente nos modelos OpenRouter:
https://openrouter.ai/api/v1
```

Atualização posterior:

```text
Supervisor passou a usar data atual dinâmica via $now.setZone('America/Sao_Paulo').
Prompt agora cobre hoje, amanhã, semana que vem, mês que vem, daqui N dias e dia/mês sem ano.
```

## Observações Para Outra LLM

- Não troque todos os modelos para Groq; Groq deve ficar apenas no Supervisor.
- O Supervisor atual usa Groq/Llama 4 Scout por limite gratuito maior de TPM.
- Especialistas continuam em GPT OSS via OpenRouter.
- Redator continua em Gemma via OpenRouter.
- Não use direct connection do Supabase no n8n Cloud; use Session Pooler.
- Não remova `sort_by=2` do Google Flights; ele é necessário para priorizar menor preço.
- Não remova `so=1` do Google News; ele prioriza notícias recentes.
- Não faça o Supervisor perguntar idioma; ele deve inferir.
- Não force o usuário a escolher cidade quando ele informar continente/região; o agente deve comparar candidatos e recomendar pelo menor preço.
- Para inputs como "Europa mês que vem", o comportamento esperado é: inferir datas padrão, testar até 5 destinos candidatos, escolher melhor custo e entregar relatório.
- Não conecte especialistas ao fluxo `main`; eles devem permanecer como `ai_tool`.
- Qualquer mudança em credenciais deve ser feita pelo usuário no n8n; o MCP não expõe segredos.
