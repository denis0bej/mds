# Arhitectura Sistemului & Workflow-uri — MDS

Acest document descrie arhitectura tehnică, fluxurile de date și interacțiunile dintre agenții AI pentru proiectul **D&D — AI Game Master**.

---

## 1. Arhitectura de Sistem (Diagramă de Componente)

Sistemul urmează o arhitectură **Client-Server** decuplată, utilizând servicii cloud pentru persistență și inteligență artificială.

```mermaid
graph TD
    subgraph "Frontend (React + Vite)"
        UI[Interfață Utilizator / Shadcn UI]
        GC[Contextul Jocului / GameContext]
        API_C[Client API / Fetch]
    end

    subgraph "Backend (FastAPI)"
        RE[Rules Engine - Python]
        RA[Routere API]
        WA[Agent: World Architect]
        DM[Agent: Dungeon Master]
        AC[Agent: Adventure Critic]
    end

    subgraph "External Services"
        SB[(Supabase / PostgreSQL)]
        OA[OpenAI API / GPT-4o]
    end

    UI <--> GC
    GC <--> API_C
    API_C <--> RA
    RA <--> WA
    RA <--> DM
    RA <--> RE
    WA <--> OA
    DM <--> OA
    AC <--> OA
    RA <--> SB
```

---

## 2. Workflow: Generare Aventură (Multi-Agent Streaming)

Procesul de generare a unei aventuri noi folosește un flux de tip **pipeline streaming**, unde mai mulți agenți colaborează pentru a asigura calitatea și echilibrul (balance) mecanic.

```mermaid
sequenceDiagram
    participant P as Player (Frontend)
    participant B as Backend (FastAPI)
    participant WA as World Architect (Agent)
    participant AC as Adventure Critic (Agent)
    participant OA as OpenAI (GPT-4o)

    P->>B: POST /adventure/generate-stream (Description)
    B-->>P: SSE: "Initializing generation..."
    
    B->>WA: Draft Initial Map
    WA->>OA: Request Draft JSON
    OA-->>WA: Return Map JSON
    B-->>P: SSE: "World Architect is drafting the map..."
    
    B->>AC: Critique Draft
    AC->>OA: Evaluate Balance & Logic
    OA-->>AC: Return Feedback (JSON)
    B-->>P: SSE: "Senior Designer is critiquing..."
    
    alt Needs Revision
        B->>WA: Refine Map with Feedback
        WA->>OA: Request Corrected JSON
        OA-->>WA: Return Final Map JSON
        B-->>P: SSE: "Refining the adventure..."
    else Solid Draft
        B-->>P: SSE: "Adventure is solid. Polishing..."
    end
    
    B-->>P: SSE: COMPLETE (Final Payload)
    P->>P: Navigate to /game
```

---

## 3. Workflow: Rezoluție Acțiune Jucător (Game Loop)

Fiecare acțiune a jucătorului este procesată printr-un sistem de clasificare pentru a determina dacă necesită un test de abilitate (dice roll) sau este o simplă interacțiune narativă.

```mermaid
flowchart TD
    Start([Input Jucător]) --> Classify{Clasificare DM}
    
    Classify -- "Question" --> Narrate[Răspuns Narativ DM]
    Classify -- "Simple Action" --> UpdateState[Aplică Schimbări de Stare]
    Classify -- "Complex Action" --> RollReq[Solicitare Roll d20]
    
    UpdateState --> Narrate
    
    RollReq --> RE[Rules Engine: roll_d20]
    RE --> Result{Rezultat vs DC}
    
    Result -- "Success" --> NarrateSuccess[Narațiune Succes + Rewards]
    Result -- "Failure" --> NarrateFail[Narațiune Eșec + Consequences]
    
    NarrateSuccess --> End([Final Turn])
    NarrateFail --> End
    Narrate --> End
```

---

## 4. Modelul de Date (ER Diagram)

Persistența datelor este gestionată prin Supabase (PostgreSQL), cu un accent pe salvarea progresului și a stării complexe a hărții în format JSONB.

```mermaid
erDiagram
    USERS {
        uuid id PK
        string email
        string username
        string password_hash
        timestamp created_at
    }
    
    GAME_SAVES {
        uuid id PK
        uuid user_id FK
        string character_name
        jsonb character "Class, Stats, Bio"
        jsonb save_data "Current Node, Map State, Inventory, Flags"
        boolean is_active
        timestamp updated_at
    }
    
    USERS ||--o{ GAME_SAVES : "has"
```

---

## 5. Tehnologii Utilizate

*   **Frontend:** React 18, TypeScript, Vite, Tailwind CSS (Styling), Framer Motion (Animații), Lucide (Iconițe).
*   **Backend:** Python 3.12, FastAPI (Framework Web), Pydantic (Validare date).
*   **AI:** OpenAI SDK (Model: `gpt-4o`).
*   **Baza de date:** Supabase (Auth, RLS, PostgreSQL).
