-- Education RLS hardening
-- Goal: make course/module writes explicit and reliable for owners + managers.
-- Idempotent: safe to run multiple times.

ALTER TABLE IF EXISTS public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.course_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_courses" ON public.courses;
DROP POLICY IF EXISTS "staff_read_courses" ON public.courses;
DROP POLICY IF EXISTS "owners_course_modules" ON public.course_modules;
DROP POLICY IF EXISTS "owners_course_enrollments" ON public.course_enrollments;
DROP POLICY IF EXISTS "owners_course_quizzes" ON public.course_quizzes;
DROP POLICY IF EXISTS "owners_course_resources" ON public.course_resources;

-- Read access: store owner or any store member
CREATE POLICY "courses_select_access"
ON public.courses
FOR SELECT
USING (
  store_id IN (
    SELECT s.id
    FROM public.stores s
    WHERE s.owner_id = auth.uid()
    UNION
    SELECT m.store_id
    FROM public.store_members m
    WHERE m.user_id = auth.uid()
  )
);

-- Write access: store owner or manager only
CREATE POLICY "courses_manage_owner_manager"
ON public.courses
FOR ALL
USING (
  store_id IN (
    SELECT s.id
    FROM public.stores s
    WHERE s.owner_id = auth.uid()
    UNION
    SELECT m.store_id
    FROM public.store_members m
    WHERE m.user_id = auth.uid()
      AND m.role = 'manager'
  )
)
WITH CHECK (
  store_id IN (
    SELECT s.id
    FROM public.stores s
    WHERE s.owner_id = auth.uid()
    UNION
    SELECT m.store_id
    FROM public.store_members m
    WHERE m.user_id = auth.uid()
      AND m.role = 'manager'
  )
);

CREATE POLICY "course_modules_access"
ON public.course_modules
FOR ALL
USING (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
)
WITH CHECK (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
);

CREATE POLICY "course_enrollments_access"
ON public.course_enrollments
FOR ALL
USING (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
)
WITH CHECK (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
);

CREATE POLICY "course_quizzes_access"
ON public.course_quizzes
FOR ALL
USING (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
)
WITH CHECK (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
);

CREATE POLICY "course_resources_access"
ON public.course_resources
FOR ALL
USING (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
)
WITH CHECK (
  course_id IN (
    SELECT c.id
    FROM public.courses c
    WHERE c.store_id IN (
      SELECT s.id
      FROM public.stores s
      WHERE s.owner_id = auth.uid()
      UNION
      SELECT m.store_id
      FROM public.store_members m
      WHERE m.user_id = auth.uid()
        AND m.role = 'manager'
    )
  )
);
