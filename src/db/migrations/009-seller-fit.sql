-- US-561. Whether a small independent seller could answer the post with a
-- product of their own. Null for a post sorted before the question was asked:
-- not judged is not "no".
alter table requests add column seller_fit boolean;
