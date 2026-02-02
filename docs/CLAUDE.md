# WhatsApp Flow Platform - Documentacao Completa

> **Este arquivo contem todas as informacoes necessarias para continuar o desenvolvimento do sistema.**
> **Ultima atualizacao: 2026-01-23**

---

## INFORMACOES DO SERVIDOR

### Acesso SSH
```bash
ssh root@138.68.21.234
```

### Dados do Servidor
- **IP**: 138.68.21.234
- **OS**: Ubuntu Linux 5.15.0-153-generic x86_64
- **Hostname**: mail.publipropaganda.shop
- **Disco**: 117GB total, 11GB usado, 106GB livre
- **RAM**: 3.8GB total, 1.5GB usado
- **Node.js Path**: `/www/server/nvm/versions/node/v24.12.0/bin/node`

### PM2 - Gerenciamento de Processos
```bash
# Path do PM2
export PATH=$PATH:/www/server/nvm/versions/node/v24.12.0/bin

# Comandos uteis
pm2 list                    # Listar processos
pm2 restart whatsapp-api    # Reiniciar backend
pm2 logs whatsapp-api       # Ver logs
pm2 show whatsapp-api       # Detalhes do processo
```

**Processo ativo:**
- **Nome**: whatsapp-api
- **Script**: /www/wwwroot/api-backend/index.js
- **Logs erro**: /root/.pm2/logs/whatsapp-api-error.log
- **Logs saida**: /root/.pm2/logs/whatsapp-api-out.log

---

## ESTRUTURA DE PASTAS NO SERVIDOR

```
/www/wwwroot/
├── api-backend/                    # Backend Node.js (Express + BullMQ)
│   ├── index.js                    # Arquivo principal (~186KB)
│   ├── campaignActions.js          # Acoes de campanha
│   ├── package.json                # Dependencias
│   ├── .env                        # Variaveis de ambiente
│   ├── node_modules/               # Dependencias
│   └── backups/                    # Backups do index.js
│
├── app.publipropaganda.shop/       # Frontend React (build)
│   └── (arquivos estaticos dist/)
│
├── api.publipropaganda.shop/       # Pasta nginx (proxy para :3000)
├── go.publipropaganda.shop/        # Servico de short links
└── ... (outros dominios)
```

---

## CREDENCIAIS E VARIAVEIS DE AMBIENTE

### Backend (.env - /www/wwwroot/api-backend/.env)
```env
PORT=3000
SUPABASE_URL=https://nwyyrxvsbapnvnrzsrsj.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXlyeHZzYmFwbnZucnpzcnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5Njg1NywiZXhwIjoyMDgzNDcyODU3fQ.QeQVJlcjWtUaJTikQeWuiPfjpbjxIX_ML9eM-0xMhfs
WEBHOOK_VERIFY_TOKEN=meu_token_secreto_123
REDIS_URL=redis://:891278bdf0edda89@127.0.0.1:6379
WHATSAPP_WABA_ID=1200243578598245
WHATSAPP_PHONE_NUMBER_ID=881473848383712
WHATSAPP_ACCESS_TOKEN=EAARVz1NxiaABQfV9Jk3hsEfcNQ29D5JqF6GzZAkBTtTvi0ZC4PdnUEZBprLjDWkeVvBn22W1PSLOdKHehQQOkbkwK2wpQjYUEdDZBa8h8sgsrXrmmnVVtHcu6QbMNcdLwkHAsFcXvAP8XmrVGC0aa5A5C9kywdfu3zjRXKYaLF48yrDccqoEqpZA7MZAdzZBQZDZD
WHATSAPP_PHONE_NUMBER=+5511936189539
WHATSAPP_PIN=123456
DEFAULT_ORGANIZATION_ID=7977793f-b0a4-4267-8699-e8a7b24bcfd6
LINK_DOMAIN=go.publipropaganda.shop
```

### Frontend (.env local)
```env
VITE_SUPABASE_URL=https://nwyyrxvsbapnvnrzsrsj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXlyeHZzYmFwbnZucnpzcnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTY4NTcsImV4cCI6MjA4MzQ3Mjg1N30.t-oT_0h2o52R1y0rPfrT6VyVvOWEySasIHs1umpP1p0
VITE_API_URL=https://api.publipropaganda.shop
```

