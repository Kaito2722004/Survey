import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "new_survey"
  | "survey_deadline_1h"
  | "survey_expired"
  | "survey_completed"
  | "survey_published";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  survey_id: string | null;
  title: string | null;
  message: string | null;
  read_at: string | null;
  created_at: string;
};

export const notificationsService = {
  async getUnread(userId: string) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .is("read_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as NotificationRow[];
  },

  async markAsRead(id: string, userId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  },

  async markAllAsRead(userId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) throw error;
  },

  async create(payload: {
    user_id: string;
    type: NotificationType;
    survey_id?: string | null;
    title?: string | null;
    message?: string | null;
  }) {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: payload.user_id,
        type: payload.type,
        survey_id: payload.survey_id ?? null,
        title: payload.title ?? null,
        message: payload.message ?? null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as NotificationRow;
  },

  /** Check if a notification already exists for (user, survey, type) - any, or unread only */
  async existsForSurvey(
    userId: string,
    surveyId: string,
    type: NotificationType,
    unreadOnly = false
  ): Promise<boolean> {
    let q = supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("survey_id", surveyId)
      .eq("type", type)
      .limit(1);
    if (unreadOnly) q = q.is("read_at", null);
    const { data, error } = await q;
    if (error) return false;
    return (data?.length ?? 0) > 0;
  },

  /**
   * Create notifications for the current student:
   * - new_survey for each visible, non-expired survey (if not already notified)
   * - survey_deadline_1h for each survey with deadline in the next hour
   */
  async ensureStudentNotifications(
    userId: string,
    surveys: { id: string; title: string; deadline: string | null }[]
  ): Promise<void> {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    for (const survey of surveys) {
      const deadline = survey.deadline ? new Date(survey.deadline) : null;
      const isExpired = deadline ? deadline < now : false;
      const dueInOneHour =
        deadline && deadline > now && deadline <= oneHourFromNow;

      if (!isExpired) {
        const exists = await this.existsForSurvey(userId, survey.id, "new_survey");
        if (!exists) {
          await this.create({
            user_id: userId,
            type: "new_survey",
            survey_id: survey.id,
            title: "New survey",
            message: `"${survey.title}" is available to take.`,
          });
        }
      }

      if (dueInOneHour) {
        const exists = await this.existsForSurvey(
          userId,
          survey.id,
          "survey_deadline_1h"
        );
        if (!exists) {
          await this.create({
            user_id: userId,
            type: "survey_deadline_1h",
            survey_id: survey.id,
            title: "Deadline soon",
            message: `"${survey.title}" closes soon.`,
          });
        }
      }

      if (isExpired) {
        const exists = await this.existsForSurvey(
          userId,
          survey.id,
          "survey_expired"
        );
        if (!exists) {
          await this.create({
            user_id: userId,
            type: "survey_expired",
            survey_id: survey.id,
            title: "Survey expired",
            message: `"${survey.title}" has expired and can't be taken.`,
          });
        }
      }
    }
  },

  /**
   * Create survey_completed notifications for the admin for each of their surveys
   * that have passed the deadline (if not already notified).
   */
  async ensureAdminNotifications(
    userId: string,
    surveys: { id: string; title: string; deadline: string | null }[]
  ): Promise<void> {
    const now = new Date();

    for (const survey of surveys) {
      if (!survey.deadline) continue;
      if (new Date(survey.deadline) >= now) continue;

      const exists = await this.existsForSurvey(
        userId,
        survey.id,
        "survey_completed"
      );
      if (!exists) {
        await this.create({
          user_id: userId,
          type: "survey_completed",
          survey_id: survey.id,
          title: "Survey completed",
          message: `"${survey.title}" has passed its deadline.`,
        });
      }
    }
  },
};
