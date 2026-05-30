# Supabase migrations

Run `001_game_saves.sql` in the Supabase SQL Editor (Dashboard → SQL → New query) before using account-bound saves.

This creates the `game_saves` table with row-level security so each user can only access their own characters and adventure progress.
