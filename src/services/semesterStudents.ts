import { supabase } from "@/integrations/supabase/client";

export type SemesterStudentRow = {
  id: string;
  semester_id: string;
  student_user_id: string;
  created_at: string;
};

export const semesterStudentsService = {
  async getByStudent(studentUserId: string) {
    // student should be in ONLY one semester (your requirement)
    const { data, error } = await supabase
      .from("semester_students")
      .select("*")
      .eq("student_user_id", studentUserId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return data as SemesterStudentRow | null;
  },

  async getBySemester(semesterId: string) {
    const { data, error } = await supabase
      .from("semester_students")
      .select("*")
      .eq("semester_id", semesterId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as SemesterStudentRow[];
  },

  async upsertStudentSemester(semester_id: string, student_user_id: string) {
    // If you enforce UNIQUE(student_user_id) in DB, this is perfect.
    const { data, error } = await supabase
      .from("semester_students")
      .upsert({ semester_id, student_user_id }, { onConflict: "student_user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return data as SemesterStudentRow;
  },
};
