-- US-569. The trends MCP serves count only shown posts, and a shown post is
-- one a small seller could answer, so the MCP role reads `seller_fit` too.
grant select (seller_fit) on requests to radar_reader;
