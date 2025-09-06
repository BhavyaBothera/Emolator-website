document.addEventListener("DOMContentLoaded", () => {

  // --- DOM Elements ---
  const micBtn = document.getElementById("micBtn"),
        micIcon = document.getElementById("micIcon"),
        micStatus = document.getElementById("micStatus"),
        captionsBox = document.getElementById("captionsBox"),
        historyListEl = document.getElementById("historyList"),
        downloadBtn = document.getElementById("downloadBtn"),
        langSelect = document.getElementById("langSelect"),
        historySearch = document.getElementById("historySearch"),
        insightFilters = document.querySelector(".insight-filters"),
        darkModeBtn = document.getElementById("darkModeBtn"),
        fontPlus = document.getElementById("fontPlus"),
        fontMinus = document.getElementById("fontMinus"),
        happyStat = document.getElementById("happyStat"),
        sadStat = document.getElementById("sadStat"),
        angryStat = document.getElementById("angryStat"),
        neutralStat = document.getElementById("neutralStat"),
        emotionChartCanvas = document.getElementById("emotionChart"),
        trendChartCanvas = document.getElementById("trendChart"),
        wordCloudCanvas = document.getElementById("wordCloudCanvas"),
        visualizerCanvas = document.getElementById("visualizerCanvas"),
        emojiContainer = document.getElementById("emoji-container");

  // --- State ---
  let currentStats = { happy: 0, sad: 0, angry: 0, neutral: 0 };
  let isListening = false, recognition, emotionChart, trendChart;
  let audioContext, analyser, source, animationFrameId;

  // --- Preferences ---
  const savePref = (key,val)=>{ try{localStorage.setItem(key,JSON.stringify(val));}catch{} }
  const loadPref = (key,fallback)=>{ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fallback;}catch{return fallback;} }

  // --- Emotions ---
  const emotions = {
    happy:{emoji:"😊", color:"var(--happy-color)", value:1},
    sad:{emoji:"😔", color:"var(--sad-color)", value:-1},
    angry:{emoji:"😡", color:"var(--angry-color)", value:-2},
    neutral:{emoji:"😐", color:"var(--neutral-color)", value:0}
  };
  const getCssVar = name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // --- Initialize Charts ---
  function initializeCharts(){
    if(emotionChartCanvas){
      const ctx=emotionChartCanvas.getContext("2d");
      emotionChart=new Chart(ctx,{
        type:"pie",
        data:{
          labels:["Happy","Sad","Angry","Neutral"],
          datasets:[{data:[0,0,0,0],backgroundColor:[getCssVar('--happy-color'),getCssVar('--sad-color'),getCssVar('--angry-color'),getCssVar('--neutral-color')]}]
        },
        options:{responsive:true,plugins:{legend:{labels:{color:getCssVar('--text')}}}}
      });
    }
    if(trendChartCanvas){
      const ctx=trendChartCanvas.getContext("2d");
      trendChart=new Chart(ctx,{
        type:'line',
        data:{datasets:[{label:'Emotion Level',data:[],tension:0.3,fill:true,pointRadius:2,pointHoverRadius:5}]},
        options:{
          scales:{
            x:{type:'time',time:{unit:'hour'},ticks:{color:getCssVar('--text')}},
            y:{suggestedMin:-2,suggestedMax:2,ticks:{stepSize:1,color:getCssVar('--text'),callback:v=>({1:'Happy',0:'Neutral','-1':'Sad','-2':'Angry'})[v]}}
          },
          plugins:{legend:{display:false}}
        }
      });
    }
  }

  function updateStatsDisplay(){
    if(!emotionChart) return;
    const total=Object.values(currentStats).reduce((a,b)=>a+b,0);
    const calc=n=>total===0?"0%":`${Math.round((n/total)*100)}%`;
    happyStat.textContent=calc(currentStats.happy);
    sadStat.textContent=calc(currentStats.sad);
    angryStat.textContent=calc(currentStats.angry);
    neutralStat.textContent=calc(currentStats.neutral);
    emotionChart.data.datasets[0].data=[currentStats.happy,currentStats.sad,currentStats.angry,currentStats.neutral];
    emotionChart.update();
  }

  // --- History ---
  function displayHistory(arr){
    historyListEl.innerHTML="";
    if(!arr.length){ historyListEl.innerHTML=`<li>${historySearch && historySearch.value?'No matching entries.':'No conversations in this period.'}</li>`; return; }
    arr.slice().reverse().forEach(item=>{
      const li=document.createElement("li");
      li.textContent=`${item.emoji} ${item.text} (${new Date(item.time).toLocaleString()})`;
      historyListEl.appendChild(li);
    });
  }

  function saveToHistory(text,emoji,emotionKey){
    const history=loadPref("emolator_history",[]);
    history.push({text,emoji,emotionKey,time:Date.now()});
    savePref("emolator_history",history.filter(i=>Date.now()-i.time<30*24*60*60*1000));
  }

  function updateDashboard(timeFilterMs){
    const history=loadPref("emolator_history",[]);
    const now=Date.now();
    const filtered=history.filter(h=>(now-h.time)<timeFilterMs);
    const searchTerm = historySearch?historySearch.value.toLowerCase():"";
    const searched=filtered.filter(h=>h.text.toLowerCase().includes(searchTerm));
    displayHistory(searched);

    // Stats
    const newStats={happy:0,sad:0,angry:0,neutral:0};
    filtered.forEach(item=>{ if(newStats[item.emotionKey]!==undefined) newStats[item.emotionKey]++; });
    currentStats=newStats;
    updateStatsDisplay();

    // Trend & Word Cloud
    updateTrendChart(filtered);
    updateWordCloud(filtered);
  }

  // --- Trend Chart ---
  function updateTrendChart(history){
    if(!trendChart) return;
    const data=history.map(h=>({x:h.time,y:emotions[h.emotionKey]?.value||0}));
    trendChart.data.datasets[0].data=data;
    trendChart.update();
  }

  // --- Speech Recognition ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(SpeechRecognition){
    recognition=new SpeechRecognition();
    recognition.continuous=true;
    recognition.interimResults=true;
    if(langSelect) recognition.lang=langSelect.value;

    recognition.onstart=()=>{ isListening=true; updateMicState(); setupAudioVisualizer(); };
    recognition.onend=()=>{ isListening=false; updateMicState(); stopAudioVisualizer(); };
    recognition.onresult=event=>{
      let interim="";
      if(captionsBox){ const ph=captionsBox.querySelector(".placeholder"); if(ph) ph.remove(); }
      for(let i=event.resultIndex;i<event.results.length;i++){
        const res=event.results[i];
        if(res.isFinal){
          const text=res[0].transcript.trim();
          if(!text) continue;
          const sentiment=new Sentiment();
          const score=sentiment.analyze(text).score;
          let emotionKey="neutral";
          if(score>1) emotionKey="happy";
          else if(score<0) emotionKey=/\b(angry|mad|hate|furious|annoyed)\b/i.test(text)?"angry":"sad";

          if(captionsBox){
            const c=document.createElement("div");
            c.className="caption";
            c.style.background=`var(--${emotionKey}-color)`;
            c.innerHTML=`<strong>${emotions[emotionKey].emoji}</strong> ${text}`;
            captionsBox.appendChild(c);
            const finalCaptions=captionsBox.querySelectorAll('.caption:not(.placeholder):not(.interim)');
            if(finalCaptions.length>5) finalCaptions[0].remove();
            captionsBox.scrollTop=captionsBox.scrollHeight;
          }

          saveToHistory(text,emotions[emotionKey].emoji,emotionKey);
          const activeFilter=insightFilters?.querySelector('.active');
          if(activeFilter) updateDashboard(parseInt(activeFilter.dataset.filter));
        } else interim+=res[0].transcript;
      }

      if(captionsBox){
        let last=captionsBox.querySelector(".caption.interim");
        if(interim){
          if(!last){ last=document.createElement("div"); last.className="caption interim"; last.style.opacity="0.6"; captionsBox.appendChild(last); }
          last.textContent="⌛ "+interim;
        } else last?.remove();
      }
    };
  } else { micStatus.textContent="Speech API not supported."; micBtn.disabled=true; }

  // --- Mic Button ---
  function updateMicState(){
    micBtn.setAttribute("aria-pressed",isListening);
    micStatus.textContent=isListening?"Listening...":"Idle";
    micStatus.classList.toggle("listening",isListening);
    micIcon.textContent=isListening?"🎙️":"🎤";
  }
  micBtn.addEventListener("click",()=>{
    if(!recognition) return;
    if(!isListening){ if(langSelect) recognition.lang=langSelect.value; recognition.start(); }
    else recognition.stop();
  });

  // --- History Search ---
  historySearch?.addEventListener('input',()=>{ const af=insightFilters?.querySelector('.active'); if(af) updateDashboard(parseInt(af.dataset.filter)); });

  // --- Dark Mode ---
  darkModeBtn?.addEventListener("click",()=>{
    const theme=document.body.classList.contains('dark')?'light':'dark';
    savePref("emolator_theme",theme);
    applyTheme(theme);
  });
  function applyTheme(theme){
    document.body.classList.toggle("dark",theme==='dark');
    darkModeBtn.textContent=theme==='dark'?"☀️":"🌙";
    if(emotionChart && trendChart){
      const c=theme==='dark'?"#f1f1f1":"#222";
      emotionChart.options.plugins.legend.labels.color=c;
      trendChart.options.scales.y.ticks.color=c;
      trendChart.options.scales.x.ticks.color=c;
      emotionChart.data.datasets[0].backgroundColor=[getCssVar('--happy-color'),getCssVar('--sad-color'),getCssVar('--angry-color'),getCssVar('--neutral-color')];
      emotionChart.update();
    }
  }
  applyTheme(loadPref("emolator_theme",'light'));

  // --- Font Size ---
  fontPlus?.addEventListener("click",()=>{ let fs=parseInt(document.body.style.fontSize)||16; fs=Math.min(22,fs+2); document.body.style.fontSize=`${fs}px`; savePref("emolator_font",fs); });
  fontMinus?.addEventListener("click",()=>{ let fs=parseInt(document.body.style.fontSize)||16; fs=Math.max(12,fs-2); document.body.style.fontSize=`${fs}px`; savePref("emolator_font",fs); });
  const fsSaved=loadPref("emolator_font",16); document.body.style.fontSize=`${fsSaved}px`;

  // --- Insight Filters ---
  insightFilters?.addEventListener('click',e=>{
    const t=e.target;
    if(t.classList.contains('filter-btn')){
      insightFilters.querySelector('.active').classList.remove('active');
      t.classList.add('active');
      updateDashboard(parseInt(t.dataset.filter));
    }
  });

  // --- CSV Download ---
  downloadBtn?.addEventListener("click",()=>{
    const history=loadPref("emolator_history",[]);
    if(!history.length){ alert("No history available."); return; }
    let csv="data:text/csv;charset=utf-8,Timestamp,Emotion,Text\n";
    history.forEach(h=>{ csv+=`${new Date(h.time).toISOString()},${h.emotionKey},"${h.text.replace(/"/g,'""')}"\n`; });
    const link=document.createElement("a");
    link.href=encodeURI(csv); link.download="Emolator_History.csv";
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  });

  // --- Word Cloud ---
  function updateWordCloud(history){
    if(!wordCloudCanvas) return;
    if(!history || history.length<5){ wordCloudCanvas.getContext('2d')?.clearRect(0,0,wordCloudCanvas.width,wordCloudCanvas.height); return; }
    const allText=history.map(h=>h.text).join(" ").toLowerCase();
    const words=allText.match(/\b(\w+)\b/g); if(!words) return;
    const stopWords=new Set(["a","an","the","is","in","it","of","and","to","i","me","my","you","your","he","she","we","they"]);
    const list=Object.entries(words.reduce((acc,w)=>{ if(!stopWords.has(w)&&w.length>2) acc[w]=(acc[w]||0)+1; return acc; },{})).sort((a,b)=>b[1]-a[1]).slice(0,40);
    if(list.length<5) return;
    WordCloud(wordCloudCanvas,{list:list,color:'random-dark',backgroundColor:'transparent',weightFactor:4});
  }

  // --- Audio Visualizer ---
  async function setupAudioVisualizer(){
    if(!visualizerCanvas) return;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      audioContext=new (window.AudioContext || window.webkitAudioContext)();
      analyser=audioContext.createAnalyser();
      source=audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize=256;
      const bufferLength=analyser.frequencyBinCount;
      const dataArray=new Uint8Array(bufferLength);
      const ctx=visualizerCanvas.getContext("2d");
      const draw=()=>{
        animationFrameId=requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        ctx.fillStyle="transparent";
        ctx.clearRect(0,0,visualizerCanvas.width,visualizerCanvas.height);
        const barWidth=(visualizerCanvas.width / bufferLength)*2.5;
        let x=0;
        for(let i=0;i<bufferLength;i++){
          const barHeight=dataArray[i]/2;
          ctx.fillStyle=`rgba(79,70,229,${barHeight/128})`;
          ctx.fillRect(x,visualizerCanvas.height-barHeight,barWidth,barHeight);
          x+=barWidth+1;
        }
      };
      draw();
    }catch(err){ micStatus.textContent="Visualizer unavailable"; }
  }
  function stopAudioVisualizer(){ if(animationFrameId) cancelAnimationFrame(animationFrameId); if(audioContext) audioContext.close(); }

  // --- Floating Emoji Background ---
  const emojiList=["😊","😔","😡","😐","😂","😍","😎","🤔"];
  function spawnEmoji(){
    const e=document.createElement("div");
    e.className="emoji";
    e.textContent=emojiList[Math.floor(Math.random()*emojiList.length)];
    e.style.left=Math.random()*100+"%";
    e.style.fontSize=(16+Math.random()*24)+"px";
    emojiContainer.appendChild(e);
    setTimeout(()=>e.remove(),10000);
  }
  setInterval(spawnEmoji,700);

  // --- Initialize ---
  initializeCharts();
  const defaultFilter=insightFilters?.querySelector('.active')?.dataset.filter || 259200000;
  updateDashboard(parseInt(defaultFilter));

});
