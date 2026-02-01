import { supabase } from "@/integrations/supabase/client";

export const semesterTeachersService = {
  async getAssignedTeacherIds(semesterId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("semester_teachers")
      .select("teacher_id")
      .eq("semester_id", semesterId);

    if (error) throw error;
    return (data ?? []).map(r => r.teacher_id);
  },

  async setTeachersForSemester(semesterId: string, teacherIds: string[]) {
    // remove old
    const del = await supabase
      .from("semester_teachers")
      .delete()
      .eq("semester_id", semesterId);

    if (del.error) throw del.error;

    // add new
    if (teacherIds.length === 0) return;

    const ins = await supabase.from("semester_teachers").insert(
      teacherIds.map(tid => ({ semester_id: semesterId, teacher_id: tid }))
    );

    if (ins.error) throw ins.error;
  },
};
