UPDATE news_items AS n
SET
  published = false,
  impacts_already_applied = false,
  published_at = now() + (o.rn * interval '10 minutes')
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at ASC) AS rn
  FROM news_items
) AS o
WHERE n.id = o.id;
