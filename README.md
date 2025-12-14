# 🎙 Emolator - Speech to Emotion

A real-time web application for speech-to-emotion analysis and conversation insights.

## ✨ Features

* **Real-time Emotion Analysis:** Converts spoken words into text and analyzes the emotional tone instantly.
* **Core Emotions Tracking:** Categorizes emotions into **Happy** (😊), **Sad** (😔), **Angry** (😡), and **Neutral** (😐).
    * The sentiment score is mapped to these emotions, with words like 'angry', 'mad', 'hate', or 'furious' specifically flagging an 'Angry' emotion if the overall score is negative.
* **Visualizer:** Provides a real-time audio visualization using a canvas element while listening.
* **Emoji Bursts:** Triggers celebratory emoji animations on positive emotion detection.
* **Multi-language Support:** Allows users to select a language for speech recognition, including English (`en-US`), Hindi (`hi-IN`), and Spanish (`es-ES`).
* **Dashboard Insights:**
    * **Emotions:** Displays overall emotion frequency in a pie chart.
    * **History:** Saves and displays a log of past conversations (retaining entries for 30 days) and allows for search filtering.
    * **Trends:** Shows emotional trends over different time periods (1H, 24H, 3D, 1W, 1M) via a line chart.
    * **Word Cloud:** Generates a visual word cloud of the most frequently used non-stop words.
* **Export Functionality:** Allows users to download their conversation history as a CSV file.
* **Customizable UI:** Includes a Dark Mode toggle (🌙/☀️) and options to increase/decrease the font size (A+/A−).

## 🛠 Technology Stack

**Client-Side:**
* **HTML5**
* **CSS3** (with modern responsive design and CSS variables for theming)
* **JavaScript (ES6+)**
* **Web Speech API (SpeechRecognition)** for microphone input and transcription
* **Chart.js v4.x** for all data visualizations (Pie Chart, Trend Line Chart)
* **WordCloud.js v1.2.2** for word frequency visualization
* **date-fns** and **chartjs-adapter-date-fns** for time-series data handling
* **AFINN-based Sentiment Analysis** (via `sentiment.local.js`) for text scoring

## 🚀 Setup and Installation

This project is a static front-end application and requires no server.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/bhavyabothera/Emolator-website
    cd Emolator-website
    ```
2.  **Open in Browser:** Simply open the `index.html` file in a modern web browser that supports the **Web Speech API**.
    * ***Note:*** The Web Speech API works best in Chrome (desktop and Android) and requires the application to be served over **HTTPS** or accessed locally (`file://`) for microphone access.

## 💻 Usage

1.  **Start Listening:** Click the large **🎤** (microphone) button in the hero section to start the real-time speech recognition. The icon will change to **🎙️** and the status will show "Listening...".
2.  **Select Language:** Use the **Select Language** dropdown to choose between English, Hindi, or Spanish.
3.  **View Captions:** Your spoken words will appear in the captions box below the microphone. Final, analyzed captions will be displayed with their detected emoji (e.g., 😊).
4.  **Analyze Data:** Navigate to the **Emotions**, **History**, and **Insights** sections to view graphical representations and logs of your speech data.
