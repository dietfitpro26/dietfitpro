/**
 * Abstraction IA Coach pour DietFitPro
 *
 * Basée sur VITE_AI_PROVIDER :
 * - "ollama"  → appel local Ollama (développement / offline)
 * - "openai"  → appel API OpenAI (production)
 *
 * Détection automatique de mots-clés médicaux critiques
 * + système d'escalade vers un professionnel.
 */

export type AiProvider = "ollama" | "openai";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AiCoachResponse {
  text: string;
  escalated: boolean; // true si un mot-clé médical critique a été détecté
  escalationReason?: string;
}

// Mots-clés médicaux qui déclenchent une escalade obligatoire
const MEDICAL_ESCALATION_KEYWORDS: string[] = [
  "suicide", "suicidaire", "mourir", "me tuer", "me faire du mal",
  "anorexie", "anorexique", "boulimie", "hyperphagie",
  "crise cardiaque", "infarctus", "diabète", "insuline",
  "allergie sévère", "choc anaphylactique",
  "trouble alimentaire", "TCA", "dénutrition",
];

function getProvider(): AiProvider {
  const raw = import.meta.env.VITE_AI_PROVIDER;
  if (raw === "openai") return "openai";
  return "ollama";
}

function detectMedicalEscalation(text: string): { escalated: boolean; reason?: string } {
  const lower = text.toLowerCase();
  for (const keyword of MEDICAL_ESCALATION_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return {
        escalated: true,
        reason: `Mot-clé médical détecté : "${keyword}". Un professionnel de santé doit être consulté.`,
      };
    }
  }
  return { escalated: false };
}

/**
 * Appelle le modèle configuré et retourne la réponse.
 */
export async function askAiCoach(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<AiCoachResponse> {
  const provider = getProvider();
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();

  // 1. Vérification sécurité médicale
  const escalation = lastUserMessage
    ? detectMedicalEscalation(lastUserMessage.content)
    : { escalated: false };

  if (escalation.escalated) {
    return {
      text:
        "🚨 **Alerte bien-être**\n\n" +
        "J'ai détecté des termes qui nécessitent l'intervention d'un professionnel de santé. " +
        "Je ne peux pas répondre à cette question.\n\n" +
        "**Que faire ?**\n" +
        "- Contactez immédiatement un médecin ou un nutritionniste-diététicien inscrit à l'ordre.\n" +
        "- En cas de détresse urgente : appelez le **15 (SAMU)** ou le **3114** (suicide écoute).\n\n" +
        "Votre sécurité est notre priorité.",
      escalated: true,
      escalationReason: escalation.reason,
    };
  }

  // 2. Appel au provider
  let text: string;
  if (provider === "openai") {
    text = await callOpenAI(messages, options);
  } else {
    text = await callOllama(messages, options);
  }

  return { text, escalated: false };
}

async function callOpenAI(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[AI Coach] Clé OpenAI manquante. Vérifiez VITE_OPENAI_API_KEY dans votre .env"
    );
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 512,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[OpenAI] Erreur ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callOllama(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const baseUrl = import.meta.env.VITE_OLLAMA_BASE_URL ?? "http://localhost:11434";
  const model = import.meta.env.VITE_OLLAMA_MODEL ?? "llama3.2";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 512,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `[Ollama] Erreur ${res.status}: ${err}\n` +
        `→ Vérifiez qu'Ollama est lancé : ollama run ${model}\n` +
        `→ URL configurée : ${baseUrl}`
    );
  }

  const data = await res.json();
  return data.message?.content ?? "";
}

/**
 * Message système par défaut pour le coach IA.
 */
export function getSystemPrompt(language: "fr" | "en" = "fr"): ChatMessage {
  const content =
    language === "fr"
      ? `Tu es le Coach IA de DietFitPro, une application de nutrition et de suivi sportif.
Règles :
1. Tu donnes des conseils nutritionnels et sportifs génériques, jamais de prescriptions médicales.
2. Tu restes bienveillant, concise et actionnable.
3. Tu adaptes tes réponses au profil de l'utilisateur (objectifs, restrictions, préférences).
4. Tu refuses poliment toute demande de diagnostic médical ou de prescription de médicaments.
5. Tu encadres tes conseils par des avertissements quand nécessaire (« consultez un professionnel de santé »).`
      : `You are the AI Coach of DietFitPro, a nutrition and fitness tracking app.
Rules:
1. Provide generic nutrition and fitness advice only — never medical prescriptions.
2. Be kind, concise, and actionable.
3. Adapt answers to the user's profile (goals, restrictions, preferences).
4. Politely decline any request for medical diagnosis or medication prescriptions.
5. Frame advice with appropriate disclaimers when needed (« consult a healthcare professional »).`;

  return { role: "system", content };
}
