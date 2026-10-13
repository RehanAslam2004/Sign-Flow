# SignFlow Render Deployment Guide

This guide explains how to deploy both the **Next.js Web Frontend** and the **Python FastAPI CV Backend** on Render so they connect seamlessly over secure WebSockets (`wss://`).

---

## 1. Why You Saw "Inference service disconnected"

SignFlow consists of two cooperating parts:
1. **Next.js Frontend** (handles camera, user interface, transcript, and text-to-speech).
2. **Python FastAPI Service** (`cv-service/`, handles hand landmark classification and sign inference).

When you deployed your repository as a single Node Web Service on Render:
- Render started only the Next.js frontend (`https://sign-flow-ph83.onrender.com`).
- The Python CV service was not running on Render.
- The browser tried to connect to `ws://127.0.0.1:8000/ws/predict` (your local computer). In addition, modern browsers block unencrypted `ws://` connections when visiting an `https://` site (Mixed Content policy).

---

## 2. Quick 2-Minute Fix (For Your Existing Render Project)

### Step 1: Deploy the Python CV Backend on Render

1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** (top right) $\rightarrow$ **Web Service**.
3. Select your GitHub repository: `RehanAslam2004/Sign-Flow`.
4. Configure the service settings:
   - **Name:** `signflow-cv`
   - **Region:** Same region as your web app (e.g., Oregon or Frankfurt)
   - **Root Directory:** `cv-service`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** `Free`
5. Click **Create Web Service**.
6. Wait 1–2 minutes until Render shows **"Live"**.
7. Copy your Python service URL (e.g., `https://signflow-cv.onrender.com`).

---

### Step 2: Connect the Next.js Frontend to the Python Backend

You have two easy ways to connect them:

#### Option A: Set Environment Variable in Render (Permanent)
1. In your Render Dashboard, click on your existing frontend service (`Sign-Flow` / `sign-flow-ph83`).
2. Go to the **Environment** tab on the left.
3. Click **Add Environment Variable**:
   - **Key:** `NEXT_PUBLIC_WS_URL`
   - **Value:** `wss://your-cv-service-name.onrender.com/ws/predict`
   *(Replace with your actual Python service domain, using `wss://` instead of `https://`).*
4. Click **Save Changes**. Render will automatically rebuild and deploy your web app with the live backend connected!

#### Option B: Instant In-Browser Connection (Zero Rebuild Required)
We added a built-in server configuration tool directly inside the application:
1. Open your live app: `https://sign-flow-ph83.onrender.com`.
2. When the yellow banner appears, click **"Configure Server"**.
3. Paste your Render backend URL (e.g. `wss://signflow-cv.onrender.com/ws/predict` or `https://signflow-cv.onrender.com`).
4. Click **"Save & Connect"**. The app will immediately connect and save the preference in your browser!

---

## 3. Render Free Tier Sleep Notice

Render puts free web services to sleep after 15 minutes of inactivity.
- If your Python service has been idle, it may take 30–50 seconds to wake up on the first connection.
- SignFlow includes automatic reconnection logic and will automatically connect once the server finishes waking up. You can also click **"Retry Connection"** on the banner.

---

## 4. Alternative: 1-Click Render Blueprint (`render.yaml`)

We have added a [`render.yaml`](./render.yaml) blueprint file to the repository.
To launch both services together automatically:
1. In the Render Dashboard, click **New +** $\rightarrow$ **Blueprint**.
2. Connect your `Sign-Flow` repository.
3. Render will read `render.yaml` and provision both `signflow-cv` and `signflow-web` linked together automatically.

---

## 5. Note on `npm audit` Warnings

When building locally or on Render, you may see:
```text
9 vulnerabilities (2 moderate, 6 high, 1 critical)
To address all issues (including breaking changes), run:
  npm audit fix --force
```

> **Do NOT run `npm audit fix --force`.**
> Running `--force` attempts to upgrade to Next.js 16 and Tailwind CSS v4, which contain breaking API changes that will break the build.
> The Next.js 14.2 LTS version currently used compiles cleanly and safely on Render.
