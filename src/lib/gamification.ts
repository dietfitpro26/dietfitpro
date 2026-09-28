/**
 * src/lib/gamification.ts
 *
 * Moteur de gamification DietFitPro : auto-évaluations hebdomadaires,
 * badges Nutrition/Sport, niveau global, messages motivants.
 *
 * Règle d'attribution des badges :
 * - respecte_100 et respecte_80 comptent comme une semaine "réussie".
 * - respecte_50 et non_respecte ne comptent PAS pour les badges,
 *   mais restent enregistrés pour le suivi et les messages d'encouragement.
 */

export type CheckinStatus = 'respecte_100' | 'respecte_80' | 'respecte_50' | 'non_respecte';
export type BadgeCategory = 'nutrition' | 'sport';

export interface WeeklyCheckin {
  weekStartDate: string;
  nutritionStatus: CheckinStatus | null;
  sportStatus: CheckinStatus | null;
}

export interface Badge {
  id: string;
  category: BadgeCategory;
  code: string;
  label: string;
  threshold: number;
  points: number;
}

export interface EarnedBadge extends Badge {
  earnedAt: string;
}

/** Une semaine "compte" pour les badges si le statut est respecte_100 ou respecte_80. */
export function countsForBadge(status: CheckinStatus | null): boolean {
  return status === 'respecte_100' || status === 'respecte_80';
}

/** Compte le nombre de semaines "réussies" (>= 80%) pour une catégorie donnée. */
export function countSuccessfulWeeks(
  checkins: WeeklyCheckin[],
  category: BadgeCategory,
): number {
  return checkins.filter((c) =>
    countsForBadge(category === 'nutrition' ? c.nutritionStatus : c.sportStatus),
  ).length;
}

/**
 * Détermine quels badges d'une catégorie sont débloqués à partir du nombre
 * de semaines réussies (nutrition) ou de séances complétées (sport).
 */
export function getUnlockedBadges(
  allBadges: Badge[],
  category: BadgeCategory,
  successCount: number,
): Badge[] {
  return allBadges
    .filter((b) => b.category === category && b.threshold <= successCount)
    .sort((a, b) => a.threshold - b.threshold);
}

/** Trouve le prochain badge à débloquer (le plus proche non encore atteint). */
export function getNextBadge(
  allBadges: Badge[],
  category: BadgeCategory,
  successCount: number,
): Badge | null {
  const upcoming = allBadges
    .filter((b) => b.category === category && b.threshold > successCount)
    .sort((a, b) => a.threshold - b.threshold);

  return upcoming[0] ?? null;
}

/** Calcule le niveau global à partir du total de points cumulés (tous badges obtenus). */
export function calculateLevel(totalPoints: number): { level: number; pointsToNextLevel: number; pointsInCurrentLevel: number } {
  const POINTS_PER_LEVEL = 100;
  const level = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
  const pointsInCurrentLevel = totalPoints % POINTS_PER_LEVEL;
  const pointsToNextLevel = POINTS_PER_LEVEL - pointsInCurrentLevel;

  return { level, pointsToNextLevel, pointsInCurrentLevel };
}

/**
 * Messages motivants selon le statut déclaré, jamais culpabilisants.
 * Un message est choisi au hasard parmi la liste pour varier les retours.
 */
const MESSAGES: Record<'nutrition' | 'sport', Record<CheckinStatus, string[]>> = {
  nutrition: {
    respecte_100: [
      "Bravo, semaine parfaite côté nutrition 🎉 Continue, tu es sur la bonne voie !",
      "100% respecté cette semaine, félicitations 💪 Ton corps te remercie !",
      "Semaine au top ! Cette régularité, c'est ce qui fait la vraie différence sur la durée 🌟",
    ],
    respecte_80: [
      "Très belle semaine, presque parfaite 👏 Encore un petit effort et tu passes au 100% !",
      "80% de respect cette semaine, c'est du sérieux ! Bien joué 💚",
      "Tu es sur une excellente dynamique, continue comme ça 🙌",
    ],
    respecte_50: [
      "Semaine à moitié réussie, c'est déjà quelque chose ! On resserre un peu la semaine prochaine ? 🌱",
      "Pas mal du tout, tu gardes le fil. On vise un peu plus haut la semaine prochaine 💪",
      "Chaque effort compte, même partiel. La prochaine semaine est une nouvelle chance 😊",
    ],
    non_respecte: [
      "Une semaine plus compliquée arrive à tout le monde, aucun souci 🌿 La semaine prochaine repart à zéro.",
      "Pas de jugement ici — l'important c'est de repartir. On y retourne ensemble la semaine prochaine 😊",
      "Ça arrive, et ce n'est pas grave du tout. Ce qui compte, c'est de continuer à essayer 💚",
    ],
  },
  sport: {
    respecte_100: [
      "Séances 100% respectées, tu es une vraie machine 🔥 Continue sur cette lancée !",
      "Semaine sportive parfaite ! Ton corps progresse à chaque séance 💪",
      "Bravo pour cette régularité sportive, c'est exactement ce qu'il faut 🏆",
    ],
    respecte_80: [
      "Très bonne semaine sportive, tu y es presque 👏 Encore un petit push !",
      "80% de tes séances faites, franchement bien joué 💚",
      "Belle discipline cette semaine, continue à ce rythme 🙌",
    ],
    respecte_50: [
      "Moitié des séances faites, c'est un bon début ! On essaie d'en caler une ou deux de plus la semaine prochaine ? 🌱",
      "Chaque séance compte, même si la semaine a été partielle. On repart motivé 💪",
      "Pas mal, on garde le cap et on vise un peu plus la semaine prochaine 😊",
    ],
    non_respecte: [
      "Pas de séance cette semaine, ce n'est pas grave — le sport reste là quand tu es prêt(e) à reprendre 🌿",
      "Aucun jugement, la vie est parfois chargée. On se retrouve la semaine prochaine pour repartir 😊",
      "Ça arrive à tout le monde d'avoir une semaine sans sport. L'essentiel, c'est de ne pas lâcher sur la durée 💚",
    ],
  },
};

/** Message de rappel doux si l'utilisateur n'a pas encore rempli son auto-évaluation. */
const REMINDER_MESSAGES = [
  "Coucou 👋 On n'a pas encore ton retour de la semaine — 30 secondes pour nous dire comment ça va ?",
  "Petit rappel amical : ton auto-évaluation de la semaine t'attend, sans pression 😊",
  "On aimerait avoir de tes nouvelles cette semaine — juste 2 questions rapides, quand tu veux 🌿",
];

function pickRandom(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function getMotivationalMessage(
  category: 'nutrition' | 'sport',
  status: CheckinStatus,
): string {
  return pickRandom(MESSAGES[category][status]);
}

export function getReminderMessage(): string {
  return pickRandom(REMINDER_MESSAGES);
}

/** Calcule le lundi de la semaine en cours (format ISO yyyy-mm-dd), pour identifier week_start_date. */
export function getCurrentWeekStartDate(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}