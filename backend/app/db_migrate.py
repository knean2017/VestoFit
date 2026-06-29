"""Lightweight schema patches for dev DBs (create_all does not alter existing tables)."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def run_migrations(conn: AsyncConnection) -> None:
    await conn.execute(
        text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'avatars'
                ) THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'avatars' AND column_name = 'photo_key'
                    ) THEN
                        ALTER TABLE avatars ADD COLUMN photo_key TEXT;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'avatars' AND column_name = 'base_photo_key'
                    ) THEN
                        UPDATE avatars
                        SET photo_key = base_photo_key
                        WHERE photo_key IS NULL AND base_photo_key IS NOT NULL;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'avatars' AND column_name = 'photo_keys'
                    ) THEN
                        UPDATE avatars
                        SET photo_key = photo_keys[1]
                        WHERE photo_key IS NULL
                          AND photo_keys IS NOT NULL
                          AND array_length(photo_keys, 1) > 0;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'avatars' AND column_name = 'generated_photo_key'
                    ) THEN
                        UPDATE avatars
                        SET photo_key = generated_photo_key
                        WHERE photo_key IS NULL AND generated_photo_key IS NOT NULL;
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'avatars' AND column_name = 'original_photo_key'
                    ) THEN
                        UPDATE avatars
                        SET photo_key = original_photo_key
                        WHERE (photo_key IS NULL OR photo_key = '')
                          AND original_photo_key IS NOT NULL;
                    END IF;

                    DELETE FROM avatars WHERE photo_key IS NULL;

                    ALTER TABLE avatars DROP COLUMN IF EXISTS photo_keys;
                    ALTER TABLE avatars DROP COLUMN IF EXISTS base_photo_key;
                    ALTER TABLE avatars DROP COLUMN IF EXISTS pose_scores;
                    ALTER TABLE avatars DROP COLUMN IF EXISTS generated_photo_key;
                    ALTER TABLE avatars DROP COLUMN IF EXISTS original_photo_key;
                    ALTER TABLE avatars DROP COLUMN IF EXISTS gender;
                    ALTER TABLE avatars DROP COLUMN IF EXISTS generation_status;
                    ALTER TABLE avatars DROP COLUMN IF EXISTS generation_error;

                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'avatars' AND column_name = 'updated_at'
                    ) THEN
                        ALTER TABLE avatars
                        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
                    END IF;

                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'avatars'
                          AND column_name = 'photo_key'
                          AND is_nullable = 'YES'
                    ) THEN
                        ALTER TABLE avatars ALTER COLUMN photo_key SET NOT NULL;
                    END IF;
                END IF;
            END $$;
            """
        )
    )

    await conn.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'country'
                ) THEN
                    ALTER TABLE users ADD COLUMN country VARCHAR(2);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'city'
                ) THEN
                    ALTER TABLE users ADD COLUMN city VARCHAR(100);
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'lat'
                ) THEN
                    ALTER TABLE users ADD COLUMN lat DOUBLE PRECISION;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'lng'
                ) THEN
                    ALTER TABLE users ADD COLUMN lng DOUBLE PRECISION;
                END IF;
            END $$;
            """
        )
    )
