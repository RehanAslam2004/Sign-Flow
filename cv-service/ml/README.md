# SignFlow — Machine Learning Pipeline & Multi-Language Model Integration

This directory contains the machine learning training and evaluation pipeline for SignFlow's multi-language sign recognition system, supporting 4 distinct model suites:
1. **Pakistan Sign Language (PSL) Extended** (89 classes — Greetings, Questions, Phrases, Vocabulary)
2. **Pakistan Sign Language (PSL) Conversational Words** (12 classes)
3. **Pakistan Sign Language (PSL) Urdu Alphabets** (37 characters)
4. **American Sign Language (ASL) Digits & Letters** (36 classes)

---

## 📊 Datasets Overview

### 1. Pakistan Sign Language (PSL) Extended Dataset (89 Classes)
- **Source:** Hugging Face [`Bakhtyar12/Pakistani-Sign-Language`](https://huggingface.co/datasets/Bakhtyar12/Pakistani-Sign-Language)
- **Sequences:** 4,464 `.npy` files across 89 gesture categories.
- **Extracted Vectors:** 22,320 canonical 63-dimensional landmark feature vectors.
- **Scope:**
  - **Conversational Greetings & Courtesies:** `Assalamulaikum`, `Walaikumasalam`, `Barai Mehrbani` (Please), `G Han` (Yes), `Nahi hai` (No).
  - **Questions:** `Kab` (When), `Kesay` (How), `Kya qeemat hai` (What is the price?).
  - **Urdu Alphabets:** 36+ alphabet hand signs (`Alif`, `Bay`, `Chay`, `Dal`, etc.).
  - **Common Vocabulary:** Pronouns (`Ap`, `Mujhay`, `Ye`), actions (`Jao`, `Seekh raha hun`), objects (`Email Address`, `Shirt dhona hai`), fruits and animals (`APPLE`, `Cherry`, `Duck`, `Eagle`, etc.), and cultural entities (`Allah`, `Allama Iqbal`, `Muhammad Ali Jinnah`).
- **Champion Model:** Random Forest (150 trees, max depth 25)
- **Test Accuracy:** **98.90%**
- **Top-3 Accuracy:** **99.75%**
- **Top-5 Accuracy:** **99.84%**
- **Macro F1 Score:** **0.9890**
- **Model Artifact:** `cv-service/model/psl_extended_classifier.joblib` & `psl_extended_labels.json`

---

### 2. Pakistan Sign Language (PSL) Focused Datasets
- **Source:** KaggleHub [`saadbutt321/pakistan-sign-language-dataset`](https://www.kaggle.com/datasets/saadbutt321/pakistan-sign-language-dataset)
- **Suite A: PSL Conversational Words (`wordDataset`, 12 classes)**
  - **Vocabulary:** `EAT`, `GOOD`, `KNOW`, `LITTLE`, `ME`, `MY`, `NAME`, `PHONE`, `THANKS`, `WHAT`, `YOU`, `YOUR`
  - **Champion Model:** Support Vector Machine (Linear kernel)
  - **Test Accuracy:** **100.00%**
  - **Macro F1 Score:** **1.0000**
  - **Model Artifact:** `cv-service/model/psl_words_classifier.joblib` & `psl_words_labels.json`
- **Suite B: PSL Urdu Alphabets (`rightHandDataset`, 37 classes)**
  - **Vocabulary:** 37 clean Urdu alphabet characters (`ا` through `ے`)
  - **Champion Model:** Random Forest (150 trees)
  - **Test Accuracy:** **98.44%**
  - **Top-3 Accuracy:** **99.48%**
  - **Model Artifact:** `cv-service/model/psl_alphabets_classifier.joblib` & `psl_alphabets_labels.json`

---

### 3. American Sign Language (ASL) Dataset
- **Source:** KaggleHub [`jeyasrisenthil/hand-signs-asl-hand-sign-data`](https://www.kaggle.com/datasets/jeyasrisenthil/hand-signs-asl-hand-sign-data)
- **Samples:** 413 landmark vectors across 36 classes (10 digits `0-9` and 26 letters `A-Z`)
- **Champion Model:** Multi-Layer Perceptron (MLP)
- **Model Artifact:** `cv-service/model/classifier.joblib` & `labels.json`

---

## 🛠️ Pipeline Reproduction Commands

### 1. Extract 89-Class Extended PSL Features
```powershell
cd cv-service
.\.venv\Scripts\python ml/prepare_hf_psl.py
```

### 2. Run Tournament on 89 Classes
```powershell
.\.venv\Scripts\python ml/train_hf_psl.py
```

### 3. Evaluate Champion Model
```powershell
.\.venv\Scripts\python ml/evaluate_hf_psl.py
```

### 4. Run Backend Tests
```powershell
.\.venv\Scripts\python -m pytest tests
```
