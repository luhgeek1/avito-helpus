import { z } from "zod";

const id = z.string();
const nullableString = z.string().nullable();

export const personRefSchema = z.object({ id, full_name: z.string(), title: z.string(), email: z.string() });
export const teamSchema = z.object({ id, slug: z.string(), name: z.string(), channel: z.string() });
export const roleSchema = z.enum(["intern", "mentor", "lead", "hrbp", "admin"]);

export const personSchema = z.object({
  id, email: z.string(), full_name: z.string(), title: z.string(), role: roleSchema, role_title: z.string(),
  track: z.string(), start_date: nullableString, team: teamSchema.nullable(),
  mentor: personRefSchema.nullable(), lead: personRefSchema.nullable(), hrbp: personRefSchema.nullable(),
});

export const meSchema = personSchema.extend({
  internship_day: z.number().nullable(),
  permissions: z.array(z.string()),
  flags: z.record(z.string(), z.object({ key: z.string(), enabled: z.boolean(), variant: nullableString })),
  assistant_mode: z.string(),
});

export const tokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });

export const itemStatusSchema = z.enum(["todo", "in_progress", "waiting", "blocked", "done"]);
export const planActionSchema = z.object({
  kind: z.enum(["access_request", "absence_request", "equipment", "ask_mentor"]),
  resource: z.string().optional(),
});

export const planItemSchema = z.object({
  id, slug: z.string(), stage: z.string(), title: z.string(), description: z.string(), category: z.string(),
  audience: z.enum(["intern", "mentor"]), confirmation: z.enum(["self", "quiz", "mentor"]),
  action: planActionSchema.nullable(),
  quiz: z.array(z.object({ question: z.string(), options: z.array(z.string()) })),
  doc_slugs: z.array(z.string()), needs_laptop: z.boolean(), status: itemStatusSchema,
  due_date: z.string(), overdue: z.boolean(), started_at: nullableString, completed_at: nullableString,
  waiting_reason: nullableString, blocked_reason: nullableString, review_comment: nullableString,
  request_id: nullableString,
});

export const planSchema = z.object({
  start_date: z.string(), today: z.string(), current_stage: z.string(), current_stage_title: z.string(),
  total: z.number(), done: z.number(), overdue: z.number(), percent: z.number(),
  next_steps: z.array(planItemSchema),
  stages: z.array(z.object({
    stage: z.string(), title: z.string(), due_date: z.string(), total: z.number(), done: z.number(),
    percent: z.number(), items: z.array(planItemSchema),
  })),
});

export const quizResultSchema = z.object({ passed: z.boolean(), wrong: z.array(z.number()), item: planItemSchema });

export const requestStatusSchema = z.enum(["submitting", "submitted", "approved", "rejected", "failed", "cancelled"]);
export const requestSchema = z.object({
  id, kind: z.string(), status: requestStatusSchema, status_title: z.string(), title: z.string(),
  external_id: nullableString, payload: z.record(z.string(), z.unknown()), approver: nullableString,
  decision_comment: nullableString, plan_item_id: nullableString, sla_due_at: nullableString,
  created_at: z.string(), updated_at: z.string(),
  history: z.array(z.object({ status: requestStatusSchema, source: z.string(), note: nullableString, created_at: z.string() })),
});

export const equipmentSchema = z.object({
  items: z.array(z.object({
    kind: z.string(), model: z.string(), status: z.string(), status_title: z.string(), eta: nullableString,
    pickup_location: nullableString, pickup_hours: nullableString, note: nullableString,
  })),
  meanwhile: z.array(z.object({ id, title: z.string(), due_date: z.string() })),
  ticket: requestSchema.nullable(),
});

export const escalationSchema = z.object({
  id, user_id: id, user_name: z.string(), assignee_id: id, assignee_name: z.string(),
  level: z.string(), kind: z.string(), status: z.string(), question: z.string(),
  context: z.record(z.string(), z.unknown()), answer: nullableString, answered_by_name: nullableString,
  answered_at: nullableString, due_at: z.string(), faq_document_slug: nullableString, created_at: z.string(),
});

export const menteeSchema = z.object({
  person: personSchema, internship_day: z.number().nullable(), stage_title: z.string(), percent: z.number(),
  done: z.number(), total: z.number(), overdue: z.number(), blocked: z.array(planItemSchema),
  awaiting_review: z.array(planItemSchema), mentor_tasks: z.array(planItemSchema),
  open_requests: z.number(), open_questions: z.number(), needs_attention: z.boolean(),
});

export const menteeDetailSchema = z.object({
  summary: menteeSchema, plan: planSchema, requests: z.array(requestSchema), questions: z.array(escalationSchema),
});

export const notificationSchema = z.object({
  id, kind: z.string(), title: z.string(), body: z.string(), link: nullableString,
  payload: z.record(z.string(), z.unknown()), read_at: nullableString, created_at: z.string(),
});
export const notificationsSchema = z.object({ unread: z.number(), items: z.array(notificationSchema) });

export const sourceSchema = z.object({
  document_slug: z.string(), document_title: z.string(), heading: z.string(), content: z.string(),
  scope: z.string(), team_name: nullableString, source_label: z.string(), source_url: nullableString,
  updated_at: z.string(), stale: z.boolean(),
});
export const searchSchema = z.object({
  query: z.string(), mode: z.string(), sources: z.array(sourceSchema),
  conflicts: z.array(z.object({ id, topic: z.string(), summary: z.string(), company: sourceSchema, team: sourceSchema })),
});

export const documentSchema = z.object({
  slug: z.string(), title: z.string(), kind: z.string(), scope: z.string(), team_name: nullableString, owner: z.string(),
  source_label: z.string(), source_url: nullableString, updated_at: z.string(), body: z.string(),
});

export const conversationSchema = z.object({ id, title: z.string(), created_at: z.string(), updated_at: z.string() });
export const chatPartSchema = z.object({ type: z.string() }).catchall(z.unknown());
export const historySchema = z.object({
  conversation: conversationSchema,
  messages: z.array(z.object({
    id, role: z.string(), parts: z.array(chatPartSchema), feedback: nullableString, created_at: z.string(),
  })),
});

export const assistantStatusSchema = z.object({ mode: z.string(), model: nullableString, embeddings: z.boolean() });
export const nothingSchema = z.unknown();

export type Me = z.infer<typeof meSchema>;
export type OrbiPerson = z.infer<typeof personSchema>;
export type Plan = z.infer<typeof planSchema>;
export type PlanItem = z.infer<typeof planItemSchema>;
export type PlanAction = z.infer<typeof planActionSchema>;
export type ItemStatus = z.infer<typeof itemStatusSchema>;
export type QuizResult = z.infer<typeof quizResultSchema>;
export type ServiceRequest = z.infer<typeof requestSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type Escalation = z.infer<typeof escalationSchema>;
export type Mentee = z.infer<typeof menteeSchema>;
export type MenteeDetail = z.infer<typeof menteeDetailSchema>;
export type OrbiNotification = z.infer<typeof notificationSchema>;
export type Notifications = z.infer<typeof notificationsSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type History = z.infer<typeof historySchema>;
export type ChatPart = z.infer<typeof chatPartSchema>;
export type KnowledgeSearch = z.infer<typeof searchSchema>;
export type KnowledgeDocument = z.infer<typeof documentSchema>;
