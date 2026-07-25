| jobid | jobname                | schedule    | command                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | active | database | username |
| ----- | ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------- | -------- |
| 1     | trigger-update-results | */5 * * * * | 
  select net.http_post(
    url := 'https://api.github.com/repos/osmanedo/wc2026/actions/workflows/update_results.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_workflow_pat'),
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'User-Agent', 'supabase-pg-net'
    ),
    body := jsonb_build_object('ref', 'main')
  );
   | true   | postgres | postgres |