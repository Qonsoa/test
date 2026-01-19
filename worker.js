// worker/worker.js
import { CacheManager } from './cache.js';
import { DomainValidator } from './domain-validator.js';
import { CLINICS_DATA } from './clinics-data.js'; // Your existing clinic data

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Origin-Domain',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    
    // Initialize managers
    const cacheManager = new CacheManager(env);
    const domainValidator = new DomainValidator();

    // ==================== DOMAIN VALIDATION ====================
    const origin = request.headers.get('X-Origin-Domain') || 
                   request.headers.get('Origin') || 
                   request.headers.get('Referer');
    
    // Extract clinic ID from path
    const clinicIdMatch = path.match(/\/(get-clinic|chat)\/([^\/]+)/);
    const clinicId = clinicIdMatch ? clinicIdMatch[2] : null;

    if (clinicId) {
      const validation = domainValidator.validateWithDev(clinicId, origin);
      if (!validation.valid) {
        return new Response(JSON.stringify({ 
          error: "Unauthorized",
          message: validation.reason,
          ...(validation.allowedDomains && { allowed: validation.allowedDomains })
        }), { 
          status: 403, 
          headers: corsHeaders 
        });
      }
    }

    // ==================== ROUTES ====================
    
    // GET CLINIC DATA
    if (request.method === 'GET' && path.startsWith('/get-clinic/')) {
      const clinicId = path.split('/get-clinic/')[1];
      
      if (!clinicId) {
        return new Response(JSON.stringify({ error: "clinic_id is required" }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      // Check cache first
      const cachedClinic = await cacheManager.get(`clinic:${clinicId}`);
      if (cachedClinic) {
        return new Response(JSON.stringify(cachedClinic), { 
          headers: corsHeaders 
        });
      }

      const data = CLINICS_DATA[clinicId];
      if (!data) {
        return new Response(JSON.stringify({ error: "Clinic data not found" }), { 
          status: 404, 
          headers: corsHeaders 
        });
      }

      // Cache clinic data
      await cacheManager.set(`clinic:${clinicId}`, data, 3600); // 1 hour

      return new Response(JSON.stringify(data), { 
        headers: corsHeaders 
      });
    }

    // CHAT WITH AI
    if (request.method === 'POST' && path.startsWith('/chat/')) {
      const clinicId = path.split('/chat/')[1];
      
      if (!clinicId) {
        return new Response(JSON.stringify({ error: "clinic_id is required" }), { 
          status: 400, 
          headers: corsHeaders 
        });
      }

      if (!CLINICS_DATA[clinicId]) {
        return new Response(JSON.stringify({ error: "Invalid clinic_id" }), { 
          status: 404, 
          headers: corsHeaders 
        });
      }

      try {
        const requestData = await request.json();
        const lastMessage = requestData.messages[requestData.messages.length - 1];
        const userMessage = lastMessage?.content;

        if (!userMessage) {
          return new Response(JSON.stringify({ error: "No message provided" }), { 
            status: 400, 
            headers: corsHeaders 
          });
        }

        // ==================== FAQ CACHING ====================
        // Define common questions for FAQ caching
        const FAQ_QUESTIONS = [
          "what are your opening hours",
          "what are your hours",
          "when are you open",
          "where are you located",
          "what is your address",
          "book an appointment",
          "make an appointment",
          "schedule appointment",
          "dental emergency",
          "tooth pain",
          "what insurance do you accept",
          "do you accept insurance",
          "how much does a cleaning cost",
          "cost of cleaning"
        ];

        // Check if this is a FAQ question
        const lowerMessage = userMessage.toLowerCase();
        const isFAQ = FAQ_QUESTIONS.some(faq => lowerMessage.includes(faq));
        
        if (isFAQ) {
          // Try to get from cache
          const cachedResponse = await cacheManager.getFAQResponse(clinicId, userMessage);
          if (cachedResponse) {
            return new Response(JSON.stringify({
              choices: [{
                message: {
                  content: cachedResponse,
                  role: 'assistant'
                }
              }]
            }), { 
              headers: corsHeaders 
            });
          }
        }

        // ==================== AI CALL ====================
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: requestData.model || 'llama-3.1-8b-instant',
            messages: requestData.messages || [],
            temperature: requestData.temperature || 0.4,
            max_tokens: requestData.max_tokens || 512,
            stream: false,
          }),
        });

        if (!groqResponse.ok) {
          const errorText = await groqResponse.text();
          throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`);
        }

        const responseData = await groqResponse.json();
        const botResponse = responseData.choices[0].message.content;

        // Cache FAQ responses
        if (isFAQ) {
          await cacheManager.cacheFAQResponse(clinicId, userMessage, botResponse);
        }

        return new Response(JSON.stringify(responseData), { 
          headers: corsHeaders 
        });
      } catch (error) {
        console.error("API Error:", error);
        return new Response(JSON.stringify({ 
          error: "Failed to process AI request",
          message: error.message 
        }), { 
          status: 500, 
          headers: corsHeaders 
        });
      }
    }

    // HEALTH CHECK ENDPOINT
    if (path === '/health') {
      return new Response(JSON.stringify({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'dental-chat-widget'
      }), { 
        headers: corsHeaders 
      });
    }

    // CACHE MANAGEMENT ENDPOINTS (Admin only)
    if (path === '/admin/cache/clear' && request.method === 'POST') {
      // Add authentication here in production
      const body = await request.json();
      const clinicId = body.clinicId;
      
      if (clinicId) {
        // Clear all cache for this clinic
        const keys = [
          `clinic:${clinicId}`,
          `quick:${clinicId}`
        ];
        
        // Add FAQ cache keys
        const FAQ_QUESTIONS = [
          "what are your opening hours",
          "what are your hours",
          "when are you open",
          "where are you located",
          "what is your address",
          "book an appointment",
          "make an appointment",
          "schedule appointment",
          "dental emergency",
          "tooth pain",
          "what insurance do you accept",
          "do you accept insurance",
          "how much does a cleaning cost",
          "cost of cleaning"
        ];
        
        for (const question of FAQ_QUESTIONS) {
          keys.push(`faq:${clinicId}:${question}`);
        }
        
        // Delete all keys
        for (const key of keys) {
          await cacheManager.delete(key);
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          message: `Cache cleared for clinic ${clinicId}`,
          cleared_keys: keys.length
        }), { 
          headers: corsHeaders 
        });
      }
    }

    // ==================== NOT FOUND ====================
    return new Response(JSON.stringify({ 
      error: "Not Found",
      path: path,
      method: request.method
    }), { 
      status: 404, 
      headers: corsHeaders 
    });
  }
}