# Deploying SignFlow to Vercel (1-Click Guide)

SignFlow is configured for seamless deployment on **Vercel**.

Because SignFlow includes an **in-browser edge AI classifier and real-time MediaPipe HandLandmarker**, the entire application runs directly on Vercel with **zero external backend servers required**.

---

## 🌟 Why Vercel Works Instantly

- **Zero Server Setup**: The camera, hand landmark extraction, gesture recognition state machine, speech synthesis, and contextual reply catalogue run completely in the browser.
- **Ultra-Low Latency**: In-browser classification runs at 60 FPS without waiting for server network roundtrips.
- **Secure HTTPS**: Vercel provides automatic HTTPS, which modern browsers require to grant webcam access (`getUserMedia`).
- **Dual Architecture**:
  - **Standalone Mode (Default)**: Runs 100% in-browser with the verified PSL vocabulary (`HELLO`, `STOP`, `YES`, `HELP`, `WATER`).
  - **Hybrid Mode (Optional)**: If you provide a remote Python WebSocket URL, SignFlow automatically connects to it; if disconnected, it seamlessly falls back to the in-browser engine.

---

## 🚀 Step-by-Step Deployment Instructions

### Step 1: Push Your Latest Code to GitHub
When you are ready, run these commands in your terminal:
```bash
git add .
git commit -m "feat: enable standalone in-browser AI classification for 1-click Vercel deployment"
git push origin main
```

---

### Step 2: Import into Vercel
1. Navigate to **[vercel.com](https://vercel.com)** and log in with your GitHub account.
2. On your Vercel Dashboard, click **Add New...** → **Project**.
3. Locate your repository (`RehanAslam2004/Sign-Flow` or `Sign-Flow`) and click **Import**.

---

### Step 3: Configure & Deploy
1. **Framework Preset**: Vercel will automatically detect **Next.js**.
2. **Root Directory**: Leave as `./` (default).
3. **Build and Output Settings**: Leave as default (`npm run build`).
4. **Environment Variables**:
   - **None required!** SignFlow will boot directly with the high-performance in-browser edge AI engine.
   - *(Optional)*: If you deployed the Python backend to a cloud host with WebSockets, you can add:
     - `NEXT_PUBLIC_WS_URL` = `wss://your-cv-service.onrender.com/ws/predict`
5. Click **Deploy**.

Within 60–90 seconds, Vercel will generate your live production URL (e.g. `https://signflow-xxx.vercel.app`).

---

## 📱 Testing Your Deployed App

1. Open your Vercel URL on desktop or mobile.
2. Grant camera permissions when prompted.
3. Select your mode:
   - **"I'm the one signing"** (Direct signer translation)
   - **"Someone with me is signing"** (Live translation + Suggested Sign Replies + AR Ghost Hand Guide)
4. Verify the green status indicator shows **"AI Ready (In-Browser)"** or **"Connected"**.
5. Perform verified PSL signs:
   - ✋ **HELLO**: Open palm facing camera.
   - ✊ **STOP**: Closed fist.
   - 👍 **YES**: Thumbs up.
   - ☝️ **HELP**: Index finger raised pointing up.
   - 🤟 **WATER**: 3 fingers extended (Index, Middle, Ring).

---

## 🔧 Optional: Connecting a Remote Python Backend Later

If you ever wish to connect a remote Python FastAPI service:
1. You can add `NEXT_PUBLIC_WS_URL=wss://<your-service>/ws/predict` in **Vercel Settings → Environment Variables**, then trigger a redeploy.
2. Or you can click **"Configure Server"** directly inside the running app UI to enter or change the WebSocket URL at any time!
