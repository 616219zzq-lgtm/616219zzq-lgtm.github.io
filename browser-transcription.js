/* Web Speech captures live microphone audio; it cannot transcribe saved blobs. */
window.createBrowserTranscription = function () {
  let recognition, text = '', failure = '', ended = true, settle, timer;
  function abort() {
    clearTimeout(timer);
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      try { recognition.abort(); } catch (_) {}
    }
    recognition = null; ended = true;
    if (settle) { settle({ text: '', error: 'aborted' }); settle = null; }
  }
  return {
    abort,
    start() {
      abort(); text = ''; failure = '';
      const API = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!API) { failure = 'unsupported'; return false; }
      try {
        recognition = new API();
        recognition.lang = 'zh-CN'; recognition.continuous = true; recognition.interimResults = true;
        recognition.onresult = event => {
          text = Array.from(event.results, result => result[0].transcript).join('').trim();
        };
        recognition.onerror = event => { failure = event.error; };
        recognition.onend = () => {
          ended = true; clearTimeout(timer);
          if (settle) { settle({ text, error: failure }); settle = null; }
        };
        ended = false; recognition.start(); return true;
      } catch (_) { ended = true; failure = 'start-failed'; return false; }
    },
    finish() {
      if (ended || !recognition) return Promise.resolve({ text, error: failure });
      return new Promise(resolve => {
        settle = resolve;
        timer = setTimeout(() => {
          const result = { text, error: failure || 'timeout' };
          settle = null; abort(); resolve(result);
        }, 8000);
        try { recognition.stop(); } catch (_) { clearTimeout(timer); settle = null; resolve({ text, error: failure }); }
      });
    }
  };
};
