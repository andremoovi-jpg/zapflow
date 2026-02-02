  const express = require('express');
  const cors = require('cors');
  const axios = require('axios');
  const { createClient } = require('@supabase/supabase-js');
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const { SocksProxyAgent } = require('socks-proxy-agent');
  require('dotenv').config();

// Supabase client (top level for worker access)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============ PROXY HELPER ============
function createProxyAgent(proxyConfig) {
  if (!proxyConfig || !proxyConfig.proxy_enabled || !proxyConfig.proxy_url) {
    return null;
  }

  try {
    let proxyUrl = proxyConfig.proxy_url.trim();
    
    // Adicionar protocolo se não existir
    if (!proxyUrl.includes('://')) {
      const protocol = proxyConfig.proxy_type === 'socks5' ? 'socks5' :
                       proxyConfig.proxy_type === 'socks4' ? 'socks4' :
                       proxyConfig.proxy_type === 'https' ? 'https' : 'http';
      proxyUrl = protocol + '://' + proxyUrl;
    }
    
    // Adicionar autenticação diretamente na URL se fornecida
    if (proxyConfig.proxy_username && proxyConfig.proxy_password) {
      const urlObj = new URL(proxyUrl);
      const authUrl = urlObj.protocol + '//' + 
        encodeURIComponent(proxyConfig.proxy_username) + ':' + 
        encodeURIComponent(proxyConfig.proxy_password) + '@' + 
        urlObj.host + urlObj.pathname;
      proxyUrl = authUrl;
      console.log('[Proxy] URL com auth configurada');
    }
    
    console.log('[Proxy] URL final:', proxyUrl.replace(/:[^:@]+@/, ':***@'));

    // Criar agent baseado no tipo
    if (proxyConfig.proxy_type === 'socks5' || proxyConfig.proxy_type === 'socks4') {
      console.log('[Proxy] Usando SOCKS proxy');
      return new SocksProxyAgent(proxyUrl);
    } else {
      console.log('[Proxy] Usando HTTP/HTTPS proxy');
      return new HttpsProxyAgent(proxyUrl);
    }
  } catch (error) {
    console.error('[Proxy] Erro ao criar proxy agent:', error.message);
    return null;
  }
}

// Função para fazer requisição com proxy opcional
async function axiosWithProxy(config, proxyConfig = null) {
  const agent = createProxyAgent(proxyConfig);
  if (agent) {
    config.httpsAgent = agent;
    config.httpAgent = agent;
  }
  return axios(config);
}

// Buscar configuração de proxy da WABA
// Cache de proxy config (evita queries repetidas)
const proxyConfigCache = new Map();
const PROXY_CACHE_TTL = 30000; // 30 segundos

async function getProxyConfig(phoneNumberId) {
  if (!phoneNumberId) return null;
  
  // Verificar cache
  const cached = proxyConfigCache.get(phoneNumberId);
  if (cached && Date.now() - cached.timestamp < PROXY_CACHE_TTL) {
    return cached.config;
  }
  
  try {
    // Buscar phone_number para pegar o whatsapp_account_id
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('whatsapp_account_id')
      .eq('phone_number_id', phoneNumberId)
      .single();
    
    if (!phoneData?.whatsapp_account_id) {
      proxyConfigCache.set(phoneNumberId, { config: null, timestamp: Date.now() });
      return null;
    }
    
    // Buscar configuração de proxy da WABA
    const { data: wabaData } = await supabase
      .from('whatsapp_accounts')
      .select('proxy_enabled, proxy_type, proxy_url, proxy_username, proxy_password_encrypted')
      .eq('id', phoneData.whatsapp_account_id)
      .single();
    
    let config = null;
    if (wabaData?.proxy_enabled) {
      config = {
        proxy_enabled: wabaData.proxy_enabled,
        proxy_type: wabaData.proxy_type,
        proxy_url: wabaData.proxy_url,
        proxy_username: wabaData.proxy_username,
        proxy_password: wabaData.proxy_password_encrypted
      };
    }
    
    // Salvar no cache
    proxyConfigCache.set(phoneNumberId, { config, timestamp: Date.now() });
    return config;
  } catch (error) {
    console.error('[Proxy] Erro ao buscar config:', error.message);
    return null;
  }
}


// Cache para deduplicação de cliques de botão (evita processar webhook duplicado)
const CLICK_CACHE_TTL = 60000; // 1 minuto
const processedButtonClicks = new Set();


