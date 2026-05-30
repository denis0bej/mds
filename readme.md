# 🐉 D&D Vibe Coding Project — AI Dungeon Master & Story Weaver test

> Acest README este destinat **LLM-urilor** (sau dezvoltatorilor care doresc să re-genereze/înțeleagă prompt-urile și structura proiectului).  
> Scopul său: **uniformizarea interacțiunii cu AI-urile** în cadrul proiectului nostru de tip *Dungeons & Dragons*, fără a rescrie de fiecare dată același context.

---

## 📌 Sumar proiect

Platformă web **Dungeons & Dragons** care folosește **doi agenți AI** pentru a genera povești dinamice, hărți de tip graf și răspunsuri la acțiunile jucătorului.

### Flux principal

1. **Crearea caracterului** – utilizatorul își definește personajul (atribute, clasă, rasă, etc.)
2. **Povestea inițială** – utilizatorul scrie un scurt text (puntea poveștii) → trimis la LLM-1 pentru a genera o introducere epică.
3. **Generarea hărții (graf)** – LLM-2 creează o hartă sub formă de **noduri (evenimente/locații)** și **muchii (tranziții posibile)**.
4. **Explorare interactivă**:
   - Caseta LLM → descrie ce observă / simte / se întâmplă
   - Caseta utilizator → ce dorește să facă
   - Anumite acțiuni necesită **roll d20** (rezultatul influențează succesul/eșecul)
5. **Rezumat final** – la încheierea aventurii, se generează automat un rezumat al poveștii.

---

## 🤖 Cei doi agenți AI

| Agent | Rol | Input tipic | Output |
|-------|-----|--------------|--------|
| **LLM-1 (Story Weaver)** | Generează introducerea poveștii pe baza descrierii sumare a utilizatorului | Descrierea jucătorului (text scurt) | Text narativ amplu, ton D&D |
| **LLM-2 (Dungeon Master)** | Gestionează explorarea, descrierile de moment, reacțiile la acțiuni, rezumatul final | Context: caracter + istoric acțiuni + acțiunea dorită (+ rezultat d20 dacă e cazul) | Descrierea situației noi + eventuale consecințe |

> ⚠️ **Dacă folosești un singur LLM** – poți folosi același model, dar cu **prompt-uri diferite** (separate clar prin rol/system message).

---

## 🎲 Reguli pentru D20

- **Acțiuni care necesită D20**: atacuri, salvări, îndemânare critică (dexteritate, persuasiune în situații tensionate, etc.)
- **Rezultat**:
  - `1` → eșec critic (consecințe grave, adesea comice/disastroase)
  - `2-9` → eșec
  - `10-14` → succes parțial
  - `15-19` → succes complet
  - `20` → succes critic (efecte extra pozitive)

LLM-2 primește rezultatul zarului și **descrie rezultatul** acțiunii.

---

## 🗺️ Formatul hărții (graf)

Generată de LLM-2 la începutul aventurii (sau dinamic). Exemplu JSON:

```json
{
  "nodes": [
    { "id": 1, "name": "Poarta de Vest", "description": "Intrare în temniță" },
    { "id": 2, "name": "Sala Tronului", "description": "Gol și răsunător" }
  ],
  "edges": [
    { "from": 1, "to": 2, "condition": "Trebuie să deschizi poarta cu cheia" }
  ]
}
