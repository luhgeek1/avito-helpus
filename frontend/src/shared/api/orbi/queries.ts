import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { orbiJson } from "./http";
import {
  documentSchema, equipmentSchema, escalationSchema, meSchema, menteeDetailSchema, menteeSchema, nothingSchema,
  notificationsSchema, planItemSchema, planSchema, quizResultSchema, requestSchema, searchSchema,
} from "./schemas";
import { useSession } from "./session";

export const orbiKeys = {
  all: ["orbi"] as const,
  me: ["orbi", "me"] as const,
  plan: ["orbi", "plan"] as const,
  requests: ["orbi", "requests"] as const,
  request: (id: string) => ["orbi", "requests", id] as const,
  equipment: ["orbi", "equipment"] as const,
  escalations: (scope: "mine" | "assigned") => ["orbi", "escalations", scope] as const,
  mentees: ["orbi", "mentees"] as const,
  mentee: (id: string) => ["orbi", "mentees", id] as const,
  notifications: ["orbi", "notifications"] as const,
  search: (q: string) => ["orbi", "search", q] as const,
  document: (slug: string) => ["orbi", "documents", slug] as const,
};

export const meQuery = { queryKey: orbiKeys.me, queryFn: () => orbiJson("/me", meSchema) };

function useAuthed() {
  return useSession((state) => state.status === "authenticated");
}

export function useOrbiMe() {
  const enabled = useAuthed();
  return useQuery({ ...meQuery, enabled, staleTime: 5 * 60_000 });
}

export function usePermission(permission: string) {
  return useOrbiMe().data?.permissions.includes(permission) ?? false;
}

export function usePlan() {
  const enabled = useAuthed();
  return useQuery({ queryKey: orbiKeys.plan, queryFn: () => orbiJson("/plan", planSchema), enabled, staleTime: 15_000 });
}

export function useRequests() {
  const enabled = useAuthed();
  return useQuery({ queryKey: orbiKeys.requests, queryFn: () => orbiJson("/requests", z.array(requestSchema)), enabled, staleTime: 10_000 });
}

export function useEquipment() {
  const enabled = useAuthed();
  return useQuery({ queryKey: orbiKeys.equipment, queryFn: () => orbiJson("/equipment", equipmentSchema), enabled });
}

export function useEscalations(scope: "mine" | "assigned" = "mine") {
  const enabled = useAuthed();
  const query = scope === "assigned" ? "?scope=assigned" : "";
  return useQuery({
    queryKey: orbiKeys.escalations(scope), enabled, staleTime: 10_000,
    queryFn: () => orbiJson(`/escalations${query}`, z.array(escalationSchema)),
  });
}

export function useMentees(enabled = true) {
  const authed = useAuthed();
  return useQuery({ queryKey: orbiKeys.mentees, queryFn: () => orbiJson("/mentees", z.array(menteeSchema)), enabled: authed && enabled });
}

export function useMentee(id: string | undefined) {
  const authed = useAuthed();
  return useQuery({
    queryKey: orbiKeys.mentee(id ?? ""), enabled: authed && Boolean(id),
    queryFn: () => orbiJson(`/mentees/${encodeURIComponent(id ?? "")}`, menteeDetailSchema),
  });
}

export function useOrbiNotifications() {
  const enabled = useAuthed();
  return useQuery({ queryKey: orbiKeys.notifications, queryFn: () => orbiJson("/notifications", notificationsSchema), enabled });
}

export function useKnowledgeSearch(q: string) {
  const authed = useAuthed();
  return useQuery({
    queryKey: orbiKeys.search(q), enabled: authed && q.trim().length > 1,
    queryFn: () => orbiJson(`/knowledge/search?q=${encodeURIComponent(q)}&limit=5`, searchSchema),
  });
}

export function useKnowledgeDocument(slug: string | null) {
  const authed = useAuthed();
  return useQuery({
    queryKey: orbiKeys.document(slug ?? ""), enabled: authed && Boolean(slug), staleTime: 5 * 60_000,
    queryFn: () => orbiJson(`/knowledge/documents/${encodeURIComponent(slug ?? "")}`, documentSchema),
  });
}

/* ---------- mutations ---------- */

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: orbiKeys.all });
}

export function usePlanTransition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, transition, comment }: { id: string; transition: string; comment?: string }) =>
      orbiJson(`/plan/items/${id}/transitions`, planItemSchema, { method: "POST", json: { transition, comment } }),
    onSuccess: invalidate,
  });
}

export function useSubmitQuiz() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: number[] }) =>
      orbiJson(`/plan/items/${id}/quiz`, quizResultSchema, { method: "POST", json: { answers } }),
    onSuccess: (result) => { if (result.passed) void invalidate(); },
  });
}

export function useRequestAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "cancel" | "remind" }) =>
      orbiJson(`/requests/${id}/${action}`, requestSchema, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useAskMentor() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (question: string) => orbiJson("/escalations", escalationSchema, { method: "POST", json: { question } }),
    onSuccess: invalidate,
  });
}

export function useCloseEscalation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => orbiJson(`/escalations/${id}/close`, escalationSchema, { method: "POST" }),
    onSuccess: invalidate,
  });
}

export function useAnswerEscalation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, answer, publish }: { id: string; answer: string; publish: boolean }) =>
      orbiJson(`/escalations/${id}/answer`, escalationSchema, { method: "POST", json: { answer, publish_to_faq: publish } }),
    onSuccess: invalidate,
  });
}

export function useReviewItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ mentee, item, transition, comment }: { mentee: string; item: string; transition: string; comment?: string }) =>
      orbiJson(`/mentees/${mentee}/plan/items/${item}/review`, planItemSchema, { method: "POST", json: { transition, comment } }),
    onSuccess: invalidate,
  });
}

export function useReportConflict() {
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      orbiJson(`/knowledge/conflicts/${id}/report`, escalationSchema, { method: "POST", json: { note } }),
  });
}

export function useReadNotifications() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => orbiJson(id ? `/notifications/${id}/read` : "/notifications/read-all", nothingSchema, { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: orbiKeys.notifications }),
  });
}
