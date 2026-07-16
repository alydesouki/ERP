
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
  