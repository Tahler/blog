DO $$
BEGIN
	-- Existing rows start null so retries never overwrite a later preference change.
	ALTER TABLE "subscribers"
		ADD COLUMN IF NOT EXISTS "wants_travel" boolean;

	UPDATE "subscribers"
	SET "wants_travel" = "wants_other"
	WHERE "wants_travel" IS NULL;

	ALTER TABLE "subscribers"
		ALTER COLUMN "wants_travel" SET DEFAULT true,
		ALTER COLUMN "wants_travel" SET NOT NULL;
END
$$;
