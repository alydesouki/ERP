
    // The raw 64-char fingerprint (used for IPC, not displayed)
    const RAW_FINGERPRINT = "test";

    // ── Copy Device ID ───────────────────────────────────────────────────
    function copyDeviceId() {
      const btn = document.getElementById('copyBtn');
      navigator.clipboard.writeText(RAW_FINGERPRINT).then(() => {
        btn.textContent = '✓ تم النسخ';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg> نسخ`;
          btn.classList.remove('copied');
        }, 2500);
      }).catch(() => {
        // Fallback for environments without clipboard API
        const el = document.createElement('textarea');
        el.value = RAW_FINGERPRINT;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        btn.textContent = '✓ تم النسخ';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.2"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg> نسخ`;
          btn.classList.remove('copied');
        }, 2500);
      });
    }

    /* ── Show Status ────────────────────────────────────────────────────── */
    function showStatus(type, message) {
      const banner = document.getElementById('statusBanner');
      const icon   = document.getElementById('statusIcon');
      const text   = document.getElementById('statusText');
      
      // Clear previous classes
      banner.className = 'status-banner show';
      
      if (type === 'success') {
        banner.style.background = 'var(--success-bg)';
        banner.style.border = '1px solid rgba(16,185,129,0.25)';
        banner.style.color = 'var(--success)';
        icon.textContent = ''; // Removed icon because it's in the text
      } else if (type === 'error') {
        banner.style.background = 'var(--error-bg)';
        banner.style.border = '1px solid rgba(239,68,68,0.25)';
        banner.style.color = 'var(--error)';
        icon.textContent = ''; // Removed icon because it's in the text
      } else if (type === 'validating') {
        banner.style.background = 'rgba(59, 130, 246, 0.12)';
        banner.style.border = '1px solid rgba(59,130,246,0.25)';
        banner.style.color = 'var(--accent)';
        // Insert spinner icon
        icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>';
      }
      
      text.textContent = message;
    }

    function hideStatus() {
      document.getElementById('statusBanner').className = 'status-banner';
    }

    /* ── Activate ───────────────────────────────────────────────────────── */
    function activate() {
      const licenseText = document.getElementById('licenseInput').value.trim();
      const btn = document.getElementById('activateBtn');

      if (!licenseText) {
        showStatus('error', '✗ يرجى إدخال مفتاح الترخيص أولاً.\n✗ Please enter a license key.');
        return;
      }

      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = 'جارٍ التحقق... Validating...';
      showStatus('validating', 'جاري التحقق من الترخيص...\nValidating license...');

      // Send to main process via IPC
      window.__activationIpc.submit(licenseText);
    }

    /* ── IPC Response Listener ──────────────────────────────────────────── */
    window.__activationCallbacks = {
      onSuccess: function(message) {
        const btn = document.getElementById('activateBtn');
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = '✓ تم التفعيل — Activated';
        showStatus('success', message);
      },
      onError: function(message) {
        const btn = document.getElementById('activateBtn');
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.textContent = 'تفعيل — Activate';
        showStatus('error', message);
      }
    };
  