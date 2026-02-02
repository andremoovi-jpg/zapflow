# LEIA-ME-SEMPRE - Estado Atual do Projeto

> **Ultima atualizacao**: 30/01/2026 12:15
> **Sempre leia este arquivo ao iniciar uma nova sessao**

---

## CREDENCIAIS IMPORTANTES

### Servidor (SSH)
```bash
ssh root@138.68.21.234
```
- **IP**: 138.68.21.234
- **Usuario**: root
- **Backend path**: /www/wwwroot/api-backend/index.js
- **Frontend path**: /www/wwwroot/app.publipropaganda.shop/

### PM2 (Gerenciador de processos)
```bash
export PATH=$PATH:/www/server/nvm/versions/node/v24.12.0/bin
pm2 restart whatsapp-api
pm2 logs whatsapp-api
```

### Supabase
- **URL**: https://nwyyrxvsbapnvnrzsrsj.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/nwyyrxvsbapnvnrzsrsj
- **Service Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXlyeHZzYmFwbnZucnpzcnNqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzg5Njg1NywiZXhwIjoyMDgzNDcyODU3fQ.QeQVJlcjWtUaJTikQeWuiPfjpbjxIX_ML9eM-0xMhfs
- **Anon Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eXlyeHZzYmFwbnZucnpzcnNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTY4NTcsImV4cCI6MjA4MzQ3Mjg1N30.t-oT_0h2o52R1y0rPfrT6VyVvOWEySasIHs1umpP1p0
- **CLI Token**: sbp_a2d69c9b504b372cb5bf0e721a2a1d07c7416cf3

### Redis
```bash
redis-cli -a 891278bdf0edda89
# URL: redis://:891278bdf0edda89@127.0.0.1:6379
```

### URLs de Producao
- **Frontend**: https://app.publipropaganda.shop
- **Backend API**: https://api.publipropaganda.shop
- **Short Links**: https://go.publipropaganda.shop

---

## ESTADO ATUAL DO PROJETO

### O que foi implementado HOJE (30/01/2026):

1. **Sistema de Analytics Completo**
   - RPCs criadas no Supabase:
     - `get_campaign_analytics` - Stats de campanha
     - `get_flow_analytics` - Stats de fluxo
     - `get_flow_node_stats_simple` - Stats por no do fluxo
     - `get_phone_performance` - Performance por numero
     - `get_dashboard_analytics` - Dashboard geral
     - `get_warming_analytics` - Analytics de warming
     - `get_warming_funnel` - Funil de conversao do warming

2. **Analytics no Editor de Fluxo**
   - Botao "Analytics" no header do FlowEditor
   - Badges nos nos mostrando: quantidade de entradas, taxa de conclusao
   - Arquivo: `src/pages/FlowEditor.tsx`

3. **Analytics de Warming (Funil Completo)**
   - Funil geral: Enviadas → Entregues → Lidas → Clique Botao → Clique Link → Respostas
   - Tabela comparativa por WABA
   - "Respostas" conta apenas texto/audio/imagem (excluindo cliques de botao)
   - Arquivo: `src/pages/WarmingDetail.tsx`

4. **Correcao de Contadores do Warming**
   - Backend atualizado para incrementar contadores ao enviar mensagens
   - Campos atualizados: `warming_contact_history.messages_sent`, `warming_pool_members.messages_sent_today`, `warming_pools.total_messages_sent`
   - Arquivo no servidor: `/www/wwwroot/api-backend/index.js` (linha ~606)

5. **Limpeza de Contatos**
   - Deletados 1654 contatos que NAO tinham tags "play55" e "PREMIACOESSINCERO"
   - Restaram 779 contatos com essas tags

### Arquivos Principais Modificados:
- `src/hooks/useAnalytics.ts` - Hooks para todas as RPCs de analytics
- `src/pages/FlowEditor.tsx` - Analytics por no
- `src/pages/WarmingDetail.tsx` - Funil de warming
- `src/components/flows/FlowNode.tsx` - Badges de stats
- `src/components/flows/FlowCanvas.tsx` - Props de stats
- `supabase/migrations/20260130_analytics_simple.sql` - RPCs

