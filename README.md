# Sightline: Web Performance Visualizer

Sightline is a full-stack web application that generates comprehensive performance audits for websites. It combines **Google Lighthouse** metrics with **Playwright** screenshots and uses **Gemini AI** to translate technical data into actionable, human-friendly business insights.

![Sightline Dashboard Screenshot](https://via.placeholder.com/800x450.png?text=Sightline+Dashboard+Preview)

## 🚀 Features

*   **Automated Audits**: Runs Google Lighthouse in a headless Docker container.
*   **AI-Powered Insights**: Uses Google Gemini 2.0 Flash to analyze performance bottlenecks and explain their business impact.
*   **Visual Timeline**: Displays a frame-by-frame filmstrip of the page load process.
*   **Performance Score**: Real-time gauge visualization of the overall performance score.
*   **Full-Stack Architecture**: Built with Django (Backend), Next.js (Frontend), Celery (Async Tasks), and Redis.

## 🛠️ Tech Stack

*   **Frontend**: Next.js 16 (App Router), Tailwind CSS, Framer Motion, Lucide Icons.
*   **Backend**: Django 5, Django REST Framework.
*   **Task Queue**: Celery + Redis.
*   **Automation**: Playwright (Browsers), Google Lighthouse (CLI).
*   **AI**: Google Gemini API.
*   **Infrastructure**: Docker & Docker Compose.

## 📦 Installation & Setup

### Prerequisites
*   Docker & Docker Compose
*   A Google Gemini API Key (Get one [here](https://aistudio.google.com/app/apikey))

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/sightline-performance-visualizer.git
cd sightline-performance-visualizer
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory. You can copy the example file:
```bash
cp .env.example .env
```

Open `.env` and add your API key:
```ini
# .env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
> **Security Note**: Never commit your `.env` file to version control. It is already added to `.gitignore`.

### 3. Run with Docker
Start the entire stack with a single command:
```bash
docker-compose up --build -d
```

### 4. Access the Application
*   **Frontend**: [http://localhost:3000](http://localhost:3000)
*   **Backend API**: [http://localhost:8000/api/](http://localhost:8000/api/)

## 🔧 Architecture Overview

1.  **User submits URL** via Next.js frontend.
2.  **API** creates a `Report` record and triggers a Celery task.
3.  **Celery Worker**:
    *   Launches **Playwright** to capture a screenshot.
    *   Runs **Lighthouse** CLI to generate a JSON performance report.
    *   Parses the JSON and filters for failing audits (Score < 0.9).
    *   Sends failing audits to **Gemini AI** to generate a summary.
4.  **Frontend** polls the API for status updates and displays the results when ready.

## 🛡️ Security
*   API Keys are managed via environment variables.
*   Docker containers run in isolated networks.
*   `.env` files are excluded from Git history.

## 📄 License
MIT License. Feel free to use this for your own projects!