// Função para buscar messaging limit da API do Meta
async function getMessagingLimit(wabaId, accessToken) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}?fields=message_template_daily_limit,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${accessToken}` }}
    );
    const data = await response.json();
    console.log('[Messaging Limit] Resposta:', data);
    return {
      tier: data.messaging_limit_tier || 'TIER_250',
      dailyLimit: data.message_template_daily_limit || 250
    };
  } catch (error) {
    console.error('[Messaging Limit] Erro:', error.message);
    return { tier: 'TIER_250', dailyLimit: 250 };
  }
}

// Função para incrementar contador de mensagens
async function incrementMessageCount(phoneNumberId) {
  try {
    const { data: phone } = await supabase
      .from('phone_numbers')
      .select('id, messages_sent_today, limit_reset_at')
      .eq('phone_number_id', phoneNumberId)
      .single();
    
    if (!phone) return;
    
    // Verificar se precisa resetar (novo dia)
    const now = new Date();
    const resetAt = new Date(phone.limit_reset_at || 0);
    const needsReset = now.toDateString() !== resetAt.toDateString();
    
    await supabase
      .from('phone_numbers')
      .update({
        messages_sent_today: needsReset ? 1 : (phone.messages_sent_today || 0) + 1,
        limit_reset_at: needsReset ? now.toISOString() : phone.limit_reset_at
      })
      .eq('id', phone.id);
      
  } catch (error) {
    console.error('[Message Count] Erro:', error.message);
  }
}

function isClickAlreadyProcessed(messageId) {
  if (processedButtonClicks.has(messageId)) {
    console.log('[Dedup] Clique já processado, ignorando:', messageId);
    return true;
  }
  processedButtonClicks.add(messageId);
  // Limpar após TTL
  setTimeout(() => processedButtonClicks.delete(messageId), CLICK_CACHE_TTL);
  return false;
}


// ============ WARMING POOL HELPERS ============

// Cache para warming pools ativos
const warmingPoolCache = new Map();
const WARMING_CACHE_TTL = 60000; // 1 minuto

/**
 * Busca pools de aquecimento ativos para a organização
 */
async function getActiveWarmingPools(organizationId) {
  const cacheKey = `pools_${organizationId}`;
  const cached = warmingPoolCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < WARMING_CACHE_TTL) {
    return cached.pools;
  }

  try {
    const { data: pools, error } = await supabase
      .from('warming_pools')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    if (error) throw error;

    warmingPoolCache.set(cacheKey, { pools: pools || [], timestamp: Date.now() });
    return pools || [];
  } catch (error) {
    console.error('[Warming] Erro ao buscar pools:', error.message);
    return [];
  }
}

/**
 * Seleciona a próxima WABA do pool usando a função do Supabase
 */
async function selectWarmingWaba(poolId) {
  try {
    const { data: wabaId, error } = await supabase.rpc('select_warming_waba', {
      pool_id: poolId
    });

    if (error) {
      console.error('[Warming] Erro ao selecionar WABA:', error.message);
      return null;
    }

    // Se não retornou WABA, diagnosticar o motivo
    if (!wabaId) {
      // Verificar configuração do pool
      const { data: pool } = await supabase
        .from('warming_pools')
        .select('name, status, time_window_enabled, time_window_start, time_window_end, allowed_days, timezone, daily_limit_per_waba')
        .eq('id', poolId)
        .single();

      if (pool) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0=Dom, 1=Seg, etc

        console.log('[Warming Debug] Pool:', pool.name, '| Status:', pool.status);
        console.log('[Warming Debug] Hora atual:', currentHour, '| Janela:', pool.time_window_start, '-', pool.time_window_end);
        console.log('[Warming Debug] Dia atual:', currentDay, '| Dias permitidos:', pool.allowed_days);
        console.log('[Warming Debug] time_window_enabled:', pool.time_window_enabled);

        // Verificar se dia está permitido
        if (pool.time_window_enabled && !pool.allowed_days?.includes(currentDay)) {
          console.log('[Warming Debug] BLOQUEADO: Dia', currentDay, 'não está em allowed_days');
        }
      }

      // Verificar WABAs membros
      const { data: members } = await supabase
        .from('warming_pool_members')
        .select('whatsapp_account_id, status, current_quality, messages_sent_today, custom_daily_limit, active_days')
        .eq('warming_pool_id', poolId);

      if (members && members.length > 0) {
        console.log('[Warming Debug] WABAs no pool:', members.length);
        members.forEach((m, i) => {
          console.log(`[Warming Debug] WABA ${i+1}: status=${m.status}, quality=${m.current_quality}, sent_today=${m.messages_sent_today}, limit=${m.custom_daily_limit || pool?.daily_limit_per_waba}, active_days=${JSON.stringify(m.active_days)}`);
        });
      } else {
        console.log('[Warming Debug] Nenhuma WABA configurada no pool!');
      }
    }

    return wabaId;
  } catch (error) {
    console.error('[Warming] Erro ao selecionar WABA:', error.message);
    return null;
  }
}

/**
 * Registra evento no log de aquecimento
 */
async function logWarmingEvent(poolId, eventType, eventData = {}, wabaId = null, contactId = null, severity = 'info') {
  try {
    await supabase.from('warming_events_log').insert({
      warming_pool_id: poolId,
      whatsapp_account_id: wabaId,
      contact_id: contactId,
      event_type: eventType,
      event_data: eventData,
      severity
    });
  } catch (error) {
    console.error('[Warming] Erro ao registrar evento:', error.message);
  }
}

/**
 * Incrementa contadores de mensagem do membro do pool
 */
async function incrementWarmingMemberCount(poolId, wabaId, success = true) {
  try {
    const field = success ? 'messages_sent_today' : 'messages_failed_today';

    const { data: member } = await supabase
      .from('warming_pool_members')
      .select('id, messages_sent_today, messages_failed_today, current_daily_limit')
      .eq('warming_pool_id', poolId)
      .eq('whatsapp_account_id', wabaId)
      .single();

    if (!member) return;

    const newCount = (member[field] || 0) + 1;
    const updateData = { [field]: newCount, last_message_at: new Date().toISOString() };

    if (success && member.current_daily_limit && newCount >= member.current_daily_limit) {
      updateData.status = 'limit_reached';
      updateData.pause_reason = 'daily_limit';
      console.log(`[Warming] WABA ${wabaId} atingiu limite diário`);
    }

    await supabase
      .from('warming_pool_members')
      .update(updateData)
      .eq('id', member.id);

  } catch (error) {
    console.error('[Warming] Erro ao incrementar contador:', error.message);
  }
}

/**
 * Busca os flows associados ao pool de aquecimento
 */
async function getWarmingPoolFlows(poolId) {
  try {
    const { data: flows, error } = await supabase
      .from('warming_pool_flows')
      .select(`
        *,
        flows:flow_id (id, name, trigger_type, trigger_config, is_active)
      `)
      .eq('warming_pool_id', poolId)
      .eq('is_active', true)
      .order('sequence_order', { ascending: true });

    if (error) throw error;
    return flows || [];
  } catch (error) {
    console.error('[Warming] Erro ao buscar flows:', error.message);
    return [];
  }
}

/**
 * Registra contato no histórico de aquecimento
 */
async function registerWarmingContact(poolId, contactId, wabaId, flowsTotal) {
  try {
    const { data: existing } = await supabase
      .from('warming_contact_history')
      .select('id')
      .eq('warming_pool_id', poolId)
      .eq('contact_id', contactId)
      .single();

    if (existing) {
      console.log('[Warming] Contato já registrado no pool:', contactId);
      return existing.id;
    }

    const { data, error } = await supabase
      .from('warming_contact_history')
      .insert({
        warming_pool_id: poolId,
        contact_id: contactId,
        whatsapp_account_id: wabaId,
        flows_total: flowsTotal,
        status: 'in_progress'
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('[Warming] Erro ao registrar contato:', error.message);
    return null;
  }
}

console.log('[Warming] Helpers carregados');
// ============ WARMING MEMBER MESSAGES HELPERS ============

async function getWarmingPoolMember(poolId, wabaId) {
  try {
    const { data, error } = await supabase
      .from("warming_pool_members")
      .select("*")
      .eq("warming_pool_id", poolId)
      .eq("whatsapp_account_id", wabaId)
      .single();
    if (error) return null;
    return data;
  } catch (error) {
    return null;
  }
}

async function getWarmingMemberMessages(memberId) {
  try {
    const { data, error } = await supabase
      .from("warming_member_messages")
      .select("*")
      .eq("warming_pool_member_id", memberId)
      .eq("is_active", true)
      .order("sequence_order", { ascending: true });
    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

async function scheduleWarmingMessages(contactHistoryId, memberId, enteredAt) {
  try {
    const messages = await getWarmingMemberMessages(memberId);
    if (messages.length === 0) return [];

    const entryTime = new Date(enteredAt);
    const executions = [];

    for (const msg of messages) {
      const scheduledFor = new Date(entryTime);
      scheduledFor.setDate(scheduledFor.getDate() + (msg.delay_days || 0));
      scheduledFor.setHours(scheduledFor.getHours() + (msg.delay_hours || 0));
      scheduledFor.setMinutes(scheduledFor.getMinutes() + (msg.delay_minutes || 0));

      const isImmediate = (msg.delay_days || 0) === 0 && (msg.delay_hours || 0) === 0 && (msg.delay_minutes || 0) === 0;

      executions.push({
        warming_contact_history_id: contactHistoryId,
        warming_member_message_id: msg.id,
        status: isImmediate ? "pending" : "scheduled",
        scheduled_for: scheduledFor.toISOString()
      });
    }

    const { data, error } = await supabase.from("warming_message_executions").insert(executions).select();
    if (error) return [];
    console.log("[Warming] Agendadas", data.length, "mensagens");
    return data;
  } catch (error) {
    return [];
  }
}

async function getWabaInfo(wabaId) {
  try {
    const { data: waba } = await supabase
      .from("whatsapp_accounts")
      .select("id, name, access_token_encrypted, proxy_enabled, proxy_type, proxy_url, proxy_username, proxy_password_encrypted")
      .eq("id", wabaId)
      .single();
    if (!waba) return null;
    const { data: phone } = await supabase
      .from("phone_numbers")
      .select("id, phone_number_id")
      .eq("whatsapp_account_id", wabaId)
      .eq("status", "active")
      .limit(1)
      .single();
    if (!phone) {
      console.log("[Warming] Phone nao encontrado para WABA:", wabaId);
      return null;
    }
    return {
      id: waba.id,
      name: waba.name,
      phone_number_id: phone.phone_number_id,
      access_token: waba.access_token_encrypted,
      proxy_enabled: waba.proxy_enabled,
      proxy_type: waba.proxy_type,
      proxy_url: waba.proxy_url,
      proxy_username: waba.proxy_username,
      proxy_password_encrypted: waba.proxy_password_encrypted
    };
  } catch (error) {
    console.error("[Warming] Erro WABA info:", error.message);
    return null;
  }
}

// Helper to replace placeholders with actual contact data
function replaceWarmingPlaceholders(text, contactData) {
  if (!text || typeof text !== "string") return text;
  let result = text;
  result = result.replace(/\{\{(nome|name)\}\}/gi, contactData.name || "");
  result = result.replace(/\{\{(telefone|phone)\}\}/gi, contactData.phone || "");
  const customFields = contactData.custom_fields || {};
  result = result.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
    const lowerField = fieldName.toLowerCase();
    if (["nome", "name", "telefone", "phone"].includes(lowerField)) return result;
    const value = Object.entries(customFields).find(([k]) => k.toLowerCase() === lowerField)?.[1];
    return value !== undefined ? String(value) : "";
  });
  return result;
}

async function sendWarmingMessage(execution, messageConfig, contactPhone, wabaInfo, contactData, contactId) {
  try {
    console.log("[Warming] Enviando:", messageConfig.template_name, "para:", contactPhone);
    const contact = contactData || { name: "", phone: contactPhone, custom_fields: {} };
    const components = [];
    const variables = messageConfig.template_variables || {};

    if (variables.header) {
      if (variables.header.type === "image") {
        components.push({ type: "header", parameters: [{ type: "image", image: { link: variables.header.url } }] });
      } else if (variables.header.type === "document") {
        components.push({ type: "header", parameters: [{ type: "document", document: { link: variables.header.url, filename: variables.header.filename || "doc.pdf" } }] });
      } else if (variables.header.type === "video") {
        components.push({ type: "header", parameters: [{ type: "video", video: { link: variables.header.url } }] });
      } else if (variables.header.type === "text" && variables.header.text) {
        components.push({ type: "header", parameters: [{ type: "text", text: replaceWarmingPlaceholders(variables.header.text, contact) }] });
      }
    }

    if (variables.body && Array.isArray(variables.body) && variables.body.length > 0) {
      components.push({ type: "body", parameters: variables.body.map(text => ({ type: "text", text: replaceWarmingPlaceholders(String(text), contact) })) });
    }

    const payload = {
      messaging_product: "whatsapp",
      to: contactPhone,
      type: "template",
      template: { name: messageConfig.template_name, language: { code: messageConfig.template_language || "pt_BR" } }
    };
    if (components.length > 0) payload.template.components = components;

    let proxyConfig = null;
    if (wabaInfo.proxy_enabled) {
      proxyConfig = { proxy_enabled: wabaInfo.proxy_enabled, proxy_type: wabaInfo.proxy_type, proxy_url: wabaInfo.proxy_url, proxy_username: wabaInfo.proxy_username, proxy_password: wabaInfo.proxy_password_encrypted };
    }

    console.log("[Warming] Payload:", JSON.stringify(payload, null, 2));

    const response = await axiosWithProxy({
      method: "POST",
      url: "https://graph.facebook.com/v21.0/" + wabaInfo.phone_number_id + "/messages",
      headers: { "Authorization": "Bearer " + wabaInfo.access_token, "Content-Type": "application/json" },
      data: payload
    }, proxyConfig);

    const msgId = response.data?.messages?.[0]?.id;
    console.log("[Warming] Enviado! ID:", msgId);
    // Salvar template no inbox
    if (contactId) {
      // Buscar dados do template para exibicao
      const { data: tplData } = await supabase
        .from("message_templates")
        .select("name, components")
        .eq("name", messageConfig.template_name)
        .single();
      
      let bodyText = "", headerText = "", footerText = "", buttons = [];
      if (tplData?.components) {
        (tplData.components || []).forEach(comp => {
          if (comp.type === "HEADER" && comp.text) headerText = comp.text;
          if (comp.type === "BODY" && comp.text) bodyText = comp.text;
          if (comp.type === "FOOTER" && comp.text) footerText = comp.text;
          if (comp.type === "BUTTONS" && comp.buttons) {
            buttons = comp.buttons.map(b => ({ text: b.text, type: b.type }));
          }
        });
      }
      
      // Substituir variaveis no body
      if (variables.body && Array.isArray(variables.body)) {
        variables.body.forEach((val, idx) => {
          const placeholder = "{{" + (idx + 1) + "}}";
          const replacedVal = replaceWarmingPlaceholders(String(val), contact);
          bodyText = bodyText.replace(placeholder, replacedVal);
        });
      }
      
      // Substituir variaveis no header
      if (variables.header?.text) {
        headerText = replaceWarmingPlaceholders(variables.header.text, contact);
      }
      
      await saveFlowMessage(contactId, wabaInfo.phone_number_id, "template", {
        template_name: messageConfig.template_name,
        header: headerText,
        body: bodyText,
        footer: footerText,
        buttons: buttons,
      }, msgId);
    }
    await supabase.from("warming_message_executions").update({ status: "sent", sent_at: new Date().toISOString(), whatsapp_message_id: msgId }).eq("id", execution.id);
    // Atualizar contadores de warming
    try {
      // 1. Incrementar messages_sent no contact history
      const { data: historyData } = await supabase
        .from('warming_contact_history')
        .select('id, warming_pool_id, whatsapp_account_id, messages_sent')
        .eq('id', execution.warming_contact_history_id)
        .single();
      
      if (historyData) {
        // Atualizar contact history
        await supabase
          .from('warming_contact_history')
          .update({ messages_sent: (historyData.messages_sent || 0) + 1 })
          .eq('id', historyData.id);
        
        // 2. Incrementar messages_sent_today no pool member
        const { data: memberData } = await supabase
          .from('warming_pool_members')
          .select('id, messages_sent_today')
          .eq('warming_pool_id', historyData.warming_pool_id)
          .eq('whatsapp_account_id', historyData.whatsapp_account_id)
          .single();
        
        if (memberData) {
          await supabase
            .from('warming_pool_members')
            .update({ messages_sent_today: (memberData.messages_sent_today || 0) + 1 })
            .eq('id', memberData.id);
        }
        
        // 3. Incrementar totais no pool
        const { data: poolData } = await supabase
          .from('warming_pools')
          .select('id, total_messages_sent, total_messages_today')
          .eq('id', historyData.warming_pool_id)
          .single();
        
        if (poolData) {
          await supabase
            .from('warming_pools')
            .update({
              total_messages_sent: (poolData.total_messages_sent || 0) + 1,
              total_messages_today: (poolData.total_messages_today || 0) + 1
            })
            .eq('id', poolData.id);
        }
        
        console.log('[Warming] Contadores atualizados para contact history:', historyData.id);
      }
    } catch (counterErr) {
      console.error('[Warming] Erro ao atualizar contadores:', counterErr.message);
    }
    return { success: true, messageId: msgId };
  } catch (error) {
    console.error("[Warming] Erro:", error.response?.data || error.message);
    await supabase.from("warming_message_executions").update({ status: "failed", failed_at: new Date().toISOString(), error_message: error.response?.data?.error?.message || error.message }).eq("id", execution.id);
    return { success: false, error: error.message };
  }
}


async function processWarmingMessages(limit = 50) {
  try {
    const now = new Date().toISOString();
    const { data: executions, error } = await supabase
      .from("warming_message_executions")
      .select("id, status, scheduled_for, warming_contact_history_id, warming_member_message_id")
      .in("status", ["pending", "scheduled"])
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(limit);

    if (error || !executions || executions.length === 0) return { processed: 0, errors: 0 };

    console.log("[Warming Process]", executions.length, "mensagens pendentes");
    let processed = 0, errors = 0;

    for (const exec of executions) {
      const { data: history } = await supabase.from("warming_contact_history").select("id, contact_id, whatsapp_account_id, has_replied").eq("id", exec.warming_contact_history_id).single();
      if (!history) { errors++; continue; }

      const { data: message } = await supabase.from("warming_member_messages").select("*").eq("id", exec.warming_member_message_id).single();
      if (!message) { errors++; continue; }

      const { data: contact } = await supabase.from("contacts").select("phone_number, name, custom_fields").eq("id", history.contact_id).single();
      if (!contact) { errors++; continue; }

      if (message.only_if_no_reply && history.has_replied) {
        await supabase.from("warming_message_executions").update({ status: "skipped", skip_reason: "replied" }).eq("id", exec.id);
        continue;
      }

      const wabaInfo = await getWabaInfo(history.whatsapp_account_id);
      if (!wabaInfo) { errors++; continue; }

      const result = await sendWarmingMessage(exec, message, contact.phone_number, wabaInfo, { name: contact.name, phone: contact.phone_number, custom_fields: contact.custom_fields || {} }, history.contact_id);
      if (result.success) processed++; else errors++;

      await new Promise(r => setTimeout(r, 500));
    }

    console.log("[Warming Process] OK:", processed, "Erros:", errors);
    return { processed, errors };
  } catch (error) {
    return { processed: 0, errors: 0, error: error.message };
  }
}

console.log("[Warming Member Messages] Helpers carregados");

// Rastreamento de throughput real
let throughputTracker = {
  completedCount: 0,
  lastResetTime: Date.now(),
  history: [], // Array de {timestamp, count} para últimos 60 segundos
};

// Atualizar throughput a cada segundo
setInterval(() => {
  const now = Date.now();
  const currentCount = throughputTracker.completedCount;

  // Adicionar ao histórico
  throughputTracker.history.push({
    timestamp: now,
    count: currentCount
  });

  // Manter apenas últimos 60 segundos
  const cutoff = now - 60000;
  throughputTracker.history = throughputTracker.history.filter(h => h.timestamp > cutoff);

  // Reset contador
  throughputTracker.completedCount = 0;
  throughputTracker.lastResetTime = now;
}, 1000);

// Tracker de métricas por campanha
const campaignMetrics = new Map(); // { campaignId: { startTime, history: [{timestamp, count}], totalSent: 0 } }

function getCampaignMetrics(campaignId) {
  if (!campaignMetrics.has(campaignId)) {
    campaignMetrics.set(campaignId, {
      startTime: Date.now(),
      history: [],
      totalSent: 0,
      lastSecondCount: 0,
      lastSecondTime: Date.now()
    });
  }
  return campaignMetrics.get(campaignId);
}

function recordCampaignMessage(campaignId) {
  const metrics = getCampaignMetrics(campaignId);
  metrics.totalSent++;

  const now = Date.now();
  const secondDiff = Math.floor((now - metrics.lastSecondTime) / 1000);

  if (secondDiff >= 1) {
    // Salvar o count do último segundo
    metrics.history.push({
      timestamp: metrics.lastSecondTime,
      count: metrics.lastSecondCount
    });

    // Manter apenas últimos 5 minutos (300 segundos)
    if (metrics.history.length > 300) {
      metrics.history = metrics.history.slice(-300);
    }

    metrics.lastSecondCount = 1;
    metrics.lastSecondTime = now;
  } else {
    metrics.lastSecondCount++;
  }
}

// Verificar se campanha foi concluída
async function checkCampaignCompletion(campaignId) {
  if (!campaignId) return;

  try {
    // Buscar campanha
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status, audience_count, stats')
      .eq('id', campaignId)
      .single();

    if (!campaign || campaign.status !== 'running') return;

    const stats = campaign.stats || {};
    const sent = stats.sent || 0;
    const failed = stats.failed || 0;
    const total = campaign.audience_count || stats.total || 0;

    // Se enviou + falhou >= total, campanha concluída
    if (total > 0 && (sent + failed) >= total) {
      console.log('[Campaign] Campanha concluída:', campaignId, '- Enviadas:', sent, 'Falhas:', failed);

      // Calcular métricas finais
      let metricsData = { avgSpeed: 0, maxSpeed: 0, duration: 0 };
      if (typeof campaignMetrics !== 'undefined' && campaignMetrics.has(campaignId)) {
        const metrics = campaignMetrics.get(campaignId);
        metricsData.duration = Math.max(1, Math.floor((Date.now() - metrics.startTime) / 1000));
        
        if (metrics.history.length > 0) {
          const speeds = metrics.history.map(h => h.count);
          // Incluir também o último segundo parcial se houver
          if (metrics.lastSecondCount > 0) {
            speeds.push(metrics.lastSecondCount);
          }
          metricsData.avgSpeed = parseFloat((speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(2));
          metricsData.maxSpeed = Math.max(...speeds);
        } else if (metrics.totalSent > 0) {
          // Campanha rápida sem histórico - calcular pela duração total
          metricsData.avgSpeed = parseFloat((metrics.totalSent / metricsData.duration).toFixed(2));
          metricsData.maxSpeed = Math.max(metricsData.avgSpeed, metrics.lastSecondCount || metrics.totalSent);
        }
      } else if (sent > 0) {
        // Fallback: usar dados da campanha
        const camp = await supabase.from('campaigns').select('started_at').eq('id', campaignId).single();
        if (camp.data?.started_at) {
          metricsData.duration = Math.max(1, Math.floor((Date.now() - new Date(camp.data.started_at).getTime()) / 1000));
          metricsData.avgSpeed = parseFloat((sent / metricsData.duration).toFixed(2));
          metricsData.maxSpeed = metricsData.avgSpeed;
        }
      }

      // Salvar com métricas no stats
      const finalStats = {
        ...stats,
        sent,
        failed,
        metrics: metricsData
      };

      await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          stats: finalStats
        })
        .eq('id', campaignId);

      console.log('[Campaign] Métricas salvas:', metricsData);

      // Limpar métricas da memória após 5 minutos
      setTimeout(() => {
        if (typeof campaignMetrics !== 'undefined') {
          campaignMetrics.delete(campaignId);
        }
      }, 5 * 60 * 1000);
    }
  } catch (error) {
    console.error('[Campaign] Erro ao verificar conclusão:', error.message);
  }
}







 // ============ BULLMQ - SISTEMA DE FILAS ============
  const { Queue, Worker } = require('bullmq');

  // Conexão Redis para BullMQ
  const redisConnection = {
    host: '127.0.0.1',
    port: 6379,
    password: '891278bdf0edda89'
  };

  // Criar fila de mensagens
  const messageQueue = new Queue('whatsapp-messages', { connection: redisConnection });

  // Worker para processar envios (80 msgs/segundo)
  const messageWorker = new Worker('whatsapp-messages', async (job) => {
    const { to, type, content, template, campaignId, contactId, wabaId } = job.data;

    console.log("WORKER PROCESSANDO JOB:", job.id, job.data.to);
    const jobStartTime = Date.now();
    try {
      let result;

      // Buscar credenciais da WABA se especificada
      let customCredentials = null;
      if (wabaId) {
        const { data: waba } = await supabase
          .from('whatsapp_accounts')
          .select('waba_id, access_token_encrypted')
          .eq('id', wabaId)
          .single();
        
        if (waba && waba.access_token_encrypted) {
          const { data: phoneData } = await supabase
            .from('phone_numbers')
            .select('phone_number_id')
            .eq('whatsapp_account_id', wabaId)
            .limit(1)
            .single();
          
          if (phoneData) {
            customCredentials = {
              phoneId: phoneData.phone_number_id,
              token: waba.access_token_encrypted
            };
            console.log('[Worker] Usando WABA:', wabaId, 'Phone:', phoneData.phone_number_id);
          }
        }
      }

      if (type === 'template') {
        // Enviar template com credenciais da WABA
        result = await sendTemplate(to, template.name, template.language, template.components, customCredentials);

        // Salvar mensagem no inbox - BACKGROUND
        if (contactId) {
          const msgId = result?.messages?.[0]?.id;
          const tplName = template.name;
          const tplComps = template.components;
          const cId = contactId;
          const phoneId = customCredentials?.phoneId;
          setImmediate(async () => {
            try {
              const { data: tplData } = await supabase
                .from('message_templates')
                .select('name, components')
                .eq('name', tplName)
                .single();
              
              let bodyText = '', headerText = '', footerText = '', buttons = [];
              if (tplData?.components) {
                (tplData.components || []).forEach(comp => {
                  if (comp.type === 'HEADER' && comp.text) headerText = comp.text;
                  if (comp.type === 'BODY' && comp.text) bodyText = comp.text;
                  if (comp.type === 'FOOTER' && comp.text) footerText = comp.text;
                  if (comp.type === 'BUTTONS' && comp.buttons) {
                    buttons = comp.buttons.map(b => ({ text: b.text, type: b.type }));
                  }
                });
              }
              
              if (tplComps && Array.isArray(tplComps)) {
                tplComps.forEach(comp => {
                  if (comp.type === 'body' && comp.parameters) {
                    comp.parameters.forEach((param, idx) => {
                      const placeholder = '{{' + (idx + 1) + '}}';
                      bodyText = bodyText.replace(placeholder, param.text || '');
                    });
                  }
                  if (comp.type === 'header' && comp.parameters) {
                    comp.parameters.forEach((param, idx) => {
                      const placeholder = '{{' + (idx + 1) + '}}';
                      headerText = headerText.replace(placeholder, param.text || '');
                    });
                  }
                });
              }
              
              await saveFlowMessage(cId, phoneId, 'template', {
                template_name: tplName,
                header: headerText,
                body: bodyText,
                footer: footerText,
                buttons: buttons,
              }, msgId);
            } catch(e) { console.error("[BG] Erro salvando template:", e.message); }
          });
        }

        // Incrementar contador de mensagens
        const phoneIdForCount = customCredentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (phoneIdForCount) {
          incrementMessageCount(phoneIdForCount);
        }

        // Log sucesso do envio
        logToDatabase({
          level: 'info',
          category: 'api',
          source: 'worker',
          message: 'Template ' + template.name + ' enviado para ' + to,
          campaignId,
          contactId,
          requestData: { template: template.name, language: template.language, to },
          responseData: result,
          durationMs: Date.now() - jobStartTime
        });
      } else {
        // Enviar mensagem de texto
        result = await sendWhatsAppMessage(to, content);
      }

        // Atualizar status da mensagem de campanha
        if (campaignId && contactId) {
          await supabase
            .from('campaign_messages')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              message_id: result?.messages?.[0]?.id
            })
            .eq('campaign_id', campaignId)
            .eq('contact_id', contactId);

          console.log("DB UPDATE:", campaignId, contactId, result?.messages?.[0]?.id);
          // Atualizar stats da campanha - incrementar sent
          const { data: camp } = await supabase
            .from('campaigns')
            .select('stats')
            .eq('id', campaignId)
            .single();

          if (camp) {
            const newStats = { ...camp.stats, sent: (camp.stats?.sent || 0) + 1 };
            await supabase
              .from('campaigns')
              .update({ stats: newStats })
              .eq('id', campaignId);
          }
        }

      return { success: true, messageId: result?.messages?.[0]?.id };
    } catch (error) {
      console.error('Erro no worker:', error.message);

      // Log erro no worker
      logToDatabase({
        level: 'error',
        category: 'campaign',
        source: 'worker',
        message: 'Erro ao enviar para ' + to + ': ' + error.message,
        campaignId,
        contactId,
        errorDetails: { message: error.message, code: error.code },
        durationMs: Date.now() - jobStartTime
      });

        // Atualizar status como falha
        if (campaignId && contactId) {
          await supabase
            .from('campaign_messages')
            .update({
              status: 'failed',
              error_message: error.message
            })
            .eq('campaign_id', campaignId)
            .eq('contact_id', contactId);

          // Atualizar stats da campanha - incrementar failed
          const { data: camp } = await supabase
            .from('campaigns')
            .select('stats')
            .eq('id', campaignId)
            .single();

          if (camp) {
            const newStats = { ...camp.stats, failed: (camp.stats?.failed || 0) + 1 };
            await supabase
              .from('campaigns')
              .update({ stats: newStats })
              .eq('id', campaignId);
          }
        }

      throw error;
    }
  }, {
    connection: redisConnection,
    limiter: {
      max: 200,        // 80 mensagens
      duration: 1000  // por segundo
    },
    concurrency: 50    // 15 jobs simultâneos para ~25 msg/s
  });

  messageWorker.on('completed', (job) => {
    console.log(`✓ Mensagem enviada: ${job.id}`);
    if (typeof throughputTracker !== 'undefined') { throughputTracker.completedCount++; }
      // Registrar métrica da campanha
      if (job.data.campaignId && typeof recordCampaignMessage === 'function') {
        recordCampaignMessage(job.data.campaignId);
      }
      // Verificar se campanha foi concluída
      if (job.data.campaignId && typeof checkCampaignCompletion === 'function') {
        checkCampaignCompletion(job.data.campaignId);
      }
  });

  messageWorker.on('failed', (job, err) => {
    console.error(`✗ Falha no envio ${job.id}:`, err.message);

    // Atualizar stats da campanha com falha
    if (job.data.campaignId) {
      (async () => {
        try {
          const { data: camp } = await supabase
            .from('campaigns')
            .select('stats')
            .eq('id', job.data.campaignId)
            .single();

          if (camp) {
            const newStats = { ...camp.stats, failed: (camp.stats?.failed || 0) + 1 };
            await supabase
              .from('campaigns')
              .update({ stats: newStats })
              .eq('id', job.data.campaignId);

            // Verificar se campanha foi concluída
            if (typeof checkCampaignCompletion === 'function') {
              checkCampaignCompletion(job.data.campaignId);
            }
          }
        } catch (e) {
          console.error('Erro ao atualizar stats de falha:', e.message);
        }
      })();
    }
  });

  // Função para enviar template
  async function sendTemplate(to, templateName, language = 'pt_BR', components = [], customCredentials = null) {
    const phoneId = customCredentials?.phoneId || customCredentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = customCredentials?.token || customCredentials?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    console.log('[sendTemplate] Enviando para:', to, 'Template:', templateName, 'PhoneId:', phoneId?.slice(-6));

    // Buscar configuração de proxy
    const proxyConfig = await getProxyConfig(phoneId);

    const config = {
      method: 'POST',
      url: `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components: components
        }
      }
    };

    // Adicionar proxy agent se configurado
    const agent = createProxyAgent(proxyConfig);
    if (agent) {
      config.httpsAgent = agent;
      console.log('[sendTemplate] Usando proxy para envio');
    }

    try {
      const startApi = Date.now(); const response = await axios(config); console.log("[TIMING] API call:", Date.now() - startApi, "ms");
      return response.data;
    } catch (error) {
      console.error('[sendTemplate] Erro:', error.response?.data || error.message);
      return { error: error.response?.data || error.message };
    }
  }

  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json());


  const WA_API_URL = 'https://graph.facebook.com/v21.0';
  const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const WA_WABA_ID = process.env.WHATSAPP_WABA_ID;
  const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANIZATION_ID

// ============ SISTEMA DE LOGGING ============
async function logToDatabase(logData) {
  try {
    const {
      level = 'info',
      category,
      source,
      message,
      campaignId,
      contactId,
      flowId,
      requestData,
      responseData,
      errorDetails,
      durationMs
    } = logData;

    await supabase.from('system_logs').insert({
      organization_id: DEFAULT_ORG_ID,
      level,
      category,
      source,
      message,
      campaign_id: campaignId || null,
      contact_id: contactId || null,
      flow_id: flowId || null,
      request_data: requestData || null,
      response_data: responseData || null,
      error_details: errorDetails || null,
      duration_ms: durationMs || null
    });
  } catch (err) {
    console.error('[Log] Erro ao salvar log:', err.message);
  }
}

