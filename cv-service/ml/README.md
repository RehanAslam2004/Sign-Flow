# SignFlow — Machine Learning Pipeline & Multi-Language Model Integration

This directory contains the machine learning training and evaluation pipeline for SignFlow's multi-language sign recognition system, supporting:
1. **Pakistan Sign Language (PSL) Conversational Words** (12 classes)
2. **Pakistan Sign Language (PSL) Urdu Alphabets** (37 characters)
3. **American Sign Language (ASL) Digits & Letters** (36 classes)

---

## 📊 Datasets Overview

### 1. Pakistan Sign Language (PSL) Dataset
- **Source:** KaggleHub [`saadbutt321/pakistan-sign-language-dataset`](https://www.kaggle.com/datasets/saadbutt321/pakistan-sign-language-dataset)
- **Database:** SQLite `main_dataset.db` with OpenPose / MediaPipe 21 hand landmarks.
- **Suite A: PSL Conversational Words (`wordDataset`)**
  - **Samples:** 706 coordinate sequences across 12 conversational classes
  - **Vocabulary:** `EAT`, `GOOD`, `KNOW`, `LITTLE`, `ME`, `MY`, `NAME`, `PHONE`, `THANKS`, `WHAT`, `YOU`, `YOUR`
  - **Feature Dimension:** 63 coordinates normalized via wrist-centering and palm scaling
  - **Champion Model:** Support Vector Machine (Linear kernel)
  - **Test Accuracy:** **100.00%**
  - **Macro F1 Score:** **1.0000**
  - **Inference Latency:** ~665 microseconds per frame
  - **Model Artifact:** `cv-service/model/psl_words_classifier.joblib` & `psl_words_labels.json`

- **Suite B: PSL Urdu Alphabets (`rightHandDataset`)**
  - **Samples:** 5,112 coordinate sequences across 37 Urdu alphabets
  - **Vocabulary (37 Letters):**
    `ا`, `ب`, `پ`, `ت`, `ٹ`, `ث`, `ج`, `چ`, `ح`, `خ`, `د`, `ڈ`, `ذ`, `ر`, `ڑ`, `ز`, `ژ`, `س`, `ش`, `ص`, `ض`, `ط`, `ظ`, `ع`, `غ`, `ف`, `ق`, `ک`, `گ`, `ل`, `م`, `ن`, `و`, `ہ`, `ء`, `ی`, `ے`
  - **Phonetic Romanization:** Mapped in `lib/urduMapping.ts` for clean display (e.g. `ا (Alif)`) and SpeechSynthesis pronunciation
  - **Champion Model:** Random Forest (150 trees, max depth 22)
  - **Test Accuracy:** **98.44%**
  - **Top-3 Accuracy:** **99.48%**
  - **Macro F1 Score:** **0.9852**
  - **Inference Latency:** ~2.1 milliseconds per frame
  - **Model Artifact:** `cv-service/model/psl_alphabets_classifier.joblib` & `psl_alphabets_labels.json`

---

### 2. American Sign Language (ASL) Dataset
- **Source:** KaggleHub [`jeyasrisenthil/hand-signs-asl-hand-sign-data`](https://www.kaggle.com/datasets/jeyasrisenthil/hand-signs-asl-hand-sign-data)
- **Samples:** 413 landmark vectors across 36 classes (10 digits `0-9` and 26 letters `A-Z`)
- **Champion Model:** Multi-Layer Perceptron (MLP)
- **Top-3 Accuracy:** ~77.2%
- **Inference Latency:** ~1.2 milliseconds per frame
- **Model Artifact:** `cv-service/model/classifier.joblib` & `labels.json`

---

## 🛠️ Pipeline Architecture & Reproduction

### 1. Virtual Environment Setup
```powershell
cd cv-service
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m pip install kagglehub mediapipe pillow
```

### 2. Download PSL Dataset & Prepare Features
```powershell
.\.venv\Scripts\python -c "import kagglehub; path = kagglehub.dataset_download('saadbutt321/pakistan-sign-language-dataset'); print('PSL dataset path:', path)"
.\.venv\Scripts\python ml/prepare_psl.py
```

### 3. Train PSL Models Tournament
```powershell
.\.venv\Scripts\python ml/train_psl.py
```

### 4. Evaluate PSL Models
```powershell
.\.venv\Scripts\python ml/evaluate_psl.py
```

### 5. Run Backend Unit Tests
```powershell
.\.venv\Scripts\python -m pytest tests
```

---

## 🌐 WebSocket Multi-Model Routing Contract
The FastAPI backend dynamically routes incoming frames based on the client's requested language mode:
- `language: "psl_words"` -> Evaluates against the 12-class PSL conversational model.
- `language: "psl_alphabets"` -> Evaluates against the 37-class PSL Urdu alphabet model.
- `language: "asl"` -> Evaluates against the 36-class ASL model.
- Fallback defaults safely to `psl_words` if omitted.
