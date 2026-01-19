// embed/embed.js
(function() {
  'use strict';

  // ==================== CONFIGURATION ====================
  const CONFIG = {
    WIDGET_URL: 'https://your-widget-domain.com/widget/index.html',
    ALLOWED_ORIGIN: 'https://your-widget-domain.com'
  };

  // ==================== GET BOT TOKEN ====================
  const currentScript = document.currentScript || 
    document.querySelector('script[data-token]');
  
  const BOT_TOKEN = currentScript?.getAttribute('data-token');
  
  if (!BOT_TOKEN) {
    console.error('❌ Dental Widget Error: Missing data-token attribute');
    return;
  }

  // ==================== CREATE IFRAME ====================
  function createIframeWidget() {
    // Create unique ID for this widget instance
    const WIDGET_ID = `dental-widget-${BOT_TOKEN}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create iframe container
    const container = document.createElement('div');
    container.id = `dental-widget-container-${WIDGET_ID}`;
    container.style.cssText = `
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      width: 0 !important;
      height: 0 !important;
      z-index: 2147483647 !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      pointer-events: none !important;
    `;

    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = `dental-widget-${WIDGET_ID}`;
    iframe.title = 'Dental Assistant Chat';
    iframe.allow = 'clipboard-write';
    iframe.style.cssText = `
      position: absolute !important;
      bottom: 0 !important;
      right: 0 !important;
      width: 80px !important;
      height: 80px !important;
      border: none !important;
      border-radius: 50% !important;
      background: transparent !important;
      overflow: hidden !important;
      pointer-events: auto !important;
      transition: all 0.3s ease !important;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
    `;

    // Set iframe source with token
    iframe.src = `${CONFIG.WIDGET_URL}?token=${BOT_TOKEN}&domain=${encodeURIComponent(window.location.origin)}`;

    // Add iframe to container
    container.appendChild(iframe);
    
    // Add to document
    document.body.appendChild(container);

    // Handle messages from iframe
    window.addEventListener('message', function(event) {
      // Security check - verify origin
      if (event.origin !== CONFIG.ALLOWED_ORIGIN) return;
      
      const data = event.data;
      
      switch (data.type) {
        case 'resize':
          // Resize iframe based on widget state
          if (data.state === 'open') {
            iframe.style.width = '380px !important';
            iframe.style.height = '600px !important';
            iframe.style.borderRadius = '24px !important';
          } else {
            iframe.style.width = '80px !important';
            iframe.style.height = '80px !important';
            iframe.style.borderRadius = '50% !important';
          }
          break;
          
        case 'close':
          // Optional: handle close from inside iframe
          break;
          
        case 'error':
          console.error('Widget Error:', data.message);
          break;
      }
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', function() {
      iframe.contentWindow.postMessage({
        type: 'visibility',
        visible: !document.hidden
      }, CONFIG.ALLOWED_ORIGIN);
    });

    return {
      container,
      iframe,
      destroy: function() {
        container.remove();
        window.removeEventListener('message', arguments.callee);
      }
    };
  }

  // ==================== INITIALIZATION ====================
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(createIframeWidget, 1000);
      });
    } else {
      setTimeout(createIframeWidget, 1000);
    }
  }

  // ==================== GLOBAL EXPORT ====================
  if (!window.DentalWidget) {
    window.DentalWidget = {
      version: '3.0.0',
      init: init,
      destroy: function() {
        const containers = document.querySelectorAll('[id^="dental-widget-container-"]');
        containers.forEach(container => container.remove());
      }
    };
  }

  // Auto-initialize
  init();

})();