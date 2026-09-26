-- Plafonds partagés entre les instances serveur.
-- Seul le rôle service peut consommer un compteur.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_max integer,
  p_window_ms integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_window interval;
BEGIN
  IF p_key IS NULL OR length(btrim(p_key)) = 0 OR length(p_key) > 180 THEN
    RETURN false;
  END IF;
  IF p_max IS NULL OR p_max < 1 OR p_max > 10000 THEN
    RETURN false;
  END IF;
  IF p_window_ms IS NULL OR p_window_ms < 1000 OR p_window_ms > 604800000 THEN
    RETURN false;
  END IF;

  DELETE FROM public.rate_limits
  WHERE bucket_key IN (
    SELECT bucket_key
    FROM public.rate_limits
    WHERE reset_at < now() - interval '1 day'
    LIMIT 20
  );

  v_window := p_window_ms * interval '1 millisecond';

  INSERT INTO public.rate_limits (bucket_key, count, reset_at)
  VALUES (p_key, 1, now() + v_window)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    count = CASE
      WHEN public.rate_limits.reset_at <= now() THEN 1
      WHEN public.rate_limits.count > p_max THEN public.rate_limits.count
      ELSE public.rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN public.rate_limits.reset_at <= now() THEN now() + v_window
      ELSE public.rate_limits.reset_at
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;
