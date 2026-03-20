WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn
  FROM news_items
)
UPDATE news_items n
SET
  published = false,
  impacts_already_applied = false,
  published_at = now() + (ordered.rn * interval '10 minutes')
FROM ordered
WHERE n.id = ordered.id;