---

## DADOS ATUAIS

### Contatos
- **Total**: 779 contatos (todos com tags play55 + PREMIACOESSINCERO)

### Pool de Warming "teste"
- **ID**: 2cd33ae4-bcae-4136-a8b7-91f8b60eb13d
- **WABAs**: 3 (Alcance, Okay Money, Agency Call)
- **Estrategia**: least_used
- **Mensagens enviadas**: 607+
- **Status**: ativo

### Funil do Warming (dados atuais):
| WABA | Enviadas | Entregues | Lidas | Clique Botao | Clique Link | Respostas |
|------|----------|-----------|-------|--------------|-------------|-----------|
| Alcance | 413 | 204 | 141 | 132 | 59 | 10 |
| Okay Money | 404 | 204 | 154 | 130 | 57 | 9 |
| Agency Call | 378 | 205 | 144 | 118 | 43 | 12 |

---

## COMANDOS UTEIS

### Deploy Frontend
```bash
cd /Users/andresantos/Documents/ApiWhatsapp/LOVABLE/whatsapp-flow
npm run build
scp -r dist/* root@138.68.21.234:/www/wwwroot/app.publipropaganda.shop/
```

### Backup e Restart Backend
```bash
# Backup
ssh root@138.68.21.234 "cp /www/wwwroot/api-backend/index.js /www/wwwroot/api-backend/index.js.bkp_\$(date +%Y%m%d_%H%M%S)"

# Restart
ssh root@138.68.21.234 "export PATH=\$PATH:/www/server/nvm/versions/node/v24.12.0/bin && pm2 restart whatsapp-api"

# Logs
ssh root@138.68.21.234 "export PATH=\$PATH:/www/server/nvm/versions/node/v24.12.0/bin && pm2 logs whatsapp-api --lines 50"
```

### Executar SQL no Supabase
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/nwyyrxvsbapnvnrzsrsj/database/query" \
  -H "Authorization: Bearer sbp_a2d69c9b504b372cb5bf0e721a2a1d07c7416cf3" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM contacts LIMIT 5;"}'
```

---

## ARQUITETURA DO SISTEMA

```
Frontend (React/Vite)
    │
    ├── Supabase (PostgreSQL + Auth)
    │
    └── Backend (Node.js/Express)
            │
            ├── BullMQ (Redis) - Fila de mensagens
            │
            └── WhatsApp Cloud API
```

### Tabelas Principais:
- `contacts` - Contatos
- `conversations` - Conversas
- `messages` - Mensagens
- `campaigns` - Campanhas
- `campaign_messages` - Mensagens de campanha
- `flows` - Fluxos de automacao
- `flow_nodes` / `flow_edges` - Estrutura dos fluxos
- `flow_executions` / `flow_execution_logs` - Execucoes
- `warming_pools` - Pools de aquecimento
- `warming_pool_members` - WABAs no pool
- `warming_contact_history` - Historico de contatos no warming
- `warming_message_executions` - Execucoes de mensagens
- `whatsapp_accounts` - Contas WABA
- `phone_numbers` - Numeros de telefone
- `message_templates` - Templates WhatsApp
- `tracked_links` / `link_clicks` - Rastreamento de links

---

## PROXIMOS PASSOS SUGERIDOS

1. Monitorar o warming pool para ver se os contadores continuam atualizando
2. Verificar qualidade das WABAs apos envios
3. Implementar mais metricas no dashboard principal
4. Adicionar graficos de tendencia no warming

---

## NOTAS IMPORTANTES

- O backend tem backup automatico antes de cada alteracao (arquivos .bkp_*)
- As migrations SQL estao em `supabase/migrations/`
- O arquivo CLAUDE.md tem documentacao completa do projeto
- Sempre fazer backup antes de alteracoes no servidor