;
  // Normaliza telefone brasileiro para busca flexível
  function normalizePhoneForSearch(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length > 11) {
      cleaned = cleaned.substring(2);
    }
    return cleaned.slice(-8);
  }

  // Busca contato por telefone com normalização
  async function findContactByPhone(phoneNumber) {
    const normalized = normalizePhoneForSearch(phoneNumber);
    
    // Busca exata primeiro
    let { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();
    
    if (contact) return contact;
    
    // Busca por sufixo (últimos 8 dígitos)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .like('phone_number', '%' + normalized)
      .limit(1);
    
    return contacts?.[0] || null;
  }



  // Configuração de resposta automática
  const AUTO_REPLY_ENABLED = false; // Desabilitado - usar fluxos do frontend
  const AUTO_REPLY_MESSAGE = `Olá! 👋

  Obrigado por entrar em contato!

  Recebemos sua mensagem e em breve um atendente irá responder.

  ⏰ Horário de atendimento:
  Segunda a Sexta: 9h às 18h

  Enquanto isso, você pode:
  1️⃣ Digitar *AJUDA* para ver opções
  2️⃣ Digitar *HORARIO* para ver horários
  3️⃣ Aguardar atendimento humano`;

  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'WhatsApp API Backend is running' });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // ============ ENVIAR MENSAGEM ============
  async function sendWhatsAppMessage(to, message, customCredentials = null) {
    try {
      const phoneId = customCredentials?.phoneNumberId || WA_PHONE_ID;
      const token = customCredentials?.accessToken || WA_TOKEN;

      // Buscar configuração de proxy
      const proxyConfig = await getProxyConfig(phoneId);

      const config = {
        method: 'POST',
        url: `${WA_API_URL}/${phoneId}/messages`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace(/\D/g, ''),
          type: 'text',
          text: { body: message }
        }
      };

      // Adicionar proxy agent se configurado
      const agent = createProxyAgent(proxyConfig);
      if (agent) {
        config.httpsAgent = agent;
        console.log('[sendWhatsAppMessage] Usando proxy para envio');
      }

      const startApi = Date.now(); const response = await axios(config); console.log("[TIMING] API call:", Date.now() - startApi, "ms");
      console.log('Resposta enviada para:', to);
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar resposta:', error.response?.data || error.message);
      return null;
    }
  }

  // ============ SALVAR MENSAGEM DO FLUXO ============
  async function saveFlowMessage(contactId, wabaPhoneNumberId, messageType, messageContent, waMessageId = null) {
    try {
      // 1. Buscar phone_number_id do banco
      let dbPhoneNumberId = null;
      if (wabaPhoneNumberId) {
        const { data: phoneRecord } = await supabase
          .from('phone_numbers')
          .select('id')
          .eq('phone_number_id', wabaPhoneNumberId)
          .single();
        if (phoneRecord) {
          dbPhoneNumberId = phoneRecord.id;
        }
      }

      // 2. Buscar conversa existente (priorizar com phone_number_id, depois qualquer uma)
      let conversation = null;
      
      // Primeiro tentar encontrar conversa com phone_number_id específico
      if (dbPhoneNumberId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('contact_id', contactId)
          .eq('phone_number_id', dbPhoneNumberId)
          .eq('status', 'open')
          .single();
        conversation = conv;
      }
      
      // Se não encontrou, buscar qualquer conversa aberta do contato
      if (!conversation) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('contact_id', contactId)
          .is('phone_number_id', null)
          .eq('status', 'open')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single();
        conversation = conv;
      }
      // Se ainda não encontrou E não temos phone_number_id específico, buscar qualquer conversa
      if (!conversation && !dbPhoneNumberId) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("*")
          .eq("contact_id", contactId)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .single();
        conversation = conv;
      }

      // Se ainda não existe, criar nova
      if (!conversation) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            organization_id: DEFAULT_ORG_ID,
            contact_id: contactId,
            status: 'open',
            last_message_at: new Date().toISOString(),
            last_message_direction: 'outbound',
            phone_number_id: dbPhoneNumberId
          })
          .select()
          .single();
        conversation = newConv;
      }

      if (!conversation) {
        console.log('[Flow] Não foi possível criar/encontrar conversa');
        return null;
      }

      // 3. Salvar mensagem
      const { data: savedMsg, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          contact_id: contactId,
          whatsapp_message_id: waMessageId,
          direction: 'outbound',
          type: messageType,
          content: messageContent,
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('[Flow] Erro ao salvar mensagem:', error);
        return null;
      }

      // 4. Atualizar conversa
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_direction: 'outbound'
        })
        .eq('id', conversation.id);

      console.log('[Flow] Mensagem salva:', savedMsg.id, 'na conversa:', conversation.id);
      return savedMsg;
    } catch (error) {
      console.error('[Flow] Erro em saveFlowMessage:', error.message);
      return null;
    }
  }
    // Enviar mensagem (integrado com frontend)
    app.post("/api/messages/send", async (req, res) => {
      try {
        const { to, type, content, conversationId, contactId } = req.body;
        if (!to) return res.status(400).json({ error: "Campo to é obrigatório" });
  
        const phoneNumber = to.replace(/\D/g, "");
        let messageData = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phoneNumber
        };
            if (type === "template") {
            if (content.template_id) {
              const { data: tpl } = await supabase
                .from("message_templates")
                .select("name, language")
                .eq("id", content.template_id)
                .single();

              if (!tpl) return res.status(404).json({ error: "Template não encontrado" });

              const params = [];
              if (content.variables) {
                Object.values(content.variables).forEach(v => {
                  params.push({ type: "text", text: String(v) });
                });
              }

              messageData.type = "template";
              messageData.template = {
                name: tpl.name,
                language: { code: tpl.language || "pt_BR" },
                components: params.length > 0 ? [{ type: "body", parameters: params }] : []
              };
            } else {
              messageData.type = "template";
              messageData.template = content;
            }
          } else {
          messageData.type = "text";
          messageData.text = { body: content || "Olá!" };
        }
        const response = await axios.post(
          `${WA_API_URL}/${WA_PHONE_ID}/messages`,
          messageData,
          { headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" } }
        );
  
        console.log("Mensagem enviada:", response.data);
  
        // Salvar no banco se tiver conversationId e contactId
        if (conversationId && contactId) {
          // Preparar conteúdo da mensagem para salvar
          let messageContent = { text: content };
          
          // Se for template, buscar e salvar o conteúdo completo
          if (type === "template" && content.template_id) {
            const { data: fullTemplate } = await supabase
              .from("message_templates")
              .select("name, language, components")
              .eq("id", content.template_id)
              .single();
            
            if (fullTemplate) {
              // Extrair body, header, footer, buttons dos components
              let bodyText = "";
              let headerText = "";
              let footerText = "";
              let buttons = [];
              
              (fullTemplate.components || []).forEach(comp => {
                if (comp.type === "HEADER" && comp.text) headerText = comp.text;
                if (comp.type === "BODY" && comp.text) bodyText = comp.text;
                if (comp.type === "FOOTER" && comp.text) footerText = comp.text;
                if (comp.type === "BUTTONS" && comp.buttons) {
                  buttons = comp.buttons.map(b => ({ text: b.text, type: b.type }));
                }
              });
              
              // Substituir variáveis no texto
              if (content.variables) {
                Object.entries(content.variables).forEach(([key, value]) => {
                  bodyText = bodyText.replace(new RegExp("\{\{" + key + "\}\}", "g"), String(value));
                });
              }
              
              messageContent = {
                template_name: fullTemplate.name,
                header: headerText,
                body: bodyText,
                footer: footerText,
                buttons: buttons,
                raw: { components: fullTemplate.components }
              };
            }
          }
          
          const { data: msg, error } = await supabase
            .from("messages")
            .insert({
              conversation_id: conversationId,
              contact_id: contactId,
              whatsapp_message_id: response.data?.messages?.[0]?.id || null,
              direction: "outbound",
              type: type || "text",
              content: messageContent,
              status: "sent",
              sent_at: new Date().toISOString()
            })
            .select()
            .single();
  
          if (error) console.error("Erro ao salvar mensagem:", error);
          else console.log("Mensagem salva:", msg.id);
        }
  
        res.json({ success: true, data: response.data });
      } catch (error) {
        console.error("Erro ao enviar:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || error.message });
      }
    });
  

  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      console.log('Webhook verificado!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  app.post('/webhook', async (req, res) => {
    try {
      const body = req.body;
      console.log('Webhook recebido:', JSON.stringify(body, null, 2));

      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;
            if (value.messages) {
              for (const message of value.messages) {
                await processIncomingMessage(message, value.contacts?.[0], value.metadata);
              }
            }
            if (value.statuses) {
              for (const status of value.statuses) {
                await processMessageStatus(status);
              }
            }

            // ============ ACCOUNT UPDATE (Restricoes/Bloqueios) ============
            if (change.field === 'account_update') {
              console.log('[Webhook] Account update recebido:', JSON.stringify(change.value));
              
              const accountUpdate = change.value;
              const wabaIdFromEntry = entry.id;
              
              // Buscar WABA pelo waba_id
              const { data: wabaAccount } = await supabase
                .from('whatsapp_accounts')
                .select('id, name, status')
                .eq('waba_id', wabaIdFromEntry)
                .single();

              if (wabaAccount) {
                let newStatus = wabaAccount.status;
                let healthStatus = 'healthy';
                let errorMessage = null;

                // Mapear eventos de account_update para status
                if (accountUpdate.event === 'DISABLED' || accountUpdate.ban_info) {
                  newStatus = 'suspended';
                  healthStatus = 'critical';
                  errorMessage = accountUpdate.ban_info?.waba_ban_state || 'Conta desabilitada pela Meta';
                } else if (accountUpdate.event === 'ENABLED') {
                  newStatus = 'active';
                  healthStatus = 'healthy';
                } else if (accountUpdate.event === 'FLAGGED') {
                  newStatus = 'degraded';
                  healthStatus = 'degraded';
                  errorMessage = 'Conta sinalizada pela Meta';
                }

                // Atualizar no banco
                await supabase
                  .from('whatsapp_accounts')
                  .update({
                    status: newStatus,
                    health_status: healthStatus,
                    last_error_message: errorMessage,
                    last_health_check_at: new Date().toISOString()
                  })
                  .eq('id', wabaAccount.id);

                console.log('[Webhook] WABA ' + wabaAccount.name + ' status atualizado para: ' + newStatus);

                // Logar evento
                await supabase
                  .from('webhook_logs')
                  .insert({
                    event_type: 'account_update',
                    source: 'META',
                    whatsapp_account_id: wabaAccount.id,
                    payload: change.value,
                    processed: true
                  });
              }
            }

            // ============ PHONE NUMBER QUALITY UPDATE ============
            if (change.field === 'phone_number_quality_update') {
              console.log('[Webhook] Phone quality update recebido:', JSON.stringify(change.value));

              const qualityUpdate = change.value;
              
              // Buscar phone number pelo ID
              const { data: phone } = await supabase
                .from('phone_numbers')
                .select('id, whatsapp_account_id')
                .or('phone_number_id.eq.' + qualityUpdate.phone_number_id + ',phone_number.eq.' + (qualityUpdate.display_phone_number || '').replace(/\D/g, ''))
                .single();

              if (phone) {
                // Determinar quality rating baseado no tier
                let qualityRating = 'UNKNOWN';
                if (qualityUpdate.current_limit) {
                  if (['TIER_1K', 'TIER_10K', 'TIER_100K', 'TIER_UNLIMITED'].includes(qualityUpdate.current_limit)) {
                    qualityRating = 'GREEN';
                  } else if (qualityUpdate.current_limit === 'TIER_250') {
                    qualityRating = 'YELLOW';
                  } else {
                    qualityRating = 'RED';
                  }
                }

                await supabase
                  .from('phone_numbers')
                  .update({
                    quality_rating: qualityRating,
                    meta_data: {
                      messaging_limit_tier: qualityUpdate.current_limit,
                      quality_event: qualityUpdate.event,
                      quality_updated_at: new Date().toISOString()
                    }
                  })
                  .eq('id', phone.id);

                console.log('[Webhook] Phone quality atualizado: ' + qualityRating);

                // Atualizar qualidade no warming_pool_members
                if (phone.whatsapp_account_id) {
                  // Buscar todos os membros de pool dessa WABA com config do pool
                  const { data: members } = await supabase
                    .from('warming_pool_members')
                    .select('id, warming_pool_id, status, pause_reason, warming_pools(pause_on_quality, auto_resume, min_quality_to_resume)')
                    .eq('whatsapp_account_id', phone.whatsapp_account_id);

                  if (members && members.length > 0) {
                    for (const member of members) {
                      const pool = member.warming_pools;
                      const pauseOnQuality = pool?.pause_on_quality || 'RED';
                      const autoResume = pool?.auto_resume || false;
                      const minQualityToResume = pool?.min_quality_to_resume || 'GREEN';

                      let shouldPause = false;
                      let shouldResume = false;

                      // Verificar se deve pausar baseado na config do pool
                      if (pauseOnQuality !== 'OFF') {
                        if (qualityRating === 'RED') {
                          shouldPause = true;
                        } else if (qualityRating === 'YELLOW' && pauseOnQuality === 'YELLOW') {
                          shouldPause = true;
                        }
                      }

                      // Verificar se deve retomar (auto-resume)
                      if (autoResume && member.status === 'paused' && member.pause_reason === 'quality_drop') {
                        if (minQualityToResume === 'GREEN' && qualityRating === 'GREEN') {
                          shouldResume = true;
                        } else if (minQualityToResume === 'YELLOW' && (qualityRating === 'GREEN' || qualityRating === 'YELLOW')) {
                          shouldResume = true;
                        }
                      }

                      // Aplicar mudanças
                      const updateData = {
                        current_quality: qualityRating,
                        quality_updated_at: new Date().toISOString()
                      };

                      if (shouldPause) {
                        updateData.status = 'paused';
                        updateData.pause_reason = 'quality_drop';
                        updateData.paused_at = new Date().toISOString();
                      } else if (shouldResume) {
                        updateData.status = 'active';
                        updateData.pause_reason = null;
                        updateData.paused_at = null;
                      }

                      await supabase
                        .from('warming_pool_members')
                        .update(updateData)
                        .eq('id', member.id);

                      // Logar evento
                      let eventType = 'quality_changed';
                      let severity = 'info';
                      if (shouldPause) {
                        eventType = 'waba_paused';
                        severity = 'warning';
                      } else if (shouldResume) {
                        eventType = 'waba_resumed';
                        severity = 'info';
                      }

                      await supabase.from('warming_events_log').insert({
                        warming_pool_id: member.warming_pool_id,
                        whatsapp_account_id: phone.whatsapp_account_id,
                        event_type: eventType,
                        event_data: {
                          new_quality: qualityRating,
                          previous_limit: qualityUpdate.current_limit,
                          action: shouldPause ? 'paused' : shouldResume ? 'resumed' : 'updated',
                          pool_config: { pauseOnQuality, autoResume, minQualityToResume }
                        },
                        severity
                      });

                      console.log(`[Warming] WABA ${phone.whatsapp_account_id} qualidade=${qualityRating} ação=${shouldPause ? 'PAUSADO' : shouldResume ? 'RETOMADO' : 'atualizado'}`);
                    }
                  }

                  // Se qualidade caiu para RED, atualizar WABA para degraded
                  if (qualityRating === 'RED') {
                    await supabase
                      .from('whatsapp_accounts')
                      .update({
                        status: 'degraded',
                        health_status: 'degraded',
                        last_error_message: 'Numero com qualidade RED: ' + qualityUpdate.display_phone_number
                      })
                      .eq('id', phone.whatsapp_account_id);
                  } else if (qualityRating === 'GREEN') {
                    // Se voltou para GREEN, restaurar status da WABA
                    await supabase
                      .from('whatsapp_accounts')
                      .update({
                        status: 'active',
                        health_status: 'healthy',
                        last_error_message: null
                      })
                      .eq('id', phone.whatsapp_account_id)
                      .eq('status', 'degraded'); // Só atualiza se estava degraded
                  }
                }
              }

              // Logar evento
              await supabase
                .from('webhook_logs')
                .insert({
                  event_type: 'phone_number_quality_update',
                  source: 'META',
                  payload: change.value,
                  processed: true
                });
            }
          }
        }
      }
      res.sendStatus(200);
    } catch (error) {
      console.error('Erro no webhook:', error);
      res.sendStatus(200);
    }
  });

  

  // ============ EXECUÇÃO DE FLUXOS COM ESTADO PERSISTENTE ============

  // Inicia uma nova execução de fluxo
  async function startFlowExecution(flowId, contactId, triggerData = {}) {
    try {
      console.log('[Flow] Iniciando fluxo:', flowId, 'para contato:', contactId);

      // Buscar contato
      const { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (!contact) {
        console.error('[Flow] Contato não encontrado');
        return null;
      }

      // Buscar nós do fluxo
      const { data: nodes } = await supabase
        .from('flow_nodes')
        .select('*')
        .eq('flow_id', flowId);

      if (!nodes || nodes.length === 0) {
        console.log('[Flow] Nenhum nó encontrado');
        return null;
      }

      // Buscar edges do fluxo
      const { data: edges } = await supabase
        .from('flow_edges')
        .select('*')
        .eq('flow_id', flowId);

      // Encontrar nó inicial (trigger)
      const triggerNode = nodes.find(n => n.type && n.type.startsWith('trigger_'));
      if (!triggerNode) {
        console.log('[Flow] Nenhum trigger encontrado');
        return null;
      }

      // Criar registro de execução
      const { data: execution, error: execError } = await supabase
        .from('flow_executions')
        .insert({
          flow_id: flowId,
          contact_id: contactId,
          status: 'running',
          trigger_data: { 
            current_node_id: triggerNode.id,
            triggerData: triggerData,
            startedAt: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (execError) {
        console.error('[Flow] Erro ao criar execução:', execError.message);
        return null;
      }

      console.log('[Flow] Execução criada:', execution.id);

      // Executar fluxo a partir do trigger
      const wabaPhoneNumberId = triggerData?.wabaPhoneNumberId || null;
      await executeFlowNode(execution.id, triggerNode.id, flowId, contact, nodes, edges, wabaPhoneNumberId, triggerData);

      // Atualizar estatísticas do fluxo
      // Atualizar estatísticas do fluxo
      await supabase
        .from('flows')
        .update({ last_execution_at: new Date().toISOString() })
        .eq('id', flowId);

      return execution;

    } catch (error) {
      console.error('[Flow] Erro ao iniciar fluxo:', error.message);
      return null;
    }
  }

  // Executa um nó específico do fluxo
  async function executeFlowNode(executionId, nodeId, flowId, contact, nodes, edges, wabaPhoneNumberId = null, triggerData = {}) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      console.log('[Flow] Nó não encontrado:', nodeId);
      await updateExecutionStatus(executionId, 'completed');
      return;
    }

    console.log('[Flow] Executando nó:', node.type, '-', node.name || nodeId);

    // Atualizar nó atual na execução (usando trigger_data)
    const { data: currentExec } = await supabase
      .from('flow_executions')
      .select('trigger_data')
      .eq('id', executionId)
      .single();
    
    const updatedData = { ...(currentExec?.trigger_data || {}), current_node_id: nodeId };
    await supabase
      .from('flow_executions')
      .update({ trigger_data: updatedData })
      .eq('id', executionId);

    // Executar ação baseada no tipo do nó
    const actionResult = await executeNodeAction(node, contact, wabaPhoneNumberId, triggerData);

    // Encontrar próxima edge
    const outgoingEdges = edges?.filter(e => e.source_node_id === nodeId) || [];
    
    if (outgoingEdges.length === 0) {
      // Fim do fluxo
      console.log('[Flow] Fluxo concluído - sem mais edges');
      await updateExecutionStatus(executionId, 'completed');
      return;
    }

    // Se o nó retornou uma condição, seguir a edge correspondente
    let nextEdge;
    if (actionResult?.conditionOutput) {
      nextEdge = outgoingEdges.find(e => e.source_handle === actionResult.conditionOutput);
      if (!nextEdge) {
        console.log('[Flow] Edge não encontrada para output:', actionResult.conditionOutput);
        // Tentar edge sem handle específico como fallback
        nextEdge = outgoingEdges.find(e => !e.source_handle) || outgoingEdges[0];
      }
      console.log('[Flow] Seguindo edge de condição:', nextEdge?.source_handle);
    } else {
      // Por simplicidade, pega a primeira
      nextEdge = outgoingEdges[0];
    }
    // Não pausar se vier de condition_button (as saídas btn_0, btn_1 são apenas direcionamento)
    const isFromConditionButton = node.type === 'condition_button';
    const needsWait = !isFromConditionButton && nextEdge.source_handle && nextEdge.source_handle.startsWith('btn_');

    if (needsWait) {
      // Pausar e aguardar resposta do usuário
      const buttonId = nextEdge.source_handle; // ex: 'btn_0', 'btn_1'
      console.log('[Flow] Aguardando clique no botão:', buttonId);
      
      const { data: execForPause } = await supabase
        .from('flow_executions')
        .select('trigger_data')
        .eq('id', executionId)
        .single();
      
      const pauseData = { 
        ...(execForPause?.trigger_data || {}), 
        waiting_for: 'button:' + buttonId,
        waiting_for_node_id: nextEdge.target_node_id,
        wabaPhoneNumberId: wabaPhoneNumberId 
      };
      
      await supabase
        .from('flow_executions')
        .update({ status: 'waiting', trigger_data: pauseData })
        .eq('id', executionId);
      
      console.log('[Flow] Execução pausada, aguardando botão:', buttonId);
      return; // Para a execução aqui
    }

    // Se não precisa esperar, continuar para o próximo nó
    // Pequeno delay entre nós para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 500));
    await executeFlowNode(executionId, nextEdge.target_node_id, flowId, contact, nodes, edges, wabaPhoneNumberId, triggerData);
  }

  // Executa a ação de um nó específico
  async function executeNodeAction(node, contact, wabaPhoneNumberId = null, triggerData = {}) {
    const config = node.config || {};

    if (node.type === 'action_send_text') {
      let message = config.message || '';
      message = replaceContactVariables(message, contact);
      
      if (message.trim()) {
        // Buscar credenciais WABA se disponível
        let customCreds = null;
    let proxyConfig = null;
        if (wabaPhoneNumberId) {
          const { data: phoneData } = await supabase
            .from('phone_numbers')
            .select('whatsapp_account_id')
            .eq('phone_number_id', wabaPhoneNumberId)
            .single();

          if (phoneData?.whatsapp_account_id) {
            const { data: wabaData } = await supabase
              .from('whatsapp_accounts')
              .select('access_token_encrypted')
              .eq('id', phoneData.whatsapp_account_id)
              .single();

            if (wabaData?.access_token_encrypted) {
              customCreds = {
                phoneNumberId: wabaPhoneNumberId,
                accessToken: wabaData.access_token_encrypted
              };
              console.log('[Flow] Usando credenciais da WABA:', wabaPhoneNumberId);
            }
          }
        }

        await sendWhatsAppMessage(contact.phone_number, message.trim(), customCreds);
        console.log('[Flow] Texto enviado');
        await saveFlowMessage(contact.id, wabaPhoneNumberId, 'text', { text: message.trim() });
      }

    } else if (node.type === 'condition_button') {
      // Nó de condição: verifica qual botão foi clicado
      const clickedButton = triggerData?.buttonText || triggerData?.buttonId || '';
      const conditions = config.conditions || [];
      
      console.log('[Flow] Condição de botão - clicado:', clickedButton);
      console.log('[Flow] Condições configuradas:', JSON.stringify(conditions));
      
      // Encontrar qual condição corresponde ao botão clicado
      let matchedCondition = null;
      for (const cond of conditions) {
        if (cond.buttonText && clickedButton.toLowerCase().includes(cond.buttonText.toLowerCase())) {
          matchedCondition = cond;
          break;
        }
      }
      
      // Retornar o output handle para seguir a edge correta
      if (matchedCondition) {
        console.log('[Flow] Condição matched:', matchedCondition.buttonText, '-> output:', matchedCondition.output);
        return { conditionOutput: matchedCondition.output };
      } else {
        // Se não encontrou, tentar output 'default' ou 'else'
        const defaultCond = conditions.find(c => c.output === 'default' || c.output === 'else');
        if (defaultCond) {
          console.log('[Flow] Usando condição default');
          return { conditionOutput: defaultCond.output };
        }
        console.log('[Flow] Nenhuma condição matched para:', clickedButton);
        return { conditionOutput: null };
      }

    } else if (node.type === 'action_send_template') {
      const templateName = config.templateName || config.template_name;
      const language = config.templateLanguage || config.language || 'pt_BR';
      const templateVariables = config.templateVariables || {};

      if (templateName) {
        // Buscar dados do template ANTES de enviar para verificar header
        const { data: tplData } = await supabase
          .from('message_templates')
          .select('name, components')
          .eq('name', templateName)
          .single();

        const components = [];
        const headerImageUrl = config.headerImageUrl || config.header_image_url;

        // Verificar se template tem HEADER com IMAGE/VIDEO/DOCUMENT
        if (tplData?.components) {
          const headerComp = tplData.components.find(c => c.type === 'HEADER');
          if (headerComp && headerComp.format === 'IMAGE') {
            let imageUrl = headerImageUrl;
            if (!imageUrl && headerComp.example?.header_handle?.[0]) {
              imageUrl = headerComp.example.header_handle[0];
            }
            if (imageUrl) {
              components.push({
                type: 'header',
                parameters: [{ type: 'image', image: { link: imageUrl } }]
              });
              console.log('[Flow] Header IMAGE adicionado');
            }
          } else if (headerComp && headerComp.format === 'VIDEO') {
            const videoUrl = config.headerVideoUrl || headerComp.example?.header_handle?.[0];
            if (videoUrl) {
              components.push({
                type: 'header',
                parameters: [{ type: 'video', video: { link: videoUrl } }]
              });
              console.log('[Flow] Header VIDEO adicionado');
            }
          } else if (headerComp && headerComp.format === 'DOCUMENT') {
            const docUrl = config.headerDocumentUrl || headerComp.example?.header_handle?.[0];
            if (docUrl) {
              components.push({
                type: 'header',
                parameters: [{ type: 'document', document: { link: docUrl } }]
              });
              console.log('[Flow] Header DOCUMENT adicionado');
            }
          }
        }

        // Adicionar parametros do body
        const params = Object.values(templateVariables).map(value => {
          let text = replaceContactVariables(String(value), contact);
          return { type: 'text', text };
        });

        if (params.length > 0) {
          components.push({ type: 'body', parameters: params });
        }

        // Buscar credenciais WABA para template
        let templateCreds = null;
        let effectivePhoneNumberId = wabaPhoneNumberId;

        console.log('[Flow] Config wabaId:', config.wabaId, '| wabaPhoneNumberId:', wabaPhoneNumberId);

        // Se config.wabaId estiver definido, usar essa WABA específica
        if (config.wabaId) {
          const { data: wabaData } = await supabase
            .from('whatsapp_accounts')
            .select('access_token_encrypted')
            .eq('id', config.wabaId)
            .single();

          const { data: phoneData } = await supabase
            .from('phone_numbers')
            .select('phone_number_id')
            .eq('whatsapp_account_id', config.wabaId)
            .limit(1)
            .single();

          if (wabaData?.access_token_encrypted && phoneData?.phone_number_id) {
            templateCreds = {
              phoneNumberId: phoneData.phone_number_id,
              accessToken: wabaData.access_token_encrypted
            };
            effectivePhoneNumberId = phoneData.phone_number_id;
            console.log('[Flow] Usando WABA configurada no fluxo:', config.wabaId);
          }
        } else if (wabaPhoneNumberId) {
          // Fallback: usar wabaPhoneNumberId do trigger
          const { data: phoneData } = await supabase
            .from('phone_numbers')
            .select('whatsapp_account_id')
            .eq('phone_number_id', wabaPhoneNumberId)
            .single();

          if (phoneData?.whatsapp_account_id) {
            const { data: wabaData } = await supabase
              .from('whatsapp_accounts')
              .select('access_token_encrypted')
              .eq('id', phoneData.whatsapp_account_id)
              .single();

            if (wabaData?.access_token_encrypted) {
              templateCreds = {
                phoneNumberId: wabaPhoneNumberId,
                accessToken: wabaData.access_token_encrypted
              };
            }
          }
        }

        const sendResult = await sendTemplate(contact.phone_number, templateName, language, components, templateCreds);

        // Verificar resultado do envio
        if (sendResult?.error) {
          console.error('[Flow] Erro ao enviar template:', templateName, JSON.stringify(sendResult.error));
        } else {
          console.log('[Flow] Template enviado com sucesso:', templateName);
        }

        let bodyText = '', headerText = '', footerText = '', buttons = [];
        if (tplData?.components) {
          (tplData.components || []).forEach(comp => {
            if (comp.type === 'HEADER' && comp.text) headerText = comp.text;
            if (comp.type === 'BODY' && comp.text) bodyText = comp.text;
            if (comp.type === 'FOOTER' && comp.text) footerText = comp.text;
            if (comp.type === 'BUTTONS' && comp.buttons) {
              buttons = comp.buttons.map(b => ({ text: b.text, type: b.type }));
            }
          });
        }

        await saveFlowMessage(contact.id, effectivePhoneNumberId, 'template', {
          template_name: templateName,
          header: headerText,
          body: bodyText,
          footer: footerText,
          buttons: buttons,
        });
      }

    } else if (node.type === 'action_send_cta_url') {
      const ctaConfig = config.ctaUrl || config;
      const headerText = ctaConfig.headerText || '';
      let bodyText = ctaConfig.bodyText || '';
      const footerText = ctaConfig.footerText || '';
      const buttonText = ctaConfig.buttonText || 'Acessar';
      let url = ctaConfig.url || '';

      if (url && bodyText) {
        bodyText = replaceContactVariables(bodyText, contact);
        
        // Criar link rastreado
        const trackedUrl = await createTrackedLink(url, contact.id, null, 'flow_cta', buttonText);

        const ctaMessage = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: contact.phone_number.replace(/\D/g, ''),
          type: 'interactive',
          interactive: {
            type: 'cta_url',
            body: { text: bodyText },
            action: {
              name: 'cta_url',
              parameters: {
                display_text: buttonText,
                url: trackedUrl
              }
            }
          }
        };

        if (headerText) ctaMessage.interactive.header = { type: 'text', text: headerText };
        if (footerText) ctaMessage.interactive.footer = { text: footerText };

        await axios.post(
          `${WA_API_URL}/${WA_PHONE_ID}/messages`,
          ctaMessage,
          { headers: { 'Authorization': `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('[Flow] CTA URL enviado com tracking');
        await saveFlowMessage(contact.id, wabaPhoneNumberId, 'cta_url', { header: headerText, body: bodyText, footer: footerText, buttonText: buttonText, url: url });
      }

    } else if (node.type === 'action_add_tag') {
      const tag = config.tag;
      if (tag) {
        const currentTags = contact.tags || [];
        if (!currentTags.includes(tag)) {
          await supabase
            .from('contacts')
            .update({ tags: [...currentTags, tag] })
            .eq('id', contact.id);
          console.log('[Flow] Tag adicionada:', tag);
        }
      }

    } else if (node.type === 'action_wait') {
      const seconds = config.seconds || 1;
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      console.log('[Flow] Aguardou', seconds, 'segundos');

    } else if (node.type && node.type.startsWith('trigger_')) {
      // Triggers não executam ação, apenas iniciam o fluxo
      console.log('[Flow] Trigger processado:', node.type);
    }
  }

  // Substitui variáveis do contato no texto
  function replaceContactVariables(text, contact) {
    if (!text) return '';
    
    text = text.replace(/\{\{nome\}\}/gi, contact.name || '');
    text = text.replace(/\{\{name\}\}/gi, contact.name || '');
    text = text.replace(/\{\{primeiro_nome\}\}/gi, (contact.name || '').split(' ')[0] || '');
    text = text.replace(/\{\{first_name\}\}/gi, (contact.name || '').split(' ')[0] || '');
    text = text.replace(/\{\{telefone\}\}/gi, contact.phone_number || '');
    text = text.replace(/\{\{phone\}\}/gi, contact.phone_number || '');

    if (contact.custom_fields && typeof contact.custom_fields === 'object') {
      Object.entries(contact.custom_fields).forEach(([key, val]) => {
        text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), String(val) || '');
      });
    }

    return text;
  }

  // Atualiza status da execução
  async function updateExecutionStatus(executionId, status) {
    const updates = { status };
    
    if (status === 'completed' || status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }

    await supabase
      .from('flow_executions')
      .update(updates)
      .eq('id', executionId);
  }

  // Continua uma execução pausada (quando usuário clica no botão)
  
// Importar funções de campanha
const { sendWhatsAppImage, sendWhatsAppCTA, sendWhatsAppButtons } = require("./campaignActions");

// Função para executar sequência de ações de botão da campanha
async function executeCampaignButtonAction(contextMessageId, buttonText, contact, wabaPhoneNumberId) {
  try {
    console.log("[Campaign Action] Verificando ações para context:", contextMessageId, "botão:", buttonText);

    const { data: campMsg } = await supabase
      .from("campaign_messages")
      .select("campaign_id")
      .eq("message_id", contextMessageId)
      .maybeSingle();

    if (!campMsg) {
      console.log("[Campaign Action] Mensagem não é de campanha");
      return false;
    }

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id, name, button_actions, whatsapp_account_id, phone_number_id")
      .eq("id", campMsg.campaign_id)
      .single();

    if (!campaign || !campaign.button_actions) {
      console.log("[Campaign Action] Campanha não tem button_actions");
      return false;
    }

    const buttonActions = campaign.button_actions;
    const actions = buttonActions[buttonText];

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      console.log("[Campaign Action] Nenhuma ação configurada para botão:", buttonText);
      return false;
    }

    console.log("[Campaign Action] Executando", actions.length, "ações para botão:", buttonText);

    let customCreds = null;
    let proxyConfig = null;
    if (campaign.phone_number_id) {
      const { data: phoneData } = await supabase
        .from("phone_numbers")
        .select("phone_number_id, whatsapp_account_id")
        .eq("id", campaign.phone_number_id)
        .single();

      if (phoneData?.whatsapp_account_id) {
        const { data: wabaData } = await supabase
          .from("whatsapp_accounts")
          .select("access_token_encrypted, proxy_enabled, proxy_type, proxy_url, proxy_username, proxy_password_encrypted")
          .eq("id", phoneData.whatsapp_account_id)
          .single();

        if (wabaData?.access_token_encrypted) {
          customCreds = {
            phoneNumberId: phoneData.phone_number_id,
            accessToken: wabaData.access_token_encrypted
          };
          // Configuração de proxy
          if (wabaData.proxy_enabled) {
            proxyConfig = {
              proxy_enabled: wabaData.proxy_enabled,
              proxy_type: wabaData.proxy_type,
              proxy_url: wabaData.proxy_url,
              proxy_username: wabaData.proxy_username,
              proxy_password: wabaData.proxy_password_encrypted
            };
          }
        }
      }
    }

    function replaceVars(text) {
      if (!text) return "";
      let result = text;
      result = result.replace(/{{nome}}/gi, contact.name || "");
      result = result.replace(/{{telefone}}/gi, contact.phone_number || "");
      result = result.replace(/{{email}}/gi, contact.email || "");
      if (contact.custom_fields) {
        Object.entries(contact.custom_fields).forEach(([key, value]) => {
          result = result.replace(new RegExp("{{" + key + "}}", "gi"), value || "");
        });
      }
      return result;
    }

    // Registrar entrada no funil (primeiro contato com o botão)
    await supabase.from("campaign_funnel_events").insert({
      campaign_id: campaign.id,
      contact_id: contact.id,
      button_text: buttonText,
      step_index: 0,
      action_type: "button_click",
      action_label: "Clicou no botão",
      status: "executed"
    });

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log("[Campaign Action] Etapa", i + 1, "/", actions.length, "- Tipo:", action.type);
      
      // Labels para cada tipo de ação
      const actionLabels = {
        send_text: "Texto enviado",
        send_image: "Imagem enviada",
        send_cta_url: "Link enviado",
        send_buttons: "Botões enviados",
        delay: "Aguardou " + (action.delaySeconds || 1) + "s",
        add_tag: "Tag: " + (action.tag || ""),
        webhook: "Webhook chamado"
      };

      switch (action.type) {
        case "send_text": {
          const message = replaceVars(action.message);
          if (message.trim()) {
            await sendWhatsAppMessage(contact.phone_number, message.trim(), customCreds);
            console.log("[Campaign Action] Texto enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "text", { text: message.trim() });
            await supabase.from("campaign_funnel_events").insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              button_text: buttonText,
              step_index: i + 1,
              action_type: action.type,
              action_label: actionLabels[action.type],
              status: "executed",
              metadata: { message: message.slice(0, 100) }
            });
          }
          break;
        }
        case "send_image": {
          if (action.imageUrl) {
            const caption = replaceVars(action.imageCaption || "");
            await sendWhatsAppImage(contact.phone_number, action.imageUrl, caption, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Campaign Action] Imagem enviada");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "image", { url: action.imageUrl, caption: caption });
            await supabase.from("campaign_funnel_events").insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              button_text: buttonText,
              step_index: i + 1,
              action_type: action.type,
              action_label: actionLabels[action.type],
              status: "executed",
              metadata: { imageUrl: action.imageUrl }
            });
          }
          break;
        }
        case "send_cta_url": {
          const trackedCtaUrl = await createTrackedLink(action.ctaUrl, contact.id, null, "warming_cta", action.ctaButtonText);
          if (action.ctaText && action.ctaUrl && action.ctaButtonText) {
            const ctaOptions = {
              header: action.ctaHeader ? replaceVars(action.ctaHeader) : null,
              body: replaceVars(action.ctaText),
              footer: action.ctaFooter ? replaceVars(action.ctaFooter) : null,
              buttonText: action.ctaButtonText,
              url: await createTrackedLink(action.ctaUrl, contact.id, campaign.id, "campaign_cta", action.ctaButtonText)
            };
            await sendWhatsAppCTA(contact.phone_number, ctaOptions, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Campaign Action] CTA enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "cta_url", { header: ctaOptions.header, body: ctaOptions.body, footer: ctaOptions.footer, buttonText: ctaOptions.buttonText, url: ctaOptions.url });
            await supabase.from("campaign_funnel_events").insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              button_text: buttonText,
              step_index: i + 1,
              action_type: action.type,
              action_label: actionLabels[action.type],
              status: "executed",
              metadata: { url: action.ctaUrl, buttonText: action.ctaButtonText }
            });
          }
          break;
        }
        case "send_buttons": {
          if (action.buttonsText && action.buttons && action.buttons.length > 0) {
            const text = replaceVars(action.buttonsText);
            const btnResult = await sendWhatsAppButtons(contact.phone_number, text, action.buttons, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Campaign Action] Botões enviados, messageId:", btnResult.messageId);
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "interactive", { body: text, buttons: action.buttons });
            
            // Se tem sub-fluxos (buttonFlows), salvar para rastreamento
            if (btnResult.messageId && action.buttonFlows && Object.keys(action.buttonFlows).length > 0) {
              await supabase.from("campaign_interactive_messages").insert({
                campaign_id: campaign.id,
                contact_id: contact.id,
                message_id: btnResult.messageId,
                button_flows: action.buttonFlows
              });
              console.log("[Campaign Action] Sub-fluxos salvos para rastreamento");
            }
            
            await supabase.from("campaign_funnel_events").insert({
              campaign_id: campaign.id,
              contact_id: contact.id,
              button_text: buttonText,
              step_index: i + 1,
              action_type: action.type,
              action_label: actionLabels[action.type],
              status: "executed",
              metadata: { buttons: action.buttons, messageId: btnResult.messageId }
            });
          }
          break;
        }
        case "delay": {
          const seconds = action.delaySeconds || 1;
          console.log("[Campaign Action] Aguardando", seconds, "segundos...");
          await new Promise(resolve => setTimeout(resolve, seconds * 1000));
          break;
        }
        case "add_tag": {
          if (action.tag) {
            const currentTags = contact.tags || [];
            if (!currentTags.includes(action.tag)) {
              await supabase.from("contacts").update({ tags: [...currentTags, action.tag] }).eq("id", contact.id);
              contact.tags = [...currentTags, action.tag];
              console.log("[Campaign Action] Tag adicionada:", action.tag);
              await supabase.from("campaign_funnel_events").insert({
                campaign_id: campaign.id,
                contact_id: contact.id,
                button_text: buttonText,
                step_index: i + 1,
                action_type: action.type,
                action_label: "Tag: " + action.tag,
                status: "executed",
                metadata: { tag: action.tag }
              });
            }
          }
          break;
        }
        case "webhook": {
          if (action.webhookUrl) {
            try {
              await fetch(action.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "button_click",
                  campaign_id: campaign.id,
                  button_text: buttonText,
                  contact: { id: contact.id, name: contact.name, phone: contact.phone_number },
                  timestamp: new Date().toISOString()
                })
              });
              console.log("[Campaign Action] Webhook chamado");
              await supabase.from("campaign_funnel_events").insert({
                campaign_id: campaign.id,
                contact_id: contact.id,
                button_text: buttonText,
                step_index: i + 1,
                action_type: action.type,
                action_label: actionLabels[action.type],
                status: "executed",
                metadata: { webhookUrl: action.webhookUrl }
              });
            } catch (err) {
              console.error("[Campaign Action] Erro webhook:", err.message);
            }
          }
          break;
        }
      }
      if (action.type !== "delay" && i < actions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log("[Campaign Action] Todas as ações concluídas");
    return true;
  } catch (error) {
    console.error("[Campaign Action] Erro:", error.message);
    return false;
  }
}


// Função para executar sub-fluxos de mensagens interativas (send_buttons)
async function executeInteractiveSubFlow(contextMessageId, buttonText, contact, wabaPhoneNumberId) {
  try {
    console.log("[Interactive SubFlow] Verificando sub-fluxo para:", contextMessageId, "botão:", buttonText);
    
    // Buscar mensagem interativa pelo message_id
    const { data: interactiveMsg } = await supabase
      .from("campaign_interactive_messages")
      .select("campaign_id, button_flows")
      .eq("message_id", contextMessageId)
      .maybeSingle();
    
    if (!interactiveMsg || !interactiveMsg.button_flows) {
      console.log("[Interactive SubFlow] Nenhum sub-fluxo encontrado");
      return false;
    }
    
    const buttonFlows = interactiveMsg.button_flows;
    const subActions = buttonFlows[buttonText];
    
    if (!subActions || !Array.isArray(subActions) || subActions.length === 0) {
      console.log("[Interactive SubFlow] Nenhuma ação para botão:", buttonText);
      return false;
    }
    
    console.log("[Interactive SubFlow] Executando", subActions.length, "sub-ações");
    
    // Buscar credenciais customizadas se necessário
    let customCreds = null;
    let proxyConfig = null;
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("phone_number_id")
      .eq("id", interactiveMsg.campaign_id)
      .single();
      
    if (campaign?.phone_number_id) {
      const { data: phoneData } = await supabase
        .from("phone_numbers")
        .select("phone_number_id, whatsapp_account_id")
        .eq("id", campaign.phone_number_id)
        .single();
      
      if (phoneData?.whatsapp_account_id) {
        const { data: wabaData } = await supabase
          .from("whatsapp_accounts")
          .select("access_token_encrypted, proxy_enabled, proxy_type, proxy_url, proxy_username, proxy_password_encrypted")
          .eq("id", phoneData.whatsapp_account_id)
          .single();
        
        if (wabaData?.access_token_encrypted) {
          customCreds = {
            phoneNumberId: phoneData.phone_number_id,
            accessToken: wabaData.access_token_encrypted
          };
          // Configuração de proxy
          if (wabaData.proxy_enabled) {
            proxyConfig = {
              proxy_enabled: wabaData.proxy_enabled,
              proxy_type: wabaData.proxy_type,
              proxy_url: wabaData.proxy_url,
              proxy_username: wabaData.proxy_username,
              proxy_password: wabaData.proxy_password_encrypted
            };
          }
        }
      }
    }
    
    function replaceVars(text) {
      if (!text) return "";
      let result = text;
      result = result.replace(/{{nome}}/gi, contact.name || "");
      result = result.replace(/{{telefone}}/gi, contact.phone_number || "");
      result = result.replace(/{{email}}/gi, contact.email || "");
      return result;
    }
    
    // Executar sub-ações
    for (let i = 0; i < subActions.length; i++) {
      const action = subActions[i];
      console.log("[Interactive SubFlow] Sub-etapa", i + 1, "/", subActions.length, "- Tipo:", action.type);
      
      switch (action.type) {
        case "send_text": {
          const message = replaceVars(action.message);
          if (message.trim()) {
            await sendWhatsAppMessage(contact.phone_number, message.trim(), customCreds);
            console.log("[Interactive SubFlow] Texto enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "text", { text: message.trim() });
          }
          break;
        }
        case "send_image": {
          if (action.imageUrl) {
            const caption = replaceVars(action.imageCaption || "");
            await sendWhatsAppImage(contact.phone_number, action.imageUrl, caption, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Interactive SubFlow] Imagem enviada");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "image", { url: action.imageUrl, caption: caption });
          }
          break;
        }
        case "send_cta_url": {
          const trackedCtaUrl = await createTrackedLink(action.ctaUrl, contact.id, null, "warming_cta", action.ctaButtonText);
          if (action.ctaText && action.ctaUrl && action.ctaButtonText) {
            const ctaOptions = {
              header: action.ctaHeader ? replaceVars(action.ctaHeader) : null,
              body: replaceVars(action.ctaText),
              footer: action.ctaFooter ? replaceVars(action.ctaFooter) : null,
              buttonText: action.ctaButtonText,
              url: await createTrackedLink(action.ctaUrl, contact.id, campaign.id, "campaign_cta", action.ctaButtonText)
            };
            await sendWhatsAppCTA(contact.phone_number, ctaOptions, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Interactive SubFlow] CTA enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "cta_url", { header: ctaOptions.header, body: ctaOptions.body, footer: ctaOptions.footer, buttonText: ctaOptions.buttonText, url: ctaOptions.url });
          }
          break;
        }
        case "delay": {
          const seconds = action.delaySeconds || 1;
          console.log("[Interactive SubFlow] Aguardando", seconds, "segundos...");
          await new Promise(resolve => setTimeout(resolve, seconds * 1000));
          break;
        }
        case "add_tag": {
          if (action.tag) {
            const currentTags = contact.tags || [];
            if (!currentTags.includes(action.tag)) {
              await supabase.from("contacts").update({ tags: [...currentTags, action.tag] }).eq("id", contact.id);
              contact.tags = [...currentTags, action.tag];
              console.log("[Interactive SubFlow] Tag adicionada:", action.tag);
            }
          }
          break;
        }
        case "webhook": {
          if (action.webhookUrl) {
            try {
              await fetch(action.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "interactive_button_click",
                  campaign_id: interactiveMsg.campaign_id,
                  button_text: buttonText,
                  contact: { id: contact.id, name: contact.name, phone: contact.phone_number },
                  timestamp: new Date().toISOString()
                })
              });
              console.log("[Interactive SubFlow] Webhook chamado");
            } catch (err) {
              console.error("[Interactive SubFlow] Erro webhook:", err.message);
            }
          }
          break;
        }
      }
      
      if (action.type !== "delay" && i < subActions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Registrar no funil
    await supabase.from("campaign_funnel_events").insert({
      campaign_id: interactiveMsg.campaign_id,
      contact_id: contact.id,
      button_text: buttonText,
      step_index: 0,
      action_type: "interactive_button_click",
      action_label: "Clicou em: " + buttonText,
      status: "executed"
    });
    
    console.log("[Interactive SubFlow] Todas as sub-ações concluídas");
    return true;
  } catch (error) {
    console.error("[Interactive SubFlow] Erro:", error.message);
    return false;
  }
}

// =============================================
// WARMING BUTTON ACTIONS
// Executa ações quando lead clica em botão de warming
// =============================================

// Função para executar ações de botão do warming
async function executeWarmingButtonAction(contextMessageId, buttonText, contact, wabaPhoneNumberId) {
  try {
    console.log("[Warming Action] Verificando ações para context:", contextMessageId, "botão:", buttonText);

    // Buscar execução de warming pelo whatsapp_message_id
    const { data: warmingExec } = await supabase
      .from("warming_message_executions")
      .select("id, warming_member_message_id, warming_contact_history_id")
      .eq("whatsapp_message_id", contextMessageId)
      .maybeSingle();

    if (!warmingExec) {
      console.log("[Warming Action] Mensagem não é de warming");
      return false;
    }

    // Buscar configuração da mensagem com button_actions
    const { data: warmingMsg } = await supabase
      .from("warming_member_messages")
      .select("id, button_actions, warming_pool_member_id")
      .eq("id", warmingExec.warming_member_message_id)
      .single();

    if (!warmingMsg || !warmingMsg.button_actions || Object.keys(warmingMsg.button_actions).length === 0) {
      console.log("[Warming Action] Mensagem não tem button_actions");
      return false;
    }

    // Buscar pool_id via pool_member
    const { data: poolMember } = await supabase
      .from("warming_pool_members")
      .select("warming_pool_id, whatsapp_account_id")
      .eq("id", warmingMsg.warming_pool_member_id)
      .single();

    if (!poolMember) {
      console.log("[Warming Action] Pool member não encontrado");
      return false;
    }

    const buttonActions = warmingMsg.button_actions;
    const actions = buttonActions[buttonText];

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      console.log("[Warming Action] Nenhuma ação configurada para botão:", buttonText);
      return false;
    }

    console.log("[Warming Action] Executando", actions.length, "ações para botão:", buttonText);

    // Buscar credenciais da WABA
    let customCreds = null;
    let proxyConfig = null;
    const wabaId = poolMember.whatsapp_account_id;

    if (wabaId) {
      const wabaInfo = await getWabaInfo(wabaId);
      if (wabaInfo) {
        customCreds = {
          phoneNumberId: wabaInfo.phone_number_id,
          accessToken: wabaInfo.access_token
        };
        if (wabaInfo.proxy_enabled) {
          proxyConfig = {
            proxy_enabled: wabaInfo.proxy_enabled,
            proxy_type: wabaInfo.proxy_type,
            proxy_url: wabaInfo.proxy_url,
            proxy_username: wabaInfo.proxy_username,
            proxy_password: wabaInfo.proxy_password_encrypted
          };
        }
      }
    }


    // Helper para substituir variáveis
    function replaceVars(text) {
      if (!text) return "";
      let result = text;
      result = result.replace(/{{nome}}/gi, contact.name || "");
      result = result.replace(/{{telefone}}/gi, contact.phone_number || "");
      result = result.replace(/{{email}}/gi, contact.email || "");
      if (contact.custom_fields) {
        Object.entries(contact.custom_fields).forEach(([key, value]) => {
          result = result.replace(new RegExp("{{" + key + "}}", "gi"), value || "");
        });
      }
      return result;
    }

    // Registrar entrada no funil
    await supabase.from("warming_funnel_events").insert({
      warming_pool_id: poolMember.warming_pool_id,
      warming_member_message_id: warmingMsg.id,
      contact_id: contact.id,
      button_text: buttonText,
      step_index: 0,
      action_type: "button_click",
      action_label: "Clicou no botão",
      status: "executed"
    });

    // Executar cada ação
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log("[Warming Action] Etapa", i + 1, "/", actions.length, "- Tipo:", action.type);

      const actionLabels = {
        send_text: "Texto enviado",
        send_image: "Imagem enviada",
        send_cta_url: "Link enviado",
        send_buttons: "Botões enviados",
        delay: "Aguardou " + (action.delaySeconds || 1) + "s",
        add_tag: "Tag: " + (action.tag || ""),
        webhook: "Webhook chamado"
      };

      switch (action.type) {
        case "send_text": {
          const message = replaceVars(action.message);
          if (message.trim()) {
            await sendWhatsAppMessage(contact.phone_number, message.trim(), customCreds);
            console.log("[Warming Action] Texto enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "text", { text: message.trim() });
            await supabase.from("warming_funnel_events").insert({
              warming_pool_id: poolMember.warming_pool_id,
              warming_member_message_id: warmingMsg.id,
              contact_id: contact.id,
              button_text: buttonText,
              step_index: i + 1,
              action_type: action.type,
              action_label: actionLabels[action.type],
              status: "executed",
              metadata: { message: message.slice(0, 100) }
            });
          }
          break;
        }
        case "send_image": {
          if (action.imageUrl) {
            const caption = replaceVars(action.imageCaption || "");
            await sendWhatsAppImage(contact.phone_number, action.imageUrl, caption, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Warming Action] Imagem enviada");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "image", { url: action.imageUrl, caption: caption });
            await supabase.from("warming_funnel_events").insert({
              warming_pool_id: poolMember.warming_pool_id,
              warming_member_message_id: warmingMsg.id,
              contact_id: contact.id,
              button_text: buttonText,
              step_index: i + 1,
              action_type: action.type,
              action_label: actionLabels[action.type],
              status: "executed"
            });
          }
          break;
        }
        case "send_cta_url": {
          const trackedCtaUrl = await createTrackedLink(action.ctaUrl, contact.id, null, "warming_cta", action.ctaButtonText);
          if (action.ctaText && action.ctaUrl && action.ctaButtonText) {
            const ctaOptions = {
              header: action.ctaHeader ? replaceVars(action.ctaHeader) : null,
              body: replaceVars(action.ctaText),
              footer: action.ctaFooter ? replaceVars(action.ctaFooter) : null,
              buttonText: action.ctaButtonText,
              url: trackedCtaUrl
            };
            await sendWhatsAppCTA(contact.phone_number, ctaOptions, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Warming Action] CTA enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "cta_url", { header: ctaOptions.header, body: ctaOptions.body, footer: ctaOptions.footer, buttonText: ctaOptions.buttonText, url: ctaOptions.url });
            await supabase.from("warming_funnel_events").insert({
              warming_pool_id: poolMember.warming_pool_id,
              warming_member_message_id: warmingMsg.id,
              contact_id: contact.id,
              button_text: buttonText,
              step_index: i + 1,
              action_type: action.type,
              action_label: actionLabels[action.type],
              status: "executed"
            });
          }
          break;
        }
        case "send_buttons": {
          if (action.buttonsText && action.buttons && action.buttons.length > 0) {
            const text = replaceVars(action.buttonsText);
            const btnResult = await sendWhatsAppButtons(contact.phone_number, text, action.buttons, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Warming Action] Botões enviados, messageId:", btnResult.messageId);
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "interactive", { body: text, buttons: action.buttons });
            
            // Se tem sub-fluxos, salvar para rastreamento
            if (btnResult.messageId && action.buttonFlows && Object.keys(action.buttonFlows).length > 0) {
              await supabase.from("warming_interactive_messages").insert({
                warming_message_execution_id: warmingExec.id,
                contact_id: contact.id,
                whatsapp_account_id: wabaId,
                message_id: btnResult.messageId,
                button_flows: action.buttonFlows
              });
              console.log("[Warming Action] Sub-fluxos salvos");
            }
          }
          break;
        }
        case "delay": {
          const seconds = action.delaySeconds || 1;
          console.log("[Warming Action] Aguardando", seconds, "segundos...");
          await new Promise(resolve => setTimeout(resolve, seconds * 1000));
          break;
        }
        case "add_tag": {
          if (action.tag) {
            const currentTags = contact.tags || [];
            if (!currentTags.includes(action.tag)) {
              await supabase.from("contacts").update({ tags: [...currentTags, action.tag] }).eq("id", contact.id);
              contact.tags = [...currentTags, action.tag];
              console.log("[Warming Action] Tag adicionada:", action.tag);
            }
          }
          break;
        }
        case "webhook": {
          if (action.webhookUrl) {
            try {
              await fetch(action.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "warming_button_click",
                  warming_pool_id: poolMember.warming_pool_id,
                  button_text: buttonText,
                  contact: { id: contact.id, name: contact.name, phone: contact.phone_number },
                  timestamp: new Date().toISOString()
                })
              });
              console.log("[Warming Action] Webhook chamado");
            } catch (err) {
              console.error("[Warming Action] Erro webhook:", err.message);
            }
          }
          break;
        }
      }
      
      // Delay entre ações
      if (action.type !== "delay" && i < actions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log("[Warming Action] Todas as ações concluídas");
    return true;
  } catch (error) {
    console.error("[Warming Action] Erro:", error.message);
    return false;
  }
}

// Função para executar sub-fluxos de mensagens interativas do warming
async function executeWarmingInteractiveSubFlow(contextMessageId, buttonText, contact, wabaPhoneNumberId) {
  try {
    console.log("[Warming SubFlow] Verificando sub-fluxo para:", contextMessageId, "botão:", buttonText);
    
    const { data: interactiveMsg } = await supabase
      .from("warming_interactive_messages")
      .select("*, whatsapp_account_id")
      .eq("message_id", contextMessageId)
      .maybeSingle();

    if (!interactiveMsg || !interactiveMsg.button_flows) {
      console.log("[Warming SubFlow] Nenhum sub-fluxo encontrado");
      return false;
    }

    const buttonFlows = interactiveMsg.button_flows;
    const subActions = buttonFlows[buttonText];

    if (!subActions || !Array.isArray(subActions) || subActions.length === 0) {
      console.log("[Warming SubFlow] Nenhuma ação para botão:", buttonText);
      return false;
    }

    console.log("[Warming SubFlow] Executando", subActions.length, "sub-ações");

    // Buscar credenciais
    let customCreds = null;
    let proxyConfig = null;
    if (interactiveMsg.whatsapp_account_id) {
      const wabaInfo = await getWabaInfo(interactiveMsg.whatsapp_account_id);
      if (wabaInfo) {
        customCreds = {
          phoneNumberId: wabaInfo.phone_number_id,
          accessToken: wabaInfo.access_token
        };
        if (wabaInfo.proxy_enabled) {
          proxyConfig = {
            proxy_enabled: wabaInfo.proxy_enabled,
            proxy_type: wabaInfo.proxy_type,
            proxy_url: wabaInfo.proxy_url,
            proxy_username: wabaInfo.proxy_username,
            proxy_password: wabaInfo.proxy_password_encrypted
          };
        }
      }
    }

    function replaceVars(text) {
      if (!text) return "";
      let result = text;
      result = result.replace(/{{nome}}/gi, contact.name || "");
      result = result.replace(/{{telefone}}/gi, contact.phone_number || "");
      if (contact.custom_fields) {
        Object.entries(contact.custom_fields).forEach(([key, value]) => {
          result = result.replace(new RegExp("{{" + key + "}}", "gi"), value || "");
        });
      }
      return result;
    }

    // Marcar como clicado
    await supabase.from("warming_interactive_messages")
      .update({ clicked_at: new Date().toISOString(), button_clicked: buttonText })
      .eq("id", interactiveMsg.id);

    for (let i = 0; i < subActions.length; i++) {
      const action = subActions[i];
      console.log("[Warming SubFlow] Sub-etapa", i + 1, "/", subActions.length, "- Tipo:", action.type);

      switch (action.type) {
        case "send_text": {
          const message = replaceVars(action.message);
          if (message.trim()) {
            await sendWhatsAppMessage(contact.phone_number, message.trim(), customCreds);
            console.log("[Warming SubFlow] Texto enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "text", { text: message.trim() });
          }
          break;
        }
        case "send_image": {
          if (action.imageUrl) {
            const caption = replaceVars(action.imageCaption || "");
            await sendWhatsAppImage(contact.phone_number, action.imageUrl, caption, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Warming SubFlow] Imagem enviada");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "image", { url: action.imageUrl, caption: caption });
          }
          break;
        }
        case "send_cta_url": {
          const trackedCtaUrl = await createTrackedLink(action.ctaUrl, contact.id, null, "warming_cta", action.ctaButtonText);
          if (action.ctaText && action.ctaUrl && action.ctaButtonText) {
            const ctaOptions = {
              header: action.ctaHeader ? replaceVars(action.ctaHeader) : null,
              body: replaceVars(action.ctaText),
              footer: action.ctaFooter ? replaceVars(action.ctaFooter) : null,
              buttonText: action.ctaButtonText,
              url: trackedCtaUrl
            };
            await sendWhatsAppCTA(contact.phone_number, ctaOptions, customCreds, process.env.WHATSAPP_PHONE_NUMBER_ID, process.env.WHATSAPP_ACCESS_TOKEN, proxyConfig);
            console.log("[Warming SubFlow] CTA enviado");
            await saveFlowMessage(contact.id, customCreds?.phoneNumberId, "cta_url", { header: ctaOptions.header, body: ctaOptions.body, footer: ctaOptions.footer, buttonText: ctaOptions.buttonText, url: ctaOptions.url });
          }
          break;
        }
        case "delay": {
          const seconds = action.delaySeconds || 1;
          console.log("[Warming SubFlow] Aguardando", seconds, "segundos...");
          await new Promise(resolve => setTimeout(resolve, seconds * 1000));
          break;
        }
        case "add_tag": {
          if (action.tag) {
            const currentTags = contact.tags || [];
            if (!currentTags.includes(action.tag)) {
              await supabase.from("contacts").update({ tags: [...currentTags, action.tag] }).eq("id", contact.id);
              contact.tags = [...currentTags, action.tag];
              console.log("[Warming SubFlow] Tag adicionada:", action.tag);
            }
          }
          break;
        }
        case "webhook": {
          if (action.webhookUrl) {
            try {
              await fetch(action.webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "warming_subflow_click",
                  button_text: buttonText,
                  contact: { id: contact.id, name: contact.name, phone: contact.phone_number },
                  timestamp: new Date().toISOString()
                })
              });
              console.log("[Warming SubFlow] Webhook chamado");
            } catch (err) {
              console.error("[Warming SubFlow] Erro webhook:", err.message);
            }
          }
          break;
        }
      }
      
      if (action.type !== "delay" && i < subActions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log("[Warming SubFlow] Todas as sub-ações concluídas");
    return true;
  } catch (error) {
    console.error("[Warming SubFlow] Erro:", error.message);
    return false;
  }
}
async function continueFlowExecution(contactId, buttonId, wabaPhoneNumberId = null) {
    try {
      console.log('[Flow] Verificando execuções pausadas para contato:', contactId, 'botão:', buttonId);

      // Buscar execuções esperando por este botão
      const { data: executions } = await supabase
        .from('flow_executions')
        .select('*')
        .eq('contact_id', contactId)
        .eq('status', 'waiting')
        ;
      
      // Filtrar manualmente pois trigger_data é JSONB
      const waitingExecutions = (executions || []).filter(e => 
        e.trigger_data?.waiting_for?.startsWith('button:')
      );

      if (!waitingExecutions || waitingExecutions.length === 0) {
        console.log('[Flow] Nenhuma execução aguardando');
        return false;
      }

      // Processar cada execução que está esperando
      for (const execution of waitingExecutions) {
        const expectedButton = execution.trigger_data?.waiting_for?.replace('button:', '');
        
        // Verificar se é o botão esperado ou qualquer botão (genérico)
        // btn_0 = primeiro botão, btn_1 = segundo, etc
        // Aceitar qualquer clique de botão para continuar o fluxo
        if (true) { // Qualquer botão continua o fluxo pausado
          console.log('[Flow] Continuando execução:', execution.id, 'de nó:', execution.trigger_data?.waiting_for_node_id);

          // Buscar dados necessários
          const { data: contact } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .single();

          if (!contact) continue;

          const { data: nodes } = await supabase
            .from('flow_nodes')
            .select('*')
            .eq('flow_id', execution.flow_id);

          const { data: edges } = await supabase
            .from('flow_edges')
            .select('*')
            .eq('flow_id', execution.flow_id);

          // Marcar como running novamente
          const resumeData = { ...(execution.trigger_data || {}), waiting_for: null, waiting_for_node_id: null };
          await supabase
            .from('flow_executions')
            .update({ status: 'running', trigger_data: resumeData })
            .eq('id', execution.id);

          // Continuar execução do próximo nó
          if (execution.trigger_data?.waiting_for_node_id) {
            // Usar wabaPhoneNumberId salvo ou o que veio do webhook
            const savedWabaPhoneId = execution.trigger_data?.wabaPhoneNumberId || wabaPhoneNumberId;
            await executeFlowNode(
              execution.id, 
              execution.trigger_data?.waiting_for_node_id, 
              execution.flow_id, 
              contact, 
              nodes || [], 
              edges || [],
              savedWabaPhoneId
            );
          }

          return true;
        }
      }

      return false;

    } catch (error) {
      console.error('[Flow] Erro ao continuar execução:', error.message);
      return false;
    }
  }

  // Verifica e executa fluxos baseado em trigger
  async function checkAndExecuteFlows(triggerType, contact, triggerData = {}) {
    try {
      console.log('[Flow] Verificando fluxos para trigger:', triggerType);

      // Buscar fluxos ativos com esse trigger
      const { data: flows } = await supabase
        .from('flows')
        .select('*')
        .eq('status', 'active')
        .eq('trigger_type', triggerType);

      if (!flows || flows.length === 0) {
        console.log('[Flow] Nenhum fluxo ativo para trigger:', triggerType);
        return false;
      }

      let anyExecuted = false;

      for (const flow of flows) {
        // Verificar se o fluxo é para a WABA correta (se aplicável)
        if (flow.whatsapp_account_id && triggerData.wabaId && flow.whatsapp_account_id !== triggerData.wabaId) {
          continue;
        }

        const execution = await startFlowExecution(flow.id, contact.id, triggerData);
        if (execution) anyExecuted = true;
      }

      return anyExecuted;

    } catch (error) {
      console.error('[Flow] Erro ao verificar fluxos:', error.message);
      return false;
    }
  }

  // Alias para compatibilidade
  async function executeFlow(flowId, contactId, triggerData = {}) {
    return await startFlowExecution(flowId, contactId, triggerData);
  }





  async function processIncomingMessage(message, contact, metadata) {
    try {
      const phoneNumber = message.from;
      const contactName = contact?.profile?.name || 'Desconhecido';
      const messageContent = message.text?.body || message.type;

      console.log(`Nova mensagem de ${contactName} (${phoneNumber}): ${messageContent}`);

      // Log mensagem recebida
      logToDatabase({
        level: 'info',
        category: 'webhook',
        source: 'processIncomingMessage',
        message: 'Mensagem de ' + contactName + ' (' + phoneNumber + '): ' + message.type,
        requestData: { phoneNumber, contactName, messageType: message.type, messageId: message.id }
      });

      // 1. Buscar ou criar contato (com normalização de telefone BR)
      let existingContact = await findContactByPhone(phoneNumber);

      const isNewContact = !existingContact;

      if (!existingContact) {
        const { data: newContact, error } = await supabase
          .from('contacts')
          .insert({
            organization_id: DEFAULT_ORG_ID,
            phone_number: phoneNumber,
            wa_id: phoneNumber,
            name: contactName,
            first_interaction_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString(),
            total_messages_received: 1
          })
          .select()
          .single();

        if (error) console.error('Erro ao criar contato:', error);
        else {
          existingContact = newContact;
          console.log('Contato criado:', existingContact.id);
        }
      } else {
        await supabase
          .from('contacts')
          .update({
            name: contactName,
            last_interaction_at: new Date().toISOString(),
            total_messages_received: (existingContact.total_messages_received || 0) + 1
          })
          .eq('id', existingContact.id);
        console.log('Contato atualizado:', existingContact.id);
      }

      if (!existingContact) return;

      // 2.1 Buscar phone_number_id do banco usando metadata do webhook
      let dbPhoneNumberId = null;
      if (metadata?.phone_number_id) {
        const { data: phoneRecord } = await supabase
          .from("phone_numbers")
          .select("id")
          .eq("phone_number_id", metadata.phone_number_id)
          .single();
        if (phoneRecord) {
          dbPhoneNumberId = phoneRecord.id;
          console.log("Phone number encontrado:", dbPhoneNumberId);
        }
      }

      // 2. Buscar ou criar conversa (priorizar phone_number_id, depois qualquer aberta)
      let existingConversation = null;
      
      // Primeiro tentar encontrar conversa com phone_number_id específico
      if (dbPhoneNumberId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('contact_id', existingContact.id)
          .eq('phone_number_id', dbPhoneNumberId)
          .eq('status', 'open')
          .single();
        existingConversation = conv;
      }
      
      // Se não encontrou, buscar qualquer conversa aberta do contato
      if (!existingConversation) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('*')
          .eq('contact_id', existingContact.id)
          .is('phone_number_id', null)
          .eq('status', 'open')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single();
        existingConversation = conv;
      }

      if (!existingConversation) {
        const { data: newConversation, error } = await supabase
          .from('conversations')
          .insert({
            organization_id: DEFAULT_ORG_ID,
            contact_id: existingContact.id,
            status: 'open',
            last_message_at: new Date().toISOString(),
            last_message_direction: 'inbound',
            window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            unread_count: 1,
            phone_number_id: dbPhoneNumberId
          })
          .select()
          .single();

        if (error) console.error('Erro ao criar conversa:', error);
        else {
          existingConversation = newConversation;
          console.log('Conversa criada:', existingConversation.id);
        }
      } else {
        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_direction: 'inbound',
            window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            unread_count: (existingConversation.unread_count || 0) + 1,
            phone_number_id: existingConversation.phone_number_id || dbPhoneNumberId
          })
          .eq('id', existingConversation.id);
        console.log('Conversa atualizada:', existingConversation.id);
      }

      if (!existingConversation) return;

      // 3. Salvar mensagem recebida
      const { data: savedMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: existingConversation.id,
          contact_id: existingContact.id,
          whatsapp_message_id: message.id,
          direction: 'inbound',
          type: message.type,
          content: { body: messageContent, raw: message },
          status: 'received',
          created_at: new Date(parseInt(message.timestamp) * 1000).toISOString()
        })
        .select()
        .single();

      if (msgError) console.error('Erro ao salvar mensagem:', msgError);
      else console.log('Mensagem salva:', savedMessage.id);

      // 4. Verificar e executar fluxos
      const messageType = message.type;
      let flowExecuted = false;

      // Se é clique em botão (interactive)
      if (messageType === 'interactive' || messageType === 'button') {
        const buttonId = message.interactive?.button_reply?.id || message.button?.payload || 'btn_0';
        const buttonText = message.interactive?.button_reply?.title || message.button?.text;
        const contextMessageId = message.context?.id;
        const clickMessageId = message.id; // ID único do clique
        console.log('[Flow] Clique em botão detectado:', buttonId, buttonText, 'context:', contextMessageId);
        
        // Verificar se este clique já foi processado (evita webhooks duplicados)
        if (isClickAlreadyProcessed(clickMessageId)) {
          console.log('[Flow] Clique duplicado ignorado');
        } else {

        // PRIMEIRO: Verificar se é clique em botão de campanha com ação configurada
        if (contextMessageId) {
          flowExecuted = await executeCampaignButtonAction(contextMessageId, buttonText, existingContact, metadata?.phone_number_id);
          if (flowExecuted) {
            console.log('[Campaign Action] Ação de campanha executada');
          }
          
          // SEGUNDO: Verificar sub-fluxos de mensagens interativas (send_buttons)
          if (!flowExecuted) {
            flowExecuted = await executeInteractiveSubFlow(contextMessageId, buttonText, existingContact, metadata?.phone_number_id);
            if (flowExecuted) {
              console.log('[Interactive SubFlow] Sub-fluxo executado');
            }
          }
          
          // WARMING: Verificar ações de warming
          if (!flowExecuted) {
            flowExecuted = await executeWarmingButtonAction(contextMessageId, buttonText, existingContact, metadata?.phone_number_id);
            if (flowExecuted) {
              console.log("[Warming Action] Ação de warming executada");
            }
          }
          
          // WARMING: Verificar sub-fluxos de warming
          if (!flowExecuted) {
            flowExecuted = await executeWarmingInteractiveSubFlow(contextMessageId, buttonText, existingContact, metadata?.phone_number_id);
            if (flowExecuted) {
              console.log("[Warming SubFlow] Sub-fluxo de warming executado");
            }
          }
        }

        // TERCEIRO: Verificar se há execução de fluxo aguardando este botão
        if (!flowExecuted) {
          flowExecuted = await continueFlowExecution(existingContact.id, buttonId, metadata?.phone_number_id);
        }

        // QUARTO: Verificar novos fluxos com trigger button_click
        if (!flowExecuted) {
          flowExecuted = await checkAndExecuteFlows('button_click', existingContact, {
            buttonId,
            buttonText,
            messageId: message.id,
            wabaPhoneNumberId: metadata?.phone_number_id
          });
        }
        } // Fim do else (deduplicação)
      }

      // Se é nova mensagem e não executou fluxo de botão
      if (!flowExecuted && isNewContact) {
        flowExecuted = await checkAndExecuteFlows('new_contact', existingContact, {
          messageId: message.id,
          wabaPhoneNumberId: metadata?.phone_number_id
        });
      }

      // Verificar trigger por keyword
      if (!flowExecuted) {
        flowExecuted = await checkAndExecuteFlows('keyword', existingContact, {
          keyword: messageContent,
          messageId: message.id,
          wabaPhoneNumberId: metadata?.phone_number_id
        });
      }

      // 5. Resposta automática fallback (apenas se nenhum fluxo executou)
      if (AUTO_REPLY_ENABLED && isNewContact && !flowExecuted) {
        console.log('Enviando resposta automática para novo contato...');
        const replyResult = await sendWhatsAppMessage(phoneNumber, AUTO_REPLY_MESSAGE);

        if (replyResult) {
          // Salvar a resposta automática no banco
          await supabase.from('messages').insert({
            conversation_id: existingConversation.id,
            contact_id: existingContact.id,
            whatsapp_message_id: replyResult.messages?.[0]?.id,
            direction: 'outbound',
            type: 'text',
            content: { body: AUTO_REPLY_MESSAGE },
            status: 'sent',
            sent_at: new Date().toISOString()
          });
          console.log('Resposta automática salva no banco');
        }
      }

      // 6. Processar comandos
      const upperMessage = messageContent.toUpperCase().trim();
      if (upperMessage === 'AJUDA') {
        await sendWhatsAppMessage(phoneNumber, `📋 *Menu de Ajuda*\n\n1️⃣ HORARIO - Ver horário de atendimento\n2️⃣ CONTATO - Falar com atendente\n3️⃣ SITE - Nosso site`);
      } else if (upperMessage === 'HORARIO') {
        await sendWhatsAppMessage(phoneNumber, `⏰ *Horário de Atendimento*\n\nSegunda a Sexta: 9h às 18h\nSábado: 9h às 13h\nDomingo: Fechado`);
      }

      await supabase.from('webhook_logs').insert({
        source: 'meta',
        event_type: 'message',
        payload: message,
        processed: true
      });

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  }

  async function processMessageStatus(status) {
    try {
      console.log(`Status: ${status.status} para ${status.recipient_id}`);
      const updateData = {};
      if (status.status === 'sent') { updateData.status = 'sent'; updateData.sent_at = new Date().toISOString(); }
      else if (status.status === 'delivered') { updateData.status = 'delivered'; updateData.delivered_at = new Date().toISOString(); }
      else if (status.status === 'read') { updateData.status = 'read'; updateData.read_at = new Date().toISOString(); }
      else if (status.status === 'failed') { updateData.status = 'failed'; updateData.error_message = status.errors?.[0]?.message || 'Erro'; }

      if (Object.keys(updateData).length > 0) {
        await supabase.from('messages').update(updateData).eq('whatsapp_message_id', status.id);
        
        // Atualizar campaign_messages se existir
        const { data: campMsg } = await supabase.from("campaign_messages").select("campaign_id").eq("message_id", status.id).maybeSingle();
        if (campMsg && (status.status === "delivered" || status.status === "read")) {
          await supabase.from("campaign_messages").update(updateData).eq("message_id", status.id);
          const { data: camp } = await supabase.from("campaigns").select("stats").eq("id", campMsg.campaign_id).single();
          if (camp) {
            const fld = status.status;
            const ns = { ...camp.stats, [fld]: (camp.stats?.[fld] || 0) + 1 };
            await supabase.from("campaigns").update({ stats: ns }).eq("id", campMsg.campaign_id);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao processar status:', error);
    }
  }

  app.get('/api/templates', async (req, res) => {
    try {
      const response = await axios.get(`${WA_API_URL}/${WA_WABA_ID}/message_templates`, {
        headers: { 'Authorization': `Bearer ${WA_TOKEN}` }
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });

  app.get('/api/contacts', async (req, res) => {
    try {
      const { data, error } = await supabase.from('contacts').select('*').order('last_interaction_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/conversations', async (req, res) => {
    try {
      const { data, error } = await supabase.from('conversations').select('*, contact:contacts(*)').order('last_message_at', { ascending: false });
      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', req.params.id).order('created_at', { ascending: true });
      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // ============ SETUP AUTOMÁTICO DE WABA ============
  app.post('/api/waba/setup', async (req, res) => {
    try {
      const { waba_id, access_token, name, organization_id } = req.body;

      if (!waba_id || !access_token || !organization_id) {
        return res.status(400).json({ error: 'waba_id, access_token e organization_id são obrigatórios' });
      }

      console.log('[WABA Setup] Iniciando setup para WABA:', waba_id);

      // 1. Verificar se o token é válido
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v21.0/${waba_id}?fields=id,account_review_status`,
        { headers: { Authorization: `Bearer ${access_token}` }}
      );
      const wabaData = await wabaResponse.json();

      if (wabaData.error) {
        return res.status(400).json({ error: 'Token inválido: ' + wabaData.error.message });
      }

      // 2. Verificar se conta já existe
      const { data: existingAccount } = await supabase
        .from('whatsapp_accounts')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('waba_id', waba_id)
        .maybeSingle();

      let account;
      if (existingAccount) {
        const { data: updated, error: updateErr } = await supabase
          .from('whatsapp_accounts')
          .update({
            name: name || 'WABA ' + waba_id,
            access_token_encrypted: access_token,
            status: 'active'
          })
          .eq('id', existingAccount.id)
          .select()
          .single();

        if (updateErr) {
          return res.status(500).json({ error: 'Erro ao atualizar conta: ' + updateErr.message });
        }
        account = updated;
      } else {
        const crypto = require('crypto');
        const webhookVerifyToken = crypto.randomBytes(16).toString('hex');

        const { data: created, error: createErr } = await supabase
          .from('whatsapp_accounts')
          .insert({
            organization_id,
            waba_id,
            name: name || 'WABA ' + waba_id,
            access_token_encrypted: access_token,
            webhook_verify_token: webhookVerifyToken,
            status: 'active',
            health_status: 'unknown'
          })
          .select()
          .single();

        if (createErr) {
          return res.status(500).json({ error: 'Erro ao criar conta: ' + createErr.message });
        }
        account = created;
      }

      console.log('[WABA Setup] Conta salva:', account.id);

      // 2.5 Inscrever WABA no webhook automaticamente
      console.log('[WABA Setup] Inscrevendo no webhook...');
      try {
        const webhookResponse = await fetch(
          `https://graph.facebook.com/v21.0/${waba_id}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subscribed_fields: ['messages'] })
          }
        );
        const webhookResult = await webhookResponse.json();
        
        if (webhookResult.success) {
          console.log('[WABA Setup] Webhook inscrito com sucesso!');
        } else if (webhookResult.error) {
          console.log('[WABA Setup] Aviso ao inscrever webhook:', webhookResult.error.message);
          // Não falha o setup, apenas loga o aviso
        }
      } catch (webhookErr) {
        console.log('[WABA Setup] Erro ao inscrever webhook (continuando):', webhookErr.message);
      }

      // 3. Buscar phone numbers
      const phonesResponse = await fetch(
        `https://graph.facebook.com/v21.0/${waba_id}/phone_numbers?fields=id,verified_name,display_phone_number,quality_rating,status`,
        { headers: { Authorization: `Bearer ${access_token}` }}
      );
      const phonesData = await phonesResponse.json();

      let phoneCount = 0;
      for (const phone of phonesData.data || []) {
        // Registrar número se não está conectado
        if (phone.status !== 'CONNECTED') {
          console.log('[WABA Setup] Registrando número:', phone.id);
          await fetch(`https://graph.facebook.com/v21.0/${phone.id}/register`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', pin: '123456' })
          });
        }

        // Verificar se phone já existe
        const { data: existingPhone } = await supabase
          .from('phone_numbers')
          .select('id')
          .eq('phone_number_id', phone.id)
          .maybeSingle();

        if (existingPhone) {
          await supabase.from('phone_numbers').update({
            display_name: phone.verified_name,
            status: 'active'
          }).eq('id', existingPhone.id);
        } else {
          await supabase.from('phone_numbers').insert({
            whatsapp_account_id: account.id,
            phone_number_id: phone.id,
            phone_number: phone.display_phone_number?.replace(/\D/g, ''),
            display_name: phone.verified_name,
            quality_rating: phone.quality_rating,
            status: 'active',
            is_default: phoneCount === 0
          });
        }
        phoneCount++;
      }

      // 4. Sincronizar templates
      const templatesResponse = await fetch(
        `https://graph.facebook.com/v21.0/${waba_id}/message_templates?limit=100`,
        { headers: { Authorization: `Bearer ${access_token}` }}
      );
      const templatesData = await templatesResponse.json();

      let templateCount = 0;
      for (const template of templatesData.data || []) {
        const { data: existing } = await supabase
          .from('message_templates')
          .select('id')
          .eq('whatsapp_account_id', account.id)
          .eq('template_id', template.id)
          .maybeSingle();

        if (existing) {
          await supabase.from('message_templates').update({
            name: template.name,
            language: template.language,
            category: template.category,
            status: template.status,
            components: template.components || [],
            synced_at: new Date().toISOString()
          }).eq('id', existing.id);
        } else {
          await supabase.from('message_templates').insert({
            whatsapp_account_id: account.id,
            template_id: template.id,
            name: template.name,
            language: template.language,
            category: template.category,
            status: template.status,
            components: template.components || [],
            synced_at: new Date().toISOString()
          });
        }
        templateCount++;
      }

      console.log('[WABA Setup] Concluído:', phoneCount, 'números,', templateCount, 'templates');

      res.json({
        success: true,
        account: { id: account.id, name: account.name, waba_id: account.waba_id },
        phone_numbers: phoneCount,
        templates: templateCount
      });

    } catch (error) {
      console.error('[WABA Setup] Erro:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // ============ SINCRONIZAR STATUS DA WABA ============
  app.post('/api/waba/:wabaId/sync-status', async (req, res) => {
    try {
      const { wabaId } = req.params;

      // 1. Buscar WABA e token
      const { data: waba, error: wabaError } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('id', wabaId)
        .single();

      if (wabaError || !waba) {
        return res.status(404).json({ error: 'WABA nao encontrada' });
      }

      const accessToken = waba.access_token_encrypted;
      if (!accessToken) {
        return res.status(400).json({ error: 'Access token nao configurado' });
      }

      console.log('[Sync WABA Status] Sincronizando status para:', waba.name);

      // 2. Buscar status da WABA na API da Meta
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v21.0/${waba.waba_id}?fields=account_review_status,message_template_namespace`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const wabaData = await wabaResponse.json();
      console.log('[Sync WABA Status] Meta response:', JSON.stringify(wabaData));

      // 3. Buscar phone numbers e seus status
      const phonesResponse = await fetch(
        `https://graph.facebook.com/v21.0/${waba.waba_id}/phone_numbers?fields=id,verified_name,display_phone_number,quality_rating,messaging_limit_tier,status,name_status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const phonesData = await phonesResponse.json();
      console.log('[Sync WABA Status] Phones response:', JSON.stringify(phonesData));

      // 4. Determinar status geral da conta
      let newStatus = 'active';
      let healthStatus = 'healthy';
      let isRestricted = false;
      let restrictionReason = null;

      // Verificar erros da API
      if (wabaData.error) {
        newStatus = 'suspended';
        healthStatus = 'critical';
        isRestricted = true;
        restrictionReason = wabaData.error.message || 'Erro ao acessar API da Meta';
      }

      // Verificar review status
      if (wabaData.account_review_status) {
        if (wabaData.account_review_status === 'REJECTED') {
          newStatus = 'suspended';
          healthStatus = 'critical';
          isRestricted = true;
          restrictionReason = 'Conta rejeitada pela Meta';
        } else if (wabaData.account_review_status === 'PENDING') {
          newStatus = 'pending';
          healthStatus = 'unknown';
        }
      }

      // Verificar qualidade dos phone numbers
      let phoneNumbersSynced = 0;
      let hasRestrictedPhone = false;
      let hasDegradedPhone = false;

      if (phonesData.data && Array.isArray(phonesData.data)) {
        for (const phone of phonesData.data) {
          // Atualizar phone number no banco
          const { data: existingPhone } = await supabase
            .from('phone_numbers')
            .select('id')
            .eq('phone_number_id', phone.id)
            .single();

          if (existingPhone) {
            await supabase
              .from('phone_numbers')
              .update({
                quality_rating: phone.quality_rating || 'UNKNOWN',
                status: phone.status === 'CONNECTED' ? 'active' : (phone.status || 'active'),
                meta_data: {
                  messaging_limit_tier: phone.messaging_limit_tier,
                  name_status: phone.name_status,
                  synced_at: new Date().toISOString()
                }
              })
              .eq('id', existingPhone.id);

            phoneNumbersSynced++;
          }

          // Verificar status do phone
          if (phone.status === 'FLAGGED' || phone.status === 'RESTRICTED' || phone.status === 'RATE_LIMITED') {
            hasRestrictedPhone = true;
            restrictionReason = `Numero ${phone.display_phone_number} esta ${phone.status}`;
          }

          // Verificar qualidade
          if (phone.quality_rating === 'RED') {
            hasDegradedPhone = true;
            if (!restrictionReason) {
              restrictionReason = `Numero ${phone.display_phone_number} com qualidade RED`;
            }
          } else if (phone.quality_rating === 'YELLOW') {
            hasDegradedPhone = true;
          }
        }
      }

      // Atualizar status baseado nos phones
      if (hasRestrictedPhone && !isRestricted) {
        newStatus = 'suspended';
        healthStatus = 'critical';
        isRestricted = true;
      } else if (hasDegradedPhone && newStatus === 'active') {
        newStatus = 'degraded';
        healthStatus = 'degraded';
      }

      // 5. Atualizar WABA no banco
      await supabase
        .from('whatsapp_accounts')
        .update({
          status: newStatus,
          health_status: healthStatus,
          last_health_check_at: new Date().toISOString(),
          last_error_message: isRestricted ? restrictionReason : null
        })
        .eq('id', wabaId);

      console.log(`[Sync WABA Status] WABA ${waba.name}: status=${newStatus}, health=${healthStatus}, restricted=${isRestricted}`);

      res.json({
        status: newStatus,
        health_status: healthStatus,
        is_restricted: isRestricted,
        restriction_reason: restrictionReason,
        phone_numbers_synced: phoneNumbersSynced
      });

    } catch (error) {
      console.error('[Sync WABA Status] Error:', error);
      res.status(500).json({ error: error.message || 'Erro ao sincronizar status' });
    }
  });


  // ============ SINCRONIZAR TEMPLATES ============
  app.post('/api/templates/sync', async (req, res) => {
    try {
      const { waba_id } = req.body;

      if (!waba_id) {
        return res.status(400).json({ error: 'waba_id é obrigatório' });
      }

      console.log('[Templates Sync] Iniciando para WABA ID:', waba_id);

      // Buscar conta WABA
      const { data: account, error: accErr } = await supabase
        .from('whatsapp_accounts')
        .select('id, waba_id, access_token_encrypted')
        .eq('id', waba_id)
        .single();

      if (accErr || !account) {
        return res.status(404).json({ error: 'Conta não encontrada' });
      }

      if (!account.access_token_encrypted) {
        return res.status(400).json({ error: 'Access token não configurado' });
      }

      // Buscar templates da Meta
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${account.waba_id}/message_templates?limit=100`,
        { headers: { Authorization: `Bearer ${account.access_token_encrypted}` }}
      );
      const data = await response.json();

      if (data.error) {
        return res.status(400).json({ error: 'Erro Meta API: ' + data.error.message });
      }

      let synced = 0;
      for (const template of data.data || []) {
        // Verificar se já existe
        const { data: existing } = await supabase
          .from('message_templates')
          .select('id')
          .eq('whatsapp_account_id', account.id)
          .eq('template_id', template.id)
          .maybeSingle();

        if (existing) {
          await supabase.from('message_templates').update({
            name: template.name,
            language: template.language,
            category: template.category,
            status: template.status,
            components: template.components || [],
            synced_at: new Date().toISOString()
          }).eq('id', existing.id);
        } else {
          const { error } = await supabase.from('message_templates').insert({
            whatsapp_account_id: account.id,
            template_id: template.id,
            name: template.name,
            language: template.language,
            category: template.category,
            status: template.status,
            components: template.components || [],
            synced_at: new Date().toISOString()
          });
          if (!error) synced++;
        }
      }

      console.log('[Templates Sync] Concluído:', synced, 'novos templates');
      res.json({ success: true, synced, total: data.data?.length || 0 });

    } catch (error) {
      console.error('[Templates Sync] Erro:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // ============ MÉTRICAS DE CAMPANHA ============
  app.get('/api/campaigns/:id/metrics', async (req, res) => {
    try {
      const { id } = req.params;

      // Buscar campanha
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('id, status, started_at, completed_at, stats, audience_count')
        .eq('id', id)
        .single();

      if (error || !campaign) {
        return res.status(404).json({ error: 'Campanha não encontrada' });
      }

      // Pegar métricas do tracker em memória
      const metrics = campaignMetrics.get(id);

      let history = [];
      let summary = { avgSpeed: 0, maxSpeed: 0, duration: 0 };
      let realtime = { msgsPerSecond: 0 };

      if (metrics) {
        // Converter history para o formato esperado
        history = metrics.history.map((h, index) => ({
          recorded_at: new Date(h.timestamp).toISOString(),
          messages_per_second: h.count,
          total_sent: metrics.history.slice(0, index + 1).reduce((sum, x) => sum + x.count, 0),
          total_delivered: 0,
          total_failed: 0
        }));

        // Calcular summary
        if (metrics.history.length > 0) {
          const speeds = metrics.history.map(h => h.count);
          summary.avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
          summary.maxSpeed = Math.max(...speeds);
        }
        summary.duration = Math.floor((Date.now() - metrics.startTime) / 1000);

        // Velocidade atual (último segundo)
        realtime.msgsPerSecond = metrics.lastSecondCount;
      } else if (campaign.stats) {
        // Campanha finalizada - usar métricas salvas
        const stats = campaign.stats;
        if (stats.metrics) {
          summary = stats.metrics;
        } else if (campaign.started_at && stats.sent > 0) {
          const startTime = new Date(campaign.started_at).getTime();
          const endTime = campaign.completed_at ? new Date(campaign.completed_at).getTime() : Date.now();
          const duration = Math.floor((endTime - startTime) / 1000);
          if (duration > 0) {
            summary.avgSpeed = parseFloat((stats.sent / duration).toFixed(2));
            summary.maxSpeed = summary.avgSpeed * 1.2;
            summary.duration = duration;
          }
        }
      }

      res.json({
        history,
        summary,
        realtime: campaign.status === 'running' ? realtime : null
      });

    } catch (error) {
      console.error('[Campaign Metrics] Erro:', error);
      res.status(500).json({ error: error.message });
    }
  });




  // ============ WARMING POOL API ENDPOINTS ============

  // GET /api/warming/pools - Lista pools da organização
  app.get('/api/warming/pools', async (req, res) => {
    try {
      const { data: pools, error } = await supabase
        .from('warming_pools')
        .select('*')
        .eq('organization_id', DEFAULT_ORG_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(pools);
    } catch (error) {
      console.error('[Warming API] Erro ao listar pools:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/warming/pools/:id/stats - Estatísticas do pool
  app.get('/api/warming/pools/:id/stats', async (req, res) => {
    try {
      const { id } = req.params;

      const { data: stats, error } = await supabase.rpc('get_warming_pool_stats', {
        pool_id: id
      });

      if (error) throw error;
      res.json(stats);
    } catch (error) {
      console.error('[Warming API] Erro ao buscar stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/warming/select-waba - Seleciona WABA manualmente
  app.post('/api/warming/select-waba', async (req, res) => {
    try {
      const { pool_id } = req.body;

      if (!pool_id) {
        return res.status(400).json({ error: 'pool_id é obrigatório' });
      }

      const wabaId = await selectWarmingWaba(pool_id);

      if (!wabaId) {
        return res.status(404).json({
          error: 'Nenhuma WABA disponível no pool',
          reason: 'Todas as WABAs podem estar pausadas, fora da janela de tempo, ou atingiram o limite'
        });
      }

      const { data: waba } = await supabase
        .from('whatsapp_accounts')
        .select('id, name, waba_id')
        .eq('id', wabaId)
        .single();

      res.json({
        success: true,
        waba_id: wabaId,
        waba_name: waba?.name,
        waba_meta_id: waba?.waba_id
      });
    } catch (error) {
      console.error('[Warming API] Erro ao selecionar WABA:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/warming/reset-daily - Reset manual dos contadores diários
  app.post('/api/warming/reset-daily', async (req, res) => {
    try {
      await supabase.rpc('reset_warming_daily_counters');
      res.json({ success: true, message: 'Contadores resetados' });
    } catch (error) {
      console.error('[Warming API] Erro ao resetar contadores:', error);
      res.status(500).json({ error: error.message });
    }
  });



  // POST /api/warming/process-messages - Processa mensagens agendadas (cron)
  app.post("/api/warming/process-messages", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const result = await processWarmingMessages(limit);
      res.json(result);
    } catch (error) {
      console.error("[Warming Process] Erro:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/warming/pending-messages - Ver mensagens pendentes
  app.get("/api/warming/pending-messages", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("warming_message_executions")
        .select("id, status, scheduled_for, warming_contact_history_id, warming_member_message_id")
        .in("status", ["pending", "scheduled"])
        .order("scheduled_for", { ascending: true })
        .limit(100);
      if (error) throw error;
      res.json(data || []);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ WEBHOOK PARA ADICIONAR CONTATOS (COM WARMING) ============
  app.post('/api/webhook/contacts', async (req, res) => {
    try {
      // Aceita objeto ou array
      const inputContacts = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];

      // Verificar se há pool de aquecimento ativo
      const warmingPools = await getActiveWarmingPools(DEFAULT_ORG_ID);
      const activePool = warmingPools.length > 0 ? warmingPools[0] : null;

      console.log('[Webhook Contacts] Pool de aquecimento ativo:', activePool ? activePool.name : 'Nenhum');

      for (const contactData of inputContacts) {
        const { name, phone, custom_fields, tags, trigger_flow, use_warming, pool_id, pool_name } = contactData;

        if (!phone) {
          results.push({ error: 'Campo phone é obrigatório', phone: null });
          continue;
        }

        const phoneNumber = phone.replace(/\D/g, '');
        console.log('[Webhook Contacts] Recebido:', name, phoneNumber);

        // Determinar se usar warming pool
        // Determinar qual pool usar
        let targetPool = null;
        if (pool_id) {
          // Pool específico por UUID
          const { data: specificPool } = await supabase
            .from("warming_pools")
            .select("*")
            .eq("id", pool_id)
            .single();
          targetPool = specificPool;
          console.log("[Webhook] Pool por ID:", targetPool?.name || "não encontrado");
        } else if (pool_name) {
          // Pool específico por nome
          const { data: namedPool } = await supabase
            .from("warming_pools")
            .select("*")
            .ilike("name", pool_name)
            .single();
          targetPool = namedPool;
          console.log("[Webhook] Pool por nome:", targetPool?.name || "não encontrado");
        } else if (use_warming !== false && activePool) {
          // Usar pool ativo padrão
          targetPool = activePool;
        }
        const shouldUseWarming = use_warming === true || targetPool !== null;

        let selectedWabaId = null;
        let warmingHistoryId = null;

        // Se usar warming, selecionar WABA
        if (shouldUseWarming && targetPool) {
          selectedWabaId = await selectWarmingWaba(targetPool.id);

          if (!selectedWabaId) {
            console.log('[Webhook Contacts] Nenhuma WABA disponível no warming pool');
          } else {
            console.log('[Webhook Contacts] WABA selecionada pelo warming:', selectedWabaId);
          }
        }

        // Verificar se contato já existe
        let existingContact = await findContactByPhone(phoneNumber);

        let contact;
        let isNew = false;

        if (existingContact) {
          // Atualizar contato existente
          const updateData = {
            name: name || existingContact.name,
            custom_fields: { ...(existingContact.custom_fields || {}), ...(custom_fields || {}) },
            tags: [...new Set([...(existingContact.tags || []), ...(tags || [])])],
            last_interaction_at: new Date().toISOString()
          };

          // Se usar warming e contato não tem WABA, associar
          if (selectedWabaId && !existingContact.whatsapp_account_id) {
            updateData.whatsapp_account_id = selectedWabaId;
          }

          const { data: updated, error } = await supabase
            .from('contacts')
            .update(updateData)
            .eq('id', existingContact.id)
            .select()
            .single();

          if (error) throw error;
          contact = updated;
          console.log('[Webhook Contacts] Contato atualizado:', contact.id);

        } else {
          // Criar novo contato
          const insertData = {
            organization_id: DEFAULT_ORG_ID,
            phone_number: phoneNumber,
            wa_id: phoneNumber,
            name: name || 'Sem nome',
            custom_fields: custom_fields || {},
            tags: tags || [],
            opted_in: true,
            first_interaction_at: new Date().toISOString(),
            last_interaction_at: new Date().toISOString()
          };

          // Associar à WABA do warming se disponível
          if (selectedWabaId) {
            insertData.whatsapp_account_id = selectedWabaId;
          }

          const { data: newContact, error } = await supabase
            .from('contacts')
            .insert(insertData)
            .select()
            .single();

          if (error) throw error;
          contact = newContact;
          isNew = true;
          console.log('[Webhook Contacts] Contato criado:', contact.id, selectedWabaId ? `(WABA: ${selectedWabaId})` : '');
        }

        // Se usando warming pool com MEMBER MESSAGES
        if (selectedWabaId && targetPool && contact && !trigger_flow) {
          const poolMember = await getWarmingPoolMember(targetPool.id, selectedWabaId);

          if (poolMember) {
            const memberMessages = await getWarmingMemberMessages(poolMember.id);
            const enteredAt = new Date().toISOString();

            // Registrar no historico (upsert para evitar duplicatas)
            const { data: historyData } = await supabase
              .from("warming_contact_history")
              .upsert({
                warming_pool_id: targetPool.id,
                contact_id: contact.id,
                whatsapp_account_id: selectedWabaId,
                status: "in_progress",
                flows_total: memberMessages.length,
                entered_at: enteredAt
              }, { onConflict: "warming_pool_id,contact_id" })
              .select()
              .single();

            warmingHistoryId = historyData?.id;

            await logWarmingEvent(
              targetPool.id,
              "contact_added",
              { contact_name: contact.name, phone: phoneNumber, is_new: isNew, messages_count: memberMessages.length },
              selectedWabaId,
              contact.id
            );

            if (warmingHistoryId && memberMessages.length > 0) {
              // Agendar mensagens
              const scheduledExecs = await scheduleWarmingMessages(warmingHistoryId, poolMember.id, enteredAt);

              // Enviar mensagens imediatas
              const immediateExecs = scheduledExecs.filter(e => e.status === "pending");
              const wabaInfo = await getWabaInfo(selectedWabaId);

              for (const exec of immediateExecs) {
                const msgConfig = memberMessages.find(m => m.id === exec.warming_member_message_id);
                if (msgConfig && wabaInfo) {
                  await sendWarmingMessage(exec, msgConfig, phoneNumber, wabaInfo, { name: contact.name, phone: phoneNumber, custom_fields: contact.custom_fields || {} }, contact.id);
                }
              }

              console.log("[Webhook] Warming:", memberMessages.length, "msgs agendadas,", immediateExecs.length, "enviadas");
            }
          } else {
            console.log("[Webhook] Pool member nao encontrado para WABA:", selectedWabaId);
          }

        } else if (trigger_flow && contact) {
          // Fluxo normal (sem warming)
          console.log("[Webhook Contacts] Disparando fluxo normal para:", contact.id);

          const { data: flows } = await supabase
            .from("flows")
            .select("*")
            .eq("status", "active")
            .in("trigger_type", ["contact_added", "webhook", "new_contact"]);

          if (flows && flows.length > 0) {
            for (const flow of flows) {
              await executeFlow(flow.id, contact.id, { source: "webhook", isNew, custom_fields, tags });
            }
            console.log("[Webhook Contacts] Fluxos executados:", flows.length);
          }
        }

        results.push({
          success: true,
          contact: {
            id: contact.id,
            name: contact.name,
            phone_number: contact.phone_number,
            tags: contact.tags,
            custom_fields: contact.custom_fields,
            whatsapp_account_id: contact.whatsapp_account_id
          },
          is_new: isNew,
          flow_triggered: trigger_flow || false,
          warming: selectedWabaId ? {
            pool_id: targetPool.id,
            pool_name: targetPool.name,
            waba_id: selectedWabaId,
            history_id: warmingHistoryId
          } : null
        });
      } // Fim do for loop

      // Retornar array se entrada foi array, senao objeto unico
      res.json(Array.isArray(req.body) ? results : results[0]);
    } catch (error) {
      console.error('[Webhook Contacts] Erro:', error);
      res.status(500).json({ error: error.message });
    }
  });




  
  // ============ ENDPOINT DE LOGS ============
  app.get('/api/logs', async (req, res) => {
    try {
      const {
        category,
        level,
        campaign_id,
        search,
        start_date,
        end_date,
        page = 0,
        limit = 50
      } = req.query;

      let query = supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .eq('organization_id', DEFAULT_ORG_ID)
        .order('timestamp', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }
      if (level && level !== 'all') {
        query = query.eq('level', level);
      }
      if (campaign_id) {
        query = query.eq('campaign_id', campaign_id);
      }
      if (search) {
        query = query.ilike('message', `%${search}%`);
      }
      if (start_date) {
        query = query.gte('timestamp', start_date);
      }
      if (end_date) {
        query = query.lte('timestamp', end_date);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      res.json({ data, count, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      console.error('[Logs] Erro:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para estatísticas de logs
  app.get('/api/logs/stats', async (req, res) => {
    try {
      const now = new Date();
      const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

      // Total de logs
      const { count: totalLogs } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', DEFAULT_ORG_ID);

      // Erros nas últimas 24h
      const { count: errors24h } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', DEFAULT_ORG_ID)
        .eq('level', 'error')
        .gte('timestamp', last24h);

      // Logs por categoria
      const { data: byCategory } = await supabase
        .from('system_logs')
        .select('category')
        .eq('organization_id', DEFAULT_ORG_ID)
        .gte('timestamp', last24h);

      const categoryCounts = {};
      (byCategory || []).forEach(log => {
        categoryCounts[log.category] = (categoryCounts[log.category] || 0) + 1;
      });

      res.json({
        totalLogs: totalLogs || 0,
        errors24h: errors24h || 0,
        byCategory: categoryCounts
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  

  // GET /api/phone-numbers/:id/info - Buscar info de qualidade e limite
  app.get('/api/phone-numbers/:id/info', async (req, res) => {
    try {
      const { id } = req.params;
      const refresh = req.query.refresh === 'true';
      
      // Buscar número e conta WABA
      const { data: phone, error } = await supabase
        .from('phone_numbers')
        .select('*, whatsapp_accounts(waba_id, access_token_encrypted)')
        .eq('id', id)
        .single();
      
      if (error || !phone) {
        return res.status(404).json({ error: 'Número não encontrado' });
      }
      
      let qualityRating = phone.quality_rating;
      let messagingLimit = phone.messaging_limit || 'TIER_250';
      
      // Se refresh=true, buscar da API do Meta
      if (refresh && phone.whatsapp_accounts?.access_token_encrypted) {
        const accessToken = phone.whatsapp_accounts.access_token_encrypted;
        const wabaId = phone.whatsapp_accounts.waba_id;
        
        // Buscar quality rating do phone number
        try {
          const phoneResponse = await fetch(
            `https://graph.facebook.com/v21.0/${phone.phone_number_id}?fields=quality_rating,messaging_limit_tier,throughput`,
            { headers: { Authorization: `Bearer ${accessToken}` }}
          );
          const phoneData = await phoneResponse.json();
          console.log('[Phone Info] Quality data:', phoneData);
          
          if (phoneData.quality_rating) {
            qualityRating = phoneData.quality_rating;
          }
          if (phoneData.messaging_limit_tier) {
            messagingLimit = phoneData.messaging_limit_tier;
            console.log('[Phone Info] Messaging limit atualizado:', messagingLimit);
          }
        } catch (e) {
          console.error('[Phone Info] Erro ao buscar quality:', e.message);
        }
        
        // Atualizar no banco
        await supabase
          .from('phone_numbers')
          .update({ 
            quality_rating: qualityRating,
            messaging_limit: messagingLimit,
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
      }
      
      // Calcular restantes
      const limitMap = {
        'TIER_250': 250,
        'TIER_1K': 1000,
        'TIER_10K': 10000,
        'TIER_100K': 100000,
        'UNLIMITED': 999999
      };
      
      const dailyLimit = limitMap[messagingLimit] || 250;
      const sentToday = phone.messages_sent_today || 0;
      const remainingToday = Math.max(0, dailyLimit - sentToday);
      
      // Verificar se precisa resetar (novo dia)
      const now = new Date();
      const resetAt = new Date(phone.limit_reset_at || 0);
      const isNewDay = now.toDateString() !== resetAt.toDateString();
      
      res.json({
        id: phone.id,
        phone_number: phone.phone_number,
        display_name: phone.display_name,
        quality_rating: qualityRating,
        quality_label: qualityRating === 'GREEN' ? 'Alta' : qualityRating === 'YELLOW' ? 'Média' : qualityRating === 'RED' ? 'Baixa' : 'Desconhecida',
        messaging_limit: messagingLimit,
        messaging_limit_label: messagingLimit.replace('TIER_', '').replace('K', '.000'),
        daily_limit: dailyLimit,
        messages_sent_today: isNewDay ? 0 : sentToday,
        remaining_today: isNewDay ? dailyLimit : remainingToday,
        limit_reset_at: phone.limit_reset_at
      });
      
    } catch (error) {
      console.error('[Phone Info] Erro:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/phone-numbers/stats - Buscar stats de todos os números
  app.get('/api/phone-numbers/stats', async (req, res) => {
    try {
      const { data: phones, error } = await supabase
        .from('phone_numbers')
        .select('id, phone_number, display_name, quality_rating, messaging_limit, messages_sent_today, limit_reset_at, status')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const limitMap = {
        'TIER_250': 250,
        'TIER_1K': 1000,
        'TIER_10K': 10000,
        'TIER_100K': 100000,
        'UNLIMITED': 999999
      };
      
      const now = new Date();
      
      const stats = phones.map(phone => {
        const resetAt = new Date(phone.limit_reset_at || 0);
        const isNewDay = now.toDateString() !== resetAt.toDateString();
        const dailyLimit = limitMap[phone.messaging_limit] || 250;
        const sentToday = isNewDay ? 0 : (phone.messages_sent_today || 0);
        
        return {
          id: phone.id,
          phone_number: phone.phone_number,
          display_name: phone.display_name,
          status: phone.status,
          quality_rating: phone.quality_rating || 'UNKNOWN',
          quality_label: phone.quality_rating === 'GREEN' ? 'Alta' : phone.quality_rating === 'YELLOW' ? 'Média' : phone.quality_rating === 'RED' ? 'Baixa' : 'Desconhecida',
          messaging_limit: phone.messaging_limit || 'TIER_250',
          daily_limit: dailyLimit,
          messages_sent_today: sentToday,
          remaining_today: Math.max(0, dailyLimit - sentToday),
          usage_percent: Math.round((sentToday / dailyLimit) * 100)
        };
      });
      
      res.json(stats);
      
    } catch (error) {
      console.error('[Phone Stats] Erro:', error);
      res.status(500).json({ error: error.message });
    }
  });


// ============ TESTAR PROXY ============
app.post('/api/proxy/test', async (req, res) => {
  try {
    const { proxy_type, proxy_url, proxy_username, proxy_password } = req.body;
    
    if (!proxy_url) {
      return res.status(400).json({ success: false, error: 'URL do proxy é obrigatória' });
    }
    
    console.log('[Proxy Test] Testando proxy:', proxy_type, proxy_url, 'User:', proxy_username, 'Pass:', proxy_password ? '***' : 'VAZIO');
    
    const proxyConfig = {
      proxy_enabled: true,
      proxy_type: proxy_type || 'http',
      proxy_url,
      proxy_username,
      proxy_password
    };
    
    const agent = createProxyAgent(proxyConfig);
    
    if (!agent) {
      return res.status(400).json({ success: false, error: 'Falha ao criar proxy agent' });
    }
    
    // Testar conexão fazendo uma requisição simples
    const testConfig = {
      method: 'GET',
      url: 'https://httpbin.org/ip',
      httpsAgent: agent,
      timeout: 10000
    };
    
    const response = await axios(testConfig);
    const externalIp = response.data?.origin || 'IP não detectado';
    
    console.log('[Proxy Test] Sucesso! IP externo:', externalIp);
    
    res.json({ 
      success: true, 
      message: 'Proxy funcionando!',
      external_ip: externalIp
    });
    
  } catch (error) {
    console.error('[Proxy Test] Erro:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Falha ao conectar ao proxy'
    });
  }
});

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WhatsApp Phone ID: ${WA_PHONE_ID}`);
    console.log(`Organization ID: ${DEFAULT_ORG_ID}`);
    console.log(`Auto-reply: ${AUTO_REPLY_ENABLED ? 'ATIVADO' : 'DESATIVADO'}`);
  });

 // ============ ENDPOINTS DE CAMPANHA ============

  // Criar campanha
  app.post('/api/campaigns/create', async (req, res) => {
    try {
      const { name, template_id, audience_filter, scheduled_at } = req.body;

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert({
          organization_id: DEFAULT_ORG_ID,
          name,
          template_id,
          audience_filter: audience_filter || {},
          status: 'draft',
          scheduled_at
        })
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, campaign });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

   // Iniciar campanha
  app.post('/api/campaigns/:id/start', async (req, res) => {
    try {
      const { id } = req.params;

      // Buscar campanha (sem join)
      const { data: campaign, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (campError) throw campError;

      // Buscar contatos baseado no audience_filter
      let contactsQuery = supabase
        .from('contacts')
        .select('id, phone_number, name, custom_fields')
        .eq('organization_id', DEFAULT_ORG_ID)
        .eq('opted_in', true);

      // Aplicar filtro de tags se existir
      if (campaign.audience_filter && campaign.audience_filter.tags && campaign.audience_filter.tags.length > 0) {
        contactsQuery = contactsQuery.overlaps('tags', campaign.audience_filter.tags);
        console.log('[Campaign] Filtrando por tags:', campaign.audience_filter.tags);
      }

      const { data: contacts, error: contError } = await contactsQuery;

      if (contError) throw contError;

      if (!contacts || contacts.length === 0) {
        return res.status(400).json({ error: 'Nenhum contato encontrado' });
      }

      // Adicionar cada contato à fila
      // OTIMIZAÇÃO: Buscar template UMA vez
      let _tpl = null;
      if (campaign.template_id) {
        const { data } = await supabase.from("message_templates").select("name, language").eq("id", campaign.template_id).single();
        _tpl = data;
      }
      // BATCH INSERT: Criar todos os registros de uma vez
      const campaignMsgs = contacts.map(c => ({ campaign_id: id, contact_id: c.id, status: "pending" }));
      await supabase.from("campaign_messages").insert(campaignMsgs);
      for (const contact of contacts) {

          // Verificar se tem template ou enviar texto
          if (_tpl) { const tpl = _tpl;

            if (tpl) {
              const components = [];
              if (campaign.template_variables) {
                // Substituir variáveis dinâmicas com dados do contato
                const params = Object.values(campaign.template_variables).map(v => {
                  let value = String(v);
                  // Substituir placeholders de contato
                  value = value.replace(/\{\{contact\.name\}\}/gi, contact.name || '');
                  value = value.replace(/\{\{contact\.phone\}\}/gi, contact.phone_number || '');
                  value = value.replace(/\{\{contact\.phone_number\}\}/gi, contact.phone_number || '');
                  value = value.replace(/\{\{name\}\}/gi, contact.name || '');
                  value = value.replace(/\{\{nome\}\}/gi, contact.name || '');
                  value = value.replace(/\{\{phone\}\}/gi, contact.phone_number || '');
                  value = value.replace(/\{\{telefone\}\}/gi, contact.phone_number || '');
                  value = value.replace(/\{\{primeiro_nome\}\}/gi, (contact.name || '').split(' ')[0] || '');
                  value = value.replace(/\{\{first_name\}\}/gi, (contact.name || '').split(' ')[0] || '');
                  
                  // Substituir custom fields: {{custom.campo}} ou {{campo}}
                  if (contact.custom_fields && typeof contact.custom_fields === 'object') {
                    Object.entries(contact.custom_fields).forEach(([key, val]) => {
                      const regex1 = new RegExp(`\\{\\{custom\\.${key}\\}\\}`, 'gi');
                      const regex2 = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
                      value = value.replace(regex1, String(val) || '');
                      value = value.replace(regex2, String(val) || '');
                    });
                  }
                  
                  return {
                    type: 'text',
                    text: value
                  };
                });
                if (params.length > 0) {
                  components.push({ type: 'body', parameters: params });
                }
              }
              messageQueue.add('send-campaign', {
                to: contact.phone_number,
                type: 'template',
                template: {
                  name: tpl.name,
                  language: tpl.language || 'pt_BR',
                  components: components
                },
                campaignId: id,
                contactId: contact.id,
                wabaId: campaign.whatsapp_account_id
              });
            }
          } else {
            messageQueue.add('send-campaign', {
              to: contact.phone_number,
              type: 'text',
              content: 'Ola ' + (contact.name || '') + '! Campanha: ' + campaign.name,
              campaignId: id,
              contactId: contact.id,
              wabaId: campaign.whatsapp_account_id
            });
          }
      }

        // Atualizar status da campanha
        await supabase
          .from('campaigns')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
            audience_count: contacts.length,
            stats: { total: contacts.length, sent: 0, delivered: 0, read: 0, failed: 0 }
          })
          .eq('id', id);

      res.json({
        success: true,
        message: `Campanha iniciada com ${contacts.length} contatos`,
        total: contacts.length
      });
    } catch (error) {
      console.error('Erro ao iniciar campanha:', error);
      res.status(500).json({ error: error.message });
    }
  });

      // Criar registros de mensagens e adicionar à fila

  // Status da campanha
  app.get('/api/campaigns/:id/status', async (req, res) => {
    try {
      const { id } = req.params;

      // Buscar campanha
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      // Contar mensagens por status
      const { data: stats } = await supabase
        .from('campaign_messages')
        .select('status')
        .eq('campaign_id', id);

      const counts = {
        pending: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0
      };

      stats?.forEach(s => {
        counts[s.status] = (counts[s.status] || 0) + 1;
      });

      // Info da fila
      const queueCounts = await messageQueue.getJobCounts();

      res.json({
        campaign,
        stats: counts,
        queue: queueCounts,
        progress: campaign?.total_recipients
          ? Math.round(((counts.sent + counts.delivered + counts.read + counts.failed) / campaign.total_recipients) * 100)
          : 0
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Listar campanhas
  app.get('/api/campaigns', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('organization_id', DEFAULT_ORG_ID)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Status da fila (para monitor)
  app.get('/api/queue/status', async (req, res) => {
    try {
      const counts = await messageQueue.getJobCounts();

      // Calcular throughput real (mensagens por segundo nos últimos 10 segundos)
      let realThroughput = 0;
      if (typeof throughputTracker !== 'undefined' && throughputTracker.history.length > 0) {
        const now = Date.now();
        const last10Seconds = throughputTracker.history.filter(h => h.timestamp > now - 10000);
        const totalMessages = last10Seconds.reduce((sum, h) => sum + h.count, 0);
        realThroughput = last10Seconds.length > 0 ? Math.round(totalMessages / Math.min(last10Seconds.length, 10)) : 0;
      }

      // Calcular throughput do último minuto
      let throughputPerMinute = 0;
      if (typeof throughputTracker !== 'undefined' && throughputTracker.history.length > 0) {
        throughputPerMinute = throughputTracker.history.reduce((sum, h) => sum + h.count, 0);
      }

      res.json({
        ...counts,
        throughput: realThroughput,
        throughputPerMinute: throughputPerMinute,
        maxThroughput: 80
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// ============ LINK TRACKING ============
const LINK_DOMAIN = process.env.LINK_DOMAIN || 'go.publipropaganda.shop';

// Gerar código único para link
function generateLinkCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Criar link rastreado
async function createTrackedLink(originalUrl, contactId, campaignId, messageType, buttonText) {
  try {
    let code = generateLinkCode();
    
    // Verificar se código já existe
    let attempts = 0;
    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('tracked_links')
        .select('id')
        .eq('code', code)
        .single();
      
      if (!existing) break;
      code = generateLinkCode();
      attempts++;
    }
    
    const insertData = {
      code,
      original_url: originalUrl,
      contact_id: contactId,
      campaign_id: campaignId,
      message_type: messageType,
      button_text: buttonText,
      organization_id: DEFAULT_ORG_ID
    };

    console.log('[Link Tracking] Inserindo:', JSON.stringify(insertData));

    const { data: link, error } = await supabase
      .from('tracked_links')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Link Tracking] Erro ao criar link:', error.message, error.details, error.hint);
      return originalUrl; // Fallback para URL original
    }

    if (!link) {
      console.error('[Link Tracking] Insert retornou sem dados!');
      return originalUrl;
    }

    const trackedUrl = 'https://' + LINK_DOMAIN + '/r/' + code;
    console.log('[Link Tracking] Link criado com sucesso:', trackedUrl, '-> ', originalUrl, '| ID:', link.id);
    return trackedUrl;
  } catch (error) {
    console.error('[Link Tracking] Erro:', error.message);
    return originalUrl;
  }
}

// Endpoint de redirect
app.get('/r/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // Buscar link
    const { data: link, error } = await supabase
      .from('tracked_links')
      .select('*')
      .eq('code', code)
      .single();
    
    if (!link || error) {
      console.log('[Link Tracking] Link não encontrado:', code);
      return res.status(404).send('Link não encontrado');
    }
    
    // Registrar clique
    await supabase.from('link_clicks').insert({
      tracked_link_id: link.id,
      contact_id: link.contact_id,
      ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown'
    });
    
    // Salvar no inbox como evento
    if (link.contact_id) {
      await saveFlowMessage(link.contact_id, null, 'link_click', {
        url: link.original_url,
        button_text: link.button_text || 'Link',
        clicked_at: new Date().toISOString()
      });
    }
    
    console.log('[Link Tracking] Clique registrado:', code, '->', link.original_url);
    
    // Redirecionar
    res.redirect(link.original_url);
  } catch (error) {
    console.error('[Link Tracking] Erro no redirect:', error.message);
    res.status(500).send('Erro interno');
  }
});

