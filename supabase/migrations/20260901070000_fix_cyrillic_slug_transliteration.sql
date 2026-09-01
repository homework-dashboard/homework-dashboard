/*
# Fix Cyrillic transliteration in human-readable URLs

The original slugify() used PostgreSQL translate() with a replacement string
that contained multi-character transliterations. translate() only supports
one-character-to-one-character mappings, so every mapping after the first
multi-character value was shifted.

This migration:
- replaces slugify() with explicit per-letter replacements;
- makes name/schedule updates regenerate their slugs;
- rebuilds existing teacher and lesson slugs with the corrected function.
*/

CREATE OR REPLACE FUNCTION slugify(input text) RETURNS text AS $$
DECLARE
  result text;
  cyrillic_letters text[] := ARRAY[
    'а', 'б', 'в', 'г', 'д', 'е', 'ё', 'ж', 'з', 'и', 'й',
    'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'у', 'ф',
    'х', 'ц', 'ч', 'ш', 'щ', 'ъ', 'ы', 'ь', 'э', 'ю', 'я'
  ];
  latin_letters text[] := ARRAY[
    'a', 'b', 'v', 'g', 'd', 'e', 'yo', 'zh', 'z', 'i', 'y',
    'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f',
    'kh', 'ts', 'ch', 'sh', 'shch', '', 'y', '', 'e', 'yu', 'ya'
  ];
  letter_index integer;
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN
    RETURN 'untitled';
  END IF;

  result := lower(input);

  FOR letter_index IN 1..array_length(cyrillic_letters, 1) LOOP
    result := replace(result, cyrillic_letters[letter_index], latin_letters[letter_index]);
  END LOOP;

  result := regexp_replace(result, '[^a-z0-9]+', '-', 'g');
  result := trim(both '-' from result);

  IF result = '' THEN
    result := 'untitled';
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Keep the two reported names as migration-level regression checks. A failed
-- check aborts the migration before any stored slugs are changed.
DO $$
BEGIN
  IF slugify('Абзалимова Регина Рамилевна') <> 'abzalimova-regina-ramilevna' THEN
    RAISE EXCEPTION 'Unexpected teacher slug transliteration';
  END IF;

  IF slugify('Христафоров Эдуард Марселевич') <> 'khristaforov-eduard-marselevich' THEN
    RAISE EXCEPTION 'Unexpected teacher slug transliteration';
  END IF;
END $$;

-- Regenerate a teacher slug whenever the name actually changes. On insert, a
-- deliberately supplied slug is still respected.
CREATE OR REPLACE FUNCTION set_teacher_slug() RETURNS trigger AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
    RETURN NEW;
  END IF;

  base_slug := slugify(NEW.name);
  final_slug := base_slug;
  counter := 1;

  WHILE EXISTS (
    SELECT 1
    FROM teachers
    WHERE slug = final_slug
      AND id <> NEW.id
  ) LOOP
    final_slug := base_slug || '-' || counter::text;
    counter := counter + 1;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the same update semantics to lesson slugs.
CREATE OR REPLACE FUNCTION set_lesson_slug() RETURNS trigger AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer;
  weekday_names text[] := ARRAY[
    'voskresene', 'ponedelnik', 'vtornik', 'sreda',
    'chetver', 'pyatnitsa', 'subbota'
  ];
  weekday_name text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.slug IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.weekday IS NOT DISTINCT FROM OLD.weekday
     AND NEW.class_name IS NOT DISTINCT FROM OLD.class_name THEN
    RETURN NEW;
  END IF;

  IF NEW.weekday IS NOT NULL AND NEW.weekday BETWEEN 1 AND 7 THEN
    weekday_name := weekday_names[NEW.weekday];
  ELSE
    weekday_name := 'urok';
  END IF;

  base_slug := slugify(weekday_name || '-' || COALESCE(NEW.class_name, ''));
  final_slug := base_slug;
  counter := 1;

  WHILE EXISTS (
    SELECT 1
    FROM lessons
    WHERE slug = final_slug
      AND id <> NEW.id
  ) LOOP
    final_slug := base_slug || '-' || counter::text;
    counter := counter + 1;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Clear first so corrected slugs cannot collide with stale values while they
-- are rebuilt. The partial unique indexes allow NULL during this transaction.
UPDATE teachers SET slug = NULL;
UPDATE lessons SET slug = NULL;

DO $$
DECLARE
  teacher_record record;
  base_slug text;
  final_slug text;
  counter integer;
BEGIN
  FOR teacher_record IN SELECT id, name FROM teachers ORDER BY id LOOP
    base_slug := slugify(teacher_record.name);
    final_slug := base_slug;
    counter := 1;

    WHILE EXISTS (
      SELECT 1
      FROM teachers
      WHERE slug = final_slug
        AND id <> teacher_record.id
    ) LOOP
      final_slug := base_slug || '-' || counter::text;
      counter := counter + 1;
    END LOOP;

    UPDATE teachers
    SET slug = final_slug
    WHERE id = teacher_record.id;
  END LOOP;
END $$;

DO $$
DECLARE
  lesson_record record;
  base_slug text;
  final_slug text;
  counter integer;
  weekday_names text[] := ARRAY[
    'voskresene', 'ponedelnik', 'vtornik', 'sreda',
    'chetver', 'pyatnitsa', 'subbota'
  ];
  weekday_name text;
BEGIN
  FOR lesson_record IN SELECT id, weekday, class_name FROM lessons ORDER BY id LOOP
    IF lesson_record.weekday IS NOT NULL AND lesson_record.weekday BETWEEN 1 AND 7 THEN
      weekday_name := weekday_names[lesson_record.weekday];
    ELSE
      weekday_name := 'urok';
    END IF;

    base_slug := slugify(weekday_name || '-' || COALESCE(lesson_record.class_name, ''));
    final_slug := base_slug;
    counter := 1;

    WHILE EXISTS (
      SELECT 1
      FROM lessons
      WHERE slug = final_slug
        AND id <> lesson_record.id
    ) LOOP
      final_slug := base_slug || '-' || counter::text;
      counter := counter + 1;
    END LOOP;

    UPDATE lessons
    SET slug = final_slug
    WHERE id = lesson_record.id;
  END LOOP;
END $$;
