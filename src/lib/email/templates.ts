import type { EmployerNotificationType } from "@/lib/notifications";
import type { LocaleCode } from "@/lib/domain";

/**
 * Transactional templates in all four supported locales, German first.
 *
 * The payload type is the guarantee that no private candidate data can end
 * up in an e-mail: only the candidate CODE and the published occupation are
 * accepted here — no name, e-mail, phone, date of birth, document or
 * internal review note has a field to travel in.
 */
export interface NotificationEmailPayload {
  candidateCode: string;
  occupation: string | null;
  requestsUrl: string;
}

type Copy = {
  subject: (p: NotificationEmailPayload) => string;
  body: (p: NotificationEmailPayload) => string;
};

const statusWord: Record<
  LocaleCode,
  Record<EmployerNotificationType, string>
> = {
  de: {
    request_reviewing: "wird geprüft",
    request_approved: "wurde freigegeben",
    request_rejected: "wurde abgelehnt",
    request_introduced: "wurde vorgestellt",
  },
  en: {
    request_reviewing: "is being reviewed",
    request_approved: "has been approved",
    request_rejected: "has been declined",
    request_introduced: "has been introduced",
  },
  fr: {
    request_reviewing: "est en cours d'examen",
    request_approved: "a été validée",
    request_rejected: "a été refusée",
    request_introduced: "a été présentée",
  },
  ar: {
    request_reviewing: "قيد المراجعة",
    request_approved: "تمت الموافقة عليه",
    request_rejected: "تم رفضه",
    request_introduced: "تم التعارف",
  },
};

const explanation: Record<
  LocaleCode,
  Record<EmployerNotificationType, string>
> = {
  de: {
    request_reviewing: "NORAV prüft Ihre Anfrage und meldet sich mit dem Ergebnis.",
    request_approved:
      "NORAV stellt den Kontakt her und meldet sich mit den nächsten Schritten.",
    request_rejected:
      "Der Kandidat steht für diese Anfrage nicht zur Verfügung. Im Marktplatz finden Sie weitere Profile.",
    request_introduced:
      "NORAV hat den Kontakt hergestellt. Die weiteren Schritte stimmen wir direkt mit Ihnen ab.",
  },
  en: {
    request_reviewing: "NORAV is reviewing your request and will report back.",
    request_approved:
      "NORAV is arranging the introduction and will be in touch with the next steps.",
    request_rejected:
      "This candidate is not available for your request. You will find further profiles in the marketplace.",
    request_introduced:
      "NORAV has made the introduction. We will agree the next steps with you directly.",
  },
  fr: {
    request_reviewing: "NORAV examine votre demande et vous informera du résultat.",
    request_approved:
      "NORAV organise la mise en relation et vous contactera pour la suite.",
    request_rejected:
      "Ce candidat n'est pas disponible pour cette demande. D'autres profils vous attendent sur la place de marché.",
    request_introduced:
      "NORAV a établi le contact. Nous convenons des prochaines étapes directement avec vous.",
  },
  ar: {
    request_reviewing: "تراجع NORAV طلبك وستوافيك بالنتيجة.",
    request_approved: "تُرتّب NORAV التعارف وستتواصل معك بشأن الخطوات التالية.",
    request_rejected:
      "هذا المرشح غير متاح لهذا الطلب. تجد ملفات أخرى في السوق.",
    request_introduced:
      "أجرت NORAV التعارف. سنتفق معك مباشرةً على الخطوات التالية.",
  },
};

const frame: Record<
  LocaleCode,
  {
    subjectPrefix: string;
    request: string;
    candidate: string;
    occupation: string;
    link: string;
    greeting: string;
    signature: string;
  }
> = {
  de: {
    subjectPrefix: "NORAV – Ihre Anfrage zu",
    request: "Ihre Vorstellungsanfrage",
    candidate: "Kandidat",
    occupation: "Berufsziel",
    link: "Ihre Anfragen im Arbeitgeberbereich:",
    greeting: "Guten Tag,",
    signature: "Ihr NORAV-Team",
  },
  en: {
    subjectPrefix: "NORAV – your request for",
    request: "Your introduction request",
    candidate: "Candidate",
    occupation: "Target occupation",
    link: "Your requests in the employer portal:",
    greeting: "Hello,",
    signature: "Your NORAV team",
  },
  fr: {
    subjectPrefix: "NORAV – votre demande concernant",
    request: "Votre demande de présentation",
    candidate: "Candidat",
    occupation: "Objectif professionnel",
    link: "Vos demandes dans l'espace employeur :",
    greeting: "Bonjour,",
    signature: "Votre équipe NORAV",
  },
  ar: {
    subjectPrefix: "NORAV – طلبك بخصوص",
    request: "طلب التعارف الخاص بك",
    candidate: "المرشح",
    occupation: "الهدف المهني",
    link: "طلباتك في بوابة أصحاب العمل:",
    greeting: "مرحبًا،",
    signature: "فريق NORAV",
  },
};

export function notificationEmail(
  type: EmployerNotificationType,
  locale: LocaleCode,
  payload: NotificationEmailPayload
): { subject: string; text: string } {
  const f = frame[locale];
  const copy: Copy = {
    subject: (p) =>
      `${f.subjectPrefix} ${p.candidateCode} ${statusWord[locale][type]}`,
    body: (p) =>
      [
        f.greeting,
        "",
        `${f.request}: ${statusWord[locale][type]}.`,
        "",
        `${f.candidate}: ${p.candidateCode}`,
        p.occupation ? `${f.occupation}: ${p.occupation}` : null,
        "",
        explanation[locale][type],
        "",
        `${f.link} ${p.requestsUrl}`,
        "",
        f.signature,
      ]
        .filter((line) => line !== null)
        .join("\n"),
  };

  return { subject: copy.subject(payload), text: copy.body(payload) };
}
