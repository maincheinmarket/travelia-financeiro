# Product Briefing — Travelia

Este documento serve como o registro de contexto de design (`PRODUCT.md`) para a skill **Impeccable**. Ele define a alma do produto, o público-alvo, a personalidade da marca e as regras de design que devem guiar o agente ao editar, auditar ou criar novas interfaces para o site do **Travelia**.

---

## Register

hybrid (brand & product)
*   **Brand:** Aplicado à Landing Page (comunicação de luxo, apelo estético, tipografia editorial).
*   **Product:** Aplicado ao Dashboard do Consultor (visualização de dados, mapas interativos, painel de chat, cards informativos de câmbio/voos/notícias).

---

## Users

Viajantes que buscam oportunidades inteligentes de passagens aéreas e planejamento de viagens. O público divide-se em:
1.  **Viajantes com rotas e planos bem definidos:** Sabem exatamente para onde vão (ex: Paris, Lisboa) e utilizam o painel financeiro para otimizar a data de compra de passagens, monitorar o risco de câmbio local e organizar o cronograma.
2.  **Viajantes buscando auxílio/sugestões:** Clientes abertos a explorar novos destinos com base no menor custo de voo e no clima ideal de cada continente, confiando no poder de orquestração do concierge multi-agente do n8n.

---

## Product Purpose

O **Travelia** consolida inteligência financeira com curadoria de turismo de luxo. Ele substitui a fricção de buscar voos, pesquisar tendências cambiais e ler notícias macroeconômicas de destinos em múltiplos sites por uma conversa intuitiva com um concierge inteligente, apresentando dados estruturados de forma dinâmica em torno de um globo 3D interativo.

---

## Brand Personality

Um **Concierge de Luxo com a objetividade e rigor de um Analista de Investimentos**. O Travelia fala com tom sofisticado, cortês e altamente prestativo, mas fundamentado em dados numéricos, percentuais reais e clareza analítica. Não há promessas vagas; as recomendações são baseadas em fatos.

*   **Palavras-chave:** Sofisticado, Analítico, Prestativo, Decidido.

---

## Anti-references

Ao desenhar ou propor novos componentes para o Travelia, **evite ativamente**:
*   **Clichês de SaaS de Inteligência Artificial genérica:** Degradês roxos e azuis com neon saturado, fundos totalmente pretos com partículas brilhantes, ou tipografias padrão como `Inter` sem contraste.
*   **Layouts repetitivos ou "AI slop":** Grids idênticos de cards empilhados sem ritmo espacial ou respiro editorial, botões excessivamente arredondados e brilhantes.
*   **Poluição visual no mapa:** Excesso de elementos cobrindo o globo 3D; o mapa satélite deve respirar e as linhas de voo (arcos) devem ser elegantes e finas.
*   **Linguagem evasiva:** Textos que usem "talvez", "provavelmente consideraria". O concierge de luxo escolhe uma direção e recomenda com convicção.

---

## Design Principles

1.  **Rigor Cromático Premium:** A paleta de cores baseia-se exclusivamente em acentos terrosos/areia (`#FFA666`), tons de carvão escuro (`#0D0C0B`), off-white (`#F5F5F5` / `#FFFFFF`) e cinza sutil (`#E4E4E4`), garantindo elegância atemporal.
2.  **Restrição e Respiro:** Menos é mais. Todo elemento na tela (seja um card, linha de tendência ou timeline) deve ter espaçamento amplo e propósito funcional claro. Sem decorações vazias.
3.  **Visualização de Dados Elegante:** Cotações cambiais e orçamentos devem ser fáceis de ler instantaneamente (usando sparklines finos e gráficos donut com contrastes calculados).
4.  **Feedback de Movimento Fluido:** Transições sutis de hover nos botões e nos chips do chat, e animações de arco de voo lineares e orgânicas no globo que conduzam a atenção do usuário para as atualizações dos cards de dados.

---

## Accessibility & Inclusion

*   **Contraste de Cor:** Garantir que textos e cotações fiquem sempre legíveis nos modos escuro e claro (atendendo à especificação WCAG AA).
*   **Redução de Movimento:** Respeitar o estado do `prefers-reduced-motion` do usuário para desativar a rotação automática do globo e suavizar o flyTo.
*   **Estrutura Semântica:** Uso correto de tags `<aside>`, `<section>`, `<header>`, e `<article>` para acessibilidade de leitores de tela.
