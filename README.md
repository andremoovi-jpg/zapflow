# ZapFlow - WhatsApp Flow Platform

Sistema completo de automação de WhatsApp com suporte a múltiplas WABAs, warming pools, fluxos automatizados e campanhas em massa.

## Estrutura do Projeto

```
zapflow/
├── frontend/          # React + Vite + TypeScript
├── backend/           # Node.js + Express + BullMQ
├── supabase/          # Migrations do banco de dados
└── docs/              # Documentação
```

## Tecnologias

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- TanStack Query (estado servidor)
- Shadcn/UI + Tailwind CSS
- ReactFlow (editor de fluxos)
- Recharts (gráficos)

### Backend
- Node.js + Express
- BullMQ (fila de mensagens)
- Redis (cache/fila)
- Supabase (PostgreSQL)
- WhatsApp Cloud API

## Funcionalidades

- **Multi-WABA**: Suporte a múltiplas contas WhatsApp Business
- **Warming Pools**: Aquecimento de números com rotação inteligente
- **Flow Builder**: Editor visual de fluxos de automação
- **Campanhas**: Envio em massa com rate limiting
- **Inbox**: Central de conversas unificada
- **Analytics**: Métricas e relatórios detalhados
- **Link Tracking**: Rastreamento de cliques em links

## Configuração

### Frontend (.env)
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua-anon-key
VITE_API_URL=https://sua-api.com
```

### Backend (.env)
```env
PORT=3000
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_KEY=sua-service-key
REDIS_URL=redis://localhost:6379
WEBHOOK_VERIFY_TOKEN=seu-token
```

## Instalação

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
node index.js
```

## Deploy

### Frontend
```bash
cd frontend
npm run build
# Copiar dist/ para o servidor
```

### Backend
```bash
# No servidor
pm2 start index.js --name zapflow-api
```

## Licença

Proprietário - Todos os direitos reservados.
