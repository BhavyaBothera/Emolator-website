document.addEventListener("DOMContentLoaded", () => {

  // --- DOM Elements ---
  const menuToggle = document.getElementById("menu-toggle");
  const navLinks = document.getElementById("nav-links");
  const micBtn = document.getElementById("micBtn");
  const micIcon = document.getElementById("micIcon");
  const micStatus = document.getElementById("micStatus");
  const captionsBox = document.getElementById("captionsBox");
  const historyListEl = document.getElementById("historyList");
  const downloadBtn = document.getElementById("downloadBtn");
  const langSelect = document.getElementById("langSelect");
  const historySearch = document.getElementById("historySearch");
  const insightFilters = document.querySelector(".insight-filters");
  const darkModeBtn = document.getElementById("darkModeBtn");
  const fontPlus = document.getElementById("fontPlus");
  const fontMinus = document.getElementById("fontMinus");
  const happyStat = document.getElementById("happyStat");
  const sadStat = document.getElementById("sadStat");
  const angryStat = document.getElementById("angryStat");
  const neutralStat = document.getElementById("neutralStat");
  const emotionChartCanvas = document.getElementById("emotionChart");
  const trendChartCanvas = document.getElementById("trendChart");
  const wordCloudCanvas = document.getElementById("wordCloudCanvas");
  const visualizerCanvas = document.getElementById("visualizerCanvas");
  const emojiContainer = document.getElementById("emoji-container");

  // --- Mobile Navigation Logic ---
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // --- State Variables ---
  let currentStats = { happy: 0, sad: 0, angry: 0, neutral: 0 };
  let isListening = false;
  let recognition;
  let emotionChart, trendChart;

  // --- LocalStorage Helpers ---
  function savePref(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error("Could not save pref:", e); }
  }

  function loadPref(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  }

  // --- Emotions Setup ---
  const emotions = {
    happy: { emoji: "😊", color: "var(--happy-color)", value: 1 },
    sad: { emoji: "😔", color: "var(--sad-color)", value: -1 },
    angry: { emoji: "😡", color: "var(--angry-color)", value: -2 },
    neutral: { emoji: "😐", color: "var(--neutral-color)", value: 0 }
  };

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // --- Chart Initialization ---
  function initializeCharts() {
    if (emotionChartCanvas) {
      const ctx = emotionChartCanvas.getContext("2d");
      emotionChart = new Chart(ctx, {
        type: "pie",
        data: {
          labels: ["Happy", "Sad", "Angry", "Neutral"],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: [
              getCssVar('--happy-color'),
              getCssVar('--sad-color'),
              getCssVar('--angry-color'),
              getCssVar('--neutral-color')
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: getCssVar('--text') } } }
        }
      });
    }

    if (trendChartCanvas) {
      const ctx = trendChartCanvas.getContext("2d");
      trendChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: [{ label: 'Emotion Level', data: [], tension: 0.3, fill: true, pointRadius: 2, pointHoverRadius: 5 }] },
        options: {
          scales: {
            x: { type: 'time', time: { unit: 'hour' }, ticks: { color: getCssVar('--text') } },
            y: {
              suggestedMin: -2, suggestedMax: 2,
              ticks: { stepSize: 1, color: getCssVar('--text'), callback: v => ({1:'Happy',0:'Neutral','-1':'Sad','-2':'Angry'})[v] }
            }
          },
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  // --- Update Stats & Charts ---
  function updateStatsDisplay() {
    if (!emotionChart) return;
    const total = Object.values(currentStats).reduce((a,b)=>a+b,0);
    const calc = n => total===0 ? "0%" : `${Math.round((n/total)*100)}%`;
    if(happyStat) happyStat.textContent = calc(currentStats.happy);
    if(sadStat) sadStat.textContent = calc(currentStats.sad);
    if(angryStat) angryStat.textContent = calc(currentStats.angry);
    if(neutralStat) neutralStat.textContent = calc(currentStats.neutral);
    emotionChart.data.datasets[0].data = [currentStats.happy,currentStats.sad,currentStats.angry,currentStats.neutral];
    emotionChart.update();
  }

  // --- History Management ---
  function displayHistory(arr) {
    if(!historyListEl) return;
    historyListEl.innerHTML = "";
    if(!arr.length) {
      historyListEl.innerHTML = `<li>${historySearch && historySearch.value ? 'No matching entries.' : 'No conversations in this period.'}</li>`;
      return;
    }
    arr.slice().reverse().forEach(item => {
      const li = document.createElement("li");
      li.textContent = `${item.emoji} ${item.text} (${new Date(item.time).toLocaleString()})`;
      historyListEl.appendChild(li);
    });
  }

  function saveToHistory(text, emoji, emotionKey) {
    const history = loadPref("emolator_history", []);
    history.push({ text, emoji, emotionKey, time: Date.now() });
    savePref("emolator_history", history.filter(item => (Date.now()-item.time)<30*24*60*60*1000));
  }

  // --- Central Dashboard Update Function ---
  function updateDashboard(timeFilterMs) {
    const history = loadPref("emolator_history", []);
    const now = Date.now();
    const filteredHistory = history.filter(h => (now - h.time) < timeFilterMs);

    const searchTerm = historySearch ? historySearch.value.toLowerCase() : '';
    const searchedHistory = filteredHistory.filter(h => h.text.toLowerCase().includes(searchTerm));
    displayHistory(searchedHistory);

    const newStats = { happy: 0, sad: 0, angry: 0, neutral: 0 };
    filteredHistory.forEach(item => {
      if (newStats[item.emotionKey] !== undefined) newStats[item.emotionKey]++;
    });
    currentStats = newStats;
    updateStatsDisplay();

    updateTrendChart(timeFilterMs);
    updateWordCloud(filteredHistory);
  }

  // --- Speech Recognition ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    if(langSelect) recognition.lang = langSelect.value;

    recognition.onstart = () => { isListening = true; updateMicState(); setupAudioVisualizer(); };
    recognition.onend = () => {
        isListening = false;
        updateMicState();
        stopAudioVisualizer();
        micBtn.focus();
    };

    recognition.onresult = event => {
      let interimTranscript = "";
      if(captionsBox) {
        const placeholder = captionsBox.querySelector(".placeholder");
        if(placeholder) placeholder.remove();
      }

      for(let i=event.resultIndex;i<event.results.length;i++){
        const res = event.results[i];
        if(res.isFinal){
          const text = res[0].transcript.trim();
          if(!text) continue;

          const sentiment = new Sentiment();
          const result = sentiment.analyze(text);
          let emotionKey = "neutral";
          if(result.score>1) emotionKey="happy";
          else if(result.score<0) emotionKey = /\b(angry|mad|hate|furious|annoyed)\b/i.test(text) ? "angry":"sad";

          if(captionsBox){
            const c = document.createElement("div");
            c.className="caption";
            c.style.background=`var(--${emotionKey}-color)`;
            c.innerHTML=`<strong>${emotions[emotionKey].emoji}</strong> ${text}`;
            captionsBox.appendChild(c);
            const finalCaptions = captionsBox.querySelectorAll('.caption:not(.placeholder):not(.interim)');
            if(finalCaptions.length>5) finalCaptions[0].remove();
            captionsBox.scrollTop=captionsBox.scrollHeight;
          }

          triggerEmojiBurst(emotions[emotionKey].emoji);
          saveToHistory(text, emotions[emotionKey].emoji, emotionKey);

          const activeFilter = insightFilters?.querySelector('.active');
          if (activeFilter) {
            updateDashboard(parseInt(activeFilter.dataset.filter));
          }

        } else {
          interimTranscript += res[0].transcript;
        }
      }

      if(captionsBox){
        let lastInterim = captionsBox.querySelector(".caption.interim");
        if(interimTranscript){
          if(!lastInterim){
            lastInterim = document.createElement("div");
            lastInterim.className="caption interim";
            lastInterim.style.opacity="0.6";
            captionsBox.appendChild(lastInterim);
          }
          lastInterim.textContent="⌛ "+interimTranscript;
        } else lastInterim?.remove();
      }
    };
  } else {
    if(micStatus) micStatus.textContent="Speech API not supported.";
    if(micBtn) micBtn.disabled=true;
  }

  // --- Mic Button ---
  function updateMicState(){
    if(!micBtn || !micStatus || !micIcon) return;
    micBtn.setAttribute("aria-pressed", isListening);
    micStatus.textContent = isListening ? "Listening..." : "Idle";
    micStatus.classList.toggle("listening", isListening);
    micIcon.textContent = isListening ? "🎙️" : "🎤";
  }

  if(micBtn) micBtn.addEventListener("click", ()=>{
    if(!recognition) return;
    if(!isListening){ if(langSelect) recognition.lang=langSelect.value; recognition.start(); }
    else recognition.stop();
  });

  // --- History Search ---
  if(historySearch) historySearch.addEventListener('input', ()=>{
    const activeFilter = insightFilters?.querySelector('.active');
    if (activeFilter) {
      updateDashboard(parseInt(activeFilter.dataset.filter));
    }
  });

  // --- Theme Toggle ---
  if(darkModeBtn) darkModeBtn.addEventListener("click", ()=>{
    const theme = document.body.classList.contains('dark') ? 'light' : 'dark';
    savePref("emolator_theme", theme);
    applyTheme(theme);
  });

  // --- Font Size ---
  if(fontPlus) fontPlus.addEventListener("click", ()=>{
    let fs = parseInt(document.body.style.fontSize)||16; fs=Math.min(22,fs+2);
    document.body.style.fontSize=`${fs}px`; savePref("emolator_font", fs);
  });
  if(fontMinus) fontMinus.addEventListener("click", ()=>{
    let fs = parseInt(document.body.style.fontSize)||16; fs=Math.max(12,fs-2);
    document.body.style.fontSize=`${fs}px`; savePref("emolator_font", fs);
  });

  // --- Insight Filters ---
  if(insightFilters) insightFilters.addEventListener('click', e=>{
    const target = e.target;
    if(target.classList.contains('filter-btn')){
      insightFilters.querySelector('.active').classList.remove('active');
      target.classList.add('active');
      updateDashboard(parseInt(target.dataset.filter));

      const announcer = document.getElementById('updates-announcer');
      if (announcer) {
        announcer.textContent = `Dashboard updated to show the last ${target.textContent}.`;
      }
    }
  });

  // --- CSV Download ---
  if(downloadBtn) downloadBtn.addEventListener("click", ()=>{
    const history = loadPref("emolator_history", []);
    if(!history.length){ alert("No history available."); return; }
    let csv="data:text/csv;charset=utf-8,Timestamp,Emotion,Text\n";
    history.forEach(h=>{
      csv+=`${new Date(h.time).toISOString()},${h.emotionKey},"${h.text.replace(/"/g,'""')}"\n`;
    });
    const link = document.createElement("a");
    link.href=encodeURI(csv); link.download="Emolator_History.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  });

  // --- Theme Application ---
  function applyTheme(theme){
    document.body.classList.toggle("dark", theme==='dark');
    if(darkModeBtn) darkModeBtn.textContent = theme==='dark' ? "☀️":"🌙";

    if(emotionChart && trendChart){
      const c=theme==='dark'?"#f1f1f1":"#222";
      emotionChart.options.plugins.legend.labels.color=c;
      trendChart.options.scales.y.ticks.color=c;
      trendChart.options.scales.x.ticks.color=c;
      emotionChart.data.datasets[0].backgroundColor=[getCssVar('--happy-color'),getCssVar('--sad-color'),getCssVar('--angry-color'),getCssVar('--neutral-color')];
      emotionChart.update();
      const activeFilter = insightFilters?.querySelector('.active');
      if (activeFilter) {
        updateTrendChart(parseInt(activeFilter.dataset.filter));
      }
    }
  }

  // --- Word Cloud ---
  function updateWordCloud(historyToUse){
    if(!wordCloudCanvas) return;
    const history = historyToUse || loadPref("emolator_history", []);
    if(history.length<5){ wordCloudCanvas.getContext('2d')?.clearRect(0,0,wordCloudCanvas.width,wordCloudCanvas.height); return; }
    const allText=history.map(h=>h.text).join(" ").toLowerCase();
    const words=allText.match(/\b(\w+)\b/g); if(!words) return;
    const stopWords=new Set(["a","an","the","is","in","it","of","and","to","i","me","my","you","your","he","she","we","they"]);
    const list=Object.entries(words.reduce((acc,w)=>{ if(!stopWords.has(w)&&w.length>2) acc[w]=(acc[w]||0)+1; return acc; },{}))
            .sort((a,b)=>b[1]-a[1]).slice(0,40);
    if(list.length<5) return;
    WordCloud(wordCloudCanvas,{list:list,color:'random-dark',backgroundColor:'transparent',weightFactor:4});
  }

  // --- Audio Visualizer ---
  let audioContext, analyser, source, animationFrameId;
  async function setupAudioVisualizer(){
    if (!visualizerCanvas || !micStatus) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStatus.classList.remove("error");
      micStatus.textContent = isListening ? "Listening..." : "Idle";

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      drawVisualizer();
    } catch (e) {
      console.error("Mic access failed", e);
      micStatus.textContent = "Mic access denied.";
      micStatus.classList.add("error");
      if (micBtn) micBtn.disabled = true;
    }
  }

  function stopAudioVisualizer(){
    if(animationFrameId) cancelAnimationFrame(animationFrameId);
    audioContext?.close().catch(e=>console.error(e));
    visualizerCanvas?.getContext('2d')?.clearRect(0,0,visualizerCanvas.width,visualizerCanvas.height);
  }
  function drawVisualizer(){
    animationFrameId=requestAnimationFrame(drawVisualizer);
    const data=new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    const ctx=visualizerCanvas.getContext('2d'); if(!ctx) return;
    ctx.clearRect(0,0,visualizerCanvas.width,visualizerCanvas.height);
    ctx.lineWidth=2; ctx.strokeStyle=getCssVar('--accent'); ctx.beginPath();
    let x=0; const sliceWidth=visualizerCanvas.width/data.length;
    for(let i=0;i<data.length;i++){
      const y=(data[i]/128)*visualizerCanvas.height/2;
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      x+=sliceWidth;
    }
    ctx.lineTo(visualizerCanvas.width,visualizerCanvas.height/2); ctx.stroke();
  }

  // --- Emoji Bursts ---
  function triggerEmojiBurst(emoji) {
    if (!emojiContainer) return;
    const burstCount = 20;
    for (let i = 0; i < burstCount; i++) {
        const e = document.createElement('span');
        e.className = 'emoji-burst';
        e.innerText = emoji;
        e.style.left = '50vw';
        e.style.top = '50vh';
        e.style.fontSize = `${Math.random() * 1.5 + 1}rem`;

        const angle = Math.random() * 360;
        const distance = Math.random() * 150 + 50;
        const duration = Math.random() * 1 + 0.5;

        e.style.setProperty('--angle', angle + 'deg');
        e.style.setProperty('--distance', distance + 'px');
        e.style.setProperty('--duration', duration + 's');

        emojiContainer.appendChild(e);
        setTimeout(() => e.remove(), duration * 1000);
    }
  }


  // --- Trend Chart ---
  function updateTrendChart(timeFilterMs=259200000){
    if(!trendChart) return;
    const history=loadPref("emolator_history", []);
    const now=Date.now();
    const filtered=history.filter(h=>(now-h.time)<timeFilterMs);
    trendChart.data.datasets[0].data=filtered.map(h=>({x:h.time,y:emotions[h.emotionKey]?.value||0}));

    const ctx=trendChart.ctx;
    const gradient=ctx.createLinearGradient(0,0,0,ctx.canvas.height);
    const accent=getCssVar('--accent');
    gradient.addColorStop(0,`${accent}80`); gradient.addColorStop(1,`${accent}00`);
    trendChart.data.datasets[0].backgroundColor=gradient;
    trendChart.data.datasets[0].borderColor=accent;
    trendChart.update();
  }

  // --- Initialization ---
  function init(){
    initializeCharts();
    const theme=loadPref("emolator_theme","light");
    const font=loadPref("emolator_font",16); document.body.style.fontSize=`${font}px`;
    applyTheme(theme);

    const activeFilter = insightFilters?.querySelector('.active');
    const initialTimeFilter = activeFilter ? parseInt(activeFilter.dataset.filter) : 259200000; // Default to 3 days
    updateDashboard(initialTimeFilter);
  }

  init();

});