-- Guide administration uses the runtime connection; the seeded tables were read-only.
GRANT INSERT, UPDATE ON app.size_guides TO blesh_runtime;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON app.size_guide_rows TO blesh_runtime;
