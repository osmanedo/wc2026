select 
  'CREATE EXTENSION IF NOT EXISTS "' || extname || '";' as ddl
from pg_extension
where extname != 'plpgsql'  -- always there, no need
order by extname;

------ Result:
| ddl                                                  |
| ---------------------------------------------------- |
| CREATE EXTENSION IF NOT EXISTS "pg_cron";            |
| CREATE EXTENSION IF NOT EXISTS "pg_net";             |
| CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; |
| CREATE EXTENSION IF NOT EXISTS "pgcrypto";           |
| CREATE EXTENSION IF NOT EXISTS "supabase_vault";     |
| CREATE EXTENSION IF NOT EXISTS "uuid-ossp";          |