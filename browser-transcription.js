/* Uses the browser speech service while the user is speaking live. */
window.createBrowserTranscription = function () {
  let recognition, text = '', interim = '', failure = '', active = false, finalizing = false, retries = 0, settle, timer, onText;
  function makeRecognition() {
    const API = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!API) { failure = 'unsupported'; return false; }
    try {
      recognition = new API();
      recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true;
      recognition.onresult = event => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) { text += result[0].transcript; interim = ''; }
          else interim = result[0].transcript;
        }
        text = text.trim();
        if (onText) onText(text || interim);
      };
      recognition.onerror = event => { failure = event.error; if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(failure)) active = false; };
      recognition.onend = () => {
        if (active && !finalizing && retries++ < 2) { makeRecognition(); try { recognition.start(); return; } catch (_) {} }
        active = false; clearTimeout(timer);
        if (settle) { settle({ text, error: failure }); settle = null; }
      };
      return true;
    } catch (_) { failure = 'start-failed'; return false; }
  }
  function abort() {
    clearTimeout(timer); active = false; finalizing = true;
    if (recognition) { recognition.onresult = recognition.onerror = recognition.onend = null; try { recognition.abort(); } catch (_) {} }
    recognition = null;
    if (settle) { settle({ text: '', error: 'aborted' }); settle = null; }
  }
  return {
    abort,
    start(onTranscript) {
      abort(); text = ''; interim = ''; failure = ''; retries = 0; finalizing = false; active = true;
      onText = onTranscript;
      if (!makeRecognition()) { active = false; return false; }
      try { recognition.start(); return true; } catch (_) { active = false; failure = 'start-failed'; return false; }
    },
    finish() {
      if (!recognition || !active) return Promise.resolve({ text: text || interim, error: failure });
      finalizing = true; active = false;
      return new Promise(resolve => {
        settle = resolve;
        timer = setTimeout(() => { const result = { text: text || interim, error: failure || 'timeout' }; settle = null; abort(); resolve(result); }, 10000);
        try { recognition.stop(); } catch (_) { clearTimeout(timer); settle = null; resolve({ text: text || interim, error: failure }); }
      });
    }
  };
};