### Redis
```bash
# Conexao local no servidor
redis-cli -a 891278bdf0edda89

# URL de conexao
redis://:891278bdf0edda89@127.0.0.1:6379
```

---

## URLs E DOMINIOS

| Servico | URL | Descricao |
|---------|-----|-----------|
| Frontend | https://app.publipropaganda.shop | Aplicacao React |
| Backend API | https://api.publipropaganda.shop | Express API (proxy :3000) |
| Short Links | https://go.publipropaganda.shop | Servico de links curtos |
| Supabase | https://nwyyrxvsbapnvnrzsrsj.supabase.co | Banco de dados |
| Supabase Dashboard | https://supabase.com/dashboard/project/nwyyrxvsbapnvnrzsrsj | Painel admin |

---

## ESTRUTURA DO FRONTEND (Local)

```
/Users/andresantos/Documents/ApiWhatsapp/LOVABLE/whatsapp-flow/
├── src/
│   ├── App.tsx                     # Rotas principais
│   ├── main.tsx                    # Entry point
│   ├── pages/                      # Paginas (lazy loaded)
│   │   ├── Auth.tsx                # Login/Cadastro
│   │   ├── Dashboard.tsx           # Painel principal
│   │   ├── Inbox.tsx               # Conversas
│   │   ├── Contacts.tsx            # Contatos
│   │   ├── ContactDetail.tsx       # Detalhe contato
│   │   ├── Flows.tsx               # Lista de fluxos
│   │   ├── FlowEditor.tsx          # Editor visual (ReactFlow)
│   │   ├── Campaigns.tsx           # Campanhas
│   │   ├── CampaignNew.tsx         # Nova campanha
│   │   ├── CampaignDetail.tsx      # Detalhe campanha
│   │   ├── Templates.tsx           # Templates WhatsApp
│   │   ├── Settings.tsx            # Configuracoes
│   │   ├── Monitor.tsx             # Monitor de fila
│   │   ├── Logs.tsx                # Logs do sistema
│   │   ├── Warming.tsx             # Pools de aquecimento
│   │   └── WarmingDetail.tsx       # Detalhe do pool
│   │
│   ├── contexts/                   # Estados globais
│   │   ├── AuthContext.tsx         # Autenticacao
│   │   ├── OrganizationContext.tsx # Multi-tenancy
│   │   └── WABAContext.tsx         # WABA selecionada
│   │
│   ├── hooks/                      # React Query hooks
│   │   ├── useContacts.ts
│   │   ├── useCampaigns.ts
│   │   ├── useFlows.ts
│   │   ├── useTemplates.ts
│   │   ├── useWhatsAppAccounts.ts
│   │   ├── useWarmingPools.ts
│   │   ├── useQueueMetrics.ts
│   │   ├── useConversations.ts
│   │   ├── useDashboard.ts
│   │   ├── useCustomFields.ts
│   │   ├── useLogs.ts
│   │   └── ... (outros)
│   │
│   ├── components/                 # Componentes React
│   │   ├── ui/                     # Shadcn/UI (40+ componentes)
│   │   ├── layout/                 # Layout
│   │   ├── flows/                  # Editor de fluxos
│   │   ├── campaigns/              # Campanhas
│   │   ├── contacts/               # Contatos
│   │   ├── inbox/                  # Inbox
│   │   ├── monitor/                # Monitoramento
│   │   └── settings/               # Configuracoes
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts               # Cliente Supabase
│   │   └── types.ts                # Tipos gerados (39 tabelas)
│   │
│   └── lib/                        # Utilitarios
│       ├── utils.ts
│       ├── flowUtils.ts
│       └── whatsappLimits.ts
│
├── backups/                        # Backups locais
├── dist/                           # Build de producao
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## TABELAS DO BANCO DE DADOS (Supabase)

### Principais Tabelas

| Tabela | Descricao |
|--------|-----------|
| **organizations** | Organizacoes (multi-tenancy) |
| **organization_members** | Membros de organizacoes |
| **profiles** | Perfis de usuarios |
| **whatsapp_accounts** | Contas WABA |
| **phone_numbers** | Numeros de telefone |
| **contacts** | Contatos |
| **conversations** | Conversas |
| **messages** | Mensagens |
| **message_templates** | Templates WhatsApp |
| **flows** | Fluxos de automacao |
| **flow_nodes** | Nos dos fluxos |
| **flow_edges** | Conexoes dos fluxos |
| **flow_executions** | Execucoes de fluxos |
| **flow_execution_logs** | Logs de execucao |
| **campaigns** | Campanhas |
| **campaign_messages** | Mensagens de campanha |
| **warming_pools** | Pools de aquecimento |
| **warming_pool_members** | WABAs no pool |
| **warming_pool_flows** | Fluxos do pool |
| **warming_member_messages** | Mensagens por WABA |
| **warming_contact_history** | Historico de contatos |
| **warming_events_log** | Logs do warming |
| **queue_metrics** | Metricas da fila |
| **phone_number_metrics** | Metricas por numero |
| **api_keys** | Chaves de API |
| **webhook_logs** | Logs de webhooks |
| **system_logs** | Logs do sistema |

### Funcoes RPC

| Funcao | Descricao |
|--------|-----------|
| `get_dashboard_metrics` | Metricas do dashboard |
| `get_messages_per_day` | Mensagens por dia |
| `get_top_flows` | Fluxos mais usados |
| `get_message_status_distribution` | Distribuicao de status |
| `get_recent_activity` | Atividades recentes |
| `get_pending_conversations` | Conversas pendentes |
| `get_phone_performance` | Performance por numero |
| `get_warming_pool_stats` | Stats do warming |
| `select_warming_waba` | Selecao de WABA (warming) |

---

## ENDPOINTS DA API BACKEND

### WhatsApp
```
POST /api/messages/send              # Enviar mensagem
POST /api/waba/setup                 # Configurar nova WABA
POST /api/waba/:id/sync-status       # Sincronizar status
GET  /api/phone-numbers/stats        # Stats dos numeros
GET  /api/phone-numbers/:id/info     # Info do numero
```

### Templates
```
GET  /api/templates                  # Listar templates
POST /api/templates/sync             # Sincronizar do Meta
```

### Campanhas
```
POST /api/campaigns/:id/start        # Iniciar campanha
GET  /api/campaigns/:id/metrics      # Metricas da campanha
```

### Fila (BullMQ)
```
GET  /api/queue/status               # Status da fila
GET  /api/queue/workers              # Info dos workers
GET  /api/queue/errors               # Erros recentes
GET  /api/queue/paused               # Se esta pausada
POST /api/queue/pause                # Pausar fila
POST /api/queue/resume               # Retomar fila
POST /api/queue/retry-failed         # Reprocessar falhos
```

### Webhooks
```
GET  /webhook                        # Verificacao do Meta
POST /webhook                        # Receber eventos
```

### Fluxos
```
POST /api/flows/:id/execute          # Executar fluxo
```

### Logs
```
GET  /api/logs                       # Buscar logs
GET  /api/logs/stats                 # Estatisticas
```

---

## COMANDOS UTEIS

### Deploy Frontend
```bash
# No diretorio local
npm run build
scp -r dist/* root@138.68.21.234:/www/wwwroot/app.publipropaganda.shop/
```

### Deploy Backend
```bash
# Copiar arquivo
scp index.js root@138.68.21.234:/www/wwwroot/api-backend/

# Reiniciar no servidor
ssh root@138.68.21.234 "export PATH=\$PATH:/www/server/nvm/versions/node/v24.12.0/bin && pm2 restart whatsapp-api"
```

### Backup Backend
```bash
ssh root@138.68.21.234 "cd /www/wwwroot/api-backend && cp index.js index.js.bkp_\$(date +%Y%m%d_%H%M%S)"
```

### Ver Logs em Tempo Real
```bash
ssh root@138.68.21.234 "export PATH=\$PATH:/www/server/nvm/versions/node/v24.12.0/bin && pm2 logs whatsapp-api --lines 100"
```

---

## TECNOLOGIAS UTILIZADAS

### Frontend
- **React 18** + TypeScript
- **Vite** (build tool)
- **TanStack Query** (estado servidor)
- **Shadcn/UI** + Tailwind CSS
- **ReactFlow** (editor de fluxos)
- **Recharts** (graficos)
- **Supabase Client**

### Backend
- **Node.js 24** + Express 5
- **BullMQ** (fila de mensagens)
- **Redis 7** (cache/fila)
- **Supabase** (database)
- **Axios** (HTTP client)

### Infraestrutura
- **DigitalOcean** (VPS)
- **aaPanel** (gerenciamento)
- **Nginx** (reverse proxy)
- **PM2** (process manager)
- **Let's Encrypt** (SSL)

---

## FLUXO DE DADOS

```
Usuario
   │
   ▼
Frontend (React)
   │
   ├──► Supabase (auth, queries)
   │
   └──► Backend API (Express)
           │
           ├──► Supabase (service role)
           ├──► Redis (BullMQ)
           └──► WhatsApp Cloud API
```

---

## SISTEMA DE WARMING (Aquecimento)

### Conceito
Distribui mensagens entre multiplas WABAs para "aquecer" os numeros gradualmente.

### Tabelas
- `warming_pools` - Configuracao do pool
- `warming_pool_members` - WABAs participantes
- `warming_member_messages` - Fluxo de mensagens por WABA
- `warming_contact_history` - Progresso dos contatos
- `warming_events_log` - Auditoria

### Campos Importantes (warming_pools)
- `rotation_strategy`: least_used, round_robin, quality_first, weighted, random
- `allowed_days`: [0,1,2,3,4,5,6] (0=domingo, 6=sabado)
- `time_window_start/end`: horario permitido (ex: 08:00 - 20:00)
- `warmup_enabled`: rampa gradual
- `warmup_days`: duracao da rampa
- `warmup_start_volume/end_volume`: limites
- `pause_on_quality`: RED, YELLOW, OFF

### RPC Principal
```sql
select_warming_waba(pool_id UUID)
-- Retorna o ID da WABA a ser usada
-- Considera: allowed_days, time_window, quality, daily_limit
```

---

## SISTEMA DE CAMPANHAS

### Status
- `draft` - Rascunho
- `scheduled` - Agendada
- `running` - Em execucao
- `paused` - Pausada
- `completed` - Finalizada
- `cancelled` - Cancelada

### Campos (campaigns.stats)
```json
{
  "total": 100,
  "sent": 80,
  "delivered": 75,
  "read": 50,
  "failed": 5,
  "metrics": {
    "avgSpeed": 45.2,
    "maxSpeed": 80.0,
    "duration": 1250,
    "history": [...]
  }
}
```

### Metricas
- `avgSpeed`: velocidade media (msg/s)
- `maxSpeed`: pico de velocidade
- `duration`: duracao em ms
- `history`: array de pontos para grafico

---

## SISTEMA DE FLUXOS

### Tipos de Nos
- **Triggers**: webhook, message_received, contact_created, scheduled
- **Conditions**: if_else, switch
- **Actions**: send_template, send_text, wait, update_contact, add_tag, http_request

### Validacao
- Exatamente 1 trigger por fluxo
- Todos os nos devem ter entrada (exceto trigger)
- Conditions devem ter caminhos true/false

---

## NOTAS IMPORTANTES

1. **Multi-tenancy**: Todos os dados sao filtrados por `organization_id` usando RLS
2. **WABA Selection**: Sempre usar `selectedWABA` do context ou parametro explicito
3. **Rate Limits**: WhatsApp tem limite de 80 msg/s por numero
4. **Proxy**: Configuravel por WABA para evitar bloqueios
5. **Backups**: Sempre fazer backup antes de mudancas no backend

---

## TAREFAS PENDENTES

- [ ] Criar coleta de metricas por numero de telefone
- [ ] Criar RPC get_phone_performance
- [ ] Implementar grafico de performance por numero no Monitor

---

## CONTATO

**Desenvolvedor**: Andre Santos
**Projeto**: WhatsApp Flow Platform
**Pasta Local**: /Users/andresantos/Documents/ApiWhatsapp/LOVABLE/whatsapp-flow
