-- ============================================================
-- SUPABASE SCHEMA DUMP (read-only, safe to run)
-- Run each section in SQL Editor and paste/save the results.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLES & COLUMNS (detailed)
-- ------------------------------------------------------------
SELECT 
  c.table_name AS "Table",
  c.column_name AS "Column",
  c.ordinal_position AS "Order",
  c.data_type AS "Data type",
  COALESCE(c.character_maximum_length::text, c.numeric_precision::text, '-') AS "Length/Precision",
  c.is_nullable AS "Nullable",
  COALESCE(c.column_default, '-') AS "Default"
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;


-- ------------------------------------------------------------
-- 2. PRIMARY KEYS
-- ------------------------------------------------------------
SELECT 
  tc.table_name AS "Table",
  kcu.column_name AS "Primary key column"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name;


-- ------------------------------------------------------------
-- 3. FOREIGN KEYS (relationships)
-- ------------------------------------------------------------
SELECT 
  tc.table_name AS "From table",
  kcu.column_name AS "Column",
  ccu.table_name AS "References table",
  ccu.column_name AS "References column",
  tc.constraint_name AS "Constraint name"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;


-- ------------------------------------------------------------
-- 4. CHECK CONSTRAINTS (e.g. notification type enum)
-- ------------------------------------------------------------
SELECT 
  tc.table_name AS "Table",
  tc.constraint_name AS "Constraint",
  cc.check_clause AS "Check clause"
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name;


-- ------------------------------------------------------------
-- 5. RLS POLICIES (full definition)
-- ------------------------------------------------------------
SELECT 
  tablename AS "Table",
  policyname AS "Policy name",
  cmd AS "Command",
  permissive AS "Permissive",
  roles::text AS "Roles",
  qual AS "Using expression (WHO can see rows)",
  with_check AS "With check (WHAT can be inserted/updated)"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ------------------------------------------------------------
-- 6. RLS ENABLED per table
-- ------------------------------------------------------------
SELECT 
  relname AS "Table",
  CASE WHEN relrowsecurity THEN 'Yes' ELSE 'No' END AS "RLS enabled"
FROM pg_class
WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND relkind = 'r'
ORDER BY relname;


-- ------------------------------------------------------------
-- 7. TRIGGERS
-- ------------------------------------------------------------
SELECT 
  event_object_table AS "Table",
  trigger_name AS "Trigger",
  event_manipulation AS "Event",
  action_timing AS "When",
  action_statement AS "Action"
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;


-- ------------------------------------------------------------
-- 8. INDEXES (non-primary)
-- ------------------------------------------------------------
SELECT 
  tablename AS "Table",
  indexname AS "Index name",
  indexdef AS "Definition"
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;
